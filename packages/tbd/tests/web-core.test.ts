import { describe, expect, it, vi } from 'vitest';

import {
  BOARD_PAGE_SIZE,
  buildQueryString,
  caveatsFor,
  createClientStore,
  DEFAULT_BOARD_SORTS,
  DELTA_VALUE_PREVIEW_CHARS,
  deltasValid,
  formatDeltaValue,
  MAX_BODY_CACHE_ENTRIES,
  MAX_BODY_REQUEST_CONCURRENCY,
  MAX_EXPANDED_ROWS,
  MAX_GHOST_ROWS,
  formatRelativeAge,
  isDefaultBoardSort,
  paginateBoardRows,
  phaseLabel,
  promoteBoardSort,
} from '../src/web/core.js';
import type {
  BoardControls,
  BoardResponse,
  BoardRowView,
  ClientStorage,
  Transport,
  ObservationStateView,
} from '../src/web/core.js';

interface Deferred<T> {
  promise: Promise<T>;
  resolve(value: T): void;
  reject(error: unknown): void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function state(overrides: Partial<ObservationStateView> = {}): ObservationStateView {
  return {
    observerId: 'observer-1',
    stateVersion: 0,
    repoDir: '/repo',
    syncBranch: 'tbd-sync',
    remote: 'origin',
    localTip: 'a'.repeat(40),
    totalBeads: 1,
    stats: null,
    repoStatus: null,
    latestChanges: [],
    latestChangeTotal: 0,
    latestChangesTruncated: false,
    changeDataVersion: 0,
    dataVersion: 0,
    movedIds: [],
    removedIds: [],
    observationPhase: 'watching',
    observationMode: 'native+reconcile',
    observationError: null,
    updateCount: 0,
    refreshedAt: '2026-08-11T12:00:00.000Z',
    log: [],
    ...overrides,
  };
}

function board(watch: ObservationStateView, title = 'Initial', id = 'web-one'): BoardResponse {
  return {
    command: 'tbd list --pretty',
    commandExact: true,
    filtersExact: true,
    search: '',
    total: 1,
    matched: 1,
    closedHidden: 0,
    statusFacets: [
      { value: 'open', count: 1 },
      { value: 'in_progress', count: 0 },
      { value: 'blocked', count: 0 },
      { value: 'deferred', count: 0 },
      { value: 'closed', count: 0 },
    ],
    kindFacets: [
      { value: 'bug', count: 0 },
      { value: 'feature', count: 0 },
      { value: 'task', count: 1 },
      { value: 'epic', count: 0 },
      { value: 'chore', count: 0 },
    ],
    priorityFacets: [0, 1, 2, 3, 4].map((value) => ({
      value,
      count: value === 2 ? 1 : 0,
    })),
    labelFacets: [],
    orderingCaveat: null,
    rows: [
      {
        id,
        internalId: 'is-01aaaaaaaaaaaaaaaaaaaaaa01',
        parentId: null,
        title,
        status: 'open',
        kind: 'task',
        priority: 2,
        labels: [],
        spec_path: null,
        assignee: null,
        ready: true,
        prefix: '',
        updated_at: '2026-08-11T11:55:00.000Z',
      },
    ],
    truncated: 0,
    state: watch,
  };
}

async function flush(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe('client core pure helpers', () => {
  it('pages 10000 rows only at the 5000-row last-resort boundary', () => {
    const seed = board(state()).rows[0]!;
    const rows: BoardRowView[] = Array.from({ length: 10_000 }, (_, index) => ({
      ...seed,
      id: `web-${index}`,
    }));

    const first = paginateBoardRows(rows, 0);
    expect(first.rows).toHaveLength(BOARD_PAGE_SIZE);
    expect(first).toMatchObject({
      pageIndex: 0,
      pageCount: 2,
      start: 0,
      end: BOARD_PAGE_SIZE,
      total: 10_000,
    });

    const last = paginateBoardRows(rows, 999);
    expect(last.rows).toHaveLength(BOARD_PAGE_SIZE);
    expect(last.rows[0]?.id).toBe('web-5000');
    expect(last).toMatchObject({
      pageIndex: 1,
      pageCount: 2,
      start: 5_000,
      end: 10_000,
      total: 10_000,
    });

    expect(paginateBoardRows(rows, -1).pageIndex).toBe(0);
    expect(paginateBoardRows(rows, Number.NaN).pageIndex).toBe(0);
    expect(paginateBoardRows([], 4)).toMatchObject({
      rows: [],
      pageIndex: 0,
      pageCount: 0,
      start: 0,
      end: 0,
      total: 0,
    });
  });

  it('middle-ellipsizes long scalar deltas at one documented boundary', () => {
    const boundary = formatDeltaValue('x'.repeat(DELTA_VALUE_PREVIEW_CHARS - 2));
    expect(boundary.preview).toBe(boundary.full);
    expect(boundary.preview).toHaveLength(DELTA_VALUE_PREVIEW_CHARS);

    const long = formatDeltaValue(`prefix-${'x'.repeat(100)}-suffix`);
    expect(long.full).toBe(JSON.stringify(`prefix-${'x'.repeat(100)}-suffix`));
    expect(long.preview).toHaveLength(DELTA_VALUE_PREVIEW_CHARS);
    expect(long.preview).toMatch(/^"prefix-/u);
    expect(long.preview).toMatch(/-suffix"$/u);
    expect(long.preview).toContain('…');
  });

  it('promotes clicked columns into a deterministic composable sort stack', () => {
    expect(promoteBoardSort([], 'updated')).toEqual([
      { key: 'updated', direction: 'desc' },
      { key: 'priority', direction: 'asc' },
    ]);
    expect(promoteBoardSort([{ key: 'updated', direction: 'desc' }], 'priority')).toEqual([
      { key: 'priority', direction: 'asc' },
      { key: 'updated', direction: 'desc' },
    ]);
    expect(
      promoteBoardSort(
        [
          { key: 'priority', direction: 'asc' },
          { key: 'updated', direction: 'desc' },
        ],
        'updated',
      ),
    ).toEqual([
      { key: 'updated', direction: 'desc' },
      { key: 'priority', direction: 'asc' },
    ]);
    expect(promoteBoardSort([{ key: 'title', direction: 'asc' }], 'title')).toEqual([
      { key: 'title', direction: 'desc' },
    ]);
    expect(
      promoteBoardSort(
        [
          { key: 'updated', direction: 'desc' },
          { key: 'priority', direction: 'asc' },
        ],
        'title',
      ),
    ).toEqual([
      { key: 'title', direction: 'asc' },
      { key: 'updated', direction: 'desc' },
    ]);
    expect(isDefaultBoardSort(DEFAULT_BOARD_SORTS)).toBe(true);
    expect(isDefaultBoardSort([{ key: 'updated', direction: 'desc' }])).toBe(false);
  });

  it('formats updated timestamps with deterministic MetaBrowser age tiers', () => {
    const now = Date.parse('2026-08-11T12:00:00.000Z');
    const age = (millisecondsAgo: number) =>
      formatRelativeAge(new Date(now - millisecondsAgo).toISOString(), now);

    expect(age(30_000)).toEqual({
      exact: '2026-08-11T11:59:30.000Z',
      label: 'just now',
      tier: 'sec',
    });
    expect(age(5 * 60_000)).toMatchObject({ label: '5m ago', tier: 'min' });
    expect(age(2 * 60 * 60_000)).toMatchObject({ label: '2h ago', tier: 'hr' });
    expect(age(3 * 24 * 60 * 60_000)).toMatchObject({ label: '3d ago', tier: 'day' });
    expect(age(2 * 7 * 24 * 60 * 60_000)).toMatchObject({ label: '2w ago', tier: 'wk' });
    expect(age(60 * 24 * 60 * 60_000)).toMatchObject({ label: '2mo ago', tier: 'old' });
    expect(age(2 * 365 * 24 * 60 * 60_000)).toMatchObject({ label: '2y ago', tier: 'old' });
    expect(formatRelativeAge('not-a-date', now)).toBeNull();
    expect(formatRelativeAge('2026-08-11T12:05:00.000Z', now)).toMatchObject({
      label: 'just now',
      tier: 'sec',
    });

    expect(age(60 * 60_000 - 1)).toMatchObject({ label: '59m ago', tier: 'min' });
    expect(age(60 * 60_000)).toMatchObject({ label: '1h ago', tier: 'hr' });
    expect(age(24 * 60 * 60_000 - 1)).toMatchObject({ label: '23h ago', tier: 'hr' });
    expect(age(24 * 60 * 60_000)).toMatchObject({ label: '1d ago', tier: 'day' });
    expect(age(7 * 24 * 60 * 60_000 - 1)).toMatchObject({ label: '6d ago', tier: 'day' });
    expect(age(7 * 24 * 60 * 60_000)).toMatchObject({ label: '1w ago', tier: 'wk' });
  });

  it('serializes controls one-to-one with CLI-shaped query parameters', () => {
    const controls: BoardControls = {
      search: 'release smoke',
      status: 'any',
      kind: 'bug',
      priority: '1',
      labelSearch: 'rare label',
      labels: ['release', 'urgent'],
      spec: 'plan.md',
      sorts: [
        { key: 'priority', direction: 'asc' },
        { key: 'updated', direction: 'desc' },
      ],
      ready: true,
      pretty: true,
    };
    expect(buildQueryString(controls)).toBe(
      'q=release+smoke&labelq=rare+label&type=bug&priority=1&spec=plan.md&label=release&label=urgent&order=priority%3Aasc&order=updated%3Adesc&all=1&ready=1&pretty=1',
    );
  });

  it('names inexactness, local observation modes, and the change-data-version gate', () => {
    const response = board(state());
    response.filtersExact = false;
    response.orderingCaveat =
      'Browser column sort: Updated ↓ then Priority ↑; Pretty orders outermost groups and keeps children in official order';
    response.search = 'needle';
    response.truncated = 5_000;
    expect(caveatsFor(response)).toEqual([
      'filters or ordering with no exact CLI equivalent apply',
      'Browser column sort: Updated ↓ then Priority ↑; Pretty orders outermost groups and keeps children in official order',
      'text search "needle" applies',
      'only the first 1 of 5000 rows are shown',
    ]);
    expect(phaseLabel(state())).toEqual({
      label: 'watching',
      help: 'Watching the local data-sync worktree with native events and one-second reconciliation. Run tbd sync to exchange remote changes. 0 local graph updates observed since this viewer started.',
    });
    expect(deltasValid(state({ latestChanges: [], dataVersion: 2, changeDataVersion: 2 }))).toBe(
      false,
    );
    expect(
      deltasValid(
        state({
          dataVersion: 2,
          changeDataVersion: 2,
          latestChanges: [{ id: 'web-one', title: 'One', change: 'updated', fields: [] }],
        }),
      ),
    ).toBe(true);
  });
});

describe('createClientStore transport orchestration', () => {
  it('keeps the last successful board visible across a failed refresh and clears the error', async () => {
    let fail = false;
    let title = 'Initial';
    const transport: Transport = {
      openEvents: () => ({ close: vi.fn() }),
      fetchJson: () =>
        fail
          ? Promise.reject(new Error('temporary board failure'))
          : Promise.resolve(board(state(), title)),
    };
    const store = createClientStore(transport, vi.fn());
    await store.start();

    fail = true;
    await store.setControls({ ...store.getView().controls, search: 'failing query' });
    expect(store.getView().board?.rows[0]?.title).toBe('Initial');
    expect(store.getView().boardError).toBe('temporary board failure');

    fail = false;
    title = 'Recovered';
    await store.setControls({ ...store.getView().controls, search: 'working query' });
    expect(store.getView().board?.rows[0]?.title).toBe('Recovered');
    expect(store.getView().boardError).toBeNull();
    store.stop();
  });

  it('keeps default Pretty and the composed sort across a live data refresh', async () => {
    let onState: ((next: unknown) => void) | null = null;
    let current = board(state());
    const requests: string[] = [];
    const transport: Transport = {
      openEvents: (_url, callback) => {
        onState = callback;
        return { close: vi.fn() };
      },
      fetchJson: (url) => {
        requests.push(url);
        return Promise.resolve(current);
      },
    };
    const store = createClientStore(transport, vi.fn());
    await store.start();

    current = board(state({ stateVersion: 1, dataVersion: 1 }), 'Updated live');
    onState!(current.state);
    await vi.waitFor(() => {
      expect(store.getView().board?.rows[0]?.title).toBe('Updated live');
    });

    expect(store.getView().controls).toMatchObject({
      pretty: true,
      sorts: DEFAULT_BOARD_SORTS,
    });
    expect(requests).toHaveLength(2);
    for (const request of requests) {
      expect(request).toContain('order=updated%3Adesc&order=priority%3Aasc');
      expect(request).toContain('pretty=1');
    }
    store.stop();
  });

  it('connects before fetching, passes the saved local tip, and coalesces updates during fetch', async () => {
    const order: string[] = [];
    const first = deferred<unknown>();
    const second = deferred<unknown>();
    const requests = [first, second];
    let onState: ((next: unknown) => void) | null = null;
    const transport: Transport = {
      openEvents: (_url, callback, lastEventId) => {
        order.push(`events:${lastEventId ?? 'none'}`);
        onState = callback;
        return { close: vi.fn() };
      },
      fetchJson: (url) => {
        order.push(`fetch:${url}`);
        const next = requests.shift();
        if (next === undefined) {
          throw new Error('Unexpected fetch');
        }
        return next.promise;
      },
    };
    const values = new Map([['tbd.web.lastEventId', 'saved-tip']]);
    const storage: ClientStorage = {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => {
        values.set(key, value);
      },
    };
    const render = vi.fn();
    const store = createClientStore(transport, render, { storage });

    const started = store.start();
    expect(order[0]).toBe('events:saved-tip');
    expect(order[1]).toMatch(/^fetch:\/api\/board\?/u);
    expect(onState).not.toBeNull();
    onState!(state({ dataVersion: 1, movedIds: ['web-one'], localTip: 'b'.repeat(40) }));
    onState!(state({ dataVersion: 2, movedIds: ['web-one'], localTip: 'c'.repeat(40) }));

    first.resolve(board(state(), 'Stale'));
    await flush();
    expect(order.filter((entry) => entry.startsWith('fetch:'))).toHaveLength(2);
    second.resolve(board(state({ dataVersion: 2 }), 'Fresh'));
    await started;

    expect(store.getView().board?.rows[0]?.title).toBe('Fresh');
    expect(store.getView().watch?.dataVersion).toBe(2);
    expect(values.get('tbd.web.lastEventId')).toBe('c'.repeat(40));
    store.stop();
  });

  it('ignores an EventSource callback that was already queued when the client stops', async () => {
    let onState: ((next: unknown) => void) | null = null;
    const close = vi.fn();
    const setItem = vi.fn();
    const render = vi.fn();
    const initialState = state();
    const transport: Transport = {
      openEvents: (_url, callback) => {
        onState = callback;
        return { close };
      },
      fetchJson: () => Promise.resolve(board(initialState)),
    };
    const store = createClientStore(transport, render, {
      storage: { getItem: () => null, setItem },
    });
    await store.start();
    const rendersBeforeStop = render.mock.calls.length;

    store.stop();
    onState!(state({ stateVersion: 1, dataVersion: 1, localTip: 'b'.repeat(40) }));

    expect(close).toHaveBeenCalledOnce();
    expect(store.getView().watch).toEqual(initialState);
    expect(setItem).not.toHaveBeenCalled();
    expect(render).toHaveBeenCalledTimes(rendersBeforeStop);
  });

  it('aborts a superseded board request before fetching the newest SSE state', async () => {
    let onState: ((next: unknown) => void) | null = null;
    const requests: { request: Deferred<unknown>; signal: AbortSignal }[] = [];
    const transport: Transport = {
      openEvents: (_url, callback) => {
        onState = callback;
        return { close: vi.fn() };
      },
      fetchJson: (_url, signal) => {
        if (signal === undefined) {
          throw new Error('Expected an abort signal');
        }
        const request = deferred<unknown>();
        signal.addEventListener(
          'abort',
          () => {
            request.reject(new Error('aborted'));
          },
          { once: true },
        );
        requests.push({ request, signal });
        return request.promise;
      },
    };
    const store = createClientStore(transport, vi.fn());
    const started = store.start();
    expect(requests).toHaveLength(1);

    onState!(state({ stateVersion: 1, dataVersion: 1, movedIds: ['web-one'] }));
    expect(requests[0]?.signal.aborted).toBe(true);
    await vi.waitFor(() => {
      expect(requests).toHaveLength(2);
    });
    requests[1]!.request.resolve(
      board(state({ stateVersion: 1, dataVersion: 1 }), 'Current response'),
    );
    await started;

    expect(store.getView().board?.rows[0]?.title).toBe('Current response');
    store.stop();
  });

  it('does not let a stale pre-update body rejection overwrite a fresh post-update body', async () => {
    let onState: ((next: unknown) => void) | null = null;
    const bodyRequests: Deferred<unknown>[] = [];
    const transport: Transport = {
      openEvents: (_url, callback) => {
        onState = callback;
        return { close: vi.fn() };
      },
      fetchJson: (url) => {
        if (url.startsWith('/api/board?')) {
          return Promise.resolve(board(state()));
        }
        const request = deferred<unknown>();
        bodyRequests.push(request);
        return request.promise;
      },
    };
    const store = createClientStore(transport, vi.fn());
    await store.start();
    store.toggle('web-one');
    expect(bodyRequests).toHaveLength(1);

    onState!(
      state({
        dataVersion: 1,
        movedIds: ['web-one'],
        localTip: 'b'.repeat(40),
      }),
    );
    await flush();
    expect(bodyRequests).toHaveLength(2);

    bodyRequests[1]!.resolve({ id: 'web-one', notes: 'fresh body' });
    await flush();
    bodyRequests[0]!.reject(new Error('stale network failure'));
    await flush();

    expect(store.getView().bodies.get('web-one')).toEqual({
      kind: 'loaded',
      body: { id: 'web-one', notes: 'fresh body' },
    });
    store.stop();
  });

  it('remaps expanded rows by internal id before refetching their bodies', async () => {
    let onState: ((next: unknown) => void) | null = null;
    let current = board(state());
    const bodyIds: string[] = [];
    const transport: Transport = {
      openEvents: (_url, callback) => {
        onState = callback;
        return { close: vi.fn() };
      },
      fetchJson: (url) => {
        if (url.startsWith('/api/board?')) {
          return Promise.resolve(current);
        }
        const id = new URL(url, 'http://localhost').searchParams.get('id');
        if (id === null) {
          throw new Error('Missing bead id');
        }
        bodyIds.push(id);
        return Promise.resolve({ id });
      },
    };
    const store = createClientStore(transport, vi.fn());
    await store.start();
    store.toggle('web-one');
    await vi.waitFor(() => {
      expect(store.getView().bodies.has('web-one')).toBe(true);
    });

    current = board(
      state({ dataVersion: 1, movedIds: ['next-one'], localTip: 'b'.repeat(40) }),
      'Remapped',
      'next-one',
    );
    onState!(current.state);
    await vi.waitFor(() => {
      expect([...store.getView().expanded]).toEqual(['next-one']);
      expect(store.getView().bodies.has('next-one')).toBe(true);
    });

    expect(bodyIds).toEqual(['web-one', 'next-one']);
    expect(store.getView().expanded.has('web-one')).toBe(false);
    expect(store.getView().bodies.has('web-one')).toBe(false);
    store.stop();
  });

  it('accepts a lower data version from a restarted observer and refreshes the board', async () => {
    let onState: ((next: unknown) => void) | null = null;
    let current = board(
      state({ observerId: 'observer-old', dataVersion: 5, localTip: 'a'.repeat(40) }),
      'Before restart',
    );
    const fetchJson = vi.fn(() => Promise.resolve(current));
    const store = createClientStore(
      {
        openEvents: (_url, callback) => {
          onState = callback;
          return { close: vi.fn() };
        },
        fetchJson,
      },
      vi.fn(),
    );
    await store.start();

    current = board(
      state({ observerId: 'observer-new', dataVersion: 0, localTip: 'b'.repeat(40) }),
      'After restart',
    );
    onState!(current.state);
    await vi.waitFor(() => {
      expect(store.getView().board?.rows[0]?.title).toBe('After restart');
    });

    expect(fetchJson).toHaveBeenCalledTimes(2);
    expect(store.getView().watch).toMatchObject({ observerId: 'observer-new', dataVersion: 0 });
    store.stop();
  });

  it('never lets an older board-embedded state roll back a newer SSE state', async () => {
    let onState: ((next: unknown) => void) | null = null;
    const response = deferred<unknown>();
    const transport: Transport = {
      openEvents: (_url, callback) => {
        onState = callback;
        return { close: vi.fn() };
      },
      fetchJson: () => response.promise,
    };
    const store = createClientStore(transport, vi.fn());
    const started = store.start();
    onState!(state({ dataVersion: 4, localTip: 'd'.repeat(40) }));
    response.resolve(board(state({ dataVersion: 2 }), 'Rows can still load'));
    await started;

    expect(store.getView().board?.rows[0]?.title).toBe('Rows can still load');
    expect(store.getView().watch?.dataVersion).toBe(4);
    store.stop();
  });

  it('keeps newer SSE metadata when an older board response has the same graph version', async () => {
    let onState: ((next: unknown) => void) | null = null;
    const response = deferred<unknown>();
    const transport: Transport = {
      openEvents: (_url, callback) => {
        onState = callback;
        return { close: vi.fn() };
      },
      fetchJson: () => response.promise,
    };
    const store = createClientStore(transport, vi.fn());
    const started = store.start();
    const freshStatus = {
      tbdVersion: '0.4.2',
      gitBranch: 'feature',
      syncBranch: 'tbd-sync',
      remote: 'origin',
      displayPrefix: 'web',
      worktreePath: '/repo/.git/tbd/data-sync-worktree',
      worktreeHealthy: true,
      worktreeStatus: 'valid',
      workspaces: ['fresh-workspace'],
    };
    onState!(state({ stateVersion: 1, dataVersion: 0, repoStatus: freshStatus, updateCount: 1 }));
    response.resolve(board(state({ dataVersion: 0, repoStatus: null }), 'Rows still load'));
    await started;

    expect(store.getView().board?.rows[0]?.title).toBe('Rows still load');
    expect(store.getView().watch?.repoStatus?.workspaces).toEqual(['fresh-workspace']);
    expect(store.getView().watch?.updateCount).toBe(1);
    store.stop();
  });

  it('accepts the canonical board state at the same observer state version', async () => {
    let onState: ((next: unknown) => void) | null = null;
    let current = board(state());
    const transport: Transport = {
      openEvents: (_url, callback) => {
        onState = callback;
        return { close: vi.fn() };
      },
      fetchJson: () => Promise.resolve(current),
    };
    const store = createClientStore(transport, vi.fn());
    await store.start();

    const canonical = state({
      stateVersion: 1,
      dataVersion: 1,
      movedIds: ['web-one', 'web-two'],
      latestChangeTotal: 2,
    });
    current = board(canonical, 'Canonical rows');
    onState!({ ...canonical, movedIds: ['web-one'] });

    await vi.waitFor(() => {
      expect(store.getView().watch?.movedIds).toEqual(['web-one', 'web-two']);
    });
    expect(store.getView().board?.rows[0]?.title).toBe('Canonical rows');
    store.stop();
  });

  it('does not let a duplicate same-version SSE frame replace canonical board state', async () => {
    let onState: ((next: unknown) => void) | null = null;
    let current = board(state());
    const transport: Transport = {
      openEvents: (_url, callback) => {
        onState = callback;
        return { close: vi.fn() };
      },
      fetchJson: () => Promise.resolve(current),
    };
    const store = createClientStore(transport, vi.fn());
    await store.start();

    const canonical = state({
      stateVersion: 1,
      dataVersion: 1,
      movedIds: ['web-one', 'web-two'],
      latestChangeTotal: 2,
    });
    const boundedEvent = { ...canonical, movedIds: ['web-one'] };
    current = board(canonical, 'Canonical rows');
    onState!(boundedEvent);
    await vi.waitFor(() => {
      expect(store.getView().watch?.movedIds).toEqual(['web-one', 'web-two']);
    });

    onState!(boundedEvent);
    expect(store.getView().watch?.movedIds).toEqual(['web-one', 'web-two']);
    store.stop();
  });

  it('bounds detail fetches and drops queued work when rows collapse', async () => {
    const bodyRequests: { url: string; request: Deferred<unknown> }[] = [];
    const transport: Transport = {
      openEvents: () => ({ close: vi.fn() }),
      fetchJson: (url) => {
        if (url.startsWith('/api/board?')) {
          return Promise.resolve(board(state()));
        }
        const request = deferred<unknown>();
        bodyRequests.push({ url, request });
        return request.promise;
      },
    };
    const store = createClientStore(transport, vi.fn());
    await store.start();
    const ids = Array.from(
      { length: MAX_BODY_REQUEST_CONCURRENCY + 4 },
      (_, index) => `web-${index}`,
    );
    store.setExpanded(ids);
    expect(bodyRequests).toHaveLength(MAX_BODY_REQUEST_CONCURRENCY);

    bodyRequests[0]!.request.resolve({ id: ids[0] });
    await flush();
    expect(bodyRequests).toHaveLength(MAX_BODY_REQUEST_CONCURRENCY + 1);

    store.setExpanded([]);
    for (const { url, request } of bodyRequests.slice(1)) {
      const id = new URL(url, 'http://localhost').searchParams.get('id');
      request.resolve({ id });
    }
    await flush();
    expect(bodyRequests).toHaveLength(MAX_BODY_REQUEST_CONCURRENCY + 1);
    store.stop();
  });

  it('aborts stale-generation detail requests so current bodies cannot be starved', async () => {
    let onState: ((next: unknown) => void) | null = null;
    const ids = Array.from({ length: MAX_BODY_REQUEST_CONCURRENCY }, (_, index) => `web-${index}`);
    const initial = board(state());
    const seed = initial.rows[0]!;
    initial.rows = ids.map((id) => ({ ...seed, id, internalId: `internal-${id}` }));
    let current = initial;
    const bodyRequests: { request: Deferred<unknown>; signal: AbortSignal }[] = [];
    const transport: Transport = {
      openEvents: (_url, callback) => {
        onState = callback;
        return { close: vi.fn() };
      },
      fetchJson: (url, signal) => {
        if (url.startsWith('/api/board?')) {
          return Promise.resolve(current);
        }
        if (signal === undefined) {
          throw new Error('Expected an abort signal');
        }
        const request = deferred<unknown>();
        signal.addEventListener(
          'abort',
          () => {
            request.reject(new Error('aborted'));
          },
          { once: true },
        );
        bodyRequests.push({ request, signal });
        return request.promise;
      },
    };
    const store = createClientStore(transport, vi.fn());
    await store.start();
    store.setExpanded(ids);
    expect(bodyRequests).toHaveLength(MAX_BODY_REQUEST_CONCURRENCY);

    current = { ...initial, state: state({ stateVersion: 1, dataVersion: 1, movedIds: ids }) };
    onState!(current.state);
    expect(
      bodyRequests.slice(0, MAX_BODY_REQUEST_CONCURRENCY).every(({ signal }) => signal.aborted),
    ).toBe(true);
    await vi.waitFor(() => {
      expect(bodyRequests).toHaveLength(MAX_BODY_REQUEST_CONCURRENCY * 2);
    });

    for (let index = MAX_BODY_REQUEST_CONCURRENCY; index < bodyRequests.length; index += 1) {
      bodyRequests[index]!.request.resolve({ id: ids[index - MAX_BODY_REQUEST_CONCURRENCY] });
    }
    await vi.waitFor(() => {
      expect(store.getView().bodies.size).toBe(MAX_BODY_REQUEST_CONCURRENCY);
    });
    store.stop();
  });

  it('caps simultaneous expanded rows before scheduling detail work', async () => {
    const bodyRequests: Deferred<unknown>[] = [];
    const transport: Transport = {
      openEvents: () => ({ close: vi.fn() }),
      fetchJson: (url) => {
        if (url.startsWith('/api/board?')) {
          return Promise.resolve(board(state()));
        }
        const request = deferred<unknown>();
        bodyRequests.push(request);
        return request.promise;
      },
    };
    const store = createClientStore(transport, vi.fn());
    await store.start();
    const ids = Array.from({ length: MAX_EXPANDED_ROWS + 20 }, (_, index) => `web-${index}`);

    store.setExpanded(ids);

    expect([...store.getView().expanded]).toEqual(ids.slice(0, MAX_EXPANDED_ROWS));
    expect(bodyRequests).toHaveLength(MAX_BODY_REQUEST_CONCURRENCY);

    store.toggle(ids[MAX_EXPANDED_ROWS]!);
    expect([...store.getView().expanded]).toEqual(ids.slice(1, MAX_EXPANDED_ROWS + 1));
    expect(bodyRequests).toHaveLength(MAX_BODY_REQUEST_CONCURRENCY);
    store.stop();
  });

  it('retains only the most recent bounded body cache across collapsed batches', async () => {
    const transport: Transport = {
      openEvents: () => ({ close: vi.fn() }),
      fetchJson: (url) => {
        if (url.startsWith('/api/board?')) {
          return Promise.resolve(board(state()));
        }
        return Promise.resolve({ id: new URL(url, 'http://localhost').searchParams.get('id') });
      },
    };
    const store = createClientStore(transport, vi.fn());
    await store.start();

    for (let batch = 0; batch < 3; batch += 1) {
      const ids = Array.from(
        { length: MAX_EXPANDED_ROWS },
        (_, index) => `batch-${batch}-${index}`,
      );
      store.setExpanded(ids);
      await vi.waitFor(() => {
        expect(store.getView().bodies.has(ids.at(-1)!)).toBe(true);
      });
      store.setExpanded([]);
    }

    expect(store.getView().bodies.size).toBe(MAX_BODY_CACHE_ENTRIES);
    expect(store.getView().bodies.has('batch-0-0')).toBe(false);
    expect(store.getView().bodies.has('batch-2-99')).toBe(true);
    store.stop();
  });

  it('caps deletion ghosts when one local update removes a large board', async () => {
    let onState: ((next: unknown) => void) | null = null;
    const initial = board(state());
    const seed = initial.rows[0]!;
    const ids = Array.from({ length: MAX_GHOST_ROWS + 50 }, (_, index) => `web-${index}`);
    initial.rows = ids.map((id) => ({ ...seed, id }));
    initial.total = ids.length;
    initial.matched = ids.length;
    const transport: Transport = {
      openEvents: (_url, callback) => {
        onState = callback;
        return { close: vi.fn() };
      },
      fetchJson: () => Promise.resolve(initial),
    };
    const store = createClientStore(transport, vi.fn());
    await store.start();

    onState!(state({ dataVersion: 1, removedIds: ids, localTip: 'b'.repeat(40) }));
    await flush();

    expect(store.getView().ghostRows).toHaveLength(MAX_GHOST_ROWS);
    expect(store.getView().ghostRows.map((row) => row.id)).toEqual(ids.slice(0, MAX_GHOST_ROWS));
    store.stop();
  });
});
