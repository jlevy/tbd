/**
 * Pure mapping between tbd canonical values and Linear's model.
 *
 * These are the only place Linear's vocabulary appears, so a second provider
 * writes its own table and changes nothing else.
 */

import type { IssueStatusType, IssueResolutionType, PriorityType } from '../../lib/types.js';

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
 * Linear's state type for each terminal resolution.
 *
 * Every Linear team ships all three by default, so this half of the mapping needs no
 * provisioning anywhere. Verified across two teams in one workspace.
 */
const STATE_TYPE_BY_RESOLUTION: Record<IssueResolutionType, string> = {
  completed: 'completed',
  canceled: 'canceled',
  duplicate: 'duplicate',
};

/**
 * Map a tbd status to a Linear state type plus any carrier labels.
 *
 * `blocked` and `deferred` have no Linear equivalent, so they ride on a tbd-owned
 * label alongside the nearest state type. Round-tripping is lossy only if someone
 * strips the label in Linear.
 *
 * `resolution` refines the terminal end only. Absent reads as `completed`, which is
 * what keeps every bead closed before the axis existed mapping exactly as it did.
 * Position wins over reason everywhere else: a resolution on non-terminal work is a
 * contradiction the schema rejects, and this pure function is reached from paths that
 * have not validated, so it ignores it rather than misfiling the issue.
 */
export function statusToLinear(
  status: IssueStatusType,
  resolution?: IssueResolutionType | null,
): LinearStatusTarget {
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
      return {
        stateType: STATE_TYPE_BY_RESOLUTION[resolution ?? 'completed'] ?? 'completed',
        labels: [],
      };
    default:
      return { stateType: 'unstarted', labels: [] };
  }
}

/**
 * Recover the terminal resolution from a Linear state type.
 *
 * The counterpart to {@link statusFromLinear}, which answers only *where* the work
 * sits. Reading both is what makes the terminal end lossless in the inbound direction:
 * before this, a human setting Canceled in Linear produced a bead that said `closed`
 * and had erased the distinction permanently.
 *
 * Null for any non-terminal state, so a caller can write it straight onto a bead
 * without re-deriving whether the issue is finished.
 */
export function resolutionFromLinear(stateType: string): IssueResolutionType | null {
  switch (stateType) {
    case 'completed':
      return 'completed';
    case 'canceled':
      return 'canceled';
    case 'duplicate':
      return 'duplicate';
    default:
      return null;
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

/** One workflow state as Linear reports it. */
export interface WorkflowStateInfo {
  id: string;
  name: string;
  type: string;
  position: number;
}

/**
 * The state name Linear ships for each type in a stock team.
 *
 * Used only to break a tie between several states of one type. A team that renamed
 * its states is not penalized: an unmatched conventional name simply falls through to
 * the ambiguity report, which names the candidates instead of guessing among them.
 */
export const CONVENTIONAL_STATE_NAMES: Readonly<Record<string, string>> = {
  backlog: 'Backlog',
  unstarted: 'Todo',
  started: 'In Progress',
  completed: 'Done',
  canceled: 'Canceled',
  duplicate: 'Duplicate',
};

/** What {@link resolveStateId} concluded, and why. */
export interface StateResolution {
  /** The chosen state, when one could be chosen. */
  state?: WorkflowStateInfo;
  /** How it was chosen, for `tbd doctor` to explain itself offline. */
  via?: 'configured' | 'conventional' | 'sole';
  /** Set when several states of the type exist and none is conventional. */
  ambiguous?: WorkflowStateInfo[];
}

/**
 * Choose the workflow state for a type, by name and never by board position.
 *
 * Position is the least stable handle available: a rename is deliberate and visible,
 * while dragging a row in the workflow editor is neither, and under the previous
 * lowest-position rule that silently changed where work landed. Order, first match
 * wins:
 *
 *   1. the name configured for this type
 *   2. the conventional name Linear ships
 *   3. the only state of that type, when there is only one
 *   4. ambiguous — report the candidates rather than pick one
 *
 * Step 3 covers every type except `started` on a stock team, which is exactly the case
 * step 2 settles.
 */
export function resolveStateId(
  states: readonly WorkflowStateInfo[],
  stateType: string,
  configuredName?: string,
): StateResolution {
  const sameName = (a: string, b: string): boolean => a.toLowerCase() === b.toLowerCase();

  if (configuredName) {
    const configured = states.find((s) => sameName(s.name, configuredName));
    if (configured) {
      return { state: configured, via: 'configured' };
    }
  }

  const candidates = states.filter((s) => s.type === stateType);
  if (candidates.length === 1) {
    return { state: candidates[0], via: 'sole' };
  }
  if (candidates.length === 0) {
    return {};
  }

  const conventional = CONVENTIONAL_STATE_NAMES[stateType];
  const byName = conventional && candidates.find((s) => sameName(s.name, conventional));
  if (byName) {
    return { state: byName, via: 'conventional' };
  }
  return { ambiguous: candidates };
}
