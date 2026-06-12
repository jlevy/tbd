/**
 * Fork operations: copy a managed doc into a visible, git-tracked folder, return
 * it to upstream, and report fork state.
 *
 * Forked files live outside `.tbd/` in the fork dir (default `docs/tbd/`), laid out
 * as `<fork_dir>/<kind-dir>/<name>.md`. Provenance and the merge base live in the
 * committed manifest under `.tbd/doc-forks/` (see fork-manifest.ts) so the forked
 * files themselves stay clean, diffable, and forkable.
 *
 * These operations take the upstream content and current manifest as inputs and do
 * the filesystem writes; resolving which doc/source to fork is the caller's job.
 */

import { readFile, rm, mkdir } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';

import { writeFile } from 'atomically';

import {
  type ForkEntry,
  type ForkKind,
  type ForkManifest,
  type ForkStatus,
  computeForkStatus,
  findFork,
  hashContent,
  hasConflictMarkers,
  readBaseContent,
  removeBaseContent,
  upsertFork,
  removeFork,
  writeBaseContent,
} from './fork-manifest.js';

/** Default fork directory, relative to the repo/tbd root. */
export const DEFAULT_FORK_DIR = 'docs/tbd';

/** Map a doc kind to its plural directory name within the fork dir. */
export const KIND_DIR: Record<ForkKind, string> = {
  guideline: 'guidelines',
  shortcut: 'shortcuts',
  template: 'templates',
  reference: 'references',
};

/** Absolute path of a forked file. */
export function forkFilePath(
  tbdRoot: string,
  forkDir: string,
  kind: ForkKind,
  name: string,
): string {
  return join(tbdRoot, forkDir, KIND_DIR[kind], `${name}.md`);
}

/** Repo-relative path recorded in the manifest (always POSIX-style forward slashes). */
export function forkRelPath(forkDir: string, kind: ForkKind, name: string): string {
  return `${forkDir}/${KIND_DIR[kind]}/${name}.md`;
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await readFile(path);
    return true;
  } catch {
    return false;
  }
}

/** Error raised when a fork/unfork would lose user content; carries a reason code. */
export class ForkConflictError extends Error {
  constructor(
    public readonly code: 'overwrite' | 'customized' | 'not-forked',
    message: string,
  ) {
    super(message);
    this.name = 'ForkConflictError';
  }
}

export interface ForkDocParams {
  tbdRoot: string;
  forkDir: string;
  manifest: ForkManifest;
  kind: ForkKind;
  name: string;
  /** Provenance docref (e.g. "internal:guidelines/python-rules.md"). */
  source: string;
  /** Upstream content to fork (becomes both the file and the base snapshot). */
  content: string;
  tbdVersion?: string;
  force?: boolean;
}

export interface ForkDocResult {
  manifest: ForkManifest;
  relPath: string;
  action: 'created' | 'refreshed';
}

/**
 * Fork a doc into the fork dir, recording its base snapshot and manifest entry.
 *
 * Refuses to overwrite a target that exists and is not an unmodified fork (e.g. a
 * pre-existing user file or a customized fork), unless `force` is set. Re-forking an
 * unmodified fork refreshes it to the supplied upstream content and advances the base.
 */
export async function forkDoc(params: ForkDocParams): Promise<ForkDocResult> {
  const { tbdRoot, forkDir, kind, name, source, content, force } = params;
  const absPath = forkFilePath(tbdRoot, forkDir, kind, name);
  const relPath = forkRelPath(forkDir, kind, name);
  const existingEntry = findFork(params.manifest, name, kind);

  let action: ForkDocResult['action'] = 'created';

  if (await pathExists(absPath)) {
    const current = await readFile(absPath, 'utf-8');
    const isUnmodifiedFork = hashContent(current) === existingEntry?.base_hash;
    if (isUnmodifiedFork) {
      action = 'refreshed';
    } else if (!force) {
      throw new ForkConflictError(
        'overwrite',
        `${relPath} already exists and is not an unmodified fork`,
      );
    }
  }

  await mkdir(dirname(absPath), { recursive: true });
  await writeFile(absPath, content);
  await writeBaseContent(tbdRoot, kind, name, content);

  const entry: ForkEntry = {
    name,
    kind,
    path: relPath,
    source,
    base_hash: hashContent(content),
    ...(params.tbdVersion ? { tbd_version: params.tbdVersion } : {}),
  };

  return { manifest: upsertFork(params.manifest, entry), relPath, action };
}

export interface UnforkDocParams {
  tbdRoot: string;
  forkDir: string;
  manifest: ForkManifest;
  name: string;
  kind?: ForkKind;
  force?: boolean;
}

export interface UnforkDocResult {
  manifest: ForkManifest;
  relPath: string;
  /** True when the forked file was deleted (false when it was already missing). */
  fileRemoved: boolean;
}

/**
 * Remove a fork and fall back to upstream. Refuses to discard local customizations
 * (file differs from its base) unless `force` is set. Cleans up a `missing` entry
 * (file already deleted) without complaint.
 */
export async function unforkDoc(params: UnforkDocParams): Promise<UnforkDocResult> {
  const { tbdRoot, forkDir, manifest, name, kind, force } = params;
  const entry = findFork(manifest, name, kind);
  if (!entry) {
    throw new ForkConflictError('not-forked', `${name} is not a forked doc`);
  }
  const entryKind = entry.kind as ForkKind;
  const absPath = forkFilePath(tbdRoot, forkDir, entryKind, name);
  const relPath = entry.path;

  let fileRemoved = false;
  if (await pathExists(absPath)) {
    const current = await readFile(absPath, 'utf-8');
    if (hashContent(current) !== entry.base_hash && !force) {
      throw new ForkConflictError(
        'customized',
        `${name} has local customizations (differs from its base)`,
      );
    }
    await rm(absPath, { force: true });
    fileRemoved = true;
  }

  await removeBaseContent(tbdRoot, entryKind, name);
  return { manifest: removeFork(manifest, name, entryKind), relPath, fileRemoved };
}

/**
 * Compute the live {@link ForkStatus} of a manifest entry by reading its forked
 * file and base, and comparing against the current upstream/cache content.
 *
 * @param cacheContent current upstream content, or null/undefined if the source is
 *   gone from the cache (orphaned).
 */
export async function forkStatusFor(
  tbdRoot: string,
  forkDir: string,
  entry: ForkEntry,
  cacheContent: string | null | undefined,
): Promise<ForkStatus> {
  const kind = entry.kind as ForkKind;
  const absPath = forkFilePath(tbdRoot, forkDir, kind, entry.name);
  let forkContent: string | null = null;
  try {
    forkContent = await readFile(absPath, 'utf-8');
  } catch {
    forkContent = null;
  }

  return computeForkStatus({
    inManifest: true,
    forkFileExists: forkContent !== null,
    forkHash: forkContent !== null ? hashContent(forkContent) : undefined,
    baseHash: entry.base_hash,
    cacheHash: cacheContent == null ? undefined : hashContent(cacheContent),
    conflictedFlag: entry.conflicted,
    markersPresent: forkContent !== null ? hasConflictMarkers(forkContent) : false,
  });
}

/** Read the forked file content for an entry, or null if it is missing. */
export async function readForkFile(
  tbdRoot: string,
  forkDir: string,
  entry: ForkEntry,
): Promise<string | null> {
  try {
    return await readFile(
      forkFilePath(tbdRoot, forkDir, entry.kind as ForkKind, entry.name),
      'utf-8',
    );
  } catch {
    return null;
  }
}

/** Read the stored base snapshot for an entry, or null if it is missing. */
export async function readForkBase(tbdRoot: string, entry: ForkEntry): Promise<string | null> {
  return readBaseContent(tbdRoot, entry.kind, entry.name);
}

/** Compute the repo-relative path for a fork dir given an absolute tbd root. */
export function relativeForkDir(tbdRoot: string, absForkDir: string): string {
  return relative(tbdRoot, absForkDir);
}
