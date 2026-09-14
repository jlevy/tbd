/** Pure classification of immutable native-comment transitions. */

import type { InternalCommentId } from '../lib/ids.js';
import type {
  DataSyncInventory,
  DataSyncInventoryEntry,
  DataSyncInventoryProblemCode,
  DataSyncInventorySource,
  NativeCommentInventoryRecord,
} from './data-sync-inventory.js';
import {
  createNativeCommentQuarantineArtifact,
  type NativeCommentQuarantineArtifact,
  type NativeCommentViolationKind,
} from './native-comment-quarantine.js';

/** Inputs for one worktree, merge, import, or unrelated-history decision. */
export interface ClassifyNativeCommentTransitionsInput {
  /** Authoritative common parent, or null when no history has observed these identities. */
  base: DataSyncInventory | null;
  /** One worktree target, two merge sides, or an N-way recovery/import set. */
  candidates: readonly DataSyncInventory[];
}

/** One rejected observation and the evidence available to repair it. */
export interface NativeCommentTransitionViolation {
  kind: NativeCommentViolationKind;
  commentId?: InternalCommentId;
  source: DataSyncInventorySource;
  sourcePath: string;
  problemCodes: readonly DataSyncInventoryProblemCode[];
  recoverability: 'repairable' | 'blocked';
  artifact?: NativeCommentQuarantineArtifact;
}

/** Stable decision for one immutable identity. */
export interface NativeCommentTransitionDecision {
  id: InternalCommentId;
  status: 'accepted-add' | 'accepted-existing' | 'repairable' | 'blocked';
  canonical?: NativeCommentInventoryRecord;
  violations: readonly NativeCommentTransitionViolation[];
}

/** Complete deterministic transition classification. */
export interface NativeCommentTransitionPlan {
  status: 'clean' | 'repairable' | 'blocked';
  decisions: ReadonlyMap<InternalCommentId, NativeCommentTransitionDecision>;
  unscopedViolations: readonly NativeCommentTransitionViolation[];
  quarantineArtifacts: readonly NativeCommentQuarantineArtifact[];
}

function sourceKey(source: DataSyncInventorySource): string {
  switch (source.kind) {
    case 'filesystem':
      return `0:${source.label}`;
    case 'git-ref':
      return `1:${source.revision}`;
    case 'git-index':
      return `2:${source.stage}:${source.head ?? ''}`;
  }
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function compareSources(left: DataSyncInventory, right: DataSyncInventory): number {
  return compareStrings(sourceKey(left.source), sourceKey(right.source));
}

function assertFullTreeInventory(inventory: DataSyncInventory, role: string): void {
  if (inventory.coverage !== 'full-tree') {
    throw new Error(
      `Native-comment transition ${role} requires full-tree coverage; ` +
        'compose sparse Git index stages into a logical side first',
    );
  }
}

function problemKind(
  problems: readonly DataSyncInventoryProblemCode[],
): NativeCommentViolationKind {
  if (problems.includes('stranded-temp')) {
    return 'stranded-temp';
  }
  if (problems.includes('noncanonical-bytes')) {
    return 'noncanonical-bytes';
  }
  if (problems.includes('invalid-mode') || problems.includes('non-regular')) {
    return 'invalid-mode';
  }
  if (
    problems.some((problem) =>
      [
        'invalid-comments-root',
        'invalid-path',
        'unexpected-entry',
        'filename-id-mismatch',
        'wrong-shard',
        'duplicate-id',
      ].includes(problem),
    )
  ) {
    return 'invalid-path';
  }
  return 'invalid-record';
}

function primaryEntryCommentId(entry: DataSyncInventoryEntry): InternalCommentId | undefined {
  return entry.pathCommentId ?? entry.embeddedCommentId;
}

function entryArtifact(
  inventory: DataSyncInventory,
  entry: DataSyncInventoryEntry,
  kind: NativeCommentViolationKind,
  canonicalSha256?: string,
): NativeCommentQuarantineArtifact | undefined {
  if (entry.bytes === undefined) {
    return undefined;
  }
  try {
    return createNativeCommentQuarantineArtifact({
      reason: kind,
      source: inventory.source,
      sourcePath: entry.path,
      ...(entry.rawPathBase64 === undefined ? {} : { sourcePathBytesBase64: entry.rawPathBase64 }),
      sourceMode: entry.mode,
      ...(entry.objectId === undefined ? {} : { sourceObjectId: entry.objectId }),
      ...(primaryEntryCommentId(entry) === undefined
        ? {}
        : { commentId: primaryEntryCommentId(entry) }),
      ...(canonicalSha256 === undefined ? {} : { canonicalSha256 }),
      candidateBytes: entry.bytes,
      problemCodes: entry.problems,
    });
  } catch {
    // The inventory can retain more provenance than a bounded manifest can encode.
    // That observation must block mutation instead of producing partial evidence.
    return undefined;
  }
}

function recordArtifact(
  record: NativeCommentInventoryRecord,
  kind: NativeCommentViolationKind,
  canonicalSha256?: string,
): NativeCommentQuarantineArtifact {
  return createNativeCommentQuarantineArtifact({
    reason: kind,
    source: record.source,
    sourcePath: record.path,
    sourceMode: record.mode,
    ...(record.objectId === undefined ? {} : { sourceObjectId: record.objectId }),
    commentId: record.id,
    ...(canonicalSha256 === undefined ? {} : { canonicalSha256 }),
    candidateBytes: record.bytes,
  });
}

function violationFromEntry(
  inventory: DataSyncInventory,
  entry: DataSyncInventoryEntry,
  canonicalSha256?: string,
  forceBlocked = false,
  decisionCommentId = primaryEntryCommentId(entry),
): NativeCommentTransitionViolation {
  const kind = problemKind(entry.problems);
  const artifact = entryArtifact(inventory, entry, kind, canonicalSha256);
  return {
    kind,
    ...(decisionCommentId === undefined ? {} : { commentId: decisionCommentId }),
    source: inventory.source,
    sourcePath: entry.path,
    problemCodes: entry.problems,
    recoverability: forceBlocked || artifact === undefined ? 'blocked' : 'repairable',
    ...(artifact === undefined ? {} : { artifact }),
  };
}

function violationFromRecord(
  record: NativeCommentInventoryRecord,
  kind: NativeCommentViolationKind,
  canonicalSha256: string,
): NativeCommentTransitionViolation {
  const artifact = recordArtifact(record, kind, canonicalSha256);
  return {
    kind,
    commentId: record.id,
    source: record.source,
    sourcePath: record.path,
    problemCodes: [],
    recoverability: 'repairable',
    artifact,
  };
}

function deletionViolation(
  source: DataSyncInventorySource,
  base: NativeCommentInventoryRecord,
): NativeCommentTransitionViolation {
  const artifact = createNativeCommentQuarantineArtifact({
    reason: 'deleted',
    source,
    sourcePath: base.path,
    commentId: base.id,
    canonicalSha256: base.sha256,
  });
  return {
    kind: 'deleted',
    commentId: base.id,
    source,
    sourcePath: base.path,
    problemCodes: [],
    recoverability: 'repairable',
    artifact,
  };
}

interface InvalidEntryIndex {
  all: readonly DataSyncInventoryEntry[];
  byClaimedId: ReadonlyMap<InternalCommentId, readonly DataSyncInventoryEntry[]>;
}

function indexInvalidEntries(inventory: DataSyncInventory): InvalidEntryIndex {
  const all: DataSyncInventoryEntry[] = [];
  const byClaimedId = new Map<InternalCommentId, DataSyncInventoryEntry[]>();

  for (const entry of inventory.entriesByPath.values()) {
    if (entry.problems.length === 0) {
      continue;
    }
    all.push(entry);
    const claimedIds = new Set<InternalCommentId>();
    if (entry.pathCommentId !== undefined) {
      claimedIds.add(entry.pathCommentId);
    }
    if (entry.embeddedCommentId !== undefined) {
      claimedIds.add(entry.embeddedCommentId);
    }
    for (const id of claimedIds) {
      const entries = byClaimedId.get(id) ?? [];
      entries.push(entry);
      byClaimedId.set(id, entries);
    }
  }

  return { all, byClaimedId };
}

function invalidEntriesForId(
  index: InvalidEntryIndex,
  id: InternalCommentId,
): readonly DataSyncInventoryEntry[] {
  return index.byClaimedId.get(id) ?? [];
}

function violationKey(violation: NativeCommentTransitionViolation): string {
  const artifact = violation.artifact;
  return [
    violation.kind,
    violation.commentId ?? '',
    sourceKey(violation.source),
    violation.sourcePath,
    violation.recoverability,
    artifact?.canonicalSha256 ?? '',
    artifact?.candidateSha256 ?? '',
    artifact?.sourcePathBytesBase64 ?? '',
    artifact?.sourceMode ?? '',
    artifact?.sourceObjectId ?? '',
    violation.problemCodes.join(','),
  ].join('\0');
}

function sortAndDedupeViolations(
  violations: readonly NativeCommentTransitionViolation[],
): NativeCommentTransitionViolation[] {
  const unique = new Map<string, NativeCommentTransitionViolation>();
  for (const violation of violations) {
    unique.set(violationKey(violation), violation);
  }
  return Array.from(unique.values()).sort((left, right) =>
    compareStrings(violationKey(left), violationKey(right)),
  );
}

function artifactKey(artifact: NativeCommentQuarantineArtifact): string {
  return [
    artifact.reason,
    artifact.commentId ?? '',
    sourceKey(artifact.source),
    artifact.sourcePath,
    artifact.sourcePathBytesBase64 ?? '',
    artifact.sourceMode ?? '',
    artifact.sourceObjectId ?? '',
    artifact.canonicalSha256 ?? '',
    artifact.candidateSha256 ?? '',
    artifact.problemCodes.join(','),
  ].join('\0');
}

function sourceIncompleteViolation(inventory: DataSyncInventory): NativeCommentTransitionViolation {
  return {
    kind: 'invalid-record',
    source: inventory.source,
    sourcePath: 'comments',
    problemCodes: [],
    recoverability: 'blocked',
  };
}

/**
 * Classify additions and every incompatible change without mutating a tree.
 *
 * The common parent always wins an observed identity. With no common parent, a
 * divergent add/add set chooses the lexicographically smallest content digest so every
 * clone reaches the same repair plan regardless of input order.
 */
export function classifyNativeCommentTransitions(
  input: ClassifyNativeCommentTransitionsInput,
): NativeCommentTransitionPlan {
  if (input.candidates.length === 0) {
    throw new Error('Native-comment transition classification requires a candidate');
  }
  if (input.base !== null) {
    assertFullTreeInventory(input.base, 'base');
  }
  for (const candidate of input.candidates) {
    assertFullTreeInventory(candidate, 'candidate');
  }
  const candidates = [...input.candidates].sort(compareSources);
  const invalidEntryIndexes = new Map<DataSyncInventory, InvalidEntryIndex>();
  for (const inventory of [input.base, ...candidates]) {
    if (inventory !== null && !invalidEntryIndexes.has(inventory)) {
      invalidEntryIndexes.set(inventory, indexInvalidEntries(inventory));
    }
  }
  const invalidEntryIndexFor = (inventory: DataSyncInventory): InvalidEntryIndex => {
    const index = invalidEntryIndexes.get(inventory);
    if (index === undefined) {
      throw new Error('Native-comment transition classifier lost an inventory index');
    }
    return index;
  };
  const ids = new Set<InternalCommentId>();
  for (const inventory of [input.base, ...candidates]) {
    if (inventory === null) {
      continue;
    }
    for (const id of inventory.commentsById.keys()) {
      ids.add(id);
    }
    for (const entry of invalidEntryIndexFor(inventory).all) {
      if (entry.pathCommentId !== undefined) {
        ids.add(entry.pathCommentId);
      }
      if (entry.embeddedCommentId !== undefined) {
        ids.add(entry.embeddedCommentId);
      }
    }
  }

  const decisions = new Map<InternalCommentId, NativeCommentTransitionDecision>();
  const allViolations: NativeCommentTransitionViolation[] = [];

  for (const id of Array.from(ids).sort(compareStrings)) {
    const violations: NativeCommentTransitionViolation[] = [];
    const baseRecord = input.base?.commentsById.get(id);
    const baseInvalid =
      input.base === null ? [] : invalidEntriesForId(invalidEntryIndexFor(input.base), id);

    if (input.base !== null && (baseInvalid.length > 0 || !input.base.complete)) {
      for (const entry of baseInvalid) {
        violations.push(violationFromEntry(input.base, entry, undefined, true, id));
      }
      if (!input.base.complete && baseInvalid.length === 0) {
        violations.push(sourceIncompleteViolation(input.base));
      }
    }

    if (baseRecord !== undefined && baseInvalid.length === 0 && input.base?.complete) {
      for (const candidate of candidates) {
        const record = candidate.commentsById.get(id);
        const candidateInvalid = invalidEntriesForId(invalidEntryIndexFor(candidate), id);

        if (record !== undefined) {
          if (!record.bytes.equals(baseRecord.bytes)) {
            const kind =
              record.comment.issue_id === baseRecord.comment.issue_id ? 'modified' : 'reparented';
            violations.push(violationFromRecord(record, kind, baseRecord.sha256));
          }
        } else if (!candidateInvalid.some((entry) => entry.path === baseRecord.path)) {
          violations.push(deletionViolation(candidate.source, baseRecord));
        }

        for (const entry of candidateInvalid) {
          violations.push(violationFromEntry(candidate, entry, baseRecord.sha256, false, id));
        }
        if (!candidate.complete && candidateInvalid.length === 0) {
          violations.push(sourceIncompleteViolation(candidate));
        }
      }

      const stableViolations = sortAndDedupeViolations(violations);
      const blocked = stableViolations.some((violation) => violation.recoverability === 'blocked');
      decisions.set(id, {
        id,
        status: blocked
          ? 'blocked'
          : stableViolations.length > 0
            ? 'repairable'
            : 'accepted-existing',
        canonical: baseRecord,
        violations: stableViolations,
      });
      allViolations.push(...stableViolations);
      continue;
    }

    if (input.base !== null && (baseInvalid.length > 0 || !input.base.complete)) {
      for (const candidate of candidates) {
        for (const entry of invalidEntriesForId(invalidEntryIndexFor(candidate), id)) {
          violations.push(violationFromEntry(candidate, entry, undefined, true, id));
        }
      }
      const stableViolations = sortAndDedupeViolations(violations);
      decisions.set(id, { id, status: 'blocked', violations: stableViolations });
      allViolations.push(...stableViolations);
      continue;
    }

    const validRecords = candidates
      .map((inventory) => inventory.commentsById.get(id))
      .filter((record): record is NativeCommentInventoryRecord => record !== undefined)
      .sort((left, right) =>
        left.sha256 === right.sha256
          ? compareStrings(sourceKey(left.source), sourceKey(right.source))
          : compareStrings(left.sha256, right.sha256),
      );
    const canonical = validRecords[0];
    if (canonical !== undefined) {
      for (const record of validRecords) {
        if (record.sha256 !== canonical.sha256) {
          violations.push(violationFromRecord(record, 'same-id-divergence', canonical.sha256));
        }
      }
    }
    for (const candidate of candidates) {
      for (const entry of invalidEntriesForId(invalidEntryIndexFor(candidate), id)) {
        violations.push(
          violationFromEntry(candidate, entry, canonical?.sha256, canonical === undefined, id),
        );
      }
      if (!candidate.complete) {
        violations.push(sourceIncompleteViolation(candidate));
      }
    }

    const stableViolations = sortAndDedupeViolations(violations);
    const blocked =
      canonical === undefined ||
      stableViolations.some((violation) => violation.recoverability === 'blocked');
    decisions.set(id, {
      id,
      status: blocked ? 'blocked' : stableViolations.length > 0 ? 'repairable' : 'accepted-add',
      ...(canonical === undefined ? {} : { canonical }),
      violations: stableViolations,
    });
    allViolations.push(...stableViolations);
  }

  const unscopedViolations: NativeCommentTransitionViolation[] = [];
  for (const inventory of [input.base, ...candidates]) {
    if (inventory === null) {
      continue;
    }
    for (const entry of invalidEntryIndexFor(inventory).all) {
      if (entry.pathCommentId === undefined && entry.embeddedCommentId === undefined) {
        unscopedViolations.push(
          violationFromEntry(inventory, entry, undefined, inventory === input.base),
        );
      }
    }
    if (!inventory.complete) {
      unscopedViolations.push(sourceIncompleteViolation(inventory));
    }
  }
  const stableUnscoped = sortAndDedupeViolations(unscopedViolations);
  allViolations.push(...stableUnscoped);

  const artifacts = new Map<string, NativeCommentQuarantineArtifact>();
  for (const violation of allViolations) {
    if (violation.artifact !== undefined) {
      artifacts.set(artifactKey(violation.artifact), violation.artifact);
    }
  }
  const quarantineArtifacts = Array.from(artifacts.values()).sort((left, right) =>
    compareStrings(artifactKey(left), artifactKey(right)),
  );
  const blocked = allViolations.some((violation) => violation.recoverability === 'blocked');

  return {
    status: blocked ? 'blocked' : allViolations.length > 0 ? 'repairable' : 'clean',
    decisions,
    unscopedViolations: stableUnscoped,
    quarantineArtifacts,
  };
}
