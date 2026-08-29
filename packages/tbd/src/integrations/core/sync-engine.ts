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

import type { LabelMirrorModeType } from './provider-settings.js';

import type {
  InboundClause,
  Issue,
  LinkRecord,
  PolicyDefinition,
  ProviderNameType,
} from '../../lib/types.js';
import { computeSlot, decomposeSlot, isSlot, type Slot } from './slots.js';
import { readyIssueIds } from '../../lib/issue-selection.js';
import {
  descriptionHash,
  listLinkRecords,
  normalizeTrackerProse,
  pullWatermark,
  writeLinkRecord,
  writeLinkRecordIfChanged,
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
import { CONFLICT_COMMENT_MARKER, isWorkspaceLimitError } from './types.js';
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
  mirrorLabels: LabelMirrorModeType;
  /**
   * Labels every linked item must carry — the plain `tbd` marker and the `repo/<name>`
   * group label.
   *
   * Applied at the LINKED-PAIR level rather than only on outbound creates, so an item
   * that entered by any route — created here, imported from the tracker, or linked by
   * hand — ends up marked. A scheme that only marked what tbd created would leave the
   * imported half of a shared surface unfilterable, which is exactly the case the labels
   * exist for.
   *
   * Additive: asserted through `ensureLabels`, which never removes a label a person
   * applied in the tracker. Independent of `mirrorLabels`, which answers the different
   * question of whether to project the repository's own bead labels.
   */
  originLabels?: readonly string[];
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
  /**
   * Pairs with outbound work that THIS run will not perform because it is inbound-only.
   *
   * Separate from `pushed` on purpose. `pushed` is what the run does; a `--pull` run
   * does not push, so reporting these as pushes made the dry run contradict the run it
   * previewed and left three mutually inconsistent numbers for one state (#265). Kept
   * rather than dropped because "there is outbound work pending" is worth knowing.
   */
  suppressedPushes: string[];
  /**
   * Why each dirty pair is dirty: one entry per field the run intends to move.
   *
   * The summary says "push 13"; this says which thirteen and which fields. Without it,
   * a pair that reports work every run and never converges can only be diagnosed by
   * reading `.tbd/data-sync/bridge/` by hand, which is what #265 had to do. Populated
   * identically on both the dry-run and execute paths, so a preview explains the run.
   */
  divergences: { beadId: string; field: string; direction: 'push' | 'pull'; rule: string }[];
  conflicts: { beadId: string; field: string; winner: string }[];
  overwrites: { beadId: string; field: string; direction: string }[];
  skippedPushes: { beadId: string; field: string }[];
  /** Safe provider-to-canonical mapping diagnostics, deduplicated per external item. */
  warnings: { externalId: string; externalKey?: string; message: string }[];
  commentsPulled: number;
  commentsPushed: number;
  orphaned: string[];
  /** Pairs whose archived tracker item was revived because the bead reopened. */
  unarchived: string[];
  /** Pairs retired to the tracker's archive under `policy.archive: on_close`. */
  archived: string[];
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

function localViewOf(bead: Issue, ready?: ReadonlySet<string>): LocalView {
  return {
    title: bead.title,
    description: bead.description ?? null,
    status: bead.status,
    // Computed only when the caller supplied readiness. Without it the Todo/Backlog
    // split cannot be decided, and guessing would be worse than staying on statuses.
    ...(ready
      ? {
          slot: computeSlot({
            status: bead.status,
            hold: bead.hold,
            resolution: bead.resolution,
            ready: ready.has(bead.id),
          }),
        }
      : {}),
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
    // The provider names the column; absent, the run stays on statuses.
    ...(remote.slot && isSlot(remote.slot) ? { slot: remote.slot } : {}),
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
    suppressedPushes: [],
    divergences: [],
    conflicts: [],
    overwrites: [],
    skippedPushes: [],
    warnings: [],
    commentsPulled: 0,
    commentsPushed: 0,
    orphaned: [],
    unarchived: [],
    archived: [],
    createdOutbound: [],
    skippedOutbound: [],
    importedInbound: [],
    importable: [],
    failures: [],
    nothingToDo: false,
  };
  /**
   * Record why one pair is dirty, from the patches the matrix produced.
   *
   * One implementation for both the dry-run and execute paths on purpose: the whole
   * point is that a preview and a run give the same account, and two copies of this
   * would be two chances to drift (which is exactly how the direction reporting drifted
   * in the first place).
   */
  const recordDivergence = (beadId: string, pair: PlannedPair): void => {
    const ruleFor = (field: string): string =>
      (policy.field_sync.fields as Record<string, string | undefined>)[field] ?? 'n/a';
    for (const field of Object.keys(pair.result.externalPatch)) {
      report.divergences.push({ beadId, field, direction: 'push', rule: ruleFor(field) });
    }
    for (const field of Object.keys(pair.result.beadPatch)) {
      report.divergences.push({ beadId, field, direction: 'pull', rule: ruleFor(field) });
    }
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
  // Manual by default: the tracker's archive is a human filing decision, and a
  // repository's automation is a poor judge of when someone is done looking at
  // something. See ArchiveMode.
  const archiveMode = options.policy.archive ?? 'manual';
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
      // A reopened bead revives its issue rather than going quiet. Archival is how a
      // settled pair is meant to end — the tracker's own retention runs it, and the
      // pair costs nothing afterwards — but that has to be reversible, or reopening
      // work silently stops syncing it forever. Creating a fresh issue instead would
      // be worse: two issues for one bead, the history stranded in the archived one.
      //
      // Trashed items are deliberately excluded. Linear purges trash after 30 days,
      // so reviving one races a deletion that would strand the link again; a human
      // restores it, or unlinks and lets a clean issue be created.
      const reopened = !remote.trashed && bead.status !== 'closed';
      if (reopened && archiveMode === 'on_close' && adapter.unarchiveIssue && !inboundOnly) {
        if (!dryRun) {
          try {
            await adapter.unarchiveIssue(link.id);
          } catch (error) {
            report.failures.push({
              beadId: options.displayId(bead.id),
              error: `could not unarchive: ${error instanceof Error ? error.message : String(error)}`,
            });
            continue;
          }
          const record = recordByBead.get(bead.id);
          if (record && record.state !== 'linked') {
            await writeLinkRecord(dataSyncDir, provider, { ...record, state: 'linked' });
          }
        }
        report.unarchived.push(options.displayId(bead.id));
        // Fall through: the pair is live again, so it reconciles in this same run
        // and any edits made while it was archived flow normally.
      } else {
        const record = recordByBead.get(bead.id);
        if (!dryRun && record && record.state !== 'orphaned') {
          await writeLinkRecord(dataSyncDir, provider, { ...record, state: 'orphaned' });
        }
        report.orphaned.push(options.displayId(bead.id));
        // Under `manual` the archive belongs to whoever is using the tracker, so a
        // reopened bead is reported rather than acted on. Saying so matters: the pair
        // has gone quiet in a way the operator did not ask for and would otherwise
        // have no way to notice.
        if (reopened) {
          report.warnings.push({
            externalId: link.id,
            ...(remote.key ? { externalKey: remote.key } : {}),
            message:
              `${options.displayId(bead.id)} reopened but its tracker item is archived; ` +
              `restore it in the tracker, or set policy.archive: on_close to let tbd do it.`,
          });
        }
        continue;
      }
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
      localViewOf(bead, readyIds),
      remoteViewOf(remote),
      policy.field_sync,
      options.equivalences,
      {
        // The flow rule gates the push, not just the pull. `FieldSyncClauseSchema`
        // promises nothing person-identifying moves without an explicit `user_map`
        // AND an explicit `assignee: merge`, but that guard only ever covered the
        // inbound direction — so the conservative default was not conservative in the
        // direction that destroys data (OS-351). `merge` is now required before any
        // outbound assignee write.
        assignee:
          policy.field_sync.fields.assignee === 'merge' &&
          adapter.canPushAssignee(bead.assignee ?? null),
        assigneePull: remote.assigneeSyncable !== false,
      },
    );
    // A pulled slot decomposes here rather than in the matrix, because the bead fields
    // it implies carry invariants the matrix knows nothing about — a resolution only on
    // closed work, a hold only off it. Doing it in one place keeps those rules with the
    // code that owns them.
    if (result.beadPatch.slot) {
      const fields = decomposeSlot(result.beadPatch.slot);
      result.beadPatch.status = fields.status;
      result.beadPatch.hold = fields.hold;
      result.beadPatch.resolution = fields.resolution;
      // The merged view is what the base is written from and what the managed block
      // renders, so a decomposition that stopped at the patch would leave both
      // describing the position the bead just moved away from.
      result.merged.status = fields.status;
      if (result.beadPatch.slot === 'duplicate') {
        // The tracker carries the duplicate's target as a relation tbd does not read,
        // and the write boundary rejects a duplicate without one. Canceled keeps the
        // honest half; saying so beats narrowing it silently.
        report.warnings.push({
          externalId: remote.id,
          ...(remote.key ? { externalKey: remote.key } : {}),
          message:
            'Marked a duplicate in the tracker; recorded as canceled because the duplicate target is not mirrored locally.',
        });
      }
    }

    // `resolution` rides with `status` rather than reconciling on its own.
    //
    // It is not an independent fact: it only refines a terminal position, and only the
    // pair is meaningful to a provider. Giving it its own row in the three-way matrix
    // would let a reason flow while the position it describes did not, which is how a
    // bead ends up canceled and open at once. Widening the matrix properly is the slot
    // work in a later phase; until then the rule is that the reason goes where the
    // position goes.
    // An outbound slot is decomposed into the fields the adapter already knows how to
    // write. The adapter's job is provider vocabulary, not lifecycle arithmetic, so the
    // slot is turned back into status/hold/resolution here rather than teaching every
    // adapter to read slots.
    if (result.externalPatch.slot !== undefined) {
      const fields = decomposeSlot(result.externalPatch.slot as Slot);
      result.externalPatch.status = fields.status;
      result.externalPatch.hold = fields.hold;
      result.externalPatch.resolution = fields.resolution;
    } else if (result.externalPatch.status !== undefined) {
      result.externalPatch.resolution = bead.resolution ?? null;
      result.externalPatch.hold = bead.hold ?? null;
    }
    // Put the issue back in the column it came from when the position it is being
    // written to is the same one that column represented. Without this, a bead that
    // paused and resumed would come back to a generic In Progress rather than to the
    // team's own column, which is the same "don't fight the human" rule applied across
    // a round trip instead of within one run.
    if (
      result.externalPatch.slot !== undefined &&
      record?.refinement_state_id &&
      record.refinement_slot === result.externalPatch.slot
    ) {
      result.externalPatch.stateId = record.refinement_state_id;
    }
    if (result.beadPatch.status !== undefined) {
      // A Linear duplicate carries its target as a relation tbd does not read yet, and
      // `duplicate` without a pointer is a bead the write boundary rejects outright.
      // Recording it as canceled keeps the honest half — this work was abandoned, not
      // delivered — and says so rather than dropping the distinction silently.
      const inbound = remote.resolution;
      if (inbound === 'duplicate') {
        result.beadPatch.resolution = 'canceled';
        report.warnings.push({
          externalId: remote.id,
          ...(remote.key ? { externalKey: remote.key } : {}),
          message:
            'Marked a duplicate in the tracker; recorded as canceled because the duplicate target is not mirrored locally.',
        });
      } else {
        result.beadPatch.resolution = inbound;
      }
      // A hold only means anything on non-terminal work; pulling one onto a bead the
      // same patch is closing would be rejected at the write boundary.
      result.beadPatch.hold = result.beadPatch.status === 'closed' ? null : (remote.hold ?? null);
    }

    // Assert the origin labels only when the remote is actually missing one.
    //
    // Adding them unconditionally would put a key in every externalPatch, which is what
    // decides whether a pair counts as changed — every settled pair would look dirty and
    // a quiet sync would write, commit, and push again. Diffing against the remote's
    // current labels keeps a settled mirror silent while still backfilling an item that
    // predates the labels or was imported without them.
    const missingOriginLabels = (options.originLabels ?? []).filter(
      (label) => !remote.labels.includes(label),
    );
    if (missingOriginLabels.length > 0) {
      result.externalPatch.ensureLabels = missingOriginLabels;
    }

    if (options.mirrorLabels === 'none') {
      // Labels are inert unless explicitly mirrored: never pushed (which would
      // create one team label per bead label AND wipe tbd's status carriers on
      // beads without labels), never pulled, never a reportable overwrite.
      delete result.externalPatch.labels;
      delete result.beadPatch.labels;
      result.overwrites = result.overwrites.filter((o) => o.field !== 'labels');
      result.conflicts = result.conflicts.filter((c) => c.field !== 'labels');
      result.merged.labels = bead.labels ?? [];
    } else if (result.externalPatch.labels && options.mirrorLabels === 'prefixed') {
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
    // Compare normalized, never raw. Linear rewrites the block's own markdown on the
    // way in — a plain `[name](url)` comes back `[name](<url>)` — so a raw comparison
    // finds a difference on every sync and rewrites a settled mirror forever. The base
    // hash could not catch this either: it strips the managed block before hashing, so
    // the block is the one region no other check covers.
    if (
      !inboundOnly &&
      (pair.result.externalPatch.description !== undefined ||
        normalizeTrackerProse(spliced.result) !==
          normalizeTrackerProse(pair.remote.description ?? ''))
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
        // Gated on direction, as the execute path is. Ungated, this branch reported a
        // push that an inbound-only run would never perform.
        (inboundOnly ? report.suppressedPushes : report.pushed).push(id);
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
      // A field the run cannot publish is the one thing that explains a pair which
      // reports work forever without ever converging, and it was recorded only on the
      // execute path — so a dry run, the command an operator actually reaches for to
      // diagnose a stuck mirror, could not name the stuck field (#265). It also made
      // the `skippedPushes.length === 0` term in this branch's own `nothingToDo` inert.
      for (const skipped of pair.result.skippedPushes) {
        report.skippedPushes.push({ beadId: id, field: skipped.field });
      }
      recordDivergence(id, pair);
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
      report.suppressedPushes.length === 0 &&
      report.skippedOutbound.length === 0 &&
      // A field the run could not publish is something to do, not nothing. Omitting it
      // here is the same defect as OS-351's `skipped 0`: the summary reads as success
      // while a value never left the machine, and the detail lines that would have
      // named it are behind this early return.
      report.skippedPushes.length === 0 &&
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

      // Retire a settled pair, when the operator has handed tbd that job. Last among
      // the pair's writes on purpose: Linear rejects edits to an archived issue, so
      // archiving before the patch and splice would lose them. Not journaled as an
      // intent either — it is idempotent and inferable from the bead's own status, so
      // a crash before it simply means the next sync archives instead.
      if (
        !inboundOnly &&
        archiveMode === 'on_close' &&
        adapter.archiveIssue &&
        pair.result.merged.status === 'closed' &&
        !pair.remote.archivedAt
      ) {
        await adapter.archiveIssue(link.id);
        report.archived.push(displayId);
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
      recordDivergence(displayId, pair);

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
          ...(patch.resolution !== undefined ? { resolution: patch.resolution } : {}),
          ...(patch.hold !== undefined ? { hold: patch.hold } : {}),
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
        report.suppressedPushes.push(displayId);
        continue;
      }
      // Only when something actually changed: a settled pair reconciles to the
      // same answer every run, and rewriting it would differ solely by
      // `synced_at` — turning a sync with nothing to do into a commit and a
      // push. See writeLinkRecordIfChanged.
      await writeLinkRecordIfChanged(
        dataSyncDir,
        provider,
        {
          type: 'lk',
          bead_id: pair.bead.id,
          external_id: link.id,
          // From the remote already in hand: this is the one path every linked
          // pair takes on every sync, so a renamed team is picked up here even
          // when the pair has nothing else to push.
          external_key: pair.remote.key ?? null,
          external_url: pair.remote.url ?? null,
          // The exact column this issue was last seen in, remembered alongside the
          // slot that column resolved to. Replayed only when a later write targets
          // that same slot: if the work genuinely moves, the old state is no longer
          // where it belongs and resolving afresh is correct.
          refinement_state_id: pair.remote.stateId ?? null,
          refinement_slot: pair.remote.slot && isSlot(pair.remote.slot) ? pair.remote.slot : null,
          base: {
            title: pair.result.merged.title,
            status: pair.result.merged.status,
            slot: pair.result.merged.slot,
            priority: pair.result.merged.priority,
            labels: pair.result.merged.labels,
            assignee: pair.result.merged.assignee,
            description_hash: pair.result.merged.description_hash,
          },
          remote_updated_at: postWriteUpdatedAt,
          synced_at: options.now(),
          state: 'linked',
        },
        recordByBead.get(pair.bead.id),
      );
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
  //
  // Two batch-level failure modes are handled above the per-item try/catch.
  // A parent whose create failed leaves its children pointing at a client id
  // that never came to exist, so attempting them is a guaranteed provider
  // rejection ("parentId … could not be found" — observed live); they are
  // reported without an API call and their intents stay journaled. And a
  // workspace plan limit dooms every remaining create for the same reason it
  // failed the first, so the batch halts at the first such error rather than
  // paying a request per doomed item.
  const failedCreateClientIds = new Set<string>();
  let workspaceLimitHalt: string | undefined;
  for (const issue of outboundNew) {
    const displayId = options.displayId(issue.id);
    const haltClientId = outboundClientIds.get(issue.id);
    const haltParentId = outboundParentIds.get(issue.id);
    if (workspaceLimitHalt !== undefined) {
      journalDirty = true;
      if (haltClientId) {
        failedCreateClientIds.add(haltClientId);
      }
      report.failures.push({
        beadId: displayId,
        error: `not attempted: ${workspaceLimitHalt}`,
      });
      continue;
    }
    if (haltParentId && failedCreateClientIds.has(haltParentId)) {
      journalDirty = true;
      if (haltClientId) {
        failedCreateClientIds.add(haltClientId);
      }
      report.failures.push({
        beadId: displayId,
        error:
          'not attempted: its parent failed to create in this run. ' +
          'Both stay journaled and converge on a later sync.',
      });
      continue;
    }
    try {
      const clientId = outboundClientIds.get(issue.id);
      const parentExternalId = outboundParentIds.get(issue.id);
      const ref = await adapter.createIssue(
        {
          title: issue.title,
          ...(issue.description != null ? { description: issue.description } : {}),
          status: issue.status,
          priority: issue.priority,
          // The bead's real dates, not the moment this sync happened to run. Only the
          // create surface accepts them, which is also the only place they matter:
          // backfilling an existing repository is what would otherwise stamp years of
          // history as today. See CanonicalPatch.sourceCreatedAt.
          sourceCreatedAt: issue.created_at,
          sourceCompletedAt: issue.closed_at ?? null,
          ...(adapter.canPushAssignee(issue.assignee ?? null)
            ? { assignee: issue.assignee ?? null }
            : {}),
          ...(parentExternalId ? { parentId: parentExternalId } : {}),
          // Mark it at birth. This patch is built here rather than by planMirror, so
          // without this an item the engine creates arrives unlabelled and the next
          // sync has to notice and backfill it — a guaranteed second write for every
          // create, and an unlabelled window in between.
          ...((options.originLabels?.length ?? 0) > 0
            ? { ensureLabels: [...(options.originLabels ?? [])] }
            : {}),
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

      // Record the pair NOW, before any further remote work. The item already
      // exists in the tracker and the bead already claims it, so from here on an
      // interruption must not be able to leave a bead whose link the bridge has
      // no record of. That pair is invisible to reconciliation and, because the
      // bead reads as linked, it is never created again either: the tracker item
      // is orphaned permanently and no later sync converges it. The attachment,
      // description, and read-back calls below are each a network round trip,
      // which makes this window wide enough to lose a whole interrupted run in.
      const linkRecord = {
        type: 'lk' as const,
        bead_id: issue.id,
        external_id: ref.id,
        external_key: ref.key ?? null,
        external_url: ref.url ?? null,
        base: {
          title: issue.title,
          status: issue.status,
          priority: issue.priority,
          labels: issue.labels ?? [],
          assignee: null,
          description_hash: descriptionHash(issue.description ?? null),
        },
        remote_updated_at: options.now(),
        synced_at: options.now(),
        state: 'linked' as const,
      };
      await writeLinkRecord(dataSyncDir, provider, linkRecord);

      const extras = outboundExtras.get(issue.id);
      if (extras) {
        await adapter.upsertAttachments(ref.id, extras.attachments);
        if (extras.block) {
          await adapter.spliceDescription(ref.id, extras.block);
        }
      }

      const [current] = await adapter.fetchIssues([ref.id]);
      // Refine the record that already exists rather than establishing it here.
      // `current` is the post-create read; `ref` is what the create returned.
      // Prefer the read, but fall back rather than storing null for a brand
      // new link whose identifier the create already told us.
      await writeLinkRecord(dataSyncDir, provider, {
        ...linkRecord,
        external_key: current?.key ?? ref.key ?? null,
        external_url: current?.url ?? ref.url ?? null,
        base: { ...linkRecord.base, assignee: current?.assignee ?? null },
        remote_updated_at: current?.updatedAt ?? options.now(),
        synced_at: options.now(),
      });
      report.createdOutbound.push(displayId);
    } catch (error) {
      journalDirty = true;
      if (haltClientId) {
        failedCreateClientIds.add(haltClientId);
      }
      if (isWorkspaceLimitError(error)) {
        workspaceLimitHalt = error.message;
      }
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

  // Warnings are deliberately NOT a term here. A mapping warning describes a standing
  // condition tbd cannot resolve from this side — a Linear assignee absent from
  // `user_map` is re-reported on every read of that issue, forever — so counting it as
  // work meant a fully settled mirror could never report itself settled, and an
  // operator could not tell a quiet mirror from a mirror with real pending work
  // (#265). Warnings are still reported on every run; they just no longer claim there
  // is something to do. Failures are different and stay counted: a failure is work that
  // was attempted and did not land.
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
      report.skippedPushes.length +
      report.suppressedPushes.length +
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
    external_key: candidate.key ?? null,
    external_url: candidate.url ?? null,
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
