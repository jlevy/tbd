/**
 * docmap — a minimal, machine-readable inventory of a collection of documents.
 *
 * A docmap is a "sitemap for docs": one entry per document, each with an identity
 * (`type` + `name`, unique within the map), a location (`path` and/or a provenance
 * `source` docref), and presentation metadata (`title`, `description`, `word_count`).
 * It describes a collection; it says nothing about how the collection is assembled,
 * fetched, or kept fresh.
 *
 * This is the docmap/0.1 format. The module is standalone and dependency-free (no
 * tbd-internal imports) so it can move to its own package later. Consumers MUST
 * ignore unknown fields, so producers (such as tbd) may attach extension fields —
 * for example tbd's `state`/`stale` — without breaking other readers.
 */

import { z } from 'zod';

/** Current docmap format version tag. */
export const DOCMAP_VERSION = 'docmap/0.1' as const;

/**
 * One document in a docmap. Unknown fields are preserved (extension fields).
 */
export const DocMapEntrySchema = z
  .object({
    /** Identity, unique within the map together with `type`. */
    name: z.string().min(1),
    /** Identity, e.g. "guideline" | "shortcut" | "template" | "reference". */
    type: z.string().min(1),
    /** Location within the collection (repo-relative or collection-relative). */
    path: z.string().optional(),
    /** Provenance: a docref string for where the doc came from. */
    source: z.string().optional(),
    title: z.string().optional(),
    description: z.string().optional(),
    word_count: z.number().int().nonnegative().optional(),
  })
  .passthrough();

export type DocMapEntry = z.infer<typeof DocMapEntrySchema>;

/**
 * A document inventory. `documents` entries are unique by (`type`, `name`).
 */
export const DocMapSchema = z
  .object({
    docmap: z.string(),
    name: z.string().optional(),
    documents: z.array(DocMapEntrySchema),
  })
  .passthrough();

export type DocMap = z.infer<typeof DocMapSchema>;

/** Error thrown when an object is not a valid docmap. */
export class DocMapError extends Error {
  constructor(detail: string) {
    super(`Invalid docmap: ${detail}`);
    this.name = 'DocMapError';
  }
}

/** Stable key for an entry's identity. */
export function entryKey(entry: Pick<DocMapEntry, 'type' | 'name'>): string {
  return `${entry.type}:${entry.name}`;
}

/** Assert that entries are unique by (type, name); throws {@link DocMapError}. */
function assertUniqueIdentities(documents: DocMapEntry[]): void {
  const seen = new Set<string>();
  for (const entry of documents) {
    const key = entryKey(entry);
    if (seen.has(key)) {
      throw new DocMapError(`duplicate entry identity ${JSON.stringify(key)}`);
    }
    seen.add(key);
  }
}

/**
 * Build a docmap from entries. Validates each entry and identity uniqueness.
 */
export function createDocMap(documents: DocMapEntry[], options: { name?: string } = {}): DocMap {
  const parsed = documents.map((d) => DocMapEntrySchema.parse(d));
  assertUniqueIdentities(parsed);
  const map: DocMap = { docmap: DOCMAP_VERSION, documents: parsed };
  if (options.name !== undefined) {
    map.name = options.name;
  }
  return map;
}

/**
 * Parse and validate an unknown value as a docmap (e.g. from YAML/JSON).
 * Verifies the version tag and identity uniqueness.
 */
export function parseDocMap(value: unknown): DocMap {
  const result = DocMapSchema.safeParse(value);
  if (!result.success) {
    throw new DocMapError(result.error.issues.map((i) => i.message).join('; '));
  }
  const map = result.data;
  if (!map.docmap.startsWith('docmap/')) {
    throw new DocMapError(`unrecognized version tag ${JSON.stringify(map.docmap)}`);
  }
  assertUniqueIdentities(map.documents);
  return map;
}

/** Find an entry by name, optionally constrained to a type. */
export function findEntry(map: DocMap, name: string, type?: string): DocMapEntry | undefined {
  return map.documents.find((d) => d.name === name && (type === undefined || d.type === type));
}

/** Group entries by their `type`, preserving order within each group. */
export function groupByType(map: DocMap): Map<string, DocMapEntry[]> {
  const groups = new Map<string, DocMapEntry[]>();
  for (const entry of map.documents) {
    const list = groups.get(entry.type);
    if (list) {
      list.push(entry);
    } else {
      groups.set(entry.type, [entry]);
    }
  }
  return groups;
}

/** Return a new docmap containing only entries of the given type. */
export function filterByType(map: DocMap, type: string): DocMap {
  const documents = map.documents.filter((d) => d.type === type);
  return map.name !== undefined
    ? { docmap: map.docmap, name: map.name, documents }
    : { docmap: map.docmap, documents };
}
