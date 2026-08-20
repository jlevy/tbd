/**
 * Pure mapping between tbd canonical values and Linear's model.
 *
 * These are the only place Linear's vocabulary appears, so a second provider
 * writes its own table and changes nothing else.
 */

import type { Slot } from '../core/slots.js';
import type {
  IssueStatusType,
  IssueResolutionType,
  IssueHoldType,
  PriorityType,
} from '../../lib/types.js';

/** Labels tbd owns are prefixed so they cannot collide with a team's own. */
export const TBD_LABEL_PREFIX = 'tbd:';
export const BLOCKED_LABEL = `${TBD_LABEL_PREFIX}blocked`;
export const DEFERRED_LABEL = `${TBD_LABEL_PREFIX}deferred`;
export const PAUSED_LABEL = `${TBD_LABEL_PREFIX}paused`;

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
  /**
   * A state NAME to prefer over the type's default, when the type cannot express the
   * distinction on its own.
   *
   * `paused` and `blocked` are both type `started` — they describe work that has begun
   * — so a type alone cannot tell them apart from active work. A team that has the
   * named state gets a real column; one that does not falls back to the type plus the
   * carrier label below, which is the mechanism `blocked` and `deferred` already use.
   */
  stateName?: string;
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
  hold?: IssueHoldType | null,
): LinearStatusTarget {
  switch (status) {
    case 'open':
      // Held-but-unstarted work is not scheduled, so it belongs in the backlog rather
      // than in Todo. The carrier label is what makes it round-trip: a backlog state
      // alone cannot say whether the work was deliberately set down.
      return hold
        ? { stateType: 'backlog', labels: [hold === 'paused' ? PAUSED_LABEL : BLOCKED_LABEL] }
        : { stateType: 'unstarted', labels: [] };
    case 'in_progress':
      if (hold === 'paused') {
        return { stateType: 'started', stateName: 'Paused', labels: [PAUSED_LABEL] };
      }
      if (hold === 'blocked') {
        return { stateType: 'started', stateName: 'Blocked', labels: [BLOCKED_LABEL] };
      }
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

/**
 * Recover the hold from a Linear state name plus carrier labels.
 *
 * Read alongside {@link statusFromLinear}, which answers only *where* the work sits.
 * The carrier label is checked first because it is what tbd itself writes and is
 * therefore unambiguous; a state name is a team's own wording and only consulted when
 * no carrier says otherwise.
 *
 * `tbd:blocked` deliberately does NOT produce a hold: it is the carrier for the legacy
 * `blocked` *status*, which {@link statusFromLinear} still owns, and reading it twice
 * would set both a position and a modifier from one signal.
 */
export function holdFromLinear(
  stateName: string | undefined,
  labels: readonly string[],
): IssueHoldType | null {
  if (labels.includes(PAUSED_LABEL)) {
    return 'paused';
  }
  const name = stateName?.trim().toLowerCase();
  if (name === 'paused') {
    return 'paused';
  }
  if (name === 'blocked') {
    return 'blocked';
  }
  return null;
}

/**
 * The slot a Linear state represents.
 *
 * Read from the state's **name** first and its type second. The type alone cannot tell
 * In Progress from Paused, Blocked, or In Review — all four are `started` — which is
 * the whole reason slots exist. The name is what a team actually calls the column, so
 * it is what carries the distinction.
 *
 * A `started` state whose name tbd does not recognize returns `in_progress`: for
 * agreement purposes it is simply started work, and the caller preserves its exact
 * state id separately so an outbound write puts the issue back in the team's own column
 * rather than dragging it to a generic one.
 */
export function slotFromLinear(
  stateType: string,
  stateName: string | undefined,
  labels: readonly string[],
): Slot {
  const name = stateName?.trim().toLowerCase();

  switch (stateType) {
    case 'completed':
      return 'done';
    case 'canceled':
      return 'canceled';
    case 'duplicate':
      return 'duplicate';
    case 'started':
      // Carrier labels win over the name: they are what tbd itself writes, so they are
      // unambiguous, while a name is a team's own wording.
      if (labels.includes(PAUSED_LABEL) || name === 'paused') {
        return 'paused';
      }
      if (labels.includes(BLOCKED_LABEL) || name === 'blocked') {
        return 'blocked';
      }
      if (name === 'in review') {
        return 'in_review';
      }
      return 'in_progress';
    case 'backlog':
      if (name === 'draft') {
        return 'draft';
      }
      return 'backlog';
    case 'unstarted':
      return 'todo';
    default:
      // An unrecognized type should never abort a sync; the open band is the least
      // destructive assumption, matching `statusFromLinear`.
      return 'backlog';
  }
}

/**
 * Where a slot should be written on the Linear side.
 *
 * The outbound half of {@link slotFromLinear}. `stateName` is a preference rather than
 * a requirement: a team that has the column gets a real one, and a team that does not
 * falls back to the type's default plus a carrier label, which is the degradation
 * `blocked` and `deferred` have always used.
 */
export function slotToLinear(slot: Slot): LinearStatusTarget {
  switch (slot) {
    case 'done':
      return { stateType: 'completed', labels: [] };
    case 'canceled':
      return { stateType: 'canceled', labels: [] };
    case 'duplicate':
      return { stateType: 'duplicate', labels: [] };
    case 'paused':
      return { stateType: 'started', stateName: 'Paused', labels: [PAUSED_LABEL] };
    case 'blocked':
      return { stateType: 'started', stateName: 'Blocked', labels: [BLOCKED_LABEL] };
    case 'in_review':
      return { stateType: 'started', stateName: 'In Review', labels: [] };
    case 'in_progress':
      return { stateType: 'started', labels: [] };
    case 'draft':
      return { stateType: 'backlog', stateName: 'Draft', labels: [] };
    case 'todo':
      return { stateType: 'unstarted', labels: [] };
    default:
      return { stateType: 'backlog', labels: [] };
  }
}

/**
 * The colour to give a workflow state tbd creates.
 *
 * Linear requires one — `WorkflowStateCreateInput.color` is `String!` — and omitting it
 * fails the mutation outright. These are Linear's own defaults for each type, so a
 * provisioned column looks like one a person would have made rather than announcing
 * itself.
 */
export function stateColorFor(stateType: string): string {
  switch (stateType) {
    case 'backlog':
      return '#bec2c8';
    case 'unstarted':
      return '#e2e2e2';
    case 'started':
      return '#f2c94c';
    case 'completed':
      return '#5e6ad2';
    case 'canceled':
    case 'duplicate':
      return '#95a2b3';
    default:
      return '#bec2c8';
  }
}
