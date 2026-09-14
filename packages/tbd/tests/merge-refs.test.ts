/**
 * Unit tests for mergeBeadAcrossRefs — the structured three-way merge primitive
 * that reads base/ours/theirs for a single bead directly from git refs.
 *
 * See: issue #155, plan-2026-06-03-tbd-sync-structured-bead-merge.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, rm, readFile, writeFile } from 'node:fs/promises';
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
    await rm(repo, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 100,
    });
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

  it('propagates a parse error when a committed bead is corrupt (not treated as absent)', async () => {
    const id = SHARED;
    await commitBead(createTestIssue({ id, title: 'Base' }), 'base');

    await git('checkout', '-b', 'ours');
    await commitBead(
      createTestIssue({ id, title: 'Base', version: 2, status: 'in_progress' }),
      'ours edits',
    );

    // theirs: the bead EXISTS but its YAML is corrupt (e.g. conflict markers a
    // prior merge left committed). This is data corruption, not an absent file,
    // and must surface — never be silently skipped as "nothing to merge".
    await git('checkout', 'main');
    await git('checkout', '-b', 'theirs');
    await writeFile(
      join(repo, DATA_SYNC_DIR, 'issues', `${id}.md`),
      '---\ntype: is\n<<<<<<< HEAD\nversion: 1\n=======\nversion: 2\n>>>>>>> x\n---\n',
    );
    await git('add', '-A');
    await git('commit', '-m', 'theirs corrupt');

    await expect(mergeBeadAcrossRefs(repo, id, 'ours', 'theirs')).rejects.toThrow();
  });

  // End-to-end of the pull-path resolution as sync drives it: a real `git merge`
  // leaves conflict markers in the bead, then the structured resolution turns it
  // into a clean union with no markers. Reproduces issue #155.
  it('resolves a real git merge conflict on an epic into a clean union', async () => {
    const id = EPIC;
    await commitBead(
      createTestIssue({ id, title: 'Epic', kind: 'epic', child_order_hints: [COMMON] }),
      'base',
    );

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

    // A real git merge produces a textual conflict (markers written to disk).
    await git('checkout', 'ours');
    let conflicted = false;
    try {
      await git('merge', 'theirs');
    } catch {
      conflicted = true;
    }
    expect(conflicted).toBe(true);

    // Sync enumerates conflicted beads exactly this way.
    const { stdout: diff } = await git('diff', '--name-only', '--diff-filter=U');
    expect(diff).toContain(`${id}.md`);

    // Resolve with the mid-merge refs, write clean YAML, and complete the merge.
    const result = await mergeBeadAcrossRefs(repo, id, 'HEAD', 'MERGE_HEAD');
    expect(result).not.toBeNull();
    const beadPath = join(repo, DATA_SYNC_DIR, 'issues', `${id}.md`);
    await writeFile(beadPath, serializeIssue(result!.merged));
    await git('add', '-A');
    await git('commit', '--no-edit');

    const finalText = await readFile(beadPath, 'utf-8');
    expect(finalText).not.toContain('<<<<<<<');
    expect(finalText).not.toContain('>>>>>>>');
    expect(result!.merged.child_order_hints).toEqual([COMMON, CHILD_A, CHILD_B]);
    expect(result!.merged.version).toBe(3);
  });
  /**
   * Comment behavior through the path `tbd sync` actually runs.
   *
   * The provider-comment postcondition has unit coverage over `mergeIssues`, but the
   * merge users hit reads base/ours/theirs out of git refs, so the rules that matter
   * most — never move a pending comment to a different provider issue, never rewrite a
   * namespace that is not a comment log — were never exercised end to end. Both are
   * silent when they go wrong: one delivers a comment to the wrong tracker issue, the
   * other empties third-party data on an ordinary sync.
   */
  describe('provider comments across refs', () => {
    const PENDING = {
      local_id: '01aaaaaaaaaaaaaaaaaaaaaaaa',
      at: '2025-01-02T00:00:00.000Z',
      body: 'queued on the old link',
    };
    const DELIVERED = {
      id: 'provider-1',
      at: '2025-01-02T00:00:00.000Z',
      body: 'already on the new link',
    };

    it('never carries a pending comment onto a different provider issue', async () => {
      const id = SHARED;
      await commitBead(
        createTestIssue({ id, title: 'Linked', extensions: { linear: { id: 'issue-X' } } }),
        'base',
      );

      // ours: still on issue-X, with a comment queued but not yet pushed.
      await git('checkout', '-b', 'ours');
      await commitBead(
        createTestIssue({
          id,
          title: 'Linked',
          version: 2,
          updated_at: '2025-01-03T00:00:00Z',
          extensions: { linear: { id: 'issue-X', comments: [PENDING] } },
        }),
        'ours queues a comment',
      );

      // theirs: relinked to issue-Y, which has a comment of its own.
      await git('checkout', 'main');
      await git('checkout', '-b', 'theirs');
      await commitBead(
        createTestIssue({
          id,
          title: 'Linked',
          version: 2,
          updated_at: '2025-01-04T00:00:00Z',
          extensions: { linear: { id: 'issue-Y', comments: [DELIVERED] } },
        }),
        'theirs relinks',
      );

      const result = await mergeBeadAcrossRefs(repo, id, 'ours', 'theirs');
      expect(result).not.toBeNull();

      const linear = (
        result!.merged.extensions as Record<string, { id: string; comments: unknown[] }>
      ).linear!;
      // Whichever lineage wins, the two comment logs are never merged: a comment
      // queued against issue-X must not appear under issue-Y.
      if (linear.id === 'issue-Y') {
        expect(linear.comments).toEqual([DELIVERED]);
      } else {
        expect(linear.comments).toEqual([PENDING]);
      }
      // The discarded lineage is reported rather than dropped silently.
      expect(result!.conflicts.map((c) => c.field)).toContain('extensions.linear');
    });

    it('leaves a third-party comments array untouched across refs', async () => {
      const id = OTHER;
      await commitBead(
        createTestIssue({
          id,
          title: 'Third party data',
          extensions: { myapp: { comments: ['a', 'b'], note: 'base' } },
        }),
        'base',
      );

      await git('checkout', '-b', 'ours');
      await commitBead(
        createTestIssue({
          id,
          title: 'Third party data',
          version: 2,
          updated_at: '2025-01-03T00:00:00Z',
          extensions: { myapp: { comments: ['a', 'b'], note: 'local' } },
        }),
        'ours edits the note',
      );

      await git('checkout', 'main');
      await git('checkout', '-b', 'theirs');
      await commitBead(
        createTestIssue({
          id,
          title: 'Third party data',
          version: 2,
          updated_at: '2025-01-04T00:00:00Z',
          extensions: { myapp: { comments: ['a', 'b', 'c'], note: 'remote' } },
        }),
        'theirs appends and edits',
      );

      const result = await mergeBeadAcrossRefs(repo, id, 'ours', 'theirs');
      expect(result).not.toBeNull();

      const myapp = (result!.merged.extensions as Record<string, { comments: unknown[] }>).myapp!;
      // Exact, because the winner is deterministic: theirs is newer, mergeBeadAcrossRefs
      // passes ours as local, and namespace LWW is `nsLocalTime >= nsRemoteTime`. An
      // arrayContaining assertion here would also accept a re-sorted array or a dropped
      // entry, which is precisely the failure this test exists to catch.
      expect(myapp).toEqual({ comments: ['a', 'b', 'c'], note: 'remote' });
    });
  });
});
