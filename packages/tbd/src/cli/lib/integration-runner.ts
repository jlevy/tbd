/**
 * The reusable core of `tbd integration sync`: run every enabled provider's
 * full synchronization inside an already-held data-sync context.
 *
 * Two callers share it. The `tbd integration sync` command wraps it in its own
 * context and prints the reports. Plain `tbd sync` (with `sync_on_tbd_sync`
 * enabled) calls it from INSIDE `fullSync`, between the git pull/merge and the
 * push — after the merge so reconciliation sees other machines' bead changes
 * rather than pushing stale state to the tracker, and before the push so the
 * beads and bridge records it writes ride the same push out.
 */

import { createInterface } from 'node:readline/promises';

import { checkBulkThreshold } from '../../integrations/core/bulk-guard.js';
import { CREDENTIAL_ENV_VARS, resolveCredential } from '../../integrations/core/credentials.js';
import { parseRepoSlug, specPermalink } from '../../integrations/core/permalink.js';
import { enabledProviders } from '../../integrations/core/registry.js';
import { runSync, type SyncRunReport } from '../../integrations/core/sync-engine.js';
import type { TrackerAdapter } from '../../integrations/core/types.js';
import { LinearAdapter } from '../../integrations/linear/adapter.js';
import { LinearClient } from '../../integrations/linear/client.js';
import { priorityToLinear } from '../../integrations/linear/mapping.js';
import { git, gitCommit } from '../../file/git.js';
import {
  loadIdMapping,
  saveIdMapping,
  addIdMapping,
  generateUniqueShortId,
} from '../../file/id-mapping.js';
import { listIssues, readIssue, writeIssue } from '../../file/storage.js';
import { extractUlidFromInternalId, generateInternalId, formatDisplayId } from '../../lib/ids.js';
import type { Config, Issue, PriorityType, ProviderNameType } from '../../lib/types.js';
import { now } from '../../utils/time-utils.js';
import { CLIError } from './errors.js';

/** Construct the adapter for a provider. */
export function buildAdapter(
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
    // LINEAR_API_URL points the CLI at the mock server in golden tests; the
    // credential is still required so the auth path stays exercised.
    client: new LinearClient({ apiKey: credential, endpoint: process.env.LINEAR_API_URL }),
    teamKey: target,
    createLabels: config.integrations?.linear?.create_labels ?? true,
    project: config.integrations?.linear?.project,
  });
}

/**
 * Build a permalink for every distinct spec path in the store.
 *
 * Returns an empty map when the repository has no GitHub remote, in which case
 * mirrored issues simply carry no spec link rather than a broken one.
 */
export async function resolveSpecLinks(
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
export async function confirm(question: string): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stderr });
  try {
    const answer = await rl.question(`${question} [y/N] `);
    return /^y(es)?$/i.test(answer.trim());
  } finally {
    rl.close();
  }
}

export interface IntegrationRunOptions {
  /** Limit to one provider. */
  provider?: string;
  /** Affirm bulk thresholds without prompting. The folded run sets this. */
  assumeYes: boolean;
  /** Whether a terminal is available for confirmation prompts. */
  interactive: boolean;
  dryRun: boolean;
  /** `inbound` suppresses every external write; see the engine's `direction`. */
  direction?: 'both' | 'inbound';
}

/**
 * Run the full synchronization for every enabled provider.
 *
 * MUST be called while the data-sync lock is held and the worktree is current
 * (for the folded caller: after pull/merge, before push). Loads and saves the
 * id mapping itself. Throws `CLIError` for configuration problems; per-item
 * failures are contained inside the reports.
 */
export async function runEnabledIntegrations(
  context: { tbdRoot: string; config: Config; dataSyncDir: string; worktreePath: string },
  options: IntegrationRunOptions,
): Promise<SyncRunReport[]> {
  const { tbdRoot, config, dataSyncDir, worktreePath } = context;
  const enabled = enabledProviders(config).filter(
    (entry) => !options.provider || entry.provider === options.provider,
  );
  if (enabled.length === 0) {
    throw new CLIError(
      'No enabled integration to sync. Run `tbd integration status` to see what is configured.',
    );
  }

  const allIssues = await listIssues(dataSyncDir);
  const mapping = await loadIdMapping(dataSyncDir);
  const prefix = config.display.id_prefix;
  const displayId = (id: string): string => formatDisplayId(id, mapping, prefix);
  const specLinks = await resolveSpecLinks(tbdRoot, allIssues, config.sync.branch);

  const reports: SyncRunReport[] = [];
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

    const report = await runSync({
      provider: entry.provider,
      adapter,
      policy: entry.policy,
      dataSyncDir,
      allIssues,
      displayId,
      specUrl: (issue) => (issue.spec_path ? specLinks.get(issue.spec_path) : undefined),
      mirrorLabels: config.integrations?.linear?.mirror_labels ?? false,
      // Linear cannot represent P4 (its 4 covers P3 and P4); without this
      // equivalence every P4 bead would oscillate as a phantom pull.
      equivalences: {
        priority: (a, b) =>
          priorityToLinear(a as PriorityType) === priorityToLinear(b as PriorityType),
      },
      callbacks: {
        readBead: (id) => readIssue(dataSyncDir, id),
        writeBead: (issue) => writeIssue(dataSyncDir, issue),
        createBead: async (input) => {
          const id = generateInternalId();
          const shortId = generateUniqueShortId(mapping);
          addIdMapping(mapping, extractUlidFromInternalId(id), shortId);
          const timestamp = now();
          const issue: Issue = {
            type: 'is',
            id,
            version: 1,
            title: input.title,
            kind: input.kind,
            status: input.status,
            priority: input.priority,
            labels: [],
            dependencies: [],
            created_at: timestamp,
            updated_at: timestamp,
            ...(input.description != null ? { description: input.description } : {}),
          };
          await writeIssue(dataSyncDir, issue);
          await saveIdMapping(dataSyncDir, mapping);
          return issue;
        },
        afterJournal: async () => {
          // Durability point: the journal must be recorded before any
          // external write, so a crash replays instead of losing track.
          await git('-C', worktreePath, 'add', '-A');
          await gitCommit(worktreePath, '--no-verify', '-m', 'tbd integration: journal').catch(
            () => undefined,
          );
        },
        affirmBulk: async (counts) => {
          const decision = checkBulkThreshold(counts, {
            assumeYes: options.assumeYes,
            interactive: options.interactive,
          });
          if (decision.kind === 'refused') {
            throw new CLIError(decision.message);
          }
          if (decision.kind === 'needs-confirmation') {
            const ok = await confirm(
              `Sync with ${entry.provider}: ${decision.reasons.join(' and ')}. Continue?`,
            );
            if (!ok) {
              throw new CLIError('Aborted.');
            }
          }
        },
      },
      direction: options.direction ?? 'both',
      dryRun: options.dryRun,
      now,
    });
    reports.push(report);
  }

  if (!options.dryRun) {
    // Record the run: bead writes, base advances, journal cleanup — one
    // commit, so bases never advance in git without their writes.
    await git('-C', worktreePath, 'add', '-A');
    await gitCommit(worktreePath, '--no-verify', '-m', 'tbd integration: sync').catch(
      () => undefined,
    );
  }

  return reports;
}
