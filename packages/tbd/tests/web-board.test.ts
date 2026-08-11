import { describe, expect, it } from 'vitest';

import { BoardState, MAX_BOARD_ROWS } from '../src/cli/web/board.js';
import type { BoardStateDependencies, RepoStatus, WebState } from '../src/cli/web/board.js';
import type { TbdDataContext } from '../src/cli/lib/data-context.js';
import type { IdMapping } from '../src/file/id-mapping.js';
import type { Issue } from '../src/lib/types.js';
import { createTestIssue, testId, TEST_ULIDS } from './test-helpers.js';

function mappingFor(entries: Record<string, string>): IdMapping {
  const shortToUlid = new Map(Object.entries(entries));
  return {
    shortToUlid,
    ulidToShort: new Map([...shortToUlid].map(([short, ulid]) => [ulid, short])),
  };
}

const mapping = mappingFor({
  root: TEST_ULIDS.ULID_1,
  kid1: TEST_ULIDS.ULID_2,
  leaf: TEST_ULIDS.ULID_3,
});

const context = {
  dataSyncDir: '/repo/.git/tbd/data-sync-worktree/.tbd/data-sync',
  mapping,
  prefix: 'web',
  config: {
    sync: { branch: 'tbd-sync', remote: 'origin' },
  },
  sharedPaths: {
    sharedWorktreePath: '/repo/.git/tbd/data-sync-worktree',
  },
} as unknown as TbdDataContext;

const repoStatus: RepoStatus = {
  tbdVersion: '0.4.2',
  gitBranch: 'feature',
  syncBranch: 'tbd-sync',
  remote: 'origin',
  displayPrefix: 'web',
  worktreePath: '/repo/.git/tbd/data-sync-worktree',
  worktreeHealthy: true,
  worktreeStatus: 'valid',
  workspaces: [],
};

function fixtureIssues(): Issue[] {
  const root = createTestIssue({
    id: testId(TEST_ULIDS.ULID_1),
    title: 'Release parent',
    kind: 'epic',
    status: 'closed',
    labels: ['release'],
    description: 'large root body',
  });
  const child = createTestIssue({
    id: testId(TEST_ULIDS.ULID_2),
    title: 'Ship viewer',
    priority: 1,
    labels: ['viewer'],
    parent_id: root.id,
    description: 'body is fetched separately',
    notes: 'private-to-the-detail-response notes',
  });
  const leaf = createTestIssue({
    id: testId(TEST_ULIDS.ULID_3),
    title: 'Verify SSE',
    priority: 0,
    labels: ['viewer'],
    parent_id: child.id,
  });
  return [root, child, leaf];
}

function stateFor(board: BoardState): WebState {
  return {
    repoDir: '/repo',
    syncBranch: 'tbd-sync',
    remote: 'origin',
    intervalSeconds: 30,
    ...board.getSnapshotState(),
    lastReport: null,
    reportDataVersion: 0,
    changedIds: [],
    watchPhase: 'starting',
    watchSince: null,
    watchError: null,
    wakeCount: 0,
    log: [],
  };
}

function harness(): {
  board: BoardState;
  setIssues: (next: Issue[]) => void;
} {
  let issues = fixtureIssues();
  const dependencies: BoardStateDependencies = {
    loadContext: () => Promise.resolve(context),
    listIssues: () => Promise.resolve(issues),
    readRepoStatus: () => Promise.resolve(repoStatus),
    readLocalTip: () => Promise.resolve('a'.repeat(40)),
    now: () => new Date('2026-08-11T12:00:00.000Z'),
  };
  return {
    board: new BoardState('/repo', dependencies),
    setIssues: (next) => {
      issues = next;
    },
  };
}

describe('BoardState', () => {
  it('serves shared query semantics as light rows and retains tree ancestors as context', async () => {
    const { board } = harness();
    await board.reload();

    const response = board.buildBoardResponse(
      new URLSearchParams('label=viewer&pretty=1'),
      stateFor(board),
    );

    expect(response.rows.map((row) => row.id)).toEqual(['web-root', 'web-kid1', 'web-leaf']);
    expect(response.contextIds).toEqual(['web-root']);
    expect(response.command).toBe('tbd list --label viewer --pretty');
    expect(response.commandExact).toBe(false);
    expect(response.filtersExact).toBe(true);
    expect(response.closedHidden).toBe(0);
    expect(response.rows[1]).not.toHaveProperty('description');
    expect(response.rows[1]).not.toHaveProperty('notes');
    expect(response.rows[2]?.prefix).toBe('    └── ');
    expect(response.state.stats.total).toBe(3);
  });

  it('serves full bodies only for validated public ids', async () => {
    const { board } = harness();
    await board.reload();

    expect(board.getBead('web-kid1')).toMatchObject({
      kind: 'ok',
      body: {
        id: 'web-kid1',
        description: 'body is fetched separately',
        notes: 'private-to-the-detail-response notes',
        parent: 'web-root',
      },
    });
    expect(board.getBead('--help')).toEqual({ kind: 'invalid' });
    expect(board.getBead('web-nope')).toEqual({ kind: 'not-found' });
  });

  it('accepts canonical dots, underscores, and imported hyphens in public ids', async () => {
    const specialMapping = mappingFor({ 'bead.1-a': TEST_ULIDS.ULID_1 });
    const specialContext = {
      ...context,
      mapping: specialMapping,
      prefix: 'team_core',
    } as unknown as TbdDataContext;
    const dependencies: BoardStateDependencies = {
      loadContext: () => Promise.resolve(specialContext),
      listIssues: () => Promise.resolve([fixtureIssues()[0]!]),
      readRepoStatus: () => Promise.resolve({ ...repoStatus, displayPrefix: 'team_core' }),
      readLocalTip: () => Promise.resolve('a'.repeat(40)),
      now: () => new Date('2026-08-11T12:00:00.000Z'),
    };
    const board = new BoardState('/repo', dependencies);
    await board.reload();

    expect(board.getBead('team_core-bead.1-a')).toMatchObject({ kind: 'ok' });
    expect(board.getBead('--help')).toEqual({ kind: 'invalid' });
  });

  it('versions real snapshot movement and keeps the last movement sticky across no-op reloads', async () => {
    const { board, setIssues } = harness();
    const initial = fixtureIssues();
    const initialLoad = await board.reload();
    expect(initialLoad.moved).toBe(false);
    expect(board.getSnapshotState()).toMatchObject({
      dataVersion: 0,
      movedIds: [],
      removedIds: [],
      totalBeads: 3,
    });

    setIssues([{ ...initial[0]! }, { ...initial[1]!, version: 2, title: 'Ship it' }]);
    const changed = await board.reload();
    expect(changed.moved).toBe(true);
    expect(board.getSnapshotState()).toMatchObject({
      dataVersion: 1,
      movedIds: ['web-kid1', 'web-leaf'],
      removedIds: ['web-leaf'],
      totalBeads: 2,
    });

    const noChange = await board.reload();
    expect(noChange.moved).toBe(false);
    expect(board.getSnapshotState()).toMatchObject({
      dataVersion: 1,
      movedIds: ['web-kid1', 'web-leaf'],
      removedIds: ['web-leaf'],
    });
  });

  it('marks free-text narrowing as intentionally inexact', async () => {
    const { board } = harness();
    await board.reload();

    const response = board.buildBoardResponse(new URLSearchParams('q=SSE'), stateFor(board));
    expect(response.rows.map((row) => row.id)).toEqual(['web-leaf']);
    expect(response.command).toBe('tbd list');
    expect(response.commandExact).toBe(false);
    expect(response.search).toBe('SSE');
  });

  it('bounds pretty-tree context metadata to rows present in a capped response', async () => {
    const branchCount = Math.floor(MAX_BOARD_ROWS / 3) + 2;
    let issueIndex = 0;
    const nextId = (): string => {
      const suffix = (issueIndex++).toString(36).padStart(8, '0');
      return testId(`01webctx${suffix}0000000000`);
    };
    const issues: Issue[] = [];
    for (let branch = 0; branch < branchCount; branch += 1) {
      const root = createTestIssue({ id: nextId(), title: `Root ${branch}` });
      const parent = createTestIssue({
        id: nextId(),
        title: `Parent ${branch}`,
        parent_id: root.id,
      });
      const leaf = createTestIssue({
        id: nextId(),
        title: `Leaf ${branch}`,
        parent_id: parent.id,
        labels: ['selected'],
      });
      issues.push(root, parent, leaf);
    }
    const shortToUlid = new Map(
      issues.map((issue, index) => [`ctx${index.toString(36)}`, issue.id.slice(3)]),
    );
    const largeContext = {
      ...context,
      mapping: {
        shortToUlid,
        ulidToShort: new Map([...shortToUlid].map(([short, ulid]) => [ulid, short])),
      },
    } as unknown as TbdDataContext;
    const dependencies: BoardStateDependencies = {
      loadContext: () => Promise.resolve(largeContext),
      listIssues: () => Promise.resolve(issues),
      readRepoStatus: () => Promise.resolve(repoStatus),
      readLocalTip: () => Promise.resolve('a'.repeat(40)),
      now: () => new Date('2026-08-11T12:00:00.000Z'),
    };
    const board = new BoardState('/repo', dependencies);
    await board.reload();

    const response = board.buildBoardResponse(
      new URLSearchParams('all=1&label=selected&pretty=1'),
      stateFor(board),
    );

    expect(response.rows).toHaveLength(MAX_BOARD_ROWS);
    expect(response.truncated).toBe(issues.length);
    const responseIds = new Set(response.rows.map((row) => row.id));
    expect(response.contextIds.length).toBeGreaterThan(0);
    expect(response.contextIds.every((id) => responseIds.has(id))).toBe(true);
    expect(response.contextCount).toBe(response.contextIds.length);
  });
});
