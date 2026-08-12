import { EventEmitter } from 'node:events';
import { createServer } from 'node:http';
import type { IncomingHttpHeaders, IncomingMessage, Server, ServerResponse } from 'node:http';
import { request } from 'node:http';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
    observerId: 'observer-1',
    stateVersion: 0,
    repoDir: '/repo',
    syncBranch: 'tbd-sync',
    remote: 'origin',
    ...board.getSnapshotState(),
    localTip: tip,
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

    currentState = { ...currentState, localTip: 'b'.repeat(40), updateCount: 1 };
    hub.publish(currentState);
    await first.waitFor(`id: ${'b'.repeat(40)}`);
    first.close();

    currentState = { ...currentState, localTip: 'c'.repeat(40), updateCount: 2 };
    hub.publish(currentState);
    currentState = { ...currentState, localTip: 'd'.repeat(40), updateCount: 3 };
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

  it('resumes after the newest occurrence when a local ref reuses an older commit id', async () => {
    const repeatedTip = 'a'.repeat(40);
    const first = await openSse(port);
    await first.waitFor(`id: ${repeatedTip}`);
    first.close();

    currentState = { ...currentState, localTip: 'b'.repeat(40), updateCount: 1 };
    hub.publish(currentState);
    currentState = { ...currentState, localTip: repeatedTip, updateCount: 2 };
    hub.publish(currentState);

    const resumed = await openSse(port, repeatedTip);
    const replay = await resumed.waitFor('"updateCount":2');
    expect(replay).not.toContain(`id: ${'b'.repeat(40)}`);
    resumed.close();
  });

  it('ends replay at current state when the local sync ref no longer has an event id', async () => {
    const first = await openSse(port);
    await first.waitFor(`id: ${'a'.repeat(40)}`);
    first.close();

    currentState = { ...currentState, localTip: 'b'.repeat(40), stateVersion: 1 };
    hub.publish(currentState);
    currentState = { ...currentState, localTip: null, stateVersion: 2 };
    hub.publish(currentState);

    const resumed = await openSse(port, 'a'.repeat(40));
    const replay = await resumed.waitFor('"stateVersion":2');
    expect(replay).toContain(`id: ${'b'.repeat(40)}`);
    expect(replay).toContain('"localTip":null');
    resumed.close();
  });

  it('bounds replay to a suffix that always ends at current state', () => {
    const request = Object.assign(new EventEmitter(), {
      headers: { 'last-event-id': 'a'.repeat(40) },
    }) as unknown as IncomingMessage;
    let writableLength = 0;
    const written: string[] = [];
    const destroy = vi.fn();
    const response = Object.assign(new EventEmitter(), {
      destroyed: false,
      writableEnded: false,
      writeHead: vi.fn(),
      flushHeaders: vi.fn(),
      write: vi.fn((frame: string) => {
        written.push(frame);
        writableLength += Buffer.byteLength(frame);
        return true;
      }),
      destroy,
      end: vi.fn(),
    }) as unknown as ServerResponse;
    Object.defineProperty(response, 'writableLength', { get: () => writableLength });

    const states = ['a', 'b', 'c', 'd'].map((character, index) => ({
      ...currentState,
      localTip: character.repeat(40),
      stateVersion: index,
      updateCount: index,
    }));
    currentState = states[0]!;
    const twoFrameBudget =
      Buffer.byteLength(encodeStateEvent(states[2]!)) +
      Buffer.byteLength(encodeStateEvent(states[3]!));
    const boundedHub = new SseHub(() => currentState, {
      heartbeatMs: 60_000,
      maxBufferBytes: twoFrameBudget,
    });
    for (const state of states) {
      currentState = state;
      boundedHub.publish(state);
    }

    boundedHub.attach(request, response);

    expect(written).toHaveLength(2);
    expect(written[0]).toContain(`id: ${'c'.repeat(40)}`);
    expect(written[1]).toContain(`id: ${'d'.repeat(40)}`);
    expect(destroy).not.toHaveBeenCalled();
    boundedHub.close();
  });

  it('keeps a drain-signaling client until the explicit queued-byte ceiling is reached', () => {
    const request = Object.assign(new EventEmitter(), { headers: {} }) as IncomingMessage;
    let writableLength = 0;
    const write = vi.fn((frame: string) => {
      writableLength += Buffer.byteLength(frame);
      return false;
    });
    const destroy = vi.fn();
    const end = vi.fn();
    const response = Object.assign(new EventEmitter(), {
      destroyed: false,
      writableEnded: false,
      writeHead: vi.fn(),
      flushHeaders: vi.fn(),
      write,
      destroy,
      end,
    }) as unknown as ServerResponse;
    Object.defineProperty(response, 'writableLength', { get: () => writableLength });
    const frameBytes = Buffer.byteLength(encodeStateEvent(currentState));
    const boundedHub = new SseHub(() => currentState, {
      heartbeatMs: 60_000,
      maxBufferBytes: frameBytes * 2,
    });

    boundedHub.attach(request, response);
    expect(write).toHaveBeenCalledOnce();
    expect(destroy).not.toHaveBeenCalled();

    currentState = { ...currentState, updateCount: 1 };
    boundedHub.publish(currentState);
    expect(write).toHaveBeenCalledTimes(2);
    expect(destroy).not.toHaveBeenCalled();

    currentState = { ...currentState, updateCount: 2 };
    boundedHub.publish(currentState);
    expect(destroy).toHaveBeenCalledOnce();
    boundedHub.close();
  });

  it('caps aggregate SSE clients before retaining or streaming an excess connection', () => {
    const request = Object.assign(new EventEmitter(), { headers: {} }) as IncomingMessage;
    const acceptedWrite = vi.fn(() => true);
    const accepted = Object.assign(new EventEmitter(), {
      destroyed: false,
      writableEnded: false,
      writableLength: 0,
      writeHead: vi.fn(),
      flushHeaders: vi.fn(),
      write: acceptedWrite,
      destroy: vi.fn(),
      end: vi.fn(),
    }) as unknown as ServerResponse;
    const rejectedWriteHead = vi.fn();
    const rejectedWrite = vi.fn(() => true);
    const rejectedEnd = vi.fn();
    const rejected = Object.assign(new EventEmitter(), {
      destroyed: false,
      writableEnded: false,
      writableLength: 0,
      writeHead: rejectedWriteHead,
      flushHeaders: vi.fn(),
      write: rejectedWrite,
      destroy: vi.fn(),
      end: rejectedEnd,
    }) as unknown as ServerResponse;
    const boundedHub = new SseHub(() => currentState, {
      heartbeatMs: 60_000,
      maxClients: 1,
    });

    boundedHub.attach(request, accepted);
    boundedHub.attach(request, rejected);
    expect(rejectedWriteHead).toHaveBeenCalledWith(
      503,
      expect.objectContaining({ 'retry-after': '1' }),
    );
    expect(rejectedEnd).toHaveBeenCalledOnce();
    expect(rejectedWrite).not.toHaveBeenCalled();

    boundedHub.publish({ ...currentState, stateVersion: 1 });
    expect(acceptedWrite).toHaveBeenCalledTimes(2);
    expect(rejectedWrite).not.toHaveBeenCalled();
    boundedHub.close();
  });

  it('isolates a closed-stream write race to the affected SSE client', () => {
    const request = Object.assign(new EventEmitter(), { headers: {} }) as IncomingMessage;
    const destroy = vi.fn();
    const response = Object.assign(new EventEmitter(), {
      destroyed: false,
      writableEnded: false,
      writableLength: 0,
      writeHead: vi.fn(),
      flushHeaders: vi.fn(),
      write: vi.fn(() => {
        throw new Error('socket closed during write');
      }),
      destroy,
      end: vi.fn(),
    }) as unknown as ServerResponse;
    const boundedHub = new SseHub(() => currentState, { heartbeatMs: 60_000 });

    expect(() => {
      boundedHub.attach(request, response);
    }).not.toThrow();
    expect(destroy).toHaveBeenCalledOnce();
    boundedHub.close();
  });

  it('does not retain a client that closes synchronously during its initial frame', () => {
    const request = Object.assign(new EventEmitter(), { headers: {} }) as IncomingMessage;
    const emitter = new EventEmitter();
    const write = vi.fn(() => {
      emitter.emit('close');
      return true;
    });
    const response = Object.assign(emitter, {
      destroyed: false,
      writableEnded: false,
      writableLength: 0,
      writeHead: vi.fn(),
      flushHeaders: vi.fn(),
      write,
      destroy: vi.fn(),
      end: vi.fn(),
    }) as unknown as ServerResponse;
    const boundedHub = new SseHub(() => currentState, { heartbeatMs: 60_000 });

    boundedHub.attach(request, response);
    boundedHub.publish({ ...currentState, stateVersion: 1 });

    expect(write).toHaveBeenCalledOnce();
    boundedHub.close();
  });

  it('installs cleanup before flushing SSE headers', () => {
    const request = Object.assign(new EventEmitter(), { headers: {} }) as IncomingMessage;
    const write = vi.fn();
    const destroy = vi.fn();
    const response = Object.assign(new EventEmitter(), {
      destroyed: false,
      writableEnded: false,
      writableLength: 0,
      writeHead: vi.fn(),
      flushHeaders: vi.fn(() => {
        response.emit('close');
      }),
      write,
      destroy,
      end: vi.fn(),
    }) as unknown as ServerResponse;
    const boundedHub = new SseHub(() => currentState, { heartbeatMs: 60_000 });

    boundedHub.attach(request, response);
    boundedHub.publish({ ...currentState, stateVersion: currentState.stateVersion + 1 });

    expect(write).not.toHaveBeenCalled();
    expect(destroy).toHaveBeenCalledOnce();
    boundedHub.close();
  });

  it('drops verbose local-change detail before an SSE frame can exceed its byte budget', () => {
    const huge = 'x'.repeat(MAX_SSE_FRAME_BYTES * 2);
    const state: WebState = {
      ...currentState,
      latestChanges: [
        {
          id: 'web-bead',
          internal_id: internalId,
          title: 'Serve me',
          change: 'updated',
          fields: [{ field: 'notes', before: '', after: huge }],
        },
      ],
    };

    const frame = encodeStateEvent(state);
    expect(Buffer.byteLength(frame)).toBeLessThanOrEqual(MAX_SSE_FRAME_BYTES);
    const data = /^data: (.*)$/mu.exec(frame)?.[1];
    expect(data).toBeDefined();
    expect(JSON.parse(data!).latestChanges).toEqual([]);
  });
});
