/** Pure browser-state orchestration. Owns no DOM and no global EventSource/fetch. */

export type IssueStatusView = 'open' | 'in_progress' | 'blocked' | 'deferred' | 'closed';
export type IssueKindView = 'bug' | 'feature' | 'task' | 'epic' | 'chore';
export type ObservationPhaseView = 'starting' | 'watching' | 'error' | 'stopped';
export type ObservationModeView = 'native+reconcile' | 'native' | 'reconcile' | 'unavailable';

export interface BoardControls {
  search: string;
  status: '' | 'any' | IssueStatusView;
  kind: '' | IssueKindView;
  priority: '' | '0' | '1' | '2' | '3' | '4';
  labels: string;
  spec: string;
  sort: 'priority' | 'created' | 'updated';
  ready: boolean;
  pretty: boolean;
}

export interface BoardRowView {
  id: string;
  internalId: string;
  parentId: string | null;
  title: string;
  status: IssueStatusView;
  kind: IssueKindView;
  priority: number;
  labels: string[];
  spec_path: string | null;
  assignee: string | null;
  ready: boolean;
  updated_at: string;
  prefix: string;
}

export type AgeTierView = 'sec' | 'min' | 'hr' | 'day' | 'wk' | 'old';

export interface RelativeAgeView {
  exact: string;
  label: string;
  tier: AgeTierView;
}

export interface FieldChangeView {
  field: string;
  before: unknown;
  after: unknown;
  hunks?: {
    lines: { type: 'context' | 'add' | 'remove'; text: string }[];
  }[];
}

export interface IssueChangeView {
  id: string;
  title: string;
  change: 'created' | 'updated' | 'deleted';
  fields: FieldChangeView[];
}

export interface IssueStatsView {
  total: number;
  active: number;
  closed: number;
  byStatus: Record<IssueStatusView, number>;
  byKindActive: Record<IssueKindView, number>;
  byKindClosed: Record<IssueKindView, number>;
  byPriorityActive: Record<string, number>;
  byPriorityClosed: Record<string, number>;
}

export interface RepoStatusView {
  tbdVersion: string;
  gitBranch: string | null;
  syncBranch: string;
  remote: string;
  displayPrefix: string;
  worktreePath: string | null;
  worktreeHealthy: boolean | null;
  worktreeStatus: string | null;
  workspaces: string[];
}

export interface ObservationStateView {
  observerId: string;
  stateVersion: number;
  repoDir: string;
  syncBranch: string;
  remote: string;
  localTip: string | null;
  totalBeads: number;
  stats: IssueStatsView | null;
  repoStatus: RepoStatusView | null;
  latestChanges: IssueChangeView[];
  latestChangeTotal: number;
  latestChangesTruncated: boolean;
  changeDataVersion: number;
  dataVersion: number;
  movedIds: string[];
  removedIds: string[];
  observationPhase: ObservationPhaseView;
  observationMode: ObservationModeView;
  observationError: string | null;
  updateCount: number;
  refreshedAt: string;
  log: { at: string; level: 'info' | 'update' | 'error'; message: string }[];
}

export interface BoardResponse {
  command: string;
  commandExact: boolean;
  filtersExact: boolean;
  contextCount: number;
  search: string;
  total: number;
  matched: number;
  closedHidden: number;
  rows: BoardRowView[];
  truncated: number;
  contextIds: string[];
  state: ObservationStateView;
}

export interface BeadBodyView {
  id: string;
  title?: string;
  description?: string | null;
  notes?: string | null;
  spec_path?: string | null;
  assignee?: string | null;
  parent?: string | null;
  dependencies?: { type: string; target: string }[];
  due_date?: string | null;
  deferred_until?: string | null;
  close_reason?: string | null;
  created_at?: string;
  updated_at?: string;
  version?: number;
  [key: string]: unknown;
}

export type BodyCacheEntry =
  | { kind: 'loaded'; body: BeadBodyView }
  | { kind: 'error'; error: string };

export interface Transport {
  fetchJson(url: string, signal?: AbortSignal): Promise<unknown>;
  openEvents(
    url: string,
    onState: (state: unknown) => void,
    lastEventId?: string,
  ): { close(): void };
}

export interface ClientStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface ClientView {
  board: BoardResponse | null;
  watch: ObservationStateView | null;
  controls: BoardControls;
  expanded: ReadonlySet<string>;
  bodies: ReadonlyMap<string, BodyCacheEntry>;
  inFlightBodies: ReadonlySet<string>;
  flashIds: ReadonlySet<string>;
  ghostRows: readonly BoardRowView[];
  boardError: string | null;
}

export interface ClientStore {
  start(): Promise<void>;
  stop(): void;
  refresh(): Promise<void>;
  getView(): ClientView;
  setControls(controls: BoardControls): Promise<void>;
  toggle(id: string): void;
  setExpanded(ids: Iterable<string>): void;
  clearGhostRows(): void;
  acknowledgeDataMotion(): void;
}

export interface ClientStoreOptions {
  storage?: ClientStorage;
  resumeStorageKey?: string;
  initialControls?: Partial<BoardControls>;
}

const DEFAULT_CONTROLS: BoardControls = {
  search: '',
  status: '',
  kind: '',
  priority: '',
  labels: '',
  spec: '',
  sort: 'priority',
  ready: false,
  pretty: true,
};
const DEFAULT_RESUME_KEY = 'tbd.web.lastEventId';
export const MAX_BODY_REQUEST_CONCURRENCY = 8;
/** Bounds each table paint while still keeping every served row reachable. */
export const BOARD_PAGE_SIZE = 5_000;
/** Bounds detail DOM, requests, and retained long-form content. */
export const MAX_EXPANDED_ROWS = 100;
/** Keeps recently collapsed details warm without retaining a whole large project. */
export const MAX_BODY_CACHE_ENTRIES = 200;
/** Data-motion context is useful, but a mass deletion must not bypass DOM paging. */
export const MAX_GHOST_ROWS = 100;

export interface BoardPageView {
  rows: readonly BoardRowView[];
  /** Zero-based page index after invalid and out-of-range input is clamped. */
  pageIndex: number;
  pageCount: number;
  /** Zero-based inclusive offset into the complete response. */
  start: number;
  /** Zero-based exclusive offset into the complete response. */
  end: number;
  total: number;
}

const MINUTE_MS = 60 * 1_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const WEEK_MS = 7 * DAY_MS;
const MONTH_MS = 30 * DAY_MS;
const YEAR_MS = 365 * DAY_MS;

/**
 * Format one ISO timestamp using tbd's compact "ago" vocabulary and MetaBrowser's
 * deterministic minute/hour/day/week/month/year boundaries.
 */
export function formatRelativeAge(timestamp: string, nowMs = Date.now()): RelativeAgeView | null {
  const date = new Date(timestamp);
  const timestampMs = date.getTime();
  if (!Number.isFinite(timestampMs)) {
    return null;
  }

  const ageMs = Math.max(0, nowMs - timestampMs);
  let tier: AgeTierView;
  if (ageMs < MINUTE_MS) {
    tier = 'sec';
  } else if (ageMs < HOUR_MS) {
    tier = 'min';
  } else if (ageMs < DAY_MS) {
    tier = 'hr';
  } else if (ageMs < WEEK_MS) {
    tier = 'day';
  } else if (ageMs < MONTH_MS) {
    tier = 'wk';
  } else {
    tier = 'old';
  }

  const steps: readonly [suffix: string, milliseconds: number][] = [
    ['y', YEAR_MS],
    ['mo', MONTH_MS],
    ['w', WEEK_MS],
    ['d', DAY_MS],
    ['h', HOUR_MS],
    ['m', MINUTE_MS],
  ];
  let label = 'just now';
  for (const [suffix, milliseconds] of steps) {
    if (ageMs >= milliseconds) {
      // Floor keeps the label inside the same threshold bucket as its color tier:
      // 59m stays 59m until the formatter switches both label and tier to 1h.
      label = `${Math.floor(ageMs / milliseconds)}${suffix} ago`;
      break;
    }
  }
  return { exact: date.toISOString(), label, tier };
}

/** Select one bounded browser-render window from a complete board response. */
export function paginateBoardRows(
  rows: readonly BoardRowView[],
  requestedPageIndex: number,
): BoardPageView {
  const total = rows.length;
  const pageCount = Math.ceil(total / BOARD_PAGE_SIZE);
  const validPageIndex =
    Number.isSafeInteger(requestedPageIndex) && requestedPageIndex >= 0 ? requestedPageIndex : 0;
  const pageIndex = Math.min(validPageIndex, Math.max(0, pageCount - 1));
  const start = pageIndex * BOARD_PAGE_SIZE;
  const end = Math.min(start + BOARD_PAGE_SIZE, total);
  return { rows: rows.slice(start, end), pageIndex, pageCount, start, end, total };
}

/**
 * Return character columns whose ancestor tree bars continue through a wrapped title.
 *
 * Pretty prefixes are made from four-character ancestor segments followed by one
 * four-character terminal connector. The terminal `├── ` or `└── ` belongs only to
 * the current bead; only ancestor `│   ` segments continue below the first line.
 */
export function treeContinuationColumns(prefix: string): number[] {
  const terminalConnectorWidth = 4;
  const ancestorEnd = Math.max(0, prefix.length - terminalConnectorWidth);
  const columns: number[] = [];
  for (let index = 0; index < ancestorEnd; index += 1) {
    if (prefix[index] === '│') {
      columns.push(index);
    }
  }
  return columns;
}

interface BodyRequest {
  id: string;
  token: number;
  generation: number;
  controller: AbortController;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function asObservationState(value: unknown): ObservationStateView {
  if (
    !isRecord(value) ||
    typeof value.observerId !== 'string' ||
    typeof value.stateVersion !== 'number' ||
    typeof value.dataVersion !== 'number' ||
    !Array.isArray(value.movedIds) ||
    !Array.isArray(value.removedIds) ||
    typeof value.observationPhase !== 'string'
  ) {
    throw new Error('Server returned an invalid local-observer state');
  }
  return value as unknown as ObservationStateView;
}

function asBoardResponse(value: unknown): BoardResponse {
  if (!isRecord(value) || !Array.isArray(value.rows) || !('state' in value)) {
    throw new Error('Server returned an invalid board response');
  }
  asObservationState(value.state);
  return value as unknown as BoardResponse;
}

function asBeadBody(value: unknown): BeadBodyView {
  if (!isRecord(value) || typeof value.id !== 'string') {
    throw new Error('Server returned an invalid bead body');
  }
  return value as BeadBodyView;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Query parameter order is stable so deduplication and tests see one canonical URL. */
export function buildQueryString(controls: BoardControls): string {
  const params = new URLSearchParams();
  if (controls.search.trim() !== '') {
    params.set('q', controls.search.trim());
  }
  if (controls.status !== '' && controls.status !== 'any') {
    params.set('status', controls.status);
  }
  if (controls.kind !== '') {
    params.set('type', controls.kind);
  }
  if (controls.priority !== '') {
    params.set('priority', controls.priority);
  }
  if (controls.spec.trim() !== '') {
    params.set('spec', controls.spec.trim());
  }
  for (const label of controls.labels.split(/[,\s]+/u).filter(Boolean)) {
    params.append('label', label);
  }
  if (controls.sort !== 'priority') {
    params.set('sort', controls.sort);
  }
  if (controls.status === 'any') {
    params.set('all', '1');
  }
  if (controls.ready) {
    params.set('ready', '1');
  }
  if (controls.pretty) {
    params.set('pretty', '1');
  }
  return params.toString();
}

export function caveatsFor(board: BoardResponse): string[] {
  const caveats: string[] = [];
  if (!board.filtersExact) {
    caveats.push('filters with no exact CLI equivalent apply');
  }
  if (board.search !== '') {
    caveats.push(`text search "${board.search}" applies`);
  }
  if (board.contextCount > 0) {
    caveats.push(
      `${board.contextCount} dimmed ancestor row${board.contextCount === 1 ? '' : 's'} ${
        board.contextCount === 1 ? 'is' : 'are'
      } shown for context`,
    );
  }
  if (board.truncated > 0) {
    caveats.push(`only the first ${board.rows.length} of ${board.truncated} rows are shown`);
  }
  return caveats;
}

export function deltasValid(watch: ObservationStateView): boolean {
  return watch.latestChanges.length > 0 && watch.changeDataVersion === watch.dataVersion;
}

export function phaseLabel(watch: ObservationStateView): { label: string; help: string } {
  const updates = `${watch.updateCount} local graph update${watch.updateCount === 1 ? '' : 's'} observed since this viewer started.`;
  switch (watch.observationPhase) {
    case 'starting':
      return { label: 'starting', help: `Starting the local bead observer. ${updates}` };
    case 'watching':
      return {
        label: 'watching',
        help: `${
          watch.observationMode === 'native+reconcile'
            ? 'Watching the local data-sync worktree with native events and one-second reconciliation. Run tbd sync to exchange remote changes.'
            : watch.observationMode === 'native'
              ? `Watching the local data-sync worktree with native events. ${watch.observationError ?? ''}`.trim()
              : `Watching local metadata once per second. ${watch.observationError ?? ''}`.trim()
        } ${updates}`,
      };
    case 'error':
      return {
        label: 'error',
        help: `${watch.observationError ?? 'Local observation failed; reconciliation will retry.'} ${updates}`,
      };
    case 'stopped':
      return { label: 'stopped', help: `The viewer is shutting down. ${updates}` };
  }
}

class Store implements ClientStore {
  private board: BoardResponse | null = null;
  private watch: ObservationStateView | null = null;
  private controls: BoardControls;
  private readonly expanded = new Set<string>();
  private readonly bodies = new Map<string, BodyCacheEntry>();
  private readonly bodyRequests = new Map<string, BodyRequest>();
  private bodyQueue: BodyRequest[] = [];
  private readonly flashIds = new Set<string>();
  private ghostRows: BoardRowView[] = [];
  private boardError: string | null = null;
  private eventHandle: { close(): void } | null = null;
  private refreshRequested = false;
  private refreshRunner: Promise<void> | null = null;
  private boardRequestController: AbortController | null = null;
  private bodyGeneration = 0;
  private bodyToken = 0;
  private activeBodyFetches = 0;
  private reconcileExpandedAfterRefresh = false;
  private started = false;
  private stopped = false;
  private readonly storage: ClientStorage | undefined;
  private readonly resumeStorageKey: string;

  constructor(
    private readonly transport: Transport,
    private readonly onRender: () => void,
    options: ClientStoreOptions,
  ) {
    this.controls = { ...DEFAULT_CONTROLS, ...options.initialControls };
    this.storage = options.storage;
    this.resumeStorageKey = options.resumeStorageKey ?? DEFAULT_RESUME_KEY;
  }

  async start(): Promise<void> {
    if (this.started) {
      await this.refresh();
      return;
    }
    this.started = true;
    let lastEventId: string | undefined;
    try {
      lastEventId = this.storage?.getItem(this.resumeStorageKey) ?? undefined;
    } catch {
      // Storage is optional; a blocked private-mode store cannot block the board.
    }
    try {
      this.eventHandle = this.transport.openEvents(
        '/api/events',
        (next) => {
          this.receiveState(next);
        },
        lastEventId,
      );
    } catch (error) {
      this.boardError = `Live updates unavailable: ${errorMessage(error)}`;
      this.emit();
    }
    await this.refresh();
  }

  stop(): void {
    this.stopped = true;
    this.boardRequestController?.abort();
    this.boardRequestController = null;
    this.abortBodyRequests();
    this.eventHandle?.close();
    this.eventHandle = null;
  }

  refresh(): Promise<void> {
    if (this.stopped) {
      return Promise.resolve();
    }
    this.refreshRequested = true;
    if (this.refreshRunner === null) {
      const runner = this.runRefreshLoop().finally(() => {
        if (this.refreshRunner === runner) {
          this.refreshRunner = null;
        }
        if (this.refreshRequested && !this.stopped) {
          void this.refresh();
        }
      });
      this.refreshRunner = runner;
    }
    return this.refreshRunner;
  }

  getView(): ClientView {
    return {
      board: this.board,
      watch: this.watch,
      controls: this.controls,
      expanded: this.expanded,
      bodies: this.bodies,
      inFlightBodies: new Set(this.bodyRequests.keys()),
      flashIds: this.flashIds,
      ghostRows: this.ghostRows,
      boardError: this.boardError,
    };
  }

  async setControls(controls: BoardControls): Promise<void> {
    this.controls = { ...controls };
    this.boardRequestController?.abort();
    await this.refresh();
  }

  toggle(id: string): void {
    if (this.expanded.has(id)) {
      this.expanded.delete(id);
      this.pruneBodyQueue();
    } else {
      if (this.expanded.size >= MAX_EXPANDED_ROWS) {
        const oldest = this.expanded.values().next().value;
        if (oldest !== undefined) {
          this.expanded.delete(oldest);
          this.pruneBodyQueue();
        }
      }
      this.expanded.add(id);
      const cached = this.bodies.get(id);
      this.loadBody(id, cached?.kind === 'error');
    }
    this.emit();
  }

  setExpanded(ids: Iterable<string>): void {
    const next = new Set<string>();
    for (const id of ids) {
      if (next.size >= MAX_EXPANDED_ROWS) {
        break;
      }
      next.add(id);
    }
    this.expanded.clear();
    for (const id of next) {
      this.expanded.add(id);
      const cached = this.bodies.get(id);
      this.loadBody(id, cached?.kind === 'error');
    }
    this.pruneBodyQueue();
    this.emit();
  }

  clearGhostRows(): void {
    if (this.ghostRows.length === 0) {
      return;
    }
    this.ghostRows = [];
    this.emit();
  }

  acknowledgeDataMotion(): void {
    this.flashIds.clear();
  }

  private async runRefreshLoop(): Promise<void> {
    while (this.refreshRequested && !this.stopped) {
      this.refreshRequested = false;
      const query = buildQueryString(this.controls);
      let next: BoardResponse;
      const controller = new AbortController();
      this.boardRequestController = controller;
      try {
        next = asBoardResponse(
          await this.transport.fetchJson(`/api/board?${query}`, controller.signal),
        );
      } catch (error) {
        if (
          !this.stopped &&
          !controller.signal.aborted &&
          !this.refreshRequested &&
          query === buildQueryString(this.controls)
        ) {
          this.boardError = errorMessage(error);
          this.emit();
        }
        continue;
      } finally {
        if (this.boardRequestController === controller) {
          this.boardRequestController = null;
        }
      }
      if (this.stopped || this.refreshRequested || query !== buildQueryString(this.controls)) {
        continue;
      }
      const reconcileExpanded = this.reconcileExpandedAfterRefresh;
      if (reconcileExpanded) {
        this.reconcileExpandedRows(this.board?.rows ?? [], next.rows);
        this.reconcileExpandedAfterRefresh = false;
      }
      this.board = next;
      this.boardError = null;
      const currentWatch = this.watch;
      if (
        currentWatch?.observerId !== next.state.observerId ||
        (next.state.stateVersion >= currentWatch.stateVersion &&
          next.state.dataVersion >= currentWatch.dataVersion)
      ) {
        this.watch = next.state;
      }
      if (reconcileExpanded) {
        for (const id of this.expanded) {
          this.loadBody(id, true);
        }
      }
      this.emit();
    }
  }

  private receiveState(value: unknown): void {
    if (this.stopped) {
      return;
    }
    let next: ObservationStateView;
    try {
      next = asObservationState(value);
    } catch (error) {
      this.boardError = errorMessage(error);
      this.emit();
      return;
    }
    const sameObserver = this.watch !== null && next.observerId === this.watch.observerId;
    if (
      sameObserver &&
      this.watch !== null &&
      (next.stateVersion < this.watch.stateVersion ||
        next.dataVersion < this.watch.dataVersion ||
        (next.stateVersion === this.watch.stateVersion &&
          next.dataVersion === this.watch.dataVersion))
    ) {
      return;
    }

    const dataMoved =
      this.watch === null
        ? next.dataVersion > 0
        : !sameObserver || next.dataVersion > this.watch.dataVersion;
    const previousRows = dataMoved ? (this.board?.rows ?? []) : [];
    this.watch = next;
    this.persistResumeTip(next.localTip);
    if (!dataMoved) {
      this.emit();
      return;
    }

    this.flashIds.clear();
    for (const id of next.movedIds) {
      this.flashIds.add(id);
    }
    const removed = new Set(next.removedIds);
    this.ghostRows = [];
    for (const row of previousRows) {
      if (removed.has(row.id)) {
        this.ghostRows.push(row);
        if (this.ghostRows.length >= MAX_GHOST_ROWS) {
          break;
        }
      }
    }
    this.bodyGeneration += 1;
    this.abortBodyRequests();
    this.bodies.clear();
    this.reconcileExpandedAfterRefresh = true;
    this.pruneBodyQueue();
    this.boardRequestController?.abort();
    void this.refresh();
    this.emit();
  }

  private reconcileExpandedRows(
    previousRows: readonly BoardRowView[],
    nextRows: readonly BoardRowView[],
  ): void {
    const previousInternalIds = new Map(previousRows.map((row) => [row.id, row.internalId]));
    const nextIdsByInternalId = new Map(nextRows.map((row) => [row.internalId, row.id]));
    const nextIds = new Set(nextRows.map((row) => row.id));
    const reconciled = new Set<string>();
    for (const id of this.expanded) {
      const internalId = previousInternalIds.get(id);
      const nextId =
        internalId === undefined
          ? nextIds.has(id)
            ? id
            : undefined
          : nextIdsByInternalId.get(internalId);
      if (nextId !== undefined) {
        reconciled.add(nextId);
      }
    }
    this.expanded.clear();
    for (const id of reconciled) {
      this.expanded.add(id);
    }
    this.pruneBodyQueue();
  }

  private loadBody(id: string, force: boolean): void {
    const current = this.bodyRequests.get(id);
    if (current?.generation === this.bodyGeneration && !current.controller.signal.aborted) {
      return;
    }
    if (!force && this.bodies.has(id)) {
      return;
    }

    const generation = this.bodyGeneration;
    const token = ++this.bodyToken;
    const request = { id, token, generation, controller: new AbortController() };
    this.bodyRequests.set(id, request);
    this.bodyQueue.push(request);
    this.drainBodyQueue();
  }

  private drainBodyQueue(): void {
    while (
      !this.stopped &&
      this.activeBodyFetches < MAX_BODY_REQUEST_CONCURRENCY &&
      this.bodyQueue.length > 0
    ) {
      const request = this.bodyQueue.shift();
      if (request === undefined || !this.bodyRequestIsCurrent(request)) {
        continue;
      }
      this.activeBodyFetches += 1;
      this.fetchBody(request);
    }
  }

  private fetchBody(request: BodyRequest): void {
    const { id, token, generation } = request;
    const url = `/api/bead?${new URLSearchParams({ id }).toString()}`;
    void this.transport
      .fetchJson(url, request.controller.signal)
      .then((value) => {
        if (this.bodyRequestIsCurrent(request)) {
          this.cacheBody(id, { kind: 'loaded', body: asBeadBody(value) });
        }
      })
      .catch((error: unknown) => {
        // Generation and token checks apply to failures too. A slow pre-update rejection
        // must not overwrite a newer successful body (PR #207 discussion_r3755544745).
        if (this.bodyRequestIsCurrent(request)) {
          this.cacheBody(id, { kind: 'error', error: errorMessage(error) });
        }
      })
      .finally(() => {
        this.activeBodyFetches -= 1;
        const active = this.bodyRequests.get(id);
        if (active?.token === token) {
          this.bodyRequests.delete(id);
          if (generation === this.bodyGeneration) {
            this.emit();
          }
        }
        this.drainBodyQueue();
      });
  }

  private cacheBody(id: string, entry: BodyCacheEntry): void {
    this.bodies.delete(id);
    this.bodies.set(id, entry);
    while (this.bodies.size > MAX_BODY_CACHE_ENTRIES) {
      let evicted = false;
      for (const cachedId of this.bodies.keys()) {
        if (!this.expanded.has(cachedId)) {
          this.bodies.delete(cachedId);
          evicted = true;
          break;
        }
      }
      if (!evicted) {
        return;
      }
    }
  }

  private bodyRequestIsCurrent(request: BodyRequest): boolean {
    const active = this.bodyRequests.get(request.id);
    return (
      !this.stopped &&
      request.generation === this.bodyGeneration &&
      !request.controller.signal.aborted &&
      active?.token === request.token &&
      active.generation === request.generation
    );
  }

  private pruneBodyQueue(): void {
    this.bodyQueue = this.bodyQueue.filter((request) => {
      if (this.expanded.has(request.id) && this.bodyRequestIsCurrent(request)) {
        return true;
      }
      const active = this.bodyRequests.get(request.id);
      if (active?.token === request.token) {
        this.bodyRequests.delete(request.id);
      }
      return false;
    });
    for (const request of this.bodyRequests.values()) {
      if (!this.expanded.has(request.id)) {
        request.controller.abort();
      }
    }
  }

  private abortBodyRequests(): void {
    for (const request of this.bodyRequests.values()) {
      request.controller.abort();
    }
  }

  private persistResumeTip(tip: string | null): void {
    if (tip === null || this.storage === undefined) {
      return;
    }
    try {
      this.storage.setItem(this.resumeStorageKey, tip);
    } catch {
      // Storage is best-effort; native EventSource still resumes within this page load.
    }
  }

  private emit(): void {
    if (!this.stopped) {
      this.onRender();
    }
  }
}

export function createClientStore(
  transport: Transport,
  onRender: () => void,
  options: ClientStoreOptions = {},
): ClientStore {
  return new Store(transport, onRender, options);
}
