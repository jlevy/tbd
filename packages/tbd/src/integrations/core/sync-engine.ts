/**
 * The full synchronization: apply the whole linking policy for one provider.
 *
 * Order matters and each step is deliberate:
 *
 * 1. **Replay** pending intents (this machine's or another's) so nothing is in
 *    flight before new work is planned.
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
import {
  descriptionHash,
  listLinkRecords,
  pullWatermark,
  writeLinkRecord,
} from './bridge-state.js';
import { mergeExternalComments, recordPushedComment, unpushedComments } from './comment-store.js';
import { readLink, writeLink } from './link-store.js';
import { renderManagedBlock, type MirrorLinks } from './managed-block.js';
import { attachmentsFor, beadAttachmentUrl } from './mirror.js';
import { reconcile, type FieldConflict, type LocalView, type RemoteView } from './reconcile.js';
import { mirrorSet } from './selection.js';
import {
  replayIntents,
  writeIntentFile,
  deleteIntentFile,
  type IntentOp,
  type IntentPatch,
} from './intents.js';
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
  }): Promise<Issue>;
  /** Commit the journaled intents before any external write happens. */
  afterJournal(): Promise<void>;
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
  commentsPulled: number;
  commentsPushed: number;
  orphaned: string[];
  createdOutbound: string[];
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

/** Run the full synchronization for one provider. */
export async function runSync(options: SyncEngineOptions): Promise<SyncRunReport> {
  const { adapter, provider, policy, dataSyncDir, callbacks, dryRun } = options;
  const report: SyncRunReport = {
    provider,
    replayedOps: 0,
    pushed: [],
    pulled: [],
    conflicts: [],
    overwrites: [],
    skippedPushes: [],
    commentsPulled: 0,
    commentsPushed: 0,
    orphaned: [],
    createdOutbound: [],
    importedInbound: [],
    importable: [],
    failures: [],
    nothingToDo: false,
  };

  // 1. Replay anything a crashed run left behind. Never during a dry run: a
  // preview must not perform writes, even convergent ones.
  if (!dryRun) {
    const replay = await replayIntents(dataSyncDir, provider, adapter);
    report.replayedOps = replay.replayedOps;
    for (const recovered of replay.recoveredCreates) {
      // A recovered create may have beaten the link write; repair it.
      const bead = await callbacks.readBead(recovered.beadId).catch(() => undefined);
      if (bead && !readLink(bead, provider)) {
        const [current] = await adapter.fetchIssues([recovered.externalId]);
        const repaired = writeLink(bead, {
          provider,
          id: recovered.externalId,
          key: current?.key ?? null,
          url: current?.url ?? null,
          linked_at: options.now(),
        });
        repaired.version += 1;
        repaired.updated_at = options.now();
        await callbacks.writeBead(repaired);
      }
    }
    for (const failure of replay.failures) {
      report.failures.push({ beadId: failure.runId, error: failure.error });
    }
  }

  // 2. Assemble the linked set and the remote view.
  const linked = options.allIssues.filter((issue) => readLink(issue, provider));
  const records = await listLinkRecords(dataSyncDir, provider);
  const recordByBead = new Map(records.map((record) => [record.bead_id, record]));

  const since = overlappedWatermark(pullWatermark(records));
  const delta = since ? await adapter.fetchUpdatedSince(since) : [];
  const remoteById = new Map(delta.map((issue) => [issue.id, issue]));

  // Linked pairs whose remote is not in the delta still need their current
  // remote when the local side moved (or no base exists to compare against).
  const missingIds: string[] = [];
  for (const bead of linked) {
    const link = readLink(bead, provider)!;
    if (remoteById.has(link.id)) {
      continue;
    }
    const record = recordByBead.get(bead.id);
    const localMoved =
      record?.base.title !== bead.title ||
      record.base.status !== bead.status ||
      record.base.priority !== bead.priority ||
      record.base.description_hash !== descriptionHash(bead.description ?? null) ||
      unpushedComments(bead, provider).length > 0;
    if (localMoved) {
      missingIds.push(link.id);
    }
  }
  for (const issue of await adapter.fetchIssues(missingIds)) {
    remoteById.set(issue.id, issue);
  }

  // 3. Reconcile every pair whose remote we have in hand.
  const pairs: PlannedPair[] = [];
  for (const bead of linked) {
    const link = readLink(bead, provider)!;
    const remote = remoteById.get(link.id);
    if (!remote) {
      continue; // untouched on both sides
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
    // A link with no bridge record predates the sync engine (a Phase 1 mirror
    // link, or a record lost to damage). Those links lived under a one-way
    // regime where the bead was the truth, so the base seeds from the REMOTE
    // snapshot: local divergence pushes, nothing pulls, and no phantom
    // conflicts fire on the first synchronization. A tracker-side edit made
    // during the unrecorded window is overwritten by that push — reported as
    // an ordinary push, which matches the regime the link was created under.
    const base =
      record?.base ??
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
    const result = reconcile(base, localViewOf(bead), remoteViewOf(remote), policy.field_sync);
    pairs.push({ bead, record, remote, result });
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
      if (commentsMode !== 'inbound' && unpushedComments(pair.bead, provider).length > 0) {
        commentPushes.push({ bead: pair.bead, externalId: link.id });
      }
    }
  }

  // Outbound-new: policy-selected beads with no link yet.
  const outboundNew = mirrorSet(options.allIssues, policy.outbound, provider).filter(
    (issue) => !readLink(issue, provider),
  );

  // Inbound: unlinked externals in scope. The delta covers recently-touched
  // items; a full scan happens only when there is no watermark yet.
  const inbound = policy.inbound;
  const linkedExternalIds = new Set(
    linked.map((bead) => readLink(bead, provider)!.id).concat(records.map((r) => r.external_id)),
  );
  const inboundCandidates =
    inbound.mode === 'off'
      ? []
      : (since ? delta : await adapter.fetchUpdatedSince('1970-01-01T00:00:00.000Z')).filter(
          (issue) =>
            !linkedExternalIds.has(issue.id) &&
            !issue.archivedAt &&
            !issue.trashed &&
            (inbound.labels.length === 0 ||
              issue.labels.some((label) => inbound.labels.includes(label))),
        );

  // 4. The guard counts both directions.
  const externalUpdates = pairs.filter(
    (pair) => Object.keys(pair.result.externalPatch).length > 0,
  ).length;
  const beadUpdates = pairs.filter((pair) => Object.keys(pair.result.beadPatch).length > 0).length;
  const creates = outboundNew.length + (inbound.mode === 'auto' ? inboundCandidates.length : 0);
  const updates = externalUpdates + beadUpdates + commentPushes.length;
  if (!dryRun && (creates > 0 || updates > 0)) {
    await callbacks.affirmBulk({ creates, updates });
  }

  if (dryRun) {
    // Report what would happen; nothing below runs.
    for (const pair of pairs) {
      const id = options.displayId(pair.bead.id);
      if (Object.keys(pair.result.externalPatch).length > 0) {
        report.pushed.push(id);
      }
      if (Object.keys(pair.result.beadPatch).length > 0) {
        report.pulled.push(id);
      }
      for (const conflict of pair.result.conflicts) {
        report.conflicts.push({ beadId: id, field: conflict.field, winner: conflict.winner });
      }
    }
    report.createdOutbound = outboundNew.map((issue) => options.displayId(issue.id));
    if (inbound.mode !== 'off') {
      report.importable = inboundCandidates.map((issue) => ({
        id: issue.id,
        key: issue.key,
        title: issue.title,
      }));
    }
    report.nothingToDo =
      report.pushed.length + report.pulled.length + report.conflicts.length === 0 &&
      report.createdOutbound.length === 0 &&
      report.importable.length === 0 &&
      commentPulls.length + commentPushes.length === 0;
    return report;
  }

  // 5. Journal every planned external write.
  const runId = ulid().toLowerCase();
  const ops: IntentOp[] = [];
  const outboundClientIds = new Map<string, string>();
  for (const issue of outboundNew) {
    const clientId = randomUUID();
    outboundClientIds.set(issue.id, clientId);
    ops.push({
      kind: 'create_issue',
      client_id: clientId,
      bead_id: issue.id,
      patch: {
        title: issue.title,
        ...(issue.description != null ? { description: issue.description } : {}),
        status: issue.status,
        priority: issue.priority,
      },
    });
  }
  for (const pair of pairs) {
    if (Object.keys(pair.result.externalPatch).length > 0) {
      const link = readLink(pair.bead, provider)!;
      ops.push({
        kind: 'update_issue',
        external_id: link.id,
        patch: pair.result.externalPatch as IntentPatch,
      });
    }
  }
  const commentClientIds = new Map<string, string>();
  for (const push of commentPushes) {
    for (const entry of unpushedComments(push.bead, provider)) {
      const clientId = randomUUID();
      commentClientIds.set(`${push.bead.id}:${entry.local_id}`, clientId);
      ops.push({
        kind: 'post_comment',
        external_id: push.externalId,
        comment_client_id: clientId,
        body: entry.body,
      });
    }
  }
  if (ops.length > 0) {
    await writeIntentFile(dataSyncDir, {
      type: 'in',
      run_id: runId,
      provider,
      created_at: options.now(),
      ops,
    });
    await callbacks.afterJournal();
  }

  // 6. Apply, per-pair containment.
  for (const pair of pairs) {
    const displayId = options.displayId(pair.bead.id);
    const link = readLink(pair.bead, provider)!;
    try {
      let postWriteUpdatedAt = pair.remote.updatedAt;

      if (Object.keys(pair.result.externalPatch).length > 0) {
        const { updatedAt } = await adapter.applyChanges(link.id, pair.result.externalPatch);
        postWriteUpdatedAt = updatedAt;
        report.pushed.push(displayId);
      }

      // Conflict artifacts: a comment per conflicted field, exactly-once.
      for (const conflict of pair.result.conflicts) {
        const clientId = randomUUID();
        await adapter.postConflict(
          link.id,
          conflictReportOf(displayId, conflict, `.tbd/data-sync/attic/conflicts/${pair.bead.id}`),
          clientId,
        );
        report.conflicts.push({
          beadId: displayId,
          field: conflict.field,
          winner: conflict.winner,
        });
      }
      for (const overwrite of pair.result.overwrites) {
        report.overwrites.push({
          beadId: displayId,
          field: overwrite.field,
          direction: overwrite.direction,
        });
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
      if (commentPushes.some((push) => push.bead.id === pair.bead.id)) {
        for (const entry of unpushedComments(stored, provider)) {
          const clientId =
            commentClientIds.get(`${pair.bead.id}:${entry.local_id}`) ?? randomUUID();
          const { commentId } = await adapter.createComment(link.id, entry.body, clientId);
          stored = recordPushedComment(stored, provider, entry.local_id!, commentId);
          dirty = true;
          report.commentsPushed += 1;
        }
      }
      if (commentPulls.some((pull) => pull.bead.id === pair.bead.id)) {
        const external = await adapter.listComments(link.id);
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

      // Base advance: only now, after every write above landed.
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
      const ref = await adapter.createIssue(
        {
          title: issue.title,
          ...(issue.description != null ? { description: issue.description } : {}),
          status: issue.status,
          priority: issue.priority,
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

      const links: MirrorLinks = { specUrl: options.specUrl?.(issue), repoUrl: undefined };
      await adapter.upsertAttachments(
        ref.id,
        attachmentsFor(issue, displayId, links, { children: 0, ready: 0 }),
      );
      const block = renderManagedBlock(issue, links, { children: 0, ready: 0 }, displayId);
      if (block) {
        await adapter.spliceDescription(ref.id, block);
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
          assignee: issue.assignee ?? null,
          description_hash: descriptionHash(issue.description ?? null),
        },
        remote_updated_at: current?.updatedAt ?? options.now(),
        synced_at: options.now(),
        state: 'linked',
      });
      report.createdOutbound.push(displayId);
    } catch (error) {
      report.failures.push({
        beadId: displayId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // 7b. Inbound: import or report.
  for (const candidate of inboundCandidates) {
    if (inbound.mode === 'report') {
      report.importable.push({ id: candidate.id, key: candidate.key, title: candidate.title });
      continue;
    }
    try {
      const created = await importExternal(candidate, inbound, provider, options);
      report.importedInbound.push(options.displayId(created.id));
    } catch (error) {
      report.failures.push({
        beadId: candidate.key ?? candidate.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // 8. The journal is consumed: every op either applied above or is covered by
  // a failure entry that keeps honesty in the report. Failed pairs re-plan
  // from current state next run, so the journal need not survive them.
  if (ops.length > 0) {
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
): Promise<Issue> {
  const created = await options.callbacks.createBead({
    title: candidate.title,
    description: candidate.description,
    status: candidate.status,
    priority: candidate.priority,
    kind: inbound.as_kind,
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

  await options.adapter.upsertAttachments(candidate.id, [
    {
      url: beadAttachmentUrl(options.displayId(created.id)),
      title: `${options.displayId(created.id)} · ${inbound.as_kind}`,
      subtitle: `${candidate.status} · P${candidate.priority}`,
    },
  ]);

  await writeLinkRecord(options.dataSyncDir, provider, {
    type: 'lk',
    bead_id: created.id,
    external_id: candidate.id,
    base: {
      title: candidate.title,
      status: candidate.status,
      priority: candidate.priority,
      labels: [],
      assignee: null,
      description_hash: descriptionHash(candidate.description),
    },
    remote_updated_at: candidate.updatedAt,
    synced_at: options.now(),
    state: 'linked',
  });
  return stored;
}
