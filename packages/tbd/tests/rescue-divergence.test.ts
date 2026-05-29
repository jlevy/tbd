/**
 * Rescue divergence matrix + precondition tests (tbd-e550).
 *
 * Same-ULID divergence across two unrelated roots must never be dropped:
 *   identical             -> no-op
 *   same-origin field diff -> field-merge (no data discarded, no attic)
 *   true conflict          -> losing version preserved in attic/conflicts/
 * Plus preconditions: rescue aborts on a dirty worktree or a merge in progress
 * (never resets over uncommitted work).
 *
 * See: plan-2026-05-29-tbd-sync-unrelated-history-hardening.md (Phase 2 tests)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, rm, readdir, writeFile as fsWriteFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir, platform } from 'node:os';
import { randomBytes } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { initWorktree, rescueUnrelatedHistory } from '../src/file/git.js';
import { writeIssue, readIssue } from '../src/file/storage.js';
import { SYNC_BRANCH, TBD_DIR, DATA_SYNC_DIR_NAME } from '../src/lib/paths.js';
import type { Issue } from '../src/lib/types.js';
import { createTestIssue } from './test-helpers.js';

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

const SHARED = '01rescuediverg00000000shar';

describeUnlessWindows('rescue divergence matrix + preconditions', () => {
  let testDir: string;
  let barePath: string;
  let workPath: string;
  let worktreePath: string;
  let dataSyncPath: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `tbd-rescuediv-${randomBytes(4).toString('hex')}`);
    barePath = join(testDir, 'remote.git');
    workPath = join(testDir, 'work');
    await mkdir(barePath, { recursive: true });
    await g(barePath, 'init', '--bare');
    await mkdir(workPath, { recursive: true });
    await g(workPath, 'init', '-b', 'main');
    await g(workPath, 'config', 'user.email', 't@t.com');
    await g(workPath, 'config', 'user.name', 'T');
    await g(workPath, 'config', 'commit.gpgsign', 'false');
    await fsWriteFile(join(workPath, 'README.md'), '# t\n');
    await g(workPath, 'add', '.');
    await g(workPath, 'commit', '-m', 'init');

    const init = await initWorktree(workPath);
    expect(init.success).toBe(true);
    worktreePath = join(workPath, '.git', 'tbd', 'data-sync-worktree');
    dataSyncPath = join(worktreePath, TBD_DIR, DATA_SYNC_DIR_NAME);
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true }).catch(() => undefined);
  });

  /**
   * Build the unrelated state: local tbd-sync carries `localShared`, the remote
   * orphan tbd-sync carries `remoteShared` (same id, possibly divergent).
   */
  async function buildUnrelated(localShared: Issue, remoteShared: Issue): Promise<void> {
    await writeIssue(dataSyncPath, localShared);
    await g(worktreePath, 'add', '-A');
    await g(worktreePath, '-c', 'commit.gpgsign=false', 'commit', '-m', 'local');

    const seed = join(testDir, `seed-${randomBytes(3).toString('hex')}`);
    await mkdir(join(seed, TBD_DIR, DATA_SYNC_DIR_NAME, 'issues'), { recursive: true });
    await g(seed, 'init', '-b', SYNC_BRANCH);
    await g(seed, 'config', 'user.email', 'b@b.com');
    await g(seed, 'config', 'user.name', 'B');
    await g(seed, 'config', 'commit.gpgsign', 'false');
    await writeIssue(join(seed, TBD_DIR, DATA_SYNC_DIR_NAME), remoteShared);
    await g(seed, 'add', '-A');
    await g(seed, 'commit', '-m', 'env B');
    await g(seed, 'push', barePath, `${SYNC_BRANCH}:refs/heads/${SYNC_BRANCH}`);

    await g(workPath, 'remote', 'add', 'origin', barePath);
  }

  async function atticConflictFiles(): Promise<string[]> {
    return readdir(join(dataSyncPath, 'attic', 'conflicts')).catch(() => [] as string[]);
  }

  it('identical same-ULID is a no-op (no merge, no attic artifact)', async () => {
    const issue = createTestIssue({
      id: `is-${SHARED}`,
      title: 'same',
      created_at: '2026-01-01T00:00:00Z',
    });
    await buildUnrelated({ ...issue }, { ...issue });

    const result = await rescueUnrelatedHistory(workPath, 'origin', SYNC_BRANCH);
    expect(result.merged).toBe(0);
    expect(result.conflicts).toBe(0);
    expect(await atticConflictFiles()).toHaveLength(0);
  });

  it('field-merges a same-origin divergence without dropping the issue (no attic)', async () => {
    // Equal created_at -> field-by-field merge against a synthetic base (the
    // lower-version side). The higher-version side's field changes are applied;
    // no data is discarded, so no attic artifact is created.
    const created = '2026-01-01T00:00:00Z';
    await buildUnrelated(
      createTestIssue({
        id: `is-${SHARED}`,
        title: 'same',
        labels: ['local'],
        created_at: created,
        version: 1,
      }),
      createTestIssue({
        id: `is-${SHARED}`,
        title: 'same',
        labels: ['remote'],
        created_at: created,
        version: 2,
      }),
    );

    const result = await rescueUnrelatedHistory(workPath, 'origin', SYNC_BRANCH);
    expect(result.merged).toBe(1);
    expect(result.conflicts).toBe(0);
    expect(await atticConflictFiles()).toHaveLength(0);

    // The issue survives and carries the higher-version side's labels.
    const merged = await readIssue(dataSyncPath, `is-${SHARED}`);
    expect(merged.labels).toEqual(['remote']);
  });

  it('preserves the losing version in attic/conflicts/ on a true conflict', async () => {
    // Different created_at + different content -> whole-issue LWW: the
    // earlier-created side wins and the loser is preserved, never dropped.
    await buildUnrelated(
      createTestIssue({
        id: `is-${SHARED}`,
        title: 'local title',
        created_at: '2026-01-01T00:00:00Z',
      }),
      createTestIssue({
        id: `is-${SHARED}`,
        title: 'remote title',
        created_at: '2026-02-01T00:00:00Z',
      }),
    );

    const result = await rescueUnrelatedHistory(workPath, 'origin', SYNC_BRANCH);
    expect(result.merged).toBe(1);
    expect(result.conflicts).toBe(1);

    const merged = await readIssue(dataSyncPath, `is-${SHARED}`);
    expect(merged.title).toBe('local title'); // earlier-created wins

    // The losing (remote) version is preserved as an explicit artifact.
    const attic = await atticConflictFiles();
    expect(attic.some((f) => f.startsWith(`is-${SHARED}__`))).toBe(true);
  });

  it('aborts on a dirty worktree without resetting or creating a backup branch', async () => {
    const created = '2026-01-01T00:00:00Z';
    await buildUnrelated(
      createTestIssue({ id: `is-${SHARED}`, title: 'local', created_at: created }),
      createTestIssue({ id: `is-${SHARED}`, title: 'remote', created_at: created }),
    );
    // Uncommitted change in the worktree.
    await fsWriteFile(join(dataSyncPath, 'issues', 'is-01dirtyuncommitted00000000.md'), 'junk\n');

    const headBefore = await g(workPath, 'rev-parse', SYNC_BRANCH);
    await expect(rescueUnrelatedHistory(workPath, 'origin', SYNC_BRANCH)).rejects.toThrow(
      /uncommitted changes/i,
    );
    // No reset happened and no backup branch was created.
    expect(await g(workPath, 'rev-parse', SYNC_BRANCH)).toBe(headBefore);
    const backups = (await g(workPath, 'branch', '--list', 'tbd-backup-*')).trim();
    expect(backups).toBe('');
  });

  it('aborts when a merge is in progress in the worktree', async () => {
    const created = '2026-01-01T00:00:00Z';
    await buildUnrelated(
      createTestIssue({ id: `is-${SHARED}`, title: 'local', created_at: created }),
      createTestIssue({ id: `is-${SHARED}`, title: 'remote', created_at: created }),
    );
    // Simulate an in-progress merge: a MERGE_HEAD in the worktree's git dir
    // (clean working tree, so this exercises the merge-in-progress guard, not
    // the dirty-worktree guard).
    const gitDir = await g(worktreePath, 'rev-parse', '--absolute-git-dir');
    const head = await g(worktreePath, 'rev-parse', 'HEAD');
    await fsWriteFile(join(gitDir, 'MERGE_HEAD'), `${head}\n`);

    await expect(rescueUnrelatedHistory(workPath, 'origin', SYNC_BRANCH)).rejects.toThrow(
      /merge is in progress/i,
    );
  });
});
