/** Bounded regular-file reads and atomic create-only byte publication. */

import { randomBytes } from 'node:crypto';
import { constants } from 'node:fs';
import { link, lstat, mkdir, open, unlink } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { TextDecoder } from 'node:util';

const READ_CHUNK_BYTES = 8 * 1024;
const TEMPORARY_SUFFIX_BYTES = 12;

/** Stable failure categories for bounded filesystem validation. */
type BoundedFileErrorCode = 'not-regular' | 'too-large' | 'invalid-utf8' | 'changed-during-open';

/** A path or byte sequence failed a bounded-file invariant. */
export class BoundedFileError extends Error {
  constructor(
    public readonly code: BoundedFileErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'BoundedFileError';
  }
}

/** Observable boundaries in create-only byte publication. */
export type CreateOnlyPublicationPhase =
  | 'after-temp-open'
  | 'after-temp-write'
  | 'after-temp-close'
  | 'after-link';

/** Failure-injection options for create-only byte publication. */
export interface CreateOnlyPublicationOptions {
  /** @internal Used by failure-boundary tests; production callers should omit it. */
  onPhase?: (
    phase: CreateOnlyPublicationPhase,
    paths: { tempPath: string; finalPath: string },
  ) => void | Promise<void>;
}

interface CreateOnlyBytesResult {
  status: 'created' | 'existing';
}

function hasErrorCode(error: unknown, code: string): boolean {
  return error instanceof Error && (error as NodeJS.ErrnoException).code === code;
}

function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

function displayPath(path: string | Buffer): string {
  return typeof path === 'string' ? path : `<raw-filesystem-path:${path.toString('hex')}>`;
}

/** Read one stable regular-file inode without accepting more than the configured bound. */
export async function readBoundedRegularFileBytes(
  path: string | Buffer,
  maxBytes: number,
): Promise<Uint8Array> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 0) {
    throw new RangeError(`maxBytes must be a nonnegative safe integer, got ${maxBytes}`);
  }
  const pathLabel = displayPath(path);
  const maximum = BigInt(maxBytes);
  const pathMetadata = await lstat(path, { bigint: true });
  if (!pathMetadata.isFile() || pathMetadata.isSymbolicLink()) {
    throw new BoundedFileError('not-regular', `Path is not a regular file: ${pathLabel}`);
  }
  if (pathMetadata.size > maximum) {
    throw new BoundedFileError('too-large', `File exceeds ${maxBytes} bytes: ${pathLabel}`);
  }

  const noFollow = process.platform === 'win32' ? 0 : constants.O_NOFOLLOW;
  const handle = await open(path, constants.O_RDONLY | noFollow);
  try {
    const metadata = await handle.stat({ bigint: true });
    if (!metadata.isFile()) {
      throw new BoundedFileError('not-regular', `Path is not a regular file: ${pathLabel}`);
    }
    if (metadata.dev !== pathMetadata.dev || metadata.ino !== pathMetadata.ino) {
      throw new BoundedFileError('changed-during-open', `Path changed while opening: ${pathLabel}`);
    }
    if (metadata.size > maximum) {
      throw new BoundedFileError('too-large', `File exceeds ${maxBytes} bytes: ${pathLabel}`);
    }

    const chunks: Buffer[] = [];
    let total = 0;
    while (true) {
      const remaining = maxBytes + 1 - total;
      if (remaining <= 0) {
        throw new BoundedFileError('too-large', `File exceeds ${maxBytes} bytes: ${pathLabel}`);
      }
      const buffer = Buffer.allocUnsafe(Math.min(READ_CHUNK_BYTES, remaining));
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, null);
      if (bytesRead === 0) {
        break;
      }
      total += bytesRead;
      if (total > maxBytes) {
        throw new BoundedFileError('too-large', `File exceeds ${maxBytes} bytes: ${pathLabel}`);
      }
      chunks.push(buffer.subarray(0, bytesRead));
    }
    const finalMetadata = await handle.stat({ bigint: true });
    if (
      finalMetadata.dev !== metadata.dev ||
      finalMetadata.ino !== metadata.ino ||
      finalMetadata.size !== metadata.size ||
      finalMetadata.mtimeNs !== metadata.mtimeNs ||
      finalMetadata.ctimeNs !== metadata.ctimeNs ||
      BigInt(total) !== metadata.size
    ) {
      throw new BoundedFileError('changed-during-open', `File changed while reading: ${pathLabel}`);
    }
    return Buffer.concat(chunks, total);
  } finally {
    await handle.close();
  }
}

/** Decode validated bytes without replacing malformed UTF-8 or consuming a leading BOM. */
export function decodeUtf8Fatal(bytes: Uint8Array, label: string): string {
  try {
    return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
  } catch (error) {
    throw new BoundedFileError('invalid-utf8', `${label} is not valid UTF-8`, {
      cause: error,
    });
  }
}

/** Require the selected root and each named descendant to be real directories. */
export async function assertRealDirectories(
  baseDir: string,
  segments: readonly string[],
): Promise<void> {
  let current = baseDir;
  for (const segment of ['', ...segments]) {
    current = segment === '' ? current : join(current, segment);
    const metadata = await lstat(current);
    if (!metadata.isDirectory() || metadata.isSymbolicLink()) {
      throw new Error(`Path is not a real directory: ${current}`);
    }
  }
}

/** Create missing descendants while rejecting symlinks and non-directory occupants. */
export async function ensureRealDirectories(
  baseDir: string,
  segments: readonly string[],
): Promise<void> {
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
      throw new Error(`Path is not a real directory: ${current}`);
    }
  }
}

/** Atomically publish complete bytes without replacing an occupied destination. */
export async function publishBytesCreateOnly(
  finalPath: string,
  bytes: Uint8Array,
  options: CreateOnlyPublicationOptions = {},
): Promise<CreateOnlyBytesResult> {
  const parent = dirname(finalPath);
  const suffix = randomBytes(TEMPORARY_SUFFIX_BYTES).toString('hex');
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
      await handle.writeFile(bytes);
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
          `Temporary write and close both failed: ${tempPath}`,
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
            `Publication and temporary cleanup both failed: ${tempPath}`,
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
    throw new Error(`Create-only publication ended without an outcome: ${finalPath}`);
  }
  return outcome;
}
