/** Loopback server lifecycle, port policy, readiness, and browser launch. */

import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { createServer as createHttpServer } from 'node:http';
import type { RequestListener, Server } from 'node:http';
import { connect } from 'node:net';
import { fileURLToPath } from 'node:url';

import type { OperationLogger } from '../../lib/types.js';
import { noopLogger } from '../../lib/types.js';
import { prepareDataSyncContext } from '../lib/data-context.js';
import type { TbdDataContext } from '../lib/data-context.js';
import { withSharedDataSyncLock } from '../../file/common-dir-layout.js';
import { BoardState } from './board.js';
import type { WebState } from './board.js';
import { createWebRequestHandler, SseHub } from './http.js';
import { LocalObserver } from './local-observer.js';

export const DEFAULT_WEB_PORT = 7_777;
export const DEFAULT_WEB_PORT_SEARCH_COUNT = 10;
const READINESS_TIMEOUT_MS = 10_000;
const READINESS_POLL_MS = 50;
const INITIAL_SNAPSHOT_TIMEOUT_MS = 10_000;
const INITIAL_SNAPSHOT_RETRY_MS = 50;
const SHUTDOWN_TIMEOUT_MS = 3_000;

export interface WebServerOptions {
  repoDir: string;
  /** Repair-capable context prepared before command-scoped signal handling begins. */
  initialContext: TbdDataContext;
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
  createBoard: (repoDir: string, initialContext: TbdDataContext) => BoardState;
  createObserver: (
    board: BoardState,
    options: { logger: OperationLogger },
  ) => WebObserverController;
  fetch: typeof globalThis.fetch;
  /** Injectable socket binder keeps port-policy tests deterministic. */
  listen: (listener: RequestListener, port: number) => Promise<Server>;
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
  createBoard: (repoDir, initialContext) => new BoardState(repoDir, undefined, initialContext),
  createObserver: (board, options) => new LocalObserver(board, { logger: options.logger }),
  fetch: globalThis.fetch,
  listen: listenOnce,
};

/** Perform any first-use initialization or repair before the long-running lifecycle. */
export function prepareWebContext(repoDir: string): Promise<TbdDataContext> {
  // Always take the central wrapper once: besides preparation, this establishes the
  // persistent quiescent epoch required by the live viewer's optimistic reads.
  return withSharedDataSyncLock(repoDir, () => prepareDataSyncContext(repoDir));
}

function delay(milliseconds: number, keepProcessAlive = false): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, milliseconds);
    if (!keepProcessAlive) {
      timer.unref();
    }
  });
}

async function loadInitialBoard(board: BoardState): Promise<void> {
  const deadline = Date.now() + INITIAL_SNAPSHOT_TIMEOUT_MS;
  do {
    const result = await board.reload();
    if (!result.deferred) {
      return;
    }
    await delay(INITIAL_SNAPSHOT_RETRY_MS, true);
  } while (Date.now() < deadline);
  throw new Error(
    `Could not read a stable bead snapshot within ${INITIAL_SNAPSHOT_TIMEOUT_MS}ms because another tbd command is still writing`,
  );
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

async function bindServer(
  listener: RequestListener,
  options: WebServerOptions,
  listen: WebServerDependencies['listen'],
): Promise<Server> {
  if (options.port !== undefined) {
    try {
      return await listen(listener, options.port);
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
      return await listen(listener, candidate);
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
  const board = dependencies.createBoard(options.repoDir, options.initialContext);
  await loadInitialBoard(board);
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
    server = await bindServer(listener, options, dependencies.listen);
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

/** The process that opens a URL in the default browser on one platform. */
export interface BrowserLaunchCommand {
  file: string;
  args: string[];
  /** Windows only: pass `args` exactly as built, without Node's argument quoting. */
  windowsVerbatimArguments: boolean;
}

/** Every character cmd.exe gives a meaning: separators, redirection, grouping, expansion. */
const CMD_METACHARACTERS = /[\^&|<>()%!"]/gu;

/**
 * Why `href` cannot pass through cmd.exe literally, or null when it can. A caret makes
 * cmd's later phases read a character literally, but variable expansion runs first:
 * `%NAME:search=replace%` and `%NAME:~start,length%` expand even when each `%` is
 * escaped, so no `:` may follow a `%`. Every `%` must start a two-digit escape, and no
 * whitespace or quote may remain for `start` to split on.
 */
function cmdLiteralProblem(href: string, protocol: string): string | null {
  if (protocol !== 'http:' && protocol !== 'https:') {
    return `only http and https URLs are supported, not ${protocol}`;
  }
  if (/[\s"]/u.test(href)) {
    return 'it holds whitespace or a quote';
  }
  if (/%(?![0-9A-Fa-f]{2})/u.test(href)) {
    return 'a % does not start a two-digit escape';
  }
  const firstPercent = href.indexOf('%');
  if (firstPercent >= 0 && href.includes(':', firstPercent)) {
    return 'a : follows a %, which cmd reads as a variable substitution';
  }
  return null;
}

/**
 * The cmd.exe arguments that run `<command> <url>` with the URL read as literal text.
 *
 * Contract: `url` is an http or https URL whose normalized form has no whitespace or
 * quote, in which every `%` starts a two-digit escape, and in which no `:` follows a `%`.
 * Every link `tbd web` builds satisfies it (`webUrlWithView` percent-encodes the view
 * options, including `%` and `:`). Any other URL throws, so a caller fails closed: the
 * open command reports it as a browser that could not be opened.
 *
 * Within the contract, every cmd metacharacter is caret-escaped and the command line is
 * passed verbatim, because Node quotes only arguments that contain a space or a quote and
 * would otherwise hand a bare `&` to cmd as a command separator. `/d` skips AutoRun
 * commands and `/v:off` turns off `!` expansion. `/s /c "..."` is the form Node itself
 * builds for `shell: true`. One limit remains: cmd expands `%NAME%` when NAME is a
 * defined variable, and every `%...%` span here names a variable ending in `^`, so the
 * URL stays literal unless the environment defines such a variable.
 *
 * Exported with `command` as a parameter so tests can run the same escaping through the
 * real cmd.exe with `echo`, which prints what `start` would receive.
 */
export function cmdCommandArgs(command: string, url: string): string[] {
  const parsed = new URL(url);
  const problem = cmdLiteralProblem(parsed.href, parsed.protocol);
  if (problem !== null) {
    throw new Error(`The URL cannot pass through cmd.exe literally: ${problem}`);
  }
  const literal = parsed.href.replace(CMD_METACHARACTERS, '^$&');
  return ['/d', '/v:off', '/s', '/c', `"${command} ${literal}"`];
}

/**
 * `url` parsed as an http or https URL, or a thrown error. `open` and `xdg-open` take an
 * argument that is not a web URL as an option, an application, or a file, so the launcher
 * accepts web pages only; a normalized http(s) URL never starts with `-`.
 */
function webPageUrl(url: string): URL {
  let parsed: URL | null = null;
  try {
    parsed = new URL(url);
  } catch {
    // Reported below with the same message as any other non-web target.
  }
  if (parsed?.protocol !== 'http:' && parsed?.protocol !== 'https:') {
    throw new Error(`The browser launcher opens only http and https URLs, not ${url}`);
  }
  return parsed;
}

/**
 * The browser launch for `platform`. The URL must be http or https on every platform
 * and is passed normalized. Elsewhere it is one argument to a launcher that no shell
 * parses. Windows has no such launcher, so `start` runs inside cmd.exe with the URL
 * escaped by `cmdCommandArgs`, which also throws for a URL outside its contract.
 *
 * Exported so every platform's branch is assertable from any host.
 */
export function browserLaunchCommand(url: string, platform: NodeJS.Platform): BrowserLaunchCommand {
  const page = webPageUrl(url).href;
  switch (platform) {
    case 'darwin':
      return { file: 'open', args: [page], windowsVerbatimArguments: false };
    case 'win32':
      return {
        file: 'cmd.exe',
        args: cmdCommandArgs('start ""', page),
        windowsVerbatimArguments: true,
      };
    default:
      return { file: 'xdg-open', args: [page], windowsVerbatimArguments: false };
  }
}

/** Launch the platform browser without making it part of server correctness. */
export function openWebBrowser(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const { file, args, windowsVerbatimArguments } = browserLaunchCommand(url, process.platform);
    const child = spawn(file, args, {
      detached: true,
      stdio: 'ignore',
      windowsVerbatimArguments,
    });
    child.once('error', reject);
    child.once('spawn', () => {
      child.unref();
      resolve();
    });
  });
}
