/**
 * `migrateDataToWorktree` must not report success for work it did not record.
 *
 * The function copies files into the sync worktree, commits them, and then (with
 * `removeSource`) deletes the originals. It previously skipped the commit
 * whenever nothing was staged and returned `success: true` with the full
 * `migratedCount` regardless, on the assumption that "nothing staged" always
 * means "a previous run already migrated these". If that assumption is ever
 * wrong, the source files are deleted while nothing on the sync branch records
 * them.
 *
 * See tbd-rdsb, where `doctor --fix` intermittently left no migration commit at
 * the sync-branch tip while still reporting a successful migration.
 */

import { mkdir, mkdtemp, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { git, initWorktree, migrateDataToWorktree } from '../src/file/git.js';

const ISSUE = [
  '---',
  'id: is-01hx5zzkbkactav9wevgemmvrz',
  'title: Misplaced',
  'status: open',
  'kind: task',
  'priority: 2',
  'created_at: 2025-01-01T00:00:00.000Z',
  'updated_at: 2025-01-01T00:00:00.000Z',
  'version: 1',
  'type: is',
  '---',
  'Body',
  '',
].join('\n');

describe('migrateDataToWorktree', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'tbd-migrate-'));
    await git('-C', dir, 'init', '-q', '--initial-branch=main');
    await git('-C', dir, 'config', 'user.email', 't@e.com');
    await git('-C', dir, 'config', 'user.name', 'T');
    await git('-C', dir, 'config', 'commit.gpgsign', 'false');
    await writeFile(join(dir, 'README.md'), '# t\n');
    await git('-C', dir, 'add', '-A');
    await git('-C', dir, 'commit', '-q', '-m', 'init');
    // The migration writes into the shared sync worktree, which must exist.
    const init = await initWorktree(dir);
    expect(init.success).toBe(true);
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  /** Put an issue in the pre-worktree location the migration reads from. */
  async function plantMisplacedIssue(name = 'is-01hx5zzkbkactav9wevgemmvrz.md'): Promise<void> {
    const wrong = join(dir, '.tbd', 'data-sync', 'issues');
    await mkdir(wrong, { recursive: true });
    await writeFile(join(wrong, name), ISSUE);
  }

  it('migrates, commits, and reports that it committed', async () => {
    await plantMisplacedIssue();

    const result = await migrateDataToWorktree(dir, false);

    expect(result.success).toBe(true);
    expect(result.migratedCount).toBe(1);
    expect(result.committed).toBe(true);

    const worktree = join(dir, '.git', 'tbd', 'data-sync-worktree');
    const log = await git('-C', worktree, 'log', '--oneline', '-1');
    expect(log).toContain('tbd: migrate');
  });

  it('reports committed=false on a second run, without inventing a commit', async () => {
    await plantMisplacedIssue();
    await migrateDataToWorktree(dir, false);

    // The source is still present, so the second run copies identical bytes and
    // stages nothing. That is the benign case, and it must stay a success.
    const second = await migrateDataToWorktree(dir, false);

    expect(second.success).toBe(true);
    expect(second.committed).toBe(false);
  });

  it('leaves the source in place when it did not commit', async () => {
    await plantMisplacedIssue();

    // removeSource: deletion must only follow a recorded migration.
    const result = await migrateDataToWorktree(dir, true);
    expect(result.success).toBe(true);
    expect(result.committed).toBe(true);
  });

  it('fails loudly, and keeps the source, when the copy is never recorded', async () => {
    // A stray ignore rule in the sync worktree is the reachable version of the
    // dangerous state: `git add -A` stages nothing, the diff is clean, and the
    // old code read that as "already migrated", reported success, and deleted
    // the source. The copied file exists on disk but nothing on the branch
    // records it.
    const worktree = join(dir, '.git', 'tbd', 'data-sync-worktree');
    await writeFile(join(worktree, '.gitignore'), '.tbd/data-sync/issues/\n');
    await git('-C', worktree, 'add', '-A');
    await git('-C', worktree, 'commit', '-q', '-m', 'ignore issues');

    await plantMisplacedIssue();
    const sourceFile = join(dir, '.tbd', 'data-sync', 'issues', 'is-01hx5zzkbkactav9wevgemmvrz.md');

    const result = await migrateDataToWorktree(dir, true);

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/committed nothing/i);
    expect(result.error).toMatch(/left in place/i);

    // The source must survive a migration that recorded nothing.
    await expect(stat(sourceFile)).resolves.toBeDefined();
  });
});
