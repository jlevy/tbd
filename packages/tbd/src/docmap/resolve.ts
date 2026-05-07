/**
 * docmap/0.1 — lookup-key resolution algorithm.
 *
 * Implements the six-step resolution chain in spec §4.3:
 *   1. Repo-subpath form (query contains `//`)
 *   2. Bundle scope (query contains `:`)
 *   3. Exact canonical-key match
 *   4. Basename match (priority-wins within same type; ambiguous across types)
 *   5. Alias match (same priority semantics as basename)
 *   6. Failure (NotFound)
 *
 * The `documents` argument is expected to be in **source priority order**:
 * earlier entries beat later entries when both match the same `(type, name)`.
 * This is how local overrides shadow upstream content (spec §4.4).
 *
 * The spec and this implementation MUST stay in exact sync.
 */

import type { DocMapEntry } from './schemas.js';

export interface ParsedLookupKey {
  /** When set, the lookup is restricted to this bundle. */
  bundleScope: string | null;
  /** The portion after any bundle scope (or the whole query if none). */
  name: string;
  /**
   * Set only for repo-subpath form: the path within the aggregate
   * source's cache (e.g. `src/foo.py` for `flask//src/foo.py`).
   */
  repoSubpath: string | null;
}

export class LookupNotFound extends Error {
  readonly query: string;
  readonly availableKeys: string[];
  constructor(query: string, availableKeys: string[]) {
    super(`Lookup not found: ${JSON.stringify(query)}`);
    this.name = 'LookupNotFound';
    this.query = query;
    this.availableKeys = availableKeys;
  }
}

export class LookupAmbiguous extends Error {
  readonly query: string;
  readonly matches: string[];
  constructor(query: string, matches: string[]) {
    super(`Lookup is ambiguous: ${JSON.stringify(query)} matches ${matches.length} items`);
    this.name = 'LookupAmbiguous';
    this.query = query;
    this.matches = matches;
  }
}

/**
 * Parse a lookup-key query into `{ bundleScope, name, repoSubpath }`.
 *
 * Repo-subpath has the highest priority; if the query contains `//`,
 * the left side is the bundle name and the right side is the subpath
 * within an aggregate source. Otherwise, an optional `bundle:` prefix
 * scopes the lookup; everything else is a name.
 */
export function parseLookupKey(query: string): ParsedLookupKey {
  const slashSlashIdx = query.indexOf('//');
  if (slashSlashIdx >= 0) {
    return {
      bundleScope: query.slice(0, slashSlashIdx),
      name: '',
      repoSubpath: query.slice(slashSlashIdx + 2),
    };
  }
  const colonIdx = query.indexOf(':');
  if (colonIdx >= 0) {
    return {
      bundleScope: query.slice(0, colonIdx),
      name: query.slice(colonIdx + 1),
      repoSubpath: null,
    };
  }
  return { bundleScope: null, name: query, repoSubpath: null };
}

/**
 * Return the basename portion of an entry's canonical key — the
 * `<name>` segment in `<bundle>:<type>/<name>` (or the bundle itself
 * if the entry is an aggregate). Used by the basename-match step.
 */
export function entryBasename(entry: DocMapEntry): string {
  return entry.key.includes('/') ? entry.key.slice(entry.key.lastIndexOf('/') + 1) : entry.key;
}

/**
 * Resolve matches against `(type, name)` priority semantics.
 *
 * If all candidates share the same `type`, the first one wins (the
 * documents array is in source priority order, so the highest-priority
 * bundle's entry is first). If candidates span multiple types, the
 * query is genuinely ambiguous because typed semantics can't be
 * resolved by priority alone.
 */
function resolveByPriorityOrAmbiguous(
  query: string,
  candidates: readonly DocMapEntry[],
): DocMapEntry | null {
  if (candidates.length === 0) return null;
  const types = new Set(candidates.map((c) => c.type));
  if (types.size === 1) return candidates[0]!;
  throw new LookupAmbiguous(
    query,
    candidates.map((e) => e.key),
  );
}

/**
 * Resolve a lookup-key query against an in-memory list of doc-map
 * entries. Returns the matched entry or throws LookupNotFound /
 * LookupAmbiguous per the spec algorithm.
 *
 * `documents` must be in source priority order. Aggregate (`as:`-style)
 * sources are detected by canonical keys lacking a `:` (i.e. `<bundle>`
 * only). Aliases on entries are matched in the alias step if present.
 */
export function resolveLookupKey(
  documents: readonly DocMapEntry[],
  query: string,
  options: { aliases?: ReadonlyMap<string, string[]> } = {},
): DocMapEntry {
  const parsed = parseLookupKey(query);

  // Step 1: Repo-subpath form.
  if (parsed.repoSubpath !== null) {
    const aggregate = documents.find(
      (e) => e.bundle === parsed.bundleScope && !e.key.includes(':'),
    );
    if (!aggregate) {
      throw new LookupNotFound(
        query,
        documents.filter((e) => !e.key.includes(':')).map((e) => e.key),
      );
    }
    // For repo-subpath we return the aggregate entry; consumers read
    // the file at <aggregate.path>/<repoSubpath>.
    return aggregate;
  }

  // Step 2: bundle scope.
  const inScope =
    parsed.bundleScope === null
      ? documents
      : documents.filter((e) => e.bundle === parsed.bundleScope);

  // Step 3: exact canonical-key match.
  const exactKey =
    parsed.bundleScope === null ? parsed.name : `${parsed.bundleScope}:${parsed.name}`;
  const exact = inScope.find((e) => e.key === exactKey);
  if (exact) return exact;

  // Step 4: basename match.
  const basenameMatches = inScope.filter((e) => entryBasename(e) === parsed.name);
  const basenameWinner = resolveByPriorityOrAmbiguous(query, basenameMatches);
  if (basenameWinner) return basenameWinner;

  // Step 5: alias match.
  if (options.aliases) {
    const aliasHits: DocMapEntry[] = [];
    for (const entry of inScope) {
      const aliases = options.aliases.get(entry.key);
      if (aliases?.includes(parsed.name)) aliasHits.push(entry);
    }
    const aliasWinner = resolveByPriorityOrAmbiguous(query, aliasHits);
    if (aliasWinner) return aliasWinner;
  }

  // Step 6: failure.
  throw new LookupNotFound(
    query,
    inScope.map((e) => e.key),
  );
}
