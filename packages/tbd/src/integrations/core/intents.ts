/**
 * Write-ahead intents: the journal that makes external writes crash-safe.
 *
 * Before a sync run touches the tracker, it writes every planned external
 * operation to `bridge/<provider>/intents/<run-id>.yml` and commits. A crash at
 * any later point leaves the file in place, and the next run — on this machine
 * or any other — replays it before doing anything else. The file is deleted
 * only after the run's base advance commits, so the journal is empty exactly
 * when nothing is in flight.
 *
 * Replay is safe because every operation is idempotent or replay-converts:
 * creates carry client UUIDs (a duplicate is recovered as success), updates
 * re-apply the same values, attachments upsert on url, and comments carry
 * client UUIDs the provider deduplicates (verified live). Cross-machine replay
 * needs no coordination for the same reason.
 */

import { mkdir, readdir, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';

import { writeFile } from 'atomically';
import { z } from 'zod';

import type { ProviderNameType } from '../../lib/types.js';
import { parseYamlWithConflictDetection, stringifyYaml } from '../../utils/yaml-utils.js';
import { bridgeIntentsDir } from './bridge-state.js';
import { isWorkspaceLimitError } from './types.js';
import type { AttachmentSpec, CanonicalPatch, ConflictReport, TrackerAdapter } from './types.js';

const CanonicalPatchSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().nullable().optional(),
    status: z.string().optional(),
    priority: z.number().optional(),
    labels: z.array(z.string()).optional(),
    assignee: z.string().nullable().optional(),
    parentId: z.string().nullable().optional(),
  })
  .passthrough();

const IntentOpSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('create_issue'),
    /** The client UUID; also the external id the item will have. */
    client_id: z.string().min(1),
    bead_id: z.string().min(1),
    patch: CanonicalPatchSchema,
  }),
  z.object({
    kind: z.literal('update_issue'),
    bead_id: z.string().min(1),
    external_id: z.string().min(1),
    patch: CanonicalPatchSchema,
  }),
  z.object({
    kind: z.literal('upsert_attachments'),
    bead_id: z.string().min(1),
    external_id: z.string().min(1),
    attachments: z.array(
      z.object({
        url: z.string(),
        title: z.string(),
        subtitle: z.string().optional(),
        metadata: z.record(z.string(), z.unknown()).optional(),
      }),
    ),
  }),
  z.object({
    kind: z.literal('splice_description'),
    bead_id: z.string().min(1),
    external_id: z.string().min(1),
    block: z.string(),
  }),
  z.object({
    kind: z.literal('post_comment'),
    external_id: z.string().min(1),
    /** Durable local identity: replay must mark this entry as pushed. */
    bead_id: z.string().min(1),
    local_id: z.string().min(1),
    /** Client UUID; the provider's dedup makes replay exactly-once. */
    comment_client_id: z.string().min(1),
    body: z.string(),
  }),
  z.object({
    kind: z.literal('post_conflict'),
    bead_id: z.string().min(1),
    external_id: z.string().min(1),
    /** Client UUID; the provider's dedup makes crash replay exactly-once. */
    comment_client_id: z.string().min(1),
    report: z.object({
      beadId: z.string().min(1),
      field: z.string().min(1),
      keptValue: z.unknown(),
      discardedValue: z.unknown(),
      atticPath: z.string().min(1),
    }),
  }),
]);

export const IntentFileSchema = z.object({
  type: z.literal('in'),
  run_id: z.string().min(1),
  provider: z.enum(['linear', 'github']),
  created_at: z.string(),
  ops: z.array(IntentOpSchema),
});

export type IntentOp = z.infer<typeof IntentOpSchema>;
export type IntentPatch = z.infer<typeof CanonicalPatchSchema>;
export type IntentFile = z.infer<typeof IntentFileSchema>;

function intentPath(dataSyncDir: string, provider: ProviderNameType, runId: string): string {
  return join(bridgeIntentsDir(dataSyncDir, provider), `${runId}.yml`);
}

/** Journal a run's planned external writes. Called before any of them happen. */
export async function writeIntentFile(dataSyncDir: string, file: IntentFile): Promise<void> {
  const dir = bridgeIntentsDir(dataSyncDir, file.provider);
  await mkdir(dir, { recursive: true });
  await writeFile(intentPath(dataSyncDir, file.provider, file.run_id), stringifyYaml(file));
}

/** Every pending intent file for a provider, oldest run first. */
export async function listIntentFiles(
  dataSyncDir: string,
  provider: ProviderNameType,
): Promise<IntentFile[]> {
  let names: string[];
  try {
    names = await readdir(bridgeIntentsDir(dataSyncDir, provider));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }
    throw new Error(`Could not read ${provider} integration intent directory`, { cause: error });
  }
  const files: IntentFile[] = [];
  for (const name of names.filter((n) => n.endsWith('.yml')).sort()) {
    let content: string;
    try {
      content = await readFile(join(bridgeIntentsDir(dataSyncDir, provider), name), 'utf8');
    } catch (error) {
      throw new Error(`Could not read ${provider} integration intent ${name}`, { cause: error });
    }
    let decoded: unknown;
    try {
      decoded = parseYamlWithConflictDetection(content);
    } catch (error) {
      throw new Error(`Could not parse ${provider} integration intent ${name}`, { cause: error });
    }
    const parsed = IntentFileSchema.safeParse(decoded);
    if (!parsed.success) {
      const details = parsed.error.issues
        .map((issue) => `${issue.path.join('.') || '<root>'}: ${issue.message}`)
        .join('; ');
      throw new Error(`Invalid ${provider} integration intent ${name}: ${details}`);
    }
    files.push(parsed.data);
  }
  return files;
}

/** Remove a run's intent file once its work is recorded. */
export async function deleteIntentFile(
  dataSyncDir: string,
  provider: ProviderNameType,
  runId: string,
): Promise<void> {
  await rm(intentPath(dataSyncDir, provider, runId), { force: true });
}

/**
 * Remove obsolete operations from every pending journal for one provider.
 *
 * Unlink uses this while holding the shared data-sync lock: an explicit
 * severance cancels writes that were planned for the former relationship.
 * Journals containing unrelated work are rewritten atomically; empty ones
 * are deleted.
 */
export async function discardIntentOps(
  dataSyncDir: string,
  provider: ProviderNameType,
  shouldDiscard: (op: IntentOp) => boolean,
): Promise<number> {
  let removed = 0;
  for (const file of await listIntentFiles(dataSyncDir, provider)) {
    const kept = file.ops.filter((op) => {
      if (!shouldDiscard(op)) {
        return true;
      }
      removed += 1;
      return false;
    });
    if (kept.length === file.ops.length) {
      continue;
    }
    if (kept.length === 0) {
      await deleteIntentFile(dataSyncDir, provider, file.run_id);
    } else {
      await writeIntentFile(dataSyncDir, { ...file, ops: kept });
    }
  }
  return removed;
}

export interface ReplayReport {
  replayedRuns: number;
  replayedOps: number;
  /** A recovered create: the item existed already; the link may need writing. */
  recoveredCreates: { beadId: string; externalId: string }[];
  /** Reports that replay already posted, used to avoid re-planning them this run. */
  replayedConflicts: ConflictReport[];
  /** Comments that landed and must be reconciled into their durable bead entry. */
  recoveredComments: { beadId: string; localId: string; commentId: string }[];
  failures: { runId: string; op: IntentOp; error: string }[];
}

export interface ReplayRecovery {
  runId: string;
  recoveredCreates: ReplayReport['recoveredCreates'];
  recoveredComments: ReplayReport['recoveredComments'];
}

export interface ReplaySafetyFilter {
  blockedExternalIds: ReadonlySet<string>;
  blockedBeadIds: ReadonlySet<string>;
  /**
   * Every operation is replayable only while its owning bead retains the same
   * external relationship. Comments additionally require their exact local
   * entry to remain unpushed. False means unlink or newer durable state
   * superseded the operation, so consuming it is successful cancellation.
   */
  shouldReplay?: (op: IntentOp) => boolean;
}

function blockedReplayTarget(op: IntentOp, safety: ReplaySafetyFilter | undefined): string | null {
  if (!safety) {
    return null;
  }
  if (op.kind === 'create_issue') {
    return safety.blockedBeadIds.has(op.bead_id) || safety.blockedExternalIds.has(op.client_id)
      ? op.client_id
      : null;
  }
  return safety.blockedExternalIds.has(op.external_id) ? op.external_id : null;
}

/**
 * Replay every pending intent, then delete the files whose ops all succeeded.
 *
 * A file with any failed op is kept so the next run tries again; the failure
 * list makes the run report honest about it.
 */
export async function replayIntents(
  dataSyncDir: string,
  provider: ProviderNameType,
  adapter: TrackerAdapter,
  safety?: ReplaySafetyFilter,
  /** Persist recovered local identities before their intent file is removed. */
  recordRecovery?: (recovery: ReplayRecovery) => Promise<void>,
): Promise<ReplayReport> {
  const report: ReplayReport = {
    replayedRuns: 0,
    replayedOps: 0,
    recoveredCreates: [],
    replayedConflicts: [],
    recoveredComments: [],
    failures: [],
  };

  // A workspace plan limit fails every issue create for the same reason, so the
  // first such error stops further create attempts across ALL journaled runs —
  // otherwise a large halted batch re-pays one doomed request per item on every
  // sync until the limit is lifted (observed live: ~141 failing calls per run).
  // Other op kinds keep replaying: comments and updates are not what the limit
  // is counting, and holding them hostage would delay unrelated convergence.
  let createHalt: string | undefined;
  // External ids that provably do not exist: the client ids of creates that
  // failed or were parked. An op journaled against one — the attachments or
  // managed block of a never-created issue — is a guaranteed "Could not find
  // referenced Issue" from the provider, so it parks locally instead. Observed
  // live: 32 halted creates left 64 dependent ops burning a request each on
  // every sync.
  const deadExternalIds = new Set<string>();

  for (const file of await listIntentFiles(dataSyncDir, provider)) {
    report.replayedRuns += 1;
    let failed = false;
    const recoveredCreates: ReplayReport['recoveredCreates'] = [];
    const recoveredComments: ReplayReport['recoveredComments'] = [];
    // Ops that must survive into the next replay. Everything else — succeeded,
    // consumed by the safety filter, or discarded by the integrity guard — has
    // no reason to run again: replaying a 200-op journal for its 3 failures
    // costs a request per already-done op on every sync (observed live as ~90
    // redundant requests per run against a halted batch).
    const pendingOps: typeof file.ops = [];

    for (const op of file.ops) {
      if (op.kind === 'create_issue' && createHalt !== undefined) {
        failed = true;
        pendingOps.push(op);
        deadExternalIds.add(op.client_id);
        report.failures.push({
          runId: file.run_id,
          op,
          error: `not attempted: ${createHalt}`,
        });
        continue;
      }
      if (op.kind !== 'create_issue' && deadExternalIds.has(op.external_id)) {
        failed = true;
        pendingOps.push(op);
        report.failures.push({
          runId: file.run_id,
          op,
          error: 'not attempted: its issue was never created; retries with the create.',
        });
        continue;
      }
      const blockedTarget = blockedReplayTarget(op, safety);
      if (blockedTarget) {
        // The durable bead remains the source for re-planning once the link
        // corruption is repaired. Keeping this stale op would replay an
        // unknown holder's write after unlink, so discard it explicitly while
        // retaining an honest failure in this run's report.
        report.failures.push({
          runId: file.run_id,
          op,
          error: `Discarded replay for ${blockedTarget}: duplicate link integrity guard`,
        });
        continue;
      }
      if (safety?.shouldReplay && !safety.shouldReplay(op)) {
        // The durable bead/link is the authority for every provider write.
        // Unlink or a newer relationship consumes stale work without provider
        // I/O; a comment already carrying its provider id does the same.
        continue;
      }
      try {
        switch (op.kind) {
          case 'create_issue': {
            const ref = await adapter.createIssue(op.patch as CanonicalPatch, op.client_id);
            const recovered = { beadId: op.bead_id, externalId: ref.id };
            recoveredCreates.push(recovered);
            report.recoveredCreates.push(recovered);
            break;
          }
          case 'update_issue':
            await adapter.applyChanges(op.external_id, op.patch as CanonicalPatch);
            break;
          case 'upsert_attachments':
            await adapter.upsertAttachments(op.external_id, op.attachments as AttachmentSpec[]);
            break;
          case 'splice_description':
            await adapter.spliceDescription(op.external_id, op.block);
            break;
          case 'post_comment': {
            const { commentId } = await adapter.createComment(
              op.external_id,
              op.body,
              op.comment_client_id,
            );
            const recovered = { beadId: op.bead_id, localId: op.local_id, commentId };
            recoveredComments.push(recovered);
            report.recoveredComments.push(recovered);
            break;
          }
          case 'post_conflict':
            await adapter.postConflict(
              op.external_id,
              op.report as ConflictReport,
              op.comment_client_id,
            );
            report.replayedConflicts.push(op.report as ConflictReport);
            break;
        }
        report.replayedOps += 1;
      } catch (error) {
        failed = true;
        pendingOps.push(op);
        if (op.kind === 'create_issue') {
          deadExternalIds.add(op.client_id);
          if (isWorkspaceLimitError(error)) {
            createHalt = error.message;
          }
        }
        report.failures.push({
          runId: file.run_id,
          op,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    if (recoveredCreates.length > 0 || recoveredComments.length > 0) {
      // The external operation and its local identity are one recoverable
      // unit. Persist the local half while the journal is still durable; if
      // that callback or its commit fails, the file remains for safe replay.
      await recordRecovery?.({ runId: file.run_id, recoveredCreates, recoveredComments });
    }
    if (!failed) {
      await deleteIntentFile(dataSyncDir, provider, file.run_id);
    } else if (pendingOps.length < file.ops.length) {
      // Compact rather than keep verbatim: the next replay should pay only for
      // what is actually pending. Written only after recordRecovery above, so
      // a crash between the two leaves the fuller journal, which replays
      // idempotently — the safe direction to fail in.
      await writeIntentFile(dataSyncDir, { ...file, ops: pendingOps });
    }
  }

  return report;
}
