#!/usr/bin/env -S pnpm exec tsx

/**
 * Release-candidate smoke test for `tbd changes`, `tbd watch`, and `watch-beads`.
 *
 * The test builds a disposable bare remote with independent writer and watcher
 * clones. It exercises the actual candidate CLI and real Git subprocesses while
 * proving that watching leaves the caller worktree, sync refs, FETCH_HEAD, and
 * hidden sync worktree untouched.
 *
 * Set TBD_QA_BIN to test a packed or installed candidate instead of dist/bin.mjs.
 * Set TBD_QA_KEEP=1 to retain the temporary topology for investigation.
 *
 * See: tests/qa/watch-infrastructure-release.qa.md
 */

import { spawn } from 'node:child_process';
import { access, mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, resolve, sep } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

import { writeFile } from 'atomically';

import { gitSafeEnv } from '../src/lib/git-env.js';

const COMMAND_TIMEOUT_MS = 60_000;
const WATCH_TIMEOUT_MS = 45_000;
const MAX_OUTPUT_BYTES = 5 * 1024 * 1024;
const WATCH_SPEC_PATH = 'docs/watch-release-smoke.md';
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

interface SafetySnapshot {
  callerStatus: string;
  localSyncTip: string;
  remoteTrackingTip: string;
  fetchHead: string | null;
  hiddenWorktreeHead: string;
  hiddenWorktreeStatus: string;
  syncLockPresent: boolean;
  privateWatchRefs: string;
}

interface ChangeField {
  field: string;
  before: unknown;
  after: unknown;
}

interface IssueChange {
  id: string;
  fields: ChangeField[];
}

interface ChangeReport {
  since: string;
  tip: string;
  changes: IssueChange[];
}

interface SeededIssues {
  watchedId: string;
  unrelatedId: string;
  blockerId: string;
  readyId: string;
}

interface CreateIssueOptions {
  title: string;
  label: string;
  dependsOn: string | null;
}

/** Resolve the CLI under test without requiring a global install. */
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

/** Run a bounded subprocess and preserve stdout, stderr, and nonzero exit codes. */
function runCommand(
  cwd: string,
  command: string,
  args: string[],
  timeoutMs: number,
): Promise<CommandResult> {
  return new Promise((resolveResult, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: gitSafeEnv({ NO_COLOR: '1' }),
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    let outputBytes = 0;
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
    }, timeoutMs);

    const collect = (target: 'stdout' | 'stderr', chunk: Buffer): void => {
      outputBytes += chunk.byteLength;
      if (outputBytes > MAX_OUTPUT_BYTES) {
        child.kill('SIGTERM');
        reject(new Error(`Command exceeded ${MAX_OUTPUT_BYTES} bytes of output: ${command}`));
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
    child.once('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.once('close', (exitCode, signal) => {
      clearTimeout(timer);
      if (timedOut) {
        reject(new Error(`Command timed out after ${timeoutMs}ms: ${command} ${args.join(' ')}`));
        return;
      }
      if (exitCode === null) {
        reject(new Error(`Command ended on signal ${signal ?? 'unknown'}: ${command}`));
        return;
      }
      resolveResult({ exitCode, stdout, stderr });
    });
  });
}

function assertCondition(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function expectExit(result: CommandResult, expected: number, label: string): void {
  assertCondition(
    result.exitCode === expected,
    `${label} exited ${result.exitCode}, expected ${expected}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseJson(text: string, label: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch (error) {
    throw new Error(`${label} did not emit valid JSON: ${String(error)}\n${text}`);
  }
}

function requiredString(record: Record<string, unknown>, key: string, label: string): string {
  const value = record[key];
  assertCondition(typeof value === 'string', `${label}.${key} must be a string`);
  return value;
}

/** Validate only the stable report fields used by this release smoke test. */
function parseChangeReport(text: string, label: string): ChangeReport {
  const value = parseJson(text, label);
  assertCondition(isRecord(value), `${label} must be a JSON object`);
  assertCondition(Array.isArray(value.changes), `${label}.changes must be an array`);

  const changes = value.changes.map((rawChange, changeIndex): IssueChange => {
    assertCondition(isRecord(rawChange), `${label}.changes[${changeIndex}] must be an object`);
    assertCondition(
      Array.isArray(rawChange.fields),
      `${label}.changes[${changeIndex}].fields must be an array`,
    );
    const fields = rawChange.fields.map((rawField, fieldIndex): ChangeField => {
      assertCondition(
        isRecord(rawField),
        `${label}.changes[${changeIndex}].fields[${fieldIndex}] must be an object`,
      );
      return {
        field: requiredString(
          rawField,
          'field',
          `${label}.changes[${changeIndex}].fields[${fieldIndex}]`,
        ),
        before: rawField.before,
        after: rawField.after,
      };
    });
    return {
      id: requiredString(rawChange, 'id', `${label}.changes[${changeIndex}]`),
      fields,
    };
  });

  return {
    since: requiredString(value, 'since', label),
    tip: requiredString(value, 'tip', label),
    changes,
  };
}

async function git(cwd: string, args: string[]): Promise<string> {
  const result = await runCommand(cwd, 'git', args, COMMAND_TIMEOUT_MS);
  expectExit(result, 0, `git ${args.join(' ')}`);
  return result.stdout.trim();
}

async function runTbd(
  candidate: CandidateCommand,
  cwd: string,
  args: string[],
  timeoutMs: number,
): Promise<CommandResult> {
  return runCommand(cwd, candidate.command, [...candidate.prefixArgs, ...args], timeoutMs);
}

async function readOptional(path: string): Promise<string | null> {
  try {
    return await readFile(path, 'utf8');
  } catch (error) {
    const code = isRecord(error) ? error.code : undefined;
    if (code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch (error) {
    const code = isRecord(error) ? error.code : undefined;
    if (code === 'ENOENT') {
      return false;
    }
    throw error;
  }
}

async function remoteTip(remoteDir: string): Promise<string> {
  const output = await git(remoteDir, ['rev-parse', 'refs/heads/tbd-sync']);
  assertCondition(/^[0-9a-f]{40}$/u.test(output), `Remote tbd-sync tip is not a commit: ${output}`);
  return output;
}

async function createIssue(
  candidate: CandidateCommand,
  cwd: string,
  options: CreateIssueOptions,
): Promise<string> {
  const args = [
    'create',
    options.title,
    '--label',
    options.label,
    '--description',
    `${options.title} description`,
    '--json',
  ];
  if (options.dependsOn !== null) {
    args.push('--depends-on', options.dependsOn);
  }
  const result = await runTbd(candidate, cwd, args, COMMAND_TIMEOUT_MS);
  expectExit(result, 0, `tbd create ${options.title}`);
  const value = parseJson(result.stdout, `tbd create ${options.title}`);
  assertCondition(isRecord(value), `tbd create ${options.title} must emit a JSON object`);
  return requiredString(value, 'id', `tbd create ${options.title}`);
}

function expectSingleIssue(report: ChangeReport, issueId: string, label: string): IssueChange {
  assertCondition(report.changes.length === 1, `${label} must report exactly one bead`);
  const change = report.changes[0];
  assertCondition(
    change?.id === issueId,
    `${label} reported ${change?.id ?? 'no bead'}, expected ${issueId}`,
  );
  return change;
}

async function snapshotSafety(repoDir: string): Promise<SafetySnapshot> {
  const commonDir = await git(repoDir, ['rev-parse', '--path-format=absolute', '--git-common-dir']);
  const hiddenWorktree = join(commonDir, 'tbd', 'data-sync-worktree');
  const fetchHeadPath = await git(repoDir, [
    'rev-parse',
    '--path-format=absolute',
    '--git-path',
    'FETCH_HEAD',
  ]);

  return {
    callerStatus: await git(repoDir, ['status', '--porcelain=v1', '--untracked-files=all']),
    localSyncTip: await git(repoDir, ['rev-parse', 'refs/heads/tbd-sync']),
    remoteTrackingTip: await git(repoDir, ['rev-parse', 'refs/remotes/origin/tbd-sync']),
    fetchHead: await readOptional(fetchHeadPath),
    hiddenWorktreeHead: await git(hiddenWorktree, ['rev-parse', 'HEAD']),
    hiddenWorktreeStatus: await git(hiddenWorktree, [
      'status',
      '--porcelain=v1',
      '--untracked-files=all',
    ]),
    syncLockPresent: await pathExists(join(commonDir, 'tbd', 'locks', 'data-sync.lock')),
    privateWatchRefs: await git(repoDir, [
      'for-each-ref',
      '--format=%(refname)',
      'refs/tbd/watch/',
    ]),
  };
}

function assertSafetyUnchanged(before: SafetySnapshot, after: SafetySnapshot): void {
  assertCondition(
    JSON.stringify(after) === JSON.stringify(before),
    `Watch mutated protected Git state.\nBefore: ${JSON.stringify(before, null, 2)}\nAfter: ${JSON.stringify(after, null, 2)}`,
  );
}

async function runStep<T>(label: string, action: () => Promise<T>): Promise<T> {
  process.stdout.write(`• ${label} ... `);
  const startedAt = performance.now();
  const result = await action();
  const seconds = ((performance.now() - startedAt) / 1000).toFixed(1);
  process.stdout.write(`✓ ${seconds}s\n`);
  return result;
}

/** Execute the complete disposable release smoke topology. */
async function main(): Promise<void> {
  const candidate = resolveCandidateCommand();
  if (candidate.pathToCheck !== null) {
    await access(candidate.pathToCheck);
  }

  const keepTopology = process.env.TBD_QA_KEEP === '1';
  const root = await mkdtemp(join(tmpdir(), 'tbd-watch-release-'));
  const remoteDir = join(root, 'remote.git');
  const writerDir = join(root, 'writer');
  const watcherDir = join(root, 'watcher');
  let completed = false;

  console.log('tbd watch release-candidate smoke test');
  console.log(`Candidate: ${candidate.displayName}`);
  console.log(`Topology: ${root}`);

  try {
    await runStep('verify candidate CLI', async () => {
      const version = await runTbd(candidate, invocationDir, ['--version'], COMMAND_TIMEOUT_MS);
      expectExit(version, 0, 'tbd --version');
      assertCondition(version.stdout.trim() !== '', 'tbd --version returned no version');
    });

    await runStep('create bare remote and writer clone', async () => {
      await git(root, ['init', '--bare', '--initial-branch=main', remoteDir]);
      await git(root, ['init', '--initial-branch=main', writerDir]);
      await git(writerDir, ['config', 'user.email', 'watch-qa@example.com']);
      await git(writerDir, ['config', 'user.name', 'Watch Release QA']);
      await git(writerDir, ['config', 'commit.gpgsign', 'false']);
      await git(writerDir, ['remote', 'add', 'origin', remoteDir]);
      const specPath = join(writerDir, WATCH_SPEC_PATH);
      await mkdir(dirname(specPath), { recursive: true });
      await writeFile(specPath, '# Watch Release Smoke Fixture\n');
      await git(writerDir, ['add', WATCH_SPEC_PATH]);
      await git(writerDir, ['commit', '-m', 'Initial fixture']);
      await git(writerDir, ['push', '--set-upstream', 'origin', 'main']);

      const init = await runTbd(
        candidate,
        writerDir,
        ['init', '--prefix', 'wat', '--remote', 'origin'],
        COMMAND_TIMEOUT_MS,
      );
      expectExit(init, 0, 'tbd init');
      await git(writerDir, ['add', '--all']);
      await git(writerDir, ['commit', '-m', 'Initialize tbd']);
      await git(writerDir, ['push']);
    });

    const seeded = await runStep(
      'seed watched, unrelated, and readiness beads',
      async (): Promise<SeededIssues> => {
        const watched = await createIssue(candidate, writerDir, {
          title: 'Watched release smoke',
          label: 'watch-release',
          dependsOn: null,
        });
        const unrelated = await createIssue(candidate, writerDir, {
          title: 'Unrelated release smoke',
          label: 'unrelated-release',
          dependsOn: null,
        });
        const blocker = await createIssue(candidate, writerDir, {
          title: 'Readiness blocker release smoke',
          label: 'ready-blocker-release',
          dependsOn: null,
        });
        const ready = await createIssue(candidate, writerDir, {
          title: 'Becomes ready release smoke',
          label: 'ready-candidate-release',
          dependsOn: blocker,
        });
        const sync = await runTbd(
          candidate,
          writerDir,
          ['sync', '--issues', '--json'],
          COMMAND_TIMEOUT_MS,
        );
        expectExit(sync, 0, 'initial tbd sync');
        return {
          watchedId: watched,
          unrelatedId: unrelated,
          blockerId: blocker,
          readyId: ready,
        };
      },
    );
    const { watchedId, unrelatedId, blockerId, readyId } = seeded;
    const baselineTip = await remoteTip(remoteDir);

    await runStep('clone and initialize independent watcher', async () => {
      await git(root, ['clone', remoteDir, watcherDir]);
      await git(watcherDir, ['config', 'user.email', 'watch-qa@example.com']);
      await git(watcherDir, ['config', 'user.name', 'Watch Release QA']);
      await git(watcherDir, ['config', 'commit.gpgsign', 'false']);
      const pull = await runTbd(
        candidate,
        watcherDir,
        ['sync', '--issues', '--pull', '--json'],
        COMMAND_TIMEOUT_MS,
      );
      expectExit(pull, 0, 'watcher tbd sync --pull');
      const list = await runTbd(candidate, watcherDir, ['list', '--json'], COMMAND_TIMEOUT_MS);
      expectExit(list, 0, 'watcher tbd list');
      assertCondition(list.stdout.includes(watchedId), `Watcher clone cannot read ${watchedId}`);
    });

    const unrelatedTip = await runStep(
      'prove static selection ignores unrelated movement',
      async () => {
        const unrelated = await runTbd(
          candidate,
          writerDir,
          ['update', unrelatedId, '--add-label', 'moved-remotely', '--json'],
          COMMAND_TIMEOUT_MS,
        );
        expectExit(unrelated, 0, 'update unrelated bead');
        const sync = await runTbd(
          candidate,
          writerDir,
          ['sync', '--issues', '--json'],
          COMMAND_TIMEOUT_MS,
        );
        expectExit(sync, 0, 'sync unrelated bead');
        const tip = await remoteTip(remoteDir);
        const noMatch = await runTbd(
          candidate,
          writerDir,
          ['changes', '--since', baselineTip, '--bead', watchedId, '--json'],
          COMMAND_TIMEOUT_MS,
        );
        expectExit(noMatch, 3, 'tbd changes unrelated no-match');
        const report = parseChangeReport(noMatch.stdout, 'unrelated no-match report');
        assertCondition(report.changes.length === 0, 'Unrelated change matched the watched bead');
        assertCondition(report.tip === tip, 'No-match report did not advance to the unrelated tip');
        return tip;
      },
    );

    await runStep('pull the durable resume checkpoint into the watcher clone', async () => {
      const pull = await runTbd(
        candidate,
        watcherDir,
        ['sync', '--issues', '--pull', '--json'],
        COMMAND_TIMEOUT_MS,
      );
      expectExit(pull, 0, 'checkpoint tbd sync --pull');
      const localTip = await git(watcherDir, ['rev-parse', 'refs/heads/tbd-sync']);
      assertCondition(
        localTip === unrelatedTip,
        'Watcher did not pull the requested resume commit',
      );
    });

    const safetyBefore = await snapshotSafety(watcherDir);

    const watchPromise = runTbd(
      candidate,
      watcherDir,
      [
        'watch',
        '--bead',
        watchedId,
        '--since',
        unrelatedTip,
        '--interval',
        '10',
        '--timeout',
        '30',
        '--json',
      ],
      WATCH_TIMEOUT_MS,
    );

    await delay(1_000);
    const watchedTip = await runStep(
      'publish a selected change while watch is blocked',
      async () => {
        const update = await runTbd(
          candidate,
          writerDir,
          ['update', watchedId, '--notes', 'release smoke wake', '--json'],
          COMMAND_TIMEOUT_MS,
        );
        expectExit(update, 0, 'update watched bead');
        const sync = await runTbd(
          candidate,
          writerDir,
          ['sync', '--issues', '--json'],
          COMMAND_TIMEOUT_MS,
        );
        expectExit(sync, 0, 'sync watched bead');
        return remoteTip(remoteDir);
      },
    );

    await runStep('validate blocking watch report and stable JSON contract', async () => {
      const watched = await watchPromise;
      expectExit(watched, 0, 'tbd watch');
      assertCondition(watched.stderr === '', `tbd watch wrote diagnostics: ${watched.stderr}`);
      const report = parseChangeReport(watched.stdout, 'watch report');
      assertCondition(
        report.since === unrelatedTip,
        'Watch did not preserve the requested resume tip',
      );
      assertCondition(report.tip === watchedTip, 'Watch report tip does not match the remote tip');
      const watchedChange = expectSingleIssue(report, watchedId, 'Blocking watch');
      const notes = watchedChange.fields.find((field) => field.field === 'notes');
      assertCondition(notes?.before === null, 'Watch notes delta must start at null');
      assertCondition(notes.after === 'release smoke wake', 'Watch notes delta lost the new value');
    });

    await runStep('prove watch left protected Git state unchanged', async () => {
      const safetyAfter = await snapshotSafety(watcherDir);
      assertSafetyUnchanged(safetyBefore, safetyAfter);
    });

    const activeReadSafetyBefore = await snapshotSafety(watcherDir);
    const beadWatchPromise = runTbd(
      candidate,
      watcherDir,
      [
        'watch',
        '--bead',
        watchedId,
        '--since',
        watchedTip,
        '--interval',
        '10',
        '--timeout',
        '30',
        '--json',
      ],
      WATCH_TIMEOUT_MS,
    );
    const readyWatchPromise = runTbd(
      candidate,
      watcherDir,
      ['watch', '--ready', '--since', watchedTip, '--interval', '10', '--timeout', '30', '--json'],
      WATCH_TIMEOUT_MS,
    );

    await delay(1_000);
    await runStep('exercise existing workflows while both watches are active', async () => {
      for (const args of [
        ['show', watchedId, '--json'],
        ['list', '--label', 'watch-release', '--json'],
        ['ready', '--json'],
      ]) {
        const result = await runTbd(candidate, watcherDir, args, COMMAND_TIMEOUT_MS);
        expectExit(result, 0, `active-watch tbd ${args.join(' ')}`);
      }
      assertSafetyUnchanged(activeReadSafetyBefore, await snapshotSafety(watcherDir));

      const pull = await runTbd(
        candidate,
        watcherDir,
        ['sync', '--issues', '--pull', '--json'],
        COMMAND_TIMEOUT_MS,
      );
      expectExit(pull, 0, 'active-watch tbd sync --issues --pull --json');

      // Normal sync commands own their documented ref/worktree/fetch side effects.
      // Their resulting state becomes the baseline that watch itself may not change.
      const syncStatus = await runTbd(
        candidate,
        watcherDir,
        ['sync', '--status', '--json'],
        COMMAND_TIMEOUT_MS,
      );
      expectExit(syncStatus, 0, 'active-watch tbd sync --status --json');
    });
    const concurrentSafetyBefore = await snapshotSafety(watcherDir);
    assertCondition(
      concurrentSafetyBefore.localSyncTip === watchedTip,
      'sync --pull did not advance the local sync branch to the expected tip',
    );
    assertCondition(
      concurrentSafetyBefore.hiddenWorktreeHead === watchedTip,
      'sync --pull did not advance the hidden worktree to the expected tip',
    );
    assertCondition(
      concurrentSafetyBefore.remoteTrackingTip === watchedTip,
      'sync --status did not refresh the expected remote-tracking tip',
    );
    assertCondition(
      concurrentSafetyBefore.fetchHead?.includes(watchedTip) === true,
      'sync --status did not record the observed tip in FETCH_HEAD',
    );
    const concurrentTip = await runStep(
      'publish one commit for concurrent static and ready watchers',
      async () => {
        const update = await runTbd(
          candidate,
          writerDir,
          [
            'update',
            watchedId,
            '--notes',
            'concurrent watch wake',
            '--status',
            'in_progress',
            '--spec',
            WATCH_SPEC_PATH,
            '--json',
          ],
          COMMAND_TIMEOUT_MS,
        );
        expectExit(update, 0, 'update watched bead for concurrent wake');
        const close = await runTbd(
          candidate,
          writerDir,
          ['close', blockerId, '--json'],
          COMMAND_TIMEOUT_MS,
        );
        expectExit(close, 0, 'close readiness blocker');
        const sync = await runTbd(
          candidate,
          writerDir,
          ['sync', '--issues', '--json'],
          COMMAND_TIMEOUT_MS,
        );
        expectExit(sync, 0, 'sync concurrent watcher changes');
        return remoteTip(remoteDir);
      },
    );

    await runStep('validate concurrent static and dynamic watch reports', async () => {
      const [beadWatch, readyWatch] = await Promise.all([beadWatchPromise, readyWatchPromise]);
      expectExit(beadWatch, 0, 'concurrent bead watch');
      expectExit(readyWatch, 0, 'concurrent ready watch');
      assertCondition(beadWatch.stderr === '', `Concurrent bead watch wrote diagnostics`);
      assertCondition(readyWatch.stderr === '', `Concurrent ready watch wrote diagnostics`);

      const beadReport = parseChangeReport(beadWatch.stdout, 'concurrent bead watch report');
      assertCondition(beadReport.since === watchedTip, 'Concurrent bead watch lost its baseline');
      assertCondition(beadReport.tip === concurrentTip, 'Concurrent bead watch reported wrong tip');
      const watchedChange = expectSingleIssue(beadReport, watchedId, 'Concurrent bead watch');
      const status = watchedChange.fields.find((field) => field.field === 'status');
      const spec = watchedChange.fields.find((field) => field.field === 'spec_path');
      assertCondition(status?.before === 'open', 'Status delta must begin at open');
      assertCondition(status.after === 'in_progress', 'Status delta lost in_progress');
      assertCondition(spec?.before === null, 'Spec delta must begin at null');
      assertCondition(spec.after === WATCH_SPEC_PATH, 'Spec delta lost the configured path');

      const readyReport = parseChangeReport(readyWatch.stdout, 'concurrent ready watch report');
      assertCondition(readyReport.since === watchedTip, 'Ready watch lost its baseline');
      assertCondition(readyReport.tip === concurrentTip, 'Ready watch reported wrong tip');
      const readyChange = expectSingleIssue(readyReport, readyId, 'Concurrent ready watch');
      assertCondition(
        readyChange.fields.length === 0,
        'A dependency-only readiness edge must not invent field changes',
      );
    });

    await runStep('prove concurrent watches left protected Git state unchanged', async () => {
      const concurrentSafetyAfter = await snapshotSafety(watcherDir);
      assertSafetyUnchanged(concurrentSafetyBefore, concurrentSafetyAfter);
    });

    await runStep('validate changes modes and stable exit codes', async () => {
      const selected = await runTbd(
        candidate,
        writerDir,
        ['changes', '--since', watchedTip, '--label', 'watch-release', '--json'],
        COMMAND_TIMEOUT_MS,
      );
      expectExit(selected, 0, 'tbd changes selected');
      const selectedReport = parseChangeReport(selected.stdout, 'selected changes report');
      expectSingleIssue(selectedReport, watchedId, 'Label-selected changes');

      const statusSelected = await runTbd(
        candidate,
        writerDir,
        ['changes', '--since', watchedTip, '--status', 'in_progress', '--json'],
        COMMAND_TIMEOUT_MS,
      );
      expectExit(statusSelected, 0, 'tbd changes status selection');
      expectSingleIssue(
        parseChangeReport(statusSelected.stdout, 'status-selected changes report'),
        watchedId,
        'Status-selected changes',
      );

      const specSelected = await runTbd(
        candidate,
        writerDir,
        ['changes', '--since', watchedTip, '--spec', WATCH_SPEC_PATH, '--json'],
        COMMAND_TIMEOUT_MS,
      );
      expectExit(specSelected, 0, 'tbd changes spec selection');
      expectSingleIssue(
        parseChangeReport(specSelected.stdout, 'spec-selected changes report'),
        watchedId,
        'Spec-selected changes',
      );

      const readySelected = await runTbd(
        candidate,
        writerDir,
        ['changes', '--since', watchedTip, '--ready', '--json'],
        COMMAND_TIMEOUT_MS,
      );
      expectExit(readySelected, 0, 'tbd changes ready selection');
      const readyChange = expectSingleIssue(
        parseChangeReport(readySelected.stdout, 'ready-selected changes report'),
        readyId,
        'Ready-selected changes',
      );
      assertCondition(
        readyChange.fields.length === 0,
        'Ready-selected changes must preserve the dependency-only edge',
      );

      const allSelected = await runTbd(
        candidate,
        writerDir,
        ['changes', '--since', watchedTip, '--all', '--json'],
        COMMAND_TIMEOUT_MS,
      );
      expectExit(allSelected, 0, 'tbd changes all selection');
      const allReport = parseChangeReport(allSelected.stdout, 'all-selected changes report');
      const allIds = new Set(allReport.changes.map((change) => change.id));
      assertCondition(
        allReport.changes.length === 2 && allIds.has(watchedId) && allIds.has(blockerId),
        'All-selected changes must report exactly the updated bead and closed blocker',
      );

      const multipleBeads = await runTbd(
        candidate,
        writerDir,
        ['changes', '--since', watchedTip, '--bead', watchedId, unrelatedId, '--json'],
        COMMAND_TIMEOUT_MS,
      );
      expectExit(multipleBeads, 0, 'tbd changes multiple beads');
      expectSingleIssue(
        parseChangeReport(multipleBeads.stdout, 'multiple-bead changes report'),
        watchedId,
        'Multiple-bead changes',
      );

      const human = await runTbd(
        candidate,
        writerDir,
        ['changes', '--since', watchedTip, '--bead', watchedId],
        COMMAND_TIMEOUT_MS,
      );
      expectExit(human, 0, 'tbd changes human output');
      assertCondition(human.stderr === '', 'Human change report wrote diagnostics');
      for (const requiredText of [watchedTip, concurrentTip, watchedId, 'concurrent watch wake']) {
        assertCondition(
          human.stdout.includes(requiredText),
          `Human change report is missing ${requiredText}`,
        );
      }

      const quiet = await runTbd(
        candidate,
        writerDir,
        ['changes', '--since', watchedTip, '--label', 'watch-release', '--quiet'],
        COMMAND_TIMEOUT_MS,
      );
      expectExit(quiet, 0, 'tbd changes quiet');
      assertCondition(quiet.stdout === '', 'Quiet change report wrote to stdout');
      assertCondition(quiet.stderr === '', 'Quiet change report wrote to stderr');

      const noChanges = await runTbd(
        candidate,
        writerDir,
        ['changes', '--since', concurrentTip, '--json'],
        COMMAND_TIMEOUT_MS,
      );
      expectExit(noChanges, 3, 'tbd changes no-change');
      assertCondition(
        parseChangeReport(noChanges.stdout, 'no-change report').changes.length === 0,
        'No-change report must be empty',
      );

      const usage = await runTbd(
        candidate,
        writerDir,
        ['changes', '--since', watchedTip, '--all', '--label', 'watch-release'],
        COMMAND_TIMEOUT_MS,
      );
      expectExit(usage, 2, 'tbd changes usage error');

      const timeout = await runTbd(
        candidate,
        writerDir,
        ['watch', '--all', '--timeout', '0', '--json'],
        COMMAND_TIMEOUT_MS,
      );
      expectExit(timeout, 3, 'tbd watch timeout');
      assertCondition(timeout.stdout === '', 'Timed-out watch must not emit a report');

      const originalRemoteUrl = await git(writerDir, ['remote', 'get-url', 'origin']);
      await git(writerDir, ['remote', 'set-url', 'origin', join(root, 'missing-remote.git')]);
      try {
        const operational = await runTbd(
          candidate,
          writerDir,
          ['watch', '--all', '--timeout', '0', '--json'],
          COMMAND_TIMEOUT_MS,
        );
        expectExit(operational, 1, 'tbd watch operational error');
        assertCondition(operational.stdout === '', 'Operational error wrote to stdout');
        const error = parseJson(operational.stderr, 'watch operational error');
        assertCondition(isRecord(error), 'Watch operational error must be a JSON object');
        assertCondition(
          typeof error.error === 'string' && error.error.includes('Failed to read remote sync tip'),
          'Watch operational error lost its recovery context',
        );
      } finally {
        await git(writerDir, ['remote', 'set-url', 'origin', originalRemoteUrl]);
      }
    });

    await runStep('validate watch human and quiet modes without Git-state mutation', async () => {
      const outputSafetyBefore = await snapshotSafety(watcherDir);
      const human = await runTbd(
        candidate,
        watcherDir,
        ['watch', '--bead', watchedId, '--since', watchedTip, '--timeout', '0'],
        COMMAND_TIMEOUT_MS,
      );
      expectExit(human, 0, 'tbd watch human output');
      assertCondition(human.stderr === '', 'Human watch report wrote diagnostics');
      for (const requiredText of [watchedTip, concurrentTip, watchedId, 'concurrent watch wake']) {
        assertCondition(
          human.stdout.includes(requiredText),
          `Human watch report is missing ${requiredText}`,
        );
      }

      const quiet = await runTbd(
        candidate,
        watcherDir,
        ['watch', '--bead', watchedId, '--since', watchedTip, '--timeout', '0', '--quiet'],
        COMMAND_TIMEOUT_MS,
      );
      expectExit(quiet, 0, 'tbd watch quiet');
      assertCondition(quiet.stdout === '', 'Quiet watch wrote to stdout');
      assertCondition(quiet.stderr === '', 'Quiet watch wrote to stderr');
      assertSafetyUnchanged(outputSafetyBefore, await snapshotSafety(watcherDir));
    });

    await runStep('pull normally and verify existing workflows still work', async () => {
      const pull = await runTbd(
        candidate,
        watcherDir,
        ['sync', '--issues', '--pull', '--json'],
        COMMAND_TIMEOUT_MS,
      );
      expectExit(pull, 0, 'post-watch tbd sync --pull');

      for (const args of [
        ['show', watchedId, '--json'],
        ['list', '--label', 'watch-release', '--json'],
        ['sync', '--status', '--json'],
      ]) {
        const result = await runTbd(candidate, watcherDir, args, COMMAND_TIMEOUT_MS);
        expectExit(result, 0, `tbd ${args.join(' ')}`);
      }

      const ready = await runTbd(candidate, watcherDir, ['ready', '--json'], COMMAND_TIMEOUT_MS);
      expectExit(ready, 0, 'tbd ready after watch');
      assertCondition(ready.stdout.includes(readyId), `Ready output is missing ${readyId}`);

      const shortcut = await runTbd(
        candidate,
        watcherDir,
        ['shortcut', 'watch-beads'],
        COMMAND_TIMEOUT_MS,
      );
      expectExit(shortcut, 0, 'tbd shortcut watch-beads');
      for (const requiredText of ['pending', 'checkpoint', '--since']) {
        assertCondition(
          shortcut.stdout.includes(requiredText),
          `watch-beads shortcut is missing ${requiredText}`,
        );
      }
    });

    completed = true;
    console.log('✓ Watch release-candidate smoke test passed');
  } finally {
    if (keepTopology) {
      console.log(`Retained QA topology: ${root}`);
    } else {
      await rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
      console.log(completed ? '✓ Disposable topology removed' : '• Disposable topology removed');
    }
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? (error.stack ?? error.message) : String(error);
  console.error(`✗ Watch release-candidate smoke test failed\n${message}`);
  process.exitCode = 1;
});
