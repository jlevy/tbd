/**
 * Shared docs-posture menu for the zero-forks state.
 *
 * The same "three postures" menu is shown by `tbd setup --auto` (the Docs
 * summary) and by the bare `tbd docs` overview, so the wording lives in one
 * place and the two surfaces cannot drift. Lines are returned unindented and
 * uncolored; callers add their own indentation and formatting.
 *
 * Contract note (forkable-docs spec): the menu must only name selectors that
 * exist — when `tbd docs fork --category` ships, the Curated line gains the
 * category form here, in one place.
 */

import { FORK_DIR } from '../../lib/paths.js';

/**
 * Menu body lines for the zero-forks state: the three serving postures plus
 * the browse/read pointer. Shown under a lead line reporting the count of
 * docs available in the cache.
 */
export function docsPostureMenuLines(): string[] {
  return [
    'Guidelines are active from the cache. Three postures, all serving the same docs:',
    'Hidden (default):  keep the cache as-is — zero repo footprint',
    `Curated:           tbd docs fork <name> [...]  fork chosen docs into ${FORK_DIR}/`,
    'Everything:        tbd docs fork --all         all docs, visible and editable',
    'Browse / read: tbd docs list / tbd docs show <name>',
  ];
}
