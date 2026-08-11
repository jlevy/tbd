import { describe, expect, it, vi } from 'vitest';

import { BoardState } from '../src/cli/web/board.js';
import type { BoardStateDependencies } from '../src/cli/web/board.js';
import { WakeCoordinator } from '../src/cli/web/wake.js';
import type { WakeCoordinatorDependencies } from '../src/cli/web/wake.js';
import type { TbdDataContext } from '../src/cli/lib/data-context.js';
import type { IdMapping } from '../src/file/id-mapping.js';
import type { IssueWatchOptions, IssueWatchResult } from '../src/file/bead-watch.js';
import type { IssueChangesReport } from '../src/lib/issue-changes.js';
import type { Issue } from '../src/lib/types.js';
import { createTestIssue, testId, TEST_ULIDS } from './test-helpers.js';

const internalId = testId(TEST_ULIDS.ULID_1);
const idMapping: IdMapping = {
  shortToUlid: new Map([['wake', TEST_ULIDS.ULID_1]]),
  ulidToShort: new Map([[TEST_ULIDS.ULID_1, 'wake']]),
};
const context = {
  dataSyncDir: '/repo/.git/tbd/data-sync-worktree/.tbd/data-sync',
  mapping: idMapping,
  prefix: 'web',
  config: { sync: { branch: 'tbd-sync', remote: 'origin' } },
  sharedPaths: { sharedWorktreePath: '/repo/.git/tbd/data-sync-worktree' },
} as unknown as TbdDataContext;

function issue(version: number, title = 'Wake me'): Issue {
  return createTestIssue({ id: internalId, title, version });
}

function boardHarness(): { board: BoardState; setIssues: (next: Issue[]) => void } {
  let issues = [issue(1)];
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
        workspaces: [],
      }),
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

function waitForAbort(options: IssueWatchOptions): Promise<IssueWatchResult> {
  return new Promise((resolve) => {
    if (options.signal?.aborted === true) {
      resolve({ kind: 'aborted' });
      return;
    }
    options.signal?.addEventListener(
      'abort',
      () => {
        resolve({ kind: 'aborted' });
      },
      { once: true },
    );
  });
}

async function eventually(assertion: () => void): Promise<void> {
  const deadline = Date.now() + 2_000;
  while (true) {
    try {
      assertion();
      return;
    } catch (error) {
      if (Date.now() >= deadline) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
  }
}

describe('WakeCoordinator', () => {
  it('watches in process, pulls before reload, and advances the report tip and data version', async () => {
    const { board, setIssues } = boardHarness();
    await board.reload();
    const report: IssueChangesReport = {
      since: 'a'.repeat(40),
      tip: 'b'.repeat(40),
      changes: [
        {
          id: 'web-wake',
          internal_id: internalId,
          title: 'Wake me now',
          change: 'updated',
          fields: [{ field: 'title', before: 'Wake me', after: 'Wake me now' }],
        },
      ],
    };
    let watchCalls = 0;
    const watchForIssueChanges = vi.fn((options: IssueWatchOptions) => {
      watchCalls += 1;
      return watchCalls === 1
        ? Promise.resolve<IssueWatchResult>({ kind: 'changed', report })
        : waitForAbort(options);
    });
    const runIssueSync = vi.fn(() => {
      setIssues([issue(2, 'Wake me now')]);
      return Promise.resolve({ kind: 'pulled' as const, commits: 1 });
    });
    const dependencies: WakeCoordinatorDependencies = {
      watchForIssueChanges,
      runIssueSync,
      watchDirectory: () => ({ close: vi.fn() }),
      sleep: () => Promise.resolve(),
      now: () => new Date('2026-08-11T12:00:01.000Z'),
    };
    const wake = new WakeCoordinator(
      board,
      { intervalSeconds: 10, localDebounceMs: 1, localSuppressionMs: 1 },
      dependencies,
    );

    await wake.start();
    await eventually(() => {
      expect(wake.getState().wakeCount).toBe(1);
    });

    expect(watchForIssueChanges).toHaveBeenCalledWith(
      expect.objectContaining({
        repoDir: '/repo',
        remote: 'origin',
        branch: 'tbd-sync',
        selection: { kind: 'all' },
        since: 'a'.repeat(40),
        intervalMs: 10_000,
      }),
    );
    expect(runIssueSync).toHaveBeenCalledWith(
      {
        worktreePath: '/repo/.git/tbd/data-sync-worktree',
        syncBranch: 'tbd-sync',
        remote: 'origin',
      },
      expect.objectContaining({
        pull: true,
        signal: expect.any(AbortSignal),
        networkTimeoutMs: 10_000,
      }),
      expect.anything(),
    );
    expect(wake.getState()).toMatchObject({
      watchSince: 'b'.repeat(40),
      watchPhase: 'watching',
      wakeCount: 1,
      dataVersion: 1,
      reportDataVersion: 1,
      changedIds: ['web-wake'],
    });
    await wake.stop();
    expect(wake.getState().watchPhase).toBe('stopped');
  });

  it('debounces local file changes and does not rebroadcast a sticky prior movement', async () => {
    const { board, setIssues } = boardHarness();
    await board.reload();
    let onChange: (() => void) | null = null;
    const dependencies: WakeCoordinatorDependencies = {
      watchForIssueChanges: waitForAbort,
      runIssueSync: () => Promise.resolve({ kind: 'up-to-date' }),
      watchDirectory: (_directory, callback) => {
        onChange = callback;
        return { close: vi.fn() };
      },
      sleep: () => Promise.resolve(),
      now: () => new Date(),
    };
    const wake = new WakeCoordinator(
      board,
      { intervalSeconds: 10, localDebounceMs: 1, localSuppressionMs: 1 },
      dependencies,
    );
    let notifications = 0;
    wake.subscribe(() => {
      notifications += 1;
    });
    await wake.start();
    const baselineNotifications = notifications;

    setIssues([issue(2, 'Local edit')]);
    expect(onChange).not.toBeNull();
    onChange!();
    onChange!();
    await eventually(() => {
      expect(wake.getState().dataVersion).toBe(1);
    });
    expect(wake.getState().changedIds).toEqual(['web-wake']);
    expect(notifications).toBe(baselineNotifications + 1);

    onChange!();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(wake.getState().dataVersion).toBe(1);
    expect(notifications).toBe(baselineNotifications + 1);
    await wake.stop();
  });

  it('retries the same remote report after a transient pull failure', async () => {
    const { board, setIssues } = boardHarness();
    await board.reload();
    const report: IssueChangesReport = {
      since: 'a'.repeat(40),
      tip: 'b'.repeat(40),
      changes: [
        {
          id: 'web-wake',
          internal_id: internalId,
          title: 'Retried wake',
          change: 'updated',
          fields: [{ field: 'title', before: 'Wake me', after: 'Retried wake' }],
        },
      ],
    };
    const observedBaselines: (string | null)[] = [];
    let watchCalls = 0;
    const watchForIssueChanges = vi.fn((options: IssueWatchOptions) => {
      observedBaselines.push(options.since);
      watchCalls += 1;
      return watchCalls <= 2
        ? Promise.resolve<IssueWatchResult>({ kind: 'changed', report })
        : waitForAbort(options);
    });
    let syncCalls = 0;
    const runIssueSync = vi.fn(() => {
      syncCalls += 1;
      if (syncCalls === 1) {
        return Promise.reject(new Error('temporary fetch failure'));
      }
      setIssues([issue(2, 'Retried wake')]);
      return Promise.resolve({ kind: 'pulled' as const, commits: 1 });
    });
    const wake = new WakeCoordinator(
      board,
      { intervalSeconds: 10 },
      {
        watchForIssueChanges,
        runIssueSync,
        watchDirectory: () => ({ close: vi.fn() }),
        sleep: () => Promise.resolve(),
        now: () => new Date('2026-08-11T12:00:01.000Z'),
      },
    );

    await wake.start();
    await eventually(() => {
      expect(wake.getState().wakeCount).toBe(1);
    });
    expect(observedBaselines.slice(0, 2)).toEqual(['a'.repeat(40), 'a'.repeat(40)]);
    expect(runIssueSync).toHaveBeenCalledTimes(2);
    expect(wake.getState()).toMatchObject({
      watchSince: 'b'.repeat(40),
      watchPhase: 'watching',
      changedIds: ['web-wake'],
    });
    expect(wake.getState().log.some((entry) => entry.message.includes('temporary fetch'))).toBe(
      true,
    );
    await wake.stop();
  });

  it('preserves the remote cursor when the reported branch disappears before pull', async () => {
    const { board } = boardHarness();
    await board.reload();
    const report: IssueChangesReport = {
      since: 'a'.repeat(40),
      tip: 'b'.repeat(40),
      changes: [
        {
          id: 'web-wake',
          internal_id: internalId,
          title: 'Unapplied wake',
          change: 'updated',
          fields: [{ field: 'title', before: 'Wake me', after: 'Unapplied wake' }],
        },
      ],
    };
    const observedBaselines: (string | null)[] = [];
    let watchCalls = 0;
    const watchForIssueChanges = vi.fn((options: IssueWatchOptions) => {
      observedBaselines.push(options.since);
      watchCalls += 1;
      return watchCalls === 1
        ? Promise.resolve<IssueWatchResult>({ kind: 'changed', report })
        : waitForAbort(options);
    });
    let releaseBackoff: (() => void) | undefined;
    const sleep = vi.fn(
      (_milliseconds: number, signal: AbortSignal): Promise<void> =>
        new Promise((resolve) => {
          const finish = (): void => {
            signal.removeEventListener('abort', finish);
            resolve();
          };
          releaseBackoff = finish;
          signal.addEventListener('abort', finish, { once: true });
        }),
    );
    const wake = new WakeCoordinator(
      board,
      { intervalSeconds: 10 },
      {
        watchForIssueChanges,
        runIssueSync: () => Promise.resolve({ kind: 'remote-missing' }),
        watchDirectory: () => ({ close: vi.fn() }),
        sleep,
        now: () => new Date('2026-08-11T12:00:01.000Z'),
      },
    );

    await wake.start();
    await eventually(() => {
      expect(wake.getState().watchPhase).toBe('error');
    });
    expect(wake.getState()).toMatchObject({
      watchSince: 'a'.repeat(40),
      lastReport: null,
      reportDataVersion: 0,
      changedIds: [],
      wakeCount: 0,
      dataVersion: 0,
    });
    expect(wake.getState().watchError).toContain(
      'Remote issue branch origin/tbd-sync disappeared before the wake could be applied',
    );
    expect(sleep).toHaveBeenCalledOnce();

    releaseBackoff?.();
    await eventually(() => {
      expect(observedBaselines).toHaveLength(2);
    });
    expect(observedBaselines).toEqual(['a'.repeat(40), 'a'.repeat(40)]);
    await wake.stop();
  });

  it('drops the cursor only when sync history proves it is no longer an ancestor', async () => {
    const { board } = boardHarness();
    await board.reload();
    const observedBaselines: (string | null)[] = [];
    let watchCalls = 0;
    const watchForIssueChanges = vi.fn((options: IssueWatchOptions) => {
      observedBaselines.push(options.since);
      watchCalls += 1;
      return watchCalls === 1
        ? Promise.reject(
            new Error(`Baseline ${'a'.repeat(40)} is not an ancestor of tip ${'b'.repeat(40)}`),
          )
        : waitForAbort(options);
    });
    const wake = new WakeCoordinator(
      board,
      { intervalSeconds: 10 },
      {
        watchForIssueChanges,
        runIssueSync: () => Promise.resolve({ kind: 'up-to-date' }),
        watchDirectory: () => ({ close: vi.fn() }),
        sleep: () => Promise.resolve(),
        now: () => new Date('2026-08-11T12:00:01.000Z'),
      },
    );

    await wake.start();
    await eventually(() => {
      expect(observedBaselines).toHaveLength(2);
    });
    expect(observedBaselines).toEqual(['a'.repeat(40), null]);
    expect(wake.getState().watchSince).toBeNull();
    await wake.stop();
  });

  it('cancels an in-flight report pull without logging a retry error during shutdown', async () => {
    const { board } = boardHarness();
    await board.reload();
    const report: IssueChangesReport = {
      since: 'a'.repeat(40),
      tip: 'b'.repeat(40),
      changes: [
        {
          id: 'web-wake',
          internal_id: internalId,
          title: 'Wake me',
          change: 'updated',
          fields: [],
        },
      ],
    };
    let watchCalls = 0;
    const runIssueSync = vi.fn(
      (_target: unknown, options: { signal?: AbortSignal }): Promise<{ kind: 'up-to-date' }> =>
        new Promise((_resolve, reject) => {
          options.signal?.addEventListener(
            'abort',
            () => {
              reject(new Error('pull cancelled'));
            },
            { once: true },
          );
        }),
    );
    const wake = new WakeCoordinator(
      board,
      { intervalSeconds: 10 },
      {
        watchForIssueChanges: (options) => {
          watchCalls += 1;
          return watchCalls === 1
            ? Promise.resolve({ kind: 'changed', report })
            : waitForAbort(options);
        },
        runIssueSync,
        watchDirectory: () => ({ close: vi.fn() }),
        sleep: () => Promise.resolve(),
        now: () => new Date('2026-08-11T12:00:01.000Z'),
      },
    );

    await wake.start();
    await eventually(() => {
      expect(runIssueSync).toHaveBeenCalledOnce();
    });
    await wake.stop();
    expect(wake.getState().watchPhase).toBe('stopped');
    expect(wake.getState().log.some((entry) => entry.message.includes('pull cancelled'))).toBe(
      false,
    );
  });
});
