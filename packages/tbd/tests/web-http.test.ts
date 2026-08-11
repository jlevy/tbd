import { createServer } from 'node:http';
import type { IncomingHttpHeaders, IncomingMessage, Server } from 'node:http';
import { request } from 'node:http';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { BoardState } from '../src/cli/web/board.js';
import type { BoardStateDependencies, WebState, RepoStatus } from '../src/cli/web/board.js';
import {
  createWebRequestHandler,
  encodeStateEvent,
  MAX_SSE_FRAME_BYTES,
  SseHub,
} from '../src/cli/web/http.js';
import type { TbdDataContext } from '../src/cli/lib/data-context.js';
import type { IdMapping } from '../src/file/id-mapping.js';
import type { Issue } from '../src/lib/types.js';
import { createTestIssue, testId, TEST_ULIDS } from './test-helpers.js';

interface ResponseResult {
  status: number;
  headers: IncomingHttpHeaders;
  body: string;
}

interface SseConnection {
  response: IncomingMessage;
  close(): void;
  waitFor(text: string): Promise<string>;
}

const internalId = testId(TEST_ULIDS.ULID_1);
const mapping: IdMapping = {
  shortToUlid: new Map([['bead', TEST_ULIDS.ULID_1]]),
  ulidToShort: new Map([[TEST_ULIDS.ULID_1, 'bead']]),
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

function makeIssue(): Issue {
  return createTestIssue({
    id: internalId,
    title: 'Serve me',
    description: 'full body',
    notes: 'detail only',
  });
}

function makeState(board: BoardState, tip = 'a'.repeat(40)): WebState {
  return {
    repoDir: '/repo',
    syncBranch: 'tbd-sync',
    remote: 'origin',
    intervalSeconds: 30,
    ...board.getSnapshotState(),
    lastReport: null,
    reportDataVersion: 0,
    changedIds: [],
    watchPhase: 'watching',
    watchSince: tip,
    watchError: null,
    wakeCount: 0,
    log: [],
  };
}

async function createBoard(): Promise<BoardState> {
  const dependencies: BoardStateDependencies = {
    loadContext: () => Promise.resolve(context),
    listIssues: () => Promise.resolve([makeIssue()]),
    readRepoStatus: () => Promise.resolve(repoStatus),
    readLocalTip: () => Promise.resolve('a'.repeat(40)),
    now: () => new Date('2026-08-11T12:00:00.000Z'),
  };
  const board = new BoardState('/repo', dependencies);
  await board.reload();
  return board;
}

function httpRequest(
  port: number,
  path: string,
  options: { method?: string; headers?: Record<string, string> } = {},
): Promise<ResponseResult> {
  return new Promise((resolve, reject) => {
    const req = request(
      {
        hostname: '127.0.0.1',
        port,
        path,
        method: options.method ?? 'GET',
        headers: options.headers,
      },
      (response) => {
        let body = '';
        response.setEncoding('utf8');
        response.on('data', (chunk: string) => {
          body += chunk;
        });
        response.once('end', () => {
          resolve({ status: response.statusCode ?? 0, headers: response.headers, body });
        });
      },
    );
    req.once('error', reject);
    req.end();
  });
}

function openSse(port: number, lastEventId?: string, path = '/api/events'): Promise<SseConnection> {
  return new Promise((resolve, reject) => {
    const req = request(
      {
        hostname: '127.0.0.1',
        port,
        path,
        headers: lastEventId === undefined ? undefined : { 'Last-Event-ID': lastEventId },
      },
      (response) => {
        response.setEncoding('utf8');
        let buffer = '';
        response.on('data', (chunk: string) => {
          buffer += chunk;
        });
        resolve({
          response,
          close: () => {
            req.destroy();
            response.destroy();
          },
          waitFor: async (text) => {
            const deadline = Date.now() + 2_000;
            while (!buffer.includes(text)) {
              if (Date.now() >= deadline) {
                throw new Error(`Timed out waiting for SSE text ${text}: ${buffer}`);
              }
              await new Promise((resolveWait) => setTimeout(resolveWait, 5));
            }
            return buffer;
          },
        });
      },
    );
    req.once('error', reject);
    req.end();
  });
}

describe('web HTTP router', () => {
  let board: BoardState;
  let currentState: WebState;
  let hub: SseHub;
  let server: Server;
  let port: number;

  beforeEach(async () => {
    board = await createBoard();
    currentState = makeState(board);
    hub = new SseHub(() => currentState, { heartbeatMs: 60_000 });
    server = createServer(
      createWebRequestHandler({
        page: '<!doctype html><title>tbd web</title>',
        board,
        getState: () => currentState,
        events: hub,
      }),
    );
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', () => {
        const address = server.address();
        if (address === null || typeof address === 'string') {
          reject(new Error('Expected an ephemeral TCP address'));
          return;
        }
        port = address.port;
        resolve();
      });
    });
  });

  afterEach(async () => {
    hub.close();
    server.closeAllConnections();
    await new Promise<void>((resolve) => {
      server.close(() => {
        resolve();
      });
    });
  });

  it('serves only the read surface with defensive headers and bounded board payloads', async () => {
    const index = await httpRequest(port, '/');
    expect(index.status).toBe(200);
    expect(index.headers['content-security-policy']).toContain("default-src 'none'");
    expect(index.headers['x-content-type-options']).toBe('nosniff');

    const boardResponse = await httpRequest(port, '/api/board');
    expect(boardResponse.status).toBe(200);
    expect(JSON.parse(boardResponse.body)).toMatchObject({
      rows: [{ id: 'web-bead', title: 'Serve me' }],
    });
    expect(boardResponse.body).not.toContain('full body');
    expect(boardResponse.body).not.toContain('detail only');

    const body = await httpRequest(port, '/api/bead?id=web-bead');
    expect(JSON.parse(body.body)).toMatchObject({ description: 'full body', notes: 'detail only' });
    expect((await httpRequest(port, '/api/bead?id=--help')).status).toBe(400);
    expect((await httpRequest(port, '/api/bead', { method: 'POST' })).status).toBe(404);
  });

  it('rejects DNS-rebinding Hosts and Origins that are not the exact request origin', async () => {
    expect((await httpRequest(port, '/', { headers: { Host: 'evil.example' } })).status).toBe(403);
    expect(
      (
        await httpRequest(port, '/', {
          headers: { Origin: `http://localhost:${port}` },
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await httpRequest(port, '/', {
          headers: { Origin: `http://127.0.0.1:${port}` },
        })
      ).status,
    ).toBe(200);
  });

  it('replays state frames from a native header or persisted browser query cursor', async () => {
    const first = await openSse(port);
    await first.waitFor(`id: ${'a'.repeat(40)}`);

    currentState = { ...currentState, watchSince: 'b'.repeat(40), wakeCount: 1 };
    hub.publish(currentState);
    await first.waitFor(`id: ${'b'.repeat(40)}`);
    first.close();

    currentState = { ...currentState, watchSince: 'c'.repeat(40), wakeCount: 2 };
    hub.publish(currentState);
    currentState = { ...currentState, watchSince: 'd'.repeat(40), wakeCount: 3 };
    hub.publish(currentState);

    const resumeTip = 'b'.repeat(40);
    const resumed = await openSse(port, undefined, `/api/events?lastEventId=${resumeTip}`);
    const replay = await resumed.waitFor(`id: ${'d'.repeat(40)}`);
    expect(replay).toContain(`id: ${'c'.repeat(40)}`);
    expect(replay.indexOf(`id: ${'c'.repeat(40)}`)).toBeLessThan(
      replay.indexOf(`id: ${'d'.repeat(40)}`),
    );
    resumed.close();
  });

  it('drops verbose report detail before an SSE frame can exceed its byte budget', () => {
    const huge = 'x'.repeat(MAX_SSE_FRAME_BYTES * 2);
    const state: WebState = {
      ...currentState,
      lastReport: {
        since: 'a'.repeat(40),
        tip: 'b'.repeat(40),
        changes: [
          {
            id: 'web-bead',
            internal_id: internalId,
            title: 'Serve me',
            change: 'updated',
            fields: [{ field: 'notes', before: '', after: huge }],
          },
        ],
      },
    };

    const frame = encodeStateEvent(state);
    expect(Buffer.byteLength(frame)).toBeLessThanOrEqual(MAX_SSE_FRAME_BYTES);
    const data = /^data: (.*)$/mu.exec(frame)?.[1];
    expect(data).toBeDefined();
    expect(JSON.parse(data!).lastReport).toBeNull();
  });
});
