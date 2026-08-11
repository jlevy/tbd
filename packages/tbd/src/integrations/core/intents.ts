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
import type { AttachmentSpec, CanonicalPatch, TrackerAdapter } from './types.js';

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
]);

export const IntentFileSchema = z.object({
  type: z.literal('in'),
  run_id: z.string().min(1),
  provider: z.enum(['linear', 'github']),
  created_at: z.string(),
  ops: z.array(IntentOpSchema),
});

export type IntentOp = z.infer<typeof IntentOpSchema>;
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
  } catch {
    return [];
  }
  const files: IntentFile[] = [];
  for (const name of names.filter((n) => n.endsWith('.yml')).sort()) {
    try {
      const content = await readFile(join(bridgeIntentsDir(dataSyncDir, provider), name), 'utf8');
      const parsed = IntentFileSchema.safeParse(parseYamlWithConflictDetection(content));
      if (parsed.success) {
        files.push(parsed.data);
      }
    } catch {
      // A damaged intent file cannot be replayed; skip it rather than wedge
      // every future sync. The operations it described either happened (and
      // are idempotent to re-plan) or will be re-planned from current state.
    }
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
  failures: { runId: string; op: IntentOp; error: string }[];
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
): Promise<ReplayReport> {
  const report: ReplayReport = {
    replayedRuns: 0,
    replayedOps: 0,
    recoveredCreates: [],
    failures: [],
  };

  for (const file of await listIntentFiles(dataSyncDir, provider)) {
    report.replayedRuns += 1;
    let failed = false;

    for (const op of file.ops) {
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
