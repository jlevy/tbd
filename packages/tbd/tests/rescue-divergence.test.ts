/**
 * Rescue divergence matrix + precondition tests (tbd-e550).
 *
 * Same-ULID divergence across two unrelated roots must never be dropped:
 *   identical             -> no-op
 *   same-origin field diff -> field-merge (no data discarded, no attic)
 *   true conflict          -> losing version preserved in attic/conflicts/
 * Plus preconditions: rescue tolerates a dirty worktree (commits it first) but
 * still aborts on a merge in progress
 * (never resets over uncommitted work).
 *
 * See: plan-2026-05-29-tbd-sync-unrelated-history-hardening.md (Phase 2 tests)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, rm, readdir, readFile, writeFile as fsWriteFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir, platform } from 'node:os';
import { randomBytes } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { initWorktree, rescueUnrelatedHistory, branchExists } from '../src/file/git.js';
import { writeIssue, readIssue } from '../src/file/storage.js';
import { loadIdMapping, saveIdMapping, type IdMapping } from '../src/file/id-mapping.js';
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

  it('preserves the dropped side in attic when a same-origin field diverges', async () => {
    // Equal created_at -> field-by-field merge against a synthetic base (the
    // lower-version side). The higher-version side's change is applied, but the
    // other side's value is NOT silently dropped — it is preserved in attic.
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
    // The local labels are not kept by the merge, so they are preserved.
    expect(result.conflicts).toBeGreaterThanOrEqual(1);

    const merged = await readIssue(dataSyncPath, `is-${SHARED}`);
    expect(merged.labels).toEqual(['remote']);
    expect(await atticConflictFiles()).toContainEqual(expect.stringContaining(`is-${SHARED}__`));
  });

  it('drops neither side when both edit the same field from the same version (issue #1)', async () => {
    // Same id, same created_at, same version, both sides edited the same scalar.
    // mergeIssues has no trustworthy base; the rescue must still preserve the
    // side the merge does not keep, so neither edit is lost.
    const created = '2026-01-01T00:00:00Z';
    await buildUnrelated(
      createTestIssue({ id: `is-${SHARED}`, title: 'local edit', created_at: created, version: 1 }),
      createTestIssue({
        id: `is-${SHARED}`,
        title: 'remote edit',
        created_at: created,
        version: 1,
      }),
    );

    const result = await rescueUnrelatedHistory(workPath, 'origin', SYNC_BRANCH);
    expect(result.merged).toBe(1);
    expect(result.conflicts).toBeGreaterThanOrEqual(1);

    // The merged file carries one side's title; the other side is preserved.
    const merged = await readIssue(dataSyncPath, `is-${SHARED}`);
    const attic = await atticConflictFiles();
    expect(attic.some((f) => f.startsWith(`is-${SHARED}__`))).toBe(true);

    // Neither title is lost: one is the merged value, the other lives in attic.
    const atticBodies = await Promise.all(
      attic.map((f) => readFile(join(dataSyncPath, 'attic', 'conflicts', f), 'utf-8')),
    );
    const allTitles = [merged.title, ...atticBodies.map((b) => /title: (.*)/.exec(b)?.[1] ?? '')];
    expect(allTitles).toContain('local edit');
    expect(allTitles).toContain('remote edit');
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

  function idMap(pairs: [string, string][]): IdMapping {
    const shortToUlid = new Map(pairs);
    const ulidToShort = new Map(pairs.map(([s, u]) => [u, s] as [string, string]));
    return { shortToUlid, ulidToShort };
  }

  /** Commit the given issues (+ optional ids.yml) onto the local tbd-sync. */
  async function commitLocal(issues: Issue[], mapping?: IdMapping): Promise<void> {
    for (const issue of issues) await writeIssue(dataSyncPath, issue);
    if (mapping) await saveIdMapping(dataSyncPath, mapping);
    await g(worktreePath, 'add', '-A');
    await g(worktreePath, '-c', 'commit.gpgsign=false', 'commit', '-m', 'local');
  }

  /** Push an unrelated orphan tbd-sync (+ optional ids.yml) to the bare remote. */
  async function pushRemoteSeed(issues: Issue[], mapping?: IdMapping): Promise<void> {
    const seed = join(testDir, `seed-${randomBytes(3).toString('hex')}`);
    const seedData = join(seed, TBD_DIR, DATA_SYNC_DIR_NAME);
    await mkdir(join(seedData, 'issues'), { recursive: true });
    await g(seed, 'init', '-b', SYNC_BRANCH);
    await g(seed, 'config', 'user.email', 'b@b.com');
    await g(seed, 'config', 'user.name', 'B');
    await g(seed, 'config', 'commit.gpgsign', 'false');
    for (const issue of issues) await writeIssue(seedData, issue);
    if (mapping) await saveIdMapping(seedData, mapping);
    await g(seed, 'add', '-A');
    await g(seed, 'commit', '-m', 'env B');
    await g(seed, 'push', barePath, `${SYNC_BRANCH}:refs/heads/${SYNC_BRANCH}`);
    await g(workPath, 'remote', 'add', 'origin', barePath);
  }

  it('keeps the remote public ID when local and remote use the same short ID (issue #2)', async () => {
    const localUlid = '01collidelocal000000000000';
    const remoteUlid = '01collideremote00000000000';
    // Both roots independently assigned the short ID "ab12" to different ULIDs.
    await commitLocal(
      [createTestIssue({ id: `is-${localUlid}`, title: 'local only' })],
      idMap([['ab12', localUlid]]),
    );
    await pushRemoteSeed(
      [createTestIssue({ id: `is-${remoteUlid}`, title: 'remote only' })],
      idMap([['ab12', remoteUlid]]),
    );

    await rescueUnrelatedHistory(workPath, 'origin', SYNC_BRANCH);

    const mapping = await loadIdMapping(dataSyncPath);
    // Remote (the adopted canonical base) keeps its original public ID.
    expect(mapping.ulidToShort.get(remoteUlid)).toBe('ab12');
    // The colliding local-only issue is regenerated to a different short ID.
    expect(mapping.ulidToShort.get(localUlid)).toBeDefined();
    expect(mapping.ulidToShort.get(localUlid)).not.toBe('ab12');
  });

  it('reports success (no failure) for a no-op rescue with nothing to commit (issue #3)', async () => {
    // Identical single issue + identical canonical ids.yml on both unrelated
    // roots: after adopting the remote base there is nothing to reconcile or
    // commit, but rescue must still succeed rather than fail on "nothing to commit".
    const ulid = '01noopidentical00000000000';
    const issue = createTestIssue({
      id: `is-${ulid}`,
      title: 'same',
      created_at: '2026-01-01T00:00:00Z',
    });
    const mapping = idMap([['ab12', ulid]]);
    await commitLocal([{ ...issue }], mapping);
    await pushRemoteSeed([{ ...issue }], mapping);

    const result = await rescueUnrelatedHistory(workPath, 'origin', SYNC_BRANCH);
    expect(result.merged).toBe(0);
    expect(result.localOnly).toBe(0);
    expect(result.backupBranch).toMatch(/^tbd-backup-/);

    // No empty commit was created: local tbd-sync equals the adopted remote base.
    const localHead = await g(workPath, 'rev-parse', SYNC_BRANCH);
    const remoteHead = await g(workPath, 'rev-parse', `origin/${SYNC_BRANCH}`);
    expect(localHead).toBe(remoteHead);
  });

  it('tolerates a dirty worktree by committing it first, then rescues (#158)', async () => {
    const created = '2026-01-01T00:00:00Z';
    await buildUnrelated(
      createTestIssue({ id: `is-${SHARED}`, title: 'local', created_at: created }),
      createTestIssue({ id: `is-${SHARED}`, title: 'remote', created_at: created }),
    );
    // tbd's own uncommitted data-sync write (e.g. a sync caught mid-flight).
    await writeIssue(
      dataSyncPath,
      createTestIssue({ id: 'is-01dirtyuncommitted00000001', title: 'uncommitted' }),
    );

    const result = await rescueUnrelatedHistory(workPath, 'origin', SYNC_BRANCH);

    // It no longer aborts: a backup branch is created and the rescue completes.
    expect(await branchExists(result.backupBranch, workPath)).toBe(true);
    // The backup captures the previously-uncommitted file faithfully.
    await expect(
      g(
        workPath,
        'cat-file',
        '-e',
        `${result.backupBranch}:${TBD_DIR}/${DATA_SYNC_DIR_NAME}/issues/is-01dirtyuncommitted00000001.md`,
      ),
    ).resolves.toBe('');
    // Push will fast-forward over the adopted remote base.
    await expect(
      g(workPath, 'merge-base', '--is-ancestor', `origin/${SYNC_BRANCH}`, SYNC_BRANCH),
    ).resolves.toBe('');
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
