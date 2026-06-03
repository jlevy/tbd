/**
 * Unit tests for mergeBeadAcrossRefs — the structured three-way merge primitive
 * that reads base/ours/theirs for a single bead directly from git refs.
 *
 * See: issue #155, plan-2026-06-03-tbd-sync-structured-bead-merge.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir, platform } from 'node:os';
import { randomBytes } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { mergeBeadAcrossRefs } from '../src/file/git.js';
import { serializeIssue } from '../src/file/parser.js';
import { DATA_SYNC_DIR } from '../src/lib/paths.js';
import { createTestIssue, testId, TEST_ULIDS } from './test-helpers.js';
import type { Issue } from '../src/lib/types.js';

const EPIC = testId(TEST_ULIDS.ULID_1);
const COMMON = testId(TEST_ULIDS.ULID_2);
const CHILD_A = testId(TEST_ULIDS.ULID_3);
const CHILD_B = testId(TEST_ULIDS.ULID_4);
const SHARED = testId(TEST_ULIDS.ULID_5);
const OTHER = testId(TEST_ULIDS.ULID_6);
const X = testId(TEST_ULIDS.ULID_8);
const Y = testId(TEST_ULIDS.ULID_9);

const execFileAsync = promisify(execFile);
const isWindows = platform() === 'win32';
const describeUnlessWindows = isWindows ? describe.skip : describe;

describeUnlessWindows('mergeBeadAcrossRefs', () => {
  let repo: string;

  const git = (...args: string[]) => execFileAsync('git', args, { cwd: repo });

  /** Commit a bead at its canonical data-sync path on the current branch. */
  const commitBead = async (issue: Issue, message: string) => {
    const dir = join(repo, DATA_SYNC_DIR, 'issues');
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, `${issue.id}.md`), serializeIssue(issue));
    await git('add', '-A');
    await git('commit', '-m', message);
  };

  beforeEach(async () => {
    repo = join(tmpdir(), `tbd-merge-refs-${randomBytes(6).toString('hex')}`);
    await mkdir(repo, { recursive: true });
    await git('init', '-b', 'main');
    await git('config', 'user.email', 'test@example.com');
    await git('config', 'user.name', 'Test');
    // Keep commits hermetic — never invoke the environment's commit signer.
    await git('config', 'commit.gpgsign', 'false');
    await git('config', 'tag.gpgsign', 'false');
  });

  afterEach(async () => {
    await rm(repo, { recursive: true, force: true });
  });

  it('unions children appended on each branch from a shared base', async () => {
    const id = EPIC;
    await commitBead(
      createTestIssue({ id, title: 'Epic', kind: 'epic', child_order_hints: [COMMON] }),
      'base',
    );

    // ours: append child A
    await git('checkout', '-b', 'ours');
    await commitBead(
      createTestIssue({
        id,
        title: 'Epic',
        kind: 'epic',
        version: 2,
        child_order_hints: [COMMON, CHILD_A],
        updated_at: '2025-01-02T00:00:00Z',
      }),
      'ours appends A',
    );

    // theirs: branch from base, append child B
    await git('checkout', 'main');
    await git('checkout', '-b', 'theirs');
    await commitBead(
      createTestIssue({
        id,
        title: 'Epic',
        kind: 'epic',
        version: 2,
        child_order_hints: [COMMON, CHILD_B],
        updated_at: '2025-01-03T00:00:00Z',
      }),
      'theirs appends B',
    );

    const result = await mergeBeadAcrossRefs(repo, id, 'ours', 'theirs');

    expect(result).not.toBeNull();
    expect(result!.merged.child_order_hints).toEqual([COMMON, CHILD_A, CHILD_B]);
    expect(result!.merged.version).toBe(3);
  });

  it('returns null when the bead is absent on the theirs side', async () => {
    const id = SHARED;
    await commitBead(createTestIssue({ id, title: 'Base' }), 'base');
    await git('checkout', '-b', 'ours');
    await commitBead(
      createTestIssue({ id, title: 'Base', version: 2, status: 'in_progress' }),
      'ours edits',
    );
    // theirs is an orphan root where this bead's file is missing.
    await git('checkout', '--orphan', 'theirs');
    await git('rm', '-rf', '.');
    await commitBead(createTestIssue({ id: OTHER, title: 'Unrelated' }), 'theirs other');

    const result = await mergeBeadAcrossRefs(repo, id, 'ours', 'theirs');

    expect(result).toBeNull();
  });

  it('merges add/add with no common ancestor (no base)', async () => {
    const id = EPIC;
    // ours root
    await git('checkout', '-b', 'ours');
    await commitBead(
      createTestIssue({
        id,
        title: 'Added',
        child_order_hints: [X],
        created_at: '2025-01-01T00:00:00Z',
      }),
      'ours root',
    );
    // theirs: unrelated orphan root with the same bead id
    await git('checkout', '--orphan', 'theirs');
    await git('rm', '-rf', '.');
    await commitBead(
      createTestIssue({
        id,
        title: 'Added',
        child_order_hints: [Y],
        created_at: '2025-01-01T00:00:00Z',
      }),
      'theirs root',
    );

    // No merge-base exists; helper must still produce a merge, not throw.
    const result = await mergeBeadAcrossRefs(repo, id, 'ours', 'theirs');

    expect(result).not.toBeNull();
  });
});
