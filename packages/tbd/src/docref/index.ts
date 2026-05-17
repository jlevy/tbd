/**
 * docref/0.1 — reference parser for the docref grammar.
 *
 * Spec: packages/tbd/docs/design-docref-format.md
 *
 * Standalone module: depends only on the language. Could be extracted
 * as its own package or repo without modification.
 */

export type { Docref, GitBody } from './parser.js';
export { parseDocref, parseGitBody } from './parser.js';
