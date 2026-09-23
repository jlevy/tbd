import type { Stats } from 'node:fs';
import { lstat, mkdir, readFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';

import { AGENTS_MD_LOCK_DIR } from '../../lib/paths.js';
import { topLevelMarkerLines } from '../../lib/policy-grants.js';
import { withLockfile, type LockfileOptions } from '../../utils/lockfile.js';
import { CLIError } from './errors.js';

export type ManagedArtifactState = 'current' | 'stale' | 'missing' | 'user-owned' | 'too-new';

export interface ManagedArtifactInspection {
  state: ManagedArtifactState;
  format?: string;
}

export interface InspectManagedArtifactOptions {
  path: string;
  expectedContent: string;
  ownershipMarker: string;
  supportedFormat: string;
  selectManagedContent?: (content: string) => string;
}

/** Byte span occupied by one complete marker-delimited managed block. */
export interface ManagedBlockLocation {
  /** Offset of the begin marker itself; leading indentation remains in the prefix. */
  start: number;
  /** Exclusive offset after the end marker line, including its line ending when present. */
  end: number;
}

export interface SafeManagedArtifactTargetOptions {
  /** Accept ENOENT when the caller is allowed to create the file. */
  allowMissing?: boolean;
  /** Also reject linked or non-directory parents below this selected project root. */
  projectRoot?: string;
  /**
   * The verb for the refusal message. `tbd uninstall` and `tbd doctor` do not
   * update anything, so "Refusing to update" misdescribes what they were doing.
   */
  operation?: string;
}

/**
 * A managed-file target that tbd will not touch: a link or other non-regular
 * entry, a linked or non-directory parent, or a path outside the project.
 *
 * Callers act on this differently and none of them should abort a whole run over
 * it: setup records it as that surface's failure, uninstall treats the path as
 * not tbd's and skips it. `reason` is the cause alone, for a caller that frames
 * it in its own sentence.
 */
export class ManagedArtifactTargetError extends CLIError {
  constructor(
    readonly targetPath: string,
    readonly reason: string,
    fix: string,
    operation: string,
  ) {
    super(`Refusing to ${operation} ${targetPath}: ${reason}.${fix ? ` ${fix}` : ''}`);
    this.name = 'ManagedArtifactTargetError';
  }
}

/**
 * The only two conditions that stop a whole `tbd setup` run, because continuing
 * would destroy data rather than skip one surface: a generated surface stamped
 * by a newer tbd than this client understands, and a policy block this client
 * cannot read and so must not overwrite.
 */
export class SetupHardStopError extends CLIError {
  constructor(message: string) {
    super(message);
    this.name = 'SetupHardStopError';
  }
}

/** Check parents from the selected root outward, before following any of them. */
async function assertSafeManagedArtifactParents(
  path: string,
  projectRoot: string,
  operation: string,
): Promise<void> {
  const root = resolve(projectRoot);
  const parents = relative(root, dirname(resolve(path)));
  if (parents === '..' || parents.startsWith(`..${sep}`) || isAbsolute(parents)) {
    throw new ManagedArtifactTargetError(path, 'the target is outside the project', '', operation);
  }
  let parent = root;
  for (const component of parents.split(sep).filter(Boolean)) {
    parent = join(parent, component);
    let stats: Stats;
    try {
      stats = await lstat(parent);
    } catch (error) {
      if (isErrorWithCode(error, 'ENOENT')) {
        // No deeper component can exist until this missing directory is created.
        return;
      }
      throw error;
    }
    // Both parent refusals are one type, so a caller classifies them together
    // rather than by an errno that only one of them carries.
    if (stats.isSymbolicLink()) {
      throw new ManagedArtifactTargetError(
        path,
        `parent ${parent} is a symbolic link`,
        'Use regular directories inside the project and retry.',
        operation,
      );
    }
    if (!stats.isDirectory()) {
      throw new ManagedArtifactTargetError(
        path,
        `parent ${parent} is not a directory`,
        'Use regular directories inside the project and retry.',
        operation,
      );
    }
  }
}

/**
 * Refuse managed-file targets that can redirect or invalidate a project-local write.
 * `lstat` checks the entry itself; with projectRoot, parents are checked first so
 * neither reading nor mutation follows a linked directory below the selected root.
 */
export async function assertSafeManagedArtifactTarget(
  path: string,
  options: SafeManagedArtifactTargetOptions = {},
): Promise<void> {
  const operation = options.operation ?? 'update';
  if (options.projectRoot !== undefined) {
    await assertSafeManagedArtifactParents(path, options.projectRoot, operation);
  }
  let stats: Stats;
  try {
    stats = await lstat(path);
  } catch (error) {
    if (isErrorWithCode(error, 'ENOENT')) {
      if (options.allowMissing) {
        return;
      }
      throw new ManagedArtifactTargetError(
        path,
        'the file does not exist',
        'Create it as a regular file and retry.',
        operation,
      );
    }
    throw error;
  }

  if (stats.isFile()) {
    return;
  }

  throw new ManagedArtifactTargetError(
    path,
    `expected a regular file, but found ${managedTargetKind(stats)}`,
    'Replace it with a regular file inside the project and retry.',
    operation,
  );
}

/**
 * Lock timing for one managed-file rewrite: read a file, replace a block, rename
 * it. Seconds are generous for that, and a waiter should give up and say so
 * rather than block an agent. `timeoutMs` stays above `staleMs` so a crashed
 * holder is always broken as stale before a waiter times out.
 */
const MANAGED_ARTIFACT_LOCK_OPTIONS: Required<LockfileOptions> = {
  timeoutMs: 15_000,
  pollMs: 50,
  staleMs: 10_000,
};

/**
 * Serialize one read/compute/write cycle on this checkout's AGENTS.md.
 *
 * Atomic publication alone cannot prevent a concurrent revocation being lost, so
 * the whole cycle is serialized. The lock lives beside the file it guards, under
 * the checkout's gitignored `.tbd/`, and deliberately not under the repository's
 * shared `$GIT_COMMON_DIR/tbd`: AGENTS.md is per worktree, the shared tree is
 * unwritable in a common agent sandbox, and taking the data-sync lock also bumps
 * the epoch the web board reads on every grant.
 */
export async function withAgentsMdLock<T>(projectRoot: string, fn: () => Promise<T>): Promise<T> {
  const lockPath = join(projectRoot, AGENTS_MD_LOCK_DIR);
  await mkdir(dirname(lockPath), { recursive: true });
  if (await pathIsPresent(lockPath)) {
    // Progress, not data: a `--json` caller's stdout must stay parseable.
    process.stderr.write('Waiting for another tbd process to finish writing AGENTS.md...\n');
  }
  return withLockfile(lockPath, () => fn(), MANAGED_ARTIFACT_LOCK_OPTIONS);
}

async function pathIsPresent(path: string): Promise<boolean> {
  try {
    await lstat(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Return the numeric portion of an integration format stamp. Stamps written
 * through tbd 0.9.0 are two digits (f01..f08, the repository format of the day);
 * later stamps are three digits (f100 and up). Numeric order works across both:
 * `f100` is 100 against 0.9.0's ceiling of 8, so 0.9.0 refuses the surface
 * through the comparison it already ships, with no change to 0.9.0.
 */
export function integrationFormatNumber(format: string): number {
  return Number.parseInt(format.replace(/^f/, ''), 10);
}

/**
 * A line that opens one of tbd's own markers, in any generated surface: the
 * AGENTS.md block (`<!-- BEGIN TBD …`), a generated skill (`<!-- DO NOT EDIT: …`),
 * or a tier agent definition, where the same marker is a TOML or Markdown comment.
 */
const STAMP_LINE = /^(?:<!--|#|\/\/)?\s*(?:BEGIN TBD |DO NOT EDIT: Generated by tbd setup)/;

/**
 * Read the `format=fN...` stamp from generated integration content. The regex and
 * the numeric comparison above are what every released tbd uses, so a new stamp
 * must parse here as a number above the older release's ceiling.
 *
 * Only a line that opens one of tbd's own markers counts. Reading the first
 * `format=` anywhere in the file let a line of prose quoting an older stamp stand
 * in for the real one, and the guard that stops an older tbd from rewriting a
 * newer surface then permitted the write.
 */
export function parseManagedIntegrationFormat(content: string): string | null {
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!STAMP_LINE.test(trimmed)) {
      continue;
    }
    const match = /format=f(\d+)/.exec(trimmed);
    if (match?.[1]) {
      return `f${match[1]}`;
    }
  }
  return null;
}

/**
 * Inspect a tbd-owned text artifact without changing it.
 *
 * Setup dry runs and doctor diagnostics share this comparison so they cannot
 * disagree about whether the generated file is current, stale, or unsafe to
 * replace.
 */
export async function inspectManagedArtifact(
  options: InspectManagedArtifactOptions,
): Promise<ManagedArtifactInspection> {
  let existing: string;
  try {
    existing = await readFile(options.path, 'utf-8');
  } catch (error) {
    if (isErrorWithCode(error, 'ENOENT')) {
      return { state: 'missing' };
    }
    throw error;
  }

  let managedContent: string;
  if (options.selectManagedContent) {
    managedContent = options.selectManagedContent(existing);
    if (managedContent.length === 0) {
      return { state: 'user-owned' };
    }
  } else {
    if (!existing.includes(options.ownershipMarker)) {
      return { state: 'user-owned' };
    }
    managedContent = existing;
  }
  const format = parseManagedIntegrationFormat(managedContent) ?? 'f01';
  if (integrationFormatNumber(format) > integrationFormatNumber(options.supportedFormat)) {
    return { state: 'too-new', format };
  }

  return {
    state: sameManagedContent(managedContent, options.expectedContent) ? 'current' : 'stale',
    format,
  };
}

/**
 * Compare managed content ignoring line endings. Every generator emits LF, while a
 * Windows checkout holds CRLF, so a raw comparison calls each managed surface stale on
 * that platform; setup then writes an LF block into a CRLF file, which leaves the file
 * modified with an empty diff and stale again after the next write.
 */
function sameManagedContent(actual: string, expected: string): boolean {
  return actual === expected || toLf(actual) === toLf(expected);
}

function toLf(text: string): string {
  return text.replace(/\r\n/gu, '\n');
}

/**
 * Extract one marker-delimited managed block, including both marker lines. A
 * marker counts only as its own line, so a line of prose quoting one cannot move
 * the block's boundaries (and with them the stamp this file reads).
 */
export function extractManagedBlock(
  content: string,
  beginMarker: string,
  endMarker: string,
): string {
  const location = locateManagedBlock(content, beginMarker, endMarker);
  if (!location) {
    return '';
  }
  return content.slice(location.start, location.end).trimEnd() + '\n';
}

/**
 * Locate one complete managed block using top-level marker lines, never marker
 * substrings in prose or inline code, and never a marker-shaped line inside
 * fenced or indented code (a documented example used to anchor the block, so an
 * update replaced the project's text between the example and the real END
 * marker). Begin markers are stable prefixes whose metadata may change; end
 * markers are complete, exact lines. The returned end is suitable for exact
 * prefix/block/suffix replacement, so readers and writers share one boundary
 * calculation, the same one the policy block reader uses.
 */
export function locateManagedBlock(
  content: string,
  beginMarker: string,
  endMarker: string,
): ManagedBlockLocation | null {
  const lines = topLevelMarkerLines(content);
  const begin = lines.find((line) => line.text.startsWith(beginMarker));
  if (!begin) {
    return null;
  }
  const end = lines.find((line) => line.offset > begin.offset && line.text === endMarker);
  if (!end) {
    return null;
  }

  const nextNewline = content.indexOf('\n', end.offset + endMarker.length);
  return {
    start: begin.offset,
    end: nextNewline < 0 ? content.length : nextNewline + 1,
  };
}

function isErrorWithCode(error: unknown, code: string): boolean {
  return (
    error instanceof Error &&
    'code' in error &&
    typeof error.code === 'string' &&
    error.code === code
  );
}

/** Bounded description for diagnostics; never render device metadata or link targets. */
function managedTargetKind(stats: Stats): string {
  if (stats.isSymbolicLink()) {
    return 'a symbolic link';
  }
  if (stats.isDirectory()) {
    return 'a directory';
  }
  if (stats.isSocket()) {
    return 'a socket';
  }
  if (stats.isFIFO()) {
    return 'a FIFO';
  }
  if (stats.isBlockDevice()) {
    return 'a block device';
  }
  if (stats.isCharacterDevice()) {
    return 'a character device';
  }
  return 'a non-regular filesystem entry';
}
