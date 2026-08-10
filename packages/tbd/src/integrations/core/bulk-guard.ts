/**
 * Guard against an unintended bulk write to an external tracker.
 *
 * A mirror run creates and updates real issues in someone's workspace, and a
 * mis-set selector can turn "a couple of epics" into "every bead in the repo".
 * Unlike a local mistake, that one is tedious to undo by hand, so a large run
 * has to be affirmed rather than assumed.
 */

/** Creates above this need affirmation. Creating is the harder one to undo. */
export const CREATE_CONFIRM_THRESHOLD = 20;

/** Updates above this need affirmation. Updates are less destructive, so higher. */
export const UPDATE_CONFIRM_THRESHOLD = 40;

export interface BulkCounts {
  creates: number;
  updates: number;
}

export type BulkDecision =
  | { kind: 'proceed' }
  | { kind: 'needs-confirmation'; reasons: string[] }
  | { kind: 'refused'; message: string };

/**
 * Decide whether a run of this size may proceed.
 *
 * `assumeYes` is the explicit affirmation. `interactive` says whether there is a
 * human who could be asked. The non-interactive case refuses rather than
 * prompting: an agent or CI job must neither hang on a prompt nor silently make
 * a large change nobody approved.
 */
export function checkBulkThreshold(
  counts: BulkCounts,
  options: { assumeYes: boolean; interactive: boolean },
): BulkDecision {
  const reasons: string[] = [];
  if (counts.creates > CREATE_CONFIRM_THRESHOLD) {
    reasons.push(`${counts.creates} creates (threshold ${CREATE_CONFIRM_THRESHOLD})`);
  }
  if (counts.updates > UPDATE_CONFIRM_THRESHOLD) {
    reasons.push(`${counts.updates} updates (threshold ${UPDATE_CONFIRM_THRESHOLD})`);
  }

  if (reasons.length === 0 || options.assumeYes) {
    return { kind: 'proceed' };
  }

  if (!options.interactive) {
    return {
      kind: 'refused',
      message: [
        `This run would make a large change: ${reasons.join(' and ')}.`,
        'Re-run with --yes to confirm, narrow the set with --bead or --limit,',
        'or preview it first with --dry-run.',
      ].join('\n'),
    };
  }

  return { kind: 'needs-confirmation', reasons };
}
