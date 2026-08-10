/**
 * Pure mapping between tbd canonical values and Linear's model.
 *
 * These are the only place Linear's vocabulary appears, so a second provider
 * writes its own table and changes nothing else.
 */

import type { IssueStatusType, PriorityType } from '../../lib/types.js';

/** Labels tbd owns are prefixed so they cannot collide with a team's own. */
export const TBD_LABEL_PREFIX = 'tbd:';
export const BLOCKED_LABEL = `${TBD_LABEL_PREFIX}blocked`;
export const DEFERRED_LABEL = `${TBD_LABEL_PREFIX}deferred`;

/**
 * Linear's `WorkflowState.type` values seen in practice.
 *
 * This is NOT an exhaustive enum: the field is a `String!` in Linear's schema,
 * and a default team already exposes `duplicate` beyond the commonly documented
 * six. Treat the set as open and fail soft on anything unrecognized.
 */
export const KNOWN_STATE_TYPES = [
  'triage',
  'backlog',
  'unstarted',
  'started',
  'completed',
  'canceled',
  'duplicate',
] as const;

export interface LinearStatusTarget {
  stateType: string;
  /** tbd-owned labels that carry status detail Linear has no state for. */
  labels: string[];
}

/**
 * Map a tbd status to a Linear state type plus any carrier labels.
 *
 * `blocked` and `deferred` have no Linear equivalent, so they ride on a tbd-owned
 * label alongside the nearest state type. Round-tripping is lossy only if someone
 * strips the label in Linear.
 */
export function statusToLinear(status: IssueStatusType): LinearStatusTarget {
  switch (status) {
    case 'open':
      return { stateType: 'unstarted', labels: [] };
    case 'in_progress':
      return { stateType: 'started', labels: [] };
    case 'blocked':
      return { stateType: 'started', labels: [BLOCKED_LABEL] };
    case 'deferred':
      return { stateType: 'backlog', labels: [DEFERRED_LABEL] };
    case 'closed':
      return { stateType: 'completed', labels: [] };
    default:
      return { stateType: 'unstarted', labels: [] };
  }
}

/**
 * Map a Linear state type plus labels back to a tbd status.
 *
 * Unknown state types map to `open`: an unrecognized state should not abort a
 * sync, and `open` is the least destructive assumption.
 */
export function statusFromLinear(stateType: string, labels: readonly string[]): IssueStatusType {
  const has = (label: string): boolean => labels.includes(label);

  switch (stateType) {
    case 'started':
      return has(BLOCKED_LABEL) ? 'blocked' : 'in_progress';
    case 'backlog':
      return has(DEFERRED_LABEL) ? 'deferred' : 'open';
    case 'completed':
    case 'canceled':
    case 'duplicate':
      return 'closed';
    case 'triage':
    case 'unstarted':
      return 'open';
    default:
      return 'open';
  }
}

/**
 * True when a Linear state type means the issue is finished, in any sense.
 */
export function isTerminalStateType(stateType: string): boolean {
  return stateType === 'completed' || stateType === 'canceled' || stateType === 'duplicate';
}

/**
 * Map a tbd priority to Linear's integer priority.
 *
 * Linear's scale is NOT ordered by severity: 0 means "no priority set", and 1 is
 * the most urgent. P4 maps to 4 (Low) rather than 0, because 0 would claim the
 * issue has no priority when tbd says it has the lowest one.
 */
export function priorityToLinear(priority: PriorityType): number {
  switch (priority) {
    case 0:
      return 1; // Urgent
    case 1:
      return 2; // High
    case 2:
      return 3; // Medium
    case 3:
      return 4; // Low
    case 4:
      return 4; // Low (P3 and P4 both land here; see priorityFromLinear)
    default:
      // Priority is a bounded int rather than a literal union, so the compiler
      // cannot prove exhaustiveness. Out-of-range input maps to Medium.
      return 3;
  }
}

/**
 * Map Linear's integer priority to a tbd priority.
 *
 * Deliberately not the inverse of `priorityToLinear`. Linear 0 means "nobody set
 * a priority", so it maps to tbd's default (P2) rather than to P4: an
 * unprioritized issue is not the same as an explicitly lowest-priority one. The
 * P4 -> 4 -> P3 round trip is a known, accepted loss.
 */
export function priorityFromLinear(value: number): PriorityType {
  switch (value) {
    case 1:
      return 0;
    case 2:
      return 1;
    case 3:
      return 2;
    case 4:
      return 3;
    case 0:
      return 2; // Unset: fall back to the tbd default.
    default:
      return 2;
  }
}
