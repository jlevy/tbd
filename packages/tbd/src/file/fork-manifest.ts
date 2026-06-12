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

export const ForkEntrySchema = z.object({
  /** Doc name (e.g. "python-rules"). */
  name: z.string().min(1),
  /** Doc kind (guideline/shortcut/template/reference). */
  kind: z.string().min(1),
  /** Repo-relative path of the forked file (e.g. "docs/tbd/guidelines/python-rules.md"). */
  path: z.string().min(1),
  /** Provenance docref the fork was created from. */
  source: z.string().min(1),
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

/** Read the fork manifest, returning an empty manifest if none exists. */
export async function readForkManifest(tbdRoot: string): Promise<ForkManifest> {
  try {
    const content = await readFile(forksFilePath(tbdRoot), 'utf-8');
    const data = parseYaml(content) as unknown;
    return ForkManifestSchema.parse(data ?? { forks: [] });
  } catch (err) {
    if (isNotFound(err)) {
      return emptyManifest();
    }
    throw err;
  }
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
