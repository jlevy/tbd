/**
 * Comment sequences: the store, the caps, and the merge-layer union.
 *
 * The pinned properties: two machines appending different comments both
 * survive a merge (union, not LWW), a pushed comment unifies with its
 * pre-push twin on local_id, and nothing beyond the allow-list persists.
 */

import { describe, expect, it } from 'vitest';

import { unionCommentArrays } from '../src/lib/comment-union.js';
import {
  appendLocalComment,
  capEntries,
  mergeExternalComments,
  readComments,
  recordPushedComment,
  unpushedComments,
} from '../src/integrations/core/comment-store.js';
import { mergeIssues } from '../src/file/git.js';
import { COMMENT_BODY_CAP, COMMENTS_PER_BEAD_CAP } from '../src/lib/schemas.js';
import type { Issue } from '../src/lib/types.js';

const NOW = '2026-08-11T00:00:00.000Z';

function bead(extensions?: Record<string, unknown>): Issue {
  return {
    type: 'is',
    id: 'is-01hx5zzkbkactav9wevgemmvrz',
    title: 'A bead',
    kind: 'task',
    status: 'open',
    priority: 2,
    version: 1,
    created_at: '2026-08-10T00:00:00.000Z',
    updated_at: '2026-08-10T00:00:00.000Z',
    labels: [],
    dependencies: [],
    ...(extensions ? { extensions } : {}),
  } as Issue;
}

describe('the comment store', () => {
  it('appends a local comment with a ulid identity and reads it back', () => {
    const { issue, entry } = appendLocalComment(bead(), 'linear', 'Ship it.', NOW);
    expect(entry.local_id).toMatch(/^[0-9a-z]{26}$/);
    expect(entry.id).toBeUndefined();

    const comments = readComments(issue, 'linear');
    expect(comments).toHaveLength(1);
    expect(comments[0]?.body).toBe('Ship it.');
    expect(unpushedComments(issue, 'linear')).toHaveLength(1);
  });

  it('preserves the link identity fields alongside comments', () => {
    const linked = bead({
      linear: { id: 'uuid-1', key: 'TBD-1', url: 'https://x', linked_at: NOW },
    });
    const { issue } = appendLocalComment(linked, 'linear', 'hello', NOW);
    const namespace = issue.extensions?.linear as Record<string, unknown>;
    expect(namespace.id).toBe('uuid-1');
    expect(namespace.key).toBe('TBD-1');
    expect(Array.isArray(namespace.comments)).toBe(true);
  });

  it('records the provider id on push and stops counting it unpushed', () => {
    const { issue, entry } = appendLocalComment(bead(), 'linear', 'out', NOW);
    const pushed = recordPushedComment(issue, 'linear', entry.local_id!, 'provider-uuid');
    expect(unpushedComments(pushed, 'linear')).toHaveLength(0);
    expect(readComments(pushed, 'linear')[0]?.id).toBe('provider-uuid');
    // The local identity survives so other machines' twins unify with it.
    expect(readComments(pushed, 'linear')[0]?.local_id).toBe(entry.local_id);
  });

  it('merges external comments once, with allow-listed fields only', () => {
    const external = [
      {
        id: 'c-1',
        body: 'from a PM',
        author: 'Pat',
        createdAt: '2026-08-10T10:00:00.000Z',
        resolvedAt: null,
      },
    ];
    const first = mergeExternalComments(bead(), 'linear', external);
    expect(first.added).toBe(1);
    const again = mergeExternalComments(first.issue, 'linear', external);
    expect(again.added).toBe(0);
    expect(again.issue).toBe(first.issue); // untouched: no gratuitous writes

    const entry = readComments(first.issue, 'linear')[0]!;
    expect(Object.keys(entry).sort()).toEqual(['at', 'author', 'body', 'id']);
  });

  it('caps bodies and collapses the oldest overflow to stubs', () => {
    const long = { id: 'c-long', at: NOW, author: null, body: 'x'.repeat(COMMENT_BODY_CAP + 5) };
    const capped = capEntries([long]);
    expect(capped[0]!.body).toContain('truncated');

    const many = Array.from({ length: COMMENTS_PER_BEAD_CAP + 3 }, (_, i) => ({
      id: `c-${String(i).padStart(3, '0')}`,
      at: `2026-08-10T00:${String(i).padStart(2, '0')}:00.000Z`,
      author: null,
      body: `comment ${i}`,
    }));
    const collapsed = capEntries(many);
    expect(collapsed).toHaveLength(COMMENTS_PER_BEAD_CAP + 3); // ids all survive
    expect(collapsed[0]!.body).toBe(''); // oldest stubbed
    expect(collapsed.at(-1)!.body).toContain('comment'); // newest kept whole
  });
});

describe('the union', () => {
  it('unifies a pushed comment with its pre-push twin on local_id', () => {
    const prePush = { local_id: 'l-1', at: NOW, body: 'same comment' };
    const postPush = { local_id: 'l-1', id: 'provider-1', at: NOW, body: 'same comment' };
    const union = unionCommentArrays([prePush], [postPush]);
    expect(union).toHaveLength(1);
    expect(union[0]!.id).toBe('provider-1'); // the observation that knows more wins
  });

  it('keeps concurrent appends from both sides in time order', () => {
    const a = { id: 'c-a', at: '2026-08-10T10:00:00.000Z', body: 'a' };
    const b = { id: 'c-b', at: '2026-08-10T09:00:00.000Z', body: 'b' };
    const union = unionCommentArrays([a], [b]);
    expect(union.map((entry) => entry.id)).toEqual(['c-b', 'c-a']);
  });
});

describe('the extensions merge with comments', () => {
  const baseIssue = bead({
    linear: {
      id: 'uuid-1',
      linked_at: NOW,
      comments: [{ id: 'c-0', at: '2026-08-10T09:00:00.000Z', body: 'base' }],
    },
  });

  function withComment(commentId: string, at: string): Issue {
    return {
      ...baseIssue,
      version: 2,
      extensions: {
        linear: {
          id: 'uuid-1',
          linked_at: NOW,
          comments: [
            { id: 'c-0', at: '2026-08-10T09:00:00.000Z', body: 'base' },
            { id: commentId, at, body: `body ${commentId}` },
          ],
        },
      },
    };
  }

  it('both machines appending different comments is a union, not a conflict', () => {
    const local = withComment('c-local', '2026-08-10T10:00:00.000Z');
    const remote = withComment('c-remote', '2026-08-10T11:00:00.000Z');

    const { merged, conflicts } = mergeIssues(baseIssue, local, remote);

    const namespace = merged.extensions?.linear as { comments: { id: string }[] };
    expect(namespace.comments.map((c) => c.id)).toEqual(['c-0', 'c-local', 'c-remote']);
    expect(conflicts).toEqual([]); // an append is never a conflict
  });

  it('still reports a genuine conflict beyond comments while unioning them', () => {
    const local = withComment('c-local', '2026-08-10T10:00:00.000Z');
    (local.extensions!.linear as Record<string, unknown>).key = 'TBD-9';
    const remote = withComment('c-remote', '2026-08-10T11:00:00.000Z');
    (remote.extensions!.linear as Record<string, unknown>).key = 'TBD-8';

    const { merged, conflicts } = mergeIssues(baseIssue, local, remote);

    const namespace = merged.extensions?.linear as { comments: { id: string }[] };
    expect(namespace.comments).toHaveLength(3); // union still happens
    expect(conflicts).toHaveLength(1); // the key divergence is real
  });
});
