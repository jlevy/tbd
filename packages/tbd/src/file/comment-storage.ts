/** Create-only filesystem storage for immutable native comment records. */

import { createHash, randomBytes } from 'node:crypto';
import { constants } from 'node:fs';
import { link, lstat, mkdir, open, unlink } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { TextDecoder } from 'node:util';

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
  canonicalizeNativeCommentBody,
  parseNativeComment,
  serializeNativeComment,
} from './comment-parser.js';

/** Maximum complete record allocation, including bounded frontmatter overhead. */
export const NATIVE_COMMENT_FILE_MAX_BYTES = NATIVE_COMMENT_BODY_MAX_BYTES + 8 * 1024;

/** Failure-injection seam for the two atomic publication boundaries. */
export interface NativeCommentPublicationOptions {
  /** @internal Used by failure-boundary tests; production callers should omit it. */
  onPhase?: (
    phase: 'after-temp-open' | 'after-temp-write' | 'after-temp-close' | 'after-link',
    paths: { tempPath: string; finalPath: string },
  ) => void | Promise<void>;
}

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

/** Stored bytes are present but cannot represent a valid bounded native-comment file. */
class InvalidNativeCommentFileError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'InvalidNativeCommentFileError';
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
  const comment = parseNativeComment(await readBoundedRegularFile(path));
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

function hasErrorCode(error: unknown, code: string): boolean {
  return (error as NodeJS.ErrnoException).code === code;
}

function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

interface CreateOnlyBytesResult {
  status: 'created' | 'existing';
}

async function readBoundedRegularFile(path: string): Promise<string> {
  const pathMetadata = await lstat(path);
  if (!pathMetadata.isFile() || pathMetadata.isSymbolicLink()) {
    throw new InvalidNativeCommentFileError(`Native comment path is not a regular file: ${path}`);
  }
  if (pathMetadata.size > NATIVE_COMMENT_FILE_MAX_BYTES) {
    throw new InvalidNativeCommentFileError(
      `Native comment file exceeds ${NATIVE_COMMENT_FILE_MAX_BYTES} bytes: ${path}`,
    );
  }

  const noFollow = process.platform === 'win32' ? 0 : constants.O_NOFOLLOW;
  const handle = await open(path, constants.O_RDONLY | noFollow);
  try {
    const metadata = await handle.stat();
    if (!metadata.isFile()) {
      throw new InvalidNativeCommentFileError(`Native comment path is not a regular file: ${path}`);
    }
    if (metadata.dev !== pathMetadata.dev || metadata.ino !== pathMetadata.ino) {
      throw new Error(`Native comment path changed while opening: ${path}`);
    }
    if (metadata.size > NATIVE_COMMENT_FILE_MAX_BYTES) {
      throw new InvalidNativeCommentFileError(
        `Native comment file exceeds ${NATIVE_COMMENT_FILE_MAX_BYTES} bytes: ${path}`,
      );
    }

    const chunks: Buffer[] = [];
    let total = 0;
    while (true) {
      const remaining = NATIVE_COMMENT_FILE_MAX_BYTES + 1 - total;
      if (remaining <= 0) {
        throw new InvalidNativeCommentFileError(
          `Native comment file exceeds ${NATIVE_COMMENT_FILE_MAX_BYTES} bytes: ${path}`,
        );
      }
      const buffer = Buffer.allocUnsafe(Math.min(8192, remaining));
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, null);
      if (bytesRead === 0) {
        break;
      }
      total += bytesRead;
      if (total > NATIVE_COMMENT_FILE_MAX_BYTES) {
        throw new InvalidNativeCommentFileError(
          `Native comment file exceeds ${NATIVE_COMMENT_FILE_MAX_BYTES} bytes: ${path}`,
        );
      }
      chunks.push(buffer.subarray(0, bytesRead));
    }
    try {
      return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(
        Buffer.concat(chunks, total),
      );
    } catch (error) {
      throw new InvalidNativeCommentFileError(`Native comment file is not valid UTF-8: ${path}`, {
        cause: error,
      });
    }
  } finally {
    await handle.close();
  }
}

async function assertRealDirectories(baseDir: string, segments: readonly string[]): Promise<void> {
  let current = baseDir;
  for (const segment of ['', ...segments]) {
    current = segment === '' ? current : join(current, segment);
    const metadata = await lstat(current);
    if (!metadata.isDirectory() || metadata.isSymbolicLink()) {
      throw new Error(`Native comment storage directory is not a real directory: ${current}`);
    }
  }
}

async function ensureRealDirectories(baseDir: string, segments: readonly string[]): Promise<void> {
  await assertRealDirectories(baseDir, []);
  let current = baseDir;
  for (const segment of segments) {
    current = join(current, segment);
    try {
      await mkdir(current);
    } catch (error) {
      if (!hasErrorCode(error, 'EEXIST')) {
        throw asError(error);
      }
    }
    const metadata = await lstat(current);
    if (!metadata.isDirectory() || metadata.isSymbolicLink()) {
      throw new Error(`Native comment storage directory is not a real directory: ${current}`);
    }
  }
}

/**
 * Make completed bytes visible at a path atomically, without replacement.
 *
 * The temporary and final paths share a filesystem. A hard link is the portable Node
 * primitive whose EEXIST outcome cannot replace another writer's completed file.
 */
async function publishBytesCreateOnly(
  finalPath: string,
  content: string,
  options: NativeCommentPublicationOptions = {},
): Promise<CreateOnlyBytesResult> {
  const parent = dirname(finalPath);
  const suffix = randomBytes(12).toString('hex');
  const tempPath = join(parent, `.${process.pid}.${suffix}.tmp`);
  let tempCreated = false;
  let outcome: CreateOnlyBytesResult | undefined;
  let primaryError: Error | undefined;

  try {
    const handle = await open(tempPath, 'wx', 0o666);
    tempCreated = true;
    let writeError: Error | undefined;
    try {
      await options.onPhase?.('after-temp-open', { tempPath, finalPath });
      await handle.writeFile(content, 'utf8');
      await options.onPhase?.('after-temp-write', { tempPath, finalPath });
    } catch (error) {
      writeError = asError(error);
    }

    try {
      await handle.close();
    } catch (closeError) {
      if (writeError !== undefined) {
        throw new AggregateError(
          [writeError, asError(closeError)],
          `Native comment temporary write and close both failed: ${tempPath}`,
        );
      }
      throw asError(closeError);
    }
    if (writeError !== undefined) {
      throw writeError;
    }

    await options.onPhase?.('after-temp-close', { tempPath, finalPath });
    try {
      await link(tempPath, finalPath);
      outcome = { status: 'created' };
    } catch (error) {
      if (!hasErrorCode(error, 'EEXIST')) {
        throw asError(error);
      }
      outcome = { status: 'existing' };
    }
    if (outcome.status === 'created') {
      await options.onPhase?.('after-link', { tempPath, finalPath });
    }
  } catch (error) {
    primaryError = asError(error);
  }

  if (tempCreated) {
    try {
      await unlink(tempPath);
    } catch (cleanupError) {
      if (!hasErrorCode(cleanupError, 'ENOENT')) {
        if (primaryError !== undefined) {
          throw new AggregateError(
            [primaryError, asError(cleanupError)],
            `Native comment publication and temporary cleanup both failed: ${tempPath}`,
          );
        }
        throw asError(cleanupError);
      }
    }
  }

  if (primaryError !== undefined) {
    throw primaryError;
  }
  if (outcome === undefined) {
    throw new Error(`Native comment publication ended without an outcome: ${finalPath}`);
  }
  return outcome;
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
  const serializedBytes = Buffer.byteLength(content, 'utf8');
  if (serializedBytes > NATIVE_COMMENT_FILE_MAX_BYTES) {
    throw new Error(
      `Native comment record is ${serializedBytes} bytes; maximum is ${NATIVE_COMMENT_FILE_MAX_BYTES}`,
    );
  }
  const canonicalCandidate = parseNativeComment(content);
  const id = canonicalCandidate.id as InternalCommentId;
  const path = getNativeCommentPath(baseDir, id);
  await ensureRealDirectories(baseDir, ['comments', commentShard(id)]);
  const publication = await publishBytesCreateOnly(path, content, options);

  if (publication.status === 'created') {
    return { status: 'created', comment: canonicalCandidate, path };
  }

  await assertRealDirectories(baseDir, ['comments', commentShard(id)]);
  let existingContent: string | undefined;
  try {
    existingContent = await readBoundedRegularFile(path);
  } catch (error) {
    if (!(error instanceof InvalidNativeCommentFileError)) {
      throw asError(error);
    }
  }
  if (existingContent === content) {
    return { status: 'existing', comment: parseNativeComment(existingContent), path };
  }

  // Different, noncanonical, or malformed content is still immutable evidence. Preserve
  // the valid candidate below and let repair tooling decide which record belongs at the
  // canonical path.
  const preservedPath = getNativeCommentConflictPath(baseDir, id, content);
  await ensureRealDirectories(baseDir, ['attic', 'comment-conflicts', id]);
  const preserved = await publishBytesCreateOnly(preservedPath, content);
  if (preserved.status === 'existing') {
    let preservedContent: string;
    try {
      await assertRealDirectories(baseDir, ['attic', 'comment-conflicts', id]);
      preservedContent = await readBoundedRegularFile(preservedPath);
    } catch (error) {
      throw new Error(`Cannot verify native comment conflict path ${preservedPath}`, {
        cause: error,
      });
    }
    if (preservedContent !== content) {
      throw new Error(`Native comment conflict path collision at ${preservedPath}`);
    }
  }
  throw new NativeCommentIdConflictError(id, preservedPath);
}
