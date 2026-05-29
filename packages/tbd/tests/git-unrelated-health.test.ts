/**
 * Tests for checkRemoteBranchHealth unrelated-history detection (Fault 2).
 *
 * The old code lumped "no local branch" and "no common ancestor" together as
 * diverged=false, so unrelated histories (the #139 worst case) reported as
 * healthy. The flag matrix:
 *   in-sync          -> diverged false, unrelated false
 *   diverged (shared)-> diverged true,  unrelated false
 *   unrelated        -> diverged true,  unrelated true
 *   no local branch  -> diverged false, unrelated false
 *
 * See: tbd-nzqt (plan-2026-05-29-tbd-sync-unrelated-history-hardening.md)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, rm, writeFile as fsWriteFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir, platform } from 'node:os';
import { randomBytes } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { checkRemoteBranchHealth } from '../src/file/git.js';
import { SYNC_BRANCH } from '../src/lib/paths.js';

const execFileAsync = promisify(execFile);
const isWindows = platform() === 'win32';
const describeUnlessWindows = isWindows ? describe.skip : describe;

async function g(dir: string, ...args: string[]): Promise<string> {
  const { stdout } = await execFileAsync('git', args, {
    cwd: dir,
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
  });
  return stdout.trim();
}

async function configRepo(dir: string): Promise<void> {
  await g(dir, 'config', 'user.email', 't@t.com');
  await g(dir, 'config', 'user.name', 'T');
  await g(dir, 'config', 'commit.gpgsign', 'false');
}

describeUnlessWindows('checkRemoteBranchHealth unrelated detection', () => {
  let testDir: string;
  let barePath: string;
  let workPath: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `tbd-unrel-${randomBytes(4).toString('hex')}`);
    barePath = join(testDir, 'remote.git');
    workPath = join(testDir, 'work');
    await mkdir(barePath, { recursive: true });
    await g(barePath, 'init', '--bare');
    await mkdir(workPath, { recursive: true });
    await g(workPath, 'init', '-b', 'main');
    await configRepo(workPath);
    await g(workPath, 'remote', 'add', 'origin', barePath);
    await fsWriteFile(join(workPath, 'README.md'), '# t\n');
    await g(workPath, 'add', '.');
    await g(workPath, 'commit', '-m', 'init main');
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true }).catch(() => undefined);
  });

  /** Create an orphan tbd-sync in workPath with one commit, return to main. */
  async function localOrphanSync(marker: string): Promise<void> {
    await g(workPath, 'checkout', '--orphan', SYNC_BRANCH);
    await g(workPath, 'rm', '-rf', '--cached', '.').catch(() => undefined);
    await rm(join(workPath, 'README.md'), { force: true }).catch(() => undefined);
    await fsWriteFile(join(workPath, 'sync-marker.txt'), `${marker}\n`);
    await g(workPath, 'add', '.');
    await g(workPath, 'commit', '-m', `sync ${marker}`);
    await g(workPath, 'checkout', 'main');
  }

  it('reports unrelated when local and remote tbd-sync are independent orphans', async () => {
    // Remote tbd-sync = env B's orphan.
    const seed = join(testDir, 'seedB');
    await mkdir(seed, { recursive: true });
    await g(seed, 'init', '-b', SYNC_BRANCH);
    await configRepo(seed);
    await fsWriteFile(join(seed, 'b.txt'), 'b\n');
    await g(seed, 'add', '.');
    await g(seed, 'commit', '-m', 'env B');
    await g(seed, 'push', barePath, `${SYNC_BRANCH}:refs/heads/${SYNC_BRANCH}`);

    // Local tbd-sync = our own orphan (no common ancestor with env B).
    await localOrphanSync('A');

    const health = await checkRemoteBranchHealth('origin', SYNC_BRANCH, workPath);
    expect(health.exists).toBe(true);
    expect(health.unrelated).toBe(true);
    expect(health.diverged).toBe(true);
  });

  it('reports in-sync (not diverged, not unrelated) when local equals remote', async () => {
    await localOrphanSync('A');
    await g(workPath, 'push', 'origin', `${SYNC_BRANCH}:refs/heads/${SYNC_BRANCH}`);

    const health = await checkRemoteBranchHealth('origin', SYNC_BRANCH, workPath);
    expect(health.exists).toBe(true);
    expect(health.diverged).toBe(false);
    expect(health.unrelated).toBe(false);
  });

  it('reports diverged-but-related when both advance from a shared base', async () => {
    await localOrphanSync('A');
    await g(workPath, 'push', 'origin', `${SYNC_BRANCH}:refs/heads/${SYNC_BRANCH}`);

    // Second clone advances the remote tbd-sync from the shared base.
    const repo2 = join(testDir, 'repo2');
    await g(testDir, 'clone', '-b', SYNC_BRANCH, barePath, repo2);
    await configRepo(repo2);
    await fsWriteFile(join(repo2, 'remote-advance.txt'), 'y\n');
    await g(repo2, 'add', '.');
    await g(repo2, 'commit', '-m', 'remote advance');
    await g(repo2, 'push', 'origin', SYNC_BRANCH);

    // Local advances independently from the same base (no pull).
    await g(workPath, 'checkout', SYNC_BRANCH);
    await fsWriteFile(join(workPath, 'local-advance.txt'), 'x\n');
    await g(workPath, 'add', '.');
    await g(workPath, 'commit', '-m', 'local advance');
    await g(workPath, 'checkout', 'main');

    const health = await checkRemoteBranchHealth('origin', SYNC_BRANCH, workPath);
    expect(health.exists).toBe(true);
    expect(health.diverged).toBe(true);
    expect(health.unrelated).toBe(false);
  });

  it('reports not-diverged/not-unrelated when there is no local tbd-sync branch', async () => {
    const seed = join(testDir, 'seedOnly');
    await mkdir(seed, { recursive: true });
    await g(seed, 'init', '-b', SYNC_BRANCH);
    await configRepo(seed);
    await fsWriteFile(join(seed, 'r.txt'), 'r\n');
    await g(seed, 'add', '.');
    await g(seed, 'commit', '-m', 'remote only');
    await g(seed, 'push', barePath, `${SYNC_BRANCH}:refs/heads/${SYNC_BRANCH}`);

    // workPath has NO local tbd-sync branch.
    const health = await checkRemoteBranchHealth('origin', SYNC_BRANCH, workPath);
    expect(health.exists).toBe(true);
    expect(health.diverged).toBe(false);
    expect(health.unrelated).toBe(false);
  });
});
