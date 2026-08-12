import { createServer, request } from 'node:http';
import type { Server } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { BoardState } from '../src/cli/web/board.js';
import type { BoardStateDependencies, RepoStatus, WebState } from '../src/cli/web/board.js';
import { loadWebPage, startWebServer } from '../src/cli/web/server.js';
import type {
  WebServerDependencies,
  WebServerHandle,
  WebObserverController,
} from '../src/cli/web/server.js';
import type { TbdDataContext } from '../src/cli/lib/data-context.js';
import type { IdMapping } from '../src/file/id-mapping.js';
import { createTestIssue, testId, TEST_ULIDS } from './test-helpers.js';

const mapping: IdMapping = {
  shortToUlid: new Map([['view', TEST_ULIDS.ULID_1]]),
  ulidToShort: new Map([[TEST_ULIDS.ULID_1, 'view']]),
};
const context = {
  dataSyncDir: '/repo/.git/tbd/data-sync-worktree/.tbd/data-sync',
  mapping,
  prefix: 'web',
  config: { sync: { branch: 'tbd-sync', remote: 'origin' } },
  sharedPaths: { sharedWorktreePath: '/repo/.git/tbd/data-sync-worktree' },
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
const packageDir = resolvePackageDir();

function resolvePackageDir(): string {
  return dirname(dirname(fileURLToPath(import.meta.url)));
}

function createBoard(): BoardState {
  const dependencies: BoardStateDependencies = {
    loadContext: () => Promise.resolve(context),
    listIssues: () =>
      Promise.resolve([
        createTestIssue({ id: testId(TEST_ULIDS.ULID_1), title: 'Server lifecycle' }),
      ]),
    readRepoStatus: () => Promise.resolve(repoStatus),
    readLocalTip: () => Promise.resolve('a'.repeat(40)),
    now: () => new Date('2026-08-11T12:00:00.000Z'),
  };
  return new BoardState('/repo', dependencies);
}

function makeState(board: BoardState): WebState {
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
    observationPhase: 'watching',
    observationMode: 'native+reconcile',
    observationError: null,
    updateCount: 0,
    log: [],
  };
}

function dependencies(): {
  value: WebServerDependencies;
  observer: WebObserverController;
  createBoardDependency: ReturnType<typeof vi.fn>;
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
} {
  const board = createBoard();
  const createBoardDependency = vi.fn((_repoDir: string, initialContext: TbdDataContext) => {
    expect(initialContext).toBe(context);
    return board;
  });
  const start = vi.fn(() => Promise.resolve());
  const stop = vi.fn(() => Promise.resolve());
  const listeners = new Set<(state: WebState) => void>();
  const observer: WebObserverController = {
    start,
    stop,
    getState: () => makeState(board),
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
  return {
    value: {
      loadPage: () => Promise.resolve('<!doctype html><title>server test</title>'),
      createBoard: createBoardDependency,
      createObserver: () => observer,
      fetch: globalThis.fetch,
    },
    observer,
    createBoardDependency,
    start,
    stop,
  };
}

function listen(server: Server, port = 0): Promise<number> {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => {
      const address = server.address();
      if (address === null || typeof address === 'string') {
        reject(new Error('Expected a TCP server address'));
        return;
      }
      resolve(address.port);
    });
  });
}

function get(port: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = request({ hostname: '127.0.0.1', port, path: '/' }, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk: string) => {
        body += chunk;
      });
      response.once('end', () => {
        resolve(body);
      });
    });
    req.once('error', reject);
    req.end();
  });
}

describe('startWebServer', () => {
  const handles: WebServerHandle[] = [];
  const blockers: Server[] = [];

  afterEach(async () => {
    await Promise.all(handles.splice(0).map((handle) => handle.close()));
    await Promise.all(
      blockers.splice(0).map(
        (server) =>
          new Promise<void>((resolve) => {
            server.close(() => {
              resolve();
            });
          }),
      ),
    );
  });

  it('binds loopback, waits for HTTP readiness, and closes observer plus sockets idempotently', async () => {
    const injected = dependencies();
    const handle = await startWebServer(
      { repoDir: '/repo', initialContext: context, port: 0 },
      injected.value,
    );
    handles.push(handle);

    expect(handle.url).toBe(`http://127.0.0.1:${handle.port}`);
    expect(await get(handle.port)).toContain('server test');
    expect(injected.createBoardDependency).toHaveBeenCalledOnce();
    expect(injected.createBoardDependency).toHaveBeenCalledWith('/repo', context);
    expect(injected.start).toHaveBeenCalledOnce();

    await handle.close();
    await handle.close();
    await handle.closed;
    expect(injected.stop).toHaveBeenCalledOnce();
  });

  it('still closes sockets when observer teardown reports an error', async () => {
    const injected = dependencies();
    injected.stop.mockRejectedValueOnce(new Error('watcher close failed'));
    const warn = vi.fn();
    const handle = await startWebServer(
      {
        repoDir: '/repo',
        initialContext: context,
        port: 0,
        logger: {
          progress: vi.fn(),
          info: vi.fn(),
          warn,
          debug: vi.fn(),
        },
      },
      injected.value,
    );
    handles.push(handle);

    await expect(handle.close()).resolves.toBeUndefined();
    await handle.closed;
    await expect(get(handle.port)).rejects.toThrow();
    expect(warn).toHaveBeenCalledWith('Local observer shutdown failed: watcher close failed');
  });

  it('searches a bounded range for a default port but never moves an explicit port', async () => {
    const blocker = createServer((_request, response) => response.end('occupied'));
    blockers.push(blocker);
    const occupied = await listen(blocker);

    const searched = dependencies();
    const handle = await startWebServer(
      {
        repoDir: '/repo',
        initialContext: context,
        defaultPort: occupied,
        portSearchCount: 2,
      },
      searched.value,
    );
    handles.push(handle);
    expect(handle.port).toBe(occupied + 1);

    const pinned = dependencies();
    await expect(
      startWebServer({ repoDir: '/repo', initialContext: context, port: occupied }, pinned.value),
    ).rejects.toThrow(`Port ${occupied} is already in use`);
  });

  it('loads and serves the stitched, self-contained production artifact', async () => {
    const page = await loadWebPage();
    expect(page).toBe(await readFile(join(packageDir, 'dist', 'web', 'index.html'), 'utf8'));
    expect(page).toContain('<!doctype html>');
    expect(page).toContain('new EventSource');
    expect(page).toContain(':root');
    expect(page).not.toContain('__TBD_WEB_');
    expect(page).not.toMatch(/<script[^>]+src=/iu);
    expect(page).not.toMatch(/<link[^>]+href=/iu);

    const injected = dependencies();
    injected.value.loadPage = () => Promise.resolve(page);
    const handle = await startWebServer(
      { repoDir: '/repo', initialContext: context, port: 0 },
      injected.value,
    );
    handles.push(handle);
    expect(await get(handle.port)).toBe(page);
  });
});
