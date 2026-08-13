/** `tbd integration` - Manage external tracker integrations. */

import { Command } from 'commander';
import { ulid } from 'ulid';

import { readConfig } from '../../file/config.js';
import { BaseCommand } from '../lib/base-command.js';
import { CLIError, requireInit } from '../lib/errors.js';
import { EXIT_OPERATIONAL_ERROR } from '../lib/exit-codes.js';
import { CREDENTIAL_ENV_VARS, resolveCredential } from '../../integrations/core/credentials.js';
import { providerConfig } from '../../integrations/core/registry.js';
import {
  hasErrors,
  integrationStatus,
  type IntegrationStatus,
  type ReachabilityProbe,
  type StatusFinding,
} from '../../integrations/core/status.js';
import { LinearClient } from '../../integrations/linear/client.js';
import { LinearAdapter } from '../../integrations/linear/adapter.js';
import { VIEWER_QUERY } from '../../integrations/linear/queries.js';
import type { MirrorReport } from '../../integrations/core/types.js';
import { withDataSyncContext } from '../lib/data-context.js';
import { listIssues, readIssue, writeIssue } from '../../file/storage.js';
import { formatDisplayId } from '../../lib/ids.js';
import { now } from '../../utils/time-utils.js';

import {
  buildAdapter,
  confirm,
  runEnabledIntegrationPushes,
  runEnabledIntegrations,
} from '../lib/integration-runner.js';
import type { SyncRunReport } from '../../integrations/core/sync-engine.js';
import { appendLocalComment } from '../../integrations/core/comment-store.js';
import { clearLink, readLink } from '../../integrations/core/link-store.js';
import {
  byExternalId,
  deleteLinkRecord,
  descriptionHash,
  listLinkRecords,
  writeLinkRecord,
} from '../../integrations/core/bridge-state.js';
import { writeLink } from '../../integrations/core/link-store.js';
import { resolveToInternalId } from '../../file/id-mapping.js';
import { assertExternalUnclaimed } from '../../integrations/core/link-guard.js';
import { beadAttachmentUrl } from '../../integrations/core/mirror.js';
import {
  deleteIntentFile,
  discardIntentOps,
  writeIntentFile,
} from '../../integrations/core/intents.js';
import type { ProviderNameType } from '../../lib/types.js';

/**
 * Verify a credential by making the cheapest authenticated call the provider
 * offers, then confirm the configured target resolves.
 */
const liveProbe: ReachabilityProbe = async (provider, credential, target) => {
  if (provider !== 'linear') {
    return { ok: false, detail: `no reachability probe implemented for ${provider}` };
  }
  try {
    const client = new LinearClient({ apiKey: credential });
    const data = await client.request<{
      viewer: { name: string };
      organization: { name: string };
    }>(VIEWER_QUERY);

    if (target) {
      // A valid key pointed at a team that does not exist is still broken.
      const adapter = new LinearAdapter({ client, teamKey: target });
      await adapter.ensureMeta();
    }
    return {
      ok: true,
      detail: `${data.viewer.name} @ ${data.organization.name}${target ? ` (team ${target})` : ''}`,
    };
  } catch (error) {
    return { ok: false, detail: error instanceof Error ? error.message : String(error) };
  }
};

const STATE_MARK: Record<StatusFinding['state'], string> = {
  ok: '✓',
  warn: '!',
  error: '✗',
  skipped: '-',
};

function printStatus(status: IntegrationStatus): void {
  if (status.inert) {
    console.log('No external tracker integrations are configured.');
    console.log('');
    console.log('To configure Linear, add to .tbd/config.yml:');
    console.log('');
    console.log('  integrations:');
    console.log('    linear:');
    console.log('      enabled: true');
    console.log('      team_key: FIN');
    console.log('');
    console.log(`Then set ${CREDENTIAL_ENV_VARS.linear} in your environment or a gitignored .env.`);
    return;
  }

  const line = (finding: StatusFinding, indent: string): void => {
    console.log(`${indent}${STATE_MARK[finding.state]} ${finding.label}: ${finding.detail}`);
    if (finding.remedy) {
      console.log(`${indent}  → ${finding.remedy}`);
    }
  };

  line(status.envFile, '');
  for (const provider of status.providers) {
    console.log('');
    console.log(`${provider.provider}:`);
    for (const finding of provider.findings) {
      line(finding, '  ');
    }
  }
}

interface StatusOptions {
  provider?: string;
  offline?: boolean;
}

class StatusHandler extends BaseCommand {
  async run(options: StatusOptions): Promise<void> {
    const tbdRoot = await requireInit();
    const config = await readConfig(tbdRoot);

    const status = await integrationStatus({
      config,
      repoRoot: tbdRoot,
      probe: options.offline ? undefined : liveProbe,
    });

    const filtered: IntegrationStatus = options.provider
      ? { ...status, providers: status.providers.filter((p) => p.provider === options.provider) }
      : status;

    if (!this.ctx.quiet) {
      this.output.data(filtered, () => {
        printStatus(filtered);
      });
    }

    if (hasErrors(filtered)) {
      process.exitCode = EXIT_OPERATIONAL_ERROR;
    }
  }
}

interface PushOptions {
  provider?: string;
  /** Direction flags, shaped exactly like `tbd sync`'s. */
  push?: boolean;
  pull?: boolean;
  /** Explicit bead IDs. Overrides every other selector. */
  bead?: string[];
  type?: string;
  status?: string;
  label?: string[];
  spec?: string;
  /** Cap the number mirrored, so a rollout can be staged. */
  limit?: string;
  /** Affirm a run that exceeds the bulk thresholds. */
  yes?: boolean;
}

function pushOnlySelector(options: PushOptions): string | undefined {
  const selectors: [flag: string, present: boolean][] = [
    ['--bead', Boolean(options.bead?.length)],
    ['--type', options.type !== undefined],
    ['--status', options.status !== undefined],
    ['--label', Boolean(options.label?.length)],
    ['--spec', options.spec !== undefined],
    ['--limit', options.limit !== undefined],
  ];
  return selectors.find(([, present]) => present)?.[0];
}

class PushHandler extends BaseCommand {
  async run(options: PushOptions): Promise<void> {
    const tbdRoot = await requireInit();
    const config = await readConfig(tbdRoot);
    const dryRun = this.ctx.dryRun;
    let reports: MirrorReport[] = [];

    // The lock is held for the whole run: mirroring reads every bead and writes
    // link fields back, so a concurrent mutation would produce a plan that no
    // longer matches the store it is applied against.
    await withDataSyncContext(tbdRoot, { lock: !dryRun }, async (context) => {
      reports = await runEnabledIntegrationPushes(
        {
          tbdRoot,
          config,
          dataSyncDir: context.dataSyncDir,
          worktreePath: context.sharedPaths.sharedWorktreePath,
        },
        {
          ...options,
          assumeYes: options.yes === true,
          interactive: process.stdin.isTTY,
          dryRun,
        },
      );
    });

    if (!this.ctx.quiet) {
      this.output.data(reports, () => {
        for (const report of reports) {
          const verb = dryRun ? 'would create' : 'created';
          const verb2 = dryRun ? 'would update' : 'updated';
          console.log(
            `${report.provider}: ${verb} ${report.created.length}, ${verb2} ${report.updated.length}, skipped ${report.skipped.length}, failed ${report.failures.length}`,
          );
          // Dry runs print the ids so the set can be reviewed, narrowed with
          // --bead, and mirrored in stages.
          if (dryRun) {
            for (const id of report.created) {
              console.log(`  + ${id}`);
            }
            for (const id of report.updated) {
              console.log(`  ~ ${id}`);
            }
          }
          for (const skip of report.skipped) {
            console.log(`  - ${skip.beadId}: ${skip.reason}`);
          }
          for (const failure of report.failures) {
            console.log(`  ✗ ${failure.beadId}: ${failure.error}`);
          }
        }
      });
    }

    if (reports.some((report) => report.failures.length > 0)) {
      process.exitCode = EXIT_OPERATIONAL_ERROR;
    }
  }
}

interface SyncOptions {
  provider?: string;
  yes?: boolean;
  push?: boolean;
  pull?: boolean;
  /** Resolved from the direction flags; `inbound` is `--pull`. */
  direction?: 'both' | 'inbound';
  external?: string[];
  force?: boolean;
}

/**
 * `tbd integration sync` — the full synchronization: replay, reconcile every
 * linked pair, then apply the policy's outbound and inbound clauses.
 */
class IntegrationSyncHandler extends BaseCommand {
  async run(options: SyncOptions): Promise<void> {
    const tbdRoot = await requireInit();
    const config = await readConfig(tbdRoot);
    const dryRun = this.ctx.dryRun;

    let reports: SyncRunReport[] = [];
    await withDataSyncContext(tbdRoot, { lock: !dryRun }, async (context) => {
      reports = await runEnabledIntegrations(
        {
          tbdRoot,
          config,
          dataSyncDir: context.dataSyncDir,
          worktreePath: context.sharedPaths.sharedWorktreePath,
        },
        {
          provider: options.provider,
          assumeYes: options.yes === true,
          interactive: process.stdin.isTTY,
          dryRun,
          direction: options.direction ?? 'both',
          externalRefs: options.external,
          allowClaimedExternal: options.force,
        },
      );
    });

    this.output.data(reports, () => {
      for (const report of reports) {
        printSyncReport(report, dryRun);
      }
    });
    if (reports.some((report) => report.failures.length > 0)) {
      process.exitCode = EXIT_OPERATIONAL_ERROR;
    }
  }
}

function printSyncReport(report: SyncRunReport, dryRun: boolean): void {
  const would = dryRun ? 'would ' : '';
  if (report.nothingToDo) {
    console.log(`${report.provider}: nothing to do`);
    return;
  }
  const parts = [
    report.replayedOps > 0 ? `replayed ${report.replayedOps}` : '',
    report.pushed.length > 0 ? `${would}push ${report.pushed.length}` : '',
    report.pulled.length > 0 ? `${would}pull ${report.pulled.length}` : '',
    report.commentsPushed > 0 ? `comments out ${report.commentsPushed}` : '',
    report.commentsPulled > 0 ? `comments in ${report.commentsPulled}` : '',
    report.createdOutbound.length > 0 ? `${would}create ${report.createdOutbound.length}` : '',
    report.importedInbound.length > 0 ? `${would}import ${report.importedInbound.length}` : '',
    report.conflicts.length > 0 ? `conflicts ${report.conflicts.length}` : '',
    report.orphaned.length > 0 ? `orphaned ${report.orphaned.length}` : '',
    report.failures.length > 0 ? `failed ${report.failures.length}` : '',
  ].filter(Boolean);
  console.log(`${report.provider}: ${parts.join(', ')}`);
  for (const conflict of report.conflicts) {
    console.log(`  ! ${conflict.beadId}: ${conflict.field} diverged; ${conflict.winner} kept`);
  }
  for (const overwrite of report.overwrites) {
    console.log(
      `  ~ ${overwrite.beadId}: ${overwrite.field} ${overwrite.direction} overwrote an edit`,
    );
  }
  for (const skipped of report.skippedPushes) {
    console.log(`  - ${skipped.beadId}: ${skipped.field} push unsupported; left divergent`);
  }
  for (const item of report.importable) {
    console.log(`  ? importable: ${item.key ?? item.id} ${item.title}`);
  }
  for (const orphan of report.orphaned) {
    console.log(`  x ${orphan}: external item archived or trashed`);
  }
  for (const failure of report.failures) {
    console.log(`  ✗ ${failure.beadId}: ${failure.error}`);
  }
}

/** `tbd integration comment` — author a comment offline; sync pushes it. */
class IntegrationCommentHandler extends BaseCommand {
  async run(beadRef: string, text: string, options: { provider?: string }): Promise<void> {
    const tbdRoot = await requireInit();
    const config = await readConfig(tbdRoot);
    const provider = (options.provider ?? 'linear') as ProviderNameType;

    await withDataSyncContext(tbdRoot, { lock: true }, async (context) => {
      const internalId = resolveToInternalId(beadRef, context.mapping);
      const stored = await readIssue(context.dataSyncDir, internalId);
      if (!readLink(stored, provider)) {
        throw new CLIError(
          `${beadRef} is not linked to ${provider}; link it or run \`tbd integration sync --push\` first.`,
        );
      }
      const { issue } = appendLocalComment(stored, provider, text, now());
      issue.version += 1;
      issue.updated_at = now();
      await writeIssue(context.dataSyncDir, issue);
      this.output.success(
        `Comment recorded on ${formatDisplayId(internalId, context.mapping, config.display.id_prefix)}; the next \`tbd integration sync\` posts it.`,
      );
    });
  }
}

/** `tbd integration link` — bind a bead to an existing external item. */
class IntegrationLinkHandler extends BaseCommand {
  async run(
    beadRef: string,
    externalRef: string,
    options: { provider?: string; take?: string; force?: boolean },
  ): Promise<void> {
    const tbdRoot = await requireInit();
    const config = await readConfig(tbdRoot);
    const provider = (options.provider ?? 'linear') as ProviderNameType;
    const entry = providerConfig(config, provider);
    if (!entry?.enabled) {
      throw new CLIError(`${provider} is not enabled.`);
    }
    const credential = await resolveCredential(provider, tbdRoot);
    if (!credential) {
      throw new CLIError(`${CREDENTIAL_ENV_VARS[provider]} is not set.`);
    }
    const adapter = buildAdapter(provider, credential.value, entry.target, config);
    const take = options.take;
    if (take !== undefined && take !== 'local' && take !== 'remote') {
      throw new CLIError('--take must be local or remote.');
    }

    await withDataSyncContext(tbdRoot, { lock: true }, async (context) => {
      const internalId = resolveToInternalId(beadRef, context.mapping);
      let stored = await readIssue(context.dataSyncDir, internalId);

      const existing = readLink(stored, provider);
      if (existing) {
        throw new CLIError(
          `${beadRef} is already linked to ${provider} (${existing.key ?? existing.id}). Unlink first.`,
        );
      }

      const ref = await adapter.resolveRef(externalRef);
      // One source per item: no other bead in this repo may hold this item.
      const records = await listLinkRecords(context.dataSyncDir, provider);
      const taken = byExternalId(records).get(ref.id);
      const allIssues = await listIssues(context.dataSyncDir);
      const holder =
        taken ??
        (allIssues.find(
          (issue) => issue.id !== internalId && readLink(issue, provider)?.id === ref.id,
        )
          ? { bead_id: allIssues.find((issue) => readLink(issue, provider)?.id === ref.id)!.id }
          : undefined);
      if (holder) {
        throw new CLIError(
          `${ref.key ?? ref.id} is already linked to ${formatDisplayId(holder.bead_id, context.mapping, config.display.id_prefix)}. Two beads double-writing one item is the ping-pong this guard exists to prevent.`,
        );
      }
      await assertExternalUnclaimed(
        adapter,
        ref.id,
        ref.key ?? externalRef,
        options.force === true,
      );

      const [remote] = await adapter.fetchIssues([ref.id]);
      if (!remote) {
        throw new CLIError(`Could not fetch ${externalRef} from ${provider}.`);
      }

      const equal =
        remote.title === stored.title &&
        remote.status === stored.status &&
        remote.priority === stored.priority &&
        descriptionHash(remote.description) === descriptionHash(stored.description ?? null);

      let stance: 'local' | 'remote' | undefined = take;
      if (!equal && !stance) {
        if (!process.stdin.isTTY) {
          throw new CLIError(
            'The bead and the external item differ; pass --take local or --take remote. ' +
              'Differing fields have no honest automatic answer at link time.',
          );
        }
        const takeLocal = await confirm(
          `Fields differ (e.g. title "${stored.title}" vs "${remote.title}"). Adopt the LOCAL bead values (they will push on the next sync)?`,
        );
        stance = takeLocal ? 'local' : 'remote';
      }

      if (!equal && stance === 'remote') {
        stored = {
          ...stored,
          title: remote.title,
          status: remote.status,
          priority: remote.priority,
          ...(remote.description != null ? { description: remote.description } : {}),
        };
      }

      stored = writeLink(stored, {
        provider,
        id: ref.id,
        key: ref.key ?? null,
        url: ref.url ?? null,
        linked_at: now(),
      });

      const displayId = formatDisplayId(internalId, context.mapping, config.display.id_prefix);
      const claim = {
        url: beadAttachmentUrl(displayId),
        title: `${displayId} · ${stored.kind}`,
        subtitle: `${stored.status} · P${stored.priority}`,
      };
      stored.version += 1;
      stored.updated_at = now();
      await writeIssue(context.dataSyncDir, stored);

      // Seed the base so the next sync flows the right direction: adopting
      // local means base := remote (local diffs push); adopting remote (or
      // equal values) means base := the now-shared values.
      await writeLinkRecord(context.dataSyncDir, provider, {
        type: 'lk',
        bead_id: internalId,
        external_id: ref.id,
        base: {
          title: remote.title,
          status: remote.status,
          priority: remote.priority,
          labels: remote.labels,
          assignee: remote.assignee,
          description_hash: descriptionHash(remote.description),
        },
        remote_updated_at: remote.updatedAt,
        synced_at: now(),
        state: 'linked',
      });

      // Persist the complete local link and its replayable ownership claim
      // before mutating the provider. A failed upsert leaves one linked bead
      // and one idempotent intent for the next full synchronization.
      const claimRunId = ulid().toLowerCase();
      await writeIntentFile(context.dataSyncDir, {
        type: 'in',
        run_id: claimRunId,
        provider,
        created_at: now(),
        ops: [{ kind: 'upsert_attachments', external_id: ref.id, attachments: [claim] }],
      });
      await adapter.upsertAttachments(ref.id, [claim]);
      await deleteIntentFile(context.dataSyncDir, provider, claimRunId);

      this.output.success(
        `Linked ${beadRef} to ${ref.key ?? ref.id}${equal ? '' : ` (took ${stance})`}.`,
      );
    });
  }
}

/** `tbd integration unlink` — sever links; absence survives merges. */
class IntegrationUnlinkHandler extends BaseCommand {
  async run(beadRefs: string[], options: { provider?: string }): Promise<void> {
    const tbdRoot = await requireInit();
    const provider = (options.provider ?? 'linear') as ProviderNameType;

    await withDataSyncContext(tbdRoot, { lock: true }, async (context) => {
      for (const beadRef of beadRefs) {
        const internalId = resolveToInternalId(beadRef, context.mapping);
        const stored = await readIssue(context.dataSyncDir, internalId);
        const link = readLink(stored, provider);
        if (!link) {
          this.output.info(`${beadRef} is not linked to ${provider}; nothing to do.`);
          continue;
        }
        const cleared = clearLink(stored, provider);
        cleared.version += 1;
        cleared.updated_at = now();
        await writeIssue(context.dataSyncDir, cleared);
        await deleteLinkRecord(context.dataSyncDir, provider, internalId);
        // Unlink is a cancellation boundary: no write planned for the former
        // pair may reach the provider afterward. The replay engine applies the
        // same rule from current bead state, covering a crash between these
        // steps and journals merged in from another machine.
        await discardIntentOps(context.dataSyncDir, provider, (op) => {
          if (op.kind === 'create_issue') {
            return op.bead_id === internalId || op.client_id === link.id;
          }
          return op.external_id === link.id;
        });
        this.output.success(`Unlinked ${beadRef} from ${provider}.`);
      }
    });
  }
}

export const integrationCommand = new Command('integration')
  .description('Manage external tracker integrations (Linear, GitHub)')
  .addCommand(
    new Command('status')
      .description('Report whether each integration is configured, credentialed, and reachable')
      .option('--provider <name>', 'Limit to one provider')
      .option('--offline', 'Skip network checks')
      .action(async (options, command) => {
        const handler = new StatusHandler(command);
        await handler.run(options);
      }),
  )
  .addCommand(
    new Command('sync')
      .description('Synchronize with a configured tracker (both directions by default)')
      .option('--push', 'Outbound only: project selected beads to the tracker')
      .option('--pull', 'Inbound only: pull tracker changes into beads')
      .option('--external <refs...>', 'With --pull, import exactly these external references')
      .option('--force', 'With --pull --external, ignore a stale remote tbd link claim')
      .option('--provider <name>', 'Limit to one provider')
      .option('--bead <ids...>', 'With --push, select these beads only')
      .option('-t, --type <type>', 'With --push, select by kind')
      .option('--status <status>', 'With --push, select by status')
      .option(
        '-l, --label <label>',
        'With --push, select by label (repeatable)',
        (value: string, previous: string[] | undefined) => [...(previous ?? []), value],
      )
      .option('--spec <path>', 'With --push, select beads linked to a spec path')
      .option('--limit <n>', 'With --push, select at most n beads')
      .option('-y, --yes', 'Confirm a run that exceeds the bulk-change thresholds')
      .action(async (rawOptions, command) => {
        const options = rawOptions as PushOptions & SyncOptions;
        // Same shape as `tbd sync`: bare is both directions, --push is
        // outbound only, --pull is inbound only, and the two are exclusive.
        if (options.push && options.pull) {
          throw new CLIError(
            '--push and --pull are mutually exclusive; omit both for a full sync.',
          );
        }
        if (options.external?.length && !options.pull) {
          throw new CLIError('--external is only valid with --pull.');
        }
        if (options.force && (!options.pull || !options.external?.length)) {
          throw new CLIError('--force is only valid with --pull --external.');
        }
        const invalidSelector = pushOnlySelector(options);
        if (!options.push && invalidSelector) {
          throw new CLIError(`${invalidSelector} is only valid with --push.`);
        }
        if (options.push) {
          // Outbound only is the projection: selected beads out, attachments
          // and the managed block refreshed, nothing read back for merging.
          const handler = new PushHandler(command);
          await handler.run(options);
          return;
        }
        const handler = new IntegrationSyncHandler(command);
        await handler.run({ ...options, direction: options.pull ? 'inbound' : 'both' });
      }),
  )
  .addCommand(
    new Command('comment')
      .description('Author a comment on a linked bead; the next sync posts it')
      .argument('<bead>', 'Bead ID')
      .argument('<text>', 'Comment text')
      .option('--provider <name>', 'Provider the bead is linked to (default: linear)')
      .action(async (bead, text, options, command) => {
        const handler = new IntegrationCommentHandler(command);
        await handler.run(bead, text, options);
      }),
  )
  .addCommand(
    new Command('link')
      .description('Link a bead to an existing external item')
      .argument('<bead>', 'Bead ID')
      .argument('<ref>', 'External reference (FIN-123, linear:FIN-123, or a URL)')
      .option('--provider <name>', 'Provider (default: linear)')
      .option('--take <side>', 'When fields differ: adopt local or remote values')
      .option('--force', 'Ignore a stale tbd link claim from another repository')
      .action(async (bead, ref, options, command) => {
        const handler = new IntegrationLinkHandler(command);
        await handler.run(bead, ref, options);
      }),
  )
  .addCommand(
    new Command('unlink')
      .description('Remove the link between beads and their external items')
      .argument('<beads...>', 'Bead IDs')
      .option('--provider <name>', 'Provider (default: linear)')
      .action(async (beads, options, command) => {
        const handler = new IntegrationUnlinkHandler(command);
        await handler.run(beads, options);
      }),
  );

/** Exported for the doctor check, which reports the same findings. */
export { liveProbe };
export type { ProviderNameType };
export { providerConfig, resolveCredential };
