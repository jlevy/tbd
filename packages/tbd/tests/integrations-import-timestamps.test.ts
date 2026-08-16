/**
 * Backdating a mirrored issue to the bead's own timestamps.
 *
 * The tracker is a projection; the bead is the system of record, so mirroring must not
 * re-date history. Linear accepts `createdAt` and `completedAt` on create only —
 * "e.g. if importing from another system", which is what a mirror is — and enforces
 * three rules whose violation fails the whole create rather than dropping the field.
 *
 * This matters beyond tidiness: Linear auto-archives from `completedAt`, so a backfilled
 * repository stamped "today" keeps years of closed work in the active view, and on a
 * capped plan in the issue quota, for the entire archive period. Observed live across
 * three repositories: 99 issues stamped completed within one week, including beads
 * genuinely closed seven months earlier.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { importTimestamps, LinearAdapter } from '../src/integrations/linear/adapter.js';
import { LinearClient } from '../src/integrations/linear/client.js';
import { LinearMockServer } from './helpers/linear-mock-server.js';
import type { CanonicalPatch } from '../src/integrations/core/types.js';

const PAST_CREATED = '2026-01-15T10:00:00.000Z';
const PAST_CLOSED = '2026-01-16T21:55:31.083Z';

describe('importTimestamps', () => {
  it('passes through honest past dates on a closed bead', () => {
    expect(
      importTimestamps({
        status: 'closed',
        sourceCreatedAt: PAST_CREATED,
        sourceCompletedAt: PAST_CLOSED,
      }),
    ).toEqual({ createdAt: PAST_CREATED, completedAt: PAST_CLOSED });
  });

  it('omits completedAt for any status that is not a completed state', () => {
    // Linear rejects the whole create rather than ignoring the field, so an open
    // bead carrying a stale closed_at must not send one.
    for (const status of ['open', 'in_progress', 'blocked', 'deferred'] as const) {
      expect(
        importTimestamps({
          status,
          sourceCreatedAt: PAST_CREATED,
          sourceCompletedAt: PAST_CLOSED,
        }),
      ).toEqual({ createdAt: PAST_CREATED });
    }
  });

  it('nudges completedAt past createdAt when a bead opened and closed in the same instant', () => {
    // Routine for scripted work, and a hard rejection if sent verbatim.
    const same = '2026-01-15T10:00:00.000Z';
    const out = importTimestamps({
      status: 'closed',
      sourceCreatedAt: same,
      sourceCompletedAt: same,
    });
    expect(Date.parse(out.completedAt!)).toBe(Date.parse(same) + 1);
  });

  it('drops a future date rather than risking the create', () => {
    const future = new Date(Date.now() + 86_400_000).toISOString();
    expect(importTimestamps({ status: 'closed', sourceCreatedAt: future })).toEqual({});
    expect(
      importTimestamps({
        status: 'closed',
        sourceCreatedAt: PAST_CREATED,
        sourceCompletedAt: future,
      }),
    ).toEqual({ createdAt: PAST_CREATED });
  });

  it('withholds completedAt when no createdAt is being sent', () => {
    // Without a createdAt, Linear stamps creation at now — and then every past
    // completedAt precedes it, which it rejects.
    expect(importTimestamps({ status: 'closed', sourceCompletedAt: PAST_CLOSED })).toEqual({});
  });

  it('sends nothing when the bead carries no source dates', () => {
    expect(importTimestamps({ title: 'x' } as CanonicalPatch)).toEqual({});
  });
});

describe('createIssue backdating against the provider', () => {
  let server: LinearMockServer;
  let adapter: LinearAdapter;

  beforeEach(async () => {
    server = new LinearMockServer();
    const endpoint = await server.start();
    adapter = new LinearAdapter({
      client: new LinearClient({ apiKey: 'k', endpoint, sleep: () => Promise.resolve() }),
      teamKey: 'FIN',
    });
  });

  afterEach(async () => {
    await server.stop();
  });

  it('stores the bead dates on a closed bead, not the time of the sync', async () => {
    const ref = await adapter.createIssue({
      title: 'Long-closed work',
      status: 'closed',
      priority: 2,
      sourceCreatedAt: PAST_CREATED,
      sourceCompletedAt: PAST_CLOSED,
    });

    const stored = server.issues.get(ref.id)!;
    expect(stored.createdAt).toBe(PAST_CREATED);
    expect(stored.completedAt).toBe(PAST_CLOSED);
  });

  it('backdates creation for an open bead and leaves completedAt unset', async () => {
    const ref = await adapter.createIssue({
      title: 'Old but still open',
      status: 'open',
      priority: 2,
      sourceCreatedAt: PAST_CREATED,
      sourceCompletedAt: null,
    });

    const stored = server.issues.get(ref.id)!;
    expect(stored.createdAt).toBe(PAST_CREATED);
    expect(stored.completedAt).toBeNull();
  });

  it('never rewrites history through the update path', async () => {
    const ref = await adapter.createIssue({
      title: 'Created once',
      status: 'open',
      priority: 2,
      sourceCreatedAt: PAST_CREATED,
    });

    await adapter.applyChanges(ref.id, {
      title: 'Edited later',
      status: 'closed',
      sourceCreatedAt: '2020-01-01T00:00:00.000Z',
      sourceCompletedAt: '2020-01-02T00:00:00.000Z',
    });

    // The update carried both fields and the adapter ignored them, which is also
    // what the provider requires: neither is on IssueUpdateInput.
    const stored = server.issues.get(ref.id)!;
    expect(stored.createdAt).toBe(PAST_CREATED);
    expect(stored.title).toBe('Edited later');
  });
});
