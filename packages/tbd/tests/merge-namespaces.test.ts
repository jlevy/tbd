/**
 * Per-namespace merge behavior for `extensions`.
 *
 * `extensions` previously merged as one opaque last-writer-wins value, so two
 * writers touching different namespaces silently lost one side. That matters
 * more now that external tracker links live in these namespaces: losing one
 * orphans a mirrored issue and makes the next mirror duplicate it.
 *
 * Absence is treated as a value, not a gap. A namespace removed since the base
 * was deleted on purpose (`tbd integration unlink`), and a two-way presence
 * check cannot tell that apart from "the other side never had it" — which would
 * silently resurrect an unlinked bead.
 */

import { describe, expect, it } from 'vitest';

import { mergeIssues, DELETED_NAMESPACE } from '../src/file/git.js';
import type { Issue } from '../src/lib/types.js';

function issue(overrides: Partial<Issue> = {}): Issue {
  return {
    type: 'is',
    id: 'is-01test',
    version: 1,
    title: 'Test',
    kind: 'task',
    status: 'open',
    priority: 2,
    labels: [],
    dependencies: [],
    created_at: '2026-08-10T00:00:00.000Z',
    updated_at: '2026-08-10T00:00:00.000Z',
    ...overrides,
  } as Issue;
}

/** Merge three extension states, with local newer than remote unless flipped. */
function mergeExt(
  baseExt: Record<string, unknown> | undefined,
  localExt: Record<string, unknown> | undefined,
  remoteExt: Record<string, unknown> | undefined,
  localNewer = true,
) {
  const base = issue({ extensions: baseExt });
  const local = issue({
    version: 2,
    updated_at: localNewer ? '2026-08-10T02:00:00.000Z' : '2026-08-10T01:00:00.000Z',
    extensions: localExt,
  });
  const remote = issue({
    version: 2,
    updated_at: localNewer ? '2026-08-10T01:00:00.000Z' : '2026-08-10T02:00:00.000Z',
    extensions: remoteExt,
  });
  const result = mergeIssues(base, local, remote);
  return {
    ext: result.merged.extensions ?? {},
    conflicts: result.conflicts,
  };
}

const LINK = { id: 'uuid-1', linked_at: '2026-08-10T00:00:00.000Z' };

describe('independent namespaces', () => {
  it('keeps both when each side writes a different one', () => {
    const { ext, conflicts } = mergeExt({}, { github: { prs: ['a'] } }, { linear: LINK });
    expect(ext).toEqual({ github: { prs: ['a'] }, linear: LINK });
    expect(conflicts).toHaveLength(0);
  });

  it('conflicts only on the namespace both sides changed', () => {
    const { ext, conflicts } = mergeExt(
      { github: { prs: [] }, linear: { id: 'old' } },
      { github: { prs: ['local'] }, linear: { id: 'LOCAL' } },
      { github: { prs: [] }, linear: { id: 'REMOTE' } },
    );
    expect(ext.github).toEqual({ prs: ['local'] });
    expect(ext.linear).toEqual({ id: 'LOCAL' });
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]?.field).toBe('extensions.linear');
    expect(conflicts[0]?.lost_value).toEqual({ id: 'REMOTE' });
  });

  it('takes the changed side when the other is unchanged from base', () => {
    const { ext, conflicts } = mergeExt(
      { github: { prs: ['old'] } },
      { github: { prs: ['old'] } },
      { github: { prs: ['new'] } },
    );
    expect(ext.github).toEqual({ prs: ['new'] });
    expect(conflicts).toHaveLength(0);
  });

  it('preserves a namespace neither side touched', () => {
    const { ext } = mergeExt(
      { beads: { original_id: 'tbd-101' } },
      { beads: { original_id: 'tbd-101' }, linear: LINK },
      { beads: { original_id: 'tbd-101' } },
    );
    expect(ext.beads).toEqual({ original_id: 'tbd-101' });
    expect(ext.linear).toEqual(LINK);
  });
});

describe('deletion, the case a two-way presence check gets wrong', () => {
  it('honors an unlink when the other side did not touch the namespace', () => {
    // The bug this pins: without the base, "absent on local" looks identical to
    // "remote added it", and the unlink is silently reverted.
    const { ext, conflicts } = mergeExt({ linear: LINK }, {}, { linear: LINK });
    expect(ext.linear).toBeUndefined();
    expect(conflicts).toHaveLength(0);
  });

  it('honors an unlink from the remote side too', () => {
    const { ext } = mergeExt({ linear: LINK }, { linear: LINK }, {});
    expect(ext.linear).toBeUndefined();
  });

  it('stays deleted when both sides unlinked', () => {
    const { ext, conflicts } = mergeExt({ linear: LINK }, {}, {});
    expect(ext.linear).toBeUndefined();
    expect(conflicts).toHaveLength(0);
  });

  it('keeps a concurrent edit over a deletion, and reports the discarded unlink', () => {
    // Re-deleting is cheap; recovering a discarded link means hunting down the
    // external issue. So the edit survives, but the loss is not silent.
    const edited = { id: 'uuid-1', key: 'FIN-99', linked_at: '2026-08-10T03:00:00.000Z' };
    const { ext, conflicts } = mergeExt({ linear: LINK }, {}, { linear: edited });

    expect(ext.linear).toEqual(edited);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]?.field).toBe('extensions.linear');
    expect(conflicts[0]?.lost_value).toBe(DELETED_NAMESPACE);
  });

  it('applies the same rule when the sides are swapped', () => {
    const edited = { id: 'uuid-1', key: 'FIN-99', linked_at: '2026-08-10T03:00:00.000Z' };
    const { ext, conflicts } = mergeExt({ linear: LINK }, { linear: edited }, {});
    expect(ext.linear).toEqual(edited);
    expect(conflicts[0]?.lost_value).toBe(DELETED_NAMESPACE);
  });

  it('does not resurrect a namespace absent from base and both sides', () => {
    const { ext } = mergeExt({ a: 1 }, { a: 1 }, { a: 1 });
    expect(Object.keys(ext)).toEqual(['a']);
  });
});

describe('additions', () => {
  it('keeps a namespace added by one side only', () => {
    const { ext, conflicts } = mergeExt({}, { linear: LINK }, {});
    expect(ext.linear).toEqual(LINK);
    expect(conflicts).toHaveLength(0);
  });

  it('treats identical concurrent additions as agreement, not conflict', () => {
    const { ext, conflicts } = mergeExt({}, { linear: LINK }, { linear: LINK });
    expect(ext.linear).toEqual(LINK);
    expect(conflicts).toHaveLength(0);
  });

  it('resolves differing concurrent additions by recency, archiving the loser', () => {
    const { ext, conflicts } = mergeExt(
      {},
      { linear: { id: 'local' } },
      { linear: { id: 'remote' } },
    );
    expect(ext.linear).toEqual({ id: 'local' });
    expect(conflicts[0]?.lost_value).toEqual({ id: 'remote' });
  });

  it('lets the newer side win when remote is newer', () => {
    const { ext } = mergeExt({}, { linear: { id: 'local' } }, { linear: { id: 'remote' } }, false);
    expect(ext.linear).toEqual({ id: 'remote' });
  });
});

describe('degenerate inputs', () => {
  it('treats a missing extensions object as empty', () => {
    const { ext } = mergeExt(undefined, { linear: LINK }, undefined);
    expect(ext.linear).toEqual(LINK);
  });

  it('does not throw when a side is absent entirely', () => {
    expect(() => mergeExt(undefined, undefined, undefined)).not.toThrow();
  });
});
