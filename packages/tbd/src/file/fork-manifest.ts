/**
 * Fork manifest and base snapshots for the forkable-docs workflow.
 *
 * All fork state lives under one committed directory, `.tbd/doc-forks/`:
 *   forks.yml        — the manifest (provenance, hashes, revisions)
 *   base/<kind>/<name>.md  — verbatim base snapshots (the merge bases)
 *
 * The base of every fork is a stored snapshot of the upstream content the fork
 * was created from. Together with `base_hash`, this makes "customized?",
 * "stale vs upstream?", and three-way merging cheap, exact, offline operations.
 *
 * The hashing and state computation here are pure functions (see
 * {@link hashContent} and {@link computeForkStatus}); only the read/write helpers
 * touch the filesystem.
 */

import { createHash } from 'node:crypto';
import { readFile, mkdir, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { writeFile } from 'atomically';
import { parse as parseYaml } from 'yaml';
import { z } from 'zod';

import { stringifyYaml } from '../utils/yaml-utils.js';
import { withLockfile } from '../utils/lockfile.js';
import { resolveSharedTbdPaths } from '../lib/paths.js';
import { isDocRef } from '../docref/index.js';

/** Directory (repo-relative under `.tbd/`) holding all fork state. */
export const DOC_FORKS_DIR = '.tbd/doc-forks';
/** Manifest filename within {@link DOC_FORKS_DIR}. */
export const FORKS_FILE = 'forks.yml';
/** Subdirectory within {@link DOC_FORKS_DIR} holding base snapshots. */
export const BASE_SUBDIR = 'base';

/** Doc kinds that can be forked. */
export const FORK_KINDS = ['guideline', 'shortcut', 'template', 'reference'] as const;
export type ForkKind = (typeof FORK_KINDS)[number];

// =============================================================================
// Schema
// =============================================================================

/**
 * A safe doc name: no path separators, no `..`, no leading dot, no NUL.
 * Names are used to build filesystem paths (and are a doc's identity), so a
 * crafted manifest must not be able to escape the fork dir (e.g. via a
 * `../../../../victim` name through `unfork --force`). Allows the punctuation
 * real doc names use (letters, digits, `.`, `_`, `-`).
 */
const SAFE_DOC_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
export function isSafeDocName(name: string): boolean {
  return SAFE_DOC_NAME.test(name) && !name.includes('..') && !name.endsWith('.md');
}

export const ForkEntrySchema = z.object({
  /** Doc name (e.g. "python-rules"). Constrained so it cannot escape the fork dir. */
  name: z.string().min(1).refine(isSafeDocName, {
    message: 'invalid doc name (no path separators, "..", or leading dot)',
  }),
  /** Doc kind — must be one of the known fork kinds. */
  kind: z.enum(FORK_KINDS),
  /** Repo-relative path of the forked file (e.g. "docs/tbd/guidelines/python-rules.md"). */
  path: z.string().min(1),
  /** Provenance docref the fork was created from (docref-everywhere rule). */
  source: z.string().min(1).refine(isDocRef, { message: 'source must be a valid docref' }),
  /** sha256: of the LF-normalized base content. */
  base_hash: z.string().min(1),
  /** tbd version when the base was last set. */
  tbd_version: z.string().optional(),
  /** Upstream commit at base time (git-hosted sources only). */
  source_revision: z.string().optional(),
  /** Exact/matching tag at base time, when one exists. */
  source_tag: z.string().optional(),
  /** Set by `update --merge` when it leaves conflict markers; auto-clears. */
  conflicted: z.boolean().optional(),
});

export type ForkEntry = z.infer<typeof ForkEntrySchema>;

export const ForkManifestSchema = z.object({
  forks: z.array(ForkEntrySchema).default([]),
});

export type ForkManifest = z.infer<typeof ForkManifestSchema>;

/** An empty manifest (no forks). */
export function emptyManifest(): ForkManifest {
  return { forks: [] };
}

// =============================================================================
// Hashing (pure)
// =============================================================================

/** Normalize line endings to LF so hashes are stable across platforms. */
export function normalizeLineEndings(content: string): string {
  return content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

/** sha256: hash of the LF-normalized content. */
export function hashContent(content: string): string {
  const hex = createHash('sha256').update(normalizeLineEndings(content), 'utf8').digest('hex');
  return `sha256:${hex}`;
}

/**
 * Whether `content` still contains git conflict markers. Requires all three
 * standard markers so prose that merely discusses one marker is not flagged.
 */
export function hasConflictMarkers(content: string): boolean {
  return /^<{7}/m.test(content) && /^={7}\s*$/m.test(content) && /^>{7}/m.test(content);
}

/**
 * The labels tbd writes into its three-way merge conflict markers. Detection of
 * an *unresolved* conflict keys off these specific labels (not generic marker
 * lines) so a forked doc that legitimately contains conflict-marker examples
 * (e.g. a git tutorial, or our own golden-testing guideline) is not stuck
 * `conflicted` forever after one unrelated `update --merge`.
 */
export const CONFLICT_LABELS = {
  ours: 'ours (your fork)',
  base: 'base (fork point)',
  theirs: 'theirs (upstream)',
} as const;

/** Whether `content` still carries tbd's own unresolved conflict markers. */
export function hasUnresolvedConflict(content: string): boolean {
  return (
    content.includes(`<<<<<<< ${CONFLICT_LABELS.ours}`) &&
    content.includes(`>>>>>>> ${CONFLICT_LABELS.theirs}`)
  );
}

/**
 * Loose semver comparison on major.minor.patch (prerelease ignored). Returns
 * null when either version is unparseable — callers must not guard on a version
 * they cannot parse (treat null as "do not block").
 */
export function compareVersionsLoose(a: string, b: string): -1 | 0 | 1 | null {
  const parse = (v: string): [number, number, number] | null => {
    const m = /^(\d+)\.(\d+)\.(\d+)/.exec(v.trim());
    return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
  };
  const pa = parse(a);
  const pb = parse(b);
  if (!pa || !pb) return null;
  for (let i = 0; i < 3; i++) {
    const x = pa[i]!;
    const y = pb[i]!;
    if (x < y) return -1;
    if (x > y) return 1;
  }
  return 0;
}

/**
 * Run `fn` while holding the doc-forks manifest lock, serializing the
 * read-modify-write of `forks.yml` across concurrent fork/unfork/update so
 * entries are not lost to last-writer-wins. The lock lives in the machine-local
 * git common dir (never committed), alongside the data-sync lock.
 */
export async function withForkManifestLock<T>(tbdRoot: string, fn: () => Promise<T>): Promise<T> {
  const paths = await resolveSharedTbdPaths(tbdRoot);
  await mkdir(paths.sharedLocksDir, { recursive: true });
  return withLockfile(join(paths.sharedLocksDir, 'doc-forks.lock'), fn);
}

// =============================================================================
// State computation (pure)
// =============================================================================

export type DocState =
  | 'upstream'
  | 'forked'
  | 'customized'
  | 'stale'
  | 'conflicted'
  | 'local'
  | 'missing'
  | 'orphaned';

/** Inputs for {@link computeForkStatus}; all comparisons are by hash. */
export interface ForkStatusInput {
  /** Whether a manifest entry exists for this doc. */
  inManifest: boolean;
  /** Whether the forked file is present on disk. */
  forkFileExists: boolean;
  /** sha256: of the current forked file (if present). */
  forkHash?: string;
  /** Recorded `base_hash` from the manifest entry. */
  baseHash?: string;
  /** sha256: of the current upstream/cache content; undefined if the source is gone. */
  cacheHash?: string;
  /** Manifest `conflicted` flag. */
  conflictedFlag?: boolean;
  /** Whether conflict markers are present in the current file. */
  markersPresent?: boolean;
}

/**
 * Computed lifecycle status of a doc. `state` is the headline for display; the
 * booleans are orthogonal modifiers (`customized` and `stale` can combine).
 */
export interface ForkStatus {
  state: DocState;
  customized: boolean;
  stale: boolean;
  conflicted: boolean;
  orphaned: boolean;
}

/**
 * Compute a doc's fork status from hashes and flags. Pure and total — every
 * combination of inputs maps to exactly one {@link ForkStatus}.
 */
export function computeForkStatus(input: ForkStatusInput): ForkStatus {
  const none = { customized: false, stale: false, conflicted: false, orphaned: false };

  if (!input.inManifest) {
    // A file in the fork dir with no manifest entry is a hand-authored local doc;
    // otherwise the doc is simply served from upstream via the cache.
    return { state: input.forkFileExists ? 'local' : 'upstream', ...none };
  }

  if (!input.forkFileExists) {
    return { state: 'missing', ...none };
  }

  const customized = input.forkHash !== input.baseHash;
  const orphaned = input.cacheHash === undefined;
  const stale = !orphaned && input.cacheHash !== input.baseHash;
  const conflicted = Boolean(input.conflictedFlag && input.markersPresent);

  // Headline state for display. `customized` and `stale` can combine; the
  // renderer composes "customized, stale" from state + the stale modifier.
  let state: DocState;
  if (conflicted) {
    state = 'conflicted';
  } else if (orphaned) {
    state = 'orphaned';
  } else if (customized) {
    state = 'customized';
  } else if (stale) {
    state = 'stale';
  } else {
    state = 'forked';
  }

  return { state, customized, stale, conflicted, orphaned };
}

// =============================================================================
// Manifest helpers (pure)
// =============================================================================

/** Find a fork entry by name, optionally constrained to a kind. */
export function findFork(
  manifest: ForkManifest,
  name: string,
  kind?: string,
): ForkEntry | undefined {
  return manifest.forks.find((f) => f.name === name && (kind === undefined || f.kind === kind));
}

/** Return a new manifest with `entry` inserted or replaced (matched by kind+name). */
export function upsertFork(manifest: ForkManifest, entry: ForkEntry): ForkManifest {
  const forks = manifest.forks.filter((f) => !(f.name === entry.name && f.kind === entry.kind));
  forks.push(entry);
  forks.sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name));
  return { forks };
}

/** Return a new manifest with the matching entry removed. */
export function removeFork(manifest: ForkManifest, name: string, kind?: string): ForkManifest {
  return {
    forks: manifest.forks.filter(
      (f) => !(f.name === name && (kind === undefined || f.kind === kind)),
    ),
  };
}

// =============================================================================
// Paths
// =============================================================================

export function forksDir(tbdRoot: string): string {
  return join(tbdRoot, DOC_FORKS_DIR);
}

export function forksFilePath(tbdRoot: string): string {
  return join(forksDir(tbdRoot), FORKS_FILE);
}

export function baseFilePath(tbdRoot: string, kind: string, name: string): string {
  return join(forksDir(tbdRoot), BASE_SUBDIR, kind, `${name}.md`);
}

// =============================================================================
// Filesystem I/O
// =============================================================================

function isNotFound(err: unknown): boolean {
  return (err as NodeJS.ErrnoException | undefined)?.code === 'ENOENT';
}

/** The outer manifest shape, before per-entry validation. */
const ForkManifestEnvelopeSchema = z.object({
  forks: z.array(z.unknown()).default([]),
});

/**
 * Read the fork manifest, returning an empty manifest if none exists.
 *
 * Parsing is tolerant per entry: a malformed or unsafe entry (bad name/kind,
 * path-traversal attempt) is dropped with a warning rather than aborting the
 * whole read. This both fails closed on a crafted entry (it is never returned,
 * so commands never act on it — no out-of-tree deletes) and keeps one corrupt
 * entry from taking down status/update for every other fork.
 */
export async function readForkManifest(tbdRoot: string): Promise<ForkManifest> {
  let content: string;
  try {
    content = await readFile(forksFilePath(tbdRoot), 'utf-8');
  } catch (err) {
    if (isNotFound(err)) {
      return emptyManifest();
    }
    throw err;
  }
  const envelope = ForkManifestEnvelopeSchema.parse(parseYaml(content) ?? { forks: [] });
  const forks: ForkEntry[] = [];
  let dropped = 0;
  for (const raw of envelope.forks) {
    const parsed = ForkEntrySchema.safeParse(raw);
    if (parsed.success) {
      forks.push(parsed.data);
    } else {
      dropped++;
    }
  }
  if (dropped > 0) {
    process.stderr.write(
      `• Ignored ${dropped} invalid fork manifest entr${dropped === 1 ? 'y' : 'ies'} ` +
        `in ${FORKS_FILE} (bad name/kind or unsafe path). Run 'tbd doctor' to review.\n`,
    );
  }
  return { forks };
}

/** Write the fork manifest (creating `.tbd/doc-forks/` as needed). */
export async function writeForkManifest(tbdRoot: string, manifest: ForkManifest): Promise<void> {
  await mkdir(forksDir(tbdRoot), { recursive: true });
  const yaml = stringifyYaml(manifest, { lineWidth: 0, sortMapEntries: false });
  await writeFile(forksFilePath(tbdRoot), yaml);
}

/** Read a base snapshot's content, or null if it is absent. */
export async function readBaseContent(
  tbdRoot: string,
  kind: string,
  name: string,
): Promise<string | null> {
  try {
    return await readFile(baseFilePath(tbdRoot, kind, name), 'utf-8');
  } catch (err) {
    if (isNotFound(err)) {
      return null;
    }
    throw err;
  }
}

/** Write a base snapshot verbatim (creating parent dirs as needed). */
export async function writeBaseContent(
  tbdRoot: string,
  kind: string,
  name: string,
  content: string,
): Promise<void> {
  const path = baseFilePath(tbdRoot, kind, name);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content);
}

/** Remove a base snapshot if present. */
export async function removeBaseContent(
  tbdRoot: string,
  kind: string,
  name: string,
): Promise<void> {
  await rm(baseFilePath(tbdRoot, kind, name), { force: true });
}
