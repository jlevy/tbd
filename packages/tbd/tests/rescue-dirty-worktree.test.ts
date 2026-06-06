/**
 * Integration tests for rescueUnrelatedHistory's worktree preconditions (#158).
 *
 * A transiently dirty sync worktree (tbd's own uncommitted data-sync writes)
 * must NOT block the rescue: the rescue commits that state first (so the
 * tbd-backup-* branch captures it faithfully) and proceeds. A genuine
 * merge-in-progress is still refused.
 *
 * See: plan-2026-06-03-unrelated-rescue-dirty-worktree.md
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, rm, writeFile as fsWriteFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir, platform } from 'node:os';
import { randomBytes } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { initWorktree, rescueUnrelatedHistory, branchExists } from '../src/file/git.js';
import { writeIssue, listIssues } from '../src/file/storage.js';
import { SYNC_BRANCH, TBD_DIR, DATA_SYNC_DIR_NAME } from '../src/lib/paths.js';
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

const LOCAL_ONLY = '01rescuedirty0000localonly';
const REMOTE_ONLY = '01rescuedirty000remoteonly';
const DIRTY = '01rescuedirty0000000dirty1';

const issuesRel = `${TBD_DIR}/${DATA_SYNC_DIR_NAME}/issues`;

describeUnlessWindows('rescueUnrelatedHistory worktree preconditions (#158)', () => {
  let testDir: string;
  let workPath: string;
  let worktreePath: string;
  let dataSyncPath: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `tbd-rescue-dirty-${randomBytes(4).toString('hex')}`);
    const barePath = join(testDir, 'remote.git');
    workPath = join(testDir, 'work');
    await mkdir(barePath, { recursive: true });
    await g(barePath, 'init', '--bare');

    // Work repo, no remote yet → initWorktree creates a local orphan tbd-sync.
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

    // Commit one local-only issue.
    await writeIssue(
      dataSyncPath,
      createTestIssue({ id: `is-${LOCAL_ONLY}`, title: 'local only' }),
    );
    await g(worktreePath, 'add', '-A');
    await g(worktreePath, '-c', 'commit.gpgsign=false', 'commit', '-m', 'local work');

    // Seed the bare remote with an UNRELATED orphan tbd-sync.
    const seed = join(testDir, 'seedB');
    await mkdir(join(seed, TBD_DIR, DATA_SYNC_DIR_NAME, 'issues'), { recursive: true });
    await g(seed, 'init', '-b', SYNC_BRANCH);
    await g(seed, 'config', 'user.email', 'b@b.com');
    await g(seed, 'config', 'user.name', 'B');
    await g(seed, 'config', 'commit.gpgsign', 'false');
    await writeIssue(
      join(seed, TBD_DIR, DATA_SYNC_DIR_NAME),
      createTestIssue({ id: `is-${REMOTE_ONLY}`, title: 'remote only' }),
    );
    await g(seed, 'add', '-A');
    await g(seed, 'commit', '-m', 'env B');
    await g(seed, 'push', barePath, `${SYNC_BRANCH}:refs/heads/${SYNC_BRANCH}`);

    await g(workPath, 'remote', 'add', 'origin', barePath);
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true }).catch(() => undefined);
  });

  it('rescues over a dirty worktree and the backup branch captures the uncommitted work', async () => {
    // tbd's own uncommitted write lands in the worktree (e.g. a sync in flight).
    await writeIssue(dataSyncPath, createTestIssue({ id: `is-${DIRTY}`, title: 'uncommitted' }));
    expect((await g(worktreePath, 'status', '--porcelain')).trim()).not.toBe('');

    const result = await rescueUnrelatedHistory(workPath, 'origin', SYNC_BRANCH);

    // Backup branch exists and faithfully includes the previously-uncommitted file.
    expect(await branchExists(result.backupBranch, workPath)).toBe(true);
    await expect(
      g(workPath, 'cat-file', '-e', `${result.backupBranch}:${issuesRel}/is-${DIRTY}.md`),
    ).resolves.toBe('');

    // The uncommitted local-only issue survived the rescue (replayed onto base).
    const ids = (await listIssues(dataSyncPath)).map((i) => i.id).sort();
    expect(ids).toEqual([`is-${DIRTY}`, `is-${LOCAL_ONLY}`, `is-${REMOTE_ONLY}`].sort());

    // Push will fast-forward.
    await expect(
      g(workPath, 'merge-base', '--is-ancestor', `origin/${SYNC_BRANCH}`, SYNC_BRANCH),
    ).resolves.toBe('');
  });

  it('still refuses when a merge is in progress in the sync worktree', async () => {
    // Simulate a half-finished merge by writing MERGE_HEAD directly. (Newer git
    // refuses `update-ref MERGE_HEAD` as a pseudoref, so write the file.)
    const gitDir = await g(worktreePath, 'rev-parse', '--absolute-git-dir');
    const head = await g(worktreePath, 'rev-parse', 'HEAD');
    await fsWriteFile(join(gitDir, 'MERGE_HEAD'), `${head}\n`);

    await expect(rescueUnrelatedHistory(workPath, 'origin', SYNC_BRANCH)).rejects.toThrow(
      /merge is in progress/,
    );
  });
});
