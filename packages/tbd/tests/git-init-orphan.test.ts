/**
 * Tests for initWorktree orphan hardening (#137 / Fault 1b).
 *
 *  - check-failed: a configured-but-unreachable remote must NOT fall through to
 *    orphan creation (no divergent local branch).
 *  - happy path: a fresh orphan is pushed immediately ("first init wins").
 *  - rejected race: if the remote already has a branch (environment B won), the
 *    push is rejected; a scaffold-only local adopts the remote, while a local
 *    that already carries user issues fails loudly toward `tbd doctor --fix`.
 *
 * See: tbd-xkyh (plan-2026-05-29-tbd-sync-unrelated-history-hardening.md)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, rm, writeFile as fsWriteFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir, platform } from 'node:os';
import { randomBytes } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import {
  initWorktree,
  pushFreshOrphan,
  branchExists,
  remoteBranchExists,
  worktreeExists,
} from '../src/file/git.js';
import { SYNC_BRANCH, TBD_DIR, DATA_SYNC_DIR_NAME } from '../src/lib/paths.js';

const execFileAsync = promisify(execFile);
const isWindows = platform() === 'win32';
const describeUnlessWindows = isWindows ? describe.skip : describe;

async function gitInDir(dir: string, ...args: string[]): Promise<string> {
  const { stdout } = await execFileAsync('git', args, {
    cwd: dir,
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
  });
  return stdout.trim();
}

async function createBareRepo(path: string): Promise<void> {
  await mkdir(path, { recursive: true });
  await gitInDir(path, 'init', '--bare');
}

async function initRepoWithRemote(repoPath: string, remotePath: string): Promise<void> {
  await mkdir(repoPath, { recursive: true });
  await gitInDir(repoPath, 'init', '-b', 'main');
  await gitInDir(repoPath, 'config', 'user.email', 'test@test.com');
  await gitInDir(repoPath, 'config', 'user.name', 'Test User');
  await gitInDir(repoPath, 'config', 'commit.gpgsign', 'false');
  await gitInDir(repoPath, 'remote', 'add', 'origin', remotePath);
  await fsWriteFile(join(repoPath, 'README.md'), '# t\n');
  await gitInDir(repoPath, 'add', 'README.md');
  await gitInDir(repoPath, 'commit', '-m', 'init');
}

/** Seed a bare remote with an unrelated (orphan) tbd-sync built in a scratch repo. */
async function seedRemoteOrphanSync(testDir: string, barePath: string): Promise<void> {
  const seed = join(testDir, `seed-${randomBytes(3).toString('hex')}`);
  await mkdir(seed, { recursive: true });
  await gitInDir(seed, 'init', '-b', SYNC_BRANCH);
  await gitInDir(seed, 'config', 'user.email', 'b@b.com');
  await gitInDir(seed, 'config', 'user.name', 'Env B');
  await gitInDir(seed, 'config', 'commit.gpgsign', 'false');
  await fsWriteFile(join(seed, 'remote-marker.txt'), 'env-B\n');
  await gitInDir(seed, 'add', '.');
  await gitInDir(seed, 'commit', '-m', 'env B orphan');
  await gitInDir(seed, 'push', barePath, `${SYNC_BRANCH}:refs/heads/${SYNC_BRANCH}`);
}

describeUnlessWindows('initWorktree orphan hardening', () => {
  let testDir: string;
  let barePath: string;
  let workPath: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `tbd-initorphan-${randomBytes(4).toString('hex')}`);
    barePath = join(testDir, 'remote.git');
    workPath = join(testDir, 'work');
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true }).catch(() => undefined);
  });

  it('refuses to create an orphan when the remote check fails', async () => {
    await initRepoWithRemote(workPath, join(testDir, 'unreachable-does-not-exist.git'));
    const result = await initWorktree(workPath);

    expect(result.success).toBe(false);
    expect(result.error ?? '').toMatch(/remote check failed|could not verify/i);
    // No divergent local branch and no worktree were created.
    expect(await branchExists(SYNC_BRANCH, workPath)).toBe(false);
    expect(await worktreeExists(workPath)).toBe(false);
  });

  it('pushes the fresh orphan immediately (first init wins)', async () => {
    await createBareRepo(barePath);
    await initRepoWithRemote(workPath, barePath);

    const result = await initWorktree(workPath);
    expect(result.success).toBe(true);
    expect(result.created).toBe(true);
    expect(await remoteBranchExists('origin', SYNC_BRANCH, workPath)).toBe(true);
  });

  it('still succeeds locally when there is no remote configured', async () => {
    await mkdir(workPath, { recursive: true });
    await gitInDir(workPath, 'init', '-b', 'main');
    await gitInDir(workPath, 'config', 'user.email', 'a@a.com');
    await gitInDir(workPath, 'config', 'user.name', 'A');
    await gitInDir(workPath, 'config', 'commit.gpgsign', 'false');
    await fsWriteFile(join(workPath, 'README.md'), '# t\n');
    await gitInDir(workPath, 'add', '.');
    await gitInDir(workPath, 'commit', '-m', 'init');

    const result = await initWorktree(workPath);
    expect(result.success).toBe(true);
    expect(await branchExists(SYNC_BRANCH, workPath)).toBe(true);
  });

  describe('pushFreshOrphan rejected-race handling', () => {
    it('adopts a scaffold-only remote when the push is rejected', async () => {
      await createBareRepo(barePath);
      await seedRemoteOrphanSync(testDir, barePath);
      await initRepoWithRemote(workPath, barePath);

      // Build a local scaffold-only orphan tbd-sync (no user issues).
      const worktreePath = join(workPath, '.git', 'tbd', 'data-sync-worktree');
      await gitInDir(workPath, 'worktree', 'add', '--orphan', '-b', SYNC_BRANCH, worktreePath);
      const dataSyncPath = join(worktreePath, TBD_DIR, DATA_SYNC_DIR_NAME);
      await mkdir(join(dataSyncPath, 'issues'), { recursive: true });
      await fsWriteFile(join(dataSyncPath, 'issues', '.gitkeep'), '');
      await gitInDir(worktreePath, 'add', '.');
      await gitInDir(worktreePath, '-c', 'commit.gpgsign=false', 'commit', '-m', 'local orphan');

      const res = await pushFreshOrphan(
        workPath,
        worktreePath,
        'origin',
        SYNC_BRANCH,
        dataSyncPath,
      );
      expect(res.adopted).toBe(true);
      expect(res.pushed).toBe(false);

      // Local tbd-sync now equals the remote (env B) — push will fast-forward.
      const localHead = await gitInDir(workPath, 'rev-parse', SYNC_BRANCH);
      const remoteHead = await gitInDir(workPath, 'rev-parse', `origin/${SYNC_BRANCH}`);
      expect(localHead).toBe(remoteHead);
    });

    it('fails loudly toward doctor --fix when the local already has user issues', async () => {
      await createBareRepo(barePath);
      await seedRemoteOrphanSync(testDir, barePath);
      await initRepoWithRemote(workPath, barePath);

      const worktreePath = join(workPath, '.git', 'tbd', 'data-sync-worktree');
      await gitInDir(workPath, 'worktree', 'add', '--orphan', '-b', SYNC_BRANCH, worktreePath);
      const dataSyncPath = join(worktreePath, TBD_DIR, DATA_SYNC_DIR_NAME);
      await mkdir(join(dataSyncPath, 'issues'), { recursive: true });
      // A real user issue lives locally and must NOT be silently discarded.
      await fsWriteFile(
        join(dataSyncPath, 'issues', 'is-01localuserissue00000000aa.md'),
        '---\ntype: is\ntitle: local work\n---\n',
      );
      await gitInDir(worktreePath, 'add', '.');
      await gitInDir(worktreePath, '-c', 'commit.gpgsign=false', 'commit', '-m', 'local issue');

      await expect(
        pushFreshOrphan(workPath, worktreePath, 'origin', SYNC_BRANCH, dataSyncPath),
      ).rejects.toThrow(/doctor --fix/i);
    });
  });
});
