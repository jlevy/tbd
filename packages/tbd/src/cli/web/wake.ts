/** Remote and local wake coordination for the long-running web view. */

import { watch as watchFilesystem } from 'node:fs';

import { watchForIssueChanges } from '../../file/bead-watch.js';
import type { IssueWatchOptions, IssueWatchResult } from '../../file/bead-watch.js';
import { runIssueSync } from '../../file/sync-run.js';
import type { IssueChangesReport } from '../../lib/issue-changes.js';
import { noopLogger } from '../../lib/types.js';
import type { OperationLogger } from '../../lib/types.js';
import type { BoardState, EventLogEntry, WebState, WatchPhase } from './board.js';

const DEFAULT_WATCH_TIMEOUT_MS = 15 * 60 * 1_000;
const DEFAULT_ERROR_BACKOFF_MS = 5_000;
const DEFAULT_LOCAL_DEBOUNCE_MS = 300;
const DEFAULT_LOCAL_SUPPRESSION_MS = DEFAULT_LOCAL_DEBOUNCE_MS * 4;
const MAX_EVENT_LOG_ENTRIES = 200;

interface DirectoryWatcher {
  close(): void;
}

export interface WakeCoordinatorOptions {
  intervalSeconds: number;
  watchTimeoutMs?: number;
  errorBackoffMs?: number;
  localDebounceMs?: number;
  localSuppressionMs?: number;
  logger?: OperationLogger;
}

export interface WakeCoordinatorDependencies {
  watchForIssueChanges: (options: IssueWatchOptions) => Promise<IssueWatchResult>;
  runIssueSync: typeof runIssueSync;
  watchDirectory: (directory: string, onChange: () => void) => DirectoryWatcher;
  sleep: (milliseconds: number, signal: AbortSignal) => Promise<void>;
  now: () => Date;
}

interface MutableWatchState {
  lastReport: IssueChangesReport | null;
  reportDataVersion: number;
  changedIds: string[];
  watchPhase: WatchPhase;
  watchSince: string | null;
  watchError: string | null;
  wakeCount: number;
  log: EventLogEntry[];
}

function defaultWatchDirectory(directory: string, onChange: () => void): DirectoryWatcher {
  return watchFilesystem(directory, { recursive: true }, onChange);
}

function abortableSleep(milliseconds: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) {
      resolve();
      return;
    }
    const timer = setTimeout(finish, milliseconds);
    timer.unref();
    const onAbort = (): void => {
      clearTimeout(timer);
      finish();
    };
    function finish(): void {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

const defaultDependencies: WakeCoordinatorDependencies = {
  watchForIssueChanges,
  runIssueSync,
  watchDirectory: defaultWatchDirectory,
  sleep: abortableSleep,
  now: () => new Date(),
};

function short(value: string | null): string {
  return value === null ? 'none' : value.slice(0, 8);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** A rewritten sync history is the one failure for which retrying the cursor cannot work. */
function baselineWasRewritten(error: unknown): boolean {
  const seen = new Set<unknown>();
  let current: unknown = error;
  while (current !== null && current !== undefined && !seen.has(current)) {
    seen.add(current);
    if (errorMessage(current).includes('not an ancestor')) {
      return true;
    }
    current =
      typeof current === 'object' && 'cause' in current
        ? (current as { cause?: unknown }).cause
        : undefined;
  }
  return false;
}

/** Owns cancellable remote polling, debounced local observation, and additive view state. */
export class WakeCoordinator {
  private readonly abortController = new AbortController();
  private readonly listeners = new Set<(state: WebState) => void>();
  private readonly logger: OperationLogger;
  private readonly watchTimeoutMs: number;
  private readonly errorBackoffMs: number;
  private readonly localDebounceMs: number;
  private readonly localSuppressionMs: number;
  private readonly state: MutableWatchState = {
    lastReport: null,
    reportDataVersion: 0,
    changedIds: [],
    watchPhase: 'starting',
    watchSince: null,
    watchError: null,
    wakeCount: 0,
    log: [],
  };
  private remoteTask: Promise<void> | null = null;
  private localWatcher: DirectoryWatcher | null = null;
  private localTimer: NodeJS.Timeout | null = null;
  private suppressLocalEvents = false;
  private suppressLocalUntil = 0;
  private started = false;

  constructor(
    private readonly board: BoardState,
    private readonly options: WakeCoordinatorOptions,
    private readonly dependencies: WakeCoordinatorDependencies = defaultDependencies,
  ) {
    this.logger = options.logger ?? noopLogger;
    this.watchTimeoutMs = options.watchTimeoutMs ?? DEFAULT_WATCH_TIMEOUT_MS;
    this.errorBackoffMs = options.errorBackoffMs ?? DEFAULT_ERROR_BACKOFF_MS;
    this.localDebounceMs = options.localDebounceMs ?? DEFAULT_LOCAL_DEBOUNCE_MS;
    this.localSuppressionMs = options.localSuppressionMs ?? DEFAULT_LOCAL_SUPPRESSION_MS;
  }

  async start(): Promise<void> {
    if (this.started) {
      return;
    }
    this.started = true;
    this.state.watchSince = this.board.getSnapshotState().localTip;
    this.startLocalWatch();
    this.remoteTask = this.runRemoteWatchLoop();
    // Let the loop publish its initial `watching` state before startup completes.
    await Promise.resolve();
  }

  async stop(): Promise<void> {
    if (this.state.watchPhase === 'stopped') {
      return;
    }
    this.state.watchPhase = 'stopped';
    this.abortController.abort();
    this.localWatcher?.close();
    this.localWatcher = null;
    if (this.localTimer !== null) {
      clearTimeout(this.localTimer);
      this.localTimer = null;
    }
    this.notify();
    await this.remoteTask;
    this.remoteTask = null;
  }

  getState(): WebState {
    const config = this.board.getWatchConfig();
    return {
      repoDir: this.board.repoDir,
      syncBranch: config.syncBranch,
      remote: config.remote,
      intervalSeconds: this.options.intervalSeconds,
      ...this.board.getSnapshotState(),
      lastReport: this.state.lastReport,
      reportDataVersion: this.state.reportDataVersion,
      changedIds: [...this.state.changedIds],
      watchPhase: this.state.watchPhase,
      watchSince: this.state.watchSince,
      watchError: this.state.watchError,
      wakeCount: this.state.wakeCount,
      log: [...this.state.log],
    };
  }

  subscribe(listener: (state: WebState) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private startLocalWatch(): void {
    try {
      this.localWatcher = this.dependencies.watchDirectory(this.board.getIssuesDirectory(), () => {
        if (this.localTimer !== null) {
          clearTimeout(this.localTimer);
        }
        this.localTimer = setTimeout(() => {
          this.localTimer = null;
          void this.onLocalChange();
        }, this.localDebounceMs);
        this.localTimer.unref();
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.log('error', `Local file watch unavailable: ${message}`);
      this.notify();
    }
  }

  private async onLocalChange(): Promise<void> {
    if (
      this.abortController.signal.aborted ||
      this.suppressLocalEvents ||
      this.dependencies.now().getTime() < this.suppressLocalUntil
    ) {
      return;
    }
    try {
      const movement = await this.board.reload();
      if (!movement.moved) {
        return;
      }
      this.state.changedIds = movement.movedIds;
      this.log('info', 'Local bead files changed (not yet on the sync remote)');
      this.notify();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.log('error', `Local refresh failed: ${message}`);
      this.notify();
    }
  }

  private async runRemoteWatchLoop(): Promise<void> {
    const config = this.board.getWatchConfig();
    while (!this.abortController.signal.aborted) {
      this.state.watchPhase = 'watching';
      this.state.watchError = null;
      this.notify();

      let result: IssueWatchResult;
      try {
        result = await this.dependencies.watchForIssueChanges({
          repoDir: this.board.repoDir,
          remote: config.remote,
          branch: config.syncBranch,
          prefix: config.prefix,
          selection: { kind: 'all' },
          since: this.state.watchSince,
          intervalMs: this.options.intervalSeconds * 1_000,
          timeoutMs: this.watchTimeoutMs,
          signal: this.abortController.signal,
        });
      } catch (error) {
        if (this.abortController.signal.aborted) {
          return;
        }
        await this.handleWatchFailure(error, baselineWasRewritten(error));
        continue;
      }

      if (result.kind === 'aborted' || this.abortController.signal.aborted) {
        return;
      }
      if (result.kind === 'timeout') {
        this.logger.debug(`Watch window elapsed; resuming from ${short(this.state.watchSince)}`);
        continue;
      }

      try {
        await this.applyReport(result.report);
      } catch (error) {
        if (this.abortController.signal.aborted) {
          return;
        }
        await this.handleWatchFailure(
          new Error(`Report handling failed: ${errorMessage(error)}`, { cause: error }),
          false,
        );
      }
    }
  }

  private async applyReport(report: IssueChangesReport): Promise<void> {
    this.state.watchPhase = 'applying';
    this.notify();
    this.suppressLocalEvents = true;
    let movement;
    try {
      const syncTarget = this.board.getSyncTarget();
      const syncResult = await this.dependencies.runIssueSync(
        syncTarget,
        {
          pull: true,
          signal: this.abortController.signal,
          networkTimeoutMs: Math.min(this.options.intervalSeconds * 1_000, 30_000),
        },
        this.logger,
      );
      switch (syncResult.kind) {
        case 'pulled':
        case 'up-to-date':
          break;
        case 'remote-missing':
          throw new Error(
            `Remote issue branch ${syncTarget.remote}/${syncTarget.syncBranch} disappeared before the wake could be applied`,
          );
        default: {
          const exhaustive: never = syncResult;
          throw new Error(`Unhandled issue sync result: ${String(exhaustive)}`);
        }
      }
      movement = await this.board.reload();
    } finally {
      this.suppressLocalEvents = false;
      this.suppressLocalUntil = this.dependencies.now().getTime() + this.localSuppressionMs;
    }

    this.state.lastReport = report;
    this.state.reportDataVersion = movement.dataVersion;
    this.state.changedIds = movement.moved ? movement.movedIds : [];
    this.state.watchSince = report.tip;
    this.state.wakeCount += 1;
    this.state.watchPhase = 'watching';
    this.state.watchError = null;
    const summary = report.changes
      .map((change) => `${change.id} ${change.change}`)
      .slice(0, 5)
      .join(', ');
    this.log(
      'wake',
      `Remote wake: ${report.changes.length} bead(s) changed in ${short(report.since)}..${short(
        report.tip,
      )}${summary === '' ? '' : ` (${summary})`}`,
    );
    this.notify();
  }

  private async handleWatchFailure(error: unknown, resetBaseline: boolean): Promise<void> {
    const message = errorMessage(error);
    this.state.watchPhase = 'error';
    this.state.watchError = message;
    this.log('error', message);
    if (resetBaseline && this.state.watchSince !== null) {
      this.log('info', 'Dropping the resume baseline and re-establishing from the remote tip');
      this.state.watchSince = null;
    }
    this.notify();
    await this.dependencies.sleep(this.errorBackoffMs, this.abortController.signal);
  }

  private log(level: EventLogEntry['level'], message: string): void {
    this.state.log.unshift({
      at: this.dependencies.now().toISOString(),
      level,
      message,
    });
    if (this.state.log.length > MAX_EVENT_LOG_ENTRIES) {
      this.state.log.length = MAX_EVENT_LOG_ENTRIES;
    }
  }

  private notify(): void {
    const state = this.getState();
    for (const listener of this.listeners) {
      try {
        listener(state);
      } catch {
        // One disconnected HTTP client must not stop either wake loop.
      }
    }
  }
}
