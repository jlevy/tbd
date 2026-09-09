/**
 * Native comment records are immutable, independently mergeable sync entities.
 *
 * These tests pin the format before any CLI writer exists. The later f09 activation
 * layer can therefore expose only a storage contract already exercised at its collision
 * and filesystem boundaries.
 */

import {
  access,
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { parseNativeComment, serializeNativeComment } from '../src/file/comment-parser.js';
import {
  NATIVE_COMMENT_FILE_MAX_BYTES,
  NativeCommentIdConflictError,
  commentShard,
  getNativeCommentConflictPath,
  getNativeCommentPath,
  publishNativeComment,
  readNativeComment,
} from '../src/file/comment-storage.js';
import {
  asInternalCommentId,
  generateInternalCommentId,
  validateCommentId,
} from '../src/lib/ids.js';
import {
  NATIVE_COMMENT_BODY_MAX_BYTES,
  NativeCommentSchema,
  type NativeComment,
} from '../src/lib/native-comment.js';
import { TEST_ULIDS, testId } from './test-helpers.js';

const COMMENT_ID = asInternalCommentId(`cm-${TEST_ULIDS.ULID_1}`);
const ISSUE_ID = testId(TEST_ULIDS.ULID_2);

function makeComment(overrides: Partial<NativeComment> = {}): NativeComment {
  return {
    type: 'cm',
    id: COMMENT_ID,
    issue_id: ISSUE_ID,
    author: {
      kind: 'agent',
      display_name: 'codex@worktree',
      agent_id: `agid-${TEST_ULIDS.ULID_3}`,
      provenance: { harness: 'codex', model: 'gpt-test' },
    },
    created_at: '2026-09-08T12:00:00.000Z',
    body: 'The worker has claimed the parser task.',
    ...overrides,
  };
}

describe('native comment IDs', () => {
  it('generates lowercase ULID identities in their own namespace', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateInternalCommentId()));

    expect(ids.size).toBe(100);
    for (const id of ids) {
      expect(id).toMatch(/^cm-[0-7][0-9a-hjkmnp-tv-z]{25}$/);
      expect(validateCommentId(id)).toBe(true);
    }
  });

  it('rejects issue IDs, uppercase IDs, and path-like values', () => {
    expect(validateCommentId(`is-${TEST_ULIDS.ULID_1}`)).toBe(false);
    expect(validateCommentId(COMMENT_ID.toUpperCase())).toBe(false);
    expect(validateCommentId('cm-01llllllllllllllllllllllll')).toBe(false);
    expect(validateCommentId('cm-81aaaaaaaaaaaaaaaaaaaaaaaa')).toBe(false);
    expect(validateCommentId('../../comments/escape')).toBe(false);
  });
});

describe('NativeCommentSchema', () => {
  it('accepts missing reply records but rejects self-replies', () => {
    const missingParent = asInternalCommentId(`cm-${TEST_ULIDS.ULID_4}`);

    expect(NativeCommentSchema.parse(makeComment({ reply_to: missingParent })).reply_to).toBe(
      missingParent,
    );
    expect(() => NativeCommentSchema.parse(makeComment({ reply_to: COMMENT_ID }))).toThrow(
      /cannot reply to itself/,
    );
  });

  it('keeps provider identity out of the allowlisted author snapshot', () => {
    expect(() =>
      NativeCommentSchema.parse({
        ...makeComment(),
        author: {
          kind: 'human',
          display_name: 'A Human',
          provider_user_id: 'linear-user-1',
        },
      }),
    ).toThrow(/provider_user_id/);
  });

  it('allows agent IDs only on agent authors', () => {
    expect(() =>
      NativeCommentSchema.parse({
        ...makeComment(),
        author: {
          kind: 'human',
          display_name: 'A Human',
          agent_id: `agid-${TEST_ULIDS.ULID_3}`,
        },
      }),
    ).toThrow(/agent_id is only valid/);
  });

  it('rejects empty and oversized UTF-8 bodies without truncation', () => {
    expect(() => NativeCommentSchema.parse(makeComment({ body: ' \n\t' }))).toThrow(
      /visible content/,
    );

    const oversized = '\u{1f642}'.repeat(Math.floor(NATIVE_COMMENT_BODY_MAX_BYTES / 4) + 1);
    expect(new TextEncoder().encode(oversized).byteLength).toBeGreaterThan(
      NATIVE_COMMENT_BODY_MAX_BYTES,
    );
    expect(() => NativeCommentSchema.parse(makeComment({ body: oversized }))).toThrow(
      /65536 UTF-8 bytes/,
    );
  });

  it('rejects malformed Unicode before UTF-8 encoding can replace it', () => {
    expect(() => NativeCommentSchema.parse(makeComment({ body: 'broken: \ud800' }))).toThrow(
      /well-formed Unicode/,
    );
    expect(() =>
      NativeCommentSchema.parse({
        ...makeComment(),
        author: { kind: 'human', display_name: 'broken: \udc00' },
      }),
    ).toThrow(/well-formed Unicode/);
  });

  it('applies the byte limit after representation-only body normalization', () => {
    const boundary = 'a'.repeat(NATIVE_COMMENT_BODY_MAX_BYTES) + '\r\n\r\n';

    expect(serializeNativeComment(makeComment({ body: boundary }))).toContain(
      'a'.repeat(NATIVE_COMMENT_BODY_MAX_BYTES),
    );
  });
});

describe('native comment serialization', () => {
  it('round-trips complete Markdown without treating a Notes heading specially', () => {
    const comment = makeComment({
      reply_to: asInternalCommentId(`cm-${TEST_ULIDS.ULID_4}`),
      body: 'First paragraph.\n\n## Notes\n\nThis heading is part of the comment.',
    });

    const serialized = serializeNativeComment(comment);
    const parsed = parseNativeComment(serialized);

    expect(parsed).toEqual(comment);
    expect(serialized).toMatch(/^---\ntype: cm\nid: cm-/);
    expect(serialized.endsWith('\n')).toBe(true);
    expect(serialized.endsWith('\n\n')).toBe(false);
  });

  it('normalizes line endings and terminal blank lines into one canonical record', () => {
    const serialized = serializeNativeComment(
      makeComment({ body: 'one\r\n\r\n    code  \t\r\n \t\r\n\r\n' }),
    );

    expect(parseNativeComment(serialized).body).toBe('one\n\n    code  \t');
    expect(serializeNativeComment(parseNativeComment(serialized))).toBe(serialized);
  });

  it('rejects malformed, unknown, and mismatched record data', () => {
    expect(() => parseNativeComment('body only')).toThrow(/missing front matter/);
    expect(() =>
      parseNativeComment(
        `---\ntype: cm\nid: ${COMMENT_ID}\nissue_id: ${ISSUE_ID}\nunknown: true\nauthor:\n  kind: human\n  display_name: Human\ncreated_at: 2026-09-08T12:00:00.000Z\n---\nBody\n`,
      ),
    ).toThrow(/unknown/);
    expect(() =>
      parseNativeComment(
        `---\ntype: cm\nid: ${COMMENT_ID}\nissue_id: ${ISSUE_ID}\nauthor:\n  kind: human\n  display_name: Human\ncreated_at: 2026-09-08T12:00:00.000Z\nbody: hidden frontmatter body\n---\nVisible body\n`,
      ),
    ).toThrow(/body must be Markdown/);
  });
});

describe('native comment storage', () => {
  let dataSyncDir: string;

  beforeEach(async () => {
    dataSyncDir = await mkdtemp(join(tmpdir(), 'tbd-native-comment-'));
  });

  afterEach(async () => {
    await rm(dataSyncDir, { recursive: true, force: true });
  });

  it('uses deterministic hash fanout instead of the chronological ULID prefix', () => {
    expect(commentShard(COMMENT_ID)).toBe('d1');
    expect(getNativeCommentPath(dataSyncDir, asInternalCommentId(`cm-${TEST_ULIDS.ULID_2}`))).toBe(
      join(dataSyncDir, 'comments', '19', `cm-${TEST_ULIDS.ULID_2}.md`),
    );
  });

  it('publishes a complete record and reads it from its canonical path', async () => {
    const comment = makeComment();

    const result = await publishNativeComment(dataSyncDir, comment);

    expect(result.status).toBe('created');
    expect(result.comment).toEqual(comment);
    expect(result.path).toBe(getNativeCommentPath(dataSyncDir, COMMENT_ID));
    expect(await readNativeComment(dataSyncDir, COMMENT_ID)).toEqual(comment);
  });

  it('rejects an oversized complete record before creating storage paths', async () => {
    const oversizedTimestamp = `2026-09-08T12:00:00.${'1'.repeat(NATIVE_COMMENT_FILE_MAX_BYTES)}Z`;

    await expect(
      publishNativeComment(dataSyncDir, makeComment({ created_at: oversizedTimestamp })),
    ).rejects.toThrow(/record is .* bytes; maximum is 73728/);
    await expect(access(join(dataSyncDir, 'comments'))).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('rejects malformed Unicode before creating storage paths', async () => {
    await expect(
      publishNativeComment(dataSyncDir, makeComment({ body: 'broken: \ud800' })),
    ).rejects.toThrow(/well-formed Unicode/);
    await expect(access(join(dataSyncDir, 'comments'))).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('returns an identical retry and never replaces mismatched content', async () => {
    const original = makeComment();
    await publishNativeComment(dataSyncDir, original);

    await expect(publishNativeComment(dataSyncDir, original)).resolves.toMatchObject({
      status: 'existing',
      comment: original,
    });

    const mismatched = makeComment({ body: 'A different immutable body.' });
    const conflict = await publishNativeComment(dataSyncDir, mismatched).catch(
      (error: unknown) => error,
    );
    expect(conflict).toBeInstanceOf(NativeCommentIdConflictError);
    if (!(conflict instanceof NativeCommentIdConflictError)) {
      throw conflict;
    }
    expect(conflict).toMatchObject({
      commentId: COMMENT_ID,
      preservedPath: expect.stringContaining(join('attic', 'comment-conflicts', COMMENT_ID)),
    });
    await expect(readFile(conflict.preservedPath, 'utf8')).resolves.toBe(
      serializeNativeComment(mismatched),
    );
    await expect(readNativeComment(dataSyncDir, COMMENT_ID)).resolves.toEqual(original);
  });

  it('requires byte-identical canonical content for an existing identity', async () => {
    const candidate = makeComment();
    const path = getNativeCommentPath(dataSyncDir, COMMENT_ID);
    const noncanonical = `${serializeNativeComment(candidate)}\n`;
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, noncanonical);

    const conflict = await publishNativeComment(dataSyncDir, candidate).catch(
      (error: unknown) => error,
    );
    expect(conflict).toBeInstanceOf(NativeCommentIdConflictError);
    if (!(conflict instanceof NativeCommentIdConflictError)) {
      throw conflict;
    }
    await expect(readFile(path, 'utf8')).resolves.toBe(noncanonical);
    await expect(readFile(conflict.preservedPath, 'utf8')).resolves.toBe(
      serializeNativeComment(candidate),
    );
  });

  it('has one creator and one idempotent observer under a concurrent identical retry', async () => {
    const results = await Promise.all([
      publishNativeComment(dataSyncDir, makeComment()),
      publishNativeComment(dataSyncDir, makeComment()),
    ]);

    expect(results.map((result) => result.status).sort()).toEqual(['created', 'existing']);
    await expect(readNativeComment(dataSyncDir, COMMENT_ID)).resolves.toEqual(makeComment());
  });

  it('preserves exactly one complete winner under a concurrent identity conflict', async () => {
    const first = makeComment({ body: 'First candidate.' });
    const second = makeComment({ body: 'Second candidate.' });
    const results = await Promise.allSettled([
      publishNativeComment(dataSyncDir, first),
      publishNativeComment(dataSyncDir, second),
    ]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const rejection = results.find((result) => result.status === 'rejected');
    expect(rejection).toMatchObject({ reason: expect.any(NativeCommentIdConflictError) });
    if (
      rejection?.status !== 'rejected' ||
      !(rejection.reason instanceof NativeCommentIdConflictError)
    ) {
      throw new Error('Expected one native comment identity conflict');
    }
    const winner = await readNativeComment(dataSyncDir, COMMENT_ID);
    const loser = winner.body === first.body ? second : first;
    expect([first, second]).toContainEqual(winner);
    expect(parseNativeComment(await readFile(rejection.reason.preservedPath, 'utf8'))).toEqual(
      loser,
    );

    const shardEntries = await readdir(dirname(getNativeCommentPath(dataSyncDir, COMMENT_ID)));
    expect(shardEntries).toEqual([`${COMMENT_ID}.md`]);
  });

  it('leaves an invalid existing identity untouched and reports a conflict', async () => {
    const path = getNativeCommentPath(dataSyncDir, COMMENT_ID);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, 'not a comment');

    await expect(publishNativeComment(dataSyncDir, makeComment())).rejects.toMatchObject({
      name: 'NativeCommentIdConflictError',
      commentId: COMMENT_ID,
    });
    await expect(readFile(path, 'utf8')).resolves.toBe('not a comment');
  });

  it('preserves a valid candidate when the existing identity exceeds the read bound', async () => {
    const path = getNativeCommentPath(dataSyncDir, COMMENT_ID);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, 'x'.repeat(NATIVE_COMMENT_FILE_MAX_BYTES + 1));

    const conflict = await publishNativeComment(dataSyncDir, makeComment()).catch(
      (error: unknown) => error,
    );
    expect(conflict).toBeInstanceOf(NativeCommentIdConflictError);
    if (!(conflict instanceof NativeCommentIdConflictError)) {
      throw conflict;
    }
    await expect(readFile(conflict.preservedPath, 'utf8')).resolves.toBe(
      serializeNativeComment(makeComment()),
    );
    await expect(readFile(path, 'utf8')).resolves.toHaveLength(NATIVE_COMMENT_FILE_MAX_BYTES + 1);
  });

  it('rejects a record file larger than the bounded allocation', async () => {
    const path = getNativeCommentPath(dataSyncDir, COMMENT_ID);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, 'x'.repeat(NATIVE_COMMENT_FILE_MAX_BYTES + 1));

    await expect(readNativeComment(dataSyncDir, COMMENT_ID)).rejects.toThrow(
      new RegExp(`exceeds ${NATIVE_COMMENT_FILE_MAX_BYTES} bytes`),
    );
  });

  it('rejects invalid UTF-8 instead of normalizing replacement characters', async () => {
    const path = getNativeCommentPath(dataSyncDir, COMMENT_ID);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, Buffer.from([0xff]));

    await expect(readNativeComment(dataSyncDir, COMMENT_ID)).rejects.toThrow(/not valid UTF-8/);
  });

  it('validates IDs before constructing filesystem paths', async () => {
    await expect(
      readNativeComment(dataSyncDir, '../../outside' as ReturnType<typeof asInternalCommentId>),
    ).rejects.toThrow(/Invalid native comment ID/);
  });

  it('never exposes a final path when publication stops before the hard link', async () => {
    const finalPath = getNativeCommentPath(dataSyncDir, COMMENT_ID);

    await expect(
      publishNativeComment(dataSyncDir, makeComment(), {
        onPhase: (phase) => {
          if (phase === 'after-temp-close') {
            throw new Error('injected before link');
          }
        },
      }),
    ).rejects.toThrow('injected before link');
    await expect(access(finalPath)).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(readdir(dirname(finalPath))).resolves.toEqual([]);
  });

  it('leaves a complete retryable record when cleanup starts after the link', async () => {
    await expect(
      publishNativeComment(dataSyncDir, makeComment(), {
        onPhase: (phase) => {
          if (phase === 'after-link') {
            throw new Error('injected after link');
          }
        },
      }),
    ).rejects.toThrow('injected after link');

    await expect(readNativeComment(dataSyncDir, COMMENT_ID)).resolves.toEqual(makeComment());
    await expect(publishNativeComment(dataSyncDir, makeComment())).resolves.toMatchObject({
      status: 'existing',
    });
    await expect(readdir(dirname(getNativeCommentPath(dataSyncDir, COMMENT_ID)))).resolves.toEqual([
      `${COMMENT_ID}.md`,
    ]);
  });

  it('removes its private temporary file when work fails after the write', async () => {
    const finalPath = getNativeCommentPath(dataSyncDir, COMMENT_ID);
    let tempPath = '';

    await expect(
      publishNativeComment(dataSyncDir, makeComment(), {
        onPhase: (phase, paths) => {
          if (phase === 'after-temp-write') {
            tempPath = paths.tempPath;
            throw new Error('injected after write');
          }
        },
      }),
    ).rejects.toThrow('injected after write');

    expect(tempPath).not.toBe('');
    await expect(access(tempPath)).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(access(finalPath)).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(readdir(dirname(finalPath))).resolves.toEqual([]);
  });

  it('does not accept BOM-prefixed bytes at a content-addressed repair path', async () => {
    const original = makeComment();
    const candidate = makeComment({ body: 'Conflicting candidate.' });
    const content = serializeNativeComment(candidate);
    const preservedPath = getNativeCommentConflictPath(dataSyncDir, COMMENT_ID, content);
    await publishNativeComment(dataSyncDir, original);
    await mkdir(dirname(preservedPath), { recursive: true });
    await writeFile(preservedPath, `\uFEFF${content}`);

    await expect(publishNativeComment(dataSyncDir, candidate)).rejects.toThrow(
      /conflict path collision/,
    );
    await expect(readFile(preservedPath, 'utf8')).resolves.toBe(`\uFEFF${content}`);
  });

  it.skipIf(process.platform === 'win32')(
    'rejects symlink files and shard directories',
    async () => {
      const outside = join(dataSyncDir, 'outside.md');
      const finalPath = getNativeCommentPath(dataSyncDir, COMMENT_ID);
      await mkdir(dirname(finalPath), { recursive: true });
      await writeFile(outside, serializeNativeComment(makeComment()));
      await symlink(outside, finalPath);

      await expect(readNativeComment(dataSyncDir, COMMENT_ID)).rejects.toThrow(
        /not a regular file/,
      );
      await rm(finalPath);
      await rm(dirname(finalPath), { recursive: true });
      await symlink(dirname(outside), dirname(finalPath));
      await writeFile(join(dataSyncDir, `${COMMENT_ID}.md`), serializeNativeComment(makeComment()));
      await expect(readNativeComment(dataSyncDir, COMMENT_ID)).rejects.toThrow(
        /not a real directory/,
      );
      await expect(publishNativeComment(dataSyncDir, makeComment())).rejects.toThrow(
        /not a real directory/,
      );
    },
  );
});
