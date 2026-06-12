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

import { readFile, readdir, rm, rmdir, mkdir } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';

import { writeFile } from 'atomically';
import matter from 'gray-matter';

import { DocCache } from './doc-cache.js';
import {
  CACHE_GUIDELINES_PATHS,
  CACHE_SHORTCUT_PATHS,
  CACHE_TEMPLATE_PATHS,
} from '../lib/paths.js';

import {
  type ForkEntry,
  type ForkKind,
  type ForkManifest,
  type ForkStatus,
  compareVersionsLoose,
  computeForkStatus,
  findFork,
  hashContent,
  hasUnresolvedConflict,
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
    public readonly code: 'overwrite' | 'customized' | 'not-forked' | 'version-skew',
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
      // Refreshing an unmodified fork advances its base to this client's cache.
      // Refuse if the fork point was set by a NEWER tbd: refreshing would
      // downgrade the doc to our older bundled content (the same hazard the
      // update guard prevents). --force overrides.
      if (
        !force &&
        existingEntry?.tbd_version !== undefined &&
        params.tbdVersion !== undefined &&
        compareVersionsLoose(params.tbdVersion, existingEntry.tbd_version) === -1
      ) {
        throw new ForkConflictError(
          'version-skew',
          `${name}: fork point was set by tbd ${existingEntry.tbd_version} (you have ` +
            `${params.tbdVersion}) — upgrade tbd before re-forking, or use --force to downgrade`,
        );
      }
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
  const entryKind = entry.kind;
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
  const kind = entry.kind;
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
    markersPresent: forkContent !== null ? hasUnresolvedConflict(forkContent) : false,
  });
}

/** Read the forked file content for an entry, or null if it is missing. */
export async function readForkFile(
  tbdRoot: string,
  forkDir: string,
  entry: ForkEntry,
): Promise<string | null> {
  try {
    return await readFile(forkFilePath(tbdRoot, forkDir, entry.kind, entry.name), 'utf-8');
  } catch {
    return null;
  }
}

/** Read the stored base snapshot for an entry, or null if it is missing. */
export async function readForkBase(tbdRoot: string, entry: ForkEntry): Promise<string | null> {
  return readBaseContent(tbdRoot, entry.kind, entry.name);
}

/** A hand-authored file in the fork dir with no manifest entry (state `local`). */
export interface LocalForkFile {
  kind: ForkKind;
  name: string;
  /** Repo-relative path (POSIX separators). */
  relPath: string;
}

/**
 * List fork-dir files that have no manifest entry. These are served (the fork dir
 * has top lookup precedence) but have no upstream: nothing to update or unfork.
 * Only the flat `<fork_dir>/<kind-dir>/*.md` layout is scanned — names are
 * identity, so nested folders are deliberately not searched (documented).
 */
export async function listLocalForkFiles(
  tbdRoot: string,
  forkDir: string,
  manifest: ForkManifest,
): Promise<LocalForkFile[]> {
  const locals: LocalForkFile[] = [];
  for (const kind of Object.keys(KIND_DIR) as ForkKind[]) {
    let entries: string[];
    try {
      entries = await readdir(join(tbdRoot, forkDir, KIND_DIR[kind]));
    } catch {
      continue; // Kind dir absent — nothing forked or added there.
    }
    for (const entry of entries) {
      if (!entry.endsWith('.md')) continue;
      const name = entry.slice(0, -3);
      if (!findFork(manifest, name, kind)) {
        locals.push({ kind, name, relPath: forkRelPath(forkDir, kind, name) });
      }
    }
  }
  locals.sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name));
  return locals;
}

/** Cache-only lookup paths per kind (the pristine upstream copies). */
const KIND_CACHE_PATHS: Record<string, string[]> = {
  guideline: CACHE_GUIDELINES_PATHS,
  shortcut: CACHE_SHORTCUT_PATHS,
  template: CACHE_TEMPLATE_PATHS,
};

/** Aggregate drift counts across all forked docs, plus local files. */
export interface ForkDriftSummary {
  forks: number;
  customized: number;
  /** Upstream moved since the fork point (run `tbd docs update`). */
  stale: number;
  conflicted: number;
  /** Manifest entries whose forked file was deleted out-of-band. */
  missing: number;
  /** Fork-dir files with no manifest entry. */
  local: number;
}

/**
 * Compute the drift summary for awareness surfaces (`tbd sync` notice, status).
 * Reads the manifest, the fork dir, and the doc cache; safe to call when nothing
 * is forked (all zeros, no cache loads).
 */
export async function computeForkDriftSummary(
  tbdRoot: string,
  forkDir: string,
  manifest: ForkManifest,
): Promise<ForkDriftSummary> {
  const summary: ForkDriftSummary = {
    forks: manifest.forks.length,
    customized: 0,
    stale: 0,
    conflicted: 0,
    missing: 0,
    local: 0,
  };
  summary.local = (await listLocalForkFiles(tbdRoot, forkDir, manifest)).length;
  if (manifest.forks.length === 0) {
    return summary;
  }

  const caches = new Map<string, DocCache>();
  for (const entry of manifest.forks) {
    let cache = caches.get(entry.kind);
    if (!cache) {
      cache = new DocCache(KIND_CACHE_PATHS[entry.kind] ?? [], tbdRoot);
      await cache.load({ quiet: true });
      caches.set(entry.kind, cache);
    }
    const status = await forkStatusFor(
      tbdRoot,
      forkDir,
      entry,
      cache.get(entry.name)?.doc.content ?? null,
    );
    if (status.customized) summary.customized++;
    if (status.stale) summary.stale++;
    if (status.conflicted) summary.conflicted++;
    if (status.state === 'missing') summary.missing++;
  }
  return summary;
}

/**
 * Sanitize untrusted text (a frontmatter blurb or doc name) for safe inclusion
 * in the generated README list. The blurb comes from forked/local file content,
 * so it must not be able to inject markdown structure, links, or raw HTML into a
 * committed file rendered on GitHub: take the first line and strip the
 * characters that break a single list-item context.
 */
function sanitizeForReadme(text: string): string {
  const firstLine = text.split(/\r?\n/)[0] ?? '';
  return firstLine
    .replace(/[<>[\]`|]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200);
}

/** Percent-encode each path segment so odd local filenames make valid links. */
function readmeLinkPath(relPath: string): string {
  return relPath
    .split('/')
    .map((seg) => encodeURIComponent(seg))
    .join('/');
}

/** First frontmatter description (or title) of a doc file, for the README index. */
async function docBlurb(absPath: string): Promise<string | undefined> {
  try {
    const data = matter(await readFile(absPath, 'utf-8')).data as Record<string, unknown>;
    const description = typeof data.description === 'string' ? data.description : undefined;
    const title = typeof data.title === 'string' ? data.title : undefined;
    const blurb = description ?? title;
    return blurb ? sanitizeForReadme(blurb) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Regenerate the fork dir's `README.md` index (what this folder is, who manages
 * it, and one line per doc). Called after every fork/unfork/update. When nothing
 * is forked and no local files remain, the README is removed and empty kind dirs
 * are pruned so `unfork --all` leaves the repo pristine.
 */
export async function regenerateForkDirReadme(
  tbdRoot: string,
  forkDir: string,
  manifest: ForkManifest,
): Promise<void> {
  const readmePath = join(tbdRoot, forkDir, 'README.md');
  const locals = await listLocalForkFiles(tbdRoot, forkDir, manifest);

  if (manifest.forks.length === 0 && locals.length === 0) {
    await rm(readmePath, { force: true });
    for (const kindDir of Object.values(KIND_DIR)) {
      await rmdir(join(tbdRoot, forkDir, kindDir)).catch(() => undefined);
    }
    await rmdir(join(tbdRoot, forkDir)).catch(() => undefined);
    return;
  }

  interface IndexRow {
    kind: string;
    name: string;
    relPath: string;
    suffix: string;
  }
  const rows: IndexRow[] = [
    ...manifest.forks.map((f) => ({
      kind: f.kind,
      name: f.name,
      relPath: forkRelPath(forkDir, f.kind, f.name),
      suffix: '',
    })),
    ...locals.map((l) => ({ ...l, suffix: ' *(local — not from an upstream)*' })),
  ].sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name));

  const lines: string[] = [
    '<!-- DO NOT EDIT: Generated by `tbd docs fork` (regenerated on fork/unfork/update). -->',
    '',
    '# tbd Docs (forked into this repo)',
    '',
    'Engineering guidelines, shortcuts, and templates managed by',
    '[tbd](https://github.com/jlevy/tbd), forked here so they are visible, reviewable,',
    'and editable. tbd serves these copies instead of its built-in versions.',
    '',
    '- Edit any doc in place — your copy is what tbd serves.',
    '- `tbd docs status` shows each doc’s state; `tbd docs update` pulls in upstream',
    '  changes (three-way merge); `tbd docs unfork <name>` returns a doc to the',
    '  built-in version.',
    '- Keep files at `<kind>/<name>.md`: names are how tbd identifies docs, nested',
    '  folders are not scanned, and renaming a file counts as delete + add.',
    '',
  ];
  let currentKind = '';
  for (const row of rows) {
    if (row.kind !== currentKind) {
      currentKind = row.kind;
      lines.push(`## ${KIND_DIR[row.kind as ForkKind] ?? row.kind}`, '');
    }
    const blurb = await docBlurb(join(tbdRoot, row.relPath));
    const fileName = row.relPath.split('/').slice(-2).join('/');
    // Local filenames are arbitrary on disk; escape the link text and encode the
    // link target so a name like `x<b>y.md` or `a b.md` can't break the README.
    const label = sanitizeForReadme(row.name) || row.name.replace(/[<>[\]`|]/g, '');
    lines.push(
      `- [**${label}**](./${readmeLinkPath(fileName)})${blurb ? ` — ${blurb}` : ''}${row.suffix}`,
    );
  }
  lines.push('');
  await mkdir(join(tbdRoot, forkDir), { recursive: true });
  await writeFile(readmePath, lines.join('\n'));
}

/** Compute the repo-relative path for a fork dir given an absolute tbd root. */
export function relativeForkDir(tbdRoot: string, absForkDir: string): string {
  return relative(tbdRoot, absForkDir);
}
