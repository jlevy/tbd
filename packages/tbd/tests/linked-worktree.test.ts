/**
 * Regression tests for linked git worktree support.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, realpath, rm, writeFile as fsWriteFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir, platform } from 'node:os';
import { randomBytes } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { checkGitVersion, checkWorktreeHealth, initWorktree } from '../src/file/git.js';
import {
  SYNC_BRANCH,
  WORKTREE_DIR_NAME,
  getDataSyncDirForWorktree,
  resolveDataSyncDir,
  resolveSyncWorktreePath,
  clearPathCache,
} from '../src/lib/paths.js';

const execFileAsync = promisify(execFile);

const isWindows = platform() === 'win32';
const describeUnlessWindows = isWindows ? describe.skip : describe;

async function gitInDir(dir: string, ...args: string[]): Promise<string> {
  const { stdout } = await execFileAsync('git', args, { cwd: dir });
  return stdout.trim();
}

async function initRepo(repoPath: string): Promise<void> {
  await mkdir(repoPath, { recursive: true });
  await gitInDir(repoPath, 'init', '-b', 'main');
  await gitInDir(repoPath, 'config', 'user.email', 'test@test.com');
  await gitInDir(repoPath, 'config', 'user.name', 'Test User');
  await gitInDir(repoPath, 'config', 'commit.gpgsign', 'false');

  await fsWriteFile(join(repoPath, 'README.md'), '# Linked Worktree Test Repo\n');
  await gitInDir(repoPath, 'add', 'README.md');
  await gitInDir(repoPath, 'commit', '-m', 'Initial commit');
}

async function addLinkedCheckout(
  repoPath: string,
  linkedPath: string,
  branchName: string,
): Promise<void> {
  await gitInDir(repoPath, 'worktree', 'add', '-b', branchName, linkedPath, 'HEAD');
}

async function countSyncWorktrees(repoPath: string): Promise<number> {
  const worktreeList = await gitInDir(repoPath, 'worktree', 'list', '--porcelain');
  return worktreeList
    .split('\n')
    .filter((line) => line.startsWith('worktree ') && line.includes(WORKTREE_DIR_NAME)).length;
}

async function canonicalizePath(path: string): Promise<string> {
  return realpath(path).catch(() => path);
}

describeUnlessWindows('linked git worktree support', () => {
  let testDir: string;
  let mainRepoPath: string;
  let linkedRepoPath: string;
  let originalCwd: string;

  beforeEach(async () => {
    const { supported } = await checkGitVersion();
    if (!supported) {
      console.log('Skipping linked worktree tests - Git 2.42+ required');
      return;
    }

    originalCwd = process.cwd();
    testDir = join(tmpdir(), `tbd-linked-worktree-test-${randomBytes(4).toString('hex')}`);
    mainRepoPath = join(testDir, 'main');
    linkedRepoPath = join(testDir, 'linked');

    await initRepo(mainRepoPath);
    process.chdir(mainRepoPath);
    clearPathCache();
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    clearPathCache();
    if (testDir) {
      await rm(testDir, { recursive: true, force: true }).catch(() => undefined);
    }
  });

  it('reuses the existing sync worktree from another checkout in the same clone', async () => {
    const initResult = await initWorktree(mainRepoPath);
    expect(initResult.success).toBe(true);

    await addLinkedCheckout(mainRepoPath, linkedRepoPath, 'linked-worktree-a');
    clearPathCache();

    const sharedWorktreePath = await resolveSyncWorktreePath(mainRepoPath);
    const resolvedWorktreePath = await resolveSyncWorktreePath(linkedRepoPath);
    const dataSyncDir = await resolveDataSyncDir(linkedRepoPath);

    expect(sharedWorktreePath).toBeTruthy();
    expect(await canonicalizePath(resolvedWorktreePath!)).toBe(
      await canonicalizePath(sharedWorktreePath!),
    );
    expect(await canonicalizePath(dataSyncDir)).toBe(
      await canonicalizePath(getDataSyncDirForWorktree(sharedWorktreePath!)),
    );
  });

  it('reports a linked checkout as healthy when a shared sync worktree exists', async () => {
    const initResult = await initWorktree(mainRepoPath);
    expect(initResult.success).toBe(true);

    await addLinkedCheckout(mainRepoPath, linkedRepoPath, 'linked-worktree-b');
    clearPathCache();

    const sharedWorktreePath = await resolveSyncWorktreePath(mainRepoPath);
    const health = await checkWorktreeHealth(linkedRepoPath);

    expect(health.status).toBe('valid');
    expect(health.valid).toBe(true);
    expect(await canonicalizePath(health.path!)).toBe(await canonicalizePath(sharedWorktreePath!));
    expect(health.branch).toBe(SYNC_BRANCH);
  });

  it('does not create a second hidden sync worktree from a linked checkout', async () => {
    const initResult = await initWorktree(mainRepoPath);
    expect(initResult.success).toBe(true);

    await addLinkedCheckout(mainRepoPath, linkedRepoPath, 'linked-worktree-c');
    clearPathCache();

    expect(await countSyncWorktrees(linkedRepoPath)).toBe(1);

    const sharedWorktreePath = await resolveSyncWorktreePath(mainRepoPath);
    const linkedInitResult = await initWorktree(linkedRepoPath);

    expect(linkedInitResult.success).toBe(true);
    expect(linkedInitResult.created).toBe(false);
    expect(await canonicalizePath(linkedInitResult.path!)).toBe(
      await canonicalizePath(sharedWorktreePath!),
    );
    expect(await countSyncWorktrees(linkedRepoPath)).toBe(1);
  });
});
