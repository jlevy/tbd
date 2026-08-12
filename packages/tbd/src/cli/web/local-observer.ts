/** Local filesystem observation for the long-running web view. */

import { randomUUID } from 'node:crypto';
import { watch as watchFilesystem } from 'node:fs';

import { noopLogger } from '../../lib/types.js';
import type { OperationLogger } from '../../lib/types.js';
import type {
  BoardState,
  EventLogEntry,
  ObservationMode,
  ObservationPhase,
  WebState,
} from './board.js';
import { readMetadataMarker } from './snapshot-consistency.js';

const DEFAULT_LOCAL_DEBOUNCE_MS = 250;
const DEFAULT_RECONCILE_INTERVAL_MS = 1_000;
const MAX_EVENT_LOG_ENTRIES = 200;

interface DirectoryWatcher {
  close(): void;
}

export interface ScheduledTask {
  cancel(): void;
}

export interface LocalObserverOptions {
  localDebounceMs?: number;
  reconcileIntervalMs?: number;
  logger?: OperationLogger;
}

export interface LocalObserverDependencies {
  watchDirectory: (
    directory: string,
    onChange: () => void,
    onError: (error: Error) => void,
  ) => DirectoryWatcher;
  readMarker: (paths: readonly string[]) => Promise<string>;
  schedule: (milliseconds: number, callback: () => void) => ScheduledTask;
  now: () => Date;
}

interface MutableObservationState {
  stateVersion: number;
  latestChanges: WebState['latestChanges'];
  latestChangeTotal: number;
  latestChangesTruncated: boolean;
  changeDataVersion: number;
  observationPhase: ObservationPhase;
  observationMode: ObservationMode;
  observationError: string | null;
  updateCount: number;
  log: EventLogEntry[];
}

type RefreshSource = 'startup' | 'native' | 'reconcile';

interface RefreshRequest {
  source: RefreshSource;
  observedMarker: string | null | undefined;
}

function defaultWatchDirectory(
  directory: string,
  onChange: () => void,
  onError: (error: Error) => void,
): DirectoryWatcher {
  const watcher = watchFilesystem(directory, { recursive: true }, onChange);
  watcher.on('error', onError);
  return watcher;
}

function defaultSchedule(milliseconds: number, callback: () => void): ScheduledTask {
  const timer = setTimeout(callback, milliseconds);
  timer.unref();
  return {
    cancel: () => {
      clearTimeout(timer);
    },
  };
}

const defaultDependencies: LocalObserverDependencies = {
  watchDirectory: defaultWatchDirectory,
  readMarker: readMetadataMarker,
  schedule: defaultSchedule,
  now: () => new Date(),
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Owns native local events, missed-event reconciliation, and additive view state. */
export class LocalObserver {
  private readonly listeners = new Set<(state: WebState) => void>();
  private readonly logger: OperationLogger;
  private readonly localDebounceMs: number;
  private readonly reconcileIntervalMs: number;
  private readonly state: MutableObservationState = {
    stateVersion: 0,
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
  private nativeWatcher: DirectoryWatcher | null = null;
  private nativeDebounceTask: ScheduledTask | null = null;
  private refreshRetryTask: ScheduledTask | null = null;
  private reconcileTask: ScheduledTask | null = null;
  private reconcileInFlight: Promise<void> | null = null;
  private refreshRunner: Promise<void> | null = null;
  private pendingRefresh: RefreshRequest | null = null;
  private lastMarker: string | null = null;
  private nativeActive = false;
  private markerAvailable = false;
  private nativeError: string | null = null;
  private markerError: string | null = null;
  private reloadError: string | null = null;
  private readonly observerId = randomUUID();
  private started = false;
  private stopped = false;
  private stopping: Promise<void> | null = null;

  constructor(
    private readonly board: BoardState,
    options: LocalObserverOptions = {},
    private readonly dependencies: LocalObserverDependencies = defaultDependencies,
  ) {
    this.logger = options.logger ?? noopLogger;
    this.localDebounceMs = options.localDebounceMs ?? DEFAULT_LOCAL_DEBOUNCE_MS;
    this.reconcileIntervalMs = options.reconcileIntervalMs ?? DEFAULT_RECONCILE_INTERVAL_MS;
  }

  async start(): Promise<void> {
    if (this.started || this.stopped) {
      return;
    }
    this.started = true;
    const initialMarker = await this.readMarker();
    if (this.stopped) {
      return;
    }
    if (initialMarker !== null) {
      this.lastMarker = initialMarker;
    }
    this.startNativeWatch();

    // The server loaded once before it knew which directory to watch. Reload after the
    // native watcher is installed so a write in that startup gap cannot be missed.
    await this.enqueueRefresh('startup', initialMarker);
    if (this.stopped) {
      return;
    }
    this.updateStatus();
    if (this.state.observationPhase === 'watching') {
      this.log('info', 'Watching local bead state; run tbd sync to exchange remote changes');
    }
    this.notify();
    this.scheduleReconciliation();
  }

  stop(): Promise<void> {
    if (this.stopping !== null) {
      return this.stopping;
    }
    this.stopped = true;
    this.nativeWatcher?.close();
    this.nativeWatcher = null;
    this.nativeActive = false;
    this.nativeDebounceTask?.cancel();
    this.nativeDebounceTask = null;
    this.refreshRetryTask?.cancel();
    this.refreshRetryTask = null;
    this.reconcileTask?.cancel();
    this.reconcileTask = null;
    this.stopping = (async () => {
      await this.reconcileInFlight;
      this.pendingRefresh = null;
      await this.refreshRunner;
      this.state.observationPhase = 'stopped';
      this.notify();
    })();
    return this.stopping;
  }

  getState(): WebState {
    const config = this.board.getWebConfig();
    return {
      observerId: this.observerId,
      stateVersion: this.state.stateVersion,
      repoDir: this.board.repoDir,
      syncBranch: config.syncBranch,
      remote: config.remote,
      ...this.board.getSnapshotState(),
      latestChanges: [...this.state.latestChanges],
      latestChangeTotal: this.state.latestChangeTotal,
      latestChangesTruncated: this.state.latestChangesTruncated,
      changeDataVersion: this.state.changeDataVersion,
      observationPhase: this.state.observationPhase,
      observationMode: this.state.observationMode,
      observationError: this.state.observationError,
      updateCount: this.state.updateCount,
      log: [...this.state.log],
    };
  }

  subscribe(listener: (state: WebState) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private startNativeWatch(): void {
    try {
      this.nativeWatcher = this.dependencies.watchDirectory(
        this.board.getObservationRoot(),
        () => {
          this.scheduleNativeRefresh();
        },
        (error) => {
          this.handleNativeFailure(error);
        },
      );
      this.nativeActive = true;
      this.nativeError = null;
    } catch (error) {
      this.handleNativeFailure(error);
    }
  }

  private handleNativeFailure(error: unknown): void {
    if (this.stopped) {
      return;
    }
    this.nativeWatcher?.close();
    this.nativeWatcher = null;
    this.nativeActive = false;
    const message = `Native file watch unavailable: ${errorMessage(error)}`;
    if (this.nativeError !== message) {
      this.nativeError = message;
      this.logger.warn(message);
      this.log('error', message);
    }
    if (this.updateStatus()) {
      this.notify();
    }
  }

  private scheduleNativeRefresh(): void {
    if (this.stopped) {
      return;
    }
    this.nativeDebounceTask?.cancel();
    this.nativeDebounceTask = this.dependencies.schedule(this.localDebounceMs, () => {
      this.nativeDebounceTask = null;
      void this.enqueueRefresh('native');
    });
  }

  private scheduleRefreshRetry(): void {
    if (this.stopped || this.refreshRetryTask !== null) {
      return;
    }
    this.refreshRetryTask = this.dependencies.schedule(this.reconcileIntervalMs, () => {
      this.refreshRetryTask = null;
      void this.enqueueRefresh('reconcile');
    });
  }

  private scheduleReconciliation(): void {
    if (this.stopped) {
      return;
    }
    this.reconcileTask = this.dependencies.schedule(this.reconcileIntervalMs, () => {
      this.reconcileTask = null;
      const work = this.reconcileOnce().finally(() => {
        if (this.reconcileInFlight === work) {
          this.reconcileInFlight = null;
        }
        this.scheduleReconciliation();
      });
      this.reconcileInFlight = work;
    });
  }

  private async reconcileOnce(): Promise<void> {
    const marker = await this.readMarker();
    if (this.stopped || marker === null) {
      return;
    }
    if (this.lastMarker === null || marker !== this.lastMarker) {
      await this.enqueueRefresh('reconcile', marker);
    }
  }

  private enqueueRefresh(source: RefreshSource, observedMarker?: string | null): Promise<void> {
    if (this.stopped) {
      return Promise.resolve();
    }
    this.pendingRefresh = this.coalesceRefresh(this.pendingRefresh, { source, observedMarker });
    // Deferring the drain one microtask guarantees the field is assigned before the
    // async loop can reach its finally block, including injected zero-latency tests.
    this.refreshRunner ??= Promise.resolve().then(() => this.drainRefreshes());
    return this.refreshRunner;
  }

  private async drainRefreshes(): Promise<void> {
    try {
      while (!this.stopped && this.pendingRefresh !== null) {
        const request = this.pendingRefresh;
        this.pendingRefresh = null;
        await this.refresh(request);
      }
    } finally {
      this.refreshRunner = null;
    }
  }

  private coalesceRefresh(current: RefreshRequest | null, next: RefreshRequest): RefreshRequest {
    const source =
      current?.source === 'startup' || next.source === 'startup'
        ? 'startup'
        : current?.source === 'native' || next.source === 'native'
          ? 'native'
          : 'reconcile';
    return { source, observedMarker: next.observedMarker };
  }

  private async refresh(request: RefreshRequest): Promise<void> {
    if (this.stopped) {
      return;
    }
    const marker = request.observedMarker ?? (await this.readMarker());
    if (this.stopped) {
      return;
    }
    const previousTip = this.board.getSnapshotState().localTip;
    try {
      const movement = await this.board.reload();
      if (this.stopped) {
        return;
      }
      if (movement.deferred) {
        // The shared writer never waits for the viewer. Retry locally after it releases
        // even if native events or the metadata fallback are temporarily unavailable.
        this.scheduleNativeRefresh();
        return;
      }
      this.refreshRetryTask?.cancel();
      this.refreshRetryTask = null;
      if (marker !== null) {
        this.lastMarker = marker;
      }
      const recovered = this.reloadError !== null;
      this.reloadError = null;
      const statusChanged = this.updateStatus();
      const tipChanged = previousTip !== this.board.getSnapshotState().localTip;
      if (movement.moved) {
        this.state.latestChanges = movement.changes;
        this.state.latestChangeTotal = movement.changeTotal;
        this.state.latestChangesTruncated = movement.changesTruncated;
        this.state.changeDataVersion = movement.dataVersion;
        this.state.updateCount += 1;
        const origin = request.source === 'reconcile' ? 'reconciled marker' : 'native file event';
        this.log(
          'update',
          `Local bead state changed (${movement.movedIds.length} bead${movement.movedIds.length === 1 ? '' : 's'}, ${origin})`,
        );
        this.notify();
      } else if (movement.stateChanged || tipChanged || recovered || statusChanged) {
        if (tipChanged) {
          this.log('info', 'Local sync-branch tip changed');
        }
        this.notify();
      }
    } catch (error) {
      if (this.stopped) {
        return;
      }
      const message = `Local refresh failed: ${errorMessage(error)}`;
      if (this.reloadError !== message) {
        this.reloadError = message;
        this.logger.warn(message);
        this.log('error', message);
      }
      // A transient failure may leave the metadata marker unchanged. Invalidate the
      // accepted marker and retry at the reconciliation cadence so recovery does not
      // depend on another filesystem event and persistent errors cannot busy-loop.
      this.lastMarker = null;
      this.scheduleRefreshRetry();
      this.updateStatus();
      this.notify();
    }
  }

  private async readMarker(): Promise<string | null> {
    try {
      const marker = await this.dependencies.readMarker(this.board.getObservationPaths());
      if (this.stopped) {
        return null;
      }
      const recovered = this.markerError !== null;
      this.markerAvailable = true;
      this.markerError = null;
      const statusChanged = this.updateStatus();
      if (recovered) {
        this.log('info', 'Local reconciliation recovered');
      }
      if ((recovered || statusChanged) && this.started && !this.stopped) {
        this.notify();
      }
      return marker;
    } catch (error) {
      if (this.stopped) {
        return null;
      }
      const message = `Local reconciliation unavailable: ${errorMessage(error)}`;
      const changed = this.markerError !== message || this.markerAvailable;
      this.markerAvailable = false;
      this.markerError = message;
      if (changed) {
        this.logger.warn(message);
        this.log('error', message);
      }
      const statusChanged = this.updateStatus();
      if ((changed || statusChanged) && this.started && !this.stopped) {
        this.notify();
      }
      return null;
    }
  }

  private updateStatus(): boolean {
    const previousMode = this.state.observationMode;
    const previousPhase = this.state.observationPhase;
    const previousError = this.state.observationError;
    const mode: ObservationMode = this.nativeActive
      ? this.markerAvailable
        ? 'native+reconcile'
        : 'native'
      : this.markerAvailable
        ? 'reconcile'
        : 'unavailable';
    const errors = [this.nativeError, this.markerError, this.reloadError].filter(
      (value): value is string => value !== null,
    );
    this.state.observationMode = mode;
    this.state.observationPhase = this.stopped
      ? 'stopped'
      : mode === 'unavailable' || this.reloadError !== null
        ? 'error'
        : 'watching';
    this.state.observationError = errors.length === 0 ? null : errors.join(' ');
    return (
      previousMode !== this.state.observationMode ||
      previousPhase !== this.state.observationPhase ||
      previousError !== this.state.observationError
    );
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
    this.state.stateVersion += 1;
    const state = this.getState();
    for (const listener of this.listeners) {
      try {
        listener(state);
      } catch {
        // One disconnected HTTP client must not stop local observation.
      }
    }
  }
}
