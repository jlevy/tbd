/**
 * Shared construction of docmap entries for served docs — the one-model,
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
import { FORK_DIR, TBD_DOCS_DIR } from '../../lib/paths.js';
import { join, relative, sep } from 'node:path';
import type { DocMapEntry } from '../../docmap/index.js';

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
): ServedEntryInfo {
  const fork = findFork(manifest, doc.name, kind);
  const isLocal = !fork && doc.sourceDir.startsWith(FORK_DIR);
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
  const localPath = `${FORK_DIR}/${KIND_DIR[kind]}/${doc.name}.md`;
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

/** Load the shared context servedEntryFor needs (manifest + config file map). */
export async function loadServeContext(tbdRoot: string): Promise<{
  manifest: Awaited<ReturnType<typeof readForkManifest>>;
  files: Record<string, string> | undefined;
}> {
  const manifest = await readForkManifest(tbdRoot);
  const config = await readConfig(tbdRoot);
  return { manifest, files: config.docs_cache?.files };
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
