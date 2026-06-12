/**
 * Public API for the standalone docmap module (docmap/0.1).
 *
 * A minimal document-inventory format with no tbd-internal dependencies, structured
 * for extraction into its own package. tbd's list/inventory commands build a docmap
 * and render it to text or `--json`.
 */

export {
  type DocMap,
  type DocMapEntry,
  DOCMAP_VERSION,
  DocMapSchema,
  DocMapEntrySchema,
  DocMapError,
  entryKey,
  createDocMap,
  parseDocMap,
  findEntry,
  groupByType,
  filterByType,
} from './docmap.js';
