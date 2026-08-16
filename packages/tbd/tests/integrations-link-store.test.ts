/**
 * Link storage in the `extensions` namespace.
 *
 * The reason links live here rather than in a top-level field is forward
 * compatibility: `extensions` is already part of `BaseEntity` with opaque
 * contents, so a tbd that predates this feature round-trips a linked bead
 * untouched. A top-level field would be stripped by Zod on the first write from
 * an older CLI. `survives a schema round trip` below is the test that pins that
 * property.
 */

import { describe, expect, it } from 'vitest';

import { IssueSchema } from '../src/lib/schemas.js';
import {
  clearLink,
  duplicateExternalLinks,
  linkedProviders,
  PERSISTED_LINK_KEYS,
  readLink,
  writeLink,
} from '../src/integrations/core/link-store.js';
import type { Issue, LinkedEntryType } from '../src/lib/types.js';

function issue(overrides: Partial<Issue> = {}): Issue {
  return {
    type: 'is',
    // A real ULID: IssueSchema validates the id shape, and this test parses a
    // whole issue rather than just the extensions namespace.
    id: 'is-01hx5zzkbkactav9wevgemmvrz',
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

/**
 * What a caller hands to `writeLink`. It still carries the tracker's
 * identifier and URL, because the adapter has them and callers render from
 * them immediately — they are simply not written to the bead.
 */
const entry: LinkedEntryType = {
  provider: 'linear',
  id: '9cbb48f8-7a2e-4b9d-9f3e-0c1d2e3f4a5b',
  key: 'FIN-11',
  url: 'https://linear.app/acme/issue/FIN-11',
  linked_at: '2026-08-10T00:00:00.000Z',
};

/**
 * What survives onto the bead: identity and nothing else. `key` and `url` are
 * derived from mutable tracker state — a team rename rewrites every identifier
 * in the team — so they live on the bridge record, which every sync rewrites.
 */
const persisted: LinkedEntryType = {
  provider: 'linear',
  id: entry.id,
  linked_at: entry.linked_at,
};

describe('link store', () => {
  it('round-trips a link', () => {
    const linked = writeLink(issue(), entry);
    expect(readLink(linked, 'linear')).toEqual(persisted);
  });

  it('does not persist the tracker identifier or URL, which a rename invalidates', () => {
    const namespace = writeLink(issue(), entry).extensions?.linear as Record<string, unknown>;

    expect(namespace).not.toHaveProperty('key');
    expect(namespace).not.toHaveProperty('url');
    expect(namespace.id).toBe(entry.id);
  });

  it('returns undefined when there is no link', () => {
    expect(readLink(issue(), 'linear')).toBeUndefined();
  });

  it('survives a schema round trip, which a top-level field would not', () => {
    const linked = writeLink(issue(), entry);

    // Parsing is what an older tbd does on read, and it is where a top-level
    // `linked` field would be discarded. `extensions` is a known field with
    // unknown contents, so Zod has nothing to strip.
    const parsed = IssueSchema.parse(linked);

    expect(readLink(parsed, 'linear')).toEqual(persisted);
  });

  it('keeps a second provider link independent', () => {
    const both = writeLink(writeLink(issue(), entry), {
      provider: 'github',
      id: 'owner/repo#12',
      linked_at: '2026-08-10T01:00:00.000Z',
    });

    expect(readLink(both, 'linear')?.id).toBe(entry.id);
    expect(readLink(both, 'github')?.id).toBe('owner/repo#12');
    expect(linkedProviders(both)).toEqual(['linear', 'github']);
  });

  it('replaces a link for the same provider rather than accumulating', () => {
    const first = writeLink(issue(), entry);
    const second = writeLink(first, { ...entry, id: 'new-uuid' });

    // One namespace per provider makes "at most one link per provider"
    // structural, so there is nothing to collapse on merge.
    expect(readLink(second, 'linear')?.id).toBe('new-uuid');
    expect(linkedProviders(second)).toEqual(['linear']);
  });

  it('replaces only link fields while preserving sibling provider state', () => {
    const withProviderState = issue({
      extensions: {
        linear: {
          id: 'old-uuid',
          key: 'OLD-1',
          url: 'https://linear.app/acme/issue/OLD-1',
          linked_at: '2026-08-09T00:00:00.000Z',
          comments: [
            {
              id: 'comment-1',
              at: '2026-08-10T01:00:00.000Z',
              author: 'A Reviewer',
              body: 'Keep me',
            },
          ],
          future_state: { cursor: 'opaque-but-owned-by-the-provider-namespace' },
        },
      },
    });

    const linked = writeLink(withProviderState, {
      provider: 'linear',
      id: 'new-uuid',
      linked_at: '2026-08-10T02:00:00.000Z',
    });
    const namespace = linked.extensions?.linear as Record<string, unknown>;

    expect(readLink(linked, 'linear')).toMatchObject({ id: 'new-uuid' });
    expect(namespace).not.toHaveProperty('key');
    expect(namespace).not.toHaveProperty('url');
    expect(namespace.comments).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'comment-1', body: 'Keep me' })]),
    );
    expect(namespace.future_state).toEqual({
      cursor: 'opaque-but-owned-by-the-provider-namespace',
    });
  });

  it('preserves unrelated namespaces when writing', () => {
    const withOther = issue({ extensions: { someTool: { data: 1 } } });
    const linked = writeLink(withOther, entry);

    expect(linked.extensions?.someTool).toEqual({ data: 1 });
    expect(readLink(linked, 'linear')).toEqual(persisted);
  });

  it('clears one provider without touching the others', () => {
    const both = writeLink(writeLink(issue({ extensions: { keep: { a: 1 } } }), entry), {
      provider: 'github',
      id: 'gh-1',
      linked_at: '2026-08-10T01:00:00.000Z',
    });

    const cleared = clearLink(both, 'linear');

    expect(readLink(cleared, 'linear')).toBeUndefined();
    expect(readLink(cleared, 'github')?.id).toBe('gh-1');
    expect(cleared.extensions?.keep).toEqual({ a: 1 });
  });

  it('is a no-op when clearing an absent link', () => {
    const plain = issue();
    expect(clearLink(plain, 'linear')).toBe(plain);
  });

  it('treats a malformed namespace as unlinked rather than throwing', () => {
    // A hand-edited or foreign-written namespace must not crash a mirror run.
    const bogus = issue({ extensions: { linear: { nonsense: true } } });
    expect(readLink(bogus, 'linear')).toBeUndefined();
  });

  it('treats a non-object namespace as unlinked', () => {
    const bogus = issue({ extensions: { linear: 'just a string' } });
    expect(readLink(bogus, 'linear')).toBeUndefined();
  });

  it('persists only the allow-listed keys, never anything else', () => {
    // Beads are committed to git and readable by everyone with the repository,
    // so what lands in them is deliberate. This fails if a field is added to
    // LinkedEntry and starts persisting without being considered.
    const linked = writeLink(issue(), entry);
    const stored = linked.extensions?.linear as Record<string, unknown>;

    expect(Object.keys(stored).sort()).toEqual(['id', 'linked_at']);
  });

  it('owns more keys than it writes, so retired ones are cleaned up', () => {
    // PERSISTED_LINK_KEYS is the set writeLink *manages*, which is deliberately
    // wider than the set it writes: `key` and `url` stay listed so a bead from
    // an older tbd has them stripped rather than preserved as opaque siblings.
    // Narrowing this list to the written keys would make a stale identifier
    // permanent, which is the exact failure this move exists to prevent.
    expect([...PERSISTED_LINK_KEYS].sort()).toEqual(['id', 'key', 'linked_at', 'url']);
  });

  it('drops extra fields smuggled into the entry rather than storing them', () => {
    const contaminated = {
      ...entry,
      apiKey: 'lin_api_secret',
      rawResponse: { assignee: { email: 'someone@example.com' } },
    } as unknown as LinkedEntryType;

    const linked = writeLink(issue(), contaminated);
    const serialized = JSON.stringify(linked);

    expect(serialized).not.toContain('lin_api_secret');
    expect(serialized).not.toContain('someone@example.com');
    expect(serialized).not.toContain('rawResponse');
  });

  it('omits key and url entirely when absent, rather than writing nulls', () => {
    const minimal = writeLink(issue(), {
      provider: 'linear',
      id: 'uuid-only',
      linked_at: '2026-08-10T00:00:00.000Z',
    });
    const stored = minimal.extensions?.linear as Record<string, unknown>;
    expect(Object.keys(stored).sort()).toEqual(['id', 'linked_at']);
  });

  it('does not mutate the input issue', () => {
    const original = issue();
    writeLink(original, entry);
    expect(original.extensions).toBeUndefined();
  });

  it('groups every holder of a duplicate external item deterministically', () => {
    const later = writeLink(issue({ id: 'is-01hx5zzkbkactav9wevgemmvsa' }), entry);
    const earlier = writeLink(issue({ id: 'is-01hx5zzkbkactav9wevgemmvra' }), {
      ...entry,
      key: 'FIN-11-renamed',
    });
    const unrelated = writeLink(issue({ id: 'is-01hx5zzkbkactav9wevgemmvtz' }), {
      ...entry,
      id: 'other-uuid',
      key: 'FIN-12',
    });
    const malformed = issue({
      id: 'is-01hx5zzkbkactav9wevgemmvzz',
      extensions: { linear: { id: 12 } },
    });

    // Grouping is by external id — the UUID — so it is unaffected by whether a
    // human identifier is available at all.
    expect(duplicateExternalLinks([later, unrelated, malformed, earlier], 'linear')).toEqual([
      {
        externalId: entry.id,
        // Null rather than 'FIN-11-renamed': the bead no longer carries a key,
        // so without bridge records there is nothing to label it with. The
        // report still names the external id and every holding bead, which is
        // what the remedy acts on.
        externalKey: null,
        beadIds: [earlier.id, later.id],
      },
    ]);
  });

  it('labels a duplicate from bridge records when they are supplied', () => {
    const later = writeLink(issue({ id: 'is-01hx5zzkbkactav9wevgemmvsa' }), entry);
    const earlier = writeLink(issue({ id: 'is-01hx5zzkbkactav9wevgemmvra' }), entry);

    const keyByExternalId = new Map([[entry.id, 'OS-11']]);

    expect(duplicateExternalLinks([later, earlier], 'linear', keyByExternalId)).toEqual([
      {
        externalId: entry.id,
        externalKey: 'OS-11',
        beadIds: [earlier.id, later.id],
      },
    ]);
  });

  it('falls back to a legacy bead-side key for a bead written before the move', () => {
    // Transitional: a bead last written by an older tbd still carries `key`.
    // It should still label the report until the next sync rewrites the bead.
    const legacy = issue({
      id: 'is-01hx5zzkbkactav9wevgemmvra',
      extensions: {
        linear: { id: entry.id, key: 'FIN-11', linked_at: entry.linked_at },
      },
    });
    const modern = writeLink(issue({ id: 'is-01hx5zzkbkactav9wevgemmvsa' }), entry);

    expect(duplicateExternalLinks([modern, legacy], 'linear')).toEqual([
      {
        externalId: entry.id,
        externalKey: 'FIN-11',
        beadIds: [legacy.id, modern.id],
      },
    ]);
  });
});
