/**
 * Tests for local/remote sync branch resolution.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir, platform } from 'node:os';
import { randomBytes } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { initConfig, readConfig, readLocalState } from '../src/file/config.js';
import {
  resolveSyncBranchRefs,
  makeManagedLocalBranchName,
  isManagedLocalBranch,
} from '../src/file/sync-branch.js';

const execFileAsync = promisify(execFile);
const isWindows = platform() === 'win32';
const describeUnlessWindows = isWindows ? describe.skip : describe;

async function gitInDir(dir: string, ...args: string[]): Promise<string> {
  const { stdout } = await execFileAsync('git', args, { cwd: dir });
  return stdout.trim();
}

describeUnlessWindows('sync branch resolution', () => {
  let testDir: string;
  let repoPath: string;
  let originalCwd: string;

  beforeEach(async () => {
    originalCwd = process.cwd();
    testDir = join(tmpdir(), `tbd-sync-branch-test-${randomBytes(4).toString('hex')}`);
    repoPath = join(testDir, 'repo');
    await mkdir(repoPath, { recursive: true });

    await gitInDir(repoPath, 'init', '-b', 'main');
    await gitInDir(repoPath, 'config', 'user.email', 'test@example.com');
    await gitInDir(repoPath, 'config', 'user.name', 'Test User');
    await writeFile(join(repoPath, 'README.md'), '# Test Repo\n');
    await gitInDir(repoPath, 'add', 'README.md');
    await gitInDir(repoPath, 'commit', '-m', 'Initial commit');

    await initConfig(repoPath, '0.1.0', 'test');
    process.chdir(repoPath);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await rm(testDir, { recursive: true, force: true }).catch(() => undefined);
  });

  it('makeManagedLocalBranchName is deterministic', () => {
    const a = makeManagedLocalBranchName('tbd-sync', '/tmp/my-repo');
    const b = makeManagedLocalBranchName('tbd-sync', '/tmp/my-repo');
    expect(a).toBe(b);
    expect(a.startsWith('tbd-sync--wt-')).toBe(true);
  });

  it('makeManagedLocalBranchName stays within branch length limits', () => {
    const longBranch = `sync-${'x'.repeat(300)}`;
    const result = makeManagedLocalBranchName(longBranch, '/tmp/long-path-repo');
    expect(result.length).toBeLessThanOrEqual(255);
    expect(result.includes('--wt-')).toBe(true);
  });

  it('resolves canonical local branch when not occupied', async () => {
    const config = await readConfig(repoPath);
    const refs = await resolveSyncBranchRefs(repoPath, config, { forWrite: true });
    expect(refs.remoteSyncBranch).toBe('tbd-sync');
    expect(refs.localSyncBranch).toBe('tbd-sync');
    expect(refs.source).toBe('canonical');

    const state = await readLocalState(repoPath);
    expect(state.local_sync_branch).toBe('tbd-sync');
  });

  it('uses managed local branch when canonical is checked out elsewhere', async () => {
    const config = await readConfig(repoPath);

    // Create canonical local branch and check it out in another worktree.
    await gitInDir(repoPath, 'branch', 'tbd-sync');
    const occupiedPath = join(testDir, 'occupied-worktree');
    await gitInDir(repoPath, 'worktree', 'add', occupiedPath, 'tbd-sync');

    const refs = await resolveSyncBranchRefs(repoPath, config, { forWrite: true });
    expect(isManagedLocalBranch(refs.localSyncBranch, 'tbd-sync')).toBe(true);
    expect(refs.source).toBe('managed');

    const state = await readLocalState(repoPath);
    expect(state.local_sync_branch).toBe(refs.localSyncBranch);
  });

  it('does not mutate state in read-only mode', async () => {
    const config = await readConfig(repoPath);
    const refs = await resolveSyncBranchRefs(repoPath, config, { forWrite: false });

    expect(refs.localSyncBranch).toBe('tbd-sync');
    const state = await readLocalState(repoPath);
    expect(state.local_sync_branch).toBeUndefined();
  });
});
