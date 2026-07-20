/** Contract and Git-safety tests for the blocking bead watcher. */

import { execFile } from 'node:child_process';
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { serializeIssue } from '../src/file/parser.js';
import { watchForIssueChanges, type IssueWatchDependencies } from '../src/file/bead-watch.js';
import type { IssueChangesReport } from '../src/lib/issue-changes.js';
import { stringifyYaml } from '../src/utils/yaml-utils.js';
import { createTestIssue, testId, TEST_ULIDS } from './test-helpers.js';

const execFileAsync = promisify(execFile);
const cleanupPaths: string[] = [];
const SHA_A = 'a'.repeat(40);
const SHA_B = 'b'.repeat(40);
const SHA_C = 'c'.repeat(40);
const ISSUE_ID = testId(TEST_ULIDS.ULID_1);

function emptyReport(since: string, tip: string): IssueChangesReport {
  return { since, tip, changes: [] };
}

function changedReport(since: string, tip: string): IssueChangesReport {
  return {
    since,
    tip,
    changes: [
      {
        id: 'tbd-a1b2',
        internal_id: ISSUE_ID,
        title: 'Wake',
        change: 'updated',
        fields: [],
      },
    ],
  };
}

function fakeDependencies(remoteTips: string[]): {
  dependencies: IssueWatchDependencies;
  fetchRemoteTip: ReturnType<typeof vi.fn>;
  createReport: ReturnType<typeof vi.fn>;
  getNow: () => number;
} {
  let now = 0;
  let remoteIndex = 0;
  const fetchRemoteTip = vi.fn(() => Promise.resolve(remoteTips[Math.max(0, remoteIndex - 1)]!));
  const createReport = vi.fn((since: string, tip: string) =>
    Promise.resolve(emptyReport(since, tip)),
  );
  return {
    dependencies: {
      now: () => now,
      sleep: (milliseconds) => {
        now += milliseconds;
        return Promise.resolve();
      },
      getRemoteTip: vi.fn(() => {
        const tip = remoteTips[Math.min(remoteIndex, remoteTips.length - 1)]!;
        remoteIndex += 1;
        return Promise.resolve(tip);
      }),
      fetchRemoteTip,
      createReport,
    },
    fetchRemoteTip,
    createReport,
    getNow: () => now,
  };
}

async function git(repoDir: string, ...args: string[]): Promise<string> {
  const { stdout } = await execFileAsync('git', args, { cwd: repoDir });
  return stdout.trim();
}

async function maybeRead(path: string): Promise<string | null> {
  try {
    return await readFile(path, 'utf8');
  } catch {
    return null;
  }
}

afterEach(async () => {
  await Promise.all(
    cleanupPaths.splice(0).map((path) =>
      rm(path, {
        recursive: true,
        force: true,
        maxRetries: 5,
        retryDelay: 100,
      }),
    ),
  );
});

describe('watchForIssueChanges polling', () => {
  it('takes the first remote tip as baseline and does not fetch while idle', async () => {
    const fake = fakeDependencies([SHA_A]);

    const result = await watchForIssueChanges(
      {
        repoDir: '/unused',
        remote: 'origin',
        branch: 'tbd-sync',
        prefix: 'tbd',
        selection: { kind: 'all' },
        since: null,
        intervalMs: 10,
        timeoutMs: 25,
      },
      fake.dependencies,
    );

    expect(result).toEqual({ kind: 'timeout' });
    expect(fake.fetchRemoteTip).not.toHaveBeenCalled();
    expect(fake.createReport).not.toHaveBeenCalled();
    expect(fake.getNow()).toBe(25);
  });

  it('compares --since immediately and returns without sleeping when already changed', async () => {
    const fake = fakeDependencies([SHA_B]);
    fake.fetchRemoteTip.mockResolvedValue(SHA_B);
    fake.createReport.mockResolvedValue(changedReport(SHA_A, SHA_B));

    const result = await watchForIssueChanges(
      {
        repoDir: '/unused',
        remote: 'origin',
        branch: 'tbd-sync',
        prefix: 'tbd',
        selection: { kind: 'all' },
        since: SHA_A,
        intervalMs: 10,
        timeoutMs: 100,
      },
      fake.dependencies,
    );

    expect(result).toEqual({ kind: 'changed', report: changedReport(SHA_A, SHA_B) });
    expect(fake.fetchRemoteTip).toHaveBeenCalledTimes(1);
    expect(fake.createReport).toHaveBeenCalledWith(SHA_A, SHA_B);
    expect(fake.getNow()).toBe(0);
  });

  it('validates an exact remote-tip baseline without fetching', async () => {
    const fake = fakeDependencies([SHA_A]);

    const result = await watchForIssueChanges(
      {
        repoDir: '/unused',
        remote: 'origin',
        branch: 'tbd-sync',
        prefix: 'tbd',
        selection: { kind: 'all' },
        since: SHA_A,
        intervalMs: 10,
        timeoutMs: 0,
      },
      fake.dependencies,
    );

    expect(result).toEqual({ kind: 'timeout' });
    expect(fake.fetchRemoteTip).not.toHaveBeenCalled();
    expect(fake.createReport).toHaveBeenCalledExactlyOnceWith(SHA_A, SHA_A);
  });

  it('advances after unrelated movement and reports only the triggering interval', async () => {
    const fake = fakeDependencies([SHA_A, SHA_B, SHA_C]);
    fake.fetchRemoteTip.mockResolvedValueOnce(SHA_B).mockResolvedValueOnce(SHA_C);
    fake.createReport
      .mockResolvedValueOnce(emptyReport(SHA_A, SHA_B))
      .mockResolvedValueOnce(changedReport(SHA_B, SHA_C));

    const result = await watchForIssueChanges(
      {
        repoDir: '/unused',
        remote: 'origin',
        branch: 'tbd-sync',
        prefix: 'tbd',
        selection: { kind: 'all' },
        since: null,
        intervalMs: 10,
        timeoutMs: null,
      },
      fake.dependencies,
    );

    expect(result).toEqual({ kind: 'changed', report: changedReport(SHA_B, SHA_C) });
    expect(fake.createReport.mock.calls).toEqual([
      [SHA_A, SHA_B],
      [SHA_B, SHA_C],
    ]);
  });
});

describe('watchForIssueChanges Git safety', () => {
  it('fetches through a temporary private ref and leaves sync state untouched', async () => {
    const root = await mkdtemp(join(tmpdir(), 'tbd-watch-safety-'));
    cleanupPaths.push(root);
    const remoteDir = join(root, 'remote.git');
    const repoDir = join(root, 'repo');
    await mkdir(remoteDir);
    await git(remoteDir, 'init', '--bare');
    await mkdir(repoDir);
    await git(repoDir, 'init', '-b', 'main');
    await git(repoDir, 'config', 'user.email', 'test@example.com');
    await git(repoDir, 'config', 'user.name', 'Test User');
    await git(repoDir, 'config', 'commit.gpgsign', 'false');
    await git(repoDir, 'remote', 'add', 'origin', remoteDir);
    await writeFile(join(repoDir, 'README.md'), '# main\n');
    await git(repoDir, 'add', 'README.md');
    await git(repoDir, 'commit', '-m', 'main');
    await git(repoDir, 'checkout', '--orphan', 'tbd-sync');
    await git(repoDir, 'rm', '-rf', '.');

    const issueDir = join(repoDir, '.tbd', 'data-sync', 'issues');
    const mappingDir = join(repoDir, '.tbd', 'data-sync', 'mappings');
    await mkdir(issueDir, { recursive: true });
    await mkdir(mappingDir, { recursive: true });
    const before = createTestIssue({ id: ISSUE_ID, title: 'Safety', notes: 'before' });
    await writeFile(join(issueDir, `${ISSUE_ID}.md`), serializeIssue(before));
    await writeFile(join(mappingDir, 'ids.yml'), stringifyYaml({ a1b2: TEST_ULIDS.ULID_1 }));
    await git(repoDir, 'add', '.tbd/data-sync');
    await git(repoDir, 'commit', '-m', 'base');
    const since = await git(repoDir, 'rev-parse', 'HEAD');
    await git(repoDir, 'push', 'origin', 'HEAD:refs/heads/tbd-sync');

    await writeFile(
      join(issueDir, `${ISSUE_ID}.md`),
      serializeIssue({ ...before, notes: 'before\nafter', version: 2 }),
    );
    await git(repoDir, 'add', '.tbd/data-sync');
    await git(repoDir, 'commit', '-m', 'tip');
    const remoteTip = await git(repoDir, 'rev-parse', 'HEAD');
    await git(repoDir, 'push', 'origin', 'HEAD:refs/heads/tbd-sync');
    await git(repoDir, 'checkout', 'main');
    await git(repoDir, 'update-ref', 'refs/heads/tbd-sync', since);

    const gitDir = join(repoDir, '.git');
    const fetchHeadPath = join(gitDir, 'FETCH_HEAD');
    const sentinelWorktree = join(gitDir, 'tbd', 'data-sync-worktree', 'sentinel');
    const sentinelLock = join(gitDir, 'tbd', 'locks', 'data-sync.lock', 'sentinel');
    await mkdir(join(sentinelWorktree, '..'), { recursive: true });
    await mkdir(join(sentinelLock, '..'), { recursive: true });
    await writeFile(sentinelWorktree, 'worktree untouched');
    await writeFile(sentinelLock, 'lock untouched');
    const fetchHeadBefore = await maybeRead(fetchHeadPath);
    const localSyncBefore = await git(repoDir, 'rev-parse', 'refs/heads/tbd-sync');
    const remoteTrackingBefore = await git(
      repoDir,
      'rev-parse',
      '--verify',
      'refs/remotes/origin/tbd-sync',
    ).catch(() => null);

    const result = await watchForIssueChanges({
      repoDir,
      remote: 'origin',
      branch: 'tbd-sync',
      prefix: 'tbd',
      selection: { kind: 'all' },
      since,
      intervalMs: 10_000,
      timeoutMs: 1_000,
    });

    expect(result.kind).toBe('changed');
    if (result.kind === 'changed') expect(result.report.tip).toBe(remoteTip);
    expect(await git(repoDir, 'rev-parse', 'refs/heads/tbd-sync')).toBe(localSyncBefore);
    expect(
      await git(repoDir, 'rev-parse', '--verify', 'refs/remotes/origin/tbd-sync').catch(() => null),
    ).toBe(remoteTrackingBefore);
    expect(await maybeRead(fetchHeadPath)).toBe(fetchHeadBefore);
    expect(await readFile(sentinelWorktree, 'utf8')).toBe('worktree untouched');
    expect(await readFile(sentinelLock, 'utf8')).toBe('lock untouched');
    expect(await git(repoDir, 'for-each-ref', '--format=%(refname)', 'refs/tbd/watch/')).toBe('');
    await expect(access(join(gitDir, 'tbd', 'locks', 'data-sync.lock'))).resolves.toBeUndefined();
  });
});
