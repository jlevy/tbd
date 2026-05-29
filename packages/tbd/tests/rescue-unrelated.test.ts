/**
 * Integration tests for rescueUnrelatedHistory (#139, core happy path).
 *
 * The same-ULID divergence matrix and dirty-worktree precondition live in the
 * dedicated test bead (tbd-e550). This proves the core contract: adopt the
 * remote base, replay local-only work, merge both-different, end up
 * fast-forward-able with a recoverable backup branch.
 *
 * See: tbd-6l8r (plan-2026-05-29-tbd-sync-unrelated-history-hardening.md)
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
import { loadIdMapping } from '../src/file/id-mapping.js';
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

// ULIDs: shared (both roots), local-only, remote-only.
const SHARED = '01rescueintg00000000shared';
const LOCAL_ONLY = '01rescueintg00000localonly';
const REMOTE_ONLY = '01rescueintg0000remoteonly';

describeUnlessWindows('rescueUnrelatedHistory (core)', () => {
  let testDir: string;
  let barePath: string;
  let workPath: string;
  let dataSyncPath: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `tbd-rescue-${randomBytes(4).toString('hex')}`);
    barePath = join(testDir, 'remote.git');
    workPath = join(testDir, 'work');
    await mkdir(barePath, { recursive: true });
    await g(barePath, 'init', '--bare');

    // Work repo, NO remote yet (so initWorktree makes a local orphan tbd-sync).
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
    const worktreePath = join(workPath, '.git', 'tbd', 'data-sync-worktree');
    dataSyncPath = join(worktreePath, TBD_DIR, DATA_SYNC_DIR_NAME);

    // Local issues: a local-only issue + a shared-id issue (local content).
    await writeIssue(
      dataSyncPath,
      createTestIssue({ id: `is-${LOCAL_ONLY}`, title: 'local only' }),
    );
    await writeIssue(
      dataSyncPath,
      createTestIssue({ id: `is-${SHARED}`, title: 'shared — local edit' }),
    );
    await g(worktreePath, 'add', '-A');
    await g(worktreePath, '-c', 'commit.gpgsign=false', 'commit', '-m', 'local work');

    // Seed the bare remote with an UNRELATED orphan tbd-sync (env B): a
    // remote-only issue + the shared-id issue with different content.
    const seed = join(testDir, 'seedB');
    await mkdir(join(seed, TBD_DIR, DATA_SYNC_DIR_NAME, 'issues'), { recursive: true });
    await g(seed, 'init', '-b', SYNC_BRANCH);
    await g(seed, 'config', 'user.email', 'b@b.com');
    await g(seed, 'config', 'user.name', 'B');
    await g(seed, 'config', 'commit.gpgsign', 'false');
    const seedData = join(seed, TBD_DIR, DATA_SYNC_DIR_NAME);
    await writeIssue(seedData, createTestIssue({ id: `is-${REMOTE_ONLY}`, title: 'remote only' }));
    await writeIssue(
      seedData,
      createTestIssue({ id: `is-${SHARED}`, title: 'shared — remote edit' }),
    );
    await g(seed, 'add', '-A');
    await g(seed, 'commit', '-m', 'env B');
    await g(seed, 'push', barePath, `${SYNC_BRANCH}:refs/heads/${SYNC_BRANCH}`);

    // Now attach the remote — local and origin tbd-sync are unrelated.
    await g(workPath, 'remote', 'add', 'origin', barePath);
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true }).catch(() => undefined);
  });

  it('adopts the remote base, replays local work, and ends up fast-forward-able', async () => {
    const result = await rescueUnrelatedHistory(workPath, 'origin', SYNC_BRANCH);

    // A backup branch holds the pre-rescue HEAD.
    expect(result.backupBranch).toMatch(/^tbd-backup-/);
    expect(await branchExists(result.backupBranch, workPath)).toBe(true);

    // Push will now fast-forward: origin/tbd-sync is an ancestor of tbd-sync.
    await expect(
      g(workPath, 'merge-base', '--is-ancestor', `origin/${SYNC_BRANCH}`, SYNC_BRANCH),
    ).resolves.toBe('');

    // All three issues survive (local-only, remote-only, shared/merged).
    const issues = await listIssues(dataSyncPath);
    const ids = issues.map((i) => i.id).sort();
    expect(ids).toEqual([`is-${LOCAL_ONLY}`, `is-${REMOTE_ONLY}`, `is-${SHARED}`].sort());
    expect(result.localOnly).toBe(1);
    expect(result.merged).toBe(1);

    // Every issue has a backing mapping and there are no duplicate public IDs.
    const mapping = await loadIdMapping(dataSyncPath);
    expect(mapping.ulidToShort.size).toBe(issues.length);
    const shortIds = [...mapping.shortToUlid.keys()];
    expect(new Set(shortIds).size).toBe(shortIds.length);
  });

  it('preserves the pre-rescue HEAD on the backup branch', async () => {
    const preHead = await g(workPath, 'rev-parse', SYNC_BRANCH);
    const result = await rescueUnrelatedHistory(workPath, 'origin', SYNC_BRANCH);
    const backupHead = await g(workPath, 'rev-parse', result.backupBranch);
    expect(backupHead).toBe(preHead);
  });
});
