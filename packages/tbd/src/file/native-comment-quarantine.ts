/** Deterministic, create-only preservation for native-comment violations. */

import { createHash } from 'node:crypto';
import { lstat } from 'node:fs/promises';
import { join, posix } from 'node:path';

import { z } from 'zod';

import { validateCommentId, type InternalCommentId } from '../lib/ids.js';
import { sortKeys, stringifyYaml } from '../utils/yaml-utils.js';
import {
  ensureRealDirectories,
  publishBytesCreateOnly,
  readBoundedRegularFileBytes,
  type CreateOnlyPublicationOptions,
} from './bounded-file.js';
import { NATIVE_COMMENT_FILE_MAX_BYTES } from './comment-storage.js';
import type {
  DataSyncEntryMode,
  DataSyncInventoryProblemCode,
  DataSyncInventorySource,
} from './data-sync-inventory.js';

const DIGEST_PATTERN = /^[0-9a-f]{64}$/;
const OBJECT_ID_PATTERN = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/;
const SOURCE_LABEL_PATTERN = /^[0-9a-z][0-9a-z._-]{0,127}$/;
const SOURCE_MODE_PATTERN = /^[\x21-\x7e]{1,64}$/;
const SOURCE_PATH_MAX_CHARACTERS = 4096;
const SOURCE_PATH_BYTES_BASE64_MAX_CHARACTERS = 8192;
const MANIFEST_MAX_BYTES = 64 * 1024;

const DATA_SYNC_INVENTORY_PROBLEM_CODES = [
  'invalid-comments-root',
  'invalid-path',
  'unexpected-entry',
  'invalid-mode',
  'non-regular',
  'oversized-record',
  'unmaterialized-record',
  'invalid-utf8',
  'invalid-record',
  'noncanonical-bytes',
  'filename-id-mismatch',
  'wrong-shard',
  'duplicate-id',
  'stranded-temp',
] as const satisfies readonly DataSyncInventoryProblemCode[];

const DataSyncInventoryProblemCodeSchema = z.enum(DATA_SYNC_INVENTORY_PROBLEM_CODES);

/** Immutable-comment invariant violations that can produce repair evidence. */
export const NativeCommentViolationKindSchema = z.enum([
  'deleted',
  'modified',
  'reparented',
  'same-id-divergence',
  'invalid-path',
  'invalid-mode',
  'invalid-record',
  'noncanonical-bytes',
  'stranded-temp',
]);

export type NativeCommentViolationKind = z.infer<typeof NativeCommentViolationKindSchema>;

const ManifestSourceSchema = z.discriminatedUnion('kind', [
  z
    .object({ kind: z.literal('filesystem'), label: z.string().regex(SOURCE_LABEL_PATTERN) })
    .strict(),
  z.object({ kind: z.literal('git-ref'), revision: z.string().regex(OBJECT_ID_PATTERN) }).strict(),
  z
    .object({
      kind: z.literal('git-index'),
      stage: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
      head: z.string().regex(OBJECT_ID_PATTERN).optional(),
    })
    .strict(),
]);

const NativeCommentConflictManifestSchema = z
  .object({
    type: z.literal('native_comment_conflict'),
    schema_version: z.literal(1),
    reason: NativeCommentViolationKindSchema,
    comment_id: z.string().refine(validateCommentId).optional(),
    canonical_sha256: z.string().regex(DIGEST_PATTERN).optional(),
    candidate_sha256: z.string().regex(DIGEST_PATTERN).optional(),
    source: ManifestSourceSchema,
    path: z.string().min(1).max(SOURCE_PATH_MAX_CHARACTERS),
    path_bytes_base64: z.string().max(SOURCE_PATH_BYTES_BASE64_MAX_CHARACTERS).optional(),
    mode: z.string().regex(SOURCE_MODE_PATTERN).optional(),
    object_id: z.string().regex(OBJECT_ID_PATTERN).optional(),
    problems: z.array(DataSyncInventoryProblemCodeSchema).max(32),
  })
  .strict();

type NativeCommentConflictManifest = z.infer<typeof NativeCommentConflictManifestSchema>;

const MANIFEST_FIELD_ORDER = [
  'type',
  'schema_version',
  'reason',
  'comment_id',
  'canonical_sha256',
  'candidate_sha256',
  'source',
  'path',
  'path_bytes_base64',
  'mode',
  'object_id',
  'problems',
] as const;

/** Stable evidence needed to preserve one rejected observation. */
export interface NativeCommentQuarantineArtifactInput {
  reason: NativeCommentViolationKind;
  source: DataSyncInventorySource;
  sourcePath: string;
  sourcePathBytesBase64?: string;
  sourceMode?: DataSyncEntryMode;
  sourceObjectId?: string;
  commentId?: InternalCommentId;
  canonicalSha256?: string;
  candidateBytes?: Uint8Array;
  problemCodes?: readonly DataSyncInventoryProblemCode[];
}

/** Validated, content-addressed evidence for one rejected observation. */
export interface NativeCommentQuarantineArtifact {
  readonly scope: InternalCommentId | '_unattributed';
  readonly commentId?: InternalCommentId;
  readonly reason: NativeCommentViolationKind;
  readonly source: DataSyncInventorySource;
  readonly sourcePath: string;
  readonly sourcePathBytesBase64?: string;
  readonly sourceMode?: DataSyncEntryMode;
  readonly sourceObjectId?: string;
  readonly canonicalSha256?: string;
  readonly candidateSha256?: string;
  readonly candidateBytes?: Buffer;
  readonly problemCodes: readonly DataSyncInventoryProblemCode[];
}

/** Result of create-only raw evidence and manifest publication. */
export interface PublishNativeCommentQuarantineResult {
  rawPath?: string;
  manifestPath: string;
  rawStatus?: 'created' | 'existing';
  manifestStatus: 'created' | 'existing';
}

function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function assertDigest(value: string | undefined, field: string): void {
  if (value !== undefined && !DIGEST_PATTERN.test(value)) {
    throw new Error(`Invalid ${field}: ${value}`);
  }
}

function assertRelativeSourcePath(path: string): void {
  const parts = path.split('/');
  if (
    path.length === 0 ||
    path.includes('\\') ||
    posix.isAbsolute(path) ||
    parts.some((part) => part === '..' || part === '')
  ) {
    throw new Error(`Invalid native comment source path: ${path}`);
  }
}

function durableSource(source: DataSyncInventorySource): NativeCommentConflictManifest['source'] {
  if (source.kind === 'filesystem') {
    if (!SOURCE_LABEL_PATTERN.test(source.label)) {
      throw new Error(`Invalid durable filesystem source label: ${source.label}`);
    }
    return { kind: source.kind, label: source.label };
  }
  if (source.kind === 'git-ref') {
    if (!OBJECT_ID_PATTERN.test(source.revision)) {
      throw new Error(`Git-ref inventory source is not resolved: ${source.revision}`);
    }
    return { kind: source.kind, revision: source.revision };
  }
  if (source.head !== undefined && !OBJECT_ID_PATTERN.test(source.head)) {
    throw new Error(`Invalid Git-index HEAD: ${source.head}`);
  }
  return {
    kind: source.kind,
    stage: source.stage,
    ...(source.head === undefined ? {} : { head: source.head }),
  };
}

/** Build validated, deterministic evidence without reading ambient time or paths. */
export function createNativeCommentQuarantineArtifact(
  input: NativeCommentQuarantineArtifactInput,
): NativeCommentQuarantineArtifact {
  const reason = NativeCommentViolationKindSchema.parse(input.reason);
  if (input.commentId !== undefined && !validateCommentId(input.commentId)) {
    throw new Error(`Invalid native comment quarantine identity: ${input.commentId}`);
  }
  assertDigest(input.canonicalSha256, 'canonical SHA-256');
  assertRelativeSourcePath(input.sourcePath);
  if (input.sourcePath.length > SOURCE_PATH_MAX_CHARACTERS) {
    throw new Error('Native comment source path exceeds the manifest bound');
  }
  const source = durableSource(input.source);
  if (input.sourceMode !== undefined && !SOURCE_MODE_PATTERN.test(input.sourceMode)) {
    throw new Error(`Invalid source mode: ${input.sourceMode}`);
  }
  if (input.sourceObjectId !== undefined && !OBJECT_ID_PATTERN.test(input.sourceObjectId)) {
    throw new Error(`Invalid source object ID: ${input.sourceObjectId}`);
  }
  if (
    input.sourcePathBytesBase64 !== undefined &&
    (input.sourcePathBytesBase64.length === 0 ||
      input.sourcePathBytesBase64.length > SOURCE_PATH_BYTES_BASE64_MAX_CHARACTERS ||
      Buffer.from(input.sourcePathBytesBase64, 'base64').toString('base64') !==
        input.sourcePathBytesBase64)
  ) {
    throw new Error('Invalid base64 source path bytes');
  }

  const candidateBytes =
    input.candidateBytes === undefined ? undefined : Buffer.from(input.candidateBytes);
  if (candidateBytes !== undefined && candidateBytes.byteLength > NATIVE_COMMENT_FILE_MAX_BYTES) {
    throw new Error(
      `Native comment quarantine candidate exceeds ${NATIVE_COMMENT_FILE_MAX_BYTES} bytes`,
    );
  }
  const candidateSha256 = candidateBytes === undefined ? undefined : sha256(candidateBytes);
  const problemCodes = DataSyncInventoryProblemCodeSchema.array()
    .max(32)
    .parse(Array.from(new Set(input.problemCodes ?? [])).sort());

  return {
    scope: input.commentId ?? '_unattributed',
    ...(input.commentId === undefined ? {} : { commentId: input.commentId }),
    reason,
    source,
    sourcePath: input.sourcePath,
    ...(input.sourcePathBytesBase64 === undefined
      ? {}
      : { sourcePathBytesBase64: input.sourcePathBytesBase64 }),
    ...(input.sourceMode === undefined ? {} : { sourceMode: input.sourceMode }),
    ...(input.sourceObjectId === undefined ? {} : { sourceObjectId: input.sourceObjectId }),
    ...(input.canonicalSha256 === undefined ? {} : { canonicalSha256: input.canonicalSha256 }),
    ...(candidateSha256 === undefined ? {} : { candidateSha256, candidateBytes }),
    problemCodes,
  };
}

function normalizeNativeCommentQuarantineArtifact(
  artifact: NativeCommentQuarantineArtifact,
): NativeCommentQuarantineArtifact {
  const normalized = createNativeCommentQuarantineArtifact({
    reason: artifact.reason,
    source: artifact.source,
    sourcePath: artifact.sourcePath,
    ...(artifact.sourcePathBytesBase64 === undefined
      ? {}
      : { sourcePathBytesBase64: artifact.sourcePathBytesBase64 }),
    ...(artifact.sourceMode === undefined ? {} : { sourceMode: artifact.sourceMode }),
    ...(artifact.sourceObjectId === undefined ? {} : { sourceObjectId: artifact.sourceObjectId }),
    ...(artifact.commentId === undefined ? {} : { commentId: artifact.commentId }),
    ...(artifact.canonicalSha256 === undefined
      ? {}
      : { canonicalSha256: artifact.canonicalSha256 }),
    ...(artifact.candidateBytes === undefined ? {} : { candidateBytes: artifact.candidateBytes }),
    problemCodes: artifact.problemCodes,
  });
  if (artifact.scope !== normalized.scope) {
    throw new Error('Native comment quarantine scope does not match its comment identity');
  }
  if (artifact.candidateSha256 !== normalized.candidateSha256) {
    throw new Error('Native comment quarantine candidate digest does not match its bytes');
  }
  return normalized;
}

function manifestFor(artifact: NativeCommentQuarantineArtifact): NativeCommentConflictManifest {
  return NativeCommentConflictManifestSchema.parse({
    type: 'native_comment_conflict',
    schema_version: 1,
    reason: artifact.reason,
    ...(artifact.commentId === undefined ? {} : { comment_id: artifact.commentId }),
    ...(artifact.canonicalSha256 === undefined
      ? {}
      : { canonical_sha256: artifact.canonicalSha256 }),
    ...(artifact.candidateSha256 === undefined
      ? {}
      : { candidate_sha256: artifact.candidateSha256 }),
    source: durableSource(artifact.source),
    path: artifact.sourcePath,
    ...(artifact.sourcePathBytesBase64 === undefined
      ? {}
      : { path_bytes_base64: artifact.sourcePathBytesBase64 }),
    ...(artifact.sourceMode === undefined ? {} : { mode: artifact.sourceMode }),
    ...(artifact.sourceObjectId === undefined ? {} : { object_id: artifact.sourceObjectId }),
    problems: artifact.problemCodes,
  });
}

/** Serialize one stable manifest; its digest is its durable identity. */
export function serializeNativeCommentQuarantineManifest(
  artifact: NativeCommentQuarantineArtifact,
): string {
  const manifest = manifestFor(normalizeNativeCommentQuarantineArtifact(artifact));
  return stringifyYaml(
    sortKeys(manifest as unknown as Record<string, unknown>, MANIFEST_FIELD_ORDER),
    { sortMapEntries: false },
  );
}

async function verifyOccupiedPath(path: string, expected: Uint8Array): Promise<void> {
  let observed: Buffer;
  try {
    observed = Buffer.from(
      await readBoundedRegularFileBytes(path, Math.max(expected.byteLength, 1)),
    );
    const metadata = await lstat(path);
    if (process.platform !== 'win32' && (metadata.mode & 0o111) !== 0) {
      throw new Error(`Occupied native-comment quarantine path is executable: ${path}`);
    }
  } catch (error) {
    throw new Error(`Cannot verify occupied native-comment quarantine path ${path}`, {
      cause: error,
    });
  }
  if (!observed.equals(Buffer.from(expected))) {
    throw new Error(`Native-comment quarantine path collision at ${path}`);
  }
}

/** Publish raw bytes before the immutable manifest that refers to them. */
export async function publishNativeCommentQuarantineArtifact(
  dataSyncDir: string,
  artifact: NativeCommentQuarantineArtifact,
  options: CreateOnlyPublicationOptions = {},
): Promise<PublishNativeCommentQuarantineResult> {
  const stableArtifact = normalizeNativeCommentQuarantineArtifact(artifact);
  const manifestBytes = Buffer.from(
    serializeNativeCommentQuarantineManifest(stableArtifact),
    'utf8',
  );
  if (manifestBytes.byteLength > MANIFEST_MAX_BYTES) {
    throw new Error(`Native-comment quarantine manifest exceeds ${MANIFEST_MAX_BYTES} bytes`);
  }
  const manifestDigest = sha256(manifestBytes);
  const scope = stableArtifact.scope;
  if (scope !== '_unattributed' && !validateCommentId(scope)) {
    throw new Error(`Invalid native comment quarantine scope: ${scope}`);
  }

  await ensureRealDirectories(dataSyncDir, ['attic', 'comment-conflicts', scope]);

  let rawPath: string | undefined;
  let rawStatus: 'created' | 'existing' | undefined;
  if (stableArtifact.candidateBytes !== undefined && stableArtifact.candidateSha256 !== undefined) {
    rawPath = join(
      dataSyncDir,
      'attic',
      'comment-conflicts',
      scope,
      `${stableArtifact.candidateSha256}.md`,
    );
    const raw = await publishBytesCreateOnly(rawPath, stableArtifact.candidateBytes, options);
    rawStatus = raw.status;
    if (raw.status === 'existing') {
      await verifyOccupiedPath(rawPath, stableArtifact.candidateBytes);
    }
  }

  await ensureRealDirectories(dataSyncDir, ['attic', 'comment-conflicts', scope, 'observations']);
  const manifestPath = join(
    dataSyncDir,
    'attic',
    'comment-conflicts',
    scope,
    'observations',
    `${manifestDigest}.yml`,
  );
  const manifest = await publishBytesCreateOnly(manifestPath, manifestBytes, options);
  if (manifest.status === 'existing') {
    await verifyOccupiedPath(manifestPath, manifestBytes);
  }

  return {
    ...(rawPath === undefined ? {} : { rawPath }),
    manifestPath,
    ...(rawStatus === undefined ? {} : { rawStatus }),
    manifestStatus: manifest.status,
  };
}
