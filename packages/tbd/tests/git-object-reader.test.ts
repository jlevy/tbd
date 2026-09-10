import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { readGitObjectBuffers, type GitObjectBatchRunner } from '../src/file/git-object-reader.js';

const execFileAsync = promisify(execFile);
const cleanupPaths: string[] = [];
const OBJECT_A = 'a'.repeat(40);
const OBJECT_B = 'b'.repeat(40);
const OBJECT_C = 'c'.repeat(40);
const OBJECT_SHA256 = 'd'.repeat(64);

function response(
  objectId: string,
  body: Buffer,
  options: { type?: string; declaredSize?: number } = {},
): Buffer {
  const type = options.type ?? 'blob';
  const size = options.declaredSize ?? body.length;
  return Buffer.concat([
    Buffer.from(`${objectId} ${type} ${size}\n`, 'ascii'),
    body,
    Buffer.from('\n'),
  ]);
}

function responsesFor(objectIds: readonly string[]): Buffer {
  return Buffer.concat(objectIds.map((objectId) => response(objectId, Buffer.from(objectId[0]!))));
}

async function git(repoDir: string, ...args: string[]): Promise<string> {
  const { stdout } = await execFileAsync('git', args, { cwd: repoDir, encoding: 'utf8' });
  return stdout.trim();
}

afterEach(async () => {
  await Promise.all(
    cleanupPaths.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
});

describe('readGitObjectBuffers', () => {
  it('deduplicates in first-seen order and reads configured batches', async () => {
    const calls: string[][] = [];
    const runBatch: GitObjectBatchRunner = (repoDir, objectIds, maxOutputBytes) => {
      expect(repoDir).toBe('/repo');
      expect(maxOutputBytes).toBe(4096);
      calls.push([...objectIds]);
      return Promise.resolve(responsesFor(objectIds));
    };

    const result = await readGitObjectBuffers('/repo', [OBJECT_A, OBJECT_B, OBJECT_A, OBJECT_C], {
      batchSize: 2,
      maxBatchOutputBytes: 4096,
      runBatch,
    });

    expect(calls).toEqual([[OBJECT_A, OBJECT_B], [OBJECT_C]]);
    expect([...result.keys()]).toEqual([OBJECT_A, OBJECT_B, OBJECT_C]);
    expect([...result.values()].map((body) => body.toString('ascii'))).toEqual(['a', 'b', 'c']);
  });

  it('accepts full SHA-256 object IDs', async () => {
    const result = await readGitObjectBuffers('/repo', [OBJECT_SHA256], {
      runBatch: (_repoDir, objectIds) => Promise.resolve(responsesFor(objectIds)),
    });

    expect(result.get(OBJECT_SHA256)?.toString('ascii')).toBe('d');
  });

  it.each([
    'a'.repeat(39),
    'a'.repeat(41),
    'a'.repeat(63),
    'a'.repeat(65),
    'A'.repeat(40),
    `${'a'.repeat(39)}g`,
  ])('rejects invalid object ID %s', async (objectId) => {
    const runBatch = vi.fn<GitObjectBatchRunner>();

    await expect(readGitObjectBuffers('/repo', [objectId], { runBatch })).rejects.toThrow(
      'Invalid Git object ID',
    );
    expect(runBatch).not.toHaveBeenCalled();
  });

  it.each([
    { name: 'batchSize' as const, value: 0 },
    { name: 'batchSize' as const, value: 1.5 },
    { name: 'maxObjectBytes' as const, value: 0 },
    { name: 'maxObjectBytes' as const, value: Number.POSITIVE_INFINITY },
    { name: 'maxBatchOutputBytes' as const, value: -1 },
  ])('rejects invalid $name limit $value', async ({ name, value }) => {
    await expect(readGitObjectBuffers('/repo', [], { [name]: value })).rejects.toThrow(
      'positive safe integer',
    );
  });

  it('returns an empty map without spawning for an empty request', async () => {
    const runBatch = vi.fn<GitObjectBatchRunner>();

    const result = await readGitObjectBuffers('/repo', [], { runBatch });

    expect(result.size).toBe(0);
    expect(runBatch).not.toHaveBeenCalled();
  });

  it('rejects missing and non-blob responses', async () => {
    await expect(
      readGitObjectBuffers('/repo', [OBJECT_A], {
        runBatch: () => Promise.resolve(Buffer.from(`${OBJECT_A} missing\n`, 'ascii')),
      }),
    ).rejects.toThrow(`Missing Git object: ${OBJECT_A}`);

    await expect(
      readGitObjectBuffers('/repo', [OBJECT_A], {
        runBatch: () => Promise.resolve(response(OBJECT_A, Buffer.alloc(0), { type: 'tree' })),
      }),
    ).rejects.toThrow(`Git object ${OBJECT_A} is tree, expected blob`);
  });

  it('rejects a response whose object identity differs from the request', async () => {
    await expect(
      readGitObjectBuffers('/repo', [OBJECT_A], {
        runBatch: () => Promise.resolve(response(OBJECT_B, Buffer.from('body'))),
      }),
    ).rejects.toThrow(`Invalid git cat-file response for ${OBJECT_A}`);
  });

  it('enforces the declared per-object byte limit before accepting content', async () => {
    await expect(
      readGitObjectBuffers('/repo', [OBJECT_A], {
        maxObjectBytes: 3,
        runBatch: () => Promise.resolve(response(OBJECT_A, Buffer.from('four'))),
      }),
    ).rejects.toThrow(`Git blob ${OBJECT_A} is 4 bytes; maximum is 3`);
  });

  it('rejects truncated object content and a missing result entry', async () => {
    const truncated = Buffer.concat([
      Buffer.from(`${OBJECT_A} blob 4\n`, 'ascii'),
      Buffer.from('abc'),
    ]);
    await expect(
      readGitObjectBuffers('/repo', [OBJECT_A], { runBatch: () => Promise.resolve(truncated) }),
    ).rejects.toThrow(`Truncated git cat-file response for ${OBJECT_A}`);

    await expect(
      readGitObjectBuffers('/repo', [OBJECT_A, OBJECT_B], {
        runBatch: () => Promise.resolve(response(OBJECT_A, Buffer.from('a'))),
      }),
    ).rejects.toThrow(`Missing git cat-file response for ${OBJECT_B}`);
  });

  it('rejects missing delimiters and trailing responses', async () => {
    const missingDelimiter = Buffer.concat([
      Buffer.from(`${OBJECT_A} blob 3\n`, 'ascii'),
      Buffer.from('abc'),
    ]);
    await expect(
      readGitObjectBuffers('/repo', [OBJECT_A], {
        runBatch: () => Promise.resolve(missingDelimiter),
      }),
    ).rejects.toThrow(`Truncated git cat-file response for ${OBJECT_A}`);

    await expect(
      readGitObjectBuffers('/repo', [OBJECT_A], {
        runBatch: () =>
          Promise.resolve(Buffer.concat([response(OBJECT_A, Buffer.from('a')), Buffer.from('x')])),
      }),
    ).rejects.toThrow('Unexpected trailing git cat-file output');
  });

  it('enforces the batch stdout allocation bound on injected runners', async () => {
    await expect(
      readGitObjectBuffers('/repo', [OBJECT_A], {
        maxBatchOutputBytes: 8,
        runBatch: () => Promise.resolve(Buffer.alloc(9)),
      }),
    ).rejects.toThrow('git cat-file stdout exceeded 8 bytes');
  });

  it('preserves invalid UTF-8 bytes from a real Git object', async () => {
    const repoDir = await mkdtemp(join(tmpdir(), 'tbd-git-object-reader-'));
    cleanupPaths.push(repoDir);
    await git(repoDir, 'init', '--quiet');
    const raw = Buffer.from([0x00, 0x66, 0x80, 0xff, 0x0a]);
    await writeFile(join(repoDir, 'invalid.bin'), raw);
    const objectId = await git(repoDir, 'hash-object', '-w', 'invalid.bin');

    const result = await readGitObjectBuffers(repoDir, [objectId], { maxObjectBytes: raw.length });

    expect(result.get(objectId)).toEqual(raw);
  });
});
