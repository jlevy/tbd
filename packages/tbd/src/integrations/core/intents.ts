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
import type { AttachmentSpec, CanonicalPatch, ConflictReport, TrackerAdapter } from './types.js';

const CanonicalPatchSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().nullable().optional(),
    status: z.string().optional(),
    priority: z.number().optional(),
    labels: z.array(z.string()).optional(),
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
    external_id: z.string().min(1),
    patch: CanonicalPatchSchema,
  }),
  z.object({
    kind: z.literal('upsert_attachments'),
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
    external_id: z.string().min(1),
    block: z.string(),
  }),
  z.object({
    kind: z.literal('post_comment'),
    external_id: z.string().min(1),
    /** Client UUID; the provider's dedup makes replay exactly-once. */
    comment_client_id: z.string().min(1),
    body: z.string(),
  }),
  z.object({
    kind: z.literal('post_conflict'),
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

export interface ReplayReport {
  replayedRuns: number;
  replayedOps: number;
  /** A recovered create: the item existed already; the link may need writing. */
  recoveredCreates: { beadId: string; externalId: string }[];
  /** Reports that replay already posted, used to avoid re-planning them this run. */
  replayedConflicts: ConflictReport[];
  failures: { runId: string; op: IntentOp; error: string }[];
}

export interface ReplaySafetyFilter {
  blockedExternalIds: ReadonlySet<string>;
  blockedBeadIds: ReadonlySet<string>;
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
): Promise<ReplayReport> {
  const report: ReplayReport = {
    replayedRuns: 0,
    replayedOps: 0,
    recoveredCreates: [],
    replayedConflicts: [],
    failures: [],
  };

  for (const file of await listIntentFiles(dataSyncDir, provider)) {
    report.replayedRuns += 1;
    let failed = false;

    for (const op of file.ops) {
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
      try {
        switch (op.kind) {
          case 'create_issue': {
            const ref = await adapter.createIssue(op.patch as CanonicalPatch, op.client_id);
            report.recoveredCreates.push({ beadId: op.bead_id, externalId: ref.id });
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
          case 'post_comment':
            await adapter.createComment(op.external_id, op.body, op.comment_client_id);
            break;
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
        report.failures.push({
          runId: file.run_id,
          op,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    if (!failed) {
      await deleteIntentFile(dataSyncDir, provider, file.run_id);
    }
  }

  return report;
}
