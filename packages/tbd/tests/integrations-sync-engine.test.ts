/**
 * The sync engine end to end against the mock provider: outbound creation,
 * echo-free steady state, pulls, pushes, comments both ways, conflicts with
 * exactly-once reports, and inbound report/import.
 */

import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { readLink } from '../src/integrations/core/link-store.js';
import { readComments } from '../src/integrations/core/comment-store.js';
import { appendLocalComment } from '../src/integrations/core/comment-store.js';
import { runSync, type SyncCallbacks } from '../src/integrations/core/sync-engine.js';
import { LinearAdapter } from '../src/integrations/linear/adapter.js';
import { LinearClient } from '../src/integrations/linear/client.js';
import { PolicyDefinitionSchema } from '../src/lib/schemas.js';
import type { Issue, PolicyDefinition } from '../src/lib/types.js';
import { LinearMockServer } from './helpers/linear-mock-server.js';

const POLICY: PolicyDefinition = PolicyDefinitionSchema.parse({
  outbound: { kinds: ['epic'], statuses: ['open'], specs: 'none', linked: true },
});

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

describe('the sync engine', () => {
  let dir: string;
  let server: LinearMockServer;
  let adapter: LinearAdapter;
  let store: Map<string, Issue>;
  let callbacks: SyncCallbacks;
  let affirmed: { creates: number; updates: number }[];

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'tbd-engine-'));
    server = new LinearMockServer();
    const endpoint = await server.start();
    adapter = new LinearAdapter({
      client: new LinearClient({
        apiKey: 'lin_api_test',
        endpoint,
        maxAttempts: 4,
        sleep: () => Promise.resolve(),
      }),
      teamKey: 'FIN',
    });
    store = new Map();
    affirmed = [];
    callbacks = {
      readBead: (id) => {
        const issue = store.get(id);
        if (!issue) {
          throw new Error(`no bead ${id}`);
        }
        return Promise.resolve(issue);
      },
      writeBead: (issue) => {
        store.set(issue.id, issue);
        return Promise.resolve();
      },
      createBead: (input) => {
        const issue = bead(`is-01hx5zzkbkactav9wevgem${String(store.size).padStart(4, '0')}`, {
          title: input.title,
          kind: input.kind,
          status: input.status,
          priority: input.priority,
          description: input.description ?? undefined,
        });
        store.set(issue.id, issue);
        return Promise.resolve(issue);
      },
      afterJournal: () => Promise.resolve(),
      affirmBulk: (counts) => {
        affirmed.push(counts);
        return Promise.resolve();
      },
    };
  });

  afterEach(async () => {
    await server.stop();
    await rm(dir, { recursive: true, force: true });
  });

  function run(allIssues: Issue[], policy = POLICY, dryRun = false) {
    return runSync({
      provider: 'linear',
      adapter,
      policy,
      dataSyncDir: dir,
      allIssues,
      displayId: (id) => id.slice(-4),
      callbacks,
      dryRun,
      now: () => new Date().toISOString(),
    });
  }

  it('creates outbound, links, seeds the base, then goes quiet', async () => {
    const epic = bead('is-01hx5zzkbkactav9wevgemmvrz');
    store.set(epic.id, epic);

    const first = await run([epic]);
    expect(first.createdOutbound).toEqual(['mvrz']);
    expect(first.failures).toEqual([]);

    const linked = store.get(epic.id)!;
    expect(readLink(linked, 'linear')?.id).toBeDefined();

    // Steady state: the tracker echoes our own writes with fresh updatedAt
    // (the mock bumps updatedAt on every mutation); the base absorbs it.
    const second = await run([linked]);
    expect(second.pushed).toEqual([]);
    expect(second.pulled).toEqual([]);
    expect(second.conflicts).toEqual([]);
    expect(second.createdOutbound).toEqual([]);
  });

  it('pushes local edits and pulls remote edits after linking', async () => {
    const epic = bead('is-01hx5zzkbkactav9wevgemmvrz');
    store.set(epic.id, epic);
    await run([epic]);
    let linked = store.get(epic.id)!;
    await run([linked]); // settle

    // Local edit → push.
    linked = {
      ...store.get(epic.id)!,
      title: 'Edited locally',
      updated_at: new Date().toISOString(),
    };
    store.set(linked.id, linked);
    const pushRun = await run([linked]);
    expect(pushRun.pushed).toEqual(['mvrz']);
    const externalId = readLink(linked, 'linear')!.id;
    expect(server.issues.get(externalId)?.title).toBe('Edited locally');

    await run([store.get(epic.id)!]); // settle the echo

    // Remote edit → pull.
    const remote = server.issues.get(externalId)!;
    remote.title = 'Edited in the tracker';
    remote.updatedAt = new Date(Date.now() + 60_000).toISOString();
    const pullRun = await run([store.get(epic.id)!]);
    expect(pullRun.pulled).toEqual(['mvrz']);
    expect(store.get(epic.id)!.title).toBe('Edited in the tracker');
  });

  it('reports a conflict once, posts the comment, and both sides converge', async () => {
    const epic = bead('is-01hx5zzkbkactav9wevgemmvrz');
    store.set(epic.id, epic);
    await run([epic]);
    await run([store.get(epic.id)!]); // settle

    const externalId = readLink(store.get(epic.id)!, 'linear')!.id;
    // Diverge both sides.
    const remote = server.issues.get(externalId)!;
    remote.title = 'Tracker title';
    remote.updatedAt = new Date(Date.now() + 60_000).toISOString();
    const localEdit = {
      ...store.get(epic.id)!,
      title: 'Bead title',
      updated_at: new Date(Date.now() + 120_000).toISOString(), // newer → local wins
    };
    store.set(localEdit.id, localEdit);

    const conflictRun = await run([localEdit]);
    expect(conflictRun.conflicts).toEqual([{ beadId: 'mvrz', field: 'title', winner: 'local' }]);
    expect(server.issues.get(externalId)?.title).toBe('Bead title');
    expect(server.comments.some((c) => c.body.includes('tbd sync conflict'))).toBe(true);

    const settle = await run([store.get(epic.id)!]);
    expect(settle.conflicts).toEqual([]);
  });

  it('syncs comments both ways and dedups across runs', async () => {
    const epic = bead('is-01hx5zzkbkactav9wevgemmvrz');
    store.set(epic.id, epic);
    await run([epic]);
    await run([store.get(epic.id)!]);
    const externalId = readLink(store.get(epic.id)!, 'linear')!.id;

    // Outbound: author locally, engine posts it.
    const { issue: withComment } = appendLocalComment(
      store.get(epic.id)!,
      'linear',
      'from the bead',
      new Date().toISOString(),
    );
    store.set(withComment.id, withComment);
    const outRun = await run([withComment]);
    expect(outRun.commentsPushed).toBe(1);
    expect(server.comments.filter((c) => c.issueId === externalId)).toHaveLength(1);

    // Inbound: a tracker-side comment flows into the bead exactly once.
    await adapter.createComment(externalId, 'from the tracker');
    const inRun = await run([store.get(epic.id)!]);
    expect(inRun.commentsPulled).toBe(1);
    const entries = readComments(store.get(epic.id)!, 'linear');
    expect(entries.map((entry) => entry.body).sort()).toEqual([
      'from the bead',
      'from the tracker',
    ]);

    const again = await run([store.get(epic.id)!]);
    expect(again.commentsPulled).toBe(0);
    expect(again.commentsPushed).toBe(0);
  });

  it('reports inbound candidates and imports under auto', async () => {
    server.addIssue({
      id: 'external-only',
      identifier: 'FIN-77',
      title: 'Filed by a PM',
      updatedAt: new Date().toISOString(),
    });

    const reportPolicy = PolicyDefinitionSchema.parse({
      outbound: { kinds: [], statuses: [], specs: 'none', linked: true },
      inbound: { mode: 'report' },
    });
    const reported = await run([], reportPolicy);
    expect(reported.importable.map((item) => item.key)).toEqual(['FIN-77']);
    expect(reported.importedInbound).toEqual([]);

    const autoPolicy = PolicyDefinitionSchema.parse({
      outbound: { kinds: [], statuses: [], specs: 'none', linked: true },
      inbound: { mode: 'auto', as_kind: 'task' },
    });
    const imported = await run([], autoPolicy);
    expect(imported.importedInbound).toHaveLength(1);
    const created = [...store.values()].find((issue) => issue.title === 'Filed by a PM');
    expect(created).toBeDefined();
    expect(readLink(created!, 'linear')?.id).toBe('external-only');
  });

  it('counts both directions in the bulk guard', async () => {
    const epic = bead('is-01hx5zzkbkactav9wevgemmvrz');
    store.set(epic.id, epic);
    await run([epic]);
    expect(affirmed.at(-1)).toEqual({ creates: 1, updates: 0 });
  });

  it('a dry run fetches but writes nothing anywhere', async () => {
    const epic = bead('is-01hx5zzkbkactav9wevgemmvrz');
    store.set(epic.id, epic);
    const preview = await run([epic], POLICY, true);
    expect(preview.createdOutbound).toEqual(['mvrz']);
    expect(server.issues.size).toBe(0);
    expect(readLink(store.get(epic.id)!, 'linear')).toBeUndefined();
    expect(affirmed).toEqual([]);
  });
});
