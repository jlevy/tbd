/** Read-only loopback HTTP router and bounded resumable SSE transport. */

import type { IncomingMessage, ServerResponse } from 'node:http';

import type { BoardState, WebState } from './board.js';

// Stay below Node's common 64 KiB writable high-water mark so a healthy client does
// not get classified as backpressured merely because one frame was large.
export const MAX_SSE_FRAME_BYTES = 48 * 1024;
const MAX_SSE_BUFFER_BYTES = 1024 * 1024;
const DEFAULT_HEARTBEAT_MS = 20_000;
const DEFAULT_HISTORY_ENTRIES = 64;
const DEFAULT_HISTORY_BYTES = 4 * 1024 * 1024;
const COMMIT_ID = /^[0-9a-f]{40,64}$/u;

const SECURITY_HEADERS = {
  'cache-control': 'no-store',
  'content-security-policy':
    "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; " +
    "connect-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'none'; " +
    "frame-ancestors 'none'",
  'cross-origin-resource-policy': 'same-origin',
  'referrer-policy': 'no-referrer',
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
} as const;

interface StateFrame {
  id: string;
  frame: string;
  bytes: number;
}

export interface SseHubOptions {
  heartbeatMs?: number;
  maxHistoryEntries?: number;
  maxHistoryBytes?: number;
  maxBufferBytes?: number;
}

export interface WebRequestHandlerOptions {
  page: string;
  board: BoardState;
  getState: () => WebState;
  events: SseHub;
}

function eventId(state: WebState): string | null {
  return state.watchSince !== null && COMMIT_ID.test(state.watchSince) ? state.watchSince : null;
}

function formatStateFrame(state: WebState): string {
  const id = eventId(state);
  return `${id === null ? '' : `id: ${id}\n`}event: state\ndata: ${JSON.stringify(state)}\n\n`;
}

/**
 * Encode one state document without allowing a detailed change report or diagnostics
 * history to make an unbounded EventSource frame. Board data is always re-fetched.
 */
export function encodeStateEvent(state: WebState): string {
  let candidate = state;
  let frame = formatStateFrame(candidate);
  if (Buffer.byteLength(frame) <= MAX_SSE_FRAME_BYTES) {
    return frame;
  }

  candidate = { ...state, lastReport: null, log: state.log.slice(0, 20) };
  frame = formatStateFrame(candidate);
  if (Buffer.byteLength(frame) <= MAX_SSE_FRAME_BYTES) {
    return frame;
  }

  candidate = {
    ...candidate,
    changedIds: candidate.changedIds.slice(0, 1_000),
    movedIds: candidate.movedIds.slice(0, 1_000),
    removedIds: candidate.removedIds.slice(0, 1_000),
  };
  frame = formatStateFrame(candidate);
  if (Buffer.byteLength(frame) <= MAX_SSE_FRAME_BYTES) {
    return frame;
  }

  candidate = {
    ...candidate,
    changedIds: [],
    movedIds: [],
    removedIds: [],
    log: [],
    watchError: candidate.watchError?.slice(0, 2_048) ?? null,
    repoStatus:
      candidate.repoStatus === null
        ? null
        : { ...candidate.repoStatus, workspaces: candidate.repoStatus.workspaces.slice(0, 100) },
  };
  frame = formatStateFrame(candidate);
  if (Buffer.byteLength(frame) > MAX_SSE_FRAME_BYTES) {
    throw new Error('Unable to encode web state inside the SSE frame budget');
  }
  return frame;
}

/** Small replay ring keyed by the domain cursor (`IssueChangesReport.tip`). */
export class SseHub {
  private readonly clients = new Set<ServerResponse>();
  private readonly history: StateFrame[] = [];
  private readonly heartbeatTimer: NodeJS.Timeout;
  private readonly maxHistoryEntries: number;
  private readonly maxHistoryBytes: number;
  private readonly maxBufferBytes: number;
  private historyBytes = 0;

  constructor(
    private readonly getState: () => WebState,
    options: SseHubOptions = {},
  ) {
    this.maxHistoryEntries = options.maxHistoryEntries ?? DEFAULT_HISTORY_ENTRIES;
    this.maxHistoryBytes = options.maxHistoryBytes ?? DEFAULT_HISTORY_BYTES;
    this.maxBufferBytes = options.maxBufferBytes ?? MAX_SSE_BUFFER_BYTES;
    this.heartbeatTimer = setInterval(() => {
      this.broadcastFrame(': keep-alive\n\n');
    }, options.heartbeatMs ?? DEFAULT_HEARTBEAT_MS);
    this.heartbeatTimer.unref();
  }

  publish(state: WebState): void {
    const frame = encodeStateEvent(state);
    const id = eventId(state);
    if (id !== null) {
      this.remember({ id, frame, bytes: Buffer.byteLength(frame) });
    }
    this.broadcastFrame(frame);
  }

  attach(request: IncomingMessage, response: ServerResponse, resumeEventId?: string): void {
    response.writeHead(200, {
      ...SECURITY_HEADERS,
      'content-type': 'text/event-stream; charset=utf-8',
      connection: 'keep-alive',
      'x-accel-buffering': 'no',
    });
    response.flushHeaders();

    const lastHeader = request.headers['last-event-id'];
    const lastEventId = (Array.isArray(lastHeader) ? lastHeader[0] : lastHeader) ?? resumeEventId;
    const replay = this.framesAfter(lastEventId);
    let frames = replay;
    if (frames.length === 0) {
      const currentState = this.getState();
      const currentFrame = encodeStateEvent(currentState);
      const currentId = eventId(currentState);
      if (currentId !== null) {
        this.remember({
          id: currentId,
          frame: currentFrame,
          bytes: Buffer.byteLength(currentFrame),
        });
      }
      frames = [currentFrame];
    }
    for (const frame of frames) {
      if (!this.write(response, frame)) {
        return;
      }
    }

    this.clients.add(response);
    request.once('close', () => {
      this.clients.delete(response);
    });
  }

  close(): void {
    clearInterval(this.heartbeatTimer);
    for (const client of this.clients) {
      client.end();
    }
    this.clients.clear();
    this.history.length = 0;
    this.historyBytes = 0;
  }

  private framesAfter(lastEventId: string | undefined): string[] {
    if (lastEventId === undefined || !COMMIT_ID.test(lastEventId)) {
      return [];
    }
    const index = this.history.findIndex((entry) => entry.id === lastEventId);
    return index < 0 ? [] : this.history.slice(index + 1).map((entry) => entry.frame);
  }

  private remember(next: StateFrame): void {
    const previous = this.history.at(-1);
    if (previous?.id === next.id) {
      this.historyBytes -= previous.bytes;
      this.history[this.history.length - 1] = next;
      this.historyBytes += next.bytes;
    } else {
      this.history.push(next);
      this.historyBytes += next.bytes;
    }
    while (
      this.history.length > this.maxHistoryEntries ||
      this.historyBytes > this.maxHistoryBytes
    ) {
      const removed = this.history.shift();
      if (removed !== undefined) {
        this.historyBytes -= removed.bytes;
      }
    }
  }

  private broadcastFrame(frame: string): void {
    for (const client of this.clients) {
      this.write(client, frame);
    }
  }

  private write(response: ServerResponse, frame: string): boolean {
    if (response.destroyed || response.writableLength > this.maxBufferBytes) {
      this.drop(response);
      return false;
    }
    if (!response.write(frame)) {
      this.drop(response);
      return false;
    }
    return true;
  }

  private drop(response: ServerResponse): void {
    this.clients.delete(response);
    response.destroy();
  }
}

function trustedRequestOrigin(request: IncomingMessage): boolean {
  const host = request.headers.host;
  if (host === undefined) {
    return false;
  }

  let requestOrigin: URL;
  try {
    requestOrigin = new URL(`http://${host}`);
  } catch {
    return false;
  }
  if (
    requestOrigin.username !== '' ||
    requestOrigin.password !== '' ||
    requestOrigin.pathname !== '/' ||
    requestOrigin.search !== '' ||
    requestOrigin.hash !== ''
  ) {
    return false;
  }
  if (
    requestOrigin.hostname !== '127.0.0.1' &&
    requestOrigin.hostname !== 'localhost' &&
    requestOrigin.hostname !== '[::1]'
  ) {
    return false;
  }

  const originHeader = request.headers.origin;
  if (originHeader === undefined) {
    return true;
  }
  try {
    return new URL(originHeader).origin === requestOrigin.origin;
  } catch {
    return false;
  }
}

export function sendJson(response: ServerResponse, status: number, payload: unknown): void {
  response.writeHead(status, {
    ...SECURITY_HEADERS,
    'content-type': 'application/json; charset=utf-8',
  });
  response.end(JSON.stringify(payload));
}

/** Build the GET-only application router. No mutation route exists by construction. */
export function createWebRequestHandler(
  options: WebRequestHandlerOptions,
): (request: IncomingMessage, response: ServerResponse) => void {
  return (request, response) => {
    if (!trustedRequestOrigin(request)) {
      sendJson(response, 403, { error: 'Cross-origin and non-loopback requests are refused' });
      return;
    }

    let url: URL;
    try {
      url = new URL(request.url ?? '/', 'http://127.0.0.1');
    } catch {
      sendJson(response, 400, { error: 'Invalid request URL' });
      return;
    }

    try {
      if (request.method === 'GET' && url.pathname === '/') {
        response.writeHead(200, {
          ...SECURITY_HEADERS,
          'content-type': 'text/html; charset=utf-8',
        });
        response.end(options.page);
        return;
      }
      if (request.method === 'GET' && url.pathname === '/api/board') {
        sendJson(
          response,
          200,
          options.board.buildBoardResponse(url.searchParams, options.getState()),
        );
        return;
      }
      if (request.method === 'GET' && url.pathname === '/api/bead') {
        const id = url.searchParams.get('id') ?? '';
        const result = options.board.getBead(id);
        if (result.kind === 'invalid') {
          sendJson(response, 400, { error: 'Invalid bead id' });
        } else if (result.kind === 'not-found') {
          sendJson(response, 404, { error: `Unknown bead ${id}` });
        } else {
          sendJson(response, 200, result.body);
        }
        return;
      }
      if (request.method === 'GET' && url.pathname === '/api/events') {
        options.events.attach(request, response, url.searchParams.get('lastEventId') ?? undefined);
        return;
      }
      request.resume();
      sendJson(response, 404, { error: 'Not found' });
    } catch (error) {
      if (response.headersSent) {
        response.destroy();
        return;
      }
      sendJson(response, 500, {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };
}
