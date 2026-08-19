/**
 * The reconcile matrix, exercised cell by cell.
 *
 * Two properties matter above the individual cells: echo suppression falls out
 * of base comparison (a re-fetch of our own push produces an empty result even
 * with a bumped updatedAt), and no path ever loses a value silently — every
 * discard appears in conflicts, overwrites, or skippedPushes.
 */

import { describe, expect, it } from 'vitest';

import { descriptionHash } from '../src/integrations/core/bridge-state.js';
import { MANAGED_BLOCK_MARKERS } from '../src/integrations/core/managed-block.js';
import { reconcile, type LocalView, type RemoteView } from '../src/integrations/core/reconcile.js';
import { FieldSyncClauseSchema } from '../src/lib/schemas.js';
import type { BridgeBase, FieldSyncClause } from '../src/lib/types.js';

const RULES: FieldSyncClause = FieldSyncClauseSchema.parse({});

function local(overrides: Partial<LocalView> = {}): LocalView {
  return {
    title: 'T',
    description: 'Body',
    status: 'open',
    priority: 2,
    labels: [],
    assignee: null,
    updated_at: '2026-08-10T12:00:00.000Z',
    ...overrides,
  };
}

function remote(overrides: Partial<RemoteView> = {}): RemoteView {
  return {
    title: 'T',
    description: 'Body',
    status: 'open',
    priority: 2,
    labels: [],
    assignee: null,
    updatedAt: '2026-08-10T12:00:00.000Z',
    ...overrides,
  };
}

function base(overrides: Partial<BridgeBase> = {}): BridgeBase {
  return {
    title: 'T',
    status: 'open',
    priority: 2,
    labels: [],
    assignee: null,
    description_hash: descriptionHash('Body'),
    ...overrides,
  };
}

function empty(result: ReturnType<typeof reconcile>): boolean {
  return (
    Object.keys(result.beadPatch).length === 0 &&
    Object.keys(result.externalPatch).length === 0 &&
    result.conflicts.length === 0 &&
    result.overwrites.length === 0 &&
    result.skippedPushes.length === 0
  );
}

describe('the merge matrix', () => {
  it('does nothing when nothing changed', () => {
    expect(empty(reconcile(base(), local(), remote(), RULES))).toBe(true);
  });

  it('pushes a local-only change', () => {
    const result = reconcile(base(), local({ title: 'New' }), remote(), RULES);
    expect(result.externalPatch.title).toBe('New');
    expect(result.beadPatch).toEqual({});
    expect(result.conflicts).toEqual([]);
    expect(result.merged.title).toBe('New');
  });

  it('pulls a remote-only change', () => {
    const result = reconcile(base(), local(), remote({ status: 'in_progress' }), RULES);
    expect(result.beadPatch.status).toBe('in_progress');
    expect(result.externalPatch).toEqual({});
    expect(result.merged.status).toBe('in_progress');
  });

  it('converges silently when both sides changed to the same value', () => {
    const result = reconcile(base(), local({ title: 'Same' }), remote({ title: 'Same' }), RULES);
    expect(empty(result)).toBe(true);
    expect(result.merged.title).toBe('Same');
  });

  it('conflicts when both sides changed differently, newest wins', () => {
    const result = reconcile(
      base(),
      local({ title: 'Mine', updated_at: '2026-08-10T15:00:00.000Z' }),
      remote({ title: 'Theirs', updatedAt: '2026-08-10T14:00:00.000Z' }),
      RULES,
    );
    expect(result.conflicts).toEqual([
      {
        field: 'title',
        localValue: 'Mine',
        remoteValue: 'Theirs',
        winner: 'local',
        decidedBy: 'newest',
      },
    ]);
    expect(result.externalPatch.title).toBe('Mine');
    expect(result.beadPatch.title).toBeUndefined();
  });

  it('lets the remote win the tie-break when it is newer', () => {
    const result = reconcile(
      base(),
      local({ title: 'Mine', updated_at: '2026-08-10T14:00:00.000Z' }),
      remote({ title: 'Theirs', updatedAt: '2026-08-10T15:00:00.000Z' }),
      RULES,
    );
    expect(result.conflicts[0]?.winner).toBe('remote');
    expect(result.beadPatch.title).toBe('Theirs');
    expect(result.merged.title).toBe('Theirs');
  });

  it('honors a pinned tie-break over the clocks', () => {
    const rules = FieldSyncClauseSchema.parse({ tie_break: 'remote' });
    const result = reconcile(
      base(),
      local({ title: 'Mine', updated_at: '2026-08-10T15:00:00.000Z' }),
      remote({ title: 'Theirs', updatedAt: '2026-08-10T14:00:00.000Z' }),
      rules,
    );
    expect(result.conflicts[0]?.winner).toBe('remote');
    expect(result.conflicts[0]?.decidedBy).toBe('remote');
  });
});

describe('echo suppression via the base', () => {
  it('sees no remote change after re-fetching our own push, despite updatedAt', () => {
    // Run 1: local title change pushes; base advances to merged.
    const first = reconcile(base(), local({ title: 'Pushed' }), remote(), RULES);
    const advancedBase = base({ ...first.merged });

    // Run 2: the tracker echoes our own write with a NEW updatedAt.
    const echoed = remote({ title: 'Pushed', updatedAt: '2026-08-10T23:59:59.000Z' });
    const second = reconcile(advancedBase, local({ title: 'Pushed' }), echoed, RULES);

    expect(empty(second)).toBe(true);
  });
});

describe('ownership rules', () => {
  it('local owner pushes and reports the overwritten tracker edit', () => {
    const result = reconcile(
      base(),
      local({ labels: ['ours'] }),
      remote({ labels: ['theirs'] }),
      RULES, // labels default to local
    );
    expect(result.externalPatch.labels).toEqual(['ours']);
    expect(result.overwrites).toEqual([
      { field: 'labels', direction: 'push', overwrittenValue: ['theirs'] },
    ]);
  });

  it('local owner stays quiet when the tracker side did not change', () => {
    const withBase = base({ labels: ['ours'] });
    const result = reconcile(
      withBase,
      local({ labels: ['ours', 'more'] }),
      remote({ labels: ['ours'] }),
      RULES,
    );
    expect(result.externalPatch.labels).toEqual(['ours', 'more']);
    expect(result.overwrites).toEqual([]);
  });

  it('remote owner pulls and reports the overwritten bead edit', () => {
    const rules = FieldSyncClauseSchema.parse({ fields: { status: 'remote' } });
    const result = reconcile(
      base(),
      local({ status: 'in_progress' }),
      remote({ status: 'blocked' }),
      rules,
    );
    expect(result.beadPatch.status).toBe('blocked');
    expect(result.overwrites).toEqual([
      { field: 'status', direction: 'pull', overwrittenValue: 'in_progress' },
    ]);
  });
});

describe('assignee capability gating', () => {
  it('skips an outbound assignee and keeps the divergence visible', () => {
    const result = reconcile(base(), local({ assignee: 'josh' }), remote(), RULES);
    expect(result.skippedPushes).toEqual([{ field: 'assignee', localValue: 'josh' }]);
    // The base takes the REMOTE value so the divergence re-reports next run.
    expect(result.merged.assignee).toBeNull();
    expect(result.overwrites).toEqual([]);
  });

  it('pulls an assignee under a remote rule', () => {
    const rules = FieldSyncClauseSchema.parse({ fields: { assignee: 'remote' } });
    const result = reconcile(base(), local(), remote({ assignee: 'PM' }), rules);
    expect(result.beadPatch.assignee).toBe('PM');
  });

  it('leaves a Linear assignee alone when the bead never had one (OS-351)', () => {
    // The reported data loss: bead `assignee: null`, issue assigned to a person in
    // Linear. With the capability granted, the null flowed outbound as an explicit
    // unassign and cleared them — every sync, for as long as the pair stayed linked.
    const result = reconcile(
      base({ assignee: 'someone' }),
      local({ assignee: null }),
      remote({ assignee: 'someone' }),
      RULES,
      {},
      { assignee: false },
    );
    expect(result.externalPatch).not.toHaveProperty('assignee');
  });

  it('would push the clear if the capability were granted, which is why it is not', () => {
    // Stated as a property rather than hidden: the engine trusts `capabilities`
    // completely, so with the capability granted a null local value DOES flow outbound
    // as a clear. Nothing downstream re-checks it. That is precisely why the gate has
    // to live in the adapter — `canPushAssignee(null)` is false — and why this test
    // asserts the hazard instead of implying the engine defends against it.
    const result = reconcile(
      base({ assignee: 'someone' }),
      local({ assignee: null }),
      remote({ assignee: 'someone' }),
      RULES,
      {},
      { assignee: true },
    );
    expect(result.externalPatch).toHaveProperty('assignee');
    expect(result.externalPatch.assignee).toBeNull();
  });

  it('pushes an assignee when the provider confirms a configured identity mapping', () => {
    const result = reconcile(
      base(),
      local({ assignee: 'josh' }),
      remote(),
      RULES,
      {},
      { assignee: true },
    );
    expect(result.externalPatch.assignee).toBe('josh');
    expect(result.skippedPushes).toEqual([]);
  });
});

describe('freshly linked pairs (no base)', () => {
  it('converges silently on equal values', () => {
    expect(empty(reconcile(undefined, local(), remote(), RULES))).toBe(true);
  });

  it('conflicts honestly on differing values', () => {
    const result = reconcile(undefined, local({ priority: 1 }), remote({ priority: 3 }), RULES);
    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0]?.field).toBe('priority');
  });

  it('pushes bead prose rather than conflicting when the tracker has none', () => {
    // An item tbd created carries only the managed block until its prose lands, and
    // that splice makes the tracker's clock newer. Under `tie_break: newest` the empty
    // side would then win and delete the bead's description — tbd losing to its own
    // write. Holding nothing is not a competing edit.
    const result = reconcile(
      undefined,
      local({ description: 'Real bead prose', updated_at: '2026-08-10T14:00:00.000Z' }),
      remote({
        description: `${MANAGED_BLOCK_MARKERS.begin}\nmachine\n${MANAGED_BLOCK_MARKERS.end}`,
        updatedAt: '2026-08-10T15:00:00.000Z',
      }),
      RULES,
    );

    expect(result.conflicts).toHaveLength(0);
    expect(result.externalPatch.description).toBe('Real bead prose');
    expect(result.beadPatch.description).toBeUndefined();
  });

  it('pulls tracker prose when the bead has none', () => {
    const result = reconcile(
      undefined,
      local({ description: '', updated_at: '2026-08-10T15:00:00.000Z' }),
      remote({ description: 'Written in the tracker', updatedAt: '2026-08-10T14:00:00.000Z' }),
      RULES,
    );

    expect(result.conflicts).toHaveLength(0);
    expect(result.beadPatch.description).toBe('Written in the tracker');
  });

  it('still conflicts when both sides hold real, differing prose', () => {
    const result = reconcile(
      undefined,
      local({ description: 'Local prose' }),
      remote({ description: 'Remote prose' }),
      RULES,
    );

    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0]?.field).toBe('description');
  });
});

describe('description semantics', () => {
  it('never counts the managed block or cosmetics as a remote edit', () => {
    const cosmetic = remote({
      description: `Body  \r\n\n${MANAGED_BLOCK_MARKERS.begin}\nmachine\n${MANAGED_BLOCK_MARKERS.end}`,
    });
    expect(empty(reconcile(base(), local(), cosmetic, RULES))).toBe(true);
  });

  it('pulls remote prose with the managed block stripped', () => {
    const changed = remote({
      description: `New prose.\n\n${MANAGED_BLOCK_MARKERS.begin}\nmachine\n${MANAGED_BLOCK_MARKERS.end}`,
    });
    const result = reconcile(base(), local(), changed, RULES);
    expect(result.beadPatch.description).toBe('New prose.');
    expect(result.merged.description_hash).toBe(descriptionHash('New prose.'));
  });

  it('pushes local prose on a local-only change', () => {
    const result = reconcile(base(), local({ description: 'Edited body' }), remote(), RULES);
    expect(result.externalPatch.description).toBe('Edited body');
  });

  it('reports recoverable prose rather than internal hashes on conflict', () => {
    const result = reconcile(
      base(),
      local({
        description: 'Local prose',
        updated_at: '2026-08-10T15:00:00.000Z',
      }),
      remote({
        description: `Remote prose\n\n${MANAGED_BLOCK_MARKERS.begin}\nmachine\n${MANAGED_BLOCK_MARKERS.end}`,
        updatedAt: '2026-08-10T14:00:00.000Z',
      }),
      RULES,
    );

    expect(result.conflicts[0]).toEqual(
      expect.objectContaining({
        field: 'description',
        localValue: 'Local prose',
        remoteValue: 'Remote prose',
      }),
    );
  });
});

describe('labels compare as sets', () => {
  it('ignores ordering differences', () => {
    const rules = FieldSyncClauseSchema.parse({ fields: { labels: 'merge' } });
    const result = reconcile(
      base({ labels: ['a', 'b'] }),
      local({ labels: ['b', 'a'] }),
      remote({ labels: ['a', 'b'] }),
      rules,
    );
    expect(empty(result)).toBe(true);
  });
});
