import { describe, expect, it, vi } from 'vitest';

import { BoardState } from '../src/cli/web/board.js';
import type { BoardStateDependencies } from '../src/cli/web/board.js';
import { LocalObserver } from '../src/cli/web/local-observer.js';
import type { LocalObserverDependencies, ScheduledTask } from '../src/cli/web/local-observer.js';
import type { TbdDataContext } from '../src/cli/lib/data-context.js';
import type { IdMapping } from '../src/file/id-mapping.js';
import type { Issue } from '../src/lib/types.js';
import { createTestIssue, testId, TEST_ULIDS } from './test-helpers.js';

const internalId = testId(TEST_ULIDS.ULID_1);
const idMapping: IdMapping = {
  shortToUlid: new Map([['local', TEST_ULIDS.ULID_1]]),
  ulidToShort: new Map([[TEST_ULIDS.ULID_1, 'local']]),
};
const dataSyncDir = '/repo/.git/tbd/data-sync-worktree/.tbd/data-sync';
const context = {
  dataSyncDir,
  mapping: idMapping,
  prefix: 'web',
  config: { sync: { branch: 'tbd-sync', remote: 'origin' } },
  sharedPaths: {
    gitCommonDir: '/repo/.git',
    sharedWorktreePath: '/repo/.git/tbd/data-sync-worktree',
    sharedDataSyncDir: dataSyncDir,
  },
} as unknown as TbdDataContext;

function issue(version: number, title = 'Local state'): Issue {
  return createTestIssue({ id: internalId, title, version });
}

function boardHarness(): {
  board: BoardState;
  setIssues: (next: Issue[]) => void;
  setTip: (next: string) => void;
  setWorkspaces: (next: string[]) => void;
} {
  let issues = [issue(1)];
  let tip = 'a'.repeat(40);
  let workspaces: string[] = [];
  const dependencies: BoardStateDependencies = {
    loadContext: () => Promise.resolve(context),
    listIssues: () => Promise.resolve(issues),
    readRepoStatus: () =>
      Promise.resolve({
        tbdVersion: '0.4.2',
        gitBranch: 'feature',
        syncBranch: 'tbd-sync',
        remote: 'origin',
        displayPrefix: 'web',
        worktreePath: '/repo/.git/tbd/data-sync-worktree',
        worktreeHealthy: true,
        worktreeStatus: 'valid',
        workspaces,
      }),
    readLocalTip: () => Promise.resolve(tip),
    now: () => new Date('2026-08-11T12:00:00.000Z'),
  };
  return {
    board: new BoardState('/repo', dependencies),
    setIssues: (next) => {
      issues = next;
    },
    setTip: (next) => {
      tip = next;
    },
    setWorkspaces: (next) => {
      workspaces = next;
    },
  };
}

interface PendingTask {
  milliseconds: number;
  callback: () => void;
  cancelled: boolean;
}

function scheduler(): {
  schedule: LocalObserverDependencies['schedule'];
  runNext: (milliseconds: number) => Promise<void>;
  pending: () => PendingTask[];
} {
  const tasks: PendingTask[] = [];
  return {
    schedule: (milliseconds, callback): ScheduledTask => {
      const task = { milliseconds, callback, cancelled: false };
      tasks.push(task);
      return {
        cancel: () => {
          task.cancelled = true;
        },
      };
    },
    runNext: async (milliseconds) => {
      const task = tasks.find(
        (candidate) => !candidate.cancelled && candidate.milliseconds === milliseconds,
      );
      if (task === undefined) {
        throw new Error(`No ${milliseconds}ms task is pending`);
      }
      task.cancelled = true;
      task.callback();
      await vi.waitFor(() => {
        expect(tasks.filter((candidate) => !candidate.cancelled)).not.toContain(task);
      });
      await Promise.resolve();
      await Promise.resolve();
    },
    pending: () => tasks.filter((task) => !task.cancelled),
  };
}

function dependencies(options: {
  marker: () => Promise<string>;
  watchDirectory?: LocalObserverDependencies['watchDirectory'];
  schedule: LocalObserverDependencies['schedule'];
}): LocalObserverDependencies {
  return {
    readMarker: options.marker,
    watchDirectory:
      options.watchDirectory ??
      (() => ({
        close: vi.fn(),
      })),
    schedule: options.schedule,
    now: () => new Date('2026-08-11T12:00:01.000Z'),
  };
}

describe('LocalObserver', () => {
  it('uses native filesystem events to publish local field deltas without a remote dependency', async () => {
    const { board, setIssues } = boardHarness();
    await board.reload();
    const timers = scheduler();
    let marker = 'marker-1';
    let onChange: (() => void) | null = null;
    let onError: ((error: Error) => void) | null = null;
    const close = vi.fn();
    const observer = new LocalObserver(
      board,
      { localDebounceMs: 25, reconcileIntervalMs: 1_000 },
      dependencies({
        marker: () => Promise.resolve(marker),
        schedule: timers.schedule,
        watchDirectory: (directory, change, error) => {
          expect(directory).toBe(dataSyncDir);
          onChange = change;
          onError = error;
          return { close };
        },
      }),
    );

    await observer.start();
    expect(onChange).not.toBeNull();
    expect(onError).not.toBeNull();
    expect(observer.getState()).toMatchObject({
      observationPhase: 'watching',
      observationMode: 'native+reconcile',
      updateCount: 0,
      latestChanges: [],
    });

    setIssues([issue(2, 'Changed by tbd update')]);
    marker = 'marker-2';
    onChange!();
    onChange!();
    expect(timers.pending().filter((task) => task.milliseconds === 25)).toHaveLength(1);
    await timers.runNext(25);
    await vi.waitFor(() => {
      expect(observer.getState().updateCount).toBe(1);
    });

    expect(observer.getState()).toMatchObject({
      dataVersion: 1,
      changeDataVersion: 1,
      movedIds: ['web-local'],
      updateCount: 1,
      latestChanges: [
        {
          id: 'web-local',
          change: 'updated',
          fields: [{ field: 'title', before: 'Local state', after: 'Changed by tbd update' }],
        },
      ],
    });
    await observer.stop();
    expect(close).toHaveBeenCalledOnce();
    expect(observer.getState().observationPhase).toBe('stopped');
  });

  it('checks a constant-size marker every second and reloads only when it changes', async () => {
    const { board, setIssues, setTip } = boardHarness();
    await board.reload();
    const reload = vi.spyOn(board, 'reload');
    const timers = scheduler();
    let marker = 'marker-1';
    const readMarker = vi.fn(() => Promise.resolve(marker));
    const observer = new LocalObserver(
      board,
      { reconcileIntervalMs: 1_000 },
      dependencies({ marker: readMarker, schedule: timers.schedule }),
    );

    await observer.start();
    expect(reload).toHaveBeenCalledOnce(); // startup gap-closing reconciliation
    await timers.runNext(1_000);
    await vi.waitFor(() => {
      expect(readMarker).toHaveBeenCalledTimes(2);
    });
    expect(reload).toHaveBeenCalledOnce();

    setIssues([issue(2, 'Pulled by explicit tbd sync')]);
    setTip('b'.repeat(40));
    marker = 'marker-2';
    await timers.runNext(1_000);
    await vi.waitFor(() => {
      expect(observer.getState().updateCount).toBe(1);
    });
    expect(reload).toHaveBeenCalledTimes(2);
    expect(observer.getState()).toMatchObject({
      localTip: 'b'.repeat(40),
      movedIds: ['web-local'],
      updateCount: 1,
    });
    await observer.stop();
  });

  it('publishes metadata-only local changes without incrementing the graph update count', async () => {
    const { board, setWorkspaces } = boardHarness();
    await board.reload();
    const timers = scheduler();
    let marker = 'marker-1';
    const observer = new LocalObserver(
      board,
      { reconcileIntervalMs: 1_000 },
      dependencies({ marker: () => Promise.resolve(marker), schedule: timers.schedule }),
    );
    await observer.start();
    const states: ReturnType<LocalObserver['getState']>[] = [];
    const unsubscribe = observer.subscribe((state) => states.push(state));

    setWorkspaces(['agent-a']);
    marker = 'marker-2';
    await timers.runNext(1_000);
    await vi.waitFor(() => {
      expect(states.at(-1)?.repoStatus?.workspaces).toEqual(['agent-a']);
    });
    expect(observer.getState()).toMatchObject({ updateCount: 0, dataVersion: 0 });

    unsubscribe();
    await observer.stop();
  });

  it('falls back seamlessly to reconciliation when native watching is unavailable', async () => {
    const { board, setIssues } = boardHarness();
    await board.reload();
    const timers = scheduler();
    let marker = 'marker-1';
    const observer = new LocalObserver(
      board,
      { reconcileIntervalMs: 1_000 },
      dependencies({
        marker: () => Promise.resolve(marker),
        schedule: timers.schedule,
        watchDirectory: () => {
          throw new Error('recursive watch unsupported');
        },
      }),
    );

    await observer.start();
    expect(observer.getState()).toMatchObject({
      observationPhase: 'watching',
      observationMode: 'reconcile',
      observationError: expect.stringContaining('recursive watch unsupported'),
    });

    setIssues([issue(2, 'Reconciled local state')]);
    marker = 'marker-2';
    await timers.runNext(1_000);
    await vi.waitFor(() => {
      expect(observer.getState().updateCount).toBe(1);
    });
    expect(observer.getState().latestChanges[0]?.fields).toContainEqual(
      expect.objectContaining({ field: 'title', after: 'Reconciled local state' }),
    );
    await observer.stop();
  });

  it('keeps native events active when marker reads fail and recovers the fallback later', async () => {
    const { board, setIssues } = boardHarness();
    await board.reload();
    const timers = scheduler();
    let markerAvailable = false;
    let marker = 'marker-1';
    let onChange: (() => void) | null = null;
    const observer = new LocalObserver(
      board,
      { localDebounceMs: 25, reconcileIntervalMs: 1_000 },
      dependencies({
        marker: () =>
          markerAvailable ? Promise.resolve(marker) : Promise.reject(new Error('stat failed')),
        schedule: timers.schedule,
        watchDirectory: (_directory, change) => {
          onChange = change;
          return { close: vi.fn() };
        },
      }),
    );

    await observer.start();
    expect(observer.getState()).toMatchObject({
      observationPhase: 'watching',
      observationMode: 'native',
      observationError: expect.stringContaining('stat failed'),
    });

    setIssues([issue(2, 'Native path still works')]);
    onChange!();
    await timers.runNext(25);
    await vi.waitFor(() => {
      expect(observer.getState().updateCount).toBe(1);
    });

    markerAvailable = true;
    marker = 'marker-2';
    await timers.runNext(1_000);
    await vi.waitFor(() => {
      expect(observer.getState().observationMode).toBe('native+reconcile');
    });
    expect(observer.getState().observationError).toBeNull();
    await observer.stop();
  });

  it('reports an error only when both observation paths are unavailable, then self-recovers', async () => {
    const { board, setIssues } = boardHarness();
    await board.reload();
    const timers = scheduler();
    let markerAvailable = false;
    let marker = 'marker-1';
    const observer = new LocalObserver(
      board,
      { reconcileIntervalMs: 1_000 },
      dependencies({
        marker: () =>
          markerAvailable ? Promise.resolve(marker) : Promise.reject(new Error('stat failed')),
        schedule: timers.schedule,
        watchDirectory: () => {
          throw new Error('watch failed');
        },
      }),
    );

    await observer.start();
    expect(observer.getState()).toMatchObject({
      observationPhase: 'error',
      observationMode: 'unavailable',
      observationError: expect.stringContaining('watch failed'),
    });

    setIssues([issue(2, 'Recovered state')]);
    markerAvailable = true;
    marker = 'marker-2';
    await timers.runNext(1_000);
    await vi.waitFor(() => {
      expect(observer.getState().updateCount).toBe(1);
    });
    expect(observer.getState()).toMatchObject({
      observationPhase: 'watching',
      observationMode: 'reconcile',
      observationError: expect.stringContaining('watch failed'),
    });
    await observer.stop();
  });
});
