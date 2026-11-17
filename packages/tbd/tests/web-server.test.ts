import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createServer, request } from 'node:http';
import type { RequestListener, Server } from 'node:http';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { BoardState } from '../src/cli/web/board.js';
import type { BoardStateDependencies, RepoStatus, WebState } from '../src/cli/web/board.js';
import { webUrlWithView } from '../src/cli/commands/web.js';
import {
  browserLaunchCommand,
  cmdCommandArgs,
  loadWebPage,
  startWebServer,
} from '../src/cli/web/server.js';
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
      listen: listenRequest,
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

async function listenRequest(listener: RequestListener, port: number): Promise<Server> {
  const server = createServer(listener);
  await listen(server, port);
  return server;
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

  afterEach(async () => {
    await Promise.all(handles.splice(0).map((handle) => handle.close()));
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
    const first = 34_601;
    const addressInUse = Object.assign(new Error('occupied'), { code: 'EADDRINUSE' });

    const searched = dependencies();
    const searchedPorts: number[] = [];
    searched.value.listen = async (listener, port) => {
      searchedPorts.push(port);
      if (searchedPorts.length === 1) {
        throw addressInUse;
      }
      // The injected binder records the requested candidate but uses an OS-
      // assigned port. This proves search policy without racing the suite for
      // ownership of an adjacent real port.
      return listenRequest(listener, 0);
    };
    const handle = await startWebServer(
      {
        repoDir: '/repo',
        initialContext: context,
        defaultPort: first,
        portSearchCount: 2,
      },
      searched.value,
    );
    handles.push(handle);
    expect(searchedPorts).toEqual([first, first + 1]);

    const pinned = dependencies();
    const pinnedListen = vi.fn(() => Promise.reject(addressInUse));
    pinned.value.listen = pinnedListen;
    await expect(
      startWebServer({ repoDir: '/repo', initialContext: context, port: first }, pinned.value),
    ).rejects.toThrow(`Port ${first} is already in use`);
    expect(pinnedListen).toHaveBeenCalledOnce();
  });

  it('loads and serves the stitched, self-contained production artifact', async () => {
    const page = await loadWebPage();
    expect(page).toBe(await readFile(join(packageDir, 'dist', 'web', 'index.html'), 'utf8'));
    expect(page).toContain('<!doctype html>');
    expect(page).toContain('Live read-only viewer');
    expect(page).toContain('Ask your agent to change beads');
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

describe('browser launch command', () => {
  // Each URL carries characters cmd.exe treats as syntax: & and | separate commands,
  // ^ escapes, ( ) group, % and ! expand variables, and quotes and spaces split arguments.
  const urls = [
    'http://127.0.0.1:7777/?view=workmap&group=area%3A',
    'http://127.0.0.1:7777/?group=a^b&x=(1)|2',
    // `%25` decodes to `%`, so this reads as `%PATH%` once decoded; cmd must not expand it.
    'http://127.0.0.1:7777/?group=%25PATH%25!PATH!',
    'http://127.0.0.1:7777/?group=say "hi" & bye',
  ];

  /**
   * The text cmd.exe would hand to `start`, by its caret rule: `^` makes the next
   * character literal and is removed. Returns null when a metacharacter is left bare.
   */
  function cmdLiteral(escaped: string): string | null {
    let literal = '';
    for (let index = 0; index < escaped.length; index += 1) {
      const character = escaped[index]!;
      if (character === '^') {
        index += 1;
        literal += escaped[index] ?? '';
      } else if ('&|<>()%!"'.includes(character)) {
        return null;
      } else {
        literal += character;
      }
    }
    return literal;
  }

  it('hands the URL to the platform opener as one untouched argument off Windows', () => {
    for (const url of urls) {
      expect(browserLaunchCommand(url, 'darwin')).toEqual({
        file: 'open',
        args: [url],
        windowsVerbatimArguments: false,
      });
      expect(browserLaunchCommand(url, 'linux')).toEqual({
        file: 'xdg-open',
        args: [url],
        windowsVerbatimArguments: false,
      });
    }
  });

  it('caret-escapes every cmd.exe metacharacter on Windows, so start gets one literal URL', () => {
    expect(browserLaunchCommand(urls[0]!, 'win32')).toEqual({
      file: 'cmd.exe',
      args: [
        '/d',
        '/v:off',
        '/s',
        '/c',
        '"start "" http://127.0.0.1:7777/?view=workmap^&group=area^%3A"',
      ],
      windowsVerbatimArguments: true,
    });
    expect(browserLaunchCommand(urls[3]!, 'win32').args.at(-1)).toBe(
      '"start "" http://127.0.0.1:7777/?group=say^%20^%22hi^%22^%20^&^%20bye"',
    );
    for (const url of urls) {
      const command = browserLaunchCommand(url, 'win32').args.at(-1)!;
      expect(command.startsWith('"start "" ') && command.endsWith('"')).toBe(true);
      const argument = command.slice('"start "" '.length, -1);
      // No bare metacharacter, no space or quote to split start's argument, and the
      // literal start receives is the URL itself.
      expect({ url, literal: cmdLiteral(argument) }).toEqual({ url, literal: new URL(url).href });
      expect(argument).not.toMatch(/[\s"]/u);
    }
  });

  it('accepts every link tbd web builds, whatever the grouping prefix holds', () => {
    const prefixes = [
      ...Array.from({ length: 0x24f }, (_, index) => String.fromCodePoint(index + 1)),
      '%PATH%',
      '%PATH:a=b%',
      '%CD:~0,2%',
      '!PATH!',
      '^&calc',
      'say "hi" & bye',
      'line\r\nbreak',
      'emoji \u{1f600}',
    ];
    for (const groupPrefix of prefixes) {
      for (const view of [undefined, 'list', 'workmap']) {
        const link = webUrlWithView('http://127.0.0.1:7777', { view, groupPrefix });
        const argument = browserLaunchCommand(link, 'win32')
          .args.at(-1)!
          .slice('"start "" '.length, -1);
        expect({ groupPrefix, literal: cmdLiteral(argument) }).toEqual({
          groupPrefix,
          literal: new URL(link).href,
        });
      }
    }
  });

  it('refuses a URL outside what the cmd.exe escaping is proven for, on Windows only', () => {
    for (const url of [
      // Not http(s): normalization would leave the space and the quote in place.
      'foo:a b"c',
      // A quote survives normalization in a host name, and start would parse it.
      'http://a"b/',
      // `%` not starting a two-digit escape: cmd reads `%PATH:a=b%` as a substitution.
      'http://127.0.0.1:7777/?q=%PATH:a=b%',
      'http://127.0.0.1:7777/?q=%G0',
      // A `:` after a `%` lets cmd read `%41:x=y%` as a substitution on variable `41`.
      'http://127.0.0.1:7777/?q=%41:x=y%41',
    ]) {
      expect(() => browserLaunchCommand(url, 'win32'), url).toThrow(/cannot pass/u);
      expect(() => cmdCommandArgs('echo', url), url).toThrow(/cannot pass/u);
      expect(browserLaunchCommand(url, 'linux').args).toEqual([url]);
    }
  });

  it.runIf(process.platform === 'win32')(
    'passes each URL through the real cmd.exe parser literally',
    async () => {
      const dir = await mkdtemp(join(tmpdir(), 'tbd-web-open-'));
      try {
        // A planted script named like the text after an unescaped `&`.
        await writeFile(join(dir, 'group.cmd'), '@echo ran> "%~dp0marker.txt"\r\n');
        const run = (args: string[], cwd: string) =>
          spawnSync('cmd.exe', args, { cwd, encoding: 'utf8', windowsVerbatimArguments: true });
        for (const url of urls) {
          // `echo` in place of `start ""` prints exactly what start would receive.
          const echoed = run(cmdCommandArgs('echo', url), dir);
          expect({ url, out: echoed.stdout.trimEnd() }).toEqual({ url, out: new URL(url).href });
        }
        expect(existsSync(join(dir, 'marker.txt'))).toBe(false);
        // Control, run where nothing is planted: the same URL unescaped is cut at `&`,
        // which is the defect being fixed.
        const bare = run(
          ['/d', '/v:off', '/s', '/c', `"echo ${new URL(urls[0]!).href}"`],
          tmpdir(),
        );
        expect(bare.stdout.trimEnd()).toBe('http://127.0.0.1:7777/?view=workmap');
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    },
    30_000,
  );
});
