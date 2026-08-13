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
import { join } from 'node:path';

import { checkBulkThreshold } from '../../integrations/core/bulk-guard.js';
import { CREDENTIAL_ENV_VARS, resolveCredential } from '../../integrations/core/credentials.js';
import { applyMirror, planMirror } from '../../integrations/core/mirror.js';
import { parseRepoSlug, specPermalink } from '../../integrations/core/permalink.js';
import { enabledProviders } from '../../integrations/core/registry.js';
import { mirrorSet } from '../../integrations/core/selection.js';
import { runSync, type SyncRunReport } from '../../integrations/core/sync-engine.js';
import type { MirrorReport, TrackerAdapter } from '../../integrations/core/types.js';
import { writeLink } from '../../integrations/core/link-store.js';
import { LinearAdapter } from '../../integrations/linear/adapter.js';
import { LinearClient } from '../../integrations/linear/client.js';
import { priorityToLinear } from '../../integrations/linear/mapping.js';
import { git, gitCommit } from '../../file/git.js';
import {
  loadIdMapping,
  resolveToInternalId,
  saveIdMapping,
  addIdMapping,
  generateUniqueShortId,
} from '../../file/id-mapping.js';
import { listIssues, readIssue, writeIssue } from '../../file/storage.js';
import { writeAtticEntryFile } from '../../file/attic-entry.js';
import { extractUlidFromInternalId, generateInternalId, formatDisplayId } from '../../lib/ids.js';
import { matchesSpecPath } from '../../lib/spec-matching.js';
import type {
  Config,
  IntegrationSelect,
  Issue,
  IssueKindType,
  IssueStatusType,
  PriorityType,
  ProviderNameType,
} from '../../lib/types.js';
import { now } from '../../utils/time-utils.js';
import { CLIError } from './errors.js';
import { checkParentAssignment, describeHierarchyProblem } from '../../lib/issue-hierarchy.js';

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
    userMap: config.integrations?.linear?.user_map,
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
  /** Explicit provider references selected by `sync --pull --external`. */
  externalRefs?: string[];
  /** Deliberately ignore a stale remote tbd attachment claim. */
  allowClaimedExternal?: boolean;
}

export interface IntegrationPushRunOptions {
  provider?: string;
  bead?: string[];
  type?: string;
  status?: string;
  label?: string[];
  spec?: string;
  limit?: string;
  assumeYes: boolean;
  interactive: boolean;
  dryRun: boolean;
}

function resolvePushSelection(
  options: IntegrationPushRunOptions,
  allIssues: Issue[],
  entry: ReturnType<typeof enabledProviders>[number],
  resolveBead: (ref: string) => string | undefined,
): Issue[] {
  if (options.bead?.length) {
    const wanted = new Map<string, string>();
    for (const ref of options.bead) {
      const internalId = resolveBead(ref);
      if (!internalId) {
        throw new CLIError(`Unknown bead: ${ref}`);
      }
      wanted.set(internalId, ref);
    }
    const found = allIssues.filter((issue) => wanted.has(issue.id));
    if (found.length !== wanted.size) {
      const foundIds = new Set(found.map((issue) => issue.id));
      const missing = [...wanted].filter(([id]) => !foundIds.has(id)).map(([, ref]) => ref);
      throw new CLIError(`Bead not found in the store: ${missing.join(', ')}`);
    }
    return found;
  }

  const usesFlags =
    options.type !== undefined ||
    options.status !== undefined ||
    options.spec !== undefined ||
    Boolean(options.label?.length);
  const select: IntegrationSelect = usesFlags
    ? {
        kinds: options.type ? [options.type as IssueKindType] : [],
        statuses: options.status ? [options.status as IssueStatusType] : [],
        labels: options.label ?? [],
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

/** Run the outbound-only projection shared by `integration sync --push` and `sync --push`. */
export async function runEnabledIntegrationPushes(
  context: { tbdRoot: string; config: Config; dataSyncDir: string; worktreePath: string },
  options: IntegrationPushRunOptions,
): Promise<MirrorReport[]> {
  const { tbdRoot, config, dataSyncDir } = context;
  const enabled = enabledProviders(config).filter(
    (entry) => !options.provider || entry.provider === options.provider,
  );
  if (enabled.length === 0) {
    throw new CLIError(
      'No enabled integration to push to. Run `tbd integration status` to see what is configured.',
    );
  }

  const allIssues = await listIssues(dataSyncDir);
  const mapping = await loadIdMapping(dataSyncDir);
  const displayId = (id: string): string => formatDisplayId(id, mapping, config.display.id_prefix);
  const specLinks = await resolveSpecLinks(tbdRoot, allIssues, config.sync.branch);
  const reports: MirrorReport[] = [];

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
    let selected = resolvePushSelection(options, allIssues, entry, (ref) => {
      try {
        return resolveToInternalId(ref, mapping);
      } catch {
        return undefined;
      }
    });
    if (options.limit !== undefined) {
      const limit = Number.parseInt(options.limit, 10);
      if (!Number.isInteger(limit) || limit < 1) {
        throw new CLIError(`--limit must be a positive integer, got: ${options.limit}`);
      }
      selected = [...selected].sort((a, b) => a.id.localeCompare(b.id)).slice(0, limit);
    }

    const plan = planMirror({
      provider: entry.provider,
      allIssues,
      selected,
      displayId,
      mirrorLabels: config.integrations?.linear?.mirror_labels ?? false,
      maxNesting: entry.maxNesting,
      canPushAssignee: (assignee) => adapter.canPushAssignee(assignee),
      specUrl: (issue) => (issue.spec_path ? specLinks.get(issue.spec_path) : undefined),
    });
    if (!options.dryRun) {
      const decision = checkBulkThreshold(
        { creates: plan.creates.length, updates: plan.updates.length },
        { assumeYes: options.assumeYes, interactive: options.interactive },
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

    if (options.dryRun) {
      reports.push({
        provider: entry.provider,
        created: plan.creates.map((action) => displayId(action.bead.id)),
        updated: plan.updates.map((action) => displayId(action.bead.id)),
        skipped: plan.skips.map((action) => ({
          beadId: displayId(action.bead.id),
          reason: action.skipReason ?? 'skipped',
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
          const stored = await readIssue(dataSyncDir, issue.id);
          const linkedIssue = writeLink(stored, linkEntry);
          linkedIssue.version += 1;
          linkedIssue.updated_at = now();
          await writeIssue(dataSyncDir, linkedIssue);
        },
      }),
    );
  }
  return reports;
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
  if (options.externalRefs && enabled.length !== 1) {
    throw new CLIError(
      'Explicit external references require exactly one provider; pass --provider <name>.',
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
    const externalIssueIds = options.externalRefs
      ? [
          ...new Set(
            await Promise.all(
              options.externalRefs.map(async (ref) => (await adapter.resolveRef(ref)).id),
            ),
          ),
        ]
      : undefined;

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
          let parent: Issue | undefined;
          if (input.parentId) {
            const currentIssues = await listIssues(dataSyncDir);
            const byId = new Map(currentIssues.map((issue) => [issue.id, issue]));
            parent = byId.get(input.parentId);
            if (!parent) {
              throw new CLIError(`Cannot import under missing parent ${input.parentId}.`);
            }
            const problem = checkParentAssignment(
              id,
              parent.id,
              (issueId) => byId.get(issueId)?.parent_id,
            );
            if (problem) {
              throw new CLIError(describeHierarchyProblem(problem, displayId));
            }
          }
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
            ...(input.parentId ? { parent_id: input.parentId } : {}),
            ...(input.assignee ? { assignee: input.assignee } : {}),
            ...(parent?.spec_path ? { spec_path: parent.spec_path } : {}),
          };
          await writeIssue(dataSyncDir, issue);
          if (parent && !parent.child_order_hints?.includes(id)) {
            parent.child_order_hints = [...(parent.child_order_hints ?? []), id];
            parent.version += 1;
            parent.updated_at = timestamp;
            await writeIssue(dataSyncDir, parent);
          }
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
        archiveConflict: async (conflict) => {
          const timestamp = now();
          const lostValue = JSON.stringify(conflict.lostValue) ?? String(conflict.lostValue);
          const filename = await writeAtticEntryFile(join(dataSyncDir, 'attic'), {
            entity_id: conflict.beadId,
            timestamp,
            field: conflict.field,
            lost_value: lostValue,
            winner_source: conflict.winnerSource,
            loser_source: conflict.winnerSource === 'local' ? 'remote' : 'local',
            context: {
              local_version: conflict.localVersion,
              // External trackers expose timestamps but no bead-style edit counter.
              remote_version: 0,
              local_updated_at: conflict.localUpdatedAt,
              remote_updated_at: conflict.remoteUpdatedAt,
            },
          });
          return `.tbd/data-sync/attic/${filename}`;
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
      externalIssueIds,
      allowClaimedExternal: options.allowClaimedExternal,
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
