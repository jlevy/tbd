/**
 * The reconcile engine: a pure, per-field three-way matrix for one linked pair.
 *
 * | local vs base | remote vs base | outcome                     |
 * | ------------- | -------------- | --------------------------- |
 * | unchanged     | unchanged      | nothing                     |
 * | changed       | unchanged      | push to tracker             |
 * | unchanged     | changed        | pull into bead              |
 * | changed       | changed, same  | converged; advance base     |
 * | changed       | changed, diff  | conflict → tie-break        |
 *
 * A field owned `local` or `remote` short-circuits the matrix: the owner's
 * value flows and an opposite-side edit is overwritten — reported, never
 * silent. With no base (a freshly linked pair), equal values converge and
 * differing values conflict, which is the honest answer to "who changed it?".
 *
 * Correctness never depends on timestamps. The one exception is the `newest`
 * tie-break, an explicit last resort comparing clocks across two systems, and
 * `local`/`remote` tie-breaks exist precisely for repos that refuse it.
 *
 * No I/O, no network, no provider knowledge: values arrive tbd-canonical.
 */

import type { BridgeBase, IssueStatusType, PriorityType } from '../../lib/types.js';
import type { FieldSyncClause } from '../../lib/types.js';
import { descriptionHash } from './bridge-state.js';
import { stripManagedBlock } from './managed-block.js';
import type { CanonicalPatch } from './types.js';

/** The fields the engine reconciles, in stable report order. */
export const SYNCED_FIELDS = [
  'title',
  'description',
  'status',
  'priority',
  'labels',
  'assignee',
] as const;
export type SyncedField = (typeof SYNCED_FIELDS)[number];

/** The local (bead) side, canonical values plus the tie-break clock. */
export interface LocalView {
  title: string;
  description: string | null;
  status: IssueStatusType;
  priority: PriorityType;
  labels: string[];
  assignee: string | null;
  updated_at: string;
}

/** The remote side, canonical values plus the provider's clock. */
export interface RemoteView {
  title: string;
  /** Raw remote description; the managed block is stripped internally. */
  description: string | null;
  status: IssueStatusType;
  priority: PriorityType;
  labels: string[];
  assignee: string | null;
  updatedAt: string;
}

/** A both-sides divergence decided by the tie-break. */
export interface FieldConflict {
  field: SyncedField;
  localValue: unknown;
  remoteValue: unknown;
  winner: 'local' | 'remote';
  decidedBy: 'newest' | 'local' | 'remote';
}

/** An owner-rule flow that discarded an opposite-side edit. */
export interface OwnerOverwrite {
  field: SyncedField;
  /** 'push' overwrote a tracker edit; 'pull' overwrote a bead edit. */
  direction: 'push' | 'pull';
  overwrittenValue: unknown;
}

/** A patch to apply to the bead, canonical values. */
export interface BeadPatch {
  title?: string;
  description?: string | null;
  status?: IssueStatusType;
  priority?: PriorityType;
  labels?: string[];
  assignee?: string | null;
}

export interface ReconcileResult {
  beadPatch: BeadPatch;
  externalPatch: CanonicalPatch;
  conflicts: FieldConflict[];
  overwrites: OwnerOverwrite[];
  /**
   * Pushes the engine had to skip because the provider surface cannot apply
   * them yet (assignee needs a user_map at the adapter). Visible, not silent:
   * merged takes the REMOTE value so the base reflects external reality and
   * the divergence re-reports on every run until it is resolved.
   */
  skippedPushes: { field: SyncedField; localValue: unknown }[];
  /** Canonical values after both patches apply — the next base. */
  merged: {
    title: string;
    status: IssueStatusType;
    priority: PriorityType;
    labels: string[];
    assignee: string | null;
    description_hash: string;
  };
}

/** Order-insensitive label equality; labels are a set in both systems. */
function labelsEqual(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) {
    return false;
  }
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((value, index) => value === sortedB[index]);
}

interface FieldOps {
  local: unknown;
  remote: unknown;
  /** The recorded base value; undefined means "no base" (freshly linked). */
  base: unknown;
  equal: (a: unknown, b: unknown) => boolean;
  applyLocal: (value: unknown) => void; // write into beadPatch
  applyRemote: (value: unknown) => void; // write into externalPatch
  /** False when the provider surface cannot apply an outbound value yet. */
  canPush: boolean;
}

/**
 * Reconcile one linked pair. Pure.
 *
 * @param base - The recorded base, or undefined for a freshly linked pair.
 */
export function reconcile(
  base: BridgeBase | undefined,
  local: LocalView,
  remote: RemoteView,
  rules: FieldSyncClause,
): ReconcileResult {
  const beadPatch: BeadPatch = {};
  const externalPatch: CanonicalPatch = {};
  const conflicts: FieldConflict[] = [];
  const overwrites: OwnerOverwrite[] = [];
  const skippedPushes: { field: SyncedField; localValue: unknown }[] = [];

  const remoteProse = stripManagedBlock(remote.description);
  const localWins =
    rules.tie_break === 'newest'
      ? local.updated_at >= remote.updatedAt
      : rules.tie_break === 'local';

  const scalarEqual = (a: unknown, b: unknown): boolean => a === b;
  const merged = {
    title: local.title,
    status: local.status,
    priority: local.priority,
    labels: local.labels,
    assignee: local.assignee,
    description_hash: descriptionHash(local.description),
  };

  const fields: Record<SyncedField, FieldOps> = {
    title: {
      local: local.title,
      remote: remote.title,
      base: base?.title,
      equal: scalarEqual,
      applyLocal: (value) => {
        beadPatch.title = value as string;
        merged.title = value as string;
      },
      applyRemote: (value) => {
        externalPatch.title = value as string;
      },
      canPush: true,
    },
    description: {
      // Compared by normalized hash so cosmetic round-tripping never counts
      // as a change; the applied values are the real prose.
      local: descriptionHash(local.description),
      remote: descriptionHash(remoteProse),
      base: base?.description_hash,
      equal: scalarEqual,
      applyLocal: () => {
        beadPatch.description = remoteProse;
        merged.description_hash = descriptionHash(remoteProse);
      },
      applyRemote: () => {
        externalPatch.description = local.description;
      },
      canPush: true,
    },
    status: {
      local: local.status,
      remote: remote.status,
      base: base?.status,
      equal: scalarEqual,
      applyLocal: (value) => {
        beadPatch.status = value as IssueStatusType;
        merged.status = value as IssueStatusType;
      },
      applyRemote: (value) => {
        externalPatch.status = value as IssueStatusType;
      },
      canPush: true,
    },
    priority: {
      local: local.priority,
      remote: remote.priority,
      base: base?.priority,
      equal: scalarEqual,
      applyLocal: (value) => {
        beadPatch.priority = value as PriorityType;
        merged.priority = value as PriorityType;
      },
      applyRemote: (value) => {
        externalPatch.priority = value as PriorityType;
      },
      canPush: true,
    },
    labels: {
      local: local.labels,
      remote: remote.labels,
      base: base?.labels,
      equal: (a, b) => labelsEqual(a as string[], b as string[]),
      applyLocal: (value) => {
        beadPatch.labels = value as string[];
        merged.labels = value as string[];
      },
      applyRemote: (value) => {
        externalPatch.labels = value as string[];
      },
      canPush: true,
    },
    assignee: {
      local: local.assignee,
      remote: remote.assignee,
      base: base?.assignee ?? null,
      equal: scalarEqual,
      applyLocal: (value) => {
        beadPatch.assignee = value as string | null;
        merged.assignee = value as string | null;
      },
      applyRemote: () => {
        // Unreachable: canPush is false, so push sites divert to skippedPushes.
      },
      canPush: false,
    },
  };

  const skipPush = (field: SyncedField, ops: FieldOps): void => {
    skippedPushes.push({ field, localValue: ops.local });
    // The base must reflect external reality, so the divergence stays visible
    // and re-reports on every run rather than being absorbed silently.
    if (field === 'assignee') {
      merged.assignee = ops.remote as string | null;
    }
  };

  for (const field of SYNCED_FIELDS) {
    const ops = fields[field];
    const rule = rules.fields[field];
    const valuesEqual = ops.equal(ops.local, ops.remote);

    if (rule === 'local') {
      if (!valuesEqual) {
        if (!ops.canPush) {
          skipPush(field, ops);
          continue;
        }
        ops.applyRemote(ops.local);
        // With a base we can say whether the tracker side actually changed;
        // without one, the push overwrites whatever is there, so report it.
        const remoteChanged = ops.base === undefined || !ops.equal(ops.remote, ops.base);
        if (remoteChanged) {
          overwrites.push({ field, direction: 'push', overwrittenValue: ops.remote });
        }
      }
      continue;
    }

    if (rule === 'remote') {
      if (!valuesEqual) {
        ops.applyLocal(ops.remote);
        const localChanged = ops.base === undefined || !ops.equal(ops.local, ops.base);
        if (localChanged) {
          overwrites.push({ field, direction: 'pull', overwrittenValue: ops.local });
        }
      }
      continue;
    }

    // merge: the three-way matrix.
    if (valuesEqual) {
      continue; // includes both-changed-to-same-value: converged
    }
    if (ops.base === undefined) {
      // Freshly linked, values differ: genuinely ambiguous, so conflict.
      resolveConflict(field, ops, localWins, rules.tie_break, conflicts, skipPush);
      continue;
    }
    const localChanged = !ops.equal(ops.local, ops.base);
    const remoteChanged = !ops.equal(ops.remote, ops.base);
    if (localChanged && !remoteChanged) {
      if (ops.canPush) {
        ops.applyRemote(ops.local); // push
      } else {
        skipPush(field, ops);
      }
    } else if (!localChanged && remoteChanged) {
      ops.applyLocal(ops.remote); // pull
    } else if (localChanged && remoteChanged) {
      resolveConflict(field, ops, localWins, rules.tie_break, conflicts, skipPush);
    }
    // Neither changed but values differ: impossible when equality is
    // transitive; treat as converged-on-base and leave both sides alone.
  }

  return { beadPatch, externalPatch, conflicts, overwrites, skippedPushes, merged };
}

function resolveConflict(
  field: SyncedField,
  ops: FieldOps,
  localWins: boolean,
  decidedBy: 'newest' | 'local' | 'remote',
  conflicts: FieldConflict[],
  skipPush: (field: SyncedField, ops: FieldOps) => void,
): void {
  // A local win that cannot be pushed is not a win: the remote value stands,
  // the divergence is reported as a skipped push, and no conflict is recorded
  // claiming an overwrite that never happened.
  if (localWins && !ops.canPush) {
    skipPush(field, ops);
    return;
  }
  if (localWins) {
    ops.applyRemote(ops.local);
  } else {
    ops.applyLocal(ops.remote);
  }
  conflicts.push({
    field,
    localValue: ops.local,
    remoteValue: ops.remote,
    winner: localWins ? 'local' : 'remote',
    decidedBy,
  });
}
