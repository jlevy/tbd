/** `tbd integration` - Manage external tracker integrations. */

import { Command } from 'commander';

import { readConfig } from '../../file/config.js';
import { BaseCommand } from '../lib/base-command.js';
import { CLIError, requireInit } from '../lib/errors.js';
import { EXIT_OPERATIONAL_ERROR } from '../lib/exit-codes.js';
import { CREDENTIAL_ENV_VARS, resolveCredential } from '../../integrations/core/credentials.js';
import { enabledProviders, providerConfig } from '../../integrations/core/registry.js';
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
import { applyMirror, planMirror } from '../../integrations/core/mirror.js';
import { mirrorSet } from '../../integrations/core/selection.js';
import type { MirrorReport, TrackerAdapter } from '../../integrations/core/types.js';
import { withDataSyncContext } from '../lib/data-context.js';
import { listIssues, readIssue, writeIssue } from '../../file/storage.js';
import { formatDisplayId } from '../../lib/ids.js';
import { now } from '../../utils/time-utils.js';
import type { Config, ProviderNameType } from '../../lib/types.js';

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

interface MirrorOptions {
  provider?: string;
  dryRun?: boolean;
}

class MirrorHandler extends BaseCommand {
  async run(options: MirrorOptions): Promise<void> {
    const tbdRoot = await requireInit();
    const config = await readConfig(tbdRoot);

    const enabled = enabledProviders(config).filter(
      (entry) => !options.provider || entry.provider === options.provider,
    );
    if (enabled.length === 0) {
      throw new CLIError(
        'No enabled integration to mirror to. Run `tbd integration status` to see what is configured.',
      );
    }

    const dryRun = this.ctx.dryRun;
    const reports: MirrorReport[] = [];

    // The lock is held for the whole run: mirroring reads every bead and writes
    // link fields back, so a concurrent mutation would produce a plan that no
    // longer matches the store it is applied against.
    await withDataSyncContext(tbdRoot, { lock: !dryRun }, async (context) => {
      const allIssues = await listIssues(context.dataSyncDir);
      const prefix = config.display.id_prefix;
      const displayId = (id: string): string => formatDisplayId(id, context.mapping, prefix);

      for (const entry of enabled) {
        if (entry.configError) {
          throw new CLIError(entry.configError);
        }
        const credential = await resolveCredential(entry.provider, tbdRoot);
        if (!credential) {
          throw new CLIError(
            `${CREDENTIAL_ENV_VARS[entry.provider]} is not set. Run \`tbd integration status\` for details.`,
          );
        }

        const adapter = buildAdapter(entry.provider, credential.value, entry.target, config);
        const selected = mirrorSet(allIssues, entry.select, entry.provider);

        const plan = planMirror({
          provider: entry.provider,
          allIssues,
          selected,
          displayId,
          maxNesting: entry.maxNesting,
        });

        if (dryRun) {
          reports.push({
            provider: entry.provider,
            created: plan.creates.map((a) => displayId(a.bead.id)),
            updated: plan.updates.map((a) => displayId(a.bead.id)),
            skipped: plan.skips.map((a) => ({
              beadId: displayId(a.bead.id),
              reason: a.skipReason ?? 'skipped',
            })),
            failures: [],
          });
          continue;
        }

        reports.push(
          await applyMirror({
            adapter,
            plan,
            displayId,
            onLinked: async (issue, linkEntry) => {
              // Written only after the external item exists, so an interrupted
              // run leaves an unlinked external item rather than a link to
              // something that was never created.
              const stored = await readIssue(context.dataSyncDir, issue.id);
              const others = (stored.linked ?? []).filter(
                (existing) => existing.provider !== linkEntry.provider,
              );
              stored.linked = [...others, linkEntry];
              stored.version += 1;
              stored.updated_at = now();
              await writeIssue(context.dataSyncDir, stored);
            },
          }),
        );
      }
    });

    if (!this.ctx.quiet) {
      this.output.data(reports, () => {
        for (const report of reports) {
          const verb = dryRun ? 'would create' : 'created';
          const verb2 = dryRun ? 'would update' : 'updated';
          console.log(
            `${report.provider}: ${verb} ${report.created.length}, ${verb2} ${report.updated.length}, skipped ${report.skipped.length}, failed ${report.failures.length}`,
          );
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

/** Construct the adapter for a provider. */
function buildAdapter(
  provider: ProviderNameType,
  credential: string,
  target: string | undefined,
  config: Config,
): TrackerAdapter {
  if (provider !== 'linear') {
    throw new CLIError(`No adapter is implemented for ${provider} yet.`);
  }
  if (!target) {
    throw new CLIError('integrations.linear.team_key is required.');
  }
  return new LinearAdapter({
    client: new LinearClient({ apiKey: credential }),
    teamKey: target,
    createLabels: config.integrations?.linear?.create_labels ?? true,
  });
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
    new Command('mirror')
      .description('Project selected beads outward to a configured tracker')
      .option('--provider <name>', 'Limit to one provider')
      .action(async (options, command) => {
        const handler = new MirrorHandler(command);
        await handler.run(options);
      }),
  );

/** Exported for the doctor check, which reports the same findings. */
export { liveProbe };
export type { ProviderNameType };
export { providerConfig, resolveCredential };
