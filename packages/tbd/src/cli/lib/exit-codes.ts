/**
 * Shared CLI exit codes for the bead change commands.
 *
 * Exit 2 is reserved repo-wide for usage errors (see ValidationError in
 * errors.js), so "nothing happened" outcomes must not reuse it: a recipe
 * that retries on the no-change code would otherwise retry usage errors
 * forever.
 */

/**
 * No matching change: `tbd changes` found no matching deltas, or a
 * `tbd watch --timeout` elapsed before a matching change arrived.
 */
export const EXIT_NO_MATCHING_CHANGE = 3;
