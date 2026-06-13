/**
 * Shared construction of docmap entries for served docs: the one-model,
 * one-renderer contract (spec Decisions 21/22): `tbd docs list`/`show`, the
 * bare overview, and the per-kind readers all build entries here, so their
 * JSON output cannot drift.
 */

import { readConfig } from '../../file/config.js';
import {
  type ForkKind,
  findFork,
  hashContent,
  readForkManifest,
} from '../../file/fork-manifest.js';
import { KIND_DIR } from '../../file/doc-fork.js';
import {
  CACHE_GUIDELINES_PATHS,
  CACHE_REFERENCE_PATHS,
  CACHE_SHORTCUT_PATHS,
  CACHE_TEMPLATE_PATHS,
  FORK_DIR,
  FORK_GUIDELINES_DIR,
  FORK_REFERENCES_DIR,
  FORK_SHORTCUTS_DIR,
  FORK_TEMPLATES_DIR,
  TBD_DOCS_DIR,
} from '../../lib/paths.js';
import { join, relative, sep } from 'node:path';
import type { DocMapEntry } from '../../docmap/index.js';
import { tryParseDocRef } from '../../docref/index.js';

const KIND_FORK_DIRS: Record<ForkKind, string> = {
  guideline: FORK_GUIDELINES_DIR,
  shortcut: FORK_SHORTCUTS_DIR,
  template: FORK_TEMPLATES_DIR,
  reference: FORK_REFERENCES_DIR,
};

const KIND_CACHE_DIRS: Record<ForkKind, string[]> = {
  guideline: CACHE_GUIDELINES_PATHS,
  shortcut: CACHE_SHORTCUT_PATHS,
  template: CACHE_TEMPLATE_PATHS,
  reference: CACHE_REFERENCE_PATHS,
};

/**
 * Validated repo-relative dirs from docs_cache.local_dirs (./-prefixed local
 * docrefs). Invalid entries are skipped; doctor surfaces them.
 */
export function sanitizeLocalDirs(localDirs: string[] | undefined): string[] {
  const out: string[] = [];
  for (const dir of localDirs ?? []) {
    const parsed = tryParseDocRef(dir);
    if (parsed?.kind === 'local' && dir.startsWith('./')) {
      out.push(parsed.path.replace(/^\.\//, '').replace(/\/+$/, ''));
    }
  }
  return out;
}

/**
 * Effective lookup order for serving one kind: fork dir → local_dirs → cache
 * (the resolution precedence the design fixes). local_dirs entries serve for
 * every kind so reads find them by name; inventory surfaces dedupe so each
 * local doc appears once.
 */
export function effectiveServePaths(kind: ForkKind, localDirs: string[]): string[] {
  // localDirs arrive already sanitized (loadServeContext): repo-relative,
  // not raw docrefs; so they must not pass through sanitizeLocalDirs again.
  return [KIND_FORK_DIRS[kind], ...localDirs, ...KIND_CACHE_DIRS[kind]];
}

/** A served doc's docmap entry plus its derived fork-state presentation. */
export interface ServedEntryInfo {
  entry: DocMapEntry;
  state: string;
  marker: string;
}

/** Minimal doc fields needed to derive a docmap entry. */
export interface ServedDocLike {
  name: string;
  content: string;
  sourceDir: string;
  path: string;
  frontmatter?: { title?: string; description?: string };
}

/**
 * Build the docmap entry (+ state marker) for one served doc. Single point of
 * construction for every docs inventory and read surface (Decision 21/22).
 * Every entry carries a location: forked docs have path+source, local files a
 * path, upstream docs their provenance docref.
 */
export function servedEntryFor(
  tbdRoot: string,
  kind: ForkKind,
  doc: ServedDocLike,
  manifest: Awaited<ReturnType<typeof readForkManifest>>,
  files: Record<string, string> | undefined,
  localDirs: string[] = [],
): ServedEntryInfo {
  const fork = findFork(manifest, doc.name, kind);
  const isLocalDir = !fork && localDirs.some((d) => doc.sourceDir === d);
  const isLocal = !fork && (doc.sourceDir.startsWith(FORK_DIR) || isLocalDir);
  let state = 'upstream';
  let marker = '';
  if (fork) {
    const customized = hashContent(doc.content) !== fork.base_hash;
    state = customized ? 'customized' : 'forked';
    marker = customized ? '[forked, customized]' : '[forked]';
  } else if (isLocal) {
    state = 'local';
    marker = '[local]';
  }
  const localPath = isLocalDir
    ? `${doc.sourceDir}/${doc.name}.md`
    : `${FORK_DIR}/${KIND_DIR[kind]}/${doc.name}.md`;
  const entry: DocMapEntry = {
    name: doc.name,
    type: kind,
    ...(fork
      ? { path: fork.path, source: fork.source }
      : isLocal
        ? { path: localPath }
        : { source: sourceDocRefFor(tbdRoot, files, doc.path) }),
    title: doc.frontmatter?.title,
    description: doc.frontmatter?.description,
    state,
  };
  return { entry, state, marker };
}

/** Load the shared context servedEntryFor needs (manifest + config maps). */
export async function loadServeContext(tbdRoot: string): Promise<{
  manifest: Awaited<ReturnType<typeof readForkManifest>>;
  files: Record<string, string> | undefined;
  localDirs: string[];
}> {
  const manifest = await readForkManifest(tbdRoot);
  const config = await readConfig(tbdRoot);
  return {
    manifest,
    files: config.docs_cache?.files,
    localDirs: sanitizeLocalDirs(config.docs_cache?.local_dirs),
  };
}

/** Derive the provenance docref for a cached doc from config, defaulting to internal:. */
function sourceDocRefFor(
  tbdRoot: string,
  files: Record<string, string> | undefined,
  docPath: string,
): string {
  const cacheRoot = join(tbdRoot, TBD_DOCS_DIR);
  const rel = relative(cacheRoot, docPath).split(sep).join('/');
  return files?.[rel] ?? `internal:${rel}`;
}
