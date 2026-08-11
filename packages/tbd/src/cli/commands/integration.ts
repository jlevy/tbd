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
import { createInterface } from 'node:readline/promises';

import { checkBulkThreshold } from '../../integrations/core/bulk-guard.js';
import { parseRepoSlug, specPermalink } from '../../integrations/core/permalink.js';
import { writeLink } from '../../integrations/core/link-store.js';
import { git } from '../../file/git.js';
import { resolveToInternalId } from '../../file/id-mapping.js';
import { matchesSpecPath } from '../../lib/spec-matching.js';
import type {
  Config,
  IntegrationSelect,
  Issue,
  IssueKindType,
  IssueStatusType,
  PolicyDefinition,
  ProviderNameType,
} from '../../lib/types.js';

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

/**
 * Resolve which beads to mirror.
 *
 * Precedence is explicit over implicit: named beads win outright, then any
 * command-line selector replaces the configured policy, and only with neither
 * does the policy's `outbound` clause apply. This keeps the staged workflow
 * (mirror a few, then more, then everything) from requiring config edits.
 */
function resolveSelection(
  options: MirrorOptions,
  allIssues: Issue[],
  entry: { policy: PolicyDefinition; provider: ProviderNameType },
  resolveId: (id: string) => string | undefined,
): Issue[] {
  if (options.bead && options.bead.length > 0) {
    const wanted = new Map<string, string>();
    for (const ref of options.bead) {
      const internal = resolveId(ref);
      if (!internal) {
        throw new CLIError(`Unknown bead: ${ref}`);
      }
      wanted.set(internal, ref);
    }
    const found = allIssues.filter((issue) => wanted.has(issue.id));
    if (found.length !== wanted.size) {
      const missing = [...wanted.values()].filter(
        (ref) => !found.some((issue) => resolveId(ref) === issue.id),
      );
      throw new CLIError(`Bead not found in the store: ${missing.join(', ')}`);
    }
    return found;
  }

  const usesFlags =
    options.type !== undefined ||
    options.status !== undefined ||
    options.spec !== undefined ||
    (options.label !== undefined && options.label.length > 0);

  const select: IntegrationSelect = usesFlags
    ? {
        kinds: options.type ? [options.type as IssueKindType] : [],
        statuses: options.status ? [options.status as IssueStatusType] : [],
        labels: options.label ?? [],
        // A --spec flag means "beads carrying a spec"; the value narrows further
        // below via the shared matcher.
        specs: options.spec !== undefined ? 'any' : 'none',
        linked: false,
      }
    : entry.policy.outbound;

  let selected = mirrorSet(allIssues, select, entry.provider);

  if (options.spec) {
    selected = selected.filter(
      (issue) => issue.spec_path != null && matchesSpecPath(issue.spec_path, options.spec!),
    );
  }
  return selected;
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

      // Resolve spec permalinks once for the whole run. A spec lives on the
      // branch that authored it and may not exist on main, so a link built from
      // the bare path would 404 depending on who follows it.
      const specLinks = await resolveSpecLinks(tbdRoot, allIssues, config.sync.branch);

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

        let selected = resolveSelection(options, allIssues, entry, (ref) => {
          try {
            return resolveToInternalId(ref, context.mapping);
          } catch {
            return undefined;
          }
        });

        if (options.limit !== undefined) {
          const limit = Number.parseInt(options.limit, 10);
          if (!Number.isInteger(limit) || limit < 1) {
            throw new CLIError(`--limit must be a positive integer, got: ${options.limit}`);
          }
          // Deterministic order, so staging a rollout in batches covers the set
          // rather than re-mirroring an arbitrary subset each time.
          selected = [...selected].sort((a, b) => a.id.localeCompare(b.id)).slice(0, limit);
        }

        const plan = planMirror({
          provider: entry.provider,
          allIssues,
          selected,
          displayId,
          maxNesting: entry.maxNesting,
          mirrorLabels: config.integrations?.linear?.mirror_labels ?? false,
          specUrl: (issue) => (issue.spec_path ? specLinks.get(issue.spec_path) : undefined),
        });

        if (!dryRun) {
          // Affirm before touching a workspace at scale. A dry run is exempt:
          // it writes nothing, and previewing is exactly what we want to be easy.
          const decision = checkBulkThreshold(
            { creates: plan.creates.length, updates: plan.updates.length },
            { assumeYes: options.yes === true, interactive: process.stdin.isTTY },
          );
          if (decision.kind === 'refused') {
            throw new CLIError(decision.message);
          }
          if (decision.kind === 'needs-confirmation') {
            const ok = await confirm(
              `Mirror to ${entry.provider}: ${decision.reasons.join(' and ')}. Continue?`,
            );
            if (!ok) {
              throw new CLIError('Aborted.');
            }
          }
        }

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
              const linkedIssue = writeLink(stored, linkEntry);
              linkedIssue.version += 1;
              linkedIssue.updated_at = now();
              await writeIssue(context.dataSyncDir, linkedIssue);
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

/**
 * Build a permalink for every distinct spec path in the store.
 *
 * Returns an empty map when the repository has no GitHub remote, in which case
 * mirrored issues simply carry no spec link rather than a broken one.
 */
async function resolveSpecLinks(
  repoDir: string,
  issues: Issue[],
  syncBranch: string,
): Promise<Map<string, string>> {
  const links = new Map<string, string>();

  let slug;
  try {
    slug = parseRepoSlug(await git('-C', repoDir, 'remote', 'get-url', 'origin'));
  } catch {
    return links;
  }
  if (!slug) {
    return links;
  }

  let currentBranch = '';
  try {
    currentBranch = (await git('-C', repoDir, 'rev-parse', '--abbrev-ref', 'HEAD')).trim();
  } catch {
    // Detached HEAD or a fresh repo; the remaining candidates still apply.
  }

  // Prefer the branch in hand, then the usual trunks. The sync branch never
  // holds specs, so it is not a candidate.
  const candidates = [currentBranch, 'main', 'master'].filter(
    (branch): branch is string => branch.length > 0 && branch !== syncBranch,
  );

  const specPaths = new Set(
    issues.map((issue) => issue.spec_path).filter((path): path is string => Boolean(path)),
  );

  for (const specPath of specPaths) {
    const url = await specPermalink({ repoDir, specPath, slug, candidates });
    if (url) {
      links.set(specPath, url);
    }
  }
  return links;
}

/**
 * Ask a yes/no question on the terminal.
 *
 * Only reached when stdin is a TTY, so there is a human to answer.
 */
async function confirm(question: string): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stderr });
  try {
    const answer = await rl.question(`${question} [y/N] `);
    return /^y(es)?$/i.test(answer.trim());
  } finally {
    rl.close();
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
    project: config.integrations?.linear?.project,
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
      .description('Mirror selected beads outward to a configured tracker')
      .option('--provider <name>', 'Limit to one provider')
      .option('--bead <ids...>', 'Mirror these beads only (overrides all other selectors)')
      .option('-t, --type <type>', 'Select by kind: bug, feature, task, epic, chore')
      .option('--status <status>', 'Select by status')
      .option(
        '-l, --label <label>',
        'Select by label (repeatable)',
        (value: string, previous: string[] | undefined) => [...(previous ?? []), value],
      )
      .option('--spec <path>', 'Select beads linked to a spec path')
      .option('--limit <n>', 'Mirror at most n beads, for a staged rollout')
      .option('-y, --yes', 'Confirm a run that exceeds the bulk-change thresholds')
      .action(async (options, command) => {
        const handler = new MirrorHandler(command);
        await handler.run(options);
      }),
  );

/** Exported for the doctor check, which reports the same findings. */
export { liveProbe };
export type { ProviderNameType };
export { providerConfig, resolveCredential };
