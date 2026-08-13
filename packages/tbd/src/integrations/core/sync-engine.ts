/**
 * The full synchronization: apply the whole linking policy for one provider.
 *
 * Order matters and each step is deliberate:
 *
 * 1. **Replay** pending intents (this machine's or another's) so nothing is in
 *    flight before new work is planned. Inbound-only runs deliberately leave
 *    them pending because replay would violate their no-provider-writes contract.
 * 2. **Pull** the remote delta (watermark minus a generous overlap — an
 *    efficiency prefilter, never a correctness input) plus targeted fetches
 *    for linked pairs with local-only changes.
 * 3. **Reconcile** every linked pair per `field_sync` (pure), and plan comment
 *    flows per the comments mode.
 * 4. **Guard**: bulk thresholds count BOTH directions.
 * 5. **Journal** every planned external write, then let the caller commit.
 * 6. **Apply**: external writes with per-pair failure containment, bead writes
 *    through the caller (the normal issue write path), conflict comments with
 *    client UUIDs, base advances, journal cleanup.
 * 7. **Policy scans**: outbound-new creates, inbound report or import.
 *
 * The engine performs no git operations: the caller owns commits, and the
 * base-advance-only-after-recorded rule is honored by journal ordering (see
 * intents.ts) plus the caller committing after the run.
 */

import { randomUUID } from 'node:crypto';

import { ulid } from 'ulid';

import type {
  InboundClause,
  Issue,
  LinkRecord,
  PolicyDefinition,
  ProviderNameType,
} from '../../lib/types.js';
import { readyIssueIds } from '../../lib/issue-selection.js';
import {
  descriptionHash,
  listLinkRecords,
  pullWatermark,
  writeLinkRecord,
} from './bridge-state.js';
import {
  mergeExternalComments,
  readComments,
  recordPushedComment,
  unpushedComments,
} from './comment-store.js';
import { duplicateExternalLinks, readLink, writeLink } from './link-store.js';
import { assertExternalUnclaimed } from './link-guard.js';
import { renderManagedBlock, spliceManagedBlock, type MirrorLinks } from './managed-block.js';
import { attachmentsFor, beadAttachmentUrl, depthWithinSelection, prefixLabels } from './mirror.js';
import {
  reconcile,
  type FieldConflict,
  type FieldEquivalences,
  type LocalView,
  type RemoteView,
} from './reconcile.js';
import { mirrorSet } from './selection.js';
import {
  replayIntents,
  writeIntentFile,
  deleteIntentFile,
  listIntentFiles,
  type IntentOp,
  type IntentPatch,
} from './intents.js';
import { CONFLICT_COMMENT_MARKER } from './types.js';
import type { ConflictReport, ExternalIssue, TrackerAdapter } from './types.js';

/** Re-fetch this far behind the watermark; over-fetching costs nothing. */
const WATERMARK_OVERLAP_MS = 10 * 60 * 1000;

export interface SyncCallbacks {
  /** Read the current stored bead (the engine's in-memory copy may be stale). */
  readBead(id: string): Promise<Issue>;
  /** Persist a bead. The caller bumps nothing; the engine already did. */
  writeBead(issue: Issue): Promise<void>;
  /** Create a bead from an inbound import. Returns the stored issue. */
  createBead(input: {
    title: string;
    description: string | null;
    status: Issue['status'];
    priority: Issue['priority'];
    kind: Issue['kind'];
    /** Local bead id resolved from the provider parent's stable identity. */
    parentId?: string;
    /** Canonical alias only when the adapter confirms an explicit identity mapping. */
    assignee?: string;
  }): Promise<Issue>;
  /** Commit the journaled intents before any external write happens. */
  afterJournal(): Promise<void>;
  /** Preserve a losing tracker-conflict value and return its repo-relative path. */
  archiveConflict(input: {
    beadId: string;
    field: string;
    lostValue: unknown;
    winnerSource: 'local' | 'remote';
    localVersion: number;
    localUpdatedAt: string;
    remoteUpdatedAt: string;
  }): Promise<string>;
  /**
   * Enforce the bulk guard. Throws to abort the run; returns to proceed.
   * Counts cover both directions.
   */
  affirmBulk(counts: { creates: number; updates: number }): Promise<void>;
}

export interface SyncEngineOptions {
  provider: ProviderNameType;
  adapter: TrackerAdapter;
  policy: PolicyDefinition;
  dataSyncDir: string;
  allIssues: Issue[];
  displayId: (id: string) => string;
  /** Spec permalink resolution, shared with the mirror. */
  specUrl?: (issue: Issue) => string | undefined;
  /**
   * Push bead labels as tracker labels. Off by default, exactly like the
   * mirror: a repo can carry a hundred-plus labels, and pushing them creates
   * one per label in a shared team namespace. When off, labels neither push
   * nor wipe — the tracker's labels (including tbd's own status carriers) are
   * left alone. When on, pushed labels are `tbd:`-prefixed.
   */
  mirrorLabels: boolean;
  /** Levels of the selected outbound hierarchy that may exist in the provider. */
  maxNesting?: number;
  /** Provider-specific field equivalences (see reconcile.ts). */
  equivalences?: FieldEquivalences;
  /**
   * Which half of the synchronization to apply.
   *
   * `both` (the default) is the full synchronization. `inbound` applies only
   * bead-side changes — pulls, comment pulls, imports — and performs no
   * external writes at all, which is what makes `tbd integration pull` safe to
   * run against a tracker you do not want to touch. Reconciliation still runs
   * in full either way; the direction gates what is APPLIED, so the report
   * still names what the suppressed half would have done.
   */
  direction?: 'both' | 'inbound';
  /** Explicit provider ids selected by `sync --pull --external`, independent of policy. */
  externalIssueIds?: string[];
  /** Deliberate override for a stale cross-repository tbd attachment claim. */
  allowClaimedExternal?: boolean;
  callbacks: SyncCallbacks;
  dryRun: boolean;
  now: () => string;
}

export interface SyncRunReport {
  provider: ProviderNameType;
  replayedOps: number;
  pushed: string[];
  pulled: string[];
  conflicts: { beadId: string; field: string; winner: string }[];
  overwrites: { beadId: string; field: string; direction: string }[];
  skippedPushes: { beadId: string; field: string }[];
  /** Safe provider-to-canonical mapping diagnostics, deduplicated per external item. */
  warnings: { externalId: string; externalKey?: string; message: string }[];
  commentsPulled: number;
  commentsPushed: number;
  orphaned: string[];
  createdOutbound: string[];
  skippedOutbound: { beadId: string; reason: string }[];
  importedInbound: string[];
  /** Inbound items reported but not imported (mode: report). */
  importable: { id: string; key?: string; title: string }[];
  failures: { beadId: string; error: string }[];
  /** True when the run had nothing to do at all. */
  nothingToDo: boolean;
}

interface PlannedPair {
  bead: Issue;
  record: LinkRecord | undefined;
  remote: ExternalIssue;
  result: ReturnType<typeof reconcile>;
  /** Parent relationships are tbd-owned and intentionally not three-way merged. */
  parentOverwrite: boolean;
}

function localViewOf(bead: Issue): LocalView {
  return {
    title: bead.title,
    description: bead.description ?? null,
    status: bead.status,
    priority: bead.priority,
    labels: bead.labels ?? [],
    assignee: bead.assignee ?? null,
    updated_at: bead.updated_at,
  };
}

function remoteViewOf(remote: ExternalIssue): RemoteView {
  return {
    title: remote.title,
    description: remote.description,
    status: remote.status,
    priority: remote.priority,
    labels: remote.labels,
    assignee: remote.assignee,
    updatedAt: remote.updatedAt,
  };
}

function overlappedWatermark(watermark: string | undefined): string | undefined {
  if (!watermark) {
    return undefined;
  }
  return new Date(Date.parse(watermark) - WATERMARK_OVERLAP_MS).toISOString();
}

function conflictReportOf(
  beadId: string,
  conflict: FieldConflict,
  atticPath: string,
): ConflictReport {
  const kept = conflict.winner === 'local' ? conflict.localValue : conflict.remoteValue;
  const discarded = conflict.winner === 'local' ? conflict.remoteValue : conflict.localValue;
  return { beadId, field: conflict.field, keptValue: kept, discardedValue: discarded, atticPath };
}

function conflictSignature(report: ConflictReport): string {
  return JSON.stringify([report.beadId, report.field, report.keptValue, report.discardedValue]);
}

function externalName(issue: ExternalIssue): string {
  return issue.key ?? issue.id;
}

function unavailableParentError(issue: ExternalIssue): string {
  const parent = issue.parent;
  return (
    `Cannot import ${externalName(issue)} without its parent ${parent?.key ?? parent?.id ?? 'unknown'}. ` +
    'Import or link the parent in this repository first.'
  );
}

/** Topologically order imports and reject missing/cyclic parent relationships. */
function orderInboundCandidates(
  candidates: ExternalIssue[],
  linkedExternalIds: ReadonlySet<string>,
): {
  ordered: ExternalIssue[];
  failures: { candidate: ExternalIssue; error: string }[];
} {
  const byId = new Map(candidates.map((candidate) => [candidate.id, candidate]));
  const state = new Map<string, 'visiting' | 'ordered' | 'failed'>();
  const ordered: ExternalIssue[] = [];
  const failures: { candidate: ExternalIssue; error: string }[] = [];

  const fail = (candidate: ExternalIssue, error: string): false => {
    if (state.get(candidate.id) !== 'failed') {
      state.set(candidate.id, 'failed');
      failures.push({ candidate, error });
    }
    return false;
  };

  const visit = (candidate: ExternalIssue, path: string[]): boolean => {
    const currentState = state.get(candidate.id);
    if (currentState === 'ordered') {
      return true;
    }
    if (currentState === 'failed') {
      return false;
    }
    if (currentState === 'visiting') {
      const cycle = [...path, externalName(candidate)].join(' -> ');
      return fail(candidate, `Cannot import cyclic provider hierarchy: ${cycle}.`);
    }

    state.set(candidate.id, 'visiting');
    const parent = candidate.parent;
    if (parent && !linkedExternalIds.has(parent.id)) {
      const parentCandidate = byId.get(parent.id);
      if (!parentCandidate) {
        return fail(candidate, unavailableParentError(candidate));
      }
      if (!visit(parentCandidate, [...path, externalName(candidate)])) {
        return fail(candidate, unavailableParentError(candidate));
      }
    }
    if (state.get(candidate.id) === 'failed') {
      return false;
    }
    state.set(candidate.id, 'ordered');
    ordered.push(candidate);
    return true;
  };

  for (const candidate of candidates) {
    visit(candidate, []);
  }
  return { ordered, failures };
}

/** Stable parent-before-child ordering for a valid local bead hierarchy. */
function orderBeadsParentFirst(issues: Issue[]): Issue[] {
  const byId = new Map(issues.map((issue) => [issue.id, issue]));
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const ordered: Issue[] = [];

  const visit = (issue: Issue): void => {
    if (visited.has(issue.id) || visiting.has(issue.id)) {
      return;
    }
    visiting.add(issue.id);
    const parent = issue.parent_id ? byId.get(issue.parent_id) : undefined;
    if (parent) {
      visit(parent);
    }
    visiting.delete(issue.id);
    visited.add(issue.id);
    ordered.push(issue);
  };

  for (const issue of issues) {
    visit(issue);
  }
  return ordered;
}

/** Run the full synchronization for one provider. */
export async function runSync(options: SyncEngineOptions): Promise<SyncRunReport> {
  const { adapter, provider, policy, dataSyncDir, callbacks, dryRun } = options;
  const inboundOnly = options.direction === 'inbound';
  const report: SyncRunReport = {
    provider,
    replayedOps: 0,
    pushed: [],
    pulled: [],
    conflicts: [],
    overwrites: [],
    skippedPushes: [],
    warnings: [],
    commentsPulled: 0,
    commentsPushed: 0,
    orphaned: [],
    createdOutbound: [],
    skippedOutbound: [],
    importedInbound: [],
    importable: [],
    failures: [],
    nothingToDo: false,
  };
  const warningKeys = new Set<string>();
  const recordMappingWarnings = (issues: readonly ExternalIssue[]): void => {
    for (const issue of issues) {
      for (const message of issue.mappingWarnings ?? []) {
        const identity = JSON.stringify([issue.id, message]);
        if (warningKeys.has(identity)) {
          continue;
        }
        warningKeys.add(identity);
        report.warnings.push({
          externalId: issue.id,
          ...(issue.key ? { externalKey: issue.key } : {}),
          message,
        });
      }
    }
  };
  const issuesById = new Map(options.allIssues.map((issue) => [issue.id, issue]));

  // Corrupt legacy/manual state can bypass the link command's one-source
  // guard. Identify every holder before replaying a journal or contacting the
  // provider, then quarantine only those pairs so unrelated work can proceed.
  const duplicateLinks = duplicateExternalLinks(options.allIssues, provider);
  const blockedBeadIds = new Set(duplicateLinks.flatMap((duplicate) => duplicate.beadIds));
  const blockedExternalIds = new Set(duplicateLinks.map((duplicate) => duplicate.externalId));
  const replayedConflictReports = new Map<string, ConflictReport>();
  for (const duplicate of duplicateLinks) {
    const displayIds = duplicate.beadIds.map(options.displayId).sort();
    const externalRef = duplicate.externalKey ?? duplicate.externalId;
    for (const beadId of displayIds) {
      report.failures.push({
        beadId,
        error:
          `${provider} item ${externalRef} is linked by multiple beads: ` +
          `${displayIds.join(', ')}. Run \`tbd integration unlink\` until exactly one link remains.`,
      });
    }
  }

  // 1. Replay anything a crashed run left behind. Never during a dry run: a
  // preview must not perform writes, even convergent ones.
  // `--pull` is a hard no-external-writes boundary. Pending outbound intents
  // remain durable and replay on the next full sync; replaying them here would
  // make an apparently inbound-only command mutate the provider.
  if (!dryRun && !inboundOnly) {
    const replay = await replayIntents(
      dataSyncDir,
      provider,
      adapter,
      {
        blockedExternalIds,
        blockedBeadIds,
        shouldReplay: (op) => {
          const bead = issuesById.get(op.bead_id);
          const externalId = op.kind === 'create_issue' ? op.client_id : op.external_id;
          if (!bead || readLink(bead, provider)?.id !== externalId) {
            return false;
          }
          if (op.kind !== 'post_comment') {
            return true;
          }
          const entry = readComments(bead, provider).find(
            (comment) => comment.local_id === op.local_id,
          );
          return entry !== undefined && entry.id === undefined;
        },
      },
      async ({ recoveredCreates, recoveredComments }) => {
        let recoveryDirty = false;
        for (const recovered of recoveredCreates) {
          const bead = await callbacks.readBead(recovered.beadId).catch(() => undefined);
          const existingLink = bead ? readLink(bead, provider) : undefined;
          if (bead && (!existingLink || existingLink.id === recovered.externalId)) {
            const recoveredIssues = await adapter.fetchIssues([recovered.externalId]);
            recordMappingWarnings(recoveredIssues);
            const [current] = recoveredIssues;
            const repaired = writeLink(bead, {
              provider,
              id: recovered.externalId,
              key: current?.key ?? existingLink?.key ?? null,
              url: current?.url ?? existingLink?.url ?? null,
              linked_at: existingLink?.linked_at ?? options.now(),
            });
            if (
              JSON.stringify(repaired.extensions?.[provider]) !==
              JSON.stringify(bead.extensions?.[provider])
            ) {
              repaired.version += 1;
              repaired.updated_at = options.now();
              await callbacks.writeBead(repaired);
              recoveryDirty = true;
            }
            issuesById.set(repaired.id, repaired);
          } else if (bead) {
            issuesById.set(bead.id, bead);
          }
        }
        for (const recovered of recoveredComments) {
          const bead = await callbacks.readBead(recovered.beadId);
          const entry = readComments(bead, provider).find(
            (comment) => comment.local_id === recovered.localId,
          );
          if (!entry) {
            throw new Error(
              `Could not record replayed ${provider} comment ${recovered.localId}: local entry is missing`,
            );
          }
          if (entry.id && entry.id !== recovered.commentId) {
            throw new Error(
              `Could not record replayed ${provider} comment ${recovered.localId}: ` +
                `local entry already points to ${entry.id}`,
            );
          }
          if (entry.id === recovered.commentId) {
            issuesById.set(bead.id, bead);
            continue;
          }
          const repaired = recordPushedComment(
            bead,
            provider,
            recovered.localId,
            recovered.commentId,
          );
          repaired.version += 1;
          repaired.updated_at = options.now();
          await callbacks.writeBead(repaired);
          issuesById.set(repaired.id, repaired);
          recoveryDirty = true;
        }
        if (recoveryDirty) {
          // Commit the recovered local identities while the write-ahead file
          // still exists. A crash before cleanup therefore replays safely;
          // it can never lose the only mapping back to the local comment.
          await callbacks.afterJournal();
        }
      },
    );
    report.replayedOps = replay.replayedOps;
    for (const conflict of replay.replayedConflicts) {
      replayedConflictReports.set(conflictSignature(conflict), conflict);
    }
    for (const failure of replay.failures) {
      report.failures.push({ beadId: failure.runId, error: failure.error });
    }
  }

  // A create intent plus the bead's matching client-UUID link is a pending
  // relationship, not an orphan. This remains true in pull-only mode (which
  // deliberately does not replay provider writes) and after a failed replay.
  // Derive it from the durable journal under the shared data-sync lock rather
  // than inventing a second provisional-state flag in the bead or bridge.
  const pendingCreateClaims = new Map<string, IntentPatch>();
  for (const file of await listIntentFiles(dataSyncDir, provider)) {
    for (const op of file.ops) {
      if (op.kind === 'create_issue') {
        pendingCreateClaims.set(JSON.stringify([op.bead_id, op.client_id]), op.patch);
      }
    }
  }
  const pendingCreatePatch = (bead: Issue, externalId: string): IntentPatch | undefined =>
    pendingCreateClaims.get(JSON.stringify([bead.id, externalId]));

  // 2. Assemble the linked set and the remote view.
  const currentIssues = [...issuesById.values()];
  const readyIds = readyIssueIds(currentIssues);
  const childrenByParent = new Map<string, Issue[]>();
  for (const issue of currentIssues) {
    if (!issue.parent_id) {
      continue;
    }
    const children = childrenByParent.get(issue.parent_id) ?? [];
    children.push(issue);
    childrenByParent.set(issue.parent_id, children);
  }
  const mirrorExtrasFor = (issue: Issue) => {
    const displayId = options.displayId(issue.id);
    const links: MirrorLinks = { specUrl: options.specUrl?.(issue), repoUrl: undefined };
    const children = childrenByParent.get(issue.id) ?? [];
    const counts = {
      children: children.length,
      ready: children.filter((child) => readyIds.has(child.id)).length,
    };
    return {
      attachments: attachmentsFor(issue, displayId, links, counts),
      block: renderManagedBlock(issue, links, counts, displayId),
    };
  };
  const outboundSelected = mirrorSet(currentIssues, policy.outbound, provider);
  const outboundSelectedIds = new Set(outboundSelected.map((issue) => issue.id));
  const maxNesting = options.maxNesting ?? 2;
  const outboundDepth = new Map(
    outboundSelected.map((issue) => [
      issue.id,
      depthWithinSelection(issue, outboundSelectedIds, issuesById),
    ]),
  );
  const allLinked = currentIssues.filter((issue) => readLink(issue, provider));
  const linked = allLinked.filter((issue) => !blockedBeadIds.has(issue.id));
  const records = await listLinkRecords(dataSyncDir, provider);
  const recordByBead = new Map(records.map((record) => [record.bead_id, record]));

  const since = overlappedWatermark(pullWatermark(records));
  const delta = since ? await adapter.fetchUpdatedSince(since) : [];
  recordMappingWarnings(delta);
  const remoteById = new Map(delta.map((issue) => [issue.id, issue]));

  // Every linked pair absent from the delta gets one batched liveness fetch.
  // Linear does not advance `updatedAt` when an item is archived, and ordinary
  // connection queries omit archived items, so checking only locally-moved
  // pairs would leave a quiet archived/deleted link invisible forever.
  const missingIds: string[] = [];
  for (const bead of linked) {
    const link = readLink(bead, provider)!;
    if (!remoteById.has(link.id)) {
      missingIds.push(link.id);
    }
  }
  const missingIssues = await adapter.fetchIssues(missingIds);
  recordMappingWarnings(missingIssues);
  for (const issue of missingIssues) {
    remoteById.set(issue.id, issue);
  }

  // 3. Reconcile every pair whose remote we have in hand.
  const pairs: PlannedPair[] = [];
  for (const bead of linked) {
    const link = readLink(bead, provider)!;
    const remote = remoteById.get(link.id);
    if (!remote) {
      if (pendingCreatePatch(bead, link.id)) {
        continue;
      }
      const record = recordByBead.get(bead.id);
      if (!dryRun && record && record.state !== 'orphaned') {
        await writeLinkRecord(dataSyncDir, provider, { ...record, state: 'orphaned' });
      }
      report.orphaned.push(options.displayId(bead.id));
      continue;
    }
    if (remote.archivedAt || remote.trashed) {
      const record = recordByBead.get(bead.id);
      if (!dryRun && record && record.state !== 'orphaned') {
        await writeLinkRecord(dataSyncDir, provider, { ...record, state: 'orphaned' });
      }
      report.orphaned.push(options.displayId(bead.id));
      continue;
    }
    const record = recordByBead.get(bead.id);
    // A live pending create has an exact creation snapshot in its journal even
    // before the first bridge record exists. Use that snapshot as the base so
    // tracker edits made during an attachment/splice failure window still pull
    // (or conflict) correctly. Fields the create surface does not write use
    // their known creation defaults, not a possibly edited first observation.
    const createPatch = pendingCreatePatch(bead, link.id);
    const pendingCreateBase: LinkRecord['base'] | undefined = createPatch
      ? {
          title: createPatch.title ?? remote.title,
          status: (createPatch.status as Issue['status'] | undefined) ?? remote.status,
          priority: createPatch.priority ?? remote.priority,
          labels: createPatch.labels ?? [],
          assignee: null,
          description_hash: descriptionHash(
            Object.hasOwn(createPatch, 'description') ? (createPatch.description ?? null) : null,
          ),
        }
      : undefined;
    // Any other link with no bridge record predates the sync engine (a Phase 1
    // mirror link, or a record lost to damage). Those links lived under a
    // one-way regime where the bead was the truth, so the base seeds from the
    // REMOTE snapshot: local divergence pushes, nothing pulls, and no phantom
    // conflicts fire on the first synchronization.
    const base =
      record?.base ??
      pendingCreateBase ??
      (() => {
        const remoteProse = remoteViewOf(remote);
        return {
          title: remoteProse.title,
          status: remoteProse.status,
          priority: remoteProse.priority,
          labels: remoteProse.labels,
          assignee: remoteProse.assignee,
          description_hash: descriptionHash(remote.description),
        };
      })();
    const result = reconcile(
      base,
      localViewOf(bead),
      remoteViewOf(remote),
      policy.field_sync,
      options.equivalences,
      {
        assignee: adapter.canPushAssignee(bead.assignee ?? null),
        assigneePull: remote.assigneeSyncable !== false,
      },
    );
    if (!options.mirrorLabels) {
      // Labels are inert unless explicitly mirrored: never pushed (which would
      // create one team label per bead label AND wipe tbd's status carriers on
      // beads without labels), never pulled, never a reportable overwrite.
      delete result.externalPatch.labels;
      delete result.beadPatch.labels;
      result.overwrites = result.overwrites.filter((o) => o.field !== 'labels');
      result.conflicts = result.conflicts.filter((c) => c.field !== 'labels');
      result.merged.labels = bead.labels ?? [];
    } else if (result.externalPatch.labels) {
      result.externalPatch.labels = prefixLabels(result.externalPatch.labels);
    }
    let parentOverwrite = false;
    const localParent = bead.parent_id ? issuesById.get(bead.parent_id) : undefined;
    const expectedParentId = bead.parent_id
      ? localParent && !blockedBeadIds.has(localParent.id)
        ? readLink(localParent, provider)?.id
        : undefined
      : null;
    if (expectedParentId !== undefined && expectedParentId !== (remote.parent?.id ?? null)) {
      result.externalPatch.parentId = expectedParentId;
      parentOverwrite = true;
    }
    pairs.push({ bead, record, remote, result, parentOverwrite });
  }

  // Comment planning. All linked pairs with a remote in hand participate;
  // ordering is per-comment `at`, and identity dedup makes replays safe.
  const commentsMode = policy.field_sync.comments;
  const commentPulls: { bead: Issue; externalId: string }[] = [];
  const commentPushes: { bead: Issue; externalId: string }[] = [];
  if (commentsMode !== 'off') {
    for (const pair of pairs) {
      const link = readLink(pair.bead, provider)!;
      if (commentsMode !== 'outbound') {
        commentPulls.push({ bead: pair.bead, externalId: link.id });
      }
      if (
        !inboundOnly &&
        commentsMode !== 'inbound' &&
        unpushedComments(pair.bead, provider).length > 0
      ) {
        commentPushes.push({ bead: pair.bead, externalId: link.id });
      }
    }
  }

  // Outbound-new: policy-selected beads with no link yet. An inbound-only run
  // creates nothing outward; it reports what it declined to create instead.
  const skippedOutbound = inboundOnly
    ? []
    : outboundSelected.filter(
        (issue) => !readLink(issue, provider) && (outboundDepth.get(issue.id) ?? 1) > maxNesting,
      );
  const outboundNew = inboundOnly
    ? []
    : orderBeadsParentFirst(
        outboundSelected.filter(
          (issue) => !readLink(issue, provider) && (outboundDepth.get(issue.id) ?? 1) <= maxNesting,
        ),
      );
  report.skippedOutbound = skippedOutbound.map((issue) => ({
    beadId: options.displayId(issue.id),
    reason: `nested ${outboundDepth.get(issue.id)} levels, past max_nesting ${maxNesting}`,
  }));

  // Inbound: unlinked externals in scope. The delta covers recently-touched
  // items; a full scan happens only when there is no watermark yet.
  const inbound = policy.inbound;
  const linkedExternalIds = new Set(
    allLinked.map((bead) => readLink(bead, provider)!.id).concat(records.map((r) => r.external_id)),
  );
  const explicitlySelected = options.externalIssueIds !== undefined;
  const effectiveInboundMode = explicitlySelected ? 'auto' : inbound.mode;
  const inboundPool = explicitlySelected
    ? await adapter.fetchIssues([...new Set(options.externalIssueIds)])
    : inbound.mode === 'off'
      ? []
      : since
        ? delta
        : await adapter.fetchUpdatedSince('1970-01-01T00:00:00.000Z');
  recordMappingWarnings(inboundPool);
  const inboundCandidates = inboundPool.filter(
    (issue) =>
      !linkedExternalIds.has(issue.id) &&
      !issue.archivedAt &&
      !issue.trashed &&
      (explicitlySelected ||
        inbound.labels.length === 0 ||
        issue.labels.some((label) => inbound.labels.includes(label))),
  );
  const importCandidates: ExternalIssue[] = [];
  if (effectiveInboundMode === 'auto') {
    for (const candidate of inboundCandidates) {
      try {
        await assertExternalUnclaimed(
          adapter,
          candidate.id,
          candidate.key ?? candidate.id,
          options.allowClaimedExternal === true,
        );
        importCandidates.push(candidate);
      } catch (error) {
        report.failures.push({
          beadId: candidate.key ?? candidate.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  const existingParentLinks = new Map(
    linked.map((bead) => [readLink(bead, provider)!.id, bead.id] as const),
  );
  const candidates = effectiveInboundMode === 'auto' ? importCandidates : inboundCandidates;
  const importPlan = orderInboundCandidates(candidates, new Set(existingParentLinks.keys()));
  for (const failure of importPlan.failures) {
    report.failures.push({
      beadId: failure.candidate.key ?? failure.candidate.id,
      error: failure.error,
    });
  }

  // The managed region is a projection, not a merge-owned description field.
  // Re-splice it after any prose write, and backfill or refresh it when the
  // provider snapshot differs. Inbound-only runs never write provider chrome.
  const managedBlocks = new Map<string, string>();
  const malformedManagedBeads = new Set<string>();
  for (const pair of pairs) {
    const projectedBead: Issue = {
      ...pair.bead,
      title: pair.result.merged.title,
      status: pair.result.merged.status,
      priority: pair.result.merged.priority,
      labels: pair.result.merged.labels,
      assignee: pair.result.merged.assignee ?? undefined,
    };
    const block = mirrorExtrasFor(projectedBead).block;
    const spliced = spliceManagedBlock(pair.remote.description, block);
    if ('error' in spliced) {
      malformedManagedBeads.add(pair.bead.id);
      report.failures.push({
        beadId: options.displayId(pair.bead.id),
        error: `Managed block markers in ${pair.remote.key ?? pair.remote.id} are malformed; skipped all writes for this pair.`,
      });
      continue;
    }
    if (
      !inboundOnly &&
      (pair.result.externalPatch.description !== undefined ||
        spliced.result !== pair.remote.description)
    ) {
      managedBlocks.set(pair.bead.id, block);
    }
  }
  const synchronizablePairs = pairs.filter((pair) => !malformedManagedBeads.has(pair.bead.id));
  const synchronizableBeadIds = new Set(synchronizablePairs.map((pair) => pair.bead.id));
  const synchronizableCommentPushes = commentPushes.filter((push) =>
    synchronizableBeadIds.has(push.bead.id),
  );
  const synchronizableCommentPulls = commentPulls.filter((pull) =>
    synchronizableBeadIds.has(pull.bead.id),
  );

  // 4. The guard counts both directions.
  const externalUpdates = synchronizablePairs.filter(
    (pair) => Object.keys(pair.result.externalPatch).length > 0 || managedBlocks.has(pair.bead.id),
  ).length;
  const beadUpdates = synchronizablePairs.filter(
    (pair) => Object.keys(pair.result.beadPatch).length > 0,
  ).length;
  const creates =
    outboundNew.length + (effectiveInboundMode === 'auto' ? importPlan.ordered.length : 0);
  const updates = externalUpdates + beadUpdates + synchronizableCommentPushes.length;
  if (!dryRun && (creates > 0 || updates > 0)) {
    await callbacks.affirmBulk({ creates, updates });
  }

  if (dryRun) {
    // Report what would happen; nothing below runs.
    for (const pair of synchronizablePairs) {
      const id = options.displayId(pair.bead.id);
      if (Object.keys(pair.result.externalPatch).length > 0 || managedBlocks.has(pair.bead.id)) {
        report.pushed.push(id);
      }
      if (Object.keys(pair.result.beadPatch).length > 0) {
        report.pulled.push(id);
      }
      for (const conflict of pair.result.conflicts) {
        report.conflicts.push({ beadId: id, field: conflict.field, winner: conflict.winner });
      }
      for (const overwrite of pair.result.overwrites) {
        report.overwrites.push({
          beadId: id,
          field: overwrite.field,
          direction: overwrite.direction,
        });
      }
      if (pair.parentOverwrite) {
        report.overwrites.push({ beadId: id, field: 'parent', direction: 'push' });
      }
    }
    for (const push of synchronizableCommentPushes) {
      report.commentsPushed += unpushedComments(push.bead, provider).length;
    }
    for (const pull of synchronizableCommentPulls) {
      try {
        const external = (await adapter.listComments(pull.externalId)).filter(
          (comment) => !comment.body.startsWith(CONFLICT_COMMENT_MARKER),
        );
        report.commentsPulled += mergeExternalComments(pull.bead, provider, external).added;
      } catch (error) {
        report.failures.push({
          beadId: options.displayId(pull.bead.id),
          error: `Could not preview tracker comments: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    }
    report.createdOutbound = outboundNew.map((issue) => options.displayId(issue.id));
    if (effectiveInboundMode !== 'off') {
      report.importable = importPlan.ordered.map((issue) => ({
        id: issue.id,
        key: issue.key,
        title: issue.title,
      }));
    }
    report.nothingToDo =
      report.pushed.length + report.pulled.length + report.conflicts.length === 0 &&
      report.createdOutbound.length === 0 &&
      report.importable.length === 0 &&
      report.failures.length === 0 &&
      report.warnings.length === 0 &&
      report.skippedOutbound.length === 0 &&
      report.commentsPulled + report.commentsPushed === 0;
    return report;
  }

  // A conflict must be recoverable before either side is overwritten or a
  // provider comment advertises the archive path. Replayed remote-win reports
  // reuse their already-committed archive and client-id-deduped comment rather
  // than creating a second artifact/comment before this run advances the base.
  const conflictPlans = new Map<
    string,
    { report: ConflictReport; clientId?: string; needsPost: boolean }[]
  >();
  const deferredConflictOps: IntentOp[] = [];
  const executablePairs: PlannedPair[] = [];
  for (const pair of synchronizablePairs) {
    const displayId = options.displayId(pair.bead.id);
    try {
      const plans: { report: ConflictReport; clientId?: string; needsPost: boolean }[] = [];
      for (const conflict of pair.result.conflicts) {
        const provisional = conflictReportOf(displayId, conflict, 'pending');
        const replayed = replayedConflictReports.get(conflictSignature(provisional));
        if (replayed) {
          plans.push({ report: replayed, needsPost: false });
          continue;
        }
        const lostValue = conflict.winner === 'local' ? conflict.remoteValue : conflict.localValue;
        const atticPath = await callbacks.archiveConflict({
          beadId: pair.bead.id,
          field: conflict.field,
          lostValue,
          winnerSource: conflict.winner,
          localVersion: pair.bead.version,
          localUpdatedAt: pair.bead.updated_at,
          remoteUpdatedAt: pair.remote.updatedAt,
        });
        const conflictReport = conflictReportOf(displayId, conflict, atticPath);
        const clientId = randomUUID();
        if (inboundOnly) {
          const link = readLink(pair.bead, provider)!;
          deferredConflictOps.push({
            kind: 'post_conflict',
            bead_id: pair.bead.id,
            external_id: link.id,
            comment_client_id: clientId,
            report: conflictReport,
          });
        }
        plans.push({
          report: conflictReport,
          clientId,
          needsPost: !inboundOnly,
        });
      }
      conflictPlans.set(pair.bead.id, plans);
      executablePairs.push(pair);
    } catch (error) {
      report.failures.push({
        beadId: displayId,
        error: `Could not archive tracker conflict: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }

  if (deferredConflictOps.length > 0) {
    await writeIntentFile(dataSyncDir, {
      type: 'in',
      run_id: ulid().toLowerCase(),
      provider,
      created_at: options.now(),
      ops: deferredConflictOps,
    });
  }

  // 5. Journal every planned external write.
  const runId = ulid().toLowerCase();
  const ops: IntentOp[] = [];
  const outboundClientIds = new Map<string, string>();
  const outboundParentIds = new Map<string, string>();
  const outboundExtras = new Map<
    string,
    { attachments: ReturnType<typeof attachmentsFor>; block: string | null }
  >();
  for (const issue of outboundNew) {
    outboundClientIds.set(issue.id, randomUUID());
  }
  for (const issue of outboundNew) {
    const parent = issue.parent_id ? issuesById.get(issue.parent_id) : undefined;
    const parentExternalId = parent
      ? (readLink(parent, provider)?.id ?? outboundClientIds.get(parent.id))
      : undefined;
    if (parentExternalId) {
      outboundParentIds.set(issue.id, parentExternalId);
    }
  }
  for (const issue of outboundNew) {
    const clientId = outboundClientIds.get(issue.id)!;
    const { attachments, block } = mirrorExtrasFor(issue);
    outboundExtras.set(issue.id, { attachments, block });
    ops.push({
      kind: 'create_issue',
      client_id: clientId,
      bead_id: issue.id,
      patch: {
        title: issue.title,
        ...(issue.description != null ? { description: issue.description } : {}),
        status: issue.status,
        priority: issue.priority,
        ...(adapter.canPushAssignee(issue.assignee ?? null)
          ? { assignee: issue.assignee ?? null }
          : {}),
        ...(outboundParentIds.has(issue.id) ? { parentId: outboundParentIds.get(issue.id) } : {}),
      },
    });
    // The client UUID IS the item's id, so the follow-up writes are journaled
    // against it before the item exists. Both replay-safe: attachments upsert
    // on url, the splice is idempotent on content.
    ops.push({
      kind: 'upsert_attachments',
      bead_id: issue.id,
      external_id: clientId,
      attachments,
    });
    if (block) {
      ops.push({ kind: 'splice_description', bead_id: issue.id, external_id: clientId, block });
    }
  }
  for (const pair of executablePairs) {
    const hasExternalPatch = Object.keys(pair.result.externalPatch).length > 0;
    if (!inboundOnly && hasExternalPatch) {
      const link = readLink(pair.bead, provider)!;
      ops.push({
        kind: 'update_issue',
        bead_id: pair.bead.id,
        external_id: link.id,
        patch: pair.result.externalPatch as IntentPatch,
      });
    }
    const link = readLink(pair.bead, provider)!;
    const managedBlock = managedBlocks.get(pair.bead.id);
    if (managedBlock) {
      ops.push({
        kind: 'splice_description',
        bead_id: pair.bead.id,
        external_id: link.id,
        block: managedBlock,
      });
    }
    for (const plan of conflictPlans.get(pair.bead.id) ?? []) {
      if (plan.needsPost) {
        ops.push({
          kind: 'post_conflict',
          bead_id: pair.bead.id,
          external_id: link.id,
          comment_client_id: plan.clientId!,
          report: plan.report,
        });
      }
    }
  }
  const commentClientIds = new Map<string, string>();
  const executableBeadIds = new Set(executablePairs.map((pair) => pair.bead.id));
  for (const push of synchronizableCommentPushes) {
    if (!executableBeadIds.has(push.bead.id)) {
      continue;
    }
    for (const entry of unpushedComments(push.bead, provider)) {
      const clientId = randomUUID();
      commentClientIds.set(`${push.bead.id}:${entry.local_id}`, clientId);
      ops.push({
        kind: 'post_comment',
        external_id: push.externalId,
        bead_id: push.bead.id,
        local_id: entry.local_id!,
        comment_client_id: clientId,
        body: entry.body,
      });
    }
  }
  // Which work is covered by THIS run's journal — so cleanup can be decided
  // by ITS failures alone, not by replay failures from older files (which
  // keep their own files) or by pull-side failures (which are re-planned from
  // current state and need no journal).
  const journaledExternalIds = new Set(
    ops.flatMap((op) => ('external_id' in op ? [op.external_id] : [])),
  );
  const journaledCommentBeads = new Set(synchronizableCommentPushes.map((push) => push.bead.id));
  let journalDirty = false;

  if (ops.length > 0) {
    await writeIntentFile(dataSyncDir, {
      type: 'in',
      run_id: runId,
      provider,
      created_at: options.now(),
      ops,
    });
    // A create's client UUID is already its future external id. Persist that
    // provisional relationship in the same journal epoch before provider I/O:
    // replay can then distinguish a live pending create from one superseded by
    // explicit unlink, including after a cross-machine journal merge.
    for (const issue of outboundNew) {
      const clientId = outboundClientIds.get(issue.id)!;
      let stored = await callbacks.readBead(issue.id);
      stored = writeLink(stored, {
        provider,
        id: clientId,
        linked_at: options.now(),
      });
      stored.version += 1;
      stored.updated_at = options.now();
      await callbacks.writeBead(stored);
      issuesById.set(stored.id, stored);
    }
    await callbacks.afterJournal();
  }

  // 6. Apply, per-pair containment.
  for (const pair of executablePairs) {
    const displayId = options.displayId(pair.bead.id);
    const link = readLink(pair.bead, provider)!;
    try {
      let postWriteUpdatedAt = pair.remote.updatedAt;
      const hasExternalPatch = Object.keys(pair.result.externalPatch).length > 0;

      if (!inboundOnly && hasExternalPatch) {
        const { updatedAt } = await adapter.applyChanges(link.id, pair.result.externalPatch);
        postWriteUpdatedAt = updatedAt;
        report.pushed.push(displayId);
      }
      const managedBlock = managedBlocks.get(pair.bead.id);
      if (managedBlock) {
        const result = await adapter.spliceDescription(link.id, managedBlock);
        if (result) {
          postWriteUpdatedAt = result.updatedAt;
          if (!hasExternalPatch) {
            report.pushed.push(displayId);
          }
        }
      }

      // Conflict artifacts: a comment per conflicted field, exactly-once. An
      // inbound-only run writes nothing outward, so it reports the conflict
      // without posting; the next full sync posts it.
      for (const [index, conflict] of pair.result.conflicts.entries()) {
        if (inboundOnly) {
          report.conflicts.push({
            beadId: displayId,
            field: conflict.field,
            winner: conflict.winner,
          });
          continue;
        }
        const plan = conflictPlans.get(pair.bead.id)?.[index];
        if (!plan) {
          throw new Error(`Missing archived conflict plan for ${conflict.field}`);
        }
        if (plan.needsPost) {
          await adapter.postConflict(link.id, plan.report, plan.clientId);
        }
        report.conflicts.push({
          beadId: displayId,
          field: conflict.field,
          winner: conflict.winner,
        });
      }
      for (const overwrite of pair.result.overwrites) {
        if (inboundOnly && overwrite.direction === 'push') {
          continue;
        }
        report.overwrites.push({
          beadId: displayId,
          field: overwrite.field,
          direction: overwrite.direction,
        });
      }
      if (pair.parentOverwrite && !inboundOnly) {
        report.overwrites.push({ beadId: displayId, field: 'parent', direction: 'push' });
      }
      for (const skipped of pair.result.skippedPushes) {
        report.skippedPushes.push({ beadId: displayId, field: skipped.field });
      }

      // Bead-side changes ride the normal write path via the caller.
      let stored = await callbacks.readBead(pair.bead.id);
      let dirty = false;
      const patch = pair.result.beadPatch;
      if (Object.keys(patch).length > 0) {
        stored = {
          ...stored,
          ...(patch.title !== undefined ? { title: patch.title } : {}),
          ...(patch.description !== undefined ? { description: patch.description } : {}),
          ...(patch.status !== undefined ? { status: patch.status } : {}),
          ...(patch.priority !== undefined ? { priority: patch.priority } : {}),
          ...(patch.labels !== undefined ? { labels: patch.labels } : {}),
          ...(patch.assignee !== undefined ? { assignee: patch.assignee } : {}),
        };
        dirty = true;
        report.pulled.push(displayId);
      }

      // Comments: push local-authored, then fold in the remote sequence.
      if (synchronizableCommentPushes.some((push) => push.bead.id === pair.bead.id)) {
        for (const entry of unpushedComments(stored, provider)) {
          const clientId =
            commentClientIds.get(`${pair.bead.id}:${entry.local_id}`) ?? randomUUID();
          const { commentId } = await adapter.createComment(link.id, entry.body, clientId);
          stored = recordPushedComment(stored, provider, entry.local_id!, commentId);
          dirty = true;
          report.commentsPushed += 1;
        }
      }
      if (synchronizableCommentPulls.some((pull) => pull.bead.id === pair.bead.id)) {
        const external = (await adapter.listComments(link.id)).filter(
          (comment) => !comment.body.startsWith(CONFLICT_COMMENT_MARKER),
        );
        const mergedComments = mergeExternalComments(stored, provider, external);
        if (mergedComments.added > 0) {
          stored = mergedComments.issue;
          dirty = true;
          report.commentsPulled += mergedComments.added;
        }
      }

      if (dirty) {
        stored.version += 1;
        stored.updated_at = options.now();
        await callbacks.writeBead(stored);
      }

      // Base advance: only now, after every write above landed. An inbound-only
      // run advances the base only when it pushed nothing that the base would
      // then claim — a suppressed outbound change must stay pending, so the
      // record keeps its previous base and the next full sync still pushes.
      if (inboundOnly && Object.keys(pair.result.externalPatch).length > 0) {
        continue;
      }
      await writeLinkRecord(dataSyncDir, provider, {
        type: 'lk',
        bead_id: pair.bead.id,
        external_id: link.id,
        base: {
          title: pair.result.merged.title,
          status: pair.result.merged.status,
          priority: pair.result.merged.priority,
          labels: pair.result.merged.labels,
          assignee: pair.result.merged.assignee,
          description_hash: pair.result.merged.description_hash,
        },
        remote_updated_at: postWriteUpdatedAt,
        synced_at: options.now(),
        state: 'linked',
      });
    } catch (error) {
      if (journaledExternalIds.has(link.id) || journaledCommentBeads.has(pair.bead.id)) {
        journalDirty = true;
      }
      report.failures.push({
        beadId: displayId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // 7a. Outbound-new creates.
  for (const issue of outboundNew) {
    const displayId = options.displayId(issue.id);
    try {
      const clientId = outboundClientIds.get(issue.id);
      const parentExternalId = outboundParentIds.get(issue.id);
      const ref = await adapter.createIssue(
        {
          title: issue.title,
          ...(issue.description != null ? { description: issue.description } : {}),
          status: issue.status,
          priority: issue.priority,
          ...(adapter.canPushAssignee(issue.assignee ?? null)
            ? { assignee: issue.assignee ?? null }
            : {}),
          ...(parentExternalId ? { parentId: parentExternalId } : {}),
        },
        clientId,
      );

      let stored = await callbacks.readBead(issue.id);
      stored = writeLink(stored, {
        provider,
        id: ref.id,
        key: ref.key ?? null,
        url: ref.url ?? null,
        linked_at: options.now(),
      });
      stored.version += 1;
      stored.updated_at = options.now();
      await callbacks.writeBead(stored);

      const extras = outboundExtras.get(issue.id);
      if (extras) {
        await adapter.upsertAttachments(ref.id, extras.attachments);
        if (extras.block) {
          await adapter.spliceDescription(ref.id, extras.block);
        }
      }

      const [current] = await adapter.fetchIssues([ref.id]);
      await writeLinkRecord(dataSyncDir, provider, {
        type: 'lk',
        bead_id: issue.id,
        external_id: ref.id,
        base: {
          title: issue.title,
          status: issue.status,
          priority: issue.priority,
          labels: issue.labels ?? [],
          assignee: current?.assignee ?? null,
          description_hash: descriptionHash(issue.description ?? null),
        },
        remote_updated_at: current?.updatedAt ?? options.now(),
        synced_at: options.now(),
        state: 'linked',
      });
      report.createdOutbound.push(displayId);
    } catch (error) {
      journalDirty = true;
      report.failures.push({
        beadId: displayId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // 7b. Inbound: preserve provider hierarchy. A child is never silently
  // flattened: its parent must already be linked locally or be imported first
  // in this same batch.
  for (const candidate of importPlan.ordered) {
    if (effectiveInboundMode === 'report') {
      report.importable.push({ id: candidate.id, key: candidate.key, title: candidate.title });
      continue;
    }
    const localParentId = candidate.parent
      ? existingParentLinks.get(candidate.parent.id)
      : undefined;
    if (candidate.parent && !localParentId) {
      report.failures.push({
        beadId: candidate.key ?? candidate.id,
        error: unavailableParentError(candidate),
      });
      continue;
    }
    try {
      const created = await importExternal(
        candidate,
        inbound,
        provider,
        options,
        !inboundOnly,
        localParentId,
      );
      report.importedInbound.push(options.displayId(created.id));
      existingParentLinks.set(candidate.id, created.id);
    } catch (error) {
      report.failures.push({
        beadId: candidate.key ?? candidate.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // 8. Consume the journal when everything IT covered landed. Only failures
  // of journaled work keep the file — replay failures belong to older files
  // (which keep themselves), and pull-side failures are re-planned from
  // current state. Kept files replay next run; every journaled op is
  // idempotent or replay-converts, so repeating successes is harmless while
  // failures get their retry.
  if (ops.length > 0 && !journalDirty) {
    await deleteIntentFile(dataSyncDir, provider, runId);
  }

  report.nothingToDo =
    report.replayedOps === 0 &&
    report.pushed.length +
      report.pulled.length +
      report.conflicts.length +
      report.commentsPulled +
      report.commentsPushed +
      report.orphaned.length +
      report.createdOutbound.length +
      report.importedInbound.length +
      report.importable.length +
      report.skippedOutbound.length +
      report.warnings.length +
      report.failures.length ===
      0;
  return report;
}

/** Create a bead from an external item: canonical fields only, base seeded. */
async function importExternal(
  candidate: ExternalIssue,
  inbound: InboundClause,
  provider: ProviderNameType,
  options: SyncEngineOptions,
  writeExternalClaim: boolean,
  parentId?: string,
): Promise<Issue> {
  const created = await options.callbacks.createBead({
    title: candidate.title,
    description: candidate.description,
    status: candidate.status,
    priority: candidate.priority,
    kind: inbound.as_kind,
    parentId,
    ...(candidate.assignee !== null && options.adapter.canPushAssignee(candidate.assignee)
      ? { assignee: candidate.assignee }
      : {}),
  });

  const stored = writeLink(created, {
    provider,
    id: candidate.id,
    key: candidate.key ?? null,
    url: candidate.url ?? null,
    linked_at: options.now(),
  });
  stored.version += 1;
  stored.updated_at = options.now();
  await options.callbacks.writeBead(stored);

  const claim = {
    url: beadAttachmentUrl(options.displayId(created.id)),
    title: `${options.displayId(created.id)} · ${inbound.as_kind}`,
    subtitle: `${candidate.status} · P${candidate.priority}`,
  };
  await writeLinkRecord(options.dataSyncDir, provider, {
    type: 'lk',
    bead_id: created.id,
    external_id: candidate.id,
    base: {
      title: candidate.title,
      status: candidate.status,
      priority: candidate.priority,
      labels: [],
      assignee:
        candidate.assignee !== null && options.adapter.canPushAssignee(candidate.assignee)
          ? candidate.assignee
          : null,
      description_hash: descriptionHash(candidate.description),
    },
    remote_updated_at: candidate.updatedAt,
    synced_at: options.now(),
    state: 'linked',
  });

  // The ownership marker is part of the import transaction, including for a
  // normal full sync. Persist the bead, link record, and claim intent before
  // touching the provider so a transport failure is replayable without
  // creating a second bead. Pull-only runs intentionally leave this same
  // intent for the next full sync, preserving their no-provider-writes rule.
  const claimRunId = ulid().toLowerCase();
  await writeIntentFile(options.dataSyncDir, {
    type: 'in',
    run_id: claimRunId,
    provider,
    created_at: options.now(),
    ops: [
      {
        kind: 'upsert_attachments',
        bead_id: created.id,
        external_id: candidate.id,
        attachments: [claim],
      },
    ],
  });
  await options.callbacks.afterJournal();

  if (writeExternalClaim) {
    await options.adapter.upsertAttachments(candidate.id, [claim]);
    await deleteIntentFile(options.dataSyncDir, provider, claimRunId);
  }
  return stored;
}
