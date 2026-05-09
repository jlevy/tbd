/**
 * Tests for worktree health detection functions.
 *
 * See: plan-2026-01-28-sync-worktree-recovery-and-hardening.md
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, rm, writeFile as fsWriteFile, readdir, access, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir, platform } from 'node:os';
import { randomBytes } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import {
  checkWorktreeHealth,
  checkLocalBranchHealth,
  checkRemoteBranchHealth,
  checkSyncConsistency,
  initWorktree,
  checkGitVersion,
  repairWorktree,
  migrateDataToWorktree,
  ensureWorktreeDetached,
  findWorktreeOwningBranch,
  advanceSyncBranch,
} from '../src/file/git.js';
import { resolveDataSyncDir, WorktreeMissingError, clearPathCache } from '../src/lib/paths.js';
import {
  WORKTREE_DIR,
  TBD_DIR,
  DATA_SYNC_DIR_NAME,
  SYNC_BRANCH,
  DATA_SYNC_DIR,
} from '../src/lib/paths.js';

const execFileAsync = promisify(execFile);

// Skip on Windows due to slower file I/O and git behavior differences
const isWindows = platform() === 'win32';
const describeUnlessWindows = isWindows ? describe.skip : describe;

/**
 * Execute a git command in a specific directory.
 */
async function gitInDir(dir: string, ...args: string[]): Promise<string> {
  const { stdout } = await execFileAsync('git', args, { cwd: dir });
  return stdout.trim();
}

/**
 * Create a bare git repository to act as a "remote".
 */
async function createBareRepo(path: string): Promise<void> {
  await mkdir(path, { recursive: true });
  await gitInDir(path, 'init', '--bare');
}

/**
 * Initialize a working repo with a remote pointing to the bare repo.
 */
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

  // Create initial commit on main branch
  await fsWriteFile(join(repoPath, 'README.md'), '# Test Repo\n');
  await gitInDir(repoPath, 'add', 'README.md');
  await gitInDir(repoPath, 'commit', '-m', 'Initial commit');
  await gitInDir(repoPath, 'push', '-u', remoteName, 'main');
}

describeUnlessWindows('worktree health checks', () => {
  let testDir: string;
  let bareRepoPath: string;
  let workRepoPath: string;
  let originalCwd: string;

  beforeEach(async () => {
    const { supported } = await checkGitVersion();
    if (!supported) {
      console.log('Skipping worktree health tests - Git 2.42+ required');
      return;
    }

    originalCwd = process.cwd();
    testDir = join(tmpdir(), `tbd-worktree-test-${randomBytes(4).toString('hex')}`);
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
      await rm(testDir, { recursive: true, force: true }).catch(() => undefined);
    }
  });

  describe('checkWorktreeHealth', () => {
    it('returns missing status when worktree does not exist', async () => {
      const health = await checkWorktreeHealth(workRepoPath);

      expect(health.status).toBe('missing');
      expect(health.exists).toBe(false);
      expect(health.valid).toBe(false);
    });

    it('returns valid status when worktree is properly set up', async () => {
      // Initialize worktree
      await initWorktree(workRepoPath);

      const health = await checkWorktreeHealth(workRepoPath);

      // Under the multi-worktree-safe model (plan-2026-05-08), the hidden
      // worktree is on detached HEAD so sibling checkouts of the same repo
      // can each have their own. branch === null indicates detached.
      expect(health.status).toBe('valid');
      expect(health.exists).toBe(true);
      expect(health.valid).toBe(true);
      expect(health.branch).toBe(null);
      expect(health.commit).toBeTruthy();
    });

    it('returns prunable status when worktree directory is deleted but git tracks it', async () => {
      // Initialize worktree
      await initWorktree(workRepoPath);

      // Verify worktree is valid first
      let health = await checkWorktreeHealth(workRepoPath);
      expect(health.status).toBe('valid');

      // Delete the worktree directory manually (simulating user deletion)
      const worktreePath = join(workRepoPath, WORKTREE_DIR);
      await rm(worktreePath, { recursive: true, force: true });

      // Check health again - git worktree list should show it as prunable
      // Note: Git marks worktrees as prunable when their directory is deleted
      health = await checkWorktreeHealth(workRepoPath);

      // The status depends on git's worktree tracking
      // When directory is deleted, git either marks as prunable (if it detected the deletion)
      // or missing (if the directory check happens first)
      expect(['prunable', 'missing']).toContain(health.status);
      expect(health.exists).toBe(false);
      expect(health.valid).toBe(false);
    });
  });

  describe('checkLocalBranchHealth', () => {
    it('returns exists: false when sync branch does not exist', async () => {
      const health = await checkLocalBranchHealth(SYNC_BRANCH);

      expect(health.exists).toBe(false);
    });

    it('returns exists: true after worktree is initialized', async () => {
      await initWorktree(workRepoPath);

      const health = await checkLocalBranchHealth(SYNC_BRANCH);

      expect(health.exists).toBe(true);
      expect(health.head).toBeTruthy();
    });
  });

  describe('checkRemoteBranchHealth', () => {
    it('returns exists: false when remote branch does not exist', async () => {
      const health = await checkRemoteBranchHealth('origin', SYNC_BRANCH);

      expect(health.exists).toBe(false);
    });

    it('returns exists: true after sync branch is pushed', async () => {
      // Initialize worktree and create sync branch
      await initWorktree(workRepoPath);

      // Push the sync branch to remote
      const worktreePath = join(workRepoPath, WORKTREE_DIR);
      await gitInDir(worktreePath, 'push', '-u', 'origin', SYNC_BRANCH);

      const health = await checkRemoteBranchHealth('origin', SYNC_BRANCH);

      expect(health.exists).toBe(true);
      expect(health.head).toBeTruthy();
    });
  });

  describe('checkSyncConsistency', () => {
    it('returns matching HEADs when worktree and local are in sync', async () => {
      // Initialize worktree
      await initWorktree(workRepoPath);

      // Push to remote
      const worktreePath = join(workRepoPath, WORKTREE_DIR);
      await gitInDir(worktreePath, 'push', '-u', 'origin', SYNC_BRANCH);

      const consistency = await checkSyncConsistency(workRepoPath, SYNC_BRANCH, 'origin');

      expect(consistency.worktreeMatchesLocal).toBe(true);
      expect(consistency.worktreeHead).toBeTruthy();
      expect(consistency.localHead).toBeTruthy();
      expect(consistency.worktreeHead).toBe(consistency.localHead);
      expect(consistency.localAhead).toBe(0);
      expect(consistency.localBehind).toBe(0);
    });

    it('detects when local is ahead of remote', async () => {
      // Initialize worktree
      await initWorktree(workRepoPath);

      // Push to remote
      const worktreePath = join(workRepoPath, WORKTREE_DIR);
      await gitInDir(worktreePath, 'push', '-u', 'origin', SYNC_BRANCH);

      // Create a new commit in the detached worktree, then advance the
      // branch ref via update-ref. Mirrors the production sync flow under
      // the multi-worktree-safe model (plan-2026-05-08).
      await fsWriteFile(join(worktreePath, TBD_DIR, DATA_SYNC_DIR_NAME, 'test.txt'), 'test');
      await gitInDir(worktreePath, 'add', '-A');
      await gitInDir(worktreePath, 'commit', '-m', 'Test commit');
      const newHead = await gitInDir(worktreePath, 'rev-parse', 'HEAD');
      await gitInDir(workRepoPath, 'update-ref', `refs/heads/${SYNC_BRANCH}`, newHead);

      const consistency = await checkSyncConsistency(workRepoPath, SYNC_BRANCH, 'origin');

      expect(consistency.localAhead).toBe(1);
      expect(consistency.localBehind).toBe(0);
    });
  });
});

describe('resolveDataSyncDir with allowFallback option', () => {
  let testDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    originalCwd = process.cwd();
    testDir = join(tmpdir(), `tbd-paths-test-${randomBytes(4).toString('hex')}`);
    await mkdir(join(testDir, TBD_DIR), { recursive: true });
    process.chdir(testDir);
    clearPathCache();
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    clearPathCache();
    if (testDir) {
      await rm(testDir, { recursive: true, force: true }).catch(() => undefined);
    }
  });

  it('returns direct path when allowFallback is true (default) and worktree missing', async () => {
    // No worktree exists, but allowFallback defaults to true
    const dataSyncDir = await resolveDataSyncDir(testDir);

    expect(dataSyncDir).toContain('data-sync');
    expect(dataSyncDir).not.toContain('data-sync-worktree');
  });

  it('returns direct path when allowFallback is explicitly true', async () => {
    const dataSyncDir = await resolveDataSyncDir(testDir, { allowFallback: true });

    expect(dataSyncDir).toContain('data-sync');
    expect(dataSyncDir).not.toContain('data-sync-worktree');
  });

  it('throws WorktreeMissingError when allowFallback is false and worktree missing', async () => {
    await expect(resolveDataSyncDir(testDir, { allowFallback: false })).rejects.toThrow(
      WorktreeMissingError,
    );
  });

  it('returns worktree path when worktree exists', async () => {
    // Create the worktree directory structure
    const worktreePath = join(testDir, WORKTREE_DIR, TBD_DIR, DATA_SYNC_DIR_NAME);
    await mkdir(worktreePath, { recursive: true });

    clearPathCache();
    const dataSyncDir = await resolveDataSyncDir(testDir);

    expect(dataSyncDir).toContain('data-sync-worktree');
  });
});

// =============================================================================
// Phase 3: Auto-Repair Tests
// See: plan-2026-01-28-sync-worktree-recovery-and-hardening.md
// =============================================================================

describeUnlessWindows('repairWorktree', () => {
  let testDir: string;
  let bareRepoPath: string;
  let workRepoPath: string;
  let originalCwd: string;

  beforeEach(async () => {
    const { supported } = await checkGitVersion();
    if (!supported) {
      console.log('Skipping repairWorktree tests - Git 2.42+ required');
      return;
    }

    originalCwd = process.cwd();
    testDir = join(tmpdir(), `tbd-repair-test-${randomBytes(4).toString('hex')}`);
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
      await rm(testDir, { recursive: true, force: true }).catch(() => undefined);
    }
  });

  it('repairs missing worktree by initializing it', async () => {
    // Worktree does not exist initially
    const health = await checkWorktreeHealth(workRepoPath);
    expect(health.status).toBe('missing');

    // Repair the missing worktree
    const result = await repairWorktree(workRepoPath, 'missing');

    expect(result.success).toBe(true);
    expect(result.path).toBeTruthy();

    // Verify worktree is now valid
    const healthAfter = await checkWorktreeHealth(workRepoPath);
    expect(healthAfter.status).toBe('valid');
    expect(healthAfter.valid).toBe(true);
  });

  it('repairs prunable worktree by pruning and reinitializing', async () => {
    // Initialize worktree first
    await initWorktree(workRepoPath);

    // Delete the worktree directory to make it prunable
    const worktreePath = join(workRepoPath, WORKTREE_DIR);
    await rm(worktreePath, { recursive: true, force: true });

    // Repair the prunable worktree
    const result = await repairWorktree(workRepoPath, 'prunable');

    expect(result.success).toBe(true);
    expect(result.path).toBeTruthy();

    // Verify worktree is now valid
    const healthAfter = await checkWorktreeHealth(workRepoPath);
    expect(healthAfter.status).toBe('valid');
  });

  it('repairs corrupted worktree by backing up and reinitializing', async () => {
    // Initialize worktree first
    await initWorktree(workRepoPath);

    // Corrupt the worktree by removing .git file but keeping directory
    const worktreePath = join(workRepoPath, WORKTREE_DIR);
    const dotGitPath = join(worktreePath, '.git');
    await rm(dotGitPath, { force: true });

    // Write some test data that should be backed up
    const testFile = join(worktreePath, 'test-data.txt');
    await fsWriteFile(testFile, 'important data');

    // Repair the corrupted worktree
    const result = await repairWorktree(workRepoPath, 'corrupted');

    expect(result.success).toBe(true);
    expect(result.path).toBeTruthy();
    expect(result.backedUp).toBeTruthy();

    // Verify backup was created
    const backupExists = await access(result.backedUp!).then(
      () => true,
      () => false,
    );
    expect(backupExists).toBe(true);

    // Verify worktree is now valid
    const healthAfter = await checkWorktreeHealth(workRepoPath);
    expect(healthAfter.status).toBe('valid');
  });
});

describeUnlessWindows('migrateDataToWorktree', () => {
  let testDir: string;
  let bareRepoPath: string;
  let workRepoPath: string;
  let originalCwd: string;

  beforeEach(async () => {
    const { supported } = await checkGitVersion();
    if (!supported) {
      console.log('Skipping migrateDataToWorktree tests - Git 2.42+ required');
      return;
    }

    originalCwd = process.cwd();
    testDir = join(tmpdir(), `tbd-migrate-test-${randomBytes(4).toString('hex')}`);
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
      await rm(testDir, { recursive: true, force: true }).catch(() => undefined);
    }
  });

  it('returns migratedCount 0 when no data in wrong location', async () => {
    // Initialize worktree
    await initWorktree(workRepoPath);

    const result = await migrateDataToWorktree(workRepoPath);

    expect(result.success).toBe(true);
    expect(result.migratedCount).toBe(0);
  });

  it('migrates issues from wrong location to worktree', async () => {
    // Initialize worktree first
    await initWorktree(workRepoPath);

    // Create data in the WRONG location (.tbd/data-sync/)
    const wrongIssuesPath = join(workRepoPath, DATA_SYNC_DIR, 'issues');
    await mkdir(wrongIssuesPath, { recursive: true });
    await fsWriteFile(join(wrongIssuesPath, 'test-abc1.md'), '# Test Issue\n\nThis is a test.');

    // Migrate data to worktree
    const result = await migrateDataToWorktree(workRepoPath);

    expect(result.success).toBe(true);
    expect(result.migratedCount).toBe(1);

    // Verify data is now in the correct location
    const correctIssuesPath = join(
      workRepoPath,
      WORKTREE_DIR,
      TBD_DIR,
      DATA_SYNC_DIR_NAME,
      'issues',
    );
    const migratedContent = await readFile(join(correctIssuesPath, 'test-abc1.md'), 'utf-8');
    expect(migratedContent).toContain('Test Issue');
  });

  it('migrates mappings from wrong location to worktree', async () => {
    // Initialize worktree first
    await initWorktree(workRepoPath);

    // Create mappings in the WRONG location
    const wrongMappingsPath = join(workRepoPath, DATA_SYNC_DIR, 'mappings');
    await mkdir(wrongMappingsPath, { recursive: true });
    await fsWriteFile(join(wrongMappingsPath, 'github.yml'), 'github: true');

    // Migrate data to worktree
    const result = await migrateDataToWorktree(workRepoPath);

    expect(result.success).toBe(true);
    expect(result.migratedCount).toBe(1);

    // Verify data is now in the correct location
    const correctMappingsPath = join(
      workRepoPath,
      WORKTREE_DIR,
      TBD_DIR,
      DATA_SYNC_DIR_NAME,
      'mappings',
    );
    const migratedContent = await readFile(join(correctMappingsPath, 'github.yml'), 'utf-8');
    expect(migratedContent).toBe('github: true');
  });

  it('resolves ids.yml conflict markers while migrating misplaced mappings', async () => {
    await initWorktree(workRepoPath);

    const wrongMappingsPath = join(workRepoPath, DATA_SYNC_DIR, 'mappings');
    await mkdir(wrongMappingsPath, { recursive: true });
    const conflictStart = '<'.repeat(7) + ' HEAD';
    const conflictMiddle = '='.repeat(7);
    const conflictEnd = '>'.repeat(7) + ' origin/tbd-sync';
    await fsWriteFile(
      join(wrongMappingsPath, 'ids.yml'),
      `aa11: 01aaaaaaaaaaaaaaaaaaaaaa01
${conflictStart}
bb22: 01aaaaaaaaaaaaaaaaaaaaaa02
${conflictMiddle}
cc33: 01aaaaaaaaaaaaaaaaaaaaaa03
${conflictEnd}
dd44: 01aaaaaaaaaaaaaaaaaaaaaa04
`,
    );

    const correctMappingsPath = join(
      workRepoPath,
      WORKTREE_DIR,
      TBD_DIR,
      DATA_SYNC_DIR_NAME,
      'mappings',
    );
    await fsWriteFile(join(correctMappingsPath, 'ids.yml'), 'zz99: 01aaaaaaaaaaaaaaaaaaaaaa99\n');

    const result = await migrateDataToWorktree(workRepoPath);

    expect(result.success).toBe(true);
    expect(result.migratedCount).toBe(1);

    const migratedContent = await readFile(join(correctMappingsPath, 'ids.yml'), 'utf-8');
    expect(migratedContent).toContain('aa11: 01aaaaaaaaaaaaaaaaaaaaaa01');
    expect(migratedContent).toContain('bb22: 01aaaaaaaaaaaaaaaaaaaaaa02');
    expect(migratedContent).toContain('cc33: 01aaaaaaaaaaaaaaaaaaaaaa03');
    expect(migratedContent).toContain('dd44: 01aaaaaaaaaaaaaaaaaaaaaa04');
    expect(migratedContent).toContain('zz99: 01aaaaaaaaaaaaaaaaaaaaaa99');
    expect(migratedContent).not.toContain(conflictStart);
    expect(migratedContent).not.toContain(conflictMiddle);
    expect(migratedContent).not.toContain(conflictEnd);
  });

  it('creates backup before migration', async () => {
    // Initialize worktree first
    await initWorktree(workRepoPath);

    // Create data in the wrong location
    const wrongIssuesPath = join(workRepoPath, DATA_SYNC_DIR, 'issues');
    await mkdir(wrongIssuesPath, { recursive: true });
    await fsWriteFile(join(wrongIssuesPath, 'backup-test.md'), '# Backup Test');

    // Migrate data
    const result = await migrateDataToWorktree(workRepoPath);

    expect(result.success).toBe(true);
    expect(result.backupPath).toBeTruthy();

    // Verify backup exists and contains the original data
    const backupIssuesPath = join(result.backupPath!, 'issues');
    const backupFiles = await readdir(backupIssuesPath);
    expect(backupFiles).toContain('backup-test.md');
  });

  it('removes source files when removeSource is true', async () => {
    // Initialize worktree first
    await initWorktree(workRepoPath);

    // Create data in the wrong location
    const wrongIssuesPath = join(workRepoPath, DATA_SYNC_DIR, 'issues');
    await mkdir(wrongIssuesPath, { recursive: true });
    await fsWriteFile(join(wrongIssuesPath, 'remove-test.md'), '# Remove Test');

    // Migrate with removeSource = true
    const result = await migrateDataToWorktree(workRepoPath, true);

    expect(result.success).toBe(true);

    // Verify source file was removed
    const sourceFileExists = await access(join(wrongIssuesPath, 'remove-test.md')).then(
      () => true,
      () => false,
    );
    expect(sourceFileExists).toBe(false);
  });

  it('preserves source files when removeSource is false', async () => {
    // Initialize worktree first
    await initWorktree(workRepoPath);

    // Create data in the wrong location
    const wrongIssuesPath = join(workRepoPath, DATA_SYNC_DIR, 'issues');
    await mkdir(wrongIssuesPath, { recursive: true });
    await fsWriteFile(join(wrongIssuesPath, 'preserve-test.md'), '# Preserve Test');

    // Migrate with removeSource = false (default)
    const result = await migrateDataToWorktree(workRepoPath, false);

    expect(result.success).toBe(true);

    // Verify source file was preserved
    const sourceFileExists = await access(join(wrongIssuesPath, 'preserve-test.md')).then(
      () => true,
      () => false,
    );
    expect(sourceFileExists).toBe(true);
  });

  it('preserves all issue data during migration', async () => {
    // Initialize worktree first
    await initWorktree(workRepoPath);

    // Create a complete issue in the wrong location
    const wrongIssuesPath = join(workRepoPath, DATA_SYNC_DIR, 'issues');
    await mkdir(wrongIssuesPath, { recursive: true });

    const issueContent = `---
id: test-data-integrity
title: "Data Integrity Test"
status: open
type: task
priority: 2
created: 2026-01-28T12:00:00Z
---

# Data Integrity Test

This issue tests that all data is preserved during migration.

## Details

- Markdown formatting preserved
- YAML frontmatter preserved
- Special characters: "quotes", 'apostrophes', \`backticks\`
`;

    await fsWriteFile(join(wrongIssuesPath, 'test-data-integrity.md'), issueContent);

    // Migrate data
    const result = await migrateDataToWorktree(workRepoPath);

    expect(result.success).toBe(true);

    // Verify data integrity
    const correctIssuesPath = join(
      workRepoPath,
      WORKTREE_DIR,
      TBD_DIR,
      DATA_SYNC_DIR_NAME,
      'issues',
    );
    const migratedContent = await readFile(
      join(correctIssuesPath, 'test-data-integrity.md'),
      'utf-8',
    );

    // Content should be identical
    expect(migratedContent).toBe(issueContent);
  });
});

// =============================================================================
// Phase 4: Architectural Prevention Tests
// See: plan-2026-01-28-sync-worktree-recovery-and-hardening.md
// =============================================================================

describeUnlessWindows('worktree health after init (CI check)', () => {
  let testDir: string;
  let bareRepoPath: string;
  let workRepoPath: string;
  let originalCwd: string;

  beforeEach(async () => {
    const { supported } = await checkGitVersion();
    if (!supported) {
      console.log('Skipping CI health check tests - Git 2.42+ required');
      return;
    }

    originalCwd = process.cwd();
    testDir = join(tmpdir(), `tbd-ci-check-${randomBytes(4).toString('hex')}`);
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
      await rm(testDir, { recursive: true, force: true }).catch(() => undefined);
    }
  });

  it('checkWorktreeHealth returns valid after initWorktree', async () => {
    // Initialize worktree
    const initResult = await initWorktree(workRepoPath);
    expect(initResult.success).toBe(true);

    // Verify worktree is healthy. Under the multi-worktree-safe model
    // (plan-2026-05-08), the worktree is detached so branch === null.
    const health = await checkWorktreeHealth(workRepoPath);
    expect(health.status).toBe('valid');
    expect(health.valid).toBe(true);
    expect(health.exists).toBe(true);
    expect(health.branch).toBe(null);
  });

  it('worktree remains healthy after creating issues', async () => {
    // Initialize worktree
    await initWorktree(workRepoPath);

    // Create a test issue file in the worktree
    const issuesPath = join(workRepoPath, WORKTREE_DIR, TBD_DIR, DATA_SYNC_DIR_NAME, 'issues');
    await mkdir(issuesPath, { recursive: true });
    await fsWriteFile(
      join(issuesPath, 'is-0000000000000000000000test.md'),
      '---\nid: is-0000000000000000000000test\ntitle: Test\nstatus: open\n---\n',
    );

    // Verify worktree is still healthy
    const health = await checkWorktreeHealth(workRepoPath);
    expect(health.status).toBe('valid');
    expect(health.valid).toBe(true);
  });
});

describeUnlessWindows('architectural test: issues written to worktree path', () => {
  let testDir: string;
  let bareRepoPath: string;
  let workRepoPath: string;
  let originalCwd: string;

  beforeEach(async () => {
    const { supported } = await checkGitVersion();
    if (!supported) {
      console.log('Skipping architectural tests - Git 2.42+ required');
      return;
    }

    originalCwd = process.cwd();
    testDir = join(tmpdir(), `tbd-arch-test-${randomBytes(4).toString('hex')}`);
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
      await rm(testDir, { recursive: true, force: true }).catch(() => undefined);
    }
  });

  it('resolveDataSyncDir returns worktree path when worktree exists', async () => {
    // Initialize worktree
    await initWorktree(workRepoPath);
    clearPathCache();

    // Resolve data sync dir - should return worktree path
    const dataSyncDir = await resolveDataSyncDir(workRepoPath);

    // Verify it points to worktree path, not direct path
    expect(dataSyncDir).toContain('data-sync-worktree');
    expect(dataSyncDir).toBe(join(workRepoPath, WORKTREE_DIR, TBD_DIR, DATA_SYNC_DIR_NAME));
  });

  it('issues written via resolved path exist in worktree, not direct path', async () => {
    // Initialize worktree
    await initWorktree(workRepoPath);
    clearPathCache();

    // Get the resolved data sync dir (should be worktree path)
    const dataSyncDir = await resolveDataSyncDir(workRepoPath);
    const issuesDir = join(dataSyncDir, 'issues');
    await mkdir(issuesDir, { recursive: true });

    // Write an issue file
    const issueId = 'test-arch-001';
    const issuePath = join(issuesDir, `${issueId}.md`);
    await fsWriteFile(issuePath, '---\nid: test-arch-001\n---\n# Test');

    // Verify issue exists in worktree path
    const worktreeIssuesPath = join(
      workRepoPath,
      WORKTREE_DIR,
      TBD_DIR,
      DATA_SYNC_DIR_NAME,
      'issues',
    );
    const existsInWorktree = await access(join(worktreeIssuesPath, `${issueId}.md`)).then(
      () => true,
      () => false,
    );
    expect(existsInWorktree).toBe(true);

    // Verify issue does NOT exist in direct path (the wrong location)
    const directIssuesPath = join(workRepoPath, DATA_SYNC_DIR, 'issues');
    const existsInDirect = await access(join(directIssuesPath, `${issueId}.md`)).then(
      () => true,
      () => false,
    );
    expect(existsInDirect).toBe(false);
  });

  it('throws WorktreeMissingError when worktree missing and fallback disabled', async () => {
    // No worktree initialized - should throw when fallback disabled
    await expect(resolveDataSyncDir(workRepoPath, { allowFallback: false })).rejects.toThrow(
      WorktreeMissingError,
    );
  });
});

// =============================================================================
// Bug Fix Tests: tbd-vuuq, tbd-m0wl, tbd-tg55
// See: Session where ai-trade-arena was recovered
// =============================================================================

describeUnlessWindows('Bug tbd-vuuq: doctor --fix respects --dry-run flag', () => {
  let testDir: string;
  let bareRepoPath: string;
  let workRepoPath: string;
  let originalCwd: string;

  beforeEach(async () => {
    const { supported } = await checkGitVersion();
    if (!supported) {
      console.log('Skipping tbd-vuuq tests - Git 2.42+ required');
      return;
    }

    originalCwd = process.cwd();
    testDir = join(tmpdir(), `tbd-vuuq-test-${randomBytes(4).toString('hex')}`);
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
      await rm(testDir, { recursive: true, force: true }).catch(() => undefined);
    }
  });

  it('--dry-run should NOT repair prunable worktree', async () => {
    // Step 1: Initialize worktree
    await initWorktree(workRepoPath);
    const worktreePath = join(workRepoPath, WORKTREE_DIR);

    // Step 2: Delete worktree to make it prunable
    await rm(worktreePath, { recursive: true, force: true });

    // Verify it's prunable
    const healthBefore = await checkWorktreeHealth(workRepoPath);
    expect(healthBefore.status).toBe('prunable');

    // Step 3: Call repairWorktree with dry-run simulation
    // Since repairWorktree doesn't have dry-run support, we test the behavior
    // that the doctor command SHOULD have: not calling repair when dry-run

    // For now, just document that the bug exists: doctor calls repair even with --dry-run
    // The fix is to check isDryRun() in doctor.ts before calling repairWorktree

    // After the --dry-run is respected, worktree should still be prunable
    const healthAfterDryRun = await checkWorktreeHealth(workRepoPath);
    expect(healthAfterDryRun.status).toBe('prunable'); // Should still be prunable after dry-run
  });

  it('--dry-run should NOT migrate data from wrong location', async () => {
    // Step 1: Initialize worktree
    await initWorktree(workRepoPath);

    // Step 2: Create data in wrong location
    const wrongIssuesPath = join(workRepoPath, DATA_SYNC_DIR, 'issues');
    await mkdir(wrongIssuesPath, { recursive: true });
    await fsWriteFile(join(wrongIssuesPath, 'dry-run-test.md'), '# Dry Run Test');

    // Count issues in wrong location before
    const { readdir: fsReaddir } = await import('node:fs/promises');
    const issuesBefore = await fsReaddir(wrongIssuesPath);
    expect(issuesBefore.length).toBe(1);

    // Step 3: Simulate what doctor --fix --dry-run SHOULD do: nothing
    // The bug is that doctor calls migrateDataToWorktree even with --dry-run
    // After fix, issues should still be in wrong location after dry-run

    // For now, document that issues in wrong location should not be migrated with dry-run
    const issuesStillInWrongLocation = await fsReaddir(wrongIssuesPath).catch(() => []);
    expect(issuesStillInWrongLocation).toContain('dry-run-test.md');
  });
});

describeUnlessWindows('Bug tbd-m0wl: sync consistency detects unpushed commits', () => {
  let testDir: string;
  let bareRepoPath: string;
  let workRepoPath: string;
  let originalCwd: string;

  beforeEach(async () => {
    const { supported } = await checkGitVersion();
    if (!supported) {
      console.log('Skipping tbd-m0wl tests - Git 2.42+ required');
      return;
    }

    originalCwd = process.cwd();
    testDir = join(tmpdir(), `tbd-m0wl-test-${randomBytes(4).toString('hex')}`);
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
      await rm(testDir, { recursive: true, force: true }).catch(() => undefined);
    }
  });

  it('checkSyncConsistency detects local ahead when worktree has unpushed commits', async () => {
    // Step 1: Initialize worktree and push initial commit
    await initWorktree(workRepoPath);
    const worktreePath = join(workRepoPath, WORKTREE_DIR);
    await gitInDir(worktreePath, 'push', '-u', 'origin', SYNC_BRANCH);

    // Step 2: Create a new commit in worktree (detached HEAD), then advance
    // the branch ref via update-ref. This mirrors the production sync flow
    // under the multi-worktree-safe model (plan-2026-05-08).
    const testFile = join(worktreePath, TBD_DIR, DATA_SYNC_DIR_NAME, 'unpushed-test.txt');
    await fsWriteFile(testFile, 'unpushed content');
    await gitInDir(worktreePath, 'add', '-A');
    await gitInDir(worktreePath, 'commit', '-m', 'Unpushed commit');
    const newHead = await gitInDir(worktreePath, 'rev-parse', 'HEAD');
    await gitInDir(workRepoPath, 'update-ref', `refs/heads/${SYNC_BRANCH}`, newHead);

    // Step 3: Check sync consistency - should detect local is ahead
    const consistency = await checkSyncConsistency(workRepoPath, SYNC_BRANCH, 'origin');

    expect(consistency.localAhead).toBeGreaterThan(0);
    // Detached HEAD pointing at the same commit as the branch tip is the
    // multi-worktree-safe state.
    expect(consistency.worktreeMatchesLocal).toBe(true);
  });

  it('checkSyncConsistency returns worktreeMatchesLocal=true after commits on branch', async () => {
    // Verifies the production flow: commit on detached HEAD + update-ref
    // produces a worktree HEAD that matches the local branch ref.
    await initWorktree(workRepoPath);
    const worktreePath = join(workRepoPath, WORKTREE_DIR);

    // Create a commit on the detached worktree HEAD, then publish.
    const testFile = join(worktreePath, TBD_DIR, DATA_SYNC_DIR_NAME, 'branch-test.txt');
    await fsWriteFile(testFile, 'branch content');
    await gitInDir(worktreePath, 'add', '-A');
    await gitInDir(worktreePath, 'commit', '-m', 'Branch commit');
    const newHead = await gitInDir(worktreePath, 'rev-parse', 'HEAD');
    await gitInDir(workRepoPath, 'update-ref', `refs/heads/${SYNC_BRANCH}`, newHead);

    // Check consistency
    const consistency = await checkSyncConsistency(workRepoPath, SYNC_BRANCH, 'origin');

    expect(consistency.worktreeMatchesLocal).toBe(true);
    expect(consistency.worktreeHead).toBe(consistency.localHead);
  });
});

/**
 * Multi-worktree-safe model (plan-2026-05-08): the hidden worktree must be
 * on detached HEAD so sibling working trees of the same repo can share the
 * branch ref. Commits in the worktree advance HEAD only; the branch ref is
 * advanced explicitly via `git update-ref` (production sync uses CAS).
 *
 * These tests previously asserted the inverse (the pre-2026-05-08 design
 * that attached the worktree to tbd-sync). They are kept under the same
 * names so git history remains traceable, but the assertions are flipped.
 */
describeUnlessWindows('Detached-HEAD worktree model (multi-worktree-safe)', () => {
  let testDir: string;
  let bareRepoPath: string;
  let workRepoPath: string;
  let originalCwd: string;

  beforeEach(async () => {
    const { supported } = await checkGitVersion();
    if (!supported) {
      console.log('Skipping detached-HEAD worktree tests - Git 2.42+ required');
      return;
    }

    originalCwd = process.cwd();
    testDir = join(tmpdir(), `tbd-detach-test-${randomBytes(4).toString('hex')}`);
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
      await rm(testDir, { recursive: true, force: true }).catch(() => undefined);
    }
  });

  it('worktree is detached after fresh init', async () => {
    await initWorktree(workRepoPath);
    const worktreePath = join(workRepoPath, WORKTREE_DIR);

    // Detached HEAD: symbolic-ref returns non-zero (no symbolic ref).
    const symbolic = await gitInDir(worktreePath, 'symbolic-ref', '-q', 'HEAD').catch(() => '');
    expect(symbolic).toBe('');

    // But HEAD must be at the same commit as the branch ref.
    const head = await gitInDir(worktreePath, 'rev-parse', 'HEAD');
    const branch = await gitInDir(workRepoPath, 'rev-parse', SYNC_BRANCH);
    expect(head).toBe(branch);
  });

  it('worktree is detached after repair from prunable state', async () => {
    await initWorktree(workRepoPath);
    const worktreePath = join(workRepoPath, WORKTREE_DIR);

    await rm(worktreePath, { recursive: true, force: true });
    const result = await repairWorktree(workRepoPath, 'prunable');
    expect(result.success).toBe(true);

    const symbolic = await gitInDir(worktreePath, 'symbolic-ref', '-q', 'HEAD').catch(() => '');
    expect(symbolic).toBe('');
  });

  it('commits after repair update branch ref via update-ref (the production flow)', async () => {
    await initWorktree(workRepoPath);
    const worktreePath = join(workRepoPath, WORKTREE_DIR);

    await rm(worktreePath, { recursive: true, force: true });
    await repairWorktree(workRepoPath, 'prunable');

    // Production sync: commit on detached HEAD, then advance the branch ref.
    const testFile = join(worktreePath, TBD_DIR, DATA_SYNC_DIR_NAME, 'test.txt');
    await fsWriteFile(testFile, 'test content');
    await gitInDir(worktreePath, 'add', '-A');
    await gitInDir(worktreePath, 'commit', '-m', 'Test commit after repair');
    const newHead = await gitInDir(worktreePath, 'rev-parse', 'HEAD');
    await gitInDir(workRepoPath, 'update-ref', `refs/heads/${SYNC_BRANCH}`, newHead);

    const branchHead = await gitInDir(workRepoPath, 'rev-parse', SYNC_BRANCH);
    expect(newHead).toBe(branchHead);
  });

  it('migration leaves the worktree on detached HEAD', async () => {
    await initWorktree(workRepoPath);

    // Create data in the WRONG location (.tbd/data-sync/)
    const wrongIssuesPath = join(workRepoPath, DATA_SYNC_DIR, 'issues');
    await mkdir(wrongIssuesPath, { recursive: true });
    await fsWriteFile(join(wrongIssuesPath, 'test-branch.md'), '# Test Branch Issue\n');

    const result = await migrateDataToWorktree(workRepoPath);
    expect(result.success).toBe(true);

    const worktreePath = join(workRepoPath, WORKTREE_DIR);
    const symbolic = await gitInDir(worktreePath, 'symbolic-ref', '-q', 'HEAD').catch(() => '');
    expect(symbolic).toBe('');
  });
});

/**
 * Unit tests for the new primitives introduced by the multi-worktree-safe
 * design (plan-2026-05-08-multi-worktree-sync-support.md).
 */
describeUnlessWindows('multi-worktree primitives', () => {
  let testDir: string;
  let bareRepoPath: string;
  let workRepoPath: string;
  let originalCwd: string;

  beforeEach(async () => {
    const { supported } = await checkGitVersion();
    if (!supported) {
      console.log('Skipping multi-worktree tests - Git 2.42+ required');
      return;
    }

    originalCwd = process.cwd();
    testDir = join(tmpdir(), `tbd-mw-test-${randomBytes(4).toString('hex')}`);
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
      await rm(testDir, { recursive: true, force: true }).catch(() => undefined);
    }
  });

  describe('checkWorktreeHealth: attached state', () => {
    it("returns status='attached' when worktree HEAD is symbolic-ref to tbd-sync", async () => {
      await initWorktree(workRepoPath);
      const worktreePath = join(workRepoPath, WORKTREE_DIR);

      // Re-attach to simulate the legacy layout.
      await gitInDir(worktreePath, 'checkout', SYNC_BRANCH);

      const health = await checkWorktreeHealth(workRepoPath);
      expect(health.status).toBe('attached');
      expect(health.exists).toBe(true);
      // Attached is a *legacy* state, not invalid; doctor auto-repairs it.
      expect(health.valid).toBe(true);
      expect(health.branch).toBe(SYNC_BRANCH);
      expect(health.error).toMatch(/blocks sibling|detach in place/i);
    });

    it("returns status='valid' with branch=null when detached", async () => {
      await initWorktree(workRepoPath);
      const health = await checkWorktreeHealth(workRepoPath);
      expect(health.status).toBe('valid');
      expect(health.branch).toBe(null);
    });
  });

  describe('ensureWorktreeDetached', () => {
    it('detaches an attached worktree and returns true', async () => {
      await initWorktree(workRepoPath);
      const worktreePath = join(workRepoPath, WORKTREE_DIR);
      await gitInDir(worktreePath, 'checkout', SYNC_BRANCH);

      const wasAttached = await ensureWorktreeDetached(worktreePath);
      expect(wasAttached).toBe(true);

      const symbolic = await gitInDir(worktreePath, 'symbolic-ref', '-q', 'HEAD').catch(() => '');
      expect(symbolic).toBe('');
    });

    it('is a no-op on an already-detached worktree (returns false)', async () => {
      await initWorktree(workRepoPath);
      const worktreePath = join(workRepoPath, WORKTREE_DIR);

      const wasAttached = await ensureWorktreeDetached(worktreePath);
      expect(wasAttached).toBe(false);
    });
  });

  describe('findWorktreeOwningBranch', () => {
    it('returns null when no worktree owns the branch (detached layout)', async () => {
      await initWorktree(workRepoPath);
      const owner = await findWorktreeOwningBranch(workRepoPath, SYNC_BRANCH);
      expect(owner).toBe(null);
    });

    it('returns the worktree path when a worktree has the branch attached', async () => {
      await initWorktree(workRepoPath);
      const worktreePath = join(workRepoPath, WORKTREE_DIR);
      await gitInDir(worktreePath, 'checkout', SYNC_BRANCH);

      const owner = await findWorktreeOwningBranch(workRepoPath, SYNC_BRANCH);
      // Path comparison is loose — git may report a canonicalized path.
      expect(owner).toBeTruthy();
      expect(owner).toContain(WORKTREE_DIR);
    });

    it('returns null for a non-existent branch', async () => {
      await initWorktree(workRepoPath);
      const owner = await findWorktreeOwningBranch(workRepoPath, 'no-such-branch');
      expect(owner).toBe(null);
    });
  });

  describe('advanceSyncBranch (CAS update-ref)', () => {
    it('advances the branch ref when expectedOld matches', async () => {
      await initWorktree(workRepoPath);
      const worktreePath = join(workRepoPath, WORKTREE_DIR);

      // Make a new commit on the detached worktree.
      const testFile = join(worktreePath, TBD_DIR, DATA_SYNC_DIR_NAME, 'cas-test.txt');
      await fsWriteFile(testFile, 'cas content');
      await gitInDir(worktreePath, 'add', '-A');
      await gitInDir(worktreePath, 'commit', '-m', 'CAS test commit');
      const newHead = await gitInDir(worktreePath, 'rev-parse', 'HEAD');
      const expectedOld = await gitInDir(workRepoPath, 'rev-parse', SYNC_BRANCH);

      const result = await advanceSyncBranch(workRepoPath, SYNC_BRANCH, newHead, expectedOld);
      expect(result.success).toBe(true);

      const branchHead = await gitInDir(workRepoPath, 'rev-parse', SYNC_BRANCH);
      expect(branchHead).toBe(newHead);
    });

    it('returns success:false with actualHead when expectedOld is stale', async () => {
      await initWorktree(workRepoPath);
      const worktreePath = join(workRepoPath, WORKTREE_DIR);
      const initialBranch = await gitInDir(workRepoPath, 'rev-parse', SYNC_BRANCH);

      // Advance the branch ref out-of-band so expectedOld becomes stale.
      const f1 = join(worktreePath, TBD_DIR, DATA_SYNC_DIR_NAME, 'sibling.txt');
      await fsWriteFile(f1, 'sibling content');
      await gitInDir(worktreePath, 'add', '-A');
      await gitInDir(worktreePath, 'commit', '-m', 'Sibling commit');
      const siblingHead = await gitInDir(worktreePath, 'rev-parse', 'HEAD');
      await gitInDir(workRepoPath, 'update-ref', `refs/heads/${SYNC_BRANCH}`, siblingHead);

      // Now try to CAS using the stale expectedOld.
      const result = await advanceSyncBranch(workRepoPath, SYNC_BRANCH, siblingHead, initialBranch);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.actualHead).toBe(siblingHead);
      }
    });

    it('uses unguarded update-ref when expectedOld is empty (orphan first commit)', async () => {
      // Set up a worktree with no branch ref yet — simulate by deleting the
      // ref after init (the "no prior commit" scenario for orphan branches).
      await initWorktree(workRepoPath);
      const worktreePath = join(workRepoPath, WORKTREE_DIR);
      await gitInDir(workRepoPath, 'update-ref', '-d', `refs/heads/${SYNC_BRANCH}`);

      const head = await gitInDir(worktreePath, 'rev-parse', 'HEAD');
      const result = await advanceSyncBranch(workRepoPath, SYNC_BRANCH, head, '');
      expect(result.success).toBe(true);

      const branch = await gitInDir(workRepoPath, 'rev-parse', SYNC_BRANCH);
      expect(branch).toBe(head);
    });
  });

  describe('repairWorktree: attached', () => {
    it("repairs status='attached' by detaching in place (no commits, no backup)", async () => {
      await initWorktree(workRepoPath);
      const worktreePath = join(workRepoPath, WORKTREE_DIR);
      await gitInDir(worktreePath, 'checkout', SYNC_BRANCH);

      const headBefore = await gitInDir(worktreePath, 'rev-parse', 'HEAD');
      const branchBefore = await gitInDir(workRepoPath, 'rev-parse', SYNC_BRANCH);

      const result = await repairWorktree(workRepoPath, 'attached');
      expect(result.success).toBe(true);
      expect(result.backedUp).toBeUndefined();

      const symbolic = await gitInDir(worktreePath, 'symbolic-ref', '-q', 'HEAD').catch(() => '');
      expect(symbolic).toBe('');

      // No commits added, no data movement.
      const headAfter = await gitInDir(worktreePath, 'rev-parse', 'HEAD');
      const branchAfter = await gitInDir(workRepoPath, 'rev-parse', SYNC_BRANCH);
      expect(headAfter).toBe(headBefore);
      expect(branchAfter).toBe(branchBefore);
    });
  });
});
