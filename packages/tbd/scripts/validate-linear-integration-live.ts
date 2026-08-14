#!/usr/bin/env -S pnpm exec tsx

/**
 * Bounded, API-driven release QA for the external-tracker compatibility contract.
 *
 * The provider API is the test driver and oracle. The candidate under test is the
 * built tbd CLI in a disposable repository. The same named scenario sequence is the
 * contract a future GitHub driver must implement.
 *
 * Required: LINEAR_API_KEY, --team <key>, and --project <name-or-slug>.
 * Optional: TBD_QA_BIN (packed/installed candidate) and TBD_QA_KEEP=1 (retain the
 * temp repo).
 */

import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { access, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parse, stringify } from 'yaml';
import { writeFile } from 'atomically';

import { MANAGED_BLOCK_MARKERS } from '../src/integrations/core/managed-block.js';
import { LiveCompatibilityChecklist } from './provider-live-qa-contract.js';
import { parseLinearLiveQaArgs } from './linear-live-qa-options.js';

const COMMAND_TIMEOUT_MS = 90_000;
const MAX_OUTPUT_BYTES = 5 * 1024 * 1024;
const LEGACY_MANAGED_BLOCK_PREFIX = '<!-- tbd:';
const packageDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const invocationDir = process.cwd();

interface CommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

interface CandidateCommand {
  command: string;
  prefixArgs: string[];
  displayName: string;
  pathToCheck: string | null;
}

interface LinearContext {
  teamId: string;
  projectId: string;
  viewerId: string;
  stateIdsByType: Record<string, string>;
}

interface LinearRef {
  id: string;
  key: string;
}

interface LinearIssueSnapshot {
  id: string;
  key: string;
  title: string;
  description: string | null;
  priority: number;
  stateType: string;
  assigneeId: string | null;
  parentId: string | null;
  archivedAt: string | null;
  commentBodies: string[];
  attachmentUrls: string[];
}

interface BeadListRow {
  id: string;
  internalId: string;
  title: string;
  status: string;
  priority: number;
  assignee?: string | null;
  parentId?: string;
}

type BeadSnapshot = Record<string, unknown> & {
  title: string;
  status: string;
  priority: number;
  assignee?: string;
  description?: string;
  parent_id?: string;
  extensions?: Record<string, unknown>;
};

function assertCondition(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function errorText(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  try {
    return JSON.stringify(error) ?? 'Unknown non-Error failure';
  } catch {
    return 'Unserializable non-Error failure';
  }
}

function resolveCandidateCommand(): CandidateCommand {
  const configured = process.env.TBD_QA_BIN?.trim();
  const defaultBin = join(packageDir, 'dist', 'bin.mjs');
  const candidate = configured === undefined || configured === '' ? defaultBin : configured;
  const looksLikePath =
    isAbsolute(candidate) ||
    candidate.includes(sep) ||
    candidate.startsWith('.') ||
    candidate.endsWith('.mjs');
  const resolvedCandidate = looksLikePath ? resolve(invocationDir, candidate) : candidate;
  const isJavaScriptEntry = /\.(?:c|m)?js$/u.test(resolvedCandidate);
  return {
    command: isJavaScriptEntry ? process.execPath : resolvedCandidate,
    prefixArgs: isJavaScriptEntry ? [resolvedCandidate] : [],
    displayName: resolvedCandidate,
    pathToCheck: looksLikePath ? resolvedCandidate : null,
  };
}

function sanitizedChildEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' };
  delete env.LINEAR_API_KEY;
  return env;
}

function runCommand(
  cwd: string,
  command: string,
  args: string[],
  env: NodeJS.ProcessEnv,
): Promise<CommandResult> {
  return new Promise((resolveResult, reject) => {
    const child = spawn(command, args, { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    let outputBytes = 0;
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
    }, COMMAND_TIMEOUT_MS);
    const collect = (target: 'stdout' | 'stderr', chunk: Buffer): void => {
      outputBytes += chunk.byteLength;
      if (outputBytes > MAX_OUTPUT_BYTES) {
        child.kill('SIGTERM');
        reject(new Error(`Command exceeded the QA output bound: ${command}`));
        return;
      }
      if (target === 'stdout') {
        stdout += chunk.toString('utf8');
      } else {
        stderr += chunk.toString('utf8');
      }
    };
    child.stdout.on('data', (chunk: Buffer) => {
      collect('stdout', chunk);
    });
    child.stderr.on('data', (chunk: Buffer) => {
      collect('stderr', chunk);
    });
    child.once('error', reject);
    child.once('close', (exitCode, signal) => {
      clearTimeout(timer);
      if (timedOut) {
        reject(new Error(`Command timed out: ${command} ${args.join(' ')}`));
      } else if (exitCode === null) {
        reject(new Error(`Command ended on signal ${signal ?? 'unknown'}: ${command}`));
      } else {
        resolveResult({ exitCode, stdout, stderr });
      }
    });
  });
}

function expectSuccess(result: CommandResult, label: string): string {
  assertCondition(
    result.exitCode === 0,
    `${label} exited ${result.exitCode}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
  );
  return result.stdout;
}

function expectReportOutput(result: CommandResult, label: string): string {
  assertCondition(
    result.exitCode === 0 || result.exitCode === 1,
    `${label} exited ${result.exitCode}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
  );
  return result.stdout;
}

function parseJson(text: string, label: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch (error) {
    throw new Error(`${label} did not emit valid JSON: ${String(error)}\n${text}`);
  }
}

class LinearApi {
  constructor(private readonly apiKey: string) {}

  async request<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
    const response = await fetch('https://api.linear.app/graphql', {
      method: 'POST',
      headers: { authorization: this.apiKey, 'content-type': 'application/json' },
      body: JSON.stringify({ query, variables }),
    });
    const payload = (await response.json()) as {
      data?: T;
      errors?: { message: string }[];
    };
    if (!response.ok || payload.errors || !payload.data) {
      const messages = payload.errors?.map((error) => error.message).join('; ') ?? 'no data';
      throw new Error(`Linear API request failed (${response.status}): ${messages}`);
    }
    return payload.data;
  }

  async context(teamKey: string, projectName: string): Promise<LinearContext> {
    const data = await this.request<{
      viewer: { id: string };
      teams: {
        nodes: {
          id: string;
          states: { nodes: { id: string; type: string; position: number }[] };
        }[];
      };
    }>(
      `query QaContext($team: String!) {
        viewer { id }
        teams(filter: { key: { eq: $team } }, first: 1) {
          nodes { id states(first: 50) { nodes { id type position } } }
        }
      }`,
      { team: teamKey },
    );
    const team = data.teams.nodes[0];
    assertCondition(team, `Linear team not found: ${teamKey}`);
    const stateIdsByType: Record<string, string> = {};
    for (const state of [...team.states.nodes].sort((a, b) => a.position - b.position)) {
      stateIdsByType[state.type] ??= state.id;
    }
    assertCondition(stateIdsByType.unstarted, `Linear team ${teamKey} has no unstarted state`);
    assertCondition(stateIdsByType.started, `Linear team ${teamKey} has no started state`);
    const projects: { id: string; name: string; slugId: string }[] = [];
    let projectsAfter: string | undefined;
    do {
      const page = await this.request<{
        projects: {
          pageInfo: { hasNextPage: boolean; endCursor: string | null };
          nodes: { id: string; name: string; slugId: string }[];
        };
      }>(
        `query QaProjects($first: Int!, $after: String) {
          projects(first: $first, after: $after) {
            pageInfo { hasNextPage endCursor }
            nodes { id name slugId }
          }
        }`,
        { first: 250, after: projectsAfter },
      );
      projects.push(...page.projects.nodes);
      projectsAfter = page.projects.pageInfo.hasNextPage
        ? (page.projects.pageInfo.endCursor ?? undefined)
        : undefined;
      if (!projectsAfter) {
        break;
      }
    } while (projectsAfter);
    const project = projects.find(
      (candidate) =>
        candidate.name.toLowerCase() === projectName.toLowerCase() ||
        candidate.slugId.toLowerCase() === projectName.toLowerCase(),
    );
    assertCondition(project, `Linear project not found: ${projectName}`);
    return {
      teamId: team.id,
      viewerId: data.viewer.id,
      stateIdsByType,
      projectId: project.id,
    };
  }

  async createIssue(
    context: LinearContext,
    title: string,
    description: string,
    options: { parentId?: string; projectId?: string | null } = {},
  ): Promise<LinearRef> {
    const projectId =
      options.projectId === undefined ? context.projectId : (options.projectId ?? undefined);
    const data = await this.request<{
      issueCreate: { success: boolean; issue: { id: string; identifier: string } | null };
    }>(
      `mutation QaIssueCreate($input: IssueCreateInput!) {
        issueCreate(input: $input) { success issue { id identifier } }
      }`,
      {
        input: {
          id: randomUUID(),
          teamId: context.teamId,
          ...(projectId ? { projectId } : {}),
          ...(options.parentId ? { parentId: options.parentId } : {}),
          title,
          description,
          priority: 3,
          ...(context.stateIdsByType.unstarted
            ? { stateId: context.stateIdsByType.unstarted }
            : {}),
        },
      },
    );
    assertCondition(
      data.issueCreate.success && data.issueCreate.issue,
      'Linear issueCreate failed',
    );
    return { id: data.issueCreate.issue.id, key: data.issueCreate.issue.identifier };
  }

  async updateIssue(id: string, input: Record<string, unknown>): Promise<void> {
    const data = await this.request<{ issueUpdate: { success: boolean } }>(
      `mutation QaIssueUpdate($id: String!, $input: IssueUpdateInput!) {
        issueUpdate(id: $id, input: $input) { success }
      }`,
      { id, input },
    );
    assertCondition(data.issueUpdate.success, `Linear issueUpdate failed for ${id}`);
  }

  async createComment(issueId: string, body: string): Promise<string> {
    const data = await this.request<{
      commentCreate: { success: boolean; comment: { id: string } | null };
    }>(
      `mutation QaCommentCreate($input: CommentCreateInput!) {
        commentCreate(input: $input) { success comment { id } }
      }`,
      { input: { id: randomUUID(), issueId, body } },
    );
    assertCondition(
      data.commentCreate.success && data.commentCreate.comment,
      `Linear commentCreate failed for ${issueId}`,
    );
    return data.commentCreate.comment.id;
  }

  async issue(id: string): Promise<LinearIssueSnapshot> {
    const data = await this.request<{
      issue: {
        id: string;
        identifier: string;
        title: string;
        description: string | null;
        priority: number;
        state: { type: string };
        assignee: { id: string } | null;
        parent: { id: string } | null;
        archivedAt: string | null;
        comments: { nodes: { body: string }[] };
        attachments: { nodes: { url: string }[] };
      } | null;
    }>(
      `query QaIssue($id: String!) {
        issue(id: $id) {
          id identifier title description priority archivedAt
          state { type }
          assignee { id }
          parent { id }
          comments(first: 250) { nodes { body } }
          attachments(first: 250) { nodes { url } }
        }
      }`,
      { id },
    );
    assertCondition(data.issue, `Linear issue disappeared: ${id}`);
    return {
      id: data.issue.id,
      key: data.issue.identifier,
      title: data.issue.title,
      description: data.issue.description,
      priority: data.issue.priority,
      stateType: data.issue.state.type,
      assigneeId: data.issue.assignee?.id ?? null,
      parentId: data.issue.parent?.id ?? null,
      archivedAt: data.issue.archivedAt,
      commentBodies: data.issue.comments.nodes.map((comment) => comment.body),
      attachmentUrls: data.issue.attachments.nodes.map((attachment) => attachment.url),
    };
  }

  async archiveIssue(id: string): Promise<void> {
    const data = await this.request<{ issueArchive: { success: boolean } }>(
      `mutation QaIssueArchive($id: String!) { issueArchive(id: $id) { success } }`,
      { id },
    );
    assertCondition(data.issueArchive.success, `Linear issueArchive failed for ${id}`);
  }
}

async function main(): Promise<void> {
  const args = parseLinearLiveQaArgs(process.argv.slice(2));
  const apiKey = process.env.LINEAR_API_KEY?.trim();
  assertCondition(apiKey, 'LINEAR_API_KEY is required. Load it from a gitignored .env file.');
  const candidate = resolveCandidateCommand();
  if (candidate.pathToCheck) {
    await access(candidate.pathToCheck);
  }
  const childEnv = sanitizedChildEnv();
  const api = new LinearApi(apiKey);
  const context = await api.context(args.team, args.project);
  const repoDir = await mkdtemp(join(tmpdir(), 'tbd-linear-live-qa-'));
  const token = `TBD-LIVE-QA-${new Date().toISOString()}-${randomUUID().slice(0, 8)}`;
  const checklist = new LiveCompatibilityChecklist((id) => {
    process.stdout.write(`✓ ${id}\n`);
  });
  const fixtures: LinearRef[] = [];

  const command = (program: string, commandArgs: string[]) =>
    runCommand(repoDir, program, commandArgs, childEnv);
  const tbd = (commandArgs: string[]) =>
    runCommand(repoDir, candidate.command, [...candidate.prefixArgs, ...commandArgs], childEnv);
  const list = async (): Promise<BeadListRow[]> =>
    parseJson(
      expectSuccess(await tbd(['list', '--all', '--json']), 'tbd list'),
      'list',
    ) as BeadListRow[];
  const show = async (id: string): Promise<BeadSnapshot> =>
    parseJson(
      expectSuccess(await tbd(['show', id, '--json']), `tbd show ${id}`),
      'show',
    ) as BeadSnapshot;
  const findBead = async (title: string): Promise<BeadListRow> => {
    const row = (await list()).find((candidateRow) => candidateRow.title === title);
    assertCondition(row, `Imported bead not found: ${title}`);
    return row;
  };

  let root!: LinearRef;
  let child!: LinearRef;
  let rootBead!: BeadListRow;
  let childBead!: BeadListRow;
  let configPath!: string;
  const initialTitle = `${token} root`;
  const localTitle = `${token} from tbd`;
  const remoteTitle = `${token} from Linear API`;
  const conflictLocalTitle = `${token} conflict winner from tbd`;
  const localComment = `${token} comment from tbd`;
  const remoteComment = `${token} comment from Linear API`;

  let scenarioFailure: unknown;
  let cleanupFailure: unknown;
  try {
    await checklist.run('setup', async () => {
      expectSuccess(await command('git', ['init', '-q', '--initial-branch=main']), 'git init');
      expectSuccess(
        await command('git', ['config', 'user.email', 'qa@example.invalid']),
        'git config',
      );
      expectSuccess(await command('git', ['config', 'user.name', 'tbd live QA']), 'git config');
      expectSuccess(await command('git', ['config', 'commit.gpgsign', 'false']), 'git config');
      await writeFile(join(repoDir, 'README.md'), '# tbd Linear live QA\n');
      await writeFile(join(repoDir, '.gitignore'), '.env\n');
      expectSuccess(await command('git', ['add', 'README.md', '.gitignore']), 'git add');
      expectSuccess(
        await command('git', ['commit', '-q', '-m', 'Initialize live QA']),
        'git commit',
      );
      expectSuccess(await tbd(['init', '--prefix=qa', '--force']), 'tbd init');
      configPath = join(repoDir, '.tbd', 'config.yml');
      const config = parse(await readFile(configPath, 'utf8')) as Record<string, unknown>;
      config.integrations = {
        sync_on_tbd_sync: false,
        linear: {
          enabled: true,
          team_key: args.team,
          ...(args.project ? { project: args.project } : {}),
          user_map: { 'qa-live-user': context.viewerId },
          policy: {
            outbound: {
              kinds: ['epic'],
              statuses: ['open', 'in_progress', 'blocked'],
              labels: [],
              specs: 'none',
              linked: true,
            },
            inbound: { mode: 'report', labels: [token], as_kind: 'task' },
            field_sync: {
              fields: {
                title: 'merge',
                description: 'merge',
                status: 'merge',
                priority: 'merge',
                labels: 'local',
                assignee: 'merge',
              },
              comments: 'two_way',
              tie_break: 'local',
            },
          },
        },
      };
      await writeFile(configPath, stringify(config));
      await writeFile(join(repoDir, '.env'), `LINEAR_API_KEY=${apiKey}\n`, { mode: 0o600 });
      expectSuccess(await tbd(['integration', 'status']), 'integration status');
    });

    await checklist.run('explicit-import', async () => {
      root = await api.createIssue(context, initialTitle, `${token} initial description`);
      fixtures.push(root);
      expectSuccess(
        await tbd(['integration', 'sync', '--pull', '--external', root.key, '--yes']),
        'explicit import',
      );
      rootBead = await findBead(initialTitle);
      const imported = await show(rootBead.id);
      assertCondition(imported.status === 'open', 'Imported status must be open');
      assertCondition(imported.priority === 2, 'Imported Linear medium priority must be P2');
      const link = imported.extensions?.linear as Record<string, unknown> | undefined;
      assertCondition(link?.id === root.id, 'Imported bead must link by the Linear UUID');
      assertCondition(
        (await api.issue(root.id)).attachmentUrls.length === 0,
        '--pull wrote Linear',
      );
    });

    await checklist.run('deferred-claim-replay', async () => {
      expectSuccess(await tbd(['integration', 'sync', '--yes']), 'claim replay');
      const remote = await api.issue(root.id);
      assertCondition(
        remote.attachmentUrls.some((url) => url.startsWith('tbd://bead/qa-')),
        'Full sync did not replay the deferred ownership claim',
      );
    });

    await checklist.run('tbd-to-provider-fields-comments-assignee', async () => {
      expectSuccess(
        await tbd([
          'update',
          rootBead.id,
          '--title',
          localTitle,
          '--description',
          `${token} local description`,
          '--status',
          'in_progress',
          '--priority',
          '1',
          '--assignee',
          'qa-live-user',
        ]),
        'local field update',
      );
      expectSuccess(
        await tbd(['integration', 'comment', rootBead.id, localComment]),
        'local comment',
      );
      expectSuccess(await tbd(['integration', 'sync', '--yes']), 'outbound sync');
      const remote = await api.issue(root.id);
      assertCondition(remote.title === localTitle, 'Linear title did not match the tbd edit');
      assertCondition(remote.stateType === 'started', 'Linear state did not map in_progress');
      assertCondition(remote.priority === 2, 'Linear priority did not map P1 to High');
      assertCondition(remote.assigneeId === context.viewerId, 'Mapped assignee did not round-trip');
      const remoteDescription = remote.description ?? '';
      assertCondition(
        remoteDescription.includes(`${token} local description`),
        'Description missing',
      );
      assertCondition(
        remoteDescription.includes(MANAGED_BLOCK_MARKERS.begin) &&
          remoteDescription.includes(MANAGED_BLOCK_MARKERS.end),
        'Description missing the current managed-block delimiters',
      );
      assertCondition(
        !remoteDescription.includes(LEGACY_MANAGED_BLOCK_PREFIX),
        'Description retained a legacy managed-block delimiter',
      );
      assertCondition(
        remote.commentBodies.filter((body) => body === localComment).length === 1,
        'Outbound comment was not posted exactly once',
      );
    });

    await checklist.run('provider-to-tbd-fields-comments-assignee', async () => {
      await api.updateIssue(root.id, {
        title: remoteTitle,
        description: `${token} remote description`,
        priority: 1,
        stateId: context.stateIdsByType.unstarted,
        assigneeId: null,
      });
      await api.createComment(root.id, remoteComment);
      expectSuccess(await tbd(['integration', 'sync', '--pull', '--yes']), 'inbound sync');
      rootBead = await findBead(remoteTitle);
      const local = await show(rootBead.id);
      assertCondition(
        local.description === `${token} remote description`,
        'Remote prose not pulled',
      );
      assertCondition(local.status === 'open', 'Remote unstarted state did not map to open');
      assertCondition(local.priority === 0, 'Remote urgent priority did not map to P0');
      assertCondition(local.assignee == null, 'Remote assignee clear did not pull');
      const serialized = JSON.stringify(local);
      assertCondition(serialized.includes(remoteComment), 'Remote comment did not enter the bead');
      assertCondition(!serialized.includes('@'), 'A user email leaked into the bead');

      await api.updateIssue(root.id, { assigneeId: context.viewerId });
      expectSuccess(await tbd(['integration', 'sync', '--pull', '--yes']), 'mapped assignee pull');
      const reassigned = await show(rootBead.id);
      assertCondition(reassigned.assignee === 'qa-live-user', 'Mapped assignee alias did not pull');
      assertCondition(!JSON.stringify(reassigned).includes('@'), 'A mapped user email leaked');
    });

    await checklist.run('provider-created-hierarchy', async () => {
      const childTitle = `${token} child from Linear API`;
      child = await api.createIssue(context, childTitle, `${token} child description`, {
        parentId: root.id,
      });
      fixtures.push(child);
      expectSuccess(
        await tbd(['integration', 'sync', '--pull', '--external', child.key, '--yes']),
        'child import',
      );
      childBead = await findBead(childTitle);
      const localChild = await show(childBead.id);
      assertCondition(
        localChild.parent_id === rootBead.internalId,
        'Imported child lost its parent',
      );
      assertCondition(
        (await api.issue(child.id)).parentId === root.id,
        'Provider child parent changed',
      );
    });

    await checklist.run('automatic-inbound-scope', async () => {
      const insideTitle = `${token} automatic project candidate`;
      const outsideTitle = `${token} automatic outside-project sentinel`;
      const inside = await api.createIssue(context, insideTitle, `${token} inside project`);
      const outside = await api.createIssue(context, outsideTitle, `${token} outside project`, {
        projectId: null,
      });
      fixtures.push(inside, outside);

      interface QaConfig {
        integrations: { linear: { policy: { inbound: { labels: string[] } } } };
      }
      const config = parse(await readFile(configPath, 'utf8')) as QaConfig;
      config.integrations.linear.policy.inbound.labels = [];
      await writeFile(configPath, stringify(config));
      try {
        // This is a real configured project, not a disposable provider scope.
        // Unrelated items can legitimately make the report exit 1 (for example,
        // an unlinked child whose parent is unavailable in this temporary repo).
        // The scenario owns only its two sentinels, so validate those from the
        // structured report rather than requiring every ambient item to import.
        const result = await tbd(['--json', 'integration', 'sync', '--pull']);
        const reports = parseJson(
          expectReportOutput(result, 'project-scoped inbound report'),
          'project-scoped inbound report',
        ) as {
          provider: string;
          importable: { id: string; title: string }[];
          failures: { beadId: string; error: string }[];
        }[];
        const report = reports.find((candidateReport) => candidateReport.provider === 'linear');
        assertCondition(report, 'Linear scope report was missing');
        const ownedSentinels = [
          inside.id,
          inside.key,
          insideTitle,
          outside.id,
          outside.key,
          outsideTitle,
        ];
        const ownedFailure = report.failures.find((failure) => {
          const serialized = JSON.stringify(failure);
          return ownedSentinels.some((sentinel) => serialized.includes(sentinel));
        });
        assertCondition(
          !ownedFailure,
          `Project-scoped inbound sync failed for a scenario-owned sentinel: ${JSON.stringify(ownedFailure)}`,
        );
        assertCondition(
          report.importable.some((candidateIssue) => candidateIssue.id === inside.id),
          'Automatic inbound scan missed an issue inside the configured project',
        );
        assertCondition(
          !report.importable.some((candidateIssue) => candidateIssue.id === outside.id),
          'Automatic inbound scan leaked an issue from outside the configured project',
        );
      } finally {
        config.integrations.linear.policy.inbound.labels = [token];
        await writeFile(configPath, stringify(config));
      }
    });

    await checklist.run('concurrent-conflict-recovery', async () => {
      await api.updateIssue(root.id, { title: `${token} conflict loser from Linear API` });
      expectSuccess(
        await tbd(['update', rootBead.id, '--title', conflictLocalTitle]),
        'conflicting local update',
      );
      expectSuccess(await tbd(['integration', 'sync', '--yes']), 'conflict sync');
      const remote = await api.issue(root.id);
      assertCondition(
        remote.title === conflictLocalTitle,
        'Configured local tie-break did not win',
      );
      assertCondition(
        remote.commentBodies.filter((body) => body.startsWith('**tbd sync conflict**')).length ===
          1,
        'Conflict recovery did not post exactly one report',
      );
    });

    await checklist.run('exact-once-settle', async () => {
      const before = await api.issue(root.id);
      const settled = expectSuccess(await tbd(['integration', 'sync', '--yes']), 'settle sync');
      const after = await api.issue(root.id);
      assertCondition(settled.includes('nothing to do'), 'Second full sync did not converge');
      assertCondition(
        after.commentBodies.length === before.commentBodies.length,
        'Settling duplicated a comment',
      );
    });

    await checklist.run('orphan-detection', async () => {
      await api.archiveIssue(child.id);
      const report = expectSuccess(
        await tbd(['integration', 'sync', '--pull', '--yes']),
        'orphan pull',
      );
      assertCondition(report.includes('orphan'), 'Archived Linear child was not reported orphaned');
    });
  } catch (error) {
    scenarioFailure = error;
  } finally {
    try {
      await checklist.run('cleanup', async () => {
        const cleanupFailures: string[] = [];
        for (const fixture of fixtures.reverse()) {
          try {
            if (!(await api.issue(fixture.id)).archivedAt) {
              await api.archiveIssue(fixture.id);
            }
          } catch (error) {
            cleanupFailures.push(`${fixture.key}: ${String(error)}`);
          }
        }
        if (process.env.TBD_QA_KEEP === '1') {
          process.stdout.write(`Retained disposable repository: ${repoDir}\n`);
        } else {
          await rm(repoDir, { recursive: true, force: true });
        }
        assertCondition(
          cleanupFailures.length === 0,
          `Linear fixture cleanup failed:\n${cleanupFailures.join('\n')}`,
        );
      });
    } catch (cleanupError) {
      cleanupFailure = cleanupError;
    }
  }
  if (cleanupFailure !== undefined) {
    const causes =
      scenarioFailure === undefined ? [cleanupFailure] : [scenarioFailure, cleanupFailure];
    throw new AggregateError(
      causes,
      `Linear live compatibility QA and fixture cleanup did not both succeed:\n${causes
        .map(errorText)
        .join('\n')}`,
    );
  }
  if (scenarioFailure !== undefined) {
    throw scenarioFailure instanceof Error
      ? scenarioFailure
      : new Error(errorText(scenarioFailure));
  }

  const completedCount = checklist.assertComplete();
  process.stdout.write(
    `Linear live compatibility QA passed (${completedCount} scenarios) with ${candidate.displayName}.\n`,
  );
}

main().catch((error: unknown) => {
  process.stderr.write(`${errorText(error)}\n`);
  process.exitCode = 1;
});
