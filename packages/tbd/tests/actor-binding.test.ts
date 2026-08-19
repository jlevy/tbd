/**
 * Resolving a tbd handle to a real person, without a hand-maintained table.
 *
 * The rule that matters most here is that matching is exact. A wrong actor is worse
 * than an unresolved one: it publishes work under someone else's name, and nothing
 * downstream would ever flag it — which is why several candidates return `ambiguous`
 * rather than the first hit.
 */

import { describe, it, expect } from 'vitest';

import {
  resolveActor,
  bindingFor,
  driftedBindings,
  type ProviderMember,
  type ActorBinding,
} from '../src/integrations/core/actor-binding.js';

const josh: ProviderMember = {
  id: 'user-1',
  displayName: 'Joshua Levy',
  email: 'josh@example.com',
  active: true,
};
const other: ProviderMember = {
  id: 'user-2',
  displayName: 'Josh Other',
  email: 'other@example.com',
  active: true,
};
const members = [josh, other];

const binding: ActorBinding = {
  handle: 'josh',
  provider_user_id: 'user-1',
  display_name: 'Joshua Levy',
  bound_at: '2026-08-19T00:00:00.000Z',
};

describe('resolveActor', () => {
  it('prefers an explicit override over anything the directory says', () => {
    // A repository that pinned an identity keeps it, which is what makes `user_map`
    // safe to leave in place rather than migrate under people.
    const resolved = resolveActor('josh', members, [binding], 'other@example.com');
    expect(resolved.member?.id).toBe('user-2');
    expect(resolved.via).toBe('override');
  });

  it('uses a recorded binding before searching the directory', () => {
    const resolved = resolveActor('josh', members, [binding]);
    expect(resolved.member?.id).toBe('user-1');
    expect(resolved.via).toBe('binding');
  });

  it('survives a rename, because the binding holds the id and not the name', () => {
    const renamed = [{ ...josh, displayName: 'J. Levy' }, other];
    const resolved = resolveActor('josh', renamed, [binding]);
    expect(resolved.member?.id).toBe('user-1');
  });

  it('matches an email exactly, case-insensitively', () => {
    const resolved = resolveActor('JOSH@EXAMPLE.COM', members, []);
    expect(resolved.member?.id).toBe('user-1');
    expect(resolved.via).toBe('email');
  });

  it('falls back to an exact display name', () => {
    const resolved = resolveActor('joshua levy', members, []);
    expect(resolved.member?.id).toBe('user-1');
    expect(resolved.via).toBe('display_name');
  });

  it('reports ambiguity rather than picking one of several matches', () => {
    const twins = [josh, { ...other, displayName: 'Joshua Levy' }];
    const resolved = resolveActor('Joshua Levy', twins, []);
    expect(resolved.member).toBeUndefined();
    expect(resolved.ambiguous).toHaveLength(2);
  });

  it('does not guess from a partial name', () => {
    // "Josh" is a prefix of two display names and an email local-part. Fuzzy matching
    // here would assign work to whoever sorted first.
    expect(resolveActor('Josh', members, []).member).toBeUndefined();
  });

  it('returns nothing for a handle the directory does not know', () => {
    const resolved = resolveActor('nobody', members, []);
    expect(resolved.member).toBeUndefined();
    expect(resolved.ambiguous).toBeUndefined();
  });

  it('will not freshly match a deactivated member', () => {
    const gone = [{ ...josh, active: false }];
    expect(resolveActor('josh@example.com', gone, []).member).toBeUndefined();
  });

  it('still resolves a deactivated member through an existing binding', () => {
    // Historical assignments must keep resolving after someone leaves.
    const gone = [{ ...josh, active: false }];
    expect(resolveActor('josh', gone, [binding]).member?.id).toBe('user-1');
  });
});

describe('binding records', () => {
  it('records the id and the label, and deliberately not the email', () => {
    const created = bindingFor('josh', josh, '2026-08-19T00:00:00.000Z');
    expect(created).toEqual({
      handle: 'josh',
      provider_user_id: 'user-1',
      display_name: 'Joshua Levy',
      bound_at: '2026-08-19T00:00:00.000Z',
    });
    expect(JSON.stringify(created)).not.toContain('@');
  });

  it('reports a name that drifted from the directory', () => {
    const renamed = [{ ...josh, displayName: 'J. Levy' }];
    expect(driftedBindings([binding], renamed)).toEqual([{ binding, currentName: 'J. Levy' }]);
  });

  it('reports no drift when the name still matches', () => {
    expect(driftedBindings([binding], members)).toEqual([]);
  });
});
