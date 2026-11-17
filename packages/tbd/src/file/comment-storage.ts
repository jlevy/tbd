/** Create-only filesystem storage for immutable native comment records. */

import { createHash } from 'node:crypto';
import { join } from 'node:path';

import { ZodError } from 'zod';

import type { InternalCommentId } from '../lib/ids.js';
import { validateCommentId } from '../lib/ids.js';
import {
  NATIVE_COMMENT_BODY_MAX_BYTES,
  NativeCommentSchema,
  type NativeComment,
} from '../lib/native-comment.js';
import { formatZodError } from '../utils/zod-error-utils.js';
import {
  BoundedFileError,
  assertRealDirectories,
  decodeUtf8Fatal,
  ensureRealDirectories,
  publishBytesCreateOnly,
  readBoundedRegularFileBytes,
  type CreateOnlyPublicationOptions,
} from './bounded-file.js';
import {
  canonicalizeNativeCommentBody,
  parseNativeComment,
  serializeNativeComment,
} from './comment-parser.js';

/** Maximum complete record allocation, including bounded frontmatter overhead. */
export const NATIVE_COMMENT_FILE_MAX_BYTES = NATIVE_COMMENT_BODY_MAX_BYTES + 8 * 1024;

/** Failure-injection seam for native-comment create-only publication. */
export type NativeCommentPublicationOptions = CreateOnlyPublicationOptions;

/** Outcome of publishing a create-only native comment record. */
export interface PublishNativeCommentResult {
  status: 'created' | 'existing';
  comment: NativeComment;
  path: string;
}

/** An existing immutable identity carries content different from the candidate. */
export class NativeCommentIdConflictError extends Error {
  constructor(
    public readonly commentId: InternalCommentId,
    public readonly preservedPath: string,
    options?: ErrorOptions,
  ) {
    super(
      `Native comment ${commentId} already exists with different immutable content; ` +
        `preserved candidate at ${preservedPath}`,
      options,
    );
    this.name = 'NativeCommentIdConflictError';
  }
}

function assertCommentId(id: string): asserts id is InternalCommentId {
  if (!validateCommentId(id)) {
    throw new Error(`Invalid native comment ID: ${id}`);
  }
}

/** Return the deterministic two-hex-digit fanout for a native comment identity. */
export function commentShard(id: InternalCommentId): string {
  assertCommentId(id);
  // SHA-256 is a stable distribution function here, not an integrity claim. Hashing
  // prevents time-adjacent ULIDs from concentrating in one Git directory.
  return createHash('sha256').update(id).digest('hex').slice(0, 2);
}

/** Return a comment's canonical path under a selected data-sync directory. */
export function getNativeCommentPath(baseDir: string, id: InternalCommentId): string {
  assertCommentId(id);
  return join(baseDir, 'comments', commentShard(id), `${id}.md`);
}

/** Return the content-addressed repair path for a divergent candidate. */
export function getNativeCommentConflictPath(
  baseDir: string,
  id: InternalCommentId,
  canonicalContent: string,
): string {
  assertCommentId(id);
  const digest = createHash('sha256').update(canonicalContent).digest('hex');
  return join(baseDir, 'attic', 'comment-conflicts', id, `${digest}.md`);
}

/** Read and validate a comment, including the file-to-record identity binding. */
export async function readNativeComment(
  baseDir: string,
  id: InternalCommentId,
): Promise<NativeComment> {
  const path = getNativeCommentPath(baseDir, id);
  await assertRealDirectories(baseDir, ['comments', commentShard(id)]);
  const comment = parseNativeComment(await readNativeCommentText(path));
  if (comment.id !== id) {
    throw new Error(`Native comment file ${id}.md contains record ${comment.id}`);
  }
  return comment;
}

function parseCandidate(comment: NativeComment): NativeComment {
  try {
    return NativeCommentSchema.parse({
      ...comment,
      body: canonicalizeNativeCommentBody(comment.body),
    });
  } catch (error) {
    if (error instanceof ZodError) {
      throw new Error(formatZodError(error));
    }
    throw error;
  }
}

async function readNativeCommentFile(path: string): Promise<Uint8Array> {
  try {
    return await readBoundedRegularFileBytes(path, NATIVE_COMMENT_FILE_MAX_BYTES);
  } catch (error) {
    if (!(error instanceof BoundedFileError)) {
      throw error;
    }
    if (error.code === 'not-regular') {
      throw new BoundedFileError(error.code, `Native comment path is not a regular file: ${path}`, {
        cause: error,
      });
    }
    if (error.code === 'too-large') {
      throw new BoundedFileError(
        error.code,
        `Native comment file exceeds ${NATIVE_COMMENT_FILE_MAX_BYTES} bytes: ${path}`,
        { cause: error },
      );
    }
    if (error.code === 'invalid-utf8') {
      throw error;
    }
    throw new BoundedFileError(error.code, `Native comment path changed while opening: ${path}`, {
      cause: error,
    });
  }
}

function decodeNativeCommentFile(bytes: Uint8Array, path: string): string {
  try {
    return decodeUtf8Fatal(bytes, `Native comment file ${path}`);
  } catch (error) {
    if (!(error instanceof BoundedFileError) || error.code !== 'invalid-utf8') {
      throw error;
    }
    throw new BoundedFileError(error.code, `Native comment file is not valid UTF-8: ${path}`, {
      cause: error,
    });
  }
}

async function readNativeCommentText(path: string): Promise<string> {
  return decodeNativeCommentFile(await readNativeCommentFile(path), path);
}

function isInvalidNativeCommentOccupant(error: unknown): boolean {
  return (
    error instanceof BoundedFileError &&
    (error.code === 'not-regular' || error.code === 'too-large' || error.code === 'invalid-utf8')
  );
}

/**
 * Publish an immutable comment without ever replacing an existing identity.
 *
 * The complete canonical bytes are written and closed at a same-filesystem temporary
 * path first. A crash before the hard link can strand only a private temporary name; a
 * crash after it leaves a complete final record. This promises atomic visibility, not
 * arbitrary power-loss durability. The preservation layer removes or quarantines
 * stranded temporary names before any broad Git stage.
 */
export async function publishNativeComment(
  baseDir: string,
  candidate: NativeComment,
  options: NativeCommentPublicationOptions = {},
): Promise<PublishNativeCommentResult> {
  const validCandidate = parseCandidate(candidate);
  const content = serializeNativeComment(validCandidate);
  const contentBytes = Buffer.from(content, 'utf8');
  if (contentBytes.byteLength > NATIVE_COMMENT_FILE_MAX_BYTES) {
    throw new Error(
      `Native comment record is ${contentBytes.byteLength} bytes; maximum is ${NATIVE_COMMENT_FILE_MAX_BYTES}`,
    );
  }
  const canonicalCandidate = parseNativeComment(content);
  const id = canonicalCandidate.id as InternalCommentId;
  const path = getNativeCommentPath(baseDir, id);
  await ensureRealDirectories(baseDir, ['comments', commentShard(id)]);
  const publication = await publishBytesCreateOnly(path, contentBytes, options);

  if (publication.status === 'created') {
    return { status: 'created', comment: canonicalCandidate, path };
  }

  await assertRealDirectories(baseDir, ['comments', commentShard(id)]);
  let existingBytes: Uint8Array | undefined;
  try {
    existingBytes = await readNativeCommentFile(path);
    decodeNativeCommentFile(existingBytes, path);
  } catch (error) {
    if (!isInvalidNativeCommentOccupant(error)) {
      throw error;
    }
  }
  if (existingBytes !== undefined && Buffer.compare(existingBytes, contentBytes) === 0) {
    return { status: 'existing', comment: canonicalCandidate, path };
  }

  // Different, noncanonical, or malformed content is still immutable evidence. Preserve
  // the valid candidate below and let repair tooling decide which record belongs at the
  // canonical path.
  const preservedPath = getNativeCommentConflictPath(baseDir, id, content);
  await ensureRealDirectories(baseDir, ['attic', 'comment-conflicts', id]);
  const preserved = await publishBytesCreateOnly(preservedPath, contentBytes);
  if (preserved.status === 'existing') {
    let preservedBytes: Uint8Array;
    try {
      await assertRealDirectories(baseDir, ['attic', 'comment-conflicts', id]);
      preservedBytes = await readNativeCommentFile(preservedPath);
      decodeNativeCommentFile(preservedBytes, preservedPath);
    } catch (error) {
      throw new Error(`Cannot verify native comment conflict path ${preservedPath}`, {
        cause: error,
      });
    }
    if (Buffer.compare(preservedBytes, contentBytes) !== 0) {
      throw new Error(`Native comment conflict path collision at ${preservedPath}`);
    }
  }
  throw new NativeCommentIdConflictError(id, preservedPath);
}
