/**
 * Slots: one value naming where work sits on a board.
 *
 * The problem this solves is that a tracker board has more columns than tbd has status
 * values, and the extra columns are not extra *positions* — they are the same position
 * qualified by something else. In Progress, Paused, Blocked, and In Review are all
 * "started" work. Todo versus Backlog is a readiness question. Done versus Canceled is a
 * resolution question. None of those distinctions fit in `status`, which is why syncing
 * on `status` alone flattened them all at the boundary.
 *
 * A slot is the flattening done once, deliberately, in the direction that keeps
 * information instead of losing it: a pure function of status, hold, resolution,
 * readiness, and any refinement a person applied on the tracker side. Nothing stores a
 * slot on a bead — it is derived on demand, so there is no second source of truth to
 * drift.
 */

import type { IssueStatusType, IssueHoldType, IssueResolutionType } from '../../lib/types.js';

export const SLOTS = [
  'backlog',
  'draft',
  'todo',
  'in_progress',
  'paused',
  'blocked',
  'in_review',
  'done',
  'canceled',
  'duplicate',
] as const;

export type Slot = (typeof SLOTS)[number];

/** Everything the computation reads. Nothing else about a bead matters here. */
export interface SlotInputs {
  status: IssueStatusType;
  hold?: IssueHoldType | null;
  resolution?: IssueResolutionType | null;
  /** Whether `tbd ready` counts this bead as ready to begin. */
  ready?: boolean;
  /**
   * A within-band position a person chose on the tracker side.
   *
   * Draft and In Review are the named cases: tbd cannot compute either, because
   * "being planned" and "under review" are judgments rather than facts a bead holds.
   * Preserved rather than recomputed, so a sync never drags an issue back out of a
   * column a human deliberately put it in.
   */
  refinement?: Slot | null;
}

/**
 * The coarse band a slot belongs to.
 *
 * The band is what the three-way merge compares when a tracker column has no tbd
 * meaning. Two slots in the same band are the same position as far as agreement is
 * concerned, which is what lets a team keep its own column without tbd fighting it.
 */
export function bandOf(slot: Slot): 'open' | 'started' | 'terminal' {
  switch (slot) {
    case 'backlog':
    case 'draft':
    case 'todo':
      return 'open';
    case 'in_progress':
    case 'paused':
    case 'blocked':
    case 'in_review':
      return 'started';
    default:
      return 'terminal';
  }
}

/**
 * Compute the slot for a bead. First match wins.
 *
 * The order is the design: a terminal resolution outranks everything, a hold outranks
 * an unqualified position, and readiness only decides between two open columns. A bead
 * that is simultaneously unready and held therefore lands in exactly one slot rather
 * than depending on which rule was consulted first.
 */
export function computeSlot(inputs: SlotInputs): Slot {
  const { status, hold, resolution, ready, refinement } = inputs;

  if (status === 'closed') {
    switch (resolution) {
      case 'canceled':
        return 'canceled';
      case 'duplicate':
        return 'duplicate';
      default:
        // Absent resolution reads as completed, which is what keeps every bead closed
        // before the resolution axis existed mapping the way it always did.
        return 'done';
    }
  }

  // Legacy statuses from the five-value enum, which remain valid. They render exactly
  // as they do today rather than being folded into `hold`, so a repository that never
  // adopted the new axis sees no change.
  if (status === 'blocked') {
    return 'blocked';
  }
  if (status === 'deferred') {
    return 'backlog';
  }

  if (status === 'in_progress') {
    if (hold === 'paused') {
      return 'paused';
    }
    if (hold === 'blocked') {
      return 'blocked';
    }
    if (refinement && bandOf(refinement) === 'started') {
      return refinement;
    }
    return 'in_progress';
  }

  // Open. Held work is not ready to begin, whether it is waiting or set aside, and
  // un-started held work has no started-type column to occupy.
  if (hold) {
    return 'backlog';
  }
  if (ready) {
    return 'todo';
  }
  if (refinement && bandOf(refinement) === 'open') {
    return refinement;
  }
  return 'backlog';
}

/** The bead fields a pulled slot implies. */
export interface SlotDecomposition {
  status: IssueStatusType;
  hold: IssueHoldType | null;
  resolution: IssueResolutionType | null;
  /** Set when the slot is a within-band position tbd cannot compute. */
  refinement: Slot | null;
}

/**
 * Turn a slot back into bead fields, for applying a pull.
 *
 * `draft` and `in_review` set their band's status plus a refinement record, never a
 * status of their own: tbd has no way to *compute* either, so recording the column is
 * the only honest representation.
 *
 * `duplicate` decomposes to `canceled`. A duplicate needs a pointer to the bead it
 * duplicates, the tracker carries that as a relation tbd does not read, and the write
 * boundary rejects a duplicate without one. Canceled keeps the honest half: this work
 * was abandoned, not delivered. The caller reports the narrowing.
 */
export function decomposeSlot(slot: Slot): SlotDecomposition {
  switch (slot) {
    case 'done':
      return { status: 'closed', hold: null, resolution: 'completed', refinement: null };
    case 'canceled':
    case 'duplicate':
      return { status: 'closed', hold: null, resolution: 'canceled', refinement: null };
    case 'paused':
      return { status: 'in_progress', hold: 'paused', resolution: null, refinement: null };
    case 'blocked':
      return { status: 'in_progress', hold: 'blocked', resolution: null, refinement: null };
    case 'in_review':
      return { status: 'in_progress', hold: null, resolution: null, refinement: 'in_review' };
    case 'in_progress':
      return { status: 'in_progress', hold: null, resolution: null, refinement: null };
    case 'draft':
      return { status: 'open', hold: null, resolution: null, refinement: 'draft' };
    default:
      return { status: 'open', hold: null, resolution: null, refinement: null };
  }
}

/** Whether a string names a slot, for reading values written by another version. */
export function isSlot(value: string): value is Slot {
  return (SLOTS as readonly string[]).includes(value);
}

/**
 * The slot a stored base's five-value status represents, coarsely.
 *
 * Every base written before slots existed holds a status, and a status cannot express
 * the distinctions slots exist for. `open` is the lossy one: it could have been Todo or
 * Backlog and the base never recorded which, because readiness was not part of the
 * comparison.
 */
function slotFromLegacyStatus(status: IssueStatusType): Slot {
  switch (status) {
    case 'closed':
      return 'done';
    case 'in_progress':
      return 'in_progress';
    case 'blocked':
      return 'blocked';
    case 'deferred':
      return 'backlog';
    default:
      return 'backlog';
  }
}

/**
 * The slot a legacy base stands for, and how much it can be trusted.
 *
 * A base written before slots existed holds only a status, and a status cannot express
 * the distinctions slots exist for: `open` could have meant Todo or Backlog, `closed`
 * could have meant Done or Canceled, and the base never recorded which. So the migrated
 * value comes with a warning that it is *coarse* — accurate about the band, silent
 * within it.
 *
 * That silence is the whole difficulty. Read naively, a bead now computing `todo`
 * disagrees with a base migrated to `backlog`, and on a repository with hundreds of
 * mirrored issues the first sync after upgrading would push a state write to every one
 * of them. The correct number of writes is zero, and "the bulk guard stopped it" is not
 * the same as "it was right".
 *
 * The caller therefore compares *bands* while a base is coarse, so a distinction the
 * base could not have recorded is treated as no disagreement in either direction rather
 * than as a change to be flowed. Once a run stores a real slot the comparison becomes
 * exact.
 */
export function migrateBaseSlot(baseStatus: IssueStatusType): {
  slot: Slot;
  coarse: true;
} {
  return { slot: slotFromLegacyStatus(baseStatus), coarse: true };
}

/**
 * Whether two slots should count as the same position.
 *
 * Exact once the base records a real slot. Band-level while it is still the coarse
 * migration of a legacy status, because the base is silent within a band rather than in
 * disagreement about it.
 */
export function slotsAgree(a: Slot, b: Slot, baseIsCoarse: boolean): boolean {
  return baseIsCoarse ? bandOf(a) === bandOf(b) : a === b;
}
