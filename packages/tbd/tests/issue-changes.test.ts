/**
 * Contract tests for the read-only sync-branch change engine.
 *
 * Synthetic histories pin the Git-facing behavior; in-memory snapshots pin field,
 * filter, readiness, and deterministic-output semantics without subprocess noise.
 *
 * See: plan-2026-07-19-bead-watch-and-external-sync.md, Phase 1.
 */

import { execFile } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { promisify } from 'node:util';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { serializeIssue } from '../src/file/parser.js';
import { createChangesReportFromRefs, readGitObjects } from '../src/file/sync-branch-changes.js';
import {
  createIssueChangesReport,
  type IssueChangeSelection,
  type IssueSnapshot,
} from '../src/lib/issue-changes.js';
import type { Issue } from '../src/lib/types.js';
import { ISSUE_BODY_MAX_LENGTH } from '../src/lib/schemas.js';
import { stringifyYaml } from '../src/utils/yaml-utils.js';
import { createTestIssue, testId, TEST_ULIDS } from './test-helpers.js';

const execFileAsync = promisify(execFile);
const cleanupPaths: string[] = [];

const ISSUE_A = testId(TEST_ULIDS.ULID_1);
const ISSUE_B = testId(TEST_ULIDS.ULID_2);
const ISSUE_C = testId(TEST_ULIDS.ULID_3);

function issue(id: string, title: string, overrides: Partial<Issue> = {}): Issue {
  return createTestIssue({ id, title, ...overrides });
}

function snapshot(
  issues: Issue[],
  ids: Record<string, string> = { a1b2: TEST_ULIDS.ULID_1, b2c3: TEST_ULIDS.ULID_2 },
): IssueSnapshot {
  return {
    issues: new Map(issues.map((entry) => [entry.id, entry])),
    shortToUlid: new Map(Object.entries(ids)),
    ulidToShort: new Map(Object.entries(ids).map(([shortId, ulid]) => [ulid, shortId])),
  };
}

function report(
  before: IssueSnapshot,
  after: IssueSnapshot,
  selection: IssueChangeSelection = { kind: 'all' },
) {
  return createIssueChangesReport({
    since: '1'.repeat(40),
    tip: '2'.repeat(40),
    before,
    after,
    prefix: 'tbd',
    selection,
  });
}

function generatedSnapshotIssues(count: number): {
  ids: Record<string, string>;
  internalIds: string[];
} {
  const ids: Record<string, string> = {};
  const internalIds: string[] = [];
  for (let index = 1; index <= count; index += 1) {
    const ulid = index.toString(36).padStart(26, '0');
    const shortId = index.toString(36).padStart(4, '0');
    ids[shortId] = ulid;
    internalIds.push(testId(ulid));
  }
  return { ids, internalIds };
}

async function git(repoDir: string, ...args: string[]): Promise<string> {
  const { stdout } = await execFileAsync('git', args, { cwd: repoDir });
  return stdout.trim();
}

async function writeSnapshotFiles(
  repoDir: string,
  issues: Issue[],
  ids: Record<string, string>,
): Promise<void> {
  const dataDir = join(repoDir, '.tbd', 'data-sync');
  const issuesDir = join(dataDir, 'issues');
  const mappingDir = join(dataDir, 'mappings');
  await mkdir(issuesDir, { recursive: true });
  await mkdir(mappingDir, { recursive: true });
  await Promise.all(
    issues.map((entry) => writeFile(join(issuesDir, `${entry.id}.md`), serializeIssue(entry))),
  );
  await writeFile(join(mappingDir, 'ids.yml'), stringifyYaml(ids));
}

afterEach(async () => {
  await Promise.all(
    cleanupPaths.splice(0).map((path) =>
      rm(path, {
        recursive: true,
        force: true,
        maxRetries: 5,
        retryDelay: 100,
      }),
    ),
  );
});

describe('createIssueChangesReport', () => {
  it('reports scalar, array, and text deltas while ignoring sync metadata', () => {
    const before = issue(ISSUE_A, 'Coordinate agents', {
      status: 'open',
      labels: ['phase-1'],
      notes: 'old',
      version: 1,
      updated_at: '2025-01-01T00:00:00Z',
    });
    const after = issue(ISSUE_A, 'Coordinate agents', {
      status: 'closed',
      labels: ['phase-1', 'validated'],
      notes: 'old\nnew',
      version: 9,
      updated_at: '2025-02-01T00:00:00Z',
    });

    const result = report(snapshot([before]), snapshot([after]));

    expect(result.changes).toHaveLength(1);
    expect(result.changes[0]).toMatchObject({
      id: 'tbd-a1b2',
      internal_id: ISSUE_A,
      title: 'Coordinate agents',
      change: 'updated',
    });
    expect(result.changes[0]!.fields.map((field) => field.field)).toEqual([
      'status',
      'notes',
      'labels',
    ]);
    expect(result.changes[0]!.fields).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'version' }),
        expect.objectContaining({ field: 'updated_at' }),
      ]),
    );
    expect(result.changes[0]!.fields[1]).toEqual({
      field: 'notes',
      before: 'old',
      after: 'old\nnew',
      hunks: [
        {
          old_start: 1,
          old_count: 1,
          new_start: 1,
          new_count: 2,
          lines: [
            { type: 'context', text: 'old' },
            { type: 'add', text: 'new' },
          ],
        },
      ],
    });
  });

  it('returns no changes for metadata-only edits', () => {
    const before = issue(ISSUE_A, 'No semantic change');
    const after = { ...before, version: 12, updated_at: '2026-01-01T00:00:00Z' };

    expect(report(snapshot([before]), snapshot([after])).changes).toEqual([]);
  });

  it('reports created and deleted files without null-to-null field noise', () => {
    const deleted = issue(ISSUE_A, 'Deleted', { description: 'before' });
    const created = issue(ISSUE_B, 'Created', { assignee: null, description: undefined });

    const result = report(snapshot([deleted]), snapshot([created]));

    expect(result.changes.map((change) => [change.internal_id, change.change])).toEqual([
      [ISSUE_A, 'deleted'],
      [ISSUE_B, 'created'],
    ]);
    expect(result.changes[1]!.fields).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ before: null, after: null })]),
    );
    expect(result.changes[1]!.fields.map((field) => field.field)).not.toContain('assignee');
    expect(result.changes[1]!.fields.map((field) => field.field)).not.toContain('description');
  });

  it('bounds text hunk context and splits distant edits deterministically', () => {
    const oldLines = Array.from({ length: 20 }, (_, index) => `line ${index + 1}`);
    const newLines = [...oldLines];
    newLines[1] = 'line 2 changed';
    newLines[18] = 'line 19 changed';
    const before = issue(ISSUE_A, 'Text hunks', { notes: oldLines.join('\n') });
    const after = issue(ISSUE_A, 'Text hunks', { notes: newLines.join('\n') });

    const notes = report(snapshot([before]), snapshot([after])).changes[0]!.fields.find(
      (field) => field.field === 'notes',
    );

    expect(notes?.hunks).toEqual([
      {
        old_start: 1,
        old_count: 5,
        new_start: 1,
        new_count: 5,
        lines: [
          { type: 'context', text: 'line 1' },
          { type: 'remove', text: 'line 2' },
          { type: 'add', text: 'line 2 changed' },
          { type: 'context', text: 'line 3' },
          { type: 'context', text: 'line 4' },
          { type: 'context', text: 'line 5' },
        ],
      },
      {
        old_start: 16,
        old_count: 5,
        new_start: 16,
        new_count: 5,
        lines: [
          { type: 'context', text: 'line 16' },
          { type: 'context', text: 'line 17' },
          { type: 'context', text: 'line 18' },
          { type: 'remove', text: 'line 19' },
          { type: 'add', text: 'line 19 changed' },
          { type: 'context', text: 'line 20' },
        ],
      },
    ]);
  });

  it('limits an append to the final three context lines', () => {
    const oldLines = Array.from({ length: 500 }, (_, index) => `line ${index + 1}`);
    const before = issue(ISSUE_A, 'Long notes', { notes: oldLines.join('\n') });
    const after = issue(ISSUE_A, 'Long notes', { notes: [...oldLines, 'appended'].join('\n') });

    const notes = report(snapshot([before]), snapshot([after])).changes[0]!.fields.find(
      (field) => field.field === 'notes',
    );

    expect(notes?.hunks).toEqual([
      {
        old_start: 498,
        old_count: 3,
        new_start: 498,
        new_count: 4,
        lines: [
          { type: 'context', text: 'line 498' },
          { type: 'context', text: 'line 499' },
          { type: 'context', text: 'line 500' },
          { type: 'add', text: 'appended' },
        ],
      },
    ]);
  });

  it('omits pathological text hunks at the documented complexity limit', () => {
    const before = issue(ISSUE_A, 'Bounded text diff', {
      notes: Array.from({ length: 300 }, (_, index) => `before ${index}`).join('\n'),
    });
    const after = issue(ISSUE_A, 'Bounded text diff', {
      notes: Array.from({ length: 300 }, (_, index) => `after ${index}`).join('\n'),
    });

    const notes = report(snapshot([before]), snapshot([after])).changes[0]!.fields.find(
      (field) => field.field === 'notes',
    );

    expect(notes).toMatchObject({
      field: 'notes',
      hunks_omitted: 'complexity_limit',
    });
    expect(notes?.hunks).toBeUndefined();
  });

  it('bounds a pathological diff at the maximum valid issue-body size', () => {
    const beforeBody = 'a\n'.repeat(ISSUE_BODY_MAX_LENGTH / 2);
    const afterBody = 'b\n'.repeat(ISSUE_BODY_MAX_LENGTH / 2);
    const before = issue(ISSUE_A, 'Maximum body', { notes: beforeBody });
    const after = issue(ISSUE_A, 'Maximum body', { notes: afterBody });

    const startedAt = performance.now();
    const result = report(snapshot([before]), snapshot([after]));
    const elapsedMs = performance.now() - startedAt;
    const notes = result.changes[0]!.fields.find((field) => field.field === 'notes');

    expect(beforeBody).toHaveLength(ISSUE_BODY_MAX_LENGTH);
    expect(afterBody).toHaveLength(ISSUE_BODY_MAX_LENGTH);
    expect(notes?.hunks_omitted).toBe('complexity_limit');
    expect(notes?.hunks).toBeUndefined();
    expect(elapsedMs).toBeLessThan(2_000);
  });

  it('applies a static bead selector before diffing a large changed graph', () => {
    const count = 1_000;
    const { ids, internalIds } = generatedSnapshotIssues(count);
    const beforeBody = 'a\n'.repeat(ISSUE_BODY_MAX_LENGTH / 2);
    const afterBody = 'b\n'.repeat(ISSUE_BODY_MAX_LENGTH / 2);
    const before = internalIds.map((id, index) =>
      issue(id, `Issue ${index}`, { notes: index === 0 ? 'selected' : beforeBody }),
    );
    const after = internalIds.map((id, index) =>
      issue(id, index === 0 ? 'Selected changed' : `Issue ${index}`, {
        notes: index === 0 ? 'selected' : afterBody,
      }),
    );

    const startedAt = performance.now();
    const result = report(snapshot(before, ids), snapshot(after, ids), {
      kind: 'beads',
      ids: ['tbd-0001'],
    });
    const elapsedMs = performance.now() - startedAt;

    expect(result.changes).toHaveLength(1);
    expect(result.changes[0]!.internal_id).toBe(internalIds[0]);
    expect(result.changes[0]!.fields.map((field) => field.field)).toEqual(['title']);
    expect(elapsedMs).toBeLessThan(2_000);
  });

  it('reports a large all-issue graph within an explicit runtime ceiling', () => {
    const count = 2_000;
    const { ids, internalIds } = generatedSnapshotIssues(count);
    const before = internalIds.map((id, index) => issue(id, `Issue ${index}`));
    const after = internalIds.map((id, index) => issue(id, `Changed issue ${index}`));

    const startedAt = performance.now();
    const result = report(snapshot(before, ids), snapshot(after, ids));
    const elapsedMs = performance.now() - startedAt;

    expect(result.changes).toHaveLength(count);
    expect(elapsedMs).toBeLessThan(3_000);
  });

  it('wakes dynamic filters when a changed bead enters or leaves the selection', () => {
    const enteredBefore = issue(ISSUE_A, 'Entered', { labels: [] });
    const enteredAfter = issue(ISSUE_A, 'Entered', { labels: ['needs-agent'] });
    const leftBefore = issue(ISSUE_B, 'Left', { labels: ['needs-agent'] });
    const leftAfter = issue(ISSUE_B, 'Left', { labels: [] });
    const unrelatedBefore = issue(ISSUE_C, 'Other', { status: 'open' });
    const unrelatedAfter = issue(ISSUE_C, 'Other changed', { status: 'open' });
    const selection: IssueChangeSelection = {
      kind: 'filter',
      labels: ['needs-agent'],
      spec: null,
      status: null,
      ready: false,
    };

    const result = report(
      snapshot([enteredBefore, leftBefore, unrelatedBefore]),
      snapshot([enteredAfter, leftAfter, unrelatedAfter]),
      selection,
    );

    expect(result.changes.map((change) => change.internal_id)).toEqual([ISSUE_A, ISSUE_B]);
  });

  it('reuses gradual spec matching and status-filter semantics', () => {
    const before = issue(ISSUE_A, 'Filtered', {
      status: 'open',
      spec_path: 'docs/project/specs/active/plan-2026-07-19-bead-watch-and-external-sync.md',
    });
    const after = { ...before, status: 'blocked' as const };
    const selection: IssueChangeSelection = {
      kind: 'filter',
      labels: [],
      spec: 'plan-2026-07-19-bead-watch-and-external-sync.md',
      status: 'blocked',
      ready: false,
    };

    const result = report(snapshot([before]), snapshot([after]), selection);

    expect(result.changes.map((change) => change.internal_id)).toEqual([ISSUE_A]);
  });

  it('edge-triggers ready selection using each snapshot dependency graph', () => {
    const blockerBefore = issue(ISSUE_A, 'Blocker', {
      dependencies: [{ type: 'blocks', target: ISSUE_B }],
      status: 'open',
    });
    const blockerAfter = { ...blockerBefore, status: 'closed' as const };
    const blocked = issue(ISSUE_B, 'Becomes ready');
    const alreadyReadyBefore = issue(ISSUE_C, 'Already ready');
    const alreadyReadyAfter = { ...alreadyReadyBefore, title: 'Changed but still ready' };
    const selection: IssueChangeSelection = {
      kind: 'filter',
      labels: [],
      spec: null,
      status: null,
      ready: true,
    };

    const result = report(
      snapshot([blockerBefore, blocked, alreadyReadyBefore]),
      snapshot([blockerAfter, blocked, alreadyReadyAfter]),
      selection,
    );

    expect(result.changes.map((change) => change.internal_id)).toEqual([ISSUE_B]);
    expect(result.changes[0]!.fields).toEqual([]);
  });

  it('edge-triggers ready selection when the blocking bead is deleted', () => {
    const blocker = issue(ISSUE_A, 'Deleted blocker', {
      dependencies: [{ type: 'blocks', target: ISSUE_B }],
      status: 'open',
    });
    const blocked = issue(ISSUE_B, 'Becomes ready after deletion');
    const selection: IssueChangeSelection = {
      kind: 'filter',
      labels: [],
      spec: null,
      status: null,
      ready: true,
    };

    const result = report(snapshot([blocker, blocked]), snapshot([blocked]), selection);

    expect(result.changes.map((change) => change.internal_id)).toEqual([ISSUE_B]);
    expect(result.changes[0]!.fields).toEqual([]);
  });

  it('resolves explicit bead IDs against the union of snapshot mappings', () => {
    const created = issue(ISSUE_B, 'Created and selected');
    const before = snapshot([], { a1b2: TEST_ULIDS.ULID_1 });
    const after = snapshot([created], {
      a1b2: TEST_ULIDS.ULID_1,
      b2c3: TEST_ULIDS.ULID_2,
    });

    const result = report(before, after, { kind: 'beads', ids: ['tbd-b2c3'] });

    expect(result.changes.map((change) => change.internal_id)).toEqual([ISSUE_B]);
  });

  it('rejects unknown explicit internal IDs against the snapshot union', () => {
    const unchanged = issue(ISSUE_A, 'Known');

    expect(() =>
      report(snapshot([unchanged]), snapshot([unchanged]), {
        kind: 'beads',
        ids: [ISSUE_C],
      }),
    ).toThrow(/Unknown issue ID/);
  });

  it('sorts beads and fields deterministically', () => {
    const beforeA = issue(ISSUE_A, 'A', { priority: 2, status: 'open' });
    const afterA = issue(ISSUE_A, 'A', { priority: 1, status: 'closed' });
    const beforeB = issue(ISSUE_B, 'B', { title: 'B' });
    const afterB = issue(ISSUE_B, 'B changed');

    const result = report(snapshot([beforeB, beforeA]), snapshot([afterB, afterA]));

    expect(result.changes.map((change) => change.internal_id)).toEqual([ISSUE_A, ISSUE_B]);
    expect(result.changes[0]!.fields.map((field) => field.field)).toEqual(['status', 'priority']);
  });
});

describe('readGitObjects', () => {
  it('partitions object reads into bounded batches', async () => {
    const objectIds = Array.from({ length: 5 }, (_, index) => `${index}`.padStart(40, '0'));
    const readBatch = vi.fn((_repoDir: string, batch: readonly string[]) =>
      Promise.resolve(new Map(batch.map((objectId) => [objectId, `content:${objectId}`]))),
    );

    const contents = await readGitObjects('/unused', objectIds, {
      batchSize: 2,
      readBatch,
    });

    expect(readBatch.mock.calls.map(([, batch]) => batch)).toEqual([
      objectIds.slice(0, 2),
      objectIds.slice(2, 4),
      objectIds.slice(4),
    ]);
    expect(Array.from(contents.keys())).toEqual(objectIds);
  });
});

describe('createChangesReportFromRefs', () => {
  it('reads and diffs synthetic tbd-sync history without a worktree', async () => {
    const repoDir = await mkdtemp(join(tmpdir(), 'tbd-changes-history-'));
    cleanupPaths.push(repoDir);
    await git(repoDir, 'init', '-b', 'main');
    await git(repoDir, 'config', 'user.email', 'test@example.com');
    await git(repoDir, 'config', 'user.name', 'Test User');
    await git(repoDir, 'config', 'commit.gpgsign', 'false');
    await git(repoDir, 'checkout', '--orphan', 'tbd-sync');

    const before = issue(ISSUE_A, 'Synthetic', { notes: 'first' });
    await writeSnapshotFiles(repoDir, [before], { a1b2: TEST_ULIDS.ULID_1 });
    await git(repoDir, 'add', '.tbd/data-sync');
    await git(repoDir, 'commit', '-m', 'base');
    const since = await git(repoDir, 'rev-parse', 'HEAD');

    const after = { ...before, notes: 'first\nsecond', version: 2 };
    await writeSnapshotFiles(repoDir, [after], { a1b2: TEST_ULIDS.ULID_1 });
    await git(repoDir, 'add', '.tbd/data-sync');
    await git(repoDir, 'commit', '-m', `tip-${randomBytes(2).toString('hex')}`);
    const tip = await git(repoDir, 'rev-parse', 'HEAD');

    const batchReads = vi.fn(readGitObjects);
    const result = await createChangesReportFromRefs(
      {
        repoDir,
        sinceRef: since,
        tipRef: tip,
        prefix: 'tbd',
        selection: { kind: 'all' },
      },
      { readObjects: batchReads },
    );

    expect(result).toMatchObject({ since, tip });
    expect(result.changes[0]).toMatchObject({
      internal_id: ISSUE_A,
      fields: [expect.objectContaining({ field: 'notes', after: 'first\nsecond' })],
    });
    await expect(git(repoDir, 'worktree', 'list', '--porcelain')).resolves.not.toContain(
      'data-sync-worktree',
    );
    expect(batchReads).toHaveBeenCalledTimes(2);
    expect(batchReads.mock.calls.every(([, objectIds]) => objectIds.length === 2)).toBe(true);

    const identicalReads = vi.fn(readGitObjects);
    const identical = await createChangesReportFromRefs(
      {
        repoDir,
        sinceRef: tip,
        tipRef: tip,
        prefix: 'tbd',
        selection: { kind: 'beads', ids: ['tbd-a1b2'] },
      },
      { readObjects: identicalReads },
    );

    expect(identical.changes).toEqual([]);
    expect(identicalReads).toHaveBeenCalledTimes(1);
    await expect(
      createChangesReportFromRefs(
        {
          repoDir,
          sinceRef: tip,
          tipRef: tip,
          prefix: 'tbd',
          selection: { kind: 'beads', ids: ['tbd-typo'] },
        },
        { readObjects: vi.fn(readGitObjects) },
      ),
    ).rejects.toThrow('Unknown issue ID: tbd-typo');
  });

  it('fails loudly when a committed issue is invalid', async () => {
    const repoDir = await mkdtemp(join(tmpdir(), 'tbd-changes-invalid-'));
    cleanupPaths.push(repoDir);
    await git(repoDir, 'init', '-b', 'tbd-sync');
    await git(repoDir, 'config', 'user.email', 'test@example.com');
    await git(repoDir, 'config', 'user.name', 'Test User');
    await mkdir(join(repoDir, '.tbd', 'data-sync', 'issues'), { recursive: true });
    await writeFile(join(repoDir, '.tbd', 'data-sync', 'issues', `${ISSUE_A}.md`), 'invalid');
    await git(repoDir, 'add', '.tbd/data-sync');
    await git(repoDir, 'commit', '-m', 'invalid');
    const tip = await git(repoDir, 'rev-parse', 'HEAD');

    await expect(
      createChangesReportFromRefs({
        repoDir,
        sinceRef: tip,
        tipRef: tip,
        prefix: 'tbd',
        selection: { kind: 'all' },
      }),
    ).rejects.toThrow(/invalid.*is-.*\.md/i);
  });

  it('fails loudly when a committed issue has no public ID mapping', async () => {
    const repoDir = await mkdtemp(join(tmpdir(), 'tbd-changes-mapping-'));
    cleanupPaths.push(repoDir);
    await git(repoDir, 'init', '-b', 'tbd-sync');
    await git(repoDir, 'config', 'user.email', 'test@example.com');
    await git(repoDir, 'config', 'user.name', 'Test User');
    await writeSnapshotFiles(repoDir, [issue(ISSUE_A, 'Unmapped')], {});
    await git(repoDir, 'add', '.tbd/data-sync');
    await git(repoDir, 'commit', '-m', 'unmapped');
    const tip = await git(repoDir, 'rev-parse', 'HEAD');

    await expect(
      createChangesReportFromRefs({
        repoDir,
        sinceRef: tip,
        tipRef: tip,
        prefix: 'tbd',
        selection: { kind: 'all' },
      }),
    ).rejects.toThrow(/mapping.*is-/i);
  });

  it('fails loudly when the public ID mapping file is missing', async () => {
    const repoDir = await mkdtemp(join(tmpdir(), 'tbd-changes-no-mapping-file-'));
    cleanupPaths.push(repoDir);
    await git(repoDir, 'init', '-b', 'tbd-sync');
    await git(repoDir, 'config', 'user.email', 'test@example.com');
    await git(repoDir, 'config', 'user.name', 'Test User');
    const issuesDir = join(repoDir, '.tbd', 'data-sync', 'issues');
    await mkdir(issuesDir, { recursive: true });
    await writeFile(
      join(issuesDir, `${ISSUE_A}.md`),
      serializeIssue(issue(ISSUE_A, 'No mapping file')),
    );
    await git(repoDir, 'add', '.tbd/data-sync');
    await git(repoDir, 'commit', '-m', 'missing mapping file');
    const tip = await git(repoDir, 'rev-parse', 'HEAD');

    await expect(
      createChangesReportFromRefs({
        repoDir,
        sinceRef: tip,
        tipRef: tip,
        prefix: 'tbd',
        selection: { kind: 'all' },
      }),
    ).rejects.toThrow(/mapping file is missing/i);
  });

  it('rejects a baseline that is not an ancestor of the tip', async () => {
    const repoDir = await mkdtemp(join(tmpdir(), 'tbd-changes-non-ancestor-'));
    cleanupPaths.push(repoDir);
    await git(repoDir, 'init', '-b', 'left');
    await git(repoDir, 'config', 'user.email', 'test@example.com');
    await git(repoDir, 'config', 'user.name', 'Test User');
    await writeSnapshotFiles(repoDir, [issue(ISSUE_A, 'Left')], {
      a1b2: TEST_ULIDS.ULID_1,
    });
    await git(repoDir, 'add', '.tbd/data-sync');
    await git(repoDir, 'commit', '-m', 'left');
    const since = await git(repoDir, 'rev-parse', 'HEAD');

    await git(repoDir, 'checkout', '--orphan', 'right');
    await git(repoDir, 'rm', '-rf', '.');
    await writeSnapshotFiles(repoDir, [issue(ISSUE_B, 'Right')], {
      b2c3: TEST_ULIDS.ULID_2,
    });
    await git(repoDir, 'add', '.tbd/data-sync');
    await git(repoDir, 'commit', '-m', 'right');
    const tip = await git(repoDir, 'rev-parse', 'HEAD');

    await expect(
      createChangesReportFromRefs({
        repoDir,
        sinceRef: since,
        tipRef: tip,
        prefix: 'tbd',
        selection: { kind: 'all' },
      }),
    ).rejects.toThrow(/not an ancestor .* rerun without --since/is);
  });
});
