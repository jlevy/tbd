/** Contract tests for bounded native-comment filesystem and Git inventories. */

import { execFile } from 'node:child_process';
import { chmod, mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { promisify } from 'node:util';

import { afterEach, describe, expect, it } from 'vitest';

import {
  DataSyncInventoryLimitError,
  assertValidDataSyncInventory,
  buildDataSyncInventory,
  readDataSyncInventoriesFromGitIndex,
  readDataSyncInventoryFromFilesystem,
  readDataSyncInventoryFromGitRef,
  type DataSyncInventory,
  type DataSyncInventoryEntryInput,
} from '../src/file/data-sync-inventory.js';
import { serializeNativeComment } from '../src/file/comment-parser.js';
import { commentShard, getNativeCommentPath } from '../src/file/comment-storage.js';
import { gitSafeEnv } from '../src/lib/git-env.js';
import { asInternalCommentId, type InternalCommentId } from '../src/lib/ids.js';
import type { NativeComment } from '../src/lib/native-comment.js';
import { TEST_ULIDS, subprocessTestTimeout, testId } from './test-helpers.js';

const execFileAsync = promisify(execFile);
const COMMENT_A = asInternalCommentId(`cm-${TEST_ULIDS.ULID_1}`);
const COMMENT_B = asInternalCommentId(`cm-${TEST_ULIDS.ULID_2}`);
const COMMENT_C = asInternalCommentId(`cm-${TEST_ULIDS.ULID_4}`);
const ISSUE_ID = testId(TEST_ULIDS.ULID_5);
const TEST_SOURCE = { kind: 'filesystem', label: 'inventory-test' } as const;

function makeComment(
  id: InternalCommentId,
  body: string,
  overrides: Partial<NativeComment> = {},
): NativeComment {
  return {
    type: 'cm',
    id,
    issue_id: ISSUE_ID,
    author: {
      kind: 'agent',
      display_name: 'inventory-agent',
      agent_id: `agid-${TEST_ULIDS.ULID_3}`,
    },
    created_at: '2026-09-09T12:00:00.000Z',
    body,
    ...overrides,
  };
}

function commentInput(
  comment: NativeComment,
  overrides: Partial<DataSyncInventoryEntryInput> = {},
): DataSyncInventoryEntryInput {
  const bytes = Buffer.from(serializeNativeComment(comment), 'utf8');
  return {
    path: `comments/${commentShard(comment.id as InternalCommentId)}/${comment.id}.md`,
    mode: '100644',
    size: bytes.length,
    bytes,
    ...overrides,
  };
}

function problemCodes(inventory: DataSyncInventory, path: string): string[] {
  return inventory.problems
    .filter((problem) => problem.path === path)
    .map((problem) => problem.code);
}

async function git(repoDir: string, ...args: string[]): Promise<string> {
  const { stdout } = await execFileAsync('git', ['-C', repoDir, ...args], {
    encoding: 'utf8',
    env: gitSafeEnv({ GIT_TERMINAL_PROMPT: '0' }),
  });
  return stdout.trim();
}

async function initializeRepository(repoDir: string): Promise<void> {
  await git(repoDir, 'init', '-b', 'main');
  await git(repoDir, 'config', 'user.name', 'Inventory Test');
  await git(repoDir, 'config', 'user.email', 'inventory@example.com');
  await git(repoDir, 'config', 'commit.gpgsign', 'false');
}

function rawTreeEntry(mode: string, name: string, objectId: string): Buffer {
  return Buffer.concat([Buffer.from(`${mode} ${name}\0`, 'utf8'), Buffer.from(objectId, 'hex')]);
}

async function writeTreeObject(repoDir: string, label: string, bytes: Buffer): Promise<string> {
  const inputPath = join(repoDir, `.tree-object-${label}`);
  await writeFile(inputPath, bytes);
  return git(repoDir, 'hash-object', '-t', 'tree', '-w', inputPath);
}

async function writeCommentFile(
  dataSyncDir: string,
  comment: NativeComment,
  content = serializeNativeComment(comment),
): Promise<string> {
  const path = getNativeCommentPath(dataSyncDir, comment.id as InternalCommentId);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content);
  return path;
}

const cleanupPaths: string[] = [];

afterEach(async () => {
  await Promise.all(
    cleanupPaths.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
});

describe('buildDataSyncInventory', () => {
  it('accepts canonical records and returns deterministic path order', () => {
    const first = commentInput(makeComment(COMMENT_A, 'first'));
    const second = commentInput(makeComment(COMMENT_B, 'second'));

    const forward = buildDataSyncInventory(TEST_SOURCE, [first, second]);
    const reverse = buildDataSyncInventory(TEST_SOURCE, [second, first]);

    expect(Array.from(forward.entriesByPath.keys())).toEqual(
      [...forward.entriesByPath.keys()].sort(),
    );
    expect(Array.from(reverse.entriesByPath.keys())).toEqual(
      Array.from(forward.entriesByPath.keys()),
    );
    expect(forward.entriesByPath.has(first.path)).toBe(true);
    expect(Array.from(forward.commentsById.keys()).sort()).toEqual([COMMENT_A, COMMENT_B].sort());
    expect(forward).toMatchObject({ coverage: 'full-tree', complete: true, problems: [] });
    expect(() => {
      assertValidDataSyncInventory(forward);
    }).not.toThrow();
  });

  it('retains exact invalid bytes and reports path, mode, identity, and canonical failures', () => {
    const canonical = makeComment(COMMENT_A, 'canonical');
    const canonicalBytes = Buffer.from(serializeNativeComment(canonical), 'utf8');
    const wrongShardPath = `comments/00/${COMMENT_A}.md`;
    const executablePath = `comments/${commentShard(COMMENT_B)}/${COMMENT_B}.md`;
    const mismatchPath = `comments/${commentShard(COMMENT_C)}/${COMMENT_C}.md`;
    const crlfPath = `comments/${commentShard(COMMENT_A)}/${COMMENT_A}.md`;
    const mismatchBytes = Buffer.from(serializeNativeComment(makeComment(COMMENT_B, 'mismatch')));
    const crlfBytes = Buffer.from(serializeNativeComment(canonical).replaceAll('\n', '\r\n'));

    const inventory = buildDataSyncInventory(TEST_SOURCE, [
      {
        path: wrongShardPath,
        mode: '100644',
        size: canonicalBytes.length,
        bytes: canonicalBytes,
      },
      commentInput(makeComment(COMMENT_B, 'executable'), {
        path: executablePath,
        mode: '100755',
      }),
      {
        path: mismatchPath,
        mode: '100644',
        size: mismatchBytes.length,
        bytes: mismatchBytes,
      },
      { path: crlfPath, mode: '100644', size: crlfBytes.length, bytes: crlfBytes },
    ]);

    expect(problemCodes(inventory, wrongShardPath)).toContain('wrong-shard');
    expect(problemCodes(inventory, executablePath)).toContain('invalid-mode');
    expect(problemCodes(inventory, mismatchPath)).toContain('filename-id-mismatch');
    expect(inventory.entriesByPath.get(mismatchPath)).toMatchObject({
      pathCommentId: COMMENT_C,
      embeddedCommentId: COMMENT_B,
    });
    expect(problemCodes(inventory, crlfPath)).toContain('noncanonical-bytes');
    expect(inventory.entriesByPath.get(crlfPath)?.bytes).toEqual(crlfBytes);
    expect(inventory.commentsById.size).toBe(0);
    expect(inventory.complete).toBe(true);
  });

  it('reports malformed UTF-8 and bounded records without discarding their entries', () => {
    const invalidPath = `comments/${commentShard(COMMENT_A)}/${COMMENT_A}.md`;
    const oversizedPath = `comments/${commentShard(COMMENT_B)}/${COMMENT_B}.md`;
    const inventory = buildDataSyncInventory(
      TEST_SOURCE,
      [
        { path: invalidPath, mode: '100644', size: 1, bytes: Buffer.from([0xff]) },
        { path: oversizedPath, mode: '100644', size: 9 },
      ],
      { maxRecordBytes: 8, maxTotalBytes: 32 },
    );

    expect(problemCodes(inventory, invalidPath)).toContain('invalid-utf8');
    expect(inventory.entriesByPath.get(invalidPath)?.bytes).toEqual(Buffer.from([0xff]));
    expect(problemCodes(inventory, oversizedPath)).toContain('oversized-record');
    expect(inventory.entriesByPath.has(oversizedPath)).toBe(true);
    expect(inventory.complete).toBe(false);
    expect(() => {
      assertValidDataSyncInventory(inventory);
    }).toThrow(/Invalid native-comment/);
  });

  it('keeps a valid canonical identity while reporting a duplicate misplaced copy', () => {
    const comment = makeComment(COMMENT_A, 'duplicate');
    const canonical = commentInput(comment);
    const duplicate = commentInput(comment, { path: `comments/ff/${COMMENT_A}.md` });

    const inventory = buildDataSyncInventory(TEST_SOURCE, [duplicate, canonical]);

    expect(inventory.commentsById.get(COMMENT_A)?.comment).toEqual(comment);
    expect(problemCodes(inventory, duplicate.path)).toEqual(
      expect.arrayContaining(['duplicate-id', 'wrong-shard']),
    );
  });

  it('retains filename and embedded identity claims when both duplicate valid records', () => {
    const first = makeComment(COMMENT_A, 'first canonical');
    const second = makeComment(COMMENT_B, 'second canonical');
    const wrongShard = commentShard(COMMENT_A) === '00' ? '01' : '00';
    const mismatch = commentInput(second, {
      path: `comments/${wrongShard}/${COMMENT_A}.md`,
    });

    const inventory = buildDataSyncInventory(TEST_SOURCE, [
      commentInput(first),
      commentInput(second),
      mismatch,
    ]);
    const mismatchEntry = inventory.entriesByPath.get(mismatch.path);

    expect(mismatchEntry).toMatchObject({
      pathCommentId: COMMENT_A,
      embeddedCommentId: COMMENT_B,
      problems: expect.arrayContaining(['duplicate-id', 'filename-id-mismatch', 'wrong-shard']),
    });
    expect(Array.from(inventory.commentsById.keys()).sort()).toEqual([COMMENT_A, COMMENT_B].sort());
  });

  it('enforces injectable entry, path, and aggregate limits', () => {
    const input = commentInput(makeComment(COMMENT_A, 'bounded'));

    expect(() => buildDataSyncInventory(TEST_SOURCE, [input], { maxEntries: 1 })).not.toThrow();
    expect(() =>
      buildDataSyncInventory(TEST_SOURCE, [input, commentInput(makeComment(COMMENT_B, 'two'))], {
        maxEntries: 1,
      }),
    ).toThrow(DataSyncInventoryLimitError);
    expect(() =>
      buildDataSyncInventory(TEST_SOURCE, [input], { maxTotalBytes: input.size - 1 }),
    ).toThrow(DataSyncInventoryLimitError);

    const pathBounded = buildDataSyncInventory(TEST_SOURCE, [input], {
      maxPathBytes: Buffer.byteLength(input.path) - 1,
    });
    expect(pathBounded.problems.map((problem) => problem.code)).toContain('invalid-path');
  });

  it('uses a durable placeholder for a quarantine-unsafe filesystem path', () => {
    const rawPath = `comments/${commentShard(COMMENT_A)}/unsafe\\name.md`;
    const input = commentInput(makeComment(COMMENT_A, 'unsafe filesystem path'), {
      path: rawPath,
    });

    const inventory = buildDataSyncInventory(TEST_SOURCE, [input]);
    const [entry] = inventory.entriesByPath.values();

    expect(entry?.path).toMatch(/^<unsafe-data-sync-path:/u);
    expect(entry?.pathBytes).toEqual(Buffer.from(rawPath, 'utf8'));
    expect(entry?.rawPathBase64).toBe(Buffer.from(rawPath, 'utf8').toString('base64'));
    expect(entry?.bytes).toEqual(input.bytes);
    expect(entry?.problems).toContain('invalid-path');
  });
});

describe('readDataSyncInventoryFromFilesystem', () => {
  it('treats a missing comments root as a complete empty legacy inventory', async () => {
    const dataSyncDir = await mkdtemp(join(tmpdir(), 'tbd-inventory-empty-'));
    cleanupPaths.push(dataSyncDir);

    const inventory = await readDataSyncInventoryFromFilesystem(dataSyncDir);

    expect(inventory).toMatchObject({ coverage: 'full-tree', complete: true, problems: [] });
    expect(inventory.entriesByPath.size).toBe(0);
    expect(inventory.commentsById.size).toBe(0);
  });

  it('walks shards deterministically and accepts only canonical files and an empty scaffold', async () => {
    const dataSyncDir = await mkdtemp(join(tmpdir(), 'tbd-inventory-files-'));
    cleanupPaths.push(dataSyncDir);
    await writeCommentFile(dataSyncDir, makeComment(COMMENT_B, 'second'));
    await writeCommentFile(dataSyncDir, makeComment(COMMENT_A, 'first'));
    await writeFile(join(dataSyncDir, 'comments', '.gitkeep'), '');

    const inventory = await readDataSyncInventoryFromFilesystem(dataSyncDir);

    expect(Array.from(inventory.commentsById.keys()).sort()).toEqual([COMMENT_A, COMMENT_B].sort());
    expect(Array.from(inventory.entriesByPath.keys())).toEqual(
      [...inventory.entriesByPath.keys()].sort(),
    );
    expect(inventory.problems).toEqual([]);
  });

  it('retains invalid UTF-8, nested files, and stranded publication temporaries', async () => {
    const dataSyncDir = await mkdtemp(join(tmpdir(), 'tbd-inventory-invalid-'));
    cleanupPaths.push(dataSyncDir);
    const shard = commentShard(COMMENT_A);
    const shardDir = join(dataSyncDir, 'comments', shard);
    await mkdir(join(shardDir, 'nested'), { recursive: true });
    await writeFile(join(shardDir, `${COMMENT_A}.md`), Buffer.from([0xff]));
    await writeFile(
      join(shardDir, 'nested', `${COMMENT_B}.md`),
      serializeNativeComment(makeComment(COMMENT_B, 'nested')),
    );
    const tempName = `.123.${'a'.repeat(24)}.tmp`;
    await writeFile(
      join(shardDir, tempName),
      serializeNativeComment(makeComment(COMMENT_A, 'tmp')),
    );

    const inventory = await readDataSyncInventoryFromFilesystem(dataSyncDir);

    expect(problemCodes(inventory, `comments/${shard}/${COMMENT_A}.md`)).toContain('invalid-utf8');
    expect(problemCodes(inventory, `comments/${shard}/nested/${COMMENT_B}.md`)).toContain(
      'invalid-path',
    );
    expect(problemCodes(inventory, `comments/${shard}/${tempName}`)).toContain('stranded-temp');
    expect(inventory.entriesByPath.get(`comments/${shard}/${COMMENT_A}.md`)?.bytes).toEqual(
      Buffer.from([0xff]),
    );
  });

  it.skipIf(process.platform !== 'linux')(
    'retains exact bytes for a filesystem name that is not valid UTF-8',
    async () => {
      const dataSyncDir = await mkdtemp(join(tmpdir(), 'tbd-inventory-raw-name-'));
      cleanupPaths.push(dataSyncDir);
      const shard = commentShard(COMMENT_A);
      const shardDir = join(dataSyncDir, 'comments', shard);
      await mkdir(shardDir, { recursive: true });
      const rawName = Buffer.from([0xff]);
      const absolutePath = Buffer.concat([Buffer.from(shardDir), Buffer.from('/'), rawName]);
      const bytes = Buffer.from(
        serializeNativeComment(makeComment(COMMENT_A, 'raw filesystem name')),
        'utf8',
      );
      await writeFile(absolutePath, bytes);

      const inventory = await readDataSyncInventoryFromFilesystem(dataSyncDir);
      const entry = Array.from(inventory.entriesByPath.values()).find((candidate) =>
        candidate.path.startsWith('<invalid-utf8-filesystem-path:'),
      );
      const relativePathBytes = Buffer.concat([
        Buffer.from(`comments/${shard}/`, 'ascii'),
        rawName,
      ]);

      expect(entry).toMatchObject({
        rawPathBase64: relativePathBytes.toString('base64'),
        bytes,
        problems: ['invalid-path'],
        embeddedCommentId: COMMENT_A,
      });
      expect(entry?.pathBytes).toEqual(relativePathBytes);
    },
  );

  it.skipIf(process.platform === 'win32')(
    'rejects executable records and symlink shards',
    async () => {
      const dataSyncDir = await mkdtemp(join(tmpdir(), 'tbd-inventory-links-'));
      cleanupPaths.push(dataSyncDir);
      const executable = await writeCommentFile(dataSyncDir, makeComment(COMMENT_A, 'executable'));
      await chmod(executable, 0o755);
      const target = join(dataSyncDir, 'outside');
      await mkdir(target);
      await symlink(target, join(dataSyncDir, 'comments', 'ff'));

      const inventory = await readDataSyncInventoryFromFilesystem(dataSyncDir);

      expect(
        problemCodes(inventory, `comments/${commentShard(COMMENT_A)}/${COMMENT_A}.md`),
      ).toContain('invalid-mode');
      expect(problemCodes(inventory, 'comments/ff')).toEqual(
        expect.arrayContaining(['invalid-path', 'non-regular']),
      );
      expect(inventory.complete).toBe(false);
    },
  );
});

describe('Git inventory adapters', { timeout: subprocessTestTimeout() }, () => {
  it('filters Git tree ancestors and retains a real empty shard', async () => {
    const repoDir = await mkdtemp(join(tmpdir(), 'tbd-inventory-empty-tree-'));
    cleanupPaths.push(repoDir);
    await initializeRepository(repoDir);
    const emptyTree = await writeTreeObject(repoDir, 'empty', Buffer.alloc(0));
    const commentsTree = await writeTreeObject(
      repoDir,
      'comments',
      rawTreeEntry('40000', 'aa', emptyTree),
    );
    const dataSyncTree = await writeTreeObject(
      repoDir,
      'data-sync',
      rawTreeEntry('40000', 'comments', commentsTree),
    );
    const tbdTree = await writeTreeObject(
      repoDir,
      'tbd',
      rawTreeEntry('40000', 'data-sync', dataSyncTree),
    );
    const rootTree = await writeTreeObject(repoDir, 'root', rawTreeEntry('40000', '.tbd', tbdTree));
    const revision = await git(repoDir, 'commit-tree', rootTree, '-m', 'empty comment shard');

    const inventory = await readDataSyncInventoryFromGitRef(repoDir, revision);

    expect(inventory.source).toEqual({ kind: 'git-ref', revision });
    expect(Array.from(inventory.entriesByPath.keys())).toEqual(['comments', 'comments/aa']);
    expect(inventory).toMatchObject({ coverage: 'full-tree', complete: true, problems: [] });
  });

  it('resolves a ref, reads exact raw blobs, and retains invalid names and UTF-8', async () => {
    const repoDir = await mkdtemp(join(tmpdir(), 'tbd-inventory-ref-'));
    cleanupPaths.push(repoDir);
    await initializeRepository(repoDir);
    const dataSyncDir = join(repoDir, '.tbd', 'data-sync');
    await writeCommentFile(dataSyncDir, makeComment(COMMENT_A, 'committed'));
    const invalidUtf8Path = getNativeCommentPath(dataSyncDir, COMMENT_B);
    await mkdir(dirname(invalidUtf8Path), { recursive: true });
    await writeFile(invalidUtf8Path, Buffer.from([0xff, 0xfe]));
    const invalidNamePath = join(dataSyncDir, 'comments', 'invalid-name');
    await writeFile(invalidNamePath, 'retained invalid path');
    const executablePath = await writeCommentFile(dataSyncDir, makeComment(COMMENT_C, 'mode'));
    await git(repoDir, 'add', '.tbd/data-sync/comments');
    await git(repoDir, 'update-index', '--chmod=+x', executablePath.slice(repoDir.length + 1));
    await git(repoDir, 'commit', '-m', 'comment inventory');
    const revision = await git(repoDir, 'rev-parse', 'HEAD');

    const inventory = await readDataSyncInventoryFromGitRef(repoDir, 'HEAD');

    expect(inventory.source).toEqual({ kind: 'git-ref', revision });
    expect(inventory.coverage).toBe('full-tree');
    expect(inventory.commentsById.get(COMMENT_A)?.comment.body).toBe('committed');
    expect(inventory.commentsById.get(COMMENT_A)?.objectId).toMatch(/^[0-9a-f]{40,64}$/);
    const invalidEntry = inventory.entriesByPath.get(
      `comments/${commentShard(COMMENT_B)}/${COMMENT_B}.md`,
    );
    expect(invalidEntry?.bytes).toEqual(Buffer.from([0xff, 0xfe]));
    expect(invalidEntry?.problems).toContain('invalid-utf8');
    expect(inventory.entriesByPath.has('comments/invalid-name')).toBe(true);
    expect(problemCodes(inventory, 'comments/invalid-name')).toContain('invalid-path');
    expect(
      problemCodes(inventory, `comments/${commentShard(COMMENT_C)}/${COMMENT_C}.md`),
    ).toContain('invalid-mode');
  });

  it('ignores local replacement refs when reading committed source bytes', async () => {
    const repoDir = await mkdtemp(join(tmpdir(), 'tbd-inventory-replace-ref-'));
    cleanupPaths.push(repoDir);
    await initializeRepository(repoDir);
    const dataSyncDir = join(repoDir, '.tbd', 'data-sync');
    const relativePath = `.tbd/data-sync/comments/${commentShard(COMMENT_A)}/${COMMENT_A}.md`;
    await writeCommentFile(dataSyncDir, makeComment(COMMENT_A, 'original object'));
    await git(repoDir, 'add', relativePath);
    await git(repoDir, 'commit', '-m', 'original object');
    const originalRevision = await git(repoDir, 'rev-parse', 'HEAD');

    await writeCommentFile(dataSyncDir, makeComment(COMMENT_A, 'replacement object'));
    await git(repoDir, 'add', relativePath);
    await git(repoDir, 'commit', '-m', 'replacement object');
    const replacementRevision = await git(repoDir, 'rev-parse', 'HEAD');
    await git(repoDir, 'replace', originalRevision, replacementRevision);
    expect(await git(repoDir, 'show', `${originalRevision}:${relativePath}`)).toContain(
      'replacement object',
    );

    const inventory = await readDataSyncInventoryFromGitRef(repoDir, originalRevision);

    expect(inventory.source).toEqual({ kind: 'git-ref', revision: originalRevision });
    expect(inventory.commentsById.get(COMMENT_A)?.comment.body).toBe('original object');
  });

  it('retains invalid Git path bytes without decoding replacement characters', async () => {
    const revision = 'a'.repeat(40);
    const objectId = 'b'.repeat(40);
    const bytes = Buffer.from(serializeNativeComment(makeComment(COMMENT_A, 'raw path')), 'utf8');
    const relativePathBytes = Buffer.concat([
      Buffer.from('comments/', 'ascii'),
      Buffer.from([0xff]),
    ]);
    const fullPathBytes = Buffer.concat([
      Buffer.from('.tbd/data-sync/', 'ascii'),
      relativePathBytes,
    ]);
    const listing = Buffer.concat([
      Buffer.from(`100644 blob ${objectId} ${bytes.length}\t`, 'ascii'),
      fullPathBytes,
      Buffer.from([0]),
    ]);

    const inventory = await readDataSyncInventoryFromGitRef('/unused', 'HEAD', {
      dependencies: {
        runGit: (_repoDir, args) =>
          Promise.resolve(
            args[0] === 'rev-parse' ? Buffer.from(`${revision}\n`, 'ascii') : listing,
          ),
        readObjects: () => Promise.resolve(new Map([[objectId, bytes]])),
      },
    });

    const [entry] = inventory.entriesByPath.values();
    expect(entry?.path).toMatch(/^<invalid-utf8-git-path:/u);
    expect(entry?.path).not.toContain('\uFFFD');
    expect(entry?.pathBytes).toEqual(relativePathBytes);
    expect(entry?.rawPathBase64).toBe(relativePathBytes.toString('base64'));
    expect(entry?.bytes).toEqual(bytes);
    expect(entry?.problems).toContain('invalid-path');
  });

  it('uses a durable placeholder for a decoded Git path that quarantine rejects', async () => {
    const revision = 'c'.repeat(40);
    const objectId = 'd'.repeat(40);
    const bytes = Buffer.from(
      serializeNativeComment(makeComment(COMMENT_A, 'unsafe path')),
      'utf8',
    );
    const relativePathBytes = Buffer.from('comments/aa/..\\candidate.md', 'utf8');
    const listing = Buffer.concat([
      Buffer.from(`100644 blob ${objectId} ${bytes.length}\t.tbd/data-sync/`, 'ascii'),
      relativePathBytes,
      Buffer.from([0]),
    ]);

    const inventory = await readDataSyncInventoryFromGitRef('/unused', 'HEAD', {
      dependencies: {
        runGit: (_repoDir, args) =>
          Promise.resolve(
            args[0] === 'rev-parse' ? Buffer.from(`${revision}\n`, 'ascii') : listing,
          ),
        readObjects: () => Promise.resolve(new Map([[objectId, bytes]])),
      },
    });

    const [entry] = inventory.entriesByPath.values();
    expect(entry?.path).toMatch(/^<unsafe-data-sync-path:/u);
    expect(entry?.pathBytes).toEqual(relativePathBytes);
    expect(entry?.rawPathBase64).toBe(relativePathBytes.toString('base64'));
    expect(entry?.bytes).toEqual(bytes);
    expect(entry?.problems).toContain('invalid-path');
  });

  it('includes empty trees so a full-tree inventory can validate every path', async () => {
    const revision = 'e'.repeat(40);
    const treeId = 'f'.repeat(40);
    const calls: string[][] = [];
    const objectRequests: string[][] = [];
    const listing = Buffer.from(
      [
        `040000 tree ${treeId} -\t.tbd/data-sync/comments\0`,
        `040000 tree ${treeId} -\t.tbd/data-sync/comments/zz\0`,
      ].join(''),
      'ascii',
    );

    const inventory = await readDataSyncInventoryFromGitRef('/unused', 'HEAD', {
      dependencies: {
        runGit: (_repoDir, args) => {
          calls.push([...args]);
          return Promise.resolve(
            args[0] === 'rev-parse' ? Buffer.from(`${revision}\n`, 'ascii') : listing,
          );
        },
        readObjects: (_repoDir, objectIds) => {
          objectRequests.push([...objectIds]);
          return Promise.resolve(new Map());
        },
      },
    });

    expect(calls[1]).toEqual(
      expect.arrayContaining(['ls-tree', '-r', '-t', '--full-tree', revision]),
    );
    expect(objectRequests).toEqual([[]]);
    expect(inventory.entriesByPath.get('comments')).toMatchObject({
      mode: '040000',
      problems: [],
    });
    expect(inventory.entriesByPath.get('comments/zz')).toMatchObject({
      mode: '040000',
      problems: ['invalid-path'],
    });
    expect(inventory.complete).toBe(true);
  });

  it('budgets cat-file framing separately from retained payload bytes', async () => {
    const revision = '1'.repeat(40);
    const objectId = '2'.repeat(40);
    const bytes = Buffer.from(
      serializeNativeComment(makeComment(COMMENT_A, 'exact bound')),
      'utf8',
    );
    const path = `.tbd/data-sync/comments/${commentShard(COMMENT_A)}/${COMMENT_A}.md`;
    const listing = Buffer.from(`100644 blob ${objectId} ${bytes.length}\t${path}\0`, 'ascii');
    let batchOutputLimit = 0;

    const inventory = await readDataSyncInventoryFromGitRef('/unused', 'HEAD', {
      limits: { maxRecordBytes: bytes.length, maxTotalBytes: bytes.length },
      dependencies: {
        runGit: (_repoDir, args) =>
          Promise.resolve(
            args[0] === 'rev-parse' ? Buffer.from(`${revision}\n`, 'ascii') : listing,
          ),
        readObjects: (_repoDir, objectIds, options) => {
          expect(objectIds).toEqual([objectId]);
          batchOutputLimit = options?.maxBatchOutputBytes ?? 0;
          return Promise.resolve(new Map([[objectId, bytes]]));
        },
      },
    });

    expect(batchOutputLimit).toBeGreaterThan(bytes.length);
    expect(inventory.commentsById.get(COMMENT_A)?.bytes).toEqual(bytes);
  });

  it('groups a real add/add conflict into independent index stages', async () => {
    const repoDir = await mkdtemp(join(tmpdir(), 'tbd-inventory-index-'));
    cleanupPaths.push(repoDir);
    await initializeRepository(repoDir);
    const dataSyncDir = join(repoDir, '.tbd', 'data-sync');
    await writeCommentFile(dataSyncDir, makeComment(COMMENT_A, 'base record'));
    await writeFile(join(repoDir, 'README.md'), 'base\n');
    await git(repoDir, 'add', '.');
    await git(repoDir, 'commit', '-m', 'base');
    await git(repoDir, 'switch', '-c', 'ours');
    await writeCommentFile(dataSyncDir, makeComment(COMMENT_B, 'ours'));
    await git(repoDir, 'add', '.tbd/data-sync/comments');
    await git(repoDir, 'commit', '-m', 'ours');
    await git(repoDir, 'switch', 'main');
    await git(repoDir, 'switch', '-c', 'theirs');
    await writeCommentFile(dataSyncDir, makeComment(COMMENT_B, 'theirs'));
    await git(repoDir, 'add', '.tbd/data-sync/comments');
    await git(repoDir, 'commit', '-m', 'theirs');
    await git(repoDir, 'switch', 'ours');
    await expect(git(repoDir, 'merge', 'theirs', '--no-edit')).rejects.toThrow();
    const head = await git(repoDir, 'rev-parse', 'HEAD');

    const inventories = await readDataSyncInventoriesFromGitIndex(repoDir);

    expect(inventories.get(0)?.commentsById.get(COMMENT_A)?.comment.body).toBe('base record');
    expect(inventories.get(1)?.commentsById.has(COMMENT_B)).toBe(false);
    expect(inventories.get(2)?.commentsById.get(COMMENT_B)?.comment.body).toBe('ours');
    expect(inventories.get(3)?.commentsById.get(COMMENT_B)?.comment.body).toBe('theirs');
    for (const stage of [0, 1, 2, 3] as const) {
      expect(inventories.get(stage)?.source).toEqual({ kind: 'git-index', stage, head });
      expect(inventories.get(stage)?.coverage).toBe('sparse-paths');
    }
  });

  it('reads an unborn index without inventing HEAD provenance', async () => {
    const repoDir = await mkdtemp(join(tmpdir(), 'tbd-inventory-unborn-'));
    cleanupPaths.push(repoDir);
    await initializeRepository(repoDir);
    const dataSyncDir = join(repoDir, '.tbd', 'data-sync');
    await writeCommentFile(dataSyncDir, makeComment(COMMENT_A, 'unborn'));
    await git(repoDir, 'add', '.tbd/data-sync/comments');

    const inventories = await readDataSyncInventoriesFromGitIndex(repoDir);

    expect(inventories.get(0)?.source).toEqual({ kind: 'git-index', stage: 0 });
    expect(inventories.get(0)?.coverage).toBe('sparse-paths');
    expect(inventories.get(0)?.commentsById.get(COMMENT_A)?.comment.body).toBe('unborn');
    for (const stage of [1, 2, 3] as const) {
      expect(inventories.get(stage)?.source).toEqual({ kind: 'git-index', stage });
      expect(inventories.get(stage)?.coverage).toBe('sparse-paths');
      expect(inventories.get(stage)?.entriesByPath.size).toBe(0);
    }
  });
});
