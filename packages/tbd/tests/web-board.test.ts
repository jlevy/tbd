import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  BoardState,
  MAX_BOARD_ROWS,
  MAX_LOCAL_CHANGE_DETAILS,
  MAX_LOCAL_CHANGE_DETAIL_BYTES,
} from '../src/cli/web/board.js';
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

function deferred<T>(): { promise: Promise<T>; resolve(value: T): void } {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
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
    gitCommonDir: '/repo/.git',
    sharedWorktreePath: '/repo/.git/tbd/data-sync-worktree',
    sharedDataSyncDir: '/repo/.git/tbd/data-sync-worktree/.tbd/data-sync',
    sharedLockPath: '/repo/.git/tbd/locks/data-sync.lock',
    sharedDataSyncEpochPath: '/repo/.git/tbd/data-sync.epoch',
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
    observerId: 'observer-1',
    stateVersion: 0,
    repoDir: '/repo',
    syncBranch: 'tbd-sync',
    remote: 'origin',
    ...board.getSnapshotState(),
    latestChanges: [],
    latestChangeTotal: 0,
    latestChangesTruncated: false,
    changeDataVersion: 0,
    observationPhase: 'starting',
    observationMode: 'unavailable',
    observationError: null,
    updateCount: 0,
    log: [],
  };
}

function harness(): {
  board: BoardState;
  setIssues: (next: Issue[]) => void;
  setWorkspaces: (next: string[]) => void;
} {
  let issues = fixtureIssues();
  let workspaces: string[] = [];
  const dependencies: BoardStateDependencies = {
    loadContext: () => Promise.resolve(context),
    listIssues: () => Promise.resolve(issues),
    readRepoStatus: () => Promise.resolve({ ...repoStatus, workspaces }),
    readLocalTip: () => Promise.resolve('a'.repeat(40)),
    now: () => new Date('2026-08-11T12:00:00.000Z'),
  };
  return {
    board: new BoardState('/repo', dependencies),
    setIssues: (next) => {
      issues = next;
    },
    setWorkspaces: (next) => {
      workspaces = next;
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
    expect(response.rows[1]?.updated_at).toBe('2025-01-01T00:00:00Z');
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
    expect(changed.changes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'web-kid1',
          change: 'updated',
          fields: expect.arrayContaining([
            expect.objectContaining({ field: 'title', before: 'Ship viewer', after: 'Ship it' }),
          ]),
        }),
        expect.objectContaining({ id: 'web-leaf', change: 'deleted' }),
      ]),
    );
    expect(board.getSnapshotState()).toMatchObject({
      dataVersion: 1,
      movedIds: ['web-kid1', 'web-leaf'],
      removedIds: ['web-leaf'],
      totalBeads: 2,
    });

    const noChange = await board.reload();
    expect(noChange.moved).toBe(false);
    expect(noChange.stateChanged).toBe(false);
    expect(board.getSnapshotState()).toMatchObject({
      dataVersion: 1,
      movedIds: ['web-kid1', 'web-leaf'],
      removedIds: ['web-leaf'],
    });
  });

  it('reports repository metadata movement without inventing bead movement', async () => {
    const { board, setWorkspaces } = harness();
    await board.reload();

    setWorkspaces(['agent-a']);
    const changed = await board.reload();

    expect(changed).toMatchObject({ moved: false, stateChanged: true, changeTotal: 0 });
    expect(board.getSnapshotState().repoStatus?.workspaces).toEqual(['agent-a']);
  });

  it('discards a candidate snapshot when a writer overlaps its asynchronous reads', async () => {
    let issues = fixtureIssues();
    let writerActive = false;
    let marker = 'marker-1';
    let blockedRead: ReturnType<typeof deferred<Issue[]>> | null = null;
    let readStarted: (() => void) | null = null;
    const dependencies: BoardStateDependencies = {
      loadContext: () => Promise.resolve(context),
      listIssues: () => {
        if (blockedRead === null) {
          return Promise.resolve(issues);
        }
        readStarted?.();
        return blockedRead.promise;
      },
      readRepoStatus: () => Promise.resolve(repoStatus),
      readLocalTip: () => Promise.resolve('a'.repeat(40)),
      readWriterActive: () => Promise.resolve(writerActive),
      readSnapshotMarker: () => Promise.resolve(marker),
      now: () => new Date('2026-08-11T12:00:00.000Z'),
    };
    const board = new BoardState('/repo', dependencies);
    await board.reload();
    expect(board.getSnapshotState().totalBeads).toBe(3);

    const partial = [fixtureIssues()[0]!];
    blockedRead = deferred<Issue[]>();
    const started = deferred<undefined>();
    readStarted = () => {
      started.resolve(undefined);
    };
    const overlapping = board.reload();
    await started.promise;
    writerActive = true;
    blockedRead.resolve(partial);

    await expect(overlapping).resolves.toMatchObject({ deferred: true, moved: false });
    expect(board.getSnapshotState()).toMatchObject({ totalBeads: 3, dataVersion: 0 });

    writerActive = false;
    marker = 'marker-2';
    issues = partial;
    blockedRead = null;
    const stable = await board.reload();
    expect(stable).toMatchObject({ deferred: false, moved: true });
    expect(board.getSnapshotState()).toMatchObject({ totalBeads: 1, dataVersion: 1 });
  });

  it('rejects a writer that starts and finishes during a read even when metadata is unchanged', async () => {
    let issues = fixtureIssues();
    let epoch = 'quiescent:epoch-1';
    let blockedRead: ReturnType<typeof deferred<Issue[]>> | null = null;
    let readStarted: (() => void) | null = null;
    const dependencies: BoardStateDependencies = {
      loadContext: () => Promise.resolve(context),
      listIssues: () => {
        if (blockedRead === null) {
          return Promise.resolve(issues);
        }
        readStarted?.();
        return blockedRead.promise;
      },
      readRepoStatus: () => Promise.resolve(repoStatus),
      readLocalTip: () => Promise.resolve('a'.repeat(40)),
      readWriterActive: () => Promise.resolve(false),
      readSnapshotEpoch: () => Promise.resolve(epoch),
      // Directory timestamps can collide or be restored; they are not the proof.
      readSnapshotMarker: () => Promise.resolve('unchanged-marker'),
      now: () => new Date('2026-08-11T12:00:00.000Z'),
    };
    const board = new BoardState('/repo', dependencies, context);
    await board.reload();

    const partial = [fixtureIssues()[0]!];
    blockedRead = deferred<Issue[]>();
    const started = deferred<undefined>();
    readStarted = () => {
      started.resolve(undefined);
    };
    const overlapping = board.reload();
    await started.promise;
    // Model a complete lock acquisition, multi-file mutation, and release between
    // the viewer's boundary checks. Only the persistent epoch records it now.
    epoch = 'quiescent:epoch-2';
    blockedRead.resolve(partial);

    await expect(overlapping).resolves.toMatchObject({ deferred: true, moved: false });
    expect(board.getSnapshotState()).toMatchObject({ totalBeads: 3, dataVersion: 0 });

    issues = partial;
    blockedRead = null;
    await expect(board.reload()).resolves.toMatchObject({ deferred: false, moved: true });
    expect(board.getSnapshotState()).toMatchObject({ totalBeads: 1, dataVersion: 1 });
  });

  it('retains the accepted snapshot while a crashed writer epoch remains active', async () => {
    let epoch: string | null = 'quiescent:epoch-1';
    const dependencies: BoardStateDependencies = {
      loadContext: () => Promise.resolve(context),
      listIssues: () => Promise.resolve(fixtureIssues()),
      readRepoStatus: () => Promise.resolve(repoStatus),
      readLocalTip: () => Promise.resolve('a'.repeat(40)),
      readWriterActive: () => Promise.resolve(false),
      readSnapshotEpoch: () => Promise.resolve(epoch),
      readSnapshotMarker: () => Promise.resolve('marker'),
      now: () => new Date('2026-08-11T12:00:00.000Z'),
    };
    const board = new BoardState('/repo', dependencies, context);
    await board.reload();

    epoch = null;
    await expect(board.reload()).resolves.toMatchObject({ deferred: true, moved: false });
    expect(board.getSnapshotState()).toMatchObject({ totalBeads: 3, dataVersion: 0 });
  });

  it('validates from before the context read when a writer starts and finishes inside it', async () => {
    let issues = fixtureIssues();
    let marker = 'marker-1';
    let blockedContext: ReturnType<typeof deferred<TbdDataContext>> | null = null;
    let contextReadStarted: (() => void) | null = null;
    const dependencies: BoardStateDependencies = {
      loadContext: () => {
        if (blockedContext === null) {
          return Promise.resolve(context);
        }
        contextReadStarted?.();
        return blockedContext.promise;
      },
      listIssues: () => Promise.resolve(issues),
      readRepoStatus: () => Promise.resolve(repoStatus),
      readLocalTip: () => Promise.resolve('a'.repeat(40)),
      readWriterActive: () => Promise.resolve(false),
      readSnapshotMarker: () => Promise.resolve(marker),
      now: () => new Date('2026-08-11T12:00:00.000Z'),
    };
    const board = new BoardState('/repo', dependencies, context);
    await board.reload();

    issues = [fixtureIssues()[0]!];
    blockedContext = deferred<TbdDataContext>();
    const started = deferred<undefined>();
    contextReadStarted = () => {
      started.resolve(undefined);
    };
    const overlapping = board.reload();
    await started.promise;
    marker = 'marker-2';
    blockedContext.resolve(context);

    await expect(overlapping).resolves.toMatchObject({ deferred: true, moved: false });
    expect(board.getSnapshotState()).toMatchObject({ totalBeads: 3, dataVersion: 0 });

    blockedContext = null;
    await expect(board.reload()).resolves.toMatchObject({ deferred: false, moved: true });
    expect(board.getSnapshotState()).toMatchObject({ totalBeads: 1, dataVersion: 1 });
  });

  it('defers a transient candidate read error caused by an overlapping writer', async () => {
    let writerActive = false;
    let failRead = false;
    const dependencies: BoardStateDependencies = {
      loadContext: () => Promise.resolve(context),
      listIssues: () => {
        if (failRead) {
          writerActive = true;
          return Promise.reject(new Error('issue disappeared during read'));
        }
        return Promise.resolve(fixtureIssues());
      },
      readRepoStatus: () => Promise.resolve(repoStatus),
      readLocalTip: () => Promise.resolve('a'.repeat(40)),
      readWriterActive: () => Promise.resolve(writerActive),
      readSnapshotMarker: () => Promise.resolve('marker'),
      now: () => new Date('2026-08-11T12:00:00.000Z'),
    };
    const board = new BoardState('/repo', dependencies, context);
    await board.reload();

    failRead = true;
    await expect(board.reload()).resolves.toMatchObject({ deferred: true, moved: false });
    expect(board.getSnapshotState()).toMatchObject({ totalBeads: 3, dataVersion: 0 });
  });

  it('discards a candidate when parsed context changes inside the marker window', async () => {
    const remapped = {
      ...context,
      prefix: 'next',
    } as TbdDataContext;
    let contextReads = 0;
    let stable = false;
    const dependencies: BoardStateDependencies = {
      loadContext: () => {
        contextReads += 1;
        return Promise.resolve(stable || contextReads > 1 ? remapped : context);
      },
      listIssues: () => Promise.resolve(fixtureIssues()),
      readRepoStatus: () => Promise.resolve({ ...repoStatus, displayPrefix: 'next' }),
      readLocalTip: () => Promise.resolve('a'.repeat(40)),
      readWriterActive: () => Promise.resolve(false),
      readSnapshotMarker: () => Promise.resolve('marker'),
      now: () => new Date('2026-08-11T12:00:00.000Z'),
    };
    const board = new BoardState('/repo', dependencies, context);

    await expect(board.reload()).resolves.toMatchObject({ deferred: true, moved: false });
    expect(board.getSnapshotState().totalBeads).toBe(0);

    stable = true;
    await expect(board.reload()).resolves.toMatchObject({ deferred: false, moved: false });
    expect(board.getSnapshotState().totalBeads).toBe(3);
    expect(board.getBead('next-root')).toMatchObject({ kind: 'ok' });
  });

  it('commits overlapping reload candidates strictly in invocation order', async () => {
    const initial = fixtureIssues();
    let issues = initial;
    let blockedRead: ReturnType<typeof deferred<Issue[]>> | null = null;
    let readStarted: (() => void) | null = null;
    const dependencies: BoardStateDependencies = {
      loadContext: () => Promise.resolve(context),
      listIssues: () => {
        if (blockedRead === null) {
          return Promise.resolve(issues);
        }
        readStarted?.();
        return blockedRead.promise;
      },
      readRepoStatus: () => Promise.resolve(repoStatus),
      readLocalTip: () => Promise.resolve('a'.repeat(40)),
      now: () => new Date('2026-08-11T12:00:00.000Z'),
    };
    const board = new BoardState('/repo', dependencies);
    await board.reload();

    const versionTwo = initial.map((entry) => ({ ...entry, version: 2, title: 'Version two' }));
    const versionThree = initial.map((entry) => ({ ...entry, version: 3, title: 'Version three' }));
    blockedRead = deferred<Issue[]>();
    const started = deferred<undefined>();
    readStarted = () => {
      started.resolve(undefined);
    };
    const first = board.reload();
    await started.promise;
    issues = versionThree;
    const second = board.reload();

    blockedRead.resolve(versionTwo);
    blockedRead = null;
    const [firstResult, secondResult] = await Promise.all([first, second]);

    expect(firstResult).toMatchObject({ deferred: false, moved: true, dataVersion: 1 });
    expect(secondResult).toMatchObject({ deferred: false, moved: true, dataVersion: 2 });
    expect(board.getBead('web-root')).toMatchObject({
      kind: 'ok',
      body: { title: 'Version three', version: 3 },
    });
  });

  it('caps local field detail independently of complete graph movement', async () => {
    const issueCount = MAX_LOCAL_CHANGE_DETAILS + 1;
    const initial = Array.from({ length: issueCount }, (_, index) => {
      const ulid = (index + 1).toString(36).padStart(26, '0');
      return createTestIssue({ id: testId(ulid), title: `Before ${index}`, notes: 'before' });
    });
    const shortToUlid = new Map(
      initial.map((entry, index) => [`d${index.toString(36)}`, entry.id.slice(3)]),
    );
    const largeContext = {
      ...context,
      mapping: {
        shortToUlid,
        ulidToShort: new Map([...shortToUlid].map(([short, ulid]) => [ulid, short])),
      },
    } as unknown as TbdDataContext;
    let issues = initial;
    const board = new BoardState('/repo', {
      loadContext: () => Promise.resolve(largeContext),
      listIssues: () => Promise.resolve(issues),
      readRepoStatus: () => Promise.resolve(repoStatus),
      readLocalTip: () => Promise.resolve('a'.repeat(40)),
      now: () => new Date('2026-08-11T12:00:00.000Z'),
    });
    await board.reload();

    issues = initial.map((entry, index) => ({
      ...entry,
      version: 2,
      title: `After ${index}`,
      notes: 'x'.repeat(10_000),
    }));
    const changed = await board.reload();

    expect(changed).toMatchObject({
      moved: true,
      stateChanged: true,
      changeTotal: issueCount,
      changesTruncated: true,
    });
    expect(changed.movedIds).toHaveLength(issueCount);
    expect(changed.changes.length).toBeLessThanOrEqual(MAX_LOCAL_CHANGE_DETAILS);
    expect(Buffer.byteLength(JSON.stringify(changed.changes))).toBeLessThanOrEqual(
      MAX_LOCAL_CHANGE_DETAIL_BYTES,
    );
    expect(JSON.stringify(changed.changes)).not.toContain('x'.repeat(10_000));
  });

  it('exposes a constant-size local observation surface including config and sync ref', async () => {
    const { board } = harness();
    await board.reload();

    expect(board.getObservationRoot()).toBe(context.dataSyncDir);
    expect(board.getObservationPaths()).toEqual([
      join('/repo', '.tbd', 'config.yml'),
      join('/repo', '.tbd', 'workspaces'),
      context.dataSyncDir,
      join(context.dataSyncDir, 'issues'),
      join(context.dataSyncDir, 'mappings'),
      '/repo/.git/tbd/data-sync.epoch',
      join('/repo/.git', 'refs', 'heads', 'tbd-sync'),
    ]);
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
