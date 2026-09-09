/** Bounded, binary-safe reads of committed Git blobs through `git cat-file --batch`. */

import { spawn } from 'node:child_process';

import { gitSafeEnv } from '../lib/git-env.js';

const DEFAULT_BATCH_SIZE = 128;
const DEFAULT_MAX_OBJECT_BYTES = 128 * 1024;
const DEFAULT_MAX_BATCH_OUTPUT_BYTES = 50 * 1024 * 1024;
const MAX_BATCH_HEADER_BYTES = 256;
const MAX_STDERR_BYTES = 64 * 1024;
const OBJECT_ID = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/u;

/** Test seam for supplying a framed `git cat-file --batch` response. */
export type GitObjectBatchRunner = (
  repoDir: string,
  objectIds: readonly string[],
  maxOutputBytes: number,
) => Promise<Buffer>;

/** Resource limits and the internal process seam for one object-read operation. */
export interface ReadGitObjectBuffersOptions {
  /** Maximum requested objects per Git subprocess. */
  batchSize?: number;
  /** Maximum declared size of any returned blob. */
  maxObjectBytes?: number;
  /** Maximum stdout bytes retained from one Git subprocess. */
  maxBatchOutputBytes?: number;
  /** @internal Test seam; production callers should use the Git subprocess default. */
  runBatch?: GitObjectBatchRunner;
}

function positiveSafeInteger(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError(`${label} must be a positive safe integer, got ${value}`);
  }
  return value;
}

function validateObjectIds(requestedObjectIds: readonly string[]): string[] {
  const objectIds: string[] = [];
  const seen = new Set<string>();
  for (const objectId of requestedObjectIds) {
    if (!OBJECT_ID.test(objectId)) {
      throw new Error(`Invalid Git object ID: ${objectId}`);
    }
    if (!seen.has(objectId)) {
      seen.add(objectId);
      objectIds.push(objectId);
    }
  }
  return objectIds;
}

function responseError(objectId: string, detail?: string): Error {
  return new Error(
    `Invalid git cat-file response for ${objectId}${detail === undefined ? '' : `: ${detail}`}`,
  );
}

function parseBatchResponse(
  objectIds: readonly string[],
  output: Buffer,
  maxObjectBytes: number,
): ReadonlyMap<string, Buffer> {
  const contents = new Map<string, Buffer>();
  let offset = 0;

  for (const objectId of objectIds) {
    if (offset >= output.length) {
      throw new Error(`Missing git cat-file response for ${objectId}`);
    }

    const headerEnd = output.indexOf(0x0a, offset);
    if (headerEnd < 0 || headerEnd - offset > MAX_BATCH_HEADER_BYTES) {
      throw responseError(objectId, 'missing or oversized header');
    }
    const headerBytes = output.subarray(offset, headerEnd);
    if (headerBytes.includes(0x00)) {
      throw responseError(objectId, 'header contains a NUL byte');
    }
    const header = headerBytes.toString('utf8');
    if (header === `${objectId} missing`) {
      throw new Error(`Missing Git object: ${objectId}`);
    }

    const match = /^([0-9a-f]{40}|[0-9a-f]{64}) ([^ ]+) ([0-9]+)$/u.exec(header);
    if (match?.[1] !== objectId) {
      throw responseError(objectId, header);
    }
    if (match[2] !== 'blob') {
      throw new Error(`Git object ${objectId} is ${match[2]}, expected blob`);
    }

    const size = Number(match[3]);
    if (!Number.isSafeInteger(size)) {
      throw responseError(objectId, `invalid object size ${match[3]}`);
    }
    if (size > maxObjectBytes) {
      throw new Error(`Git blob ${objectId} is ${size} bytes; maximum is ${maxObjectBytes}`);
    }

    const contentStart = headerEnd + 1;
    const contentEnd = contentStart + size;
    if (contentEnd >= output.length || output[contentEnd] !== 0x0a) {
      throw new Error(`Truncated git cat-file response for ${objectId}`);
    }
    contents.set(objectId, output.subarray(contentStart, contentEnd));
    offset = contentEnd + 1;
  }

  if (offset !== output.length) {
    throw new Error('Unexpected trailing git cat-file output');
  }
  return contents;
}

async function runGitObjectBatch(
  repoDir: string,
  objectIds: readonly string[],
  maxOutputBytes: number,
): Promise<Buffer> {
  if (objectIds.length === 0) {
    return Buffer.alloc(0);
  }

  return new Promise((resolve, reject) => {
    const child = spawn('git', ['-C', repoDir, 'cat-file', '--batch'], {
      env: gitSafeEnv({
        GIT_NO_REPLACE_OBJECTS: '1',
        GIT_OPTIONAL_LOCKS: '0',
        GIT_TERMINAL_PROMPT: '0',
      }),
      shell: false,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    });
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    let stdoutBytes = 0;
    let stderrBytes = 0;
    let settled = false;

    const fail = (error: Error): void => {
      if (settled) {
        return;
      }
      settled = true;
      reject(error);
    };

    child.stdout.on('data', (chunk: Buffer) => {
      if (settled) {
        return;
      }
      if (chunk.length > maxOutputBytes - stdoutBytes) {
        child.kill();
        fail(new Error(`git cat-file stdout exceeded ${maxOutputBytes} bytes`));
        return;
      }
      stdoutBytes += chunk.length;
      stdoutChunks.push(chunk);
    });
    child.stderr.on('data', (chunk: Buffer) => {
      if (settled) {
        return;
      }
      if (chunk.length > MAX_STDERR_BYTES - stderrBytes) {
        child.kill();
        fail(new Error(`git cat-file stderr exceeded ${MAX_STDERR_BYTES} bytes`));
        return;
      }
      stderrBytes += chunk.length;
      stderrChunks.push(chunk);
    });
    child.on('error', (error) => {
      fail(error);
    });
    child.on('close', (code, signal) => {
      if (settled) {
        return;
      }
      if (code !== 0) {
        const stderr = Buffer.concat(stderrChunks, stderrBytes).toString('utf8').trim();
        const termination = code === null ? ` (signal ${signal ?? 'unknown'})` : ` (exit ${code})`;
        fail(
          new Error(
            `git cat-file --batch failed${termination}${stderr.length > 0 ? `: ${stderr}` : ''}`,
          ),
        );
        return;
      }
      settled = true;
      resolve(Buffer.concat(stdoutChunks, stdoutBytes));
    });
    child.stdin.on('error', (error) => {
      fail(error);
    });
    child.stdin.end(Buffer.from(`${objectIds.join('\n')}\n`, 'ascii'));
  });
}

/** Read Git blobs in bounded subprocess batches while preserving their exact bytes. */
export async function readGitObjectBuffers(
  repoDir: string,
  requestedObjectIds: readonly string[],
  options: ReadGitObjectBuffersOptions = {},
): Promise<ReadonlyMap<string, Buffer>> {
  const objectIds = validateObjectIds(requestedObjectIds);
  const batchSize = positiveSafeInteger(options.batchSize ?? DEFAULT_BATCH_SIZE, 'batchSize');
  const maxObjectBytes = positiveSafeInteger(
    options.maxObjectBytes ?? DEFAULT_MAX_OBJECT_BYTES,
    'maxObjectBytes',
  );
  const maxBatchOutputBytes = positiveSafeInteger(
    options.maxBatchOutputBytes ?? DEFAULT_MAX_BATCH_OUTPUT_BYTES,
    'maxBatchOutputBytes',
  );
  const runBatch = options.runBatch ?? runGitObjectBatch;
  const contents = new Map<string, Buffer>();

  for (let offset = 0; offset < objectIds.length; offset += batchSize) {
    const batch = objectIds.slice(offset, offset + batchSize);
    const output = await runBatch(repoDir, batch, maxBatchOutputBytes);
    if (!Buffer.isBuffer(output)) {
      throw new TypeError('Git object batch runner must return a Buffer');
    }
    if (output.length > maxBatchOutputBytes) {
      throw new Error(`git cat-file stdout exceeded ${maxBatchOutputBytes} bytes`);
    }
    const batchContents = parseBatchResponse(batch, output, maxObjectBytes);
    for (const objectId of batch) {
      const content = batchContents.get(objectId);
      if (content === undefined) {
        throw new Error(`Missing git cat-file response for ${objectId}`);
      }
      contents.set(objectId, content);
    }
  }

  return contents;
}
