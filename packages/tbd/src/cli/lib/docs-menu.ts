/**
 * Shared docs-posture menu for the zero-forks state.
 *
 * The same "three postures" menu is shown by `tbd setup --auto` (the Docs
 * summary) and by the bare `tbd docs` overview, so the wording lives in one
 * place and the two surfaces cannot drift. Lines are returned unindented and
 * uncolored; callers add their own indentation and formatting.
 *
 * Contract note (forkable-docs spec): the menu must only name selectors that
 * exist; `--category` appears here because the flag ships with it.
 */

import { FORK_DIR } from '../../lib/paths.js';
import { DOC_CATEGORIES } from '../../lib/doc-categories.js';

/**
 * Menu body lines for the zero-forks state: the three serving postures plus
 * the browse/read pointer. Shown under a lead line reporting the count of
 * docs available in the cache.
 */
export function docsPostureMenuLines(): string[] {
  return [
    'Guidelines are active from the cache. Three postures, all serving the same docs:',
    'Hidden (default):  keep the cache as-is; zero repo footprint',
    `Curated:           tbd docs fork <name> [...]  fork chosen docs into ${FORK_DIR}/`,
    `                   tbd docs fork --category=<name>  (${DOC_CATEGORIES.join(', ')})`,
    'Everything:        tbd docs fork --all         all docs, visible and editable',
    'Browse / read: tbd docs list / tbd docs show <name>',
  ];
}
