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
  linkedProviders,
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

const entry: LinkedEntryType = {
  provider: 'linear',
  id: '9cbb48f8-7a2e-4b9d-9f3e-0c1d2e3f4a5b',
  key: 'FIN-11',
  url: 'https://linear.app/acme/issue/FIN-11',
  linked_at: '2026-08-10T00:00:00.000Z',
};

describe('link store', () => {
  it('round-trips a link', () => {
    const linked = writeLink(issue(), entry);
    expect(readLink(linked, 'linear')).toEqual(entry);
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

    expect(readLink(parsed, 'linear')).toEqual(entry);
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

  it('preserves unrelated namespaces when writing', () => {
    const withOther = issue({ extensions: { someTool: { data: 1 } } });
    const linked = writeLink(withOther, entry);

    expect(linked.extensions?.someTool).toEqual({ data: 1 });
    expect(readLink(linked, 'linear')).toEqual(entry);
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

  it('does not mutate the input issue', () => {
    const original = issue();
    writeLink(original, entry);
    expect(original.extensions).toBeUndefined();
  });
});
