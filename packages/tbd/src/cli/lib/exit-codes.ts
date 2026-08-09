/**
 * Stable, repo-wide CLI exit codes. Runtime code imports these constants instead of
 * scattering numeric literals, keeping shell and agent contracts reviewable in one
 * place.
 */

/** Successful completion. */
export const EXIT_SUCCESS = 0;

/** Operational failure, including unexpected errors and failed health checks. */
export const EXIT_OPERATIONAL_ERROR = 1;

/** Invalid CLI usage or argument validation failure. */
export const EXIT_USAGE_ERROR = 2;

/**
 * No matching change: `tbd changes` found no matching deltas, or a
 * `tbd watch --timeout` elapsed before a matching change arrived.
 */
export const EXIT_NO_MATCHING_CHANGE = 3;

/** Process interrupted by SIGINT: 128 + signal number 2. */
export const EXIT_INTERRUPTED = 130;
