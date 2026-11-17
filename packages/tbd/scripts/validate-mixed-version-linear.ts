#!/usr/bin/env tsx

/**
 * f08 T3: exercise a packed 0.8.1 client and the packed candidate against one
 * repository and the same Linear mock.
 *
 * The test deliberately records the compatibility boundary rather than pretending old
 * writers can be made safe retroactively. Candidate-only runs must converge and repair
 * the half-written duplicate state. A 0.8.1 writer is then allowed to demonstrate the
 * known Todo/Backlog contention; releases carrying this gate must name the candidate as
 * the minimum version for every clone that runs integration sync.
 */

import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { promisify } from 'node:util';

import { writeFile } from 'atomically';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';

import { LinearMockServer } from '../tests/helpers/linear-mock-server.js';

const execFileAsync = promisify(execFile);

interface Cli {
  path: string;
  launcherDir: string;
  version: string;
}

interface CliResult {
  code: number;
  stdout: string;
  stderr: string;
}

interface ListedIssue {
  id: string;
  internalId: string;
  title: string;
  status: string;
  resolution?: string | null;
  duplicate_of?: string | null;
}

interface SyncReport {
  pushed: string[];
  pulled: string[];
  failures: { beadId: string; error: string }[];
  skippedPushes: { beadId: string; field: string; reason?: string }[];
}

function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function requiredEnvironment(name: string): string {
  const value = process.env[name];
  invariant(value, `Missing ${name}`);
  return value;
}

async function git(directory: string, ...args: string[]): Promise<string> {
  const { stdout } = await execFileAsync('git', args, { cwd: directory, encoding: 'utf8' });
  return stdout.trim();
}

async function invoke(
  cli: Cli,
  repository: string,
  home: string,
  endpoint: string,
  args: string[],
): Promise<CliResult> {
  const options = {
    cwd: repository,
    env: {
      ...process.env,
      CODEX_HOME: join(home, '.codex'),
      FORCE_COLOR: '0',
      HOME: home,
      LINEAR_API_KEY: 'lin_api_mixed_version_qa',
      LINEAR_API_URL: endpoint,
      NO_COLOR: '1',
      PATH: `${cli.launcherDir}${delimiter}${process.env.PATH ?? ''}`,
      USERPROFILE: home,
    },
    encoding: 'utf8' as const,
    maxBuffer: 16 * 1024 * 1024,
  };
  try {
    const { stdout, stderr } = await execFileAsync(process.execPath, [cli.path, ...args], options);
    return { code: 0, stdout, stderr };
  } catch (error) {
    const failed = error as { code?: number; stdout?: string; stderr?: string };
    return {
      code: typeof failed.code === 'number' ? failed.code : 1,
      stdout: failed.stdout ?? '',
      stderr: failed.stderr ?? String(error),
    };
  }
}

function successful(result: CliResult, label: string): void {
  invariant(result.code === 0, `${label} failed\n${result.stdout}\n${result.stderr}`);
}

function json(result: CliResult, label: string): unknown {
  successful(result, label);
  try {
    return JSON.parse(result.stdout);
  } catch (error) {
    throw new Error(`${label} did not return JSON (${String(error)})\n${result.stdout}`);
  }
}

async function initializeRepository(
  root: string,
  label: string,
): Promise<{
  repository: string;
  home: string;
}> {
  const repository = join(root, `${label}-repository`);
  const remote = join(root, `${label}-remote.git`);
  const home = join(root, `${label}-home`);
  await mkdir(repository, { recursive: true });
  await mkdir(remote, { recursive: true });
  await mkdir(home, { recursive: true });
  await git(remote, 'init', '--bare', '--quiet');
  await git(repository, 'init', '--quiet', '--initial-branch=main');
  await git(repository, 'config', 'user.name', 'tbd mixed-version QA');
  await git(repository, 'config', 'user.email', 'tbd-mixed-version@example.invalid');
  await git(repository, 'config', 'commit.gpgSign', 'false');
  await writeFile(join(repository, 'README.md'), '# Mixed-version Linear QA\n');
  await git(repository, 'add', 'README.md');
  await git(repository, 'commit', '--message', 'Initialize mixed-version QA');
  await git(repository, 'remote', 'add', 'origin', remote);
  await git(repository, 'push', '--set-upstream', 'origin', 'main');
  return { repository, home };
}

async function configureIntegration(repository: string): Promise<void> {
  const path = join(repository, '.tbd', 'config.yml');
  const config = parseYaml(await readFile(path, 'utf8')) as Record<string, unknown> & {
    integrations?: Record<string, unknown>;
  };
  config.integrations = {
    on_tbd_sync: 'off',
    linear: {
      enabled: true,
      target: { team_key: 'FIN' },
      labels: { origin: false, repo: 'auto', mirror: 'none', create: 'tbd' },
      identity: { user_map: {} },
      policy: {
        outbound: {
          kinds: ['epic'],
          statuses: ['open', 'in_progress', 'blocked', 'closed'],
          labels: [],
          specs: 'none',
          linked: true,
          max_nesting: 2,
        },
        inbound: { mode: 'off', labels: [], as_kind: 'task' },
      },
    },
  };
  await writeFile(path, stringifyYaml(config, { lineWidth: 0 }));
  await git(repository, 'add', '--all');
  await git(repository, 'commit', '--message', 'Configure Linear mixed-version QA');
  await git(repository, 'push');
}

async function listed(
  cli: Cli,
  repository: string,
  home: string,
  endpoint: string,
): Promise<ListedIssue[]> {
  return json(
    await invoke(cli, repository, home, endpoint, ['list', '--all', '--json']),
    `${cli.version} list`,
  ) as ListedIssue[];
}

async function issueByTitle(
  cli: Cli,
  repository: string,
  home: string,
  endpoint: string,
  title: string,
): Promise<ListedIssue> {
  const issue = (await listed(cli, repository, home, endpoint)).find(
    (candidate) => candidate.title === title,
  );
  invariant(issue, `Could not find ${JSON.stringify(title)}`);
  return issue;
}

async function create(
  cli: Cli,
  repository: string,
  home: string,
  endpoint: string,
  title: string,
  args: string[] = [],
): Promise<ListedIssue> {
  successful(
    await invoke(cli, repository, home, endpoint, ['create', title, ...args]),
    `${cli.version} create ${title}`,
  );
  return issueByTitle(cli, repository, home, endpoint, title);
}

async function showIssue(
  cli: Cli,
  repository: string,
  home: string,
  endpoint: string,
  id: string,
): Promise<ListedIssue> {
  return json(
    await invoke(cli, repository, home, endpoint, ['show', id, '--json']),
    `${cli.version} show ${id}`,
  ) as ListedIssue;
}

async function candidateReport(
  candidate: Cli,
  repository: string,
  home: string,
  endpoint: string,
): Promise<SyncReport[]> {
  const result = await invoke(candidate, repository, home, endpoint, [
    '--json',
    'integration',
    'sync',
    '--yes',
  ]);
  return json(result, `${candidate.version} integration sync --json`) as SyncReport[];
}

function reportMoves(reports: readonly SyncReport[]): number {
  return reports.reduce(
    (total, report) => total + report.pushed.length + report.pulled.length + report.failures.length,
    0,
  );
}

function remoteByTitle(server: LinearMockServer, title: string) {
  const issue = [...server.issues.values()].find((candidate) => candidate.title === title);
  invariant(issue, `Linear mock has no issue titled ${JSON.stringify(title)}`);
  return issue;
}

async function validateDefaultTeam(root: string, candidate: Cli, baseline: Cli): Promise<boolean> {
  const server = new LinearMockServer();
  const endpoint = await server.start();
  try {
    const { repository, home } = await initializeRepository(root, 'linear-default');
    successful(
      await invoke(candidate, repository, home, endpoint, ['setup', '--auto', '--prefix=mix']),
      'candidate setup',
    );
    await configureIntegration(repository);

    const blocker = await create(candidate, repository, home, endpoint, 'Mixed blocker');
    const blocked = await create(candidate, repository, home, endpoint, 'Mixed blocked epic', [
      '--type=epic',
      '--depends-on',
      blocker.id,
    ]);
    const future = await create(candidate, repository, home, endpoint, 'Mixed future epic', [
      '--type=epic',
      '--defer=2099-01-01',
    ]);
    const review = await create(candidate, repository, home, endpoint, 'Mixed review epic', [
      '--type=epic',
    ]);
    const duplicateTarget = await create(
      candidate,
      repository,
      home,
      endpoint,
      'Mixed duplicate target',
    );
    const duplicate = await create(candidate, repository, home, endpoint, 'Mixed duplicate epic', [
      '--type=epic',
    ]);
    const rootEpic = await create(candidate, repository, home, endpoint, 'Mixed root epic', [
      '--type=epic',
    ]);
    const middleEpic = await create(candidate, repository, home, endpoint, 'Mixed middle epic', [
      '--type=epic',
      '--parent',
      rootEpic.id,
    ]);
    await create(candidate, repository, home, endpoint, 'Mixed deep epic', [
      '--type=epic',
      '--parent',
      middleEpic.id,
    ]);

    successful(
      await invoke(candidate, repository, home, endpoint, [
        'integration',
        'sync',
        '--push',
        '--bead',
        blocked.id,
        future.id,
        review.id,
        duplicate.id,
        rootEpic.id,
        middleEpic.id,
        '--yes',
      ]),
      'candidate initial projection',
    );
    await candidateReport(candidate, repository, home, endpoint);
    await candidateReport(candidate, repository, home, endpoint);

    const inReview = server.states.find((state) => state.name === 'In Review');
    invariant(inReview, 'Default mock team has no In Review state');
    const remoteReview = remoteByTitle(server, review.title);
    remoteReview.state = { ...inReview };
    remoteReview.updatedAt = new Date(Date.now() + 60_000).toISOString();
    for (let attempt = 0; attempt < 4; attempt += 1) {
      await candidateReport(candidate, repository, home, endpoint);
    }
    invariant(remoteReview.state.name === 'In Review', 'Candidate dragged In Review before mixing');

    successful(
      await invoke(candidate, repository, home, endpoint, [
        'close',
        duplicate.id,
        '--as=duplicate',
        '--duplicate-of',
        duplicateTarget.id,
      ]),
      'candidate duplicate close',
    );
    successful(
      await invoke(baseline, repository, home, endpoint, ['integration', 'sync', '--yes']),
      `${baseline.version} duplicate seed`,
    );
    successful(
      await invoke(baseline, repository, home, endpoint, [
        'integration',
        'sync',
        '--push',
        '--bead',
        blocked.id,
        future.id,
        '--yes',
      ]),
      `${baseline.version} staged projection`,
    );

    const alternating: CliResult[] = [];
    for (const cli of [candidate, baseline, candidate, baseline]) {
      const result = await invoke(cli, repository, home, endpoint, [
        'integration',
        'sync',
        '--yes',
      ]);
      successful(result, `${cli.version} alternating integration sync`);
      alternating.push(result);
    }
    const mixedQuiet = alternating
      .slice(-2)
      .every((result) => result.stdout.includes('nothing to do'));

    const recovery: SyncReport[][] = [];
    for (let attempt = 0; attempt < 5; attempt += 1) {
      recovery.push(await candidateReport(candidate, repository, home, endpoint));
    }
    for (const reports of recovery.slice(-2)) {
      invariant(
        reportMoves(reports) === 0,
        'Candidate did not settle after the old writer stopped',
      );
    }

    invariant(
      remoteByTitle(server, blocked.title).state.name === 'Backlog',
      'Blocked epic did not recover to Backlog',
    );
    invariant(
      remoteByTitle(server, future.title).state.name === 'Backlog',
      'Future-deferred epic did not recover to Backlog',
    );
    invariant(
      remoteByTitle(server, duplicate.title).state.name === 'Duplicate',
      '0.8.1 duplicate state did not repair to Duplicate',
    );
    const duplicateAfter = await showIssue(candidate, repository, home, endpoint, duplicate.id);
    invariant(
      duplicateAfter.resolution === 'duplicate' &&
        duplicateAfter.duplicate_of === duplicateTarget.internalId,
      'Duplicate pointer was lost during mixed-version repair',
    );
    invariant(
      ![...server.issues.values()].some((issue) => issue.title === 'Mixed deep epic'),
      'A deep child was silently flattened by one of the clients',
    );
    return mixedQuiet && remoteReview.state.name === 'In Review';
  } finally {
    await server.stop();
  }
}

async function validateNoBacklogTeam(
  root: string,
  candidate: Cli,
  baseline: Cli,
): Promise<boolean> {
  const server = new LinearMockServer();
  server.states = server.states.filter((state) => state.type !== 'backlog');
  const endpoint = await server.start();
  try {
    const { repository, home } = await initializeRepository(root, 'linear-no-backlog');
    successful(
      await invoke(candidate, repository, home, endpoint, ['setup', '--auto', '--prefix=nob']),
      'no-backlog candidate setup',
    );
    await configureIntegration(repository);
    const epic = await create(candidate, repository, home, endpoint, 'No Backlog epic', [
      '--type=epic',
    ]);
    successful(
      await invoke(candidate, repository, home, endpoint, [
        'integration',
        'sync',
        '--push',
        '--bead',
        epic.id,
      ]),
      'no-backlog initial projection',
    );
    await candidateReport(candidate, repository, home, endpoint);
    const blocker = await create(candidate, repository, home, endpoint, 'No Backlog blocker');
    successful(
      await invoke(candidate, repository, home, endpoint, ['dep', 'add', epic.id, blocker.id]),
      'no-backlog dependency',
    );

    const candidateExcluded = await candidateReport(candidate, repository, home, endpoint);
    const skipped = candidateExcluded.flatMap((report) => report.skippedPushes);
    invariant(
      skipped.some(
        (entry) => entry.field === 'status' && entry.reason?.includes('no backlog workflow state'),
      ),
      `Candidate did not report the missing Backlog state: ${JSON.stringify(skipped)}`,
    );
    invariant(
      reportMoves(candidateExcluded) === 0,
      'Candidate counted an unresolved Backlog write as completed work',
    );

    const oldRun = await invoke(baseline, repository, home, endpoint, [
      'integration',
      'sync',
      '--yes',
    ]);
    successful(oldRun, `${baseline.version} no-backlog sync`);
    const finalCandidate = await candidateReport(candidate, repository, home, endpoint);
    invariant(
      reportMoves(finalCandidate) === 0,
      'Candidate moved a no-Backlog pair after old sync',
    );
    invariant(
      remoteByTitle(server, epic.title).state.name === 'Todo',
      'A missing Backlog state caused an unreported state change',
    );
    return oldRun.stdout.includes('nothing to do');
  } finally {
    await server.stop();
  }
}

const candidate: Cli = {
  path: requiredEnvironment('TBD_MIXED_CANDIDATE_CLI'),
  launcherDir: requiredEnvironment('TBD_MIXED_CANDIDATE_LAUNCHER_DIR'),
  version: requiredEnvironment('TBD_MIXED_CANDIDATE_VERSION'),
};
const baseline: Cli = {
  path: requiredEnvironment('TBD_MIXED_BASELINE_CLI'),
  launcherDir: requiredEnvironment('TBD_MIXED_BASELINE_LAUNCHER_DIR'),
  version: requiredEnvironment('TBD_MIXED_BASELINE_VERSION'),
};
invariant(
  baseline.version === '0.8.1',
  `T3 requires the published 0.8.1 baseline, got ${baseline.version}`,
);

const temporaryRoot = await mkdtemp(join(tmpdir(), 'tbd-mixed-linear-'));
try {
  const defaultTeamQuiet = await validateDefaultTeam(temporaryRoot, candidate, baseline);
  const noBacklogQuiet = await validateNoBacklogTeam(temporaryRoot, candidate, baseline);
  const fullyMixedSafe = defaultTeamQuiet && noBacklogQuiet;
  invariant(
    !fullyMixedSafe,
    '0.8.1 unexpectedly became a safe concurrent integration-sync writer; revisit the release minimum and this gate.',
  );
  console.log(
    `Packed mixed-version Linear proof passed: ${candidate.version} converges after ` +
      `${baseline.version} stops writing; ${candidate.version} is the minimum version for every ` +
      'clone that runs integration sync.',
  );
} finally {
  await rm(temporaryRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}
