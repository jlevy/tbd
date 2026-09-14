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

/**
 * The comment union is a provider-link postcondition, not a rule about the key name
 * `comments`.
 *
 * `extensions` is the documented home for third-party data (`lib/schemas.ts`), so a
 * namespace this build knows nothing about may use `comments` for something that is not
 * a provider comment log. Running the union over it drops every non-object entry and
 * re-sorts the rest, which is silent data loss on an ordinary `tbd sync` merge — the
 * caller never edited that namespace's comments at all.
 *
 * The union therefore applies only when both sides are actually comment logs: every
 * entry parses as a `CommentEntry` (identity plus `at` plus `body`). Anything else
 * falls through to namespace last-writer-wins, which preserves the winning side's
 * value verbatim and reports the loser as a conflict like any other namespace.
 */
describe('comment union scoping', () => {
  const COMMENT_A = {
    local_id: '01aaaaaaaaaaaaaaaaaaaaaaaa',
    at: '2026-08-10T00:00:00.000Z',
    body: 'first',
  };
  const COMMENT_B = {
    local_id: '01bbbbbbbbbbbbbbbbbbbbbbbb',
    at: '2026-08-10T01:00:00.000Z',
    body: 'second',
  };
  const COMMENT_C = {
    local_id: '01cccccccccccccccccccccccc',
    at: '2026-08-10T02:00:00.000Z',
    body: 'third',
  };

  it('leaves a third-party string comments array untouched', () => {
    const { ext } = mergeExt(
      { myapp: { comments: ['a', 'b'], note: 'base' } },
      { myapp: { comments: ['a', 'b'], note: 'local' } },
      { myapp: { comments: ['a', 'b', 'c'], note: 'remote' } },
    );

    expect(ext.myapp).toEqual({ comments: ['a', 'b'], note: 'local' });
  });

  it('leaves third-party object entries without comment identity untouched', () => {
    const { ext } = mergeExt(
      { myapp: { comments: [{ text: 'a' }], note: 'base' } },
      { myapp: { comments: [{ text: 'a' }], note: 'local' } },
      { myapp: { comments: [{ text: 'a' }, { text: 'b' }], note: 'remote' } },
    );

    expect(ext.myapp).toEqual({ comments: [{ text: 'a' }], note: 'local' });
  });

  it('reports the losing third-party namespace as a conflict rather than merging it', () => {
    const { conflicts } = mergeExt(
      { myapp: { comments: ['a'], note: 'base' } },
      { myapp: { comments: ['a'], note: 'local' } },
      { myapp: { comments: ['a', 'b'], note: 'remote' } },
    );

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]?.lost_value).toEqual({ comments: ['a', 'b'], note: 'remote' });
  });

  it('still unions a real provider comment log', () => {
    // Both sides must differ from base, or `resolveNamespace` returns the one changed
    // side before the union gate is ever reached and the case proves nothing about it.
    const { ext } = mergeExt(
      { linear: { id: 'uuid-1', comments: [COMMENT_A] } },
      { linear: { id: 'uuid-1', comments: [COMMENT_A, COMMENT_C] } },
      { linear: { id: 'uuid-1', comments: [COMMENT_A, COMMENT_B] } },
    );

    expect((ext.linear as { comments: unknown[] }).comments).toEqual([
      COMMENT_A,
      COMMENT_B,
      COMMENT_C,
    ]);
  });

  it('leaves an untouched comments: null namespace exactly as it was', () => {
    // YAML `comments:` with no value parses to null. Nobody edited this namespace, so
    // the merge must not invent an array for it — rewriting it also re-versions the
    // bead on every sync.
    const { ext } = mergeExt(
      { myapp: { comments: null } },
      { myapp: { comments: null } },
      { myapp: { comments: null } },
    );

    expect(ext.myapp).toEqual({ comments: null });
  });

  it('does not union a null comments key against a real log', () => {
    // null is not an empty log. The two sites that gate the union must agree about
    // that, or the namespace merge archives the losing comments while the
    // postcondition quietly unions them back.
    const { ext, conflicts } = mergeExt(
      { linear: { id: 'uuid-1', comments: null } },
      { linear: { id: 'uuid-1', comments: null, note: 'local' } },
      { linear: { id: 'uuid-1', comments: [COMMENT_A] } },
    );

    expect((ext.linear as { comments: unknown }).comments).toBeNull();
    expect(conflicts).toHaveLength(1);
  });

  it('unions when one side has an empty comment log', () => {
    // Two-sided again: local edits a sibling field, remote appends the first comment.
    const { ext } = mergeExt(
      { linear: { id: 'uuid-1', comments: [] } },
      { linear: { id: 'uuid-1', comments: [], note: 'local' } },
      { linear: { id: 'uuid-1', comments: [COMMENT_A] } },
    );

    expect((ext.linear as { comments: unknown[] }).comments).toEqual([COMMENT_A]);
  });
});
