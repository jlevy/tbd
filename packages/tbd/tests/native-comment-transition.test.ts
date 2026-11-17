import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
  buildDataSyncInventory,
  type DataSyncInventory,
  type DataSyncInventoryEntry,
} from '../src/file/data-sync-inventory.js';
import { serializeNativeComment } from '../src/file/comment-parser.js';
import { commentShard } from '../src/file/comment-storage.js';
import {
  classifyNativeCommentTransitions,
  type NativeCommentTransitionPlan,
} from '../src/file/native-comment-transition.js';
import { asInternalCommentId, type InternalCommentId } from '../src/lib/ids.js';
import type { NativeComment } from '../src/lib/native-comment.js';
import { TEST_ULIDS, testId } from './test-helpers.js';

const COMMENT_A = asInternalCommentId(`cm-${TEST_ULIDS.ULID_1}`);
const COMMENT_B = asInternalCommentId(`cm-${TEST_ULIDS.ULID_2}`);
const ISSUE_A = testId(TEST_ULIDS.ULID_3);
const ISSUE_B = testId(TEST_ULIDS.ULID_4);
const REVISION_A = 'a'.repeat(40);
const REVISION_B = 'b'.repeat(40);
const REVISION_C = 'c'.repeat(40);

type InventoryInput = Parameters<typeof buildDataSyncInventory>[1][number];
type InventorySource = Parameters<typeof buildDataSyncInventory>[0];

function makeComment(id: InternalCommentId, overrides: Partial<NativeComment> = {}): NativeComment {
  return {
    type: 'cm',
    id,
    issue_id: ISSUE_A,
    author: {
      kind: 'agent',
      display_name: 'codex.rectifier',
      agent_id: `agid-${TEST_ULIDS.ULID_5}`,
      provenance: { harness: 'codex', model: 'test' },
    },
    created_at: '2026-09-08T12:00:00.000Z',
    body: `Native comment ${id}`,
    ...overrides,
  };
}

function canonicalInput(comment: NativeComment, path = canonicalPath(comment.id)): InventoryInput {
  const bytes = Buffer.from(serializeNativeComment(comment), 'utf8');
  return { path, mode: '100644', size: bytes.length, bytes };
}

function canonicalPath(id: string): string {
  return `comments/${commentShard(asInternalCommentId(id))}/${id}.md`;
}

function inventory(source: InventorySource, inputs: readonly InventoryInput[]) {
  return buildDataSyncInventory(source, inputs);
}

class CountingEntriesMap extends Map<string, DataSyncInventoryEntry> {
  valueIterations = 0;

  override values() {
    this.valueIterations += 1;
    return super.values();
  }
}

function withCountingEntries(snapshot: DataSyncInventory): {
  inventory: DataSyncInventory;
  entries: CountingEntriesMap;
} {
  const entries = new CountingEntriesMap(snapshot.entriesByPath);
  return { inventory: { ...snapshot, entriesByPath: entries }, entries };
}

function digest(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function planSummary(plan: NativeCommentTransitionPlan): unknown {
  return {
    status: plan.status,
    decisions: Array.from(plan.decisions.values()).map((decision) => ({
      id: decision.id,
      status: decision.status,
      canonicalSha256: decision.canonical?.sha256,
      violations: decision.violations.map((violation) => ({
        kind: violation.kind,
        source: violation.source,
        sourcePath: violation.sourcePath,
        recoverability: violation.recoverability,
        candidateSha256: violation.artifact?.candidateSha256,
      })),
    })),
    unscoped: plan.unscopedViolations.map((violation) => ({
      kind: violation.kind,
      source: violation.source,
      sourcePath: violation.sourcePath,
      recoverability: violation.recoverability,
      candidateSha256: violation.artifact?.candidateSha256,
    })),
    artifacts: plan.quarantineArtifacts.map((artifact) => ({
      reason: artifact.reason,
      source: artifact.source,
      sourcePath: artifact.sourcePath,
      candidateSha256: artifact.candidateSha256,
    })),
  };
}

describe('classifyNativeCommentTransitions', () => {
  it('accepts a new immutable identity and does not interpret unrelated absence as deletion', () => {
    const comment = makeComment(COMMENT_A);
    const plan = classifyNativeCommentTransitions({
      base: inventory({ kind: 'git-ref', revision: REVISION_A }, []),
      candidates: [
        inventory({ kind: 'git-ref', revision: REVISION_B }, [canonicalInput(comment)]),
        inventory({ kind: 'git-ref', revision: REVISION_C }, []),
      ],
    });

    expect(plan.status).toBe('clean');
    expect(plan.decisions.get(COMMENT_A)).toMatchObject({
      status: 'accepted-add',
      canonical: { comment },
      violations: [],
    });
    expect(plan.quarantineArtifacts).toEqual([]);
  });

  it('accepts byte-identical existing records from every candidate', () => {
    const comment = makeComment(COMMENT_A);
    const input = canonicalInput(comment);
    const plan = classifyNativeCommentTransitions({
      base: inventory({ kind: 'git-ref', revision: REVISION_A }, [input]),
      candidates: [
        inventory({ kind: 'git-ref', revision: REVISION_B }, [input]),
        inventory({ kind: 'filesystem', label: 'worktree' }, [input]),
      ],
    });

    expect(plan.status).toBe('clean');
    expect(plan.decisions.get(COMMENT_A)).toMatchObject({
      status: 'accepted-existing',
      violations: [],
    });
  });

  it('preserves deletion evidence while retaining the parent record', () => {
    const input = canonicalInput(makeComment(COMMENT_A));
    const base = inventory({ kind: 'git-ref', revision: REVISION_A }, [input]);
    const plan = classifyNativeCommentTransitions({
      base,
      candidates: [inventory({ kind: 'git-ref', revision: REVISION_B }, [])],
    });

    const decision = plan.decisions.get(COMMENT_A);
    expect(plan.status).toBe('repairable');
    expect(decision).toMatchObject({
      status: 'repairable',
      canonical: base.commentsById.get(COMMENT_A),
      violations: [
        {
          kind: 'deleted',
          recoverability: 'repairable',
          artifact: {
            canonicalSha256: digest(input.bytes!),
          },
        },
      ],
    });
  });

  it.each([
    { kind: 'modified', overrides: { body: 'Mutated immutable body' } },
    { kind: 'reparented', overrides: { issue_id: ISSUE_B } },
  ] as const)(
    'classifies a $kind record and preserves its exact alternative',
    ({ kind, overrides }) => {
      const original = canonicalInput(makeComment(COMMENT_A));
      const changed = canonicalInput(makeComment(COMMENT_A, overrides));
      const plan = classifyNativeCommentTransitions({
        base: inventory({ kind: 'git-ref', revision: REVISION_A }, [original]),
        candidates: [inventory({ kind: 'git-ref', revision: REVISION_B }, [changed])],
      });

      expect(plan.status).toBe('repairable');
      expect(plan.decisions.get(COMMENT_A)?.violations).toEqual([
        expect.objectContaining({
          kind,
          recoverability: 'repairable',
          artifact: expect.objectContaining({
            candidateBytes: changed.bytes,
            candidateSha256: digest(changed.bytes!),
            canonicalSha256: digest(original.bytes!),
          }),
        }),
      ]);
    },
  );

  it('reports a wrong-shard move as deletion plus an invalid alternative', () => {
    const comment = makeComment(COMMENT_A);
    const original = canonicalInput(comment);
    const wrongShard = commentShard(COMMENT_A) === '00' ? '01' : '00';
    const moved = canonicalInput(comment, `comments/${wrongShard}/${COMMENT_A}.md`);
    const plan = classifyNativeCommentTransitions({
      base: inventory({ kind: 'git-ref', revision: REVISION_A }, [original]),
      candidates: [inventory({ kind: 'git-ref', revision: REVISION_B }, [moved])],
    });

    expect(
      plan.decisions
        .get(COMMENT_A)
        ?.violations.map((violation) => violation.kind)
        .sort(),
    ).toEqual(['deleted', 'invalid-path']);
    expect(plan.quarantineArtifacts).toHaveLength(2);
    expect(
      plan.quarantineArtifacts.find((artifact) => artifact.reason === 'invalid-path'),
    ).toMatchObject({ candidateBytes: moved.bytes, sourcePath: moved.path });
  });

  it('blocks both identities when a filename and embedded record disagree', () => {
    const mismatched = canonicalInput(makeComment(COMMENT_B), canonicalPath(COMMENT_A));
    const plan = classifyNativeCommentTransitions({
      base: inventory({ kind: 'git-ref', revision: REVISION_A }, []),
      candidates: [inventory({ kind: 'git-ref', revision: REVISION_B }, [mismatched])],
    });

    expect(plan.status).toBe('blocked');
    expect(Array.from(plan.decisions.keys())).toEqual([COMMENT_A, COMMENT_B].sort());
    for (const id of [COMMENT_A, COMMENT_B]) {
      expect(plan.decisions.get(id)).toMatchObject({
        status: 'blocked',
        violations: [
          {
            kind: 'invalid-path',
            commentId: id,
            recoverability: 'blocked',
            problemCodes: expect.arrayContaining(['filename-id-mismatch']),
          },
        ],
      });
    }
    expect(plan.quarantineArtifacts).toHaveLength(1);
    expect(plan.quarantineArtifacts[0]).toMatchObject({
      scope: COMMENT_A,
      commentId: COMMENT_A,
      candidateBytes: mismatched.bytes,
    });
  });

  it('chooses the same content winner for divergent additions regardless of source order', () => {
    const first = canonicalInput(makeComment(COMMENT_A, { body: 'First candidate' }));
    const second = canonicalInput(makeComment(COMMENT_A, { body: 'Second candidate' }));
    const sourceA = inventory({ kind: 'git-ref', revision: REVISION_A }, [first]);
    const sourceB = inventory({ kind: 'git-ref', revision: REVISION_B }, [second]);

    const forward = classifyNativeCommentTransitions({
      base: null,
      candidates: [sourceA, sourceB],
    });
    const reverse = classifyNativeCommentTransitions({
      base: null,
      candidates: [sourceB, sourceA],
    });
    const winningDigest = [digest(first.bytes!), digest(second.bytes!)].sort()[0];

    expect(planSummary(reverse)).toEqual(planSummary(forward));
    expect(forward.status).toBe('repairable');
    expect(forward.decisions.get(COMMENT_A)).toMatchObject({
      status: 'repairable',
      canonical: { sha256: winningDigest },
      violations: [{ kind: 'same-id-divergence', recoverability: 'repairable' }],
    });
  });

  it('blocks an invalid parent rather than allowing a candidate to replace it', () => {
    const valid = canonicalInput(makeComment(COMMENT_A));
    const invalidBytes = Buffer.concat([valid.bytes!, Buffer.from('\n')]);
    const invalid = { ...valid, size: invalidBytes.length, bytes: invalidBytes };
    const plan = classifyNativeCommentTransitions({
      base: inventory({ kind: 'git-ref', revision: REVISION_A }, [invalid]),
      candidates: [inventory({ kind: 'git-ref', revision: REVISION_B }, [valid])],
    });

    expect(plan.status).toBe('blocked');
    expect(plan.decisions.get(COMMENT_A)).toMatchObject({
      status: 'blocked',
      violations: [
        {
          kind: 'noncanonical-bytes',
          recoverability: 'blocked',
          artifact: { candidateBytes: invalidBytes },
        },
      ],
    });
  });

  it('does not mistake a directory at a canonical record path for deletion', () => {
    const original = canonicalInput(makeComment(COMMENT_A));
    const plan = classifyNativeCommentTransitions({
      base: inventory({ kind: 'git-ref', revision: REVISION_A }, [original]),
      candidates: [
        inventory({ kind: 'git-ref', revision: REVISION_B }, [
          { path: original.path, mode: '040000', size: 0 },
        ]),
      ],
    });
    const violations = plan.decisions.get(COMMENT_A)?.violations;

    expect(plan.status).toBe('blocked');
    expect(violations).toEqual([
      expect.objectContaining({
        kind: 'invalid-path',
        commentId: COMMENT_A,
        sourcePath: original.path,
        recoverability: 'blocked',
      }),
    ]);
    expect(violations).not.toContainEqual(expect.objectContaining({ kind: 'deleted' }));
  });

  it('blocks an unmaterialized candidate without inventing a deletion', () => {
    const original = canonicalInput(makeComment(COMMENT_A));
    const unavailable: InventoryInput = {
      path: original.path,
      mode: '100644',
      size: original.size,
    };
    const plan = classifyNativeCommentTransitions({
      base: inventory({ kind: 'git-ref', revision: REVISION_A }, [original]),
      candidates: [inventory({ kind: 'filesystem', label: 'unmaterialized' }, [unavailable])],
    });

    expect(plan.status).toBe('blocked');
    expect(plan.decisions.get(COMMENT_A)?.violations).toEqual([
      expect.objectContaining({
        kind: 'invalid-record',
        recoverability: 'blocked',
        problemCodes: ['unmaterialized-record'],
      }),
    ]);
    expect(plan.decisions.get(COMMENT_A)?.violations).not.toContainEqual(
      expect.objectContaining({ kind: 'deleted' }),
    );
  });

  it('quarantines a preservable unscoped candidate without manufacturing an identity', () => {
    const bytes = Buffer.from('not a native comment\n');
    const plan = classifyNativeCommentTransitions({
      base: inventory({ kind: 'git-ref', revision: REVISION_A }, []),
      candidates: [
        inventory({ kind: 'git-ref', revision: REVISION_B }, [
          {
            path: 'comments/stray.md',
            mode: '100644',
            size: bytes.length,
            bytes,
          },
        ]),
      ],
    });

    expect(plan.decisions.size).toBe(0);
    expect(plan.status).toBe('repairable');
    expect(plan.unscopedViolations).toEqual([
      expect.objectContaining({
        kind: 'invalid-path',
        recoverability: 'repairable',
        artifact: expect.objectContaining({
          scope: '_unattributed',
          candidateBytes: bytes,
        }),
      }),
    ]);
  });

  it('preserves unsafe source path bytes through a durable diagnostic path', () => {
    const unsafePath = 'comments/literal\\backslash.md';
    const candidate = canonicalInput(makeComment(COMMENT_A), unsafePath);
    const plan = classifyNativeCommentTransitions({
      base: inventory({ kind: 'git-ref', revision: REVISION_A }, []),
      candidates: [inventory({ kind: 'filesystem', label: 'worktree' }, [candidate])],
    });

    expect(plan.status).toBe('blocked');
    expect(plan.decisions.get(COMMENT_A)?.violations).toEqual([
      expect.objectContaining({
        kind: 'invalid-path',
        recoverability: 'blocked',
        sourcePath: expect.stringMatching(/^<unsafe-data-sync-path:[0-9a-f]{64}>$/),
        artifact: expect.objectContaining({
          sourcePathBytesBase64: Buffer.from(unsafePath).toString('base64'),
          candidateBytes: candidate.bytes,
        }),
      }),
    ]);
  });

  it('blocks an observation whose provenance cannot fit a bounded manifest', () => {
    const candidate = canonicalInput(makeComment(COMMENT_A), `comments/${'x'.repeat(5000)}`);
    const plan = classifyNativeCommentTransitions({
      base: inventory({ kind: 'git-ref', revision: REVISION_A }, []),
      candidates: [inventory({ kind: 'filesystem', label: 'worktree' }, [candidate])],
    });

    expect(plan.status).toBe('blocked');
    const violations = plan.decisions.get(COMMENT_A)?.violations;
    expect(violations).toEqual([
      expect.objectContaining({
        kind: 'invalid-path',
        recoverability: 'blocked',
      }),
    ]);
    expect(violations?.[0]).not.toHaveProperty('artifact');
    expect(plan.quarantineArtifacts).toEqual([]);
  });

  it('classifies independent identities without coupling their outcomes', () => {
    const existing = canonicalInput(makeComment(COMMENT_A));
    const addition = canonicalInput(makeComment(COMMENT_B));
    const plan = classifyNativeCommentTransitions({
      base: inventory({ kind: 'git-ref', revision: REVISION_A }, [existing]),
      candidates: [inventory({ kind: 'git-ref', revision: REVISION_B }, [existing, addition])],
    });

    expect(plan.status).toBe('clean');
    expect(Array.from(plan.decisions.values()).map(({ id, status }) => ({ id, status }))).toEqual([
      { id: COMMENT_A, status: 'accepted-existing' },
      { id: COMMENT_B, status: 'accepted-add' },
    ]);
  });

  it('indexes invalid entries once per inventory instead of rescanning for each identity', () => {
    const inputs = [canonicalInput(makeComment(COMMENT_A)), canonicalInput(makeComment(COMMENT_B))];
    const base = withCountingEntries(inventory({ kind: 'git-ref', revision: REVISION_A }, inputs));
    const candidate = withCountingEntries(
      inventory({ kind: 'git-ref', revision: REVISION_B }, inputs),
    );

    const plan = classifyNativeCommentTransitions({
      base: base.inventory,
      candidates: [candidate.inventory],
    });

    expect(plan.status).toBe('clean');
    expect(base.entries.valueIterations).toBe(1);
    expect(candidate.entries.valueIterations).toBe(1);
  });

  it('requires at least one candidate snapshot', () => {
    expect(() => classifyNativeCommentTransitions({ base: null, candidates: [] })).toThrow(
      /requires a candidate/,
    );
  });

  it('refuses a sparse index stage until a guard composes a complete logical side', () => {
    const input = { ...canonicalInput(makeComment(COMMENT_A)), stage: 2 as const };
    const sparse = inventory({ kind: 'git-index', stage: 2, head: REVISION_B }, [input]);

    expect(() =>
      classifyNativeCommentTransitions({
        base: inventory({ kind: 'git-ref', revision: REVISION_A }, []),
        candidates: [sparse],
      }),
    ).toThrow(/requires full-tree coverage/);
  });
});
