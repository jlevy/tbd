/** Strict, bounded inventories of immutable native-comment data. */

import { execFile, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import type { Stats } from 'node:fs';
import { lstat, readdir } from 'node:fs/promises';
import { join, sep } from 'node:path';
import { TextDecoder } from 'node:util';

import type { InternalCommentId } from '../lib/ids.js';
import { asInternalCommentId, validateCommentId } from '../lib/ids.js';
import type { NativeComment } from '../lib/native-comment.js';
import { gitSafeEnv } from '../lib/git-env.js';
import { DATA_SYNC_DIR } from '../lib/paths.js';
import { decodeUtf8Fatal, readBoundedRegularFileBytes } from './bounded-file.js';
import { parseNativeComment, serializeNativeComment } from './comment-parser.js';
import { NATIVE_COMMENT_FILE_MAX_BYTES, commentShard } from './comment-storage.js';
import { readGitObjectBuffers } from './git-object-reader.js';

const GIT_DATA_SYNC_DIR = DATA_SYNC_DIR.replaceAll('\\', '/');
const GIT_COMMENTS_ROOT = `${GIT_DATA_SYNC_DIR}/comments`;
const DATA_SYNC_PREFIX = `${GIT_DATA_SYNC_DIR}/`;
const COMMENT_PATH_PATTERN = /^comments\/([0-9a-f]{2})\/([^/]+)\.md$/u;
const COMMENT_TEMP_PATH_PATTERN = /^comments\/([0-9a-f]{2})\/\.([0-9]+)\.([0-9a-f]{24})\.tmp$/u;
const SHARD_DIRECTORY_PATTERN = /^comments\/[0-9a-f]{2}$/u;
const MAX_GIT_STDERR_BYTES = 64 * 1024;
const GIT_OBJECT_READ_BATCH_SIZE = 128;
const GIT_BATCH_FRAMING_BYTES_PER_OBJECT = 258;
const SOURCE_LABEL_PATTERN = /^[0-9a-z][0-9a-z._-]{0,127}$/u;
const OBJECT_ID_PATTERN = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/u;

/** Defensive repository-wide ceilings, distinct from future CLI page limits. */
export interface DataSyncInventoryLimits {
  maxEntries: number;
  maxPathBytes: number;
  maxRecordBytes: number;
  maxTotalBytes: number;
  maxGitListingBytes: number;
}

export const DEFAULT_DATA_SYNC_INVENTORY_LIMITS: Readonly<DataSyncInventoryLimits> = {
  maxEntries: 100_000,
  maxPathBytes: 4 * 1024,
  maxRecordBytes: NATIVE_COMMENT_FILE_MAX_BYTES,
  maxTotalBytes: 128 * 1024 * 1024,
  maxGitListingBytes: 64 * 1024 * 1024,
};

export type GitIndexStage = 0 | 1 | 2 | 3;
export type DataSyncInventoryCoverage = 'full-tree' | 'sparse-paths';

/** Git-compatible source mode retained verbatim for diagnostics and quarantine. */
export type DataSyncEntryMode = string;

/** Stable origin information suitable for later quarantine manifests. */
export type DataSyncInventorySource =
  | { kind: 'filesystem'; label: string }
  | { kind: 'git-ref'; revision: string }
  | { kind: 'git-index'; stage: GitIndexStage; head?: string };

export type DataSyncInventoryProblemCode =
  | 'invalid-comments-root'
  | 'invalid-path'
  | 'unexpected-entry'
  | 'invalid-mode'
  | 'non-regular'
  | 'oversized-record'
  | 'unmaterialized-record'
  | 'invalid-utf8'
  | 'invalid-record'
  | 'noncanonical-bytes'
  | 'filename-id-mismatch'
  | 'wrong-shard'
  | 'duplicate-id'
  | 'stranded-temp';

export interface DataSyncInventoryInputProblem {
  code: DataSyncInventoryProblemCode;
  detail: string;
}

/** One already-bounded leaf or directory supplied to the pure inventory builder. */
export interface DataSyncInventoryEntryInput {
  /** POSIX path relative to the data-sync root, or a deterministic diagnostic path. */
  path: string;
  /** Exact source path bytes. They differ from UTF-8 `path` for an invalid Git path. */
  pathBytes?: Uint8Array;
  /** Git-compatible mode (`040000`, `100644`, `100755`, `120000`, or `160000`). */
  mode: string;
  size: number;
  bytes?: Uint8Array;
  objectId?: string;
  stage?: GitIndexStage;
  problems?: readonly DataSyncInventoryInputProblem[];
}

export interface DataSyncInventoryEntry {
  path: string;
  pathBytes: Buffer;
  /** Base64 raw path bytes when `path` is only a safe diagnostic placeholder. */
  rawPathBase64?: string;
  mode: string;
  size: number;
  bytes?: Buffer;
  sha256?: string;
  objectId?: string;
  stage?: GitIndexStage;
  /** Identity claimed by a valid comment filename, even when content disagrees. */
  pathCommentId?: InternalCommentId;
  /** Identity claimed by parsed record content, even when its filename disagrees. */
  embeddedCommentId?: InternalCommentId;
  parsedComment?: NativeComment;
  problems: readonly DataSyncInventoryProblemCode[];
}

export interface NativeCommentInventoryRecord {
  id: InternalCommentId;
  path: string;
  mode: '100644';
  bytes: Buffer;
  sha256: string;
  comment: NativeComment;
  source: DataSyncInventorySource;
  objectId?: string;
}

export interface DataSyncInventoryProblem {
  code: DataSyncInventoryProblemCode;
  path: string;
  commentId?: InternalCommentId;
  detail: string;
  /** Exact raw bytes are available for deterministic quarantine. */
  preservable: boolean;
}

export interface DataSyncInventory {
  source: DataSyncInventorySource;
  /** Whether absence means deletion or merely that a raw index stage omitted the path. */
  coverage: DataSyncInventoryCoverage;
  entriesByPath: ReadonlyMap<string, DataSyncInventoryEntry>;
  commentsById: ReadonlyMap<InternalCommentId, NativeCommentInventoryRecord>;
  problems: readonly DataSyncInventoryProblem[];
  stats: {
    entries: number;
    candidateRecords: number;
    validRecords: number;
    bytes: number;
  };
  /** False when a source entry could not be retained within the configured bounds. */
  complete: boolean;
}

export class DataSyncInventoryLimitError extends Error {
  constructor(
    public readonly limit: keyof DataSyncInventoryLimits,
    message: string,
  ) {
    super(message);
    this.name = 'DataSyncInventoryLimitError';
  }
}

class GitCommandError extends Error {
  constructor(
    public readonly exitCode: string | number | undefined,
    message: string,
    options: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'GitCommandError';
  }
}

export interface DataSyncGitReadDependencies {
  runGit?: (repoDir: string, args: readonly string[], maxBytes: number) => Promise<Buffer>;
  runGitWithInput?: (
    repoDir: string,
    args: readonly string[],
    input: Uint8Array,
    maxBytes: number,
  ) => Promise<Buffer>;
  readObjects?: typeof readGitObjectBuffers;
}

type ResolvedLimits = DataSyncInventoryLimits;

interface MutableEntry {
  path: string;
  pathBytes: Buffer;
  mode: string;
  size: number;
  bytes?: Buffer;
  sha256?: string;
  objectId?: string;
  stage?: GitIndexStage;
  pathCommentId?: InternalCommentId;
  embeddedCommentId?: InternalCommentId;
  parsedComment?: NativeComment;
  problemDetails: Map<DataSyncInventoryProblemCode, string>;
  candidateRecord: boolean;
}

interface GitListedEntry {
  fullPathBytes: Buffer;
  mode: string;
  objectId: string;
  objectType: string;
  size?: number;
  stage?: GitIndexStage;
}

interface PreparedEntryInput {
  input: DataSyncInventoryEntryInput;
  path: string;
  pathBytes: Buffer;
  unsafePath: boolean;
}

function positiveSafeInteger(value: number, label: keyof DataSyncInventoryLimits): number {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError(`${label} must be a positive safe integer, got ${value}`);
  }
  return value;
}

function resolveLimits(overrides: Partial<DataSyncInventoryLimits> = {}): ResolvedLimits {
  const merged = { ...DEFAULT_DATA_SYNC_INVENTORY_LIMITS, ...overrides };
  return {
    maxEntries: positiveSafeInteger(merged.maxEntries, 'maxEntries'),
    maxPathBytes: positiveSafeInteger(merged.maxPathBytes, 'maxPathBytes'),
    maxRecordBytes: positiveSafeInteger(merged.maxRecordBytes, 'maxRecordBytes'),
    maxTotalBytes: positiveSafeInteger(merged.maxTotalBytes, 'maxTotalBytes'),
    maxGitListingBytes: positiveSafeInteger(merged.maxGitListingBytes, 'maxGitListingBytes'),
  };
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function digest(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function isQuarantineSafeRelativePath(path: string): boolean {
  const segments = path.split('/');
  return (
    path.length > 0 &&
    !path.includes('\\') &&
    !path.startsWith('/') &&
    !segments.some((segment) => segment === '..' || segment === '')
  );
}

function prepareEntryInput(input: DataSyncInventoryEntryInput): PreparedEntryInput {
  const pathBytes = Buffer.from(input.pathBytes ?? Buffer.from(input.path, 'utf8'));
  if (isQuarantineSafeRelativePath(input.path)) {
    return { input, path: input.path, pathBytes, unsafePath: false };
  }
  return {
    input,
    path: `<unsafe-data-sync-path:${digest(pathBytes)}>`,
    pathBytes,
    unsafePath: true,
  };
}

function addProblem(entry: MutableEntry, code: DataSyncInventoryProblemCode, detail: string): void {
  if (!entry.problemDetails.has(code)) {
    entry.problemDetails.set(code, detail);
  }
}

function isDirectoryMode(mode: string): boolean {
  return mode === '040000';
}

function isBlobMode(mode: string): boolean {
  return mode === '100644' || mode === '100755';
}

function hasRetainablePayload(entry: MutableEntry): boolean {
  return isDirectoryMode(entry.mode) || entry.bytes !== undefined;
}

function safeCommentIdFromFilename(path: string): InternalCommentId | undefined {
  const match = COMMENT_PATH_PATTERN.exec(path);
  const id = match?.[2];
  return id !== undefined && validateCommentId(id) ? asInternalCommentId(id) : undefined;
}

function canonicalCommentPath(id: InternalCommentId): string {
  return `comments/${commentShard(id)}/${id}.md`;
}

function assertValidSource(source: DataSyncInventorySource): void {
  if (source.kind === 'filesystem') {
    if (!SOURCE_LABEL_PATTERN.test(source.label)) {
      throw new Error(`Invalid filesystem inventory source label: ${source.label}`);
    }
    return;
  }
  if (source.kind === 'git-ref') {
    if (!OBJECT_ID_PATTERN.test(source.revision)) {
      throw new Error(`Git-ref inventory source is not a resolved commit: ${source.revision}`);
    }
    return;
  }
  if (source.head !== undefined && !OBJECT_ID_PATTERN.test(source.head)) {
    throw new Error(`Invalid Git-index HEAD: ${source.head}`);
  }
}

function inspectEntry(entry: MutableEntry, limits: ResolvedLimits): void {
  const suppliedPathBytes = entry.pathBytes;
  if (suppliedPathBytes.length > limits.maxPathBytes) {
    addProblem(entry, 'invalid-path', `Path exceeds ${limits.maxPathBytes} UTF-8 bytes`);
  }

  const pathMatch = COMMENT_PATH_PATTERN.exec(entry.path);
  if (pathMatch !== null) {
    entry.candidateRecord = true;
  }
  const filenameId = safeCommentIdFromFilename(entry.path);
  if (filenameId !== undefined) {
    entry.pathCommentId = filenameId;
    const shard = pathMatch?.[1];
    if (shard !== commentShard(filenameId)) {
      addProblem(
        entry,
        'wrong-shard',
        `Comment ${filenameId} belongs in shard ${commentShard(filenameId)}`,
      );
    }
  } else if (pathMatch !== null) {
    addProblem(entry, 'invalid-path', `Invalid native-comment filename ${pathMatch[2]}.md`);
  }

  if (isDirectoryEntry(entry)) {
    return;
  }

  const tempMatch = COMMENT_TEMP_PATH_PATTERN.exec(entry.path);
  const scaffold = entry.path === 'comments/.gitkeep';

  if (scaffold) {
    if (entry.mode !== '100644') {
      addProblem(entry, 'invalid-mode', 'comments/.gitkeep must use mode 100644');
    }
    if (entry.bytes === undefined) {
      addProblem(entry, 'unmaterialized-record', 'comments/.gitkeep bytes are unavailable');
    } else if (entry.bytes.length !== 0) {
      addProblem(entry, 'unexpected-entry', 'comments/.gitkeep must be empty');
    }
    return;
  }

  entry.candidateRecord = true;
  if (tempMatch !== null) {
    addProblem(entry, 'stranded-temp', 'Stranded native-comment publication temporary file');
  } else if (pathMatch === null) {
    addProblem(
      entry,
      'invalid-path',
      'Native comments must use comments/<two-hex-shard>/<comment-id>.md',
    );
  }

  if (!isBlobMode(entry.mode)) {
    addProblem(entry, 'non-regular', `Native comment entry has non-regular mode ${entry.mode}`);
  } else if (entry.mode !== '100644') {
    addProblem(entry, 'invalid-mode', 'Native comment files must use mode 100644');
  }

  if (entry.size > limits.maxRecordBytes) {
    addProblem(
      entry,
      'oversized-record',
      `Native comment entry exceeds ${limits.maxRecordBytes} bytes`,
    );
    return;
  }
  if (entry.bytes === undefined) {
    addProblem(entry, 'unmaterialized-record', 'Native comment bytes are unavailable');
    return;
  }
  if (!isBlobMode(entry.mode)) {
    return;
  }

  let content: string;
  try {
    content = decodeUtf8Fatal(entry.bytes, entry.path);
  } catch {
    addProblem(entry, 'invalid-utf8', 'Native comment entry is not valid UTF-8');
    return;
  }

  let comment: NativeComment;
  try {
    comment = parseNativeComment(content);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    addProblem(entry, 'invalid-record', `Invalid native comment: ${detail}`);
    return;
  }
  entry.parsedComment = comment;
  const embeddedId = asInternalCommentId(comment.id);
  entry.embeddedCommentId = embeddedId;

  if (filenameId !== undefined && embeddedId !== filenameId) {
    addProblem(
      entry,
      'filename-id-mismatch',
      `File name ${filenameId} contains native comment ${embeddedId}`,
    );
  }
  const canonicalBytes = Buffer.from(serializeNativeComment(comment), 'utf8');
  if (!entry.bytes.equals(canonicalBytes)) {
    addProblem(entry, 'noncanonical-bytes', 'Native comment bytes are not canonical');
  }
}

function inspectDirectoryEntry(entry: MutableEntry): boolean {
  if (!isDirectoryMode(entry.mode)) {
    if (entry.path === 'comments') {
      addProblem(entry, 'invalid-comments-root', 'comments must be a real directory');
    }
    return false;
  }

  if (entry.path === 'comments' || SHARD_DIRECTORY_PATTERN.test(entry.path)) {
    return true;
  }
  addProblem(
    entry,
    'invalid-path',
    'Only comments/<two-lowercase-hex> shard directories are allowed',
  );
  return true;
}

// Kept as a named wrapper so the main validator reads in path, mode, then content order.
function isDirectoryEntry(entry: MutableEntry): boolean {
  return inspectDirectoryEntry(entry);
}

function sortProblemCodes(
  codes: Iterable<DataSyncInventoryProblemCode>,
): DataSyncInventoryProblemCode[] {
  return Array.from(codes).sort(compareStrings);
}

/** Build and validate one immutable snapshot from already-bounded source entries. */
export function buildDataSyncInventory(
  source: DataSyncInventorySource,
  inputs: readonly DataSyncInventoryEntryInput[],
  limitOverrides: Partial<DataSyncInventoryLimits> = {},
): DataSyncInventory {
  assertValidSource(source);
  const limits = resolveLimits(limitOverrides);
  if (inputs.length > limits.maxEntries) {
    throw new DataSyncInventoryLimitError(
      'maxEntries',
      `Data-sync inventory has ${inputs.length} entries; maximum is ${limits.maxEntries}`,
    );
  }

  const sortedInputs = inputs
    .map((input) => prepareEntryInput(input))
    .sort(
      (left, right) =>
        compareStrings(left.path, right.path) || Buffer.compare(left.pathBytes, right.pathBytes),
    );
  const seenPaths = new Set<string>();
  const mutableEntries: MutableEntry[] = [];
  let totalBytes = 0;

  for (const prepared of sortedInputs) {
    const { input, path, pathBytes, unsafePath } = prepared;
    if (seenPaths.has(path)) {
      throw new Error(`Duplicate data-sync inventory path: ${path}`);
    }
    seenPaths.add(path);
    if (!Number.isSafeInteger(input.size) || input.size < 0) {
      throw new RangeError(`Invalid size for data-sync inventory path ${path}: ${input.size}`);
    }
    if (input.objectId !== undefined && !OBJECT_ID_PATTERN.test(input.objectId)) {
      throw new Error(`Invalid Git object ID at ${path}: ${input.objectId}`);
    }
    if (source.kind === 'git-index' && input.stage !== source.stage) {
      throw new Error(
        `Git index entry ${path} is stage ${String(input.stage)}, expected ${source.stage}`,
      );
    }
    totalBytes += input.size;
    if (!Number.isSafeInteger(totalBytes) || totalBytes > limits.maxTotalBytes) {
      throw new DataSyncInventoryLimitError(
        'maxTotalBytes',
        `Data-sync inventory exceeds ${limits.maxTotalBytes} aggregate bytes`,
      );
    }

    const retainedBytes =
      input.bytes !== undefined && input.size <= limits.maxRecordBytes
        ? Buffer.from(input.bytes)
        : undefined;
    if (input.bytes !== undefined && input.bytes.byteLength !== input.size) {
      throw new Error(
        `Data-sync inventory size mismatch at ${path}: ` +
          `declared ${input.size}, read ${input.bytes.byteLength}`,
      );
    }
    const entry: MutableEntry = {
      path,
      pathBytes,
      mode: input.mode,
      size: input.size,
      bytes: retainedBytes,
      sha256: retainedBytes === undefined ? undefined : digest(retainedBytes),
      objectId: input.objectId,
      stage: input.stage,
      problemDetails: new Map(
        input.problems?.map((problem) => [problem.code, problem.detail] as const) ?? [],
      ),
      candidateRecord: false,
    };
    if (unsafePath) {
      addProblem(entry, 'invalid-path', 'Source path is unsafe for a durable relative manifest');
    } else if (!pathBytes.equals(Buffer.from(input.path, 'utf8'))) {
      addProblem(entry, 'invalid-path', 'Source path is not valid canonical UTF-8');
    }
    inspectEntry(entry, limits);
    mutableEntries.push(entry);
  }

  const entriesByClaimedId = new Map<InternalCommentId, MutableEntry[]>();
  for (const entry of mutableEntries) {
    const claimedIds = new Set(
      [entry.pathCommentId, entry.embeddedCommentId].filter(
        (id): id is InternalCommentId => id !== undefined,
      ),
    );
    for (const id of claimedIds) {
      const entries = entriesByClaimedId.get(id) ?? [];
      entries.push(entry);
      entriesByClaimedId.set(id, entries);
    }
  }
  for (const [id, entries] of entriesByClaimedId) {
    if (entries.length < 2) {
      continue;
    }
    const canonicalPath = canonicalCommentPath(id);
    const canonical = entries.find(
      (entry) => entry.path === canonicalPath && entry.parsedComment?.id === id,
    );
    for (const entry of entries) {
      if (entry === canonical) {
        continue;
      }
      addProblem(entry, 'duplicate-id', `Native comment ${id} also appears at ${canonicalPath}`);
    }
    if (canonical === undefined) {
      for (const entry of entries) {
        addProblem(entry, 'duplicate-id', `Native comment ${id} appears at multiple paths`);
      }
    }
  }

  const entriesByPath = new Map<string, DataSyncInventoryEntry>();
  const commentsById = new Map<InternalCommentId, NativeCommentInventoryRecord>();
  const problems: DataSyncInventoryProblem[] = [];
  let candidateRecords = 0;
  let complete = true;

  for (const mutable of mutableEntries) {
    const problemCodes = sortProblemCodes(mutable.problemDetails.keys());
    const entry: DataSyncInventoryEntry = {
      path: mutable.path,
      pathBytes: mutable.pathBytes,
      ...(!mutable.pathBytes.equals(Buffer.from(mutable.path, 'utf8'))
        ? { rawPathBase64: mutable.pathBytes.toString('base64') }
        : {}),
      mode: mutable.mode,
      size: mutable.size,
      bytes: mutable.bytes,
      sha256: mutable.sha256,
      objectId: mutable.objectId,
      stage: mutable.stage,
      pathCommentId: mutable.pathCommentId,
      embeddedCommentId: mutable.embeddedCommentId,
      parsedComment: mutable.parsedComment,
      problems: problemCodes,
    };
    entriesByPath.set(entry.path, entry);
    if (mutable.candidateRecord) {
      candidateRecords++;
    }
    if (!hasRetainablePayload(mutable)) {
      complete = false;
    }
    for (const code of problemCodes) {
      problems.push({
        code,
        path: mutable.path,
        commentId: mutable.pathCommentId ?? mutable.embeddedCommentId,
        detail: mutable.problemDetails.get(code) ?? code,
        preservable: mutable.bytes !== undefined,
      });
    }
    if (
      problemCodes.length === 0 &&
      mutable.parsedComment !== undefined &&
      mutable.pathCommentId !== undefined &&
      mutable.embeddedCommentId === mutable.pathCommentId &&
      mutable.bytes !== undefined &&
      mutable.sha256 !== undefined &&
      mutable.mode === '100644'
    ) {
      commentsById.set(mutable.pathCommentId, {
        id: mutable.pathCommentId,
        path: mutable.path,
        mode: '100644',
        bytes: mutable.bytes,
        sha256: mutable.sha256,
        comment: mutable.parsedComment,
        source,
        objectId: mutable.objectId,
      });
    }
  }

  problems.sort(
    (left, right) => compareStrings(left.path, right.path) || compareStrings(left.code, right.code),
  );

  return {
    source,
    coverage: source.kind === 'git-index' ? 'sparse-paths' : 'full-tree',
    entriesByPath,
    commentsById,
    problems,
    stats: {
      entries: mutableEntries.length,
      candidateRecords,
      validRecords: commentsById.size,
      bytes: totalBytes,
    },
    complete,
  };
}

/** Fail closed when an inventory contains any invalid or unmaterialized entry. */
export function assertValidDataSyncInventory(inventory: DataSyncInventory): void {
  if (inventory.complete && inventory.problems.length === 0) {
    return;
  }
  const first = inventory.problems[0];
  const detail = first === undefined ? 'inventory is incomplete' : `${first.path}: ${first.detail}`;
  throw new Error(
    `Invalid native-comment data-sync inventory (${inventory.problems.length} problems): ${detail}`,
  );
}

function filesystemMode(metadata: Stats): string {
  if (metadata.isDirectory()) {
    return '040000';
  }
  if (metadata.isSymbolicLink()) {
    return '120000';
  }
  if (metadata.isFile()) {
    return process.platform !== 'win32' && (metadata.mode & 0o111) !== 0 ? '100755' : '100644';
  }
  return 'unknown';
}

function appendRawFilesystemPath(parent: string | Buffer, name: Buffer): Buffer {
  return Buffer.concat([
    typeof parent === 'string' ? Buffer.from(parent) : parent,
    Buffer.from(sep),
    name,
  ]);
}

function appendRawRelativePath(parent: Buffer, name: Buffer): Buffer {
  return Buffer.concat([parent, Buffer.from('/'), name]);
}

function parseFilesystemPath(pathBytes: Buffer): {
  path: string;
  pathBytes: Buffer;
  problems?: DataSyncInventoryInputProblem[];
} {
  try {
    return {
      path: decodeUtf8Fatal(pathBytes, 'Filesystem path'),
      pathBytes: Buffer.from(pathBytes),
    };
  } catch {
    return {
      path: `<invalid-utf8-filesystem-path:${digest(pathBytes)}>`,
      pathBytes: Buffer.from(pathBytes),
      problems: [{ code: 'invalid-path', detail: 'Filesystem path is not valid UTF-8' }],
    };
  }
}

/** Read a strict inventory from a local data-sync directory without following links. */
export async function readDataSyncInventoryFromFilesystem(
  dataSyncDir: string,
  options: {
    sourceLabel?: string;
    limits?: Partial<DataSyncInventoryLimits>;
  } = {},
): Promise<DataSyncInventory> {
  const limits = resolveLimits(options.limits);
  const commentsRoot = join(dataSyncDir, 'comments');
  let rootMetadata: Awaited<ReturnType<typeof lstat>>;
  try {
    rootMetadata = await lstat(commentsRoot);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return buildDataSyncInventory(
        { kind: 'filesystem', label: options.sourceLabel ?? 'data-sync-worktree' },
        [],
        limits,
      );
    }
    throw error;
  }

  const inputs: DataSyncInventoryEntryInput[] = [];
  let observedBytes = 0;
  const pushInput = (input: DataSyncInventoryEntryInput): void => {
    if (inputs.length >= limits.maxEntries) {
      throw new DataSyncInventoryLimitError(
        'maxEntries',
        `Data-sync inventory exceeds ${limits.maxEntries} entries`,
      );
    }
    observedBytes += input.size;
    if (!Number.isSafeInteger(observedBytes) || observedBytes > limits.maxTotalBytes) {
      throw new DataSyncInventoryLimitError(
        'maxTotalBytes',
        `Data-sync inventory exceeds ${limits.maxTotalBytes} aggregate bytes`,
      );
    }
    inputs.push(input);
  };

  const rootSize = rootMetadata.isDirectory() ? 0 : rootMetadata.size;
  let rootBytes: Uint8Array | undefined;
  if (rootMetadata.isFile() && rootSize <= limits.maxRecordBytes) {
    rootBytes = await readBoundedRegularFileBytes(commentsRoot, limits.maxRecordBytes);
  }
  pushInput({
    path: 'comments',
    mode: filesystemMode(rootMetadata),
    size: rootSize,
    bytes: rootBytes,
  });
  if (!rootMetadata.isDirectory() || rootMetadata.isSymbolicLink()) {
    return buildDataSyncInventory(
      { kind: 'filesystem', label: options.sourceLabel ?? 'data-sync-worktree' },
      inputs,
      limits,
    );
  }

  const queue: { absolutePath: string | Buffer; relativePathBytes: Buffer }[] = [
    { absolutePath: commentsRoot, relativePathBytes: Buffer.from('comments') },
  ];
  let queueIndex = 0;
  while (queueIndex < queue.length) {
    const current = queue[queueIndex]!;
    queueIndex++;
    const names = await readdir(current.absolutePath, { encoding: 'buffer' });
    names.sort((left, right) => Buffer.compare(left, right));
    for (const name of names) {
      const relativePathBytes = appendRawRelativePath(current.relativePathBytes, name);
      const parsedPath = parseFilesystemPath(relativePathBytes);
      const absolutePath = appendRawFilesystemPath(current.absolutePath, name);
      const metadata = await lstat(absolutePath);
      const mode = filesystemMode(metadata);
      if (metadata.isDirectory() && !metadata.isSymbolicLink()) {
        pushInput({
          path: parsedPath.path,
          pathBytes: parsedPath.pathBytes,
          mode,
          size: 0,
          problems: parsedPath.problems,
        });
        queue.push({ absolutePath, relativePathBytes });
        continue;
      }

      const size = metadata.size;
      if (!Number.isSafeInteger(size) || size < 0) {
        throw new Error(`Invalid filesystem size at ${parsedPath.path}: ${size}`);
      }
      // Reserve the aggregate budget before allocating or reading the file.
      if (observedBytes + size > limits.maxTotalBytes) {
        throw new DataSyncInventoryLimitError(
          'maxTotalBytes',
          `Data-sync inventory exceeds ${limits.maxTotalBytes} aggregate bytes`,
        );
      }
      let bytes: Uint8Array | undefined;
      if (metadata.isFile() && size <= limits.maxRecordBytes) {
        bytes = await readBoundedRegularFileBytes(absolutePath, limits.maxRecordBytes);
      }
      pushInput({
        path: parsedPath.path,
        pathBytes: parsedPath.pathBytes,
        mode,
        size,
        bytes,
        problems: parsedPath.problems,
      });
    }
  }

  return buildDataSyncInventory(
    { kind: 'filesystem', label: options.sourceLabel ?? 'data-sync-worktree' },
    inputs,
    limits,
  );
}

function runGitBuffer(repoDir: string, args: readonly string[], maxBytes: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    execFile(
      'git',
      ['-C', repoDir, ...args],
      {
        encoding: 'buffer',
        env: gitSafeEnv({
          GIT_NO_REPLACE_OBJECTS: '1',
          GIT_OPTIONAL_LOCKS: '0',
          GIT_TERMINAL_PROMPT: '0',
        }),
        maxBuffer: maxBytes,
        windowsHide: true,
      },
      (error, stdout, stderr) => {
        if (error !== null) {
          const detail = stderr.toString('utf8').trim();
          reject(
            new GitCommandError(
              error.code ?? undefined,
              `git ${args.join(' ')} failed${detail.length > 0 ? `: ${detail}` : ''}`,
              {
                cause: error,
              },
            ),
          );
          return;
        }
        resolve(stdout);
      },
    );
  });
}

function runGitWithInputBuffer(
  repoDir: string,
  args: readonly string[],
  input: Uint8Array,
  maxBytes: number,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const child = spawn('git', ['-C', repoDir, ...args], {
      env: gitSafeEnv({
        GIT_NO_REPLACE_OBJECTS: '1',
        GIT_OPTIONAL_LOCKS: '0',
        GIT_TERMINAL_PROMPT: '0',
      }),
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    });
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    let stdoutBytes = 0;
    let stderrBytes = 0;
    let settled = false;

    const fail = (error: Error): void => {
      if (!settled) {
        settled = true;
        child.kill();
        reject(error);
      }
    };
    child.stdout.on('data', (chunk: Buffer) => {
      if (chunk.length > maxBytes - stdoutBytes) {
        fail(new Error(`git ${args[0] ?? 'command'} stdout exceeded ${maxBytes} bytes`));
        return;
      }
      stdoutBytes += chunk.length;
      stdoutChunks.push(chunk);
    });
    child.stderr.on('data', (chunk: Buffer) => {
      if (chunk.length > MAX_GIT_STDERR_BYTES - stderrBytes) {
        fail(
          new Error(`git ${args[0] ?? 'command'} stderr exceeded ${MAX_GIT_STDERR_BYTES} bytes`),
        );
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
        const detail = Buffer.concat(stderrChunks, stderrBytes).toString('utf8').trim();
        const termination = code === null ? `signal ${signal ?? 'unknown'}` : `exit ${code}`;
        fail(
          new Error(`git ${args.join(' ')} failed (${termination})${detail ? `: ${detail}` : ''}`),
        );
        return;
      }
      settled = true;
      resolve(Buffer.concat(stdoutChunks, stdoutBytes));
    });
    child.stdin.on('error', (error) => {
      fail(error);
    });
    child.stdin.end(input);
  });
}

function parseResolvedCommit(output: Buffer, ref: string): string {
  const text = new TextDecoder('ascii', { fatal: true }).decode(output);
  const match = /^([0-9a-f]{40}|[0-9a-f]{64})\r?\n$/u.exec(text);
  if (match?.[1] === undefined) {
    throw new Error(`Invalid commit resolution for ${ref}`);
  }
  return match[1];
}

async function resolveCommit(
  repoDir: string,
  ref: string,
  runGit: NonNullable<DataSyncGitReadDependencies['runGit']>,
  maxBytes: number,
): Promise<string> {
  const output = await runGit(
    repoDir,
    ['rev-parse', '--verify', '--end-of-options', `${ref}^{commit}`],
    maxBytes,
  );
  return parseResolvedCommit(output, ref);
}

async function resolveOptionalHead(
  repoDir: string,
  runGit: NonNullable<DataSyncGitReadDependencies['runGit']>,
  maxBytes: number,
): Promise<string | undefined> {
  let output: Buffer;
  try {
    output = await runGit(
      repoDir,
      ['rev-parse', '--verify', '--quiet', '--end-of-options', 'HEAD^{commit}'],
      maxBytes,
    );
  } catch (error) {
    if (error instanceof GitCommandError && error.exitCode === 1) {
      return undefined;
    }
    throw error;
  }
  return parseResolvedCommit(output, 'HEAD');
}

function parseGitPath(fullPathBytes: Buffer): {
  path: string;
  pathBytes: Buffer;
  problems?: DataSyncInventoryInputProblem[];
} {
  const prefix = Buffer.from(DATA_SYNC_PREFIX, 'ascii');
  const pathBytes = fullPathBytes.subarray(0, prefix.length).equals(prefix)
    ? fullPathBytes.subarray(prefix.length)
    : fullPathBytes;
  try {
    const path = decodeUtf8Fatal(pathBytes, 'Git tree path');
    return { path, pathBytes: Buffer.from(pathBytes) };
  } catch {
    const pathDigest = digest(pathBytes);
    return {
      path: `<invalid-utf8-git-path:${pathDigest}>`,
      pathBytes: Buffer.from(pathBytes),
      problems: [{ code: 'invalid-path', detail: 'Git path is not valid UTF-8' }],
    };
  }
}

function splitNul(output: Buffer): Buffer[] {
  const entries: Buffer[] = [];
  let start = 0;
  while (start < output.length) {
    const end = output.indexOf(0x00, start);
    if (end < 0) {
      throw new Error('Git listing is missing its terminal NUL byte');
    }
    entries.push(output.subarray(start, end));
    start = end + 1;
  }
  return entries;
}

function parseTreeListing(output: Buffer, revision: string): GitListedEntry[] {
  return splitNul(output).map((rawEntry) => {
    const separator = rawEntry.indexOf(0x09);
    if (separator < 0) {
      throw new Error(`Invalid Git tree entry at ${revision}`);
    }
    const metadata = rawEntry.subarray(0, separator).toString('ascii');
    const match = /^([0-7]{6}) ([^ ]+) ([0-9a-f]{40}|[0-9a-f]{64})\s+([0-9]+|-)$/u.exec(metadata);
    if (match === null) {
      throw new Error(`Invalid Git tree metadata at ${revision}: ${metadata}`);
    }
    const size = match[4] === '-' ? undefined : Number(match[4]);
    if (size !== undefined && !Number.isSafeInteger(size)) {
      throw new Error(`Invalid Git object size at ${revision}: ${match[4]}`);
    }
    return {
      fullPathBytes: Buffer.from(rawEntry.subarray(separator + 1)),
      mode: match[1]!,
      objectType: match[2]!,
      objectId: match[3]!,
      size,
    };
  });
}

function selectCommentsTreeEntries(
  entries: readonly GitListedEntry[],
  revision: string,
): GitListedEntry[] {
  const root = Buffer.from(GIT_COMMENTS_ROOT, 'ascii');
  const rootPrefix = Buffer.concat([root, Buffer.from('/')]);
  return entries.filter((entry) => {
    if (
      entry.fullPathBytes.equals(root) ||
      entry.fullPathBytes.subarray(0, rootPrefix.length).equals(rootPrefix)
    ) {
      return true;
    }
    const possibleAncestorPrefix = Buffer.concat([entry.fullPathBytes, Buffer.from('/')]);
    if (root.subarray(0, possibleAncestorPrefix.length).equals(possibleAncestorPrefix)) {
      if (entry.mode !== '040000' || entry.objectType !== 'tree') {
        throw new Error(`Invalid Git tree ancestor at ${revision}`);
      }
      return false;
    }
    throw new Error(`Unexpected Git tree entry outside native comments at ${revision}`);
  });
}

function parseIndexListing(output: Buffer): GitListedEntry[] {
  return splitNul(output).map((rawEntry) => {
    const separator = rawEntry.indexOf(0x09);
    if (separator < 0) {
      throw new Error('Invalid Git index entry');
    }
    const metadata = rawEntry.subarray(0, separator).toString('ascii');
    const match = /^([0-7]{6}) ([0-9a-f]{40}|[0-9a-f]{64}) ([0-3])$/u.exec(metadata);
    if (match === null) {
      throw new Error(`Invalid Git index metadata: ${metadata}`);
    }
    return {
      fullPathBytes: Buffer.from(rawEntry.subarray(separator + 1)),
      mode: match[1]!,
      objectType: match[1] === '160000' ? 'commit' : 'blob',
      objectId: match[2]!,
      stage: Number(match[3]) as GitIndexStage,
    };
  });
}

interface GitObjectMetadata {
  type: string;
  size: number;
}

async function readGitObjectMetadata(
  repoDir: string,
  objectIds: readonly string[],
  runGitWithInput: NonNullable<DataSyncGitReadDependencies['runGitWithInput']>,
  maxBytes: number,
): Promise<ReadonlyMap<string, GitObjectMetadata>> {
  const uniqueIds = Array.from(new Set(objectIds));
  if (uniqueIds.length === 0) {
    return new Map();
  }
  const output = await runGitWithInput(
    repoDir,
    ['cat-file', '--batch-check=%(objectname) %(objecttype) %(objectsize)'],
    Buffer.from(`${uniqueIds.join('\n')}\n`, 'ascii'),
    maxBytes,
  );
  const lines = output.toString('ascii').split('\n');
  if (lines.at(-1) !== '') {
    throw new Error('Git object metadata output is missing its terminal newline');
  }
  lines.pop();
  if (lines.length !== uniqueIds.length) {
    throw new Error('Git object metadata response count does not match the request');
  }
  const result = new Map<string, GitObjectMetadata>();
  for (let index = 0; index < uniqueIds.length; index++) {
    const expectedId = uniqueIds[index]!;
    const line = lines[index]!;
    const match = /^([0-9a-f]{40}|[0-9a-f]{64}) ([^ ]+) ([0-9]+)$/u.exec(line);
    if (match?.[1] !== expectedId) {
      throw new Error(`Invalid Git object metadata for ${expectedId}: ${line}`);
    }
    const size = Number(match[3]);
    if (!Number.isSafeInteger(size)) {
      throw new Error(`Invalid Git object size for ${expectedId}: ${match[3]}`);
    }
    result.set(expectedId, { type: match[2]!, size });
  }
  return result;
}

function checkListedEntryLimits(entries: readonly GitListedEntry[], limits: ResolvedLimits): void {
  if (entries.length > limits.maxEntries) {
    throw new DataSyncInventoryLimitError(
      'maxEntries',
      `Data-sync inventory has ${entries.length} entries; maximum is ${limits.maxEntries}`,
    );
  }
  let total = 0;
  for (const entry of entries) {
    total += entry.size ?? 0;
    if (!Number.isSafeInteger(total) || total > limits.maxTotalBytes) {
      throw new DataSyncInventoryLimitError(
        'maxTotalBytes',
        `Data-sync inventory exceeds ${limits.maxTotalBytes} aggregate bytes`,
      );
    }
  }
}

function gitBatchOutputLimit(limits: ResolvedLimits): number {
  const batchPayloadBytes = Math.min(
    limits.maxTotalBytes,
    limits.maxRecordBytes * GIT_OBJECT_READ_BATCH_SIZE,
  );
  return Math.min(
    Number.MAX_SAFE_INTEGER,
    batchPayloadBytes + GIT_BATCH_FRAMING_BYTES_PER_OBJECT * GIT_OBJECT_READ_BATCH_SIZE,
  );
}

async function materializeGitInputs(
  repoDir: string,
  listedEntries: readonly GitListedEntry[],
  limits: ResolvedLimits,
  readObjects: typeof readGitObjectBuffers,
): Promise<DataSyncInventoryEntryInput[]> {
  checkListedEntryLimits(listedEntries, limits);
  const objectIds = listedEntries
    .filter(
      (entry) =>
        entry.objectType === 'blob' &&
        entry.size !== undefined &&
        entry.size <= limits.maxRecordBytes,
    )
    .map((entry) => entry.objectId);
  const objects = await readObjects(repoDir, objectIds, {
    batchSize: GIT_OBJECT_READ_BATCH_SIZE,
    maxObjectBytes: limits.maxRecordBytes,
    maxBatchOutputBytes: gitBatchOutputLimit(limits),
  });
  for (const objectId of new Set(objectIds)) {
    if (!objects.has(objectId)) {
      throw new Error(`Missing Git object bytes for ${objectId}`);
    }
  }

  return listedEntries.map((listed) => {
    const parsedPath = parseGitPath(listed.fullPathBytes);
    const problems = [...(parsedPath.problems ?? [])];
    const objectTypeMatchesMode =
      (listed.mode === '040000' && listed.objectType === 'tree') ||
      (listed.mode !== '040000' && listed.objectType === 'blob');
    if (!objectTypeMatchesMode) {
      problems.push({
        code: 'non-regular',
        detail: `Git mode ${listed.mode} is incompatible with ${listed.objectType} object`,
      });
    }
    return {
      path: parsedPath.path,
      pathBytes: parsedPath.pathBytes,
      mode: listed.mode,
      size: listed.size ?? 0,
      bytes: objects.get(listed.objectId),
      objectId: listed.objectId,
      stage: listed.stage,
      problems,
    };
  });
}

/** Read exact native-comment blobs from a resolved committed Git tree. */
export async function readDataSyncInventoryFromGitRef(
  repoDir: string,
  ref: string,
  options: {
    limits?: Partial<DataSyncInventoryLimits>;
    dependencies?: DataSyncGitReadDependencies;
  } = {},
): Promise<DataSyncInventory> {
  const limits = resolveLimits(options.limits);
  const runGit = options.dependencies?.runGit ?? runGitBuffer;
  const readObjects = options.dependencies?.readObjects ?? readGitObjectBuffers;
  const revision = await resolveCommit(repoDir, ref, runGit, limits.maxGitListingBytes);
  const listing = await runGit(
    repoDir,
    ['ls-tree', '-r', '-t', '-z', '-l', '--full-tree', revision, '--', GIT_COMMENTS_ROOT],
    limits.maxGitListingBytes,
  );
  const listedEntries = selectCommentsTreeEntries(parseTreeListing(listing, revision), revision);
  const inputs = await materializeGitInputs(repoDir, listedEntries, limits, readObjects);
  return buildDataSyncInventory({ kind: 'git-ref', revision }, inputs, limits);
}

/** Read stage-separated native-comment inventories from the current Git index. */
export async function readDataSyncInventoriesFromGitIndex(
  repoDir: string,
  options: {
    limits?: Partial<DataSyncInventoryLimits>;
    dependencies?: DataSyncGitReadDependencies;
  } = {},
): Promise<ReadonlyMap<GitIndexStage, DataSyncInventory>> {
  const limits = resolveLimits(options.limits);
  const runGit = options.dependencies?.runGit ?? runGitBuffer;
  const runGitWithInput = options.dependencies?.runGitWithInput ?? runGitWithInputBuffer;
  const readObjects = options.dependencies?.readObjects ?? readGitObjectBuffers;
  const head = await resolveOptionalHead(repoDir, runGit, limits.maxGitListingBytes);
  const listing = await runGit(
    repoDir,
    ['ls-files', '--stage', '-z', '--', GIT_COMMENTS_ROOT],
    limits.maxGitListingBytes,
  );
  const listedEntries = parseIndexListing(listing);
  if (listedEntries.length > limits.maxEntries) {
    throw new DataSyncInventoryLimitError(
      'maxEntries',
      `Data-sync index inventory has ${listedEntries.length} entries; maximum is ${limits.maxEntries}`,
    );
  }

  const metadata = await readGitObjectMetadata(
    repoDir,
    listedEntries.filter((entry) => entry.objectType === 'blob').map((entry) => entry.objectId),
    runGitWithInput,
    limits.maxGitListingBytes,
  );
  for (const entry of listedEntries) {
    const objectMetadata = metadata.get(entry.objectId);
    if (entry.objectType === 'blob') {
      if (objectMetadata === undefined) {
        throw new Error(`Missing Git object metadata for ${entry.objectId}`);
      }
      entry.objectType = objectMetadata.type;
      entry.size = objectMetadata.size;
    }
  }
  checkListedEntryLimits(listedEntries, limits);

  const result = new Map<GitIndexStage, DataSyncInventory>();
  const inputs = await materializeGitInputs(repoDir, listedEntries, limits, readObjects);
  for (const stage of [0, 1, 2, 3] as const) {
    const stageInputs = inputs.filter((entry) => entry.stage === stage);
    result.set(
      stage,
      buildDataSyncInventory(
        { kind: 'git-index', stage, ...(head === undefined ? {} : { head }) },
        stageInputs,
        limits,
      ),
    );
  }
  return result;
}
