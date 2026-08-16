/**
 * Who owns a mirrored item's archive state.
 *
 * `manual` is the default and means exactly that: tbd never archives or unarchives.
 * Archiving is a filing decision about what a human sees in their own views, and a
 * repository's automation is a poor judge of when someone is finished looking at
 * something. The tracker's own retention (Linear's team-level auto-archive) keeps
 * working underneath, which is where that policy belongs.
 *
 * `on_close` hands tbd the whole lifecycle, and the pairing is the point: an
 * integration that archived on close but never restored on reopen would strand
 * reopened work in a tracker nobody is looking at.
 */

import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { readLink, writeLink } from '../src/integrations/core/link-store.js';
import { runSync, type SyncCallbacks } from '../src/integrations/core/sync-engine.js';
import { LinearAdapter } from '../src/integrations/linear/adapter.js';
import { LinearClient } from '../src/integrations/linear/client.js';
import { PolicyDefinitionSchema } from '../src/lib/schemas.js';
import { LinearMockServer } from './helpers/linear-mock-server.js';
import type { Issue, PolicyDefinition } from '../src/lib/types.js';

function policy(archive?: 'manual' | 'on_close'): PolicyDefinition {
  return PolicyDefinitionSchema.parse({
    outbound: { kinds: ['epic'], statuses: ['open', 'closed'], specs: 'none', linked: true },
    ...(archive ? { archive } : {}),
  });
}

function bead(id: string, overrides: Partial<Issue> = {}): Issue {
  return {
    type: 'is',
    id,
    title: 'An epic',
    kind: 'epic',
    status: 'open',
    priority: 2,
    version: 1,
    created_at: '2026-08-10T00:00:00.000Z',
    updated_at: '2026-08-10T00:00:00.000Z',
    labels: [],
    dependencies: [],
    ...overrides,
  } as Issue;
}

describe('archive policy', () => {
  let dir: string;
  let server: LinearMockServer;
  let adapter: LinearAdapter;
  let store: Map<string, Issue>;
  let callbacks: SyncCallbacks;

  const BEAD = 'is-01hx5zzkbkactav9wevgemmg01';

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'tbd-archive-'));
    server = new LinearMockServer();
    const endpoint = await server.start();
    adapter = new LinearAdapter({
      client: new LinearClient({ apiKey: 'k', endpoint, sleep: () => Promise.resolve() }),
      teamKey: 'FIN',
    });
    store = new Map();
    callbacks = {
      readBead: (id) => Promise.resolve(store.get(id)!),
      writeBead: (issue) => {
        store.set(issue.id, issue);
        return Promise.resolve();
      },
      createBead: () => Promise.reject(new Error('not used')),
      afterJournal: () => Promise.resolve(),
      archiveConflict: () => Promise.resolve('attic/x.md'),
      affirmBulk: () => Promise.resolve(),
    };
  });

  afterEach(async () => {
    await server.stop();
    await rm(dir, { recursive: true, force: true });
  });

  function run(archive?: 'manual' | 'on_close') {
    return runSync({
      provider: 'linear',
      adapter,
      policy: policy(archive),
      dataSyncDir: dir,
      allIssues: [...store.values()],
      displayId: (id) => id.slice(-4),
      mirrorLabels: 'none',
      callbacks,
      dryRun: false,
      now: () => new Date().toISOString(),
    });
  }

  /** Create the pair, then close the bead so the next run sees a settled pair. */
  async function linkThenClose(archive?: 'manual' | 'on_close') {
    store.set(BEAD, bead(BEAD));
    await run(archive);
    const linked = store.get(BEAD)!;
    store.set(BEAD, { ...linked, status: 'closed', closed_at: '2026-08-12T00:00:00.000Z' });
    return readLink(linked, 'linear')!.id;
  }

  it('manual: closing a bead leaves the tracker item in the active view', async () => {
    const externalId = await linkThenClose();

    const result = await run();

    expect(server.issues.get(externalId)!.archivedAt).toBeNull();
    expect(result.archived).toEqual([]);
  });

  it('on_close: closing a bead retires its tracker item', async () => {
    const externalId = await linkThenClose('on_close');

    const result = await run('on_close');

    expect(server.issues.get(externalId)!.archivedAt).not.toBeNull();
    expect(result.archived).toEqual(['mg01']);
  });

  it('on_close: archiving happens after the edits, which an archived issue rejects', async () => {
    const externalId = await linkThenClose('on_close');
    store.set(BEAD, { ...store.get(BEAD)!, title: 'Renamed as it closed' });

    await run('on_close');

    // Both landed: the title edit reached the item before it was retired.
    expect(server.issues.get(externalId)!.title).toBe('Renamed as it closed');
    expect(server.issues.get(externalId)!.archivedAt).not.toBeNull();
  });

  it('on_close: reopening restores the item rather than stranding the work', async () => {
    const externalId = await linkThenClose('on_close');
    await run('on_close');
    expect(server.issues.get(externalId)!.archivedAt).not.toBeNull();

    store.set(BEAD, { ...store.get(BEAD)!, status: 'open', closed_at: null });
    const result = await run('on_close');

    expect(server.issues.get(externalId)!.archivedAt).toBeNull();
    expect(result.unarchived).toEqual(['mg01']);
    // Revived in the same run, so it reconciles rather than waiting for the next.
    expect(result.orphaned).toEqual([]);
  });

  it('manual: a reopened bead under an archived item is reported, never silently stuck', async () => {
    // The failure mode this warning exists for: without it the pair simply stops
    // syncing and nothing says so.
    const externalId = await linkThenClose();
    server.issues.get(externalId)!.archivedAt = '2026-08-13T00:00:00.000Z';
    store.set(BEAD, { ...store.get(BEAD)!, status: 'open', closed_at: null });

    const result = await run();

    expect(server.issues.get(externalId)!.archivedAt).not.toBeNull();
    expect(result.orphaned).toEqual(['mg01']);
    expect(result.warnings.map((w) => w.message).join(' ')).toContain('reopened but its tracker');
  });

  it('never revives a trashed item, which the provider purges on its own schedule', async () => {
    const externalId = await linkThenClose('on_close');
    const remote = server.issues.get(externalId)!;
    remote.archivedAt = '2026-08-13T00:00:00.000Z';
    remote.trashed = true;
    store.set(BEAD, { ...store.get(BEAD)!, status: 'open', closed_at: null });

    const result = await run('on_close');

    expect(result.unarchived).toEqual([]);
    expect(result.orphaned).toEqual(['mg01']);
  });

  it('defaults to manual when the policy says nothing', () => {
    expect(policy().archive).toBeUndefined();
  });

  it('an unlinked bead whose item was archived does not get a duplicate', async () => {
    const externalId = await linkThenClose('on_close');
    await run('on_close');
    const before = server.issues.size;

    // Still closed, still archived: quiet, and emphatically not re-created.
    const result = await run('on_close');

    expect(server.issues.size).toBe(before);
    expect(result.createdOutbound).toEqual([]);
    expect(readLink(store.get(BEAD)!, 'linear')!.id).toBe(externalId);
    expect(writeLink).toBeDefined();
  });
});
