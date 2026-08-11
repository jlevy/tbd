/** Loopback server lifecycle, port policy, readiness, and browser launch. */

import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { createServer as createHttpServer } from 'node:http';
import type { RequestListener, Server } from 'node:http';
import { connect } from 'node:net';
import { fileURLToPath } from 'node:url';

import type { OperationLogger } from '../../lib/types.js';
import { noopLogger } from '../../lib/types.js';
import { BoardState } from './board.js';
import type { WebState } from './board.js';
import { createWebRequestHandler, SseHub } from './http.js';
import { LocalObserver } from './local-observer.js';

export const DEFAULT_WEB_PORT = 7_777;
export const DEFAULT_WEB_PORT_SEARCH_COUNT = 10;
const READINESS_TIMEOUT_MS = 10_000;
const READINESS_POLL_MS = 50;
const SHUTDOWN_TIMEOUT_MS = 3_000;

export interface WebServerOptions {
  repoDir: string;
  /** Undefined searches from `defaultPort`; any number (including test-only 0) is pinned. */
  port?: number;
  defaultPort?: number;
  portSearchCount?: number;
  logger?: OperationLogger;
}

export interface WebObserverController {
  start(): Promise<void>;
  stop(): Promise<void>;
  getState(): WebState;
  subscribe(listener: (state: WebState) => void): () => void;
}

export interface WebServerDependencies {
  loadPage: () => Promise<string>;
  createBoard: (repoDir: string) => BoardState;
  createObserver: (
    board: BoardState,
    options: { logger: OperationLogger },
  ) => WebObserverController;
  fetch: typeof globalThis.fetch;
}

export interface WebServerHandle {
  port: number;
  url: string;
  close(): Promise<void>;
  closed: Promise<void>;
}

export async function loadWebPage(): Promise<string> {
  // `import.meta.url` is the bundled dist entry in production and this source module
  // under vitest/tsx. Keep both paths explicit; only dist/ is published.
  const candidates = [
    fileURLToPath(new URL('./web/index.html', import.meta.url)),
    fileURLToPath(new URL('../../../dist/web/index.html', import.meta.url)),
  ];
  let lastError: unknown;
  for (const path of candidates) {
    try {
      return await readFile(path, 'utf8');
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error('Packaged web artifact dist/web/index.html is missing', { cause: lastError });
}

const defaultDependencies: WebServerDependencies = {
  loadPage: loadWebPage,
  createBoard: (repoDir) => new BoardState(repoDir),
  createObserver: (board, options) => new LocalObserver(board, { logger: options.logger }),
  fetch: globalThis.fetch,
};

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, milliseconds);
    timer.unref();
  });
}

function isAddressInUse(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && 'code' in error && error.code === 'EADDRINUSE'
  );
}

function portAcceptsConnections(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = connect({ host: '127.0.0.1', port });
    socket.unref();
    let settled = false;
    const finish = (occupied: boolean): void => {
      if (settled) {
        return;
      }
      settled = true;
      socket.destroy();
      resolve(occupied);
    };
    socket.once('connect', () => {
      finish(true);
    });
    socket.once('error', () => {
      finish(false);
    });
    socket.setTimeout(250, () => {
      finish(false);
    });
  });
}

/** Best-effort, non-binding port resolution used by `--dry-run`. */
export async function resolveWebPort(options: {
  port?: number;
  defaultPort?: number;
  portSearchCount?: number;
}): Promise<number> {
  if (options.port !== undefined) {
    return options.port;
  }
  const first = options.defaultPort ?? DEFAULT_WEB_PORT;
  const count = options.portSearchCount ?? DEFAULT_WEB_PORT_SEARCH_COUNT;
  for (let offset = 0; offset < count; offset += 1) {
    const candidate = first + offset;
    if (!(await portAcceptsConnections(candidate))) {
      return candidate;
    }
  }
  throw new Error(
    `No loopback port appears available in ${first}-${first + count - 1}. An orphaned tbd web process may still be running.`,
  );
}

function configureServer(server: Server): void {
  server.requestTimeout = 15_000;
  server.headersTimeout = 10_000;
  server.keepAliveTimeout = 5_000;
  server.maxHeadersCount = 100;
}

function listenOnce(listener: RequestListener, port: number): Promise<Server> {
  return new Promise((resolve, reject) => {
    const server = createHttpServer(listener);
    configureServer(server);
    const onError = (error: Error): void => {
      reject(error);
    };
    server.once('error', onError);
    server.listen(port, '127.0.0.1', () => {
      server.off('error', onError);
      resolve(server);
    });
  });
}

async function bindServer(listener: RequestListener, options: WebServerOptions): Promise<Server> {
  if (options.port !== undefined) {
    try {
      return await listenOnce(listener, options.port);
    } catch (error) {
      if (isAddressInUse(error)) {
        throw new Error(
          `Port ${options.port} is already in use. Stop the existing process or choose another with --port <n>.`,
          { cause: error },
        );
      }
      throw error;
    }
  }

  const first = options.defaultPort ?? DEFAULT_WEB_PORT;
  const count = options.portSearchCount ?? DEFAULT_WEB_PORT_SEARCH_COUNT;
  for (let offset = 0; offset < count; offset += 1) {
    const candidate = first + offset;
    try {
      return await listenOnce(listener, candidate);
    } catch (error) {
      if (!isAddressInUse(error)) {
        throw error;
      }
    }
  }
  const last = first + count - 1;
  throw new Error(
    `No loopback port is available in ${first}-${last}. An orphaned tbd web process may still be running; stop it or pass --port <n>.`,
  );
}

function boundPort(server: Server): number {
  const address = server.address();
  if (address === null || typeof address === 'string') {
    throw new Error('Web server did not expose a TCP address');
  }
  return address.port;
}

async function waitForHttpReady(
  url: string,
  fetchImplementation: typeof globalThis.fetch,
): Promise<void> {
  const deadline = Date.now() + READINESS_TIMEOUT_MS;
  let lastError: unknown;
  while (Date.now() < deadline) {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
    }, 1_000);
    timer.unref();
    try {
      const response = await fetchImplementation(url, {
        headers: { accept: 'text/html' },
        signal: controller.signal,
      });
      await response.text();
      if (response.ok) {
        return;
      }
      lastError = new Error(`readiness endpoint returned HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    } finally {
      clearTimeout(timer);
    }
    await delay(READINESS_POLL_MS);
  }
  throw new Error(`Web server did not become HTTP-ready within ${READINESS_TIMEOUT_MS}ms`, {
    cause: lastError,
  });
}

function closeHttpServer(server: Server): Promise<void> {
  if (!server.listening) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    server.close(() => {
      resolve();
    });
    server.closeIdleConnections();
    server.closeAllConnections();
  });
}

export async function startWebServer(
  options: WebServerOptions,
  dependencies: WebServerDependencies = defaultDependencies,
): Promise<WebServerHandle> {
  const logger = options.logger ?? noopLogger;
  const page = await dependencies.loadPage();
  const board = dependencies.createBoard(options.repoDir);
  await board.reload();
  const observer = dependencies.createObserver(board, { logger });
  const events = new SseHub(() => observer.getState());
  const unsubscribe = observer.subscribe((state) => {
    events.publish(state);
  });
  const listener = createWebRequestHandler({
    page,
    board,
    getState: () => observer.getState(),
    events,
  });

  let server: Server;
  try {
    server = await bindServer(listener, options);
  } catch (error) {
    unsubscribe();
    events.close();
    throw error;
  }
  const port = boundPort(server);
  const url = `http://127.0.0.1:${port}`;
  let resolveClosed!: () => void;
  const closed = new Promise<void>((resolve) => {
    resolveClosed = resolve;
  });
  server.once('close', resolveClosed);
  server.on('error', (error) => {
    logger.warn(`Web server socket error: ${error.message}`);
  });

  let closing: Promise<void> | null = null;
  const close = (): Promise<void> => {
    if (closing !== null) {
      return closing;
    }
    closing = (async () => {
      unsubscribe();
      try {
        await Promise.race([observer.stop(), delay(SHUTDOWN_TIMEOUT_MS)]);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.warn(`Local observer shutdown failed: ${message}`);
      }
      events.close();
      await Promise.race([closeHttpServer(server), delay(SHUTDOWN_TIMEOUT_MS)]);
      if (server.listening) {
        server.closeAllConnections();
      }
    })();
    return closing;
  };

  try {
    await observer.start();
    await waitForHttpReady(url, dependencies.fetch);
  } catch (error) {
    await close();
    throw error;
  }

  return { port, url, close, closed };
}

/** Launch the platform browser without making it part of server correctness. */
export function openWebBrowser(url: string): Promise<void> {
  const command =
    process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'cmd.exe' : 'xdg-open';
  const args = process.platform === 'win32' ? ['/d', '/s', '/c', 'start', '', url] : [url];
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { detached: true, stdio: 'ignore' });
    child.once('error', reject);
    child.once('spawn', () => {
      child.unref();
      resolve();
    });
  });
}
