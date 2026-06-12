/**
 * Public API for the standalone docref module.
 *
 * docref is the single address grammar for documents across tbd. It has no
 * tbd-internal dependencies and is structured for extraction into its own package.
 */

export {
  type DocRef,
  type GitHost,
  DocRefError,
  parseDocRef,
  tryParseDocRef,
  formatDocRef,
  normalizeDocRef,
  isDocRef,
  docRefsEqual,
} from './docref.js';
