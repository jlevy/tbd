/**
 * Tests for isSyncBranchCheckedOutElsewhere() — detecting sync branch
 * conflicts across linked worktrees.
 *
 * See: plan-2026-02-27-worktree-sync-outbox-fallback.md
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, rm, writeFile as fsWriteFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir, platform } from 'node:os';
import { randomBytes } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { isSyncBranchCheckedOutElsewhere, checkGitVersion, initWorktree } from '../src/file/git.js';
import { SYNC_BRANCH } from '../src/lib/paths.js';
import { clearPathCache } from '../src/lib/paths.js';

const execFileAsync = promisify(execFile);

const isWindows = platform() === 'win32';
const describeUnlessWindows = isWindows ? describe.skip : describe;

async function gitInDir(dir: string, ...args: string[]): Promise<string> {
  const { stdout } = await execFileAsync('git', args, { cwd: dir });
  return stdout.trim();
}

async function createBareRepo(path: string): Promise<void> {
  await mkdir(path, { recursive: true });
  await gitInDir(path, 'init', '--bare');
}

async function initRepoWithRemote(
  repoPath: string,
  remotePath: string,
  remoteName = 'origin',
): Promise<void> {
  await mkdir(repoPath, { recursive: true });
  await gitInDir(repoPath, 'init', '-b', 'main');
  await gitInDir(repoPath, 'config', 'user.email', 'test@test.com');
  await gitInDir(repoPath, 'config', 'user.name', 'Test User');
  await gitInDir(repoPath, 'config', 'commit.gpgsign', 'false');
  await gitInDir(repoPath, 'remote', 'add', remoteName, remotePath);

  await fsWriteFile(join(repoPath, 'README.md'), '# Test Repo\n');
  await gitInDir(repoPath, 'add', 'README.md');
  await gitInDir(repoPath, 'commit', '-m', 'Initial commit');
  await gitInDir(repoPath, 'push', '-u', remoteName, 'main');
}

describeUnlessWindows('isSyncBranchCheckedOutElsewhere', () => {
  let testDir: string;
  let bareRepoPath: string;
  let workRepoPath: string;
  let originalCwd: string;

  beforeEach(async () => {
    const { supported } = await checkGitVersion();
    if (!supported) {
      console.log('Skipping worktree branch conflict tests - Git 2.42+ required');
      return;
    }

    originalCwd = process.cwd();
    testDir = join(tmpdir(), `tbd-branch-conflict-test-${randomBytes(4).toString('hex')}`);
    bareRepoPath = join(testDir, 'remote.git');
    workRepoPath = join(testDir, 'work');

    await createBareRepo(bareRepoPath);
    await initRepoWithRemote(workRepoPath, bareRepoPath);
    process.chdir(workRepoPath);
    clearPathCache();
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    clearPathCache();
    if (testDir) {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  it('returns null when no worktree has the sync branch', async () => {
    const result = await isSyncBranchCheckedOutElsewhere(workRepoPath, SYNC_BRANCH);
    expect(result).toBeNull();
  });

  it('returns null when only the current repo has the sync branch in its own worktree', async () => {
    // Initialize tbd worktree in this repo (checks out tbd-sync within baseDir)
    const initResult = await initWorktree(workRepoPath, 'origin', SYNC_BRANCH);
    expect(initResult.success).toBe(true);

    // The sync branch is checked out inside workRepoPath, so should not be "elsewhere"
    const result = await isSyncBranchCheckedOutElsewhere(workRepoPath, SYNC_BRANCH);
    expect(result).toBeNull();
  });

  it('returns the other worktree path when sync branch is checked out elsewhere', async () => {
    // Create an orphan tbd-sync branch
    await gitInDir(workRepoPath, 'checkout', '--orphan', SYNC_BRANCH);
    await fsWriteFile(join(workRepoPath, 'sync-data.txt'), 'data\n');
    await gitInDir(workRepoPath, 'add', 'sync-data.txt');
    await gitInDir(workRepoPath, 'commit', '-m', 'Init sync');
    await gitInDir(workRepoPath, 'checkout', 'main');

    // Create a linked worktree that checks out the sync branch (simulates
    // what happens when the main checkout has a tbd data-sync worktree)
    const otherWorktreePath = join(testDir, 'other-worktree');
    await gitInDir(workRepoPath, 'worktree', 'add', otherWorktreePath, SYNC_BRANCH);

    // Now from a different linked worktree, detect the conflict.
    // Create a new branch for the "codex" worktree (git won't allow reusing main).
    await gitInDir(workRepoPath, 'branch', 'codex-branch');
    const codexWorktree = join(testDir, 'codex-worktree');
    await gitInDir(workRepoPath, 'worktree', 'add', codexWorktree, 'codex-branch');

    const result = await isSyncBranchCheckedOutElsewhere(codexWorktree, SYNC_BRANCH);
    expect(result).not.toBeNull();
    // The path returned should point to the worktree that has tbd-sync
    expect(result).toBe(otherWorktreePath);
  });

  it('returns null for a non-existent branch name', async () => {
    const result = await isSyncBranchCheckedOutElsewhere(workRepoPath, 'nonexistent-branch');
    expect(result).toBeNull();
  });
});
