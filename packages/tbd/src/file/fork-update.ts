/**
 * Updating forked docs after upstream moves: three-way merge plus the per-state
 * decision logic from the spec's update table.
 *
 * The merge itself is outsourced to git (`git merge-file`), which works on plain
 * files, reports the conflict count via exit code, and uses standard conflict
 * markers. Nothing in the git repo state is touched.
 */

import { execFile } from 'node:child_process';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { writeFile } from 'atomically';

import {
  type ForkEntry,
  CONFLICT_LABELS,
  compareVersionsLoose,
  hashContent,
  hasUnresolvedConflict,
  normalizeLineEndings,
} from './fork-manifest.js';

/** Result of a three-way merge. */
export interface MergeResult {
  merged: string;
  /** Number of conflict hunks (0 = clean). */
  conflicts: number;
}

const MERGE_MAX_BUFFER = 16 * 1024 * 1024;

/**
 * Three-way merge of `current` and `other` against their common `base`, via
 * `git merge-file -p`. Returns the merged text (with standard conflict markers
 * when conflicts arise) and the conflict count. Pure with respect to repo state:
 * it only uses temporary files.
 */
export async function mergeContents(
  current: string,
  base: string,
  other: string,
  labels: { current?: string; base?: string; other?: string } = {},
): Promise<MergeResult> {
  const dir = await mkdtemp(join(tmpdir(), 'tbd-merge-'));
  const currentPath = join(dir, 'current');
  const basePath = join(dir, 'base');
  const otherPath = join(dir, 'other');
  try {
    // Normalize line endings before the merge. Hashing is LF-normalized, so a
    // CRLF fork file vs an LF base/upstream would otherwise make git merge-file
    // see every line as changed and report a spurious whole-file conflict. The
    // merged output is LF (matching the hash basis).
    await Promise.all([
      writeFile(currentPath, normalizeLineEndings(current)),
      writeFile(basePath, normalizeLineEndings(base)),
      writeFile(otherPath, normalizeLineEndings(other)),
    ]);

    const args = [
      'merge-file',
      '-p',
      '-L',
      labels.current ?? CONFLICT_LABELS.ours,
      '-L',
      labels.base ?? CONFLICT_LABELS.base,
      '-L',
      labels.other ?? CONFLICT_LABELS.theirs,
      currentPath,
      basePath,
      otherPath,
    ];

    return await new Promise<MergeResult>((resolve, reject) => {
      execFile('git', args, { maxBuffer: MERGE_MAX_BUFFER }, (error, stdout) => {
        if (error) {
          const code = (error as NodeJS.ErrnoException & { code?: number }).code;
          // git merge-file exits with the number of conflicts (>0); negative/other
          // codes are real errors.
          if (typeof code === 'number' && code > 0) {
            resolve({ merged: stdout, conflicts: code });
            return;
          }
          reject(error instanceof Error ? error : new Error('git merge-file failed'));
          return;
        }
        resolve({ merged: stdout, conflicts: 0 });
      });
    });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/**
 * Unified diff of two contents via `git diff --no-index`. Returns the diff text
 * (empty string when identical). Uses temporary files and touches no repo state.
 */
export async function diffContents(
  left: string,
  right: string,
  labels: { left?: string; right?: string } = {},
): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'tbd-diff-'));
  // Name the temp files after the labels and run from the temp dir with --no-prefix
  // so the diff header reads e.g. "--- upstream / +++ ours" instead of temp paths.
  const leftName = labels.left ?? 'a';
  const rightName = labels.right ?? 'b';
  try {
    await Promise.all([
      writeFile(join(dir, leftName), left),
      writeFile(join(dir, rightName), right),
    ]);
    return await new Promise<string>((resolve, reject) => {
      const args = ['diff', '--no-index', '--no-color', '--no-prefix', leftName, rightName];
      execFile('git', args, { cwd: dir, maxBuffer: MERGE_MAX_BUFFER }, (error, stdout) => {
        if (error) {
          const code = (error as NodeJS.ErrnoException & { code?: number }).code;
          // git diff exits 1 when the files differ — that's the normal case.
          if (code === 1) {
            resolve(stdout);
            return;
          }
          reject(error instanceof Error ? error : new Error('git diff failed'));
          return;
        }
        resolve(stdout);
      });
    });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/** Update strategy chosen by the user for non-clean cases. */
export type UpdateStrategy = 'default' | 'merge' | 'keep-ours';

/** What an update did (or why it was skipped) for one doc. */
export type UpdateAction =
  | 'noop'
  | 'replaced'
  | 'merged-clean'
  | 'merged-conflict'
  | 'kept'
  | 'repaired'
  | 'skip-not-stale'
  | 'skip-conflict-listed'
  | 'skip-unresolved'
  | 'skip-orphaned'
  | 'skip-missing'
  | 'skip-no-base'
  | 'skip-newer-base';

export interface UpdateOneInput {
  entry: ForkEntry;
  /** Current forked file content, or null if the file is missing. */
  forkContent: string | null;
  /** Stored base snapshot, or null if the base file is missing. */
  baseContent: string | null;
  /** Current upstream/cache content, or null if the source is gone (orphaned). */
  upstreamContent: string | null;
  strategy: UpdateStrategy;
  /**
   * The running tbd version. When the entry's base was advanced by a NEWER tbd
   * (entry.tbd_version > runningVersion), this client's "upstream" is older than
   * the fork point and an update would silently downgrade the doc — so the doc
   * is skipped under every strategy until the client upgrades.
   */
  runningVersion?: string;
}

export interface UpdateOneResult {
  action: UpdateAction;
  /** New forked-file content to write, when the action changes the file. */
  newFileContent?: string;
  /** New base content to write (advances the fork point), when applicable. */
  newBaseContent?: string;
  /** Set the manifest `conflicted` flag (markers written). */
  setConflicted?: boolean;
  /** Whether this doc needs a strategy decision (default run could not proceed). */
  needsDecision?: boolean;
  /** Human-readable one-line explanation. */
  message: string;
}

/**
 * Decide and (when needed) perform the three-way merge for a single forked doc,
 * implementing the spec's update decision table across the default / --merge /
 * --keep-ours strategies. Pure aside from the git merge-file call.
 */
export async function updateOne(input: UpdateOneInput): Promise<UpdateOneResult> {
  const { entry, forkContent, baseContent, upstreamContent, strategy } = input;
  const name = entry.name;

  if (forkContent === null) {
    return { action: 'skip-missing', message: `${name}: forked file is missing (doctor's job)` };
  }
  if (upstreamContent === null) {
    return {
      action: 'skip-orphaned',
      message: `${name}: upstream removed this doc — keep your copy or 'tbd docs unfork ${name}'`,
    };
  }
  // An unresolved conflicted doc must be resolved before any update. Keys off
  // tbd's own labeled markers so a doc that legitimately contains conflict-marker
  // examples is not blocked forever.
  if (entry.conflicted && hasUnresolvedConflict(forkContent)) {
    return {
      action: 'skip-unresolved',
      message: `${name}: unresolved conflict markers — resolve them first`,
    };
  }

  // Version-skew guard: if the base was advanced by a newer tbd than this one,
  // this client's bundled "upstream" is OLDER than the fork point. Updating
  // would downgrade the doc (and ping-pong the base across the team), so the
  // doc is skipped under every strategy until this client upgrades.
  if (
    input.runningVersion !== undefined &&
    entry.tbd_version !== undefined &&
    compareVersionsLoose(input.runningVersion, entry.tbd_version) === -1
  ) {
    return {
      action: 'skip-newer-base',
      message:
        `${name}: fork point was set by tbd ${entry.tbd_version} (you have ` +
        `${input.runningVersion}) — upgrade tbd before updating this doc`,
    };
  }

  if (baseContent === null) {
    if (strategy === 'keep-ours') {
      // Repair: re-establish the base from current upstream, keep the file.
      return {
        action: 'repaired',
        newBaseContent: upstreamContent,
        message: `${name}: re-established missing base from upstream (file kept)`,
      };
    }
    return {
      action: 'skip-no-base',
      needsDecision: true,
      message: `${name}: base snapshot missing — cannot merge; re-run with --keep-ours to repair`,
    };
  }

  const customized = hashContent(forkContent) !== hashContent(baseContent);
  const stale = hashContent(upstreamContent) !== hashContent(baseContent);

  if (!stale) {
    return { action: 'skip-not-stale', message: `${name}: already up to date` };
  }

  // Unmodified fork that is stale: refresh to upstream (default/merge), or keep
  // the local copy and just advance the base (keep-ours).
  if (!customized) {
    if (strategy === 'keep-ours') {
      return {
        action: 'kept',
        newBaseContent: upstreamContent,
        message: `${name}: kept your version; fork point advanced`,
      };
    }
    return {
      action: 'replaced',
      newFileContent: upstreamContent,
      newBaseContent: upstreamContent,
      message: `${name}: refreshed to upstream (was unmodified)`,
    };
  }

  // Customized and stale.
  if (strategy === 'keep-ours') {
    return {
      action: 'kept',
      newBaseContent: upstreamContent,
      message: `${name}: kept your version; fork point advanced`,
    };
  }

  const merge = await mergeContents(forkContent, baseContent, upstreamContent);
  if (merge.conflicts === 0) {
    return {
      action: 'merged-clean',
      newFileContent: merge.merged,
      newBaseContent: upstreamContent,
      message: `${name}: merged upstream cleanly (review with: git diff)`,
    };
  }

  // Conflicts.
  if (strategy === 'merge') {
    return {
      action: 'merged-conflict',
      newFileContent: merge.merged,
      newBaseContent: upstreamContent,
      setConflicted: true,
      message: `${name}: wrote merged content with conflict markers; resolve them, then it returns to 'customized'`,
    };
  }
  // Default: skip and surface the decision.
  return {
    action: 'skip-conflict-listed',
    needsDecision: true,
    message: `${name}: your changes conflict with upstream`,
  };
}

/** Read a file's content, or null if absent. */
export async function readMaybe(path: string): Promise<string | null> {
  try {
    return await readFile(path, 'utf-8');
  } catch {
    return null;
  }
}
