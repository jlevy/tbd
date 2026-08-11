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
import { listIntentFiles, writeIntentFile } from '../src/integrations/core/intents.js';
import { runSync, type SyncCallbacks } from '../src/integrations/core/sync-engine.js';
import { LinearAdapter } from '../src/integrations/linear/adapter.js';
import { LinearClient } from '../src/integrations/linear/client.js';
import { PolicyDefinitionSchema } from '../src/lib/schemas.js';
import { priorityToLinear } from '../src/integrations/linear/mapping.js';
import type { Issue, PolicyDefinition, PriorityType } from '../src/lib/types.js';
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

  function runWithEquivalence(allIssues: Issue[]) {
    return runSync({
      provider: 'linear',
      adapter,
      policy: POLICY,
      dataSyncDir: dir,
      allIssues,
      displayId: (id) => id.slice(-4),
      mirrorLabels: false,
      equivalences: {
        priority: (a, b) =>
          priorityToLinear(a as PriorityType) === priorityToLinear(b as PriorityType),
      },
      callbacks,
      dryRun: false,
      now: () => new Date().toISOString(),
    });
  }

  function run(allIssues: Issue[], policy = POLICY, dryRun = false) {
    return runSync({
      provider: 'linear',
      adapter,
      policy,
      dataSyncDir: dir,
      allIssues,
      displayId: (id) => id.slice(-4),
      mirrorLabels: false,
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

  it('never pulls its own conflict-report comments back as content', async () => {
    const epic = bead('is-01hx5zzkbkactav9wevgemmvrz');
    store.set(epic.id, epic);
    await run([epic]);
    await run([store.get(epic.id)!]); // settle
    const externalId = readLink(store.get(epic.id)!, 'linear')!.id;

    await adapter.postConflict(externalId, {
      beadId: 'mvrz',
      field: 'title',
      keptValue: 'a',
      discardedValue: 'b',
      atticPath: 'x',
    });
    await adapter.createComment(externalId, 'a real human comment');

    const pull = await run([store.get(epic.id)!]);
    expect(pull.commentsPulled).toBe(1); // the human one only
    const bodies = readComments(store.get(epic.id)!, 'linear').map((c) => c.body);
    expect(bodies).toEqual(['a real human comment']);
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

  it('never pushes or wipes labels when mirror_labels is off — the live incident', async () => {
    // Found on the first production run: field_sync.labels defaults to
    // 'local', and without the gate the engine pushed raw bead labels (one
    // team label created per bead label) and pushed [] for label-less beads,
    // stripping tbd's own blocked/deferred status carriers.
    const epic = bead('is-01hx5zzkbkactav9wevgemmvrz', { labels: ['viewer', 'phase-1'] });
    store.set(epic.id, epic);
    await run([epic]);
    await run([store.get(epic.id)!]); // settle

    const externalId = readLink(store.get(epic.id)!, 'linear')!.id;
    // The tracker item carries tbd's status carrier; bead labels differ.
    const remote = server.issues.get(externalId)!;
    remote.labels = { nodes: [{ id: 'label-carrier', name: 'tbd:blocked' }] };
    remote.updatedAt = new Date(Date.now() + 60_000).toISOString();

    const settle = await run([store.get(epic.id)!]);
    // No label flow in either direction, no team labels created.
    expect(server.labels.some((l) => l.name === 'viewer')).toBe(false);
    expect(settle.overwrites.filter((o) => o.field === 'labels')).toEqual([]);
    expect(store.get(epic.id)!.labels).toEqual(['viewer', 'phase-1']);
  });

  it('a P4 bead does not oscillate through the priority non-bijection', async () => {
    // Linear's 4 means both P3 and P4; a pushed P4 reads back as P3 forever.
    // The provider equivalence keeps the pair quiet and the bead at P4.
    const epic = bead('is-01hx5zzkbkactav9wevgemmvrz', { priority: 4 });
    store.set(epic.id, epic);
    await runWithEquivalence([epic]);
    const first = await runWithEquivalence([store.get(epic.id)!]);
    expect(first.pulled).toEqual([]);
    expect(first.conflicts).toEqual([]);
    expect(store.get(epic.id)!.priority).toBe(4);

    const second = await runWithEquivalence([store.get(epic.id)!]);
    expect(second.nothingToDo).toBe(true);
  });

  it('a crash between create and attachments replays to a complete item', async () => {
    // Bugbot PR #206 R2: outbound creates journaled only the create, so a
    // crash after the issue existed left it bare forever. Attachments and the
    // managed block are journaled too, and the journal survives failures.
    const epic = bead('is-01hx5zzkbkactav9wevgemmvrz');
    store.set(epic.id, epic);

    // First run: the create lands, the attachment upsert blows up.
    const original = adapter.upsertAttachments.bind(adapter);
    let calls = 0;
    adapter.upsertAttachments = async (id, attachments) => {
      calls += 1;
      if (calls === 1) {
        throw new Error('transport died');
      }
      return original(id, attachments);
    };

    const crashed = await run([epic]);
    expect(crashed.failures).toHaveLength(1);
    expect(server.issues.size).toBe(1); // the item exists...
    expect(server.attachments).toHaveLength(0); // ...but bare
    expect(await listIntentFiles(dir, 'linear')).toHaveLength(1); // journal kept

    // Next run: replay completes the item; create recovers as duplicate.
    const recovered = await run([store.get(epic.id)!]);
    expect(recovered.failures).toEqual([]);
    expect(server.issues.size).toBe(1); // no duplicate item
    expect(server.attachments).toHaveLength(1); // attachments landed
    const item = [...server.issues.values()][0]!;
    expect(item.description ?? '').toContain('tbd:begin'); // block spliced
    expect(await listIntentFiles(dir, 'linear')).toHaveLength(0); // consumed
  });

  it("a stale replay failure does not block this run's journal cleanup", async () => {
    // Bugbot follow-up: report.failures also carries replay failures from
    // OLDER intent files; those must not pin the current run's journal.
    await writeIntentFile(dir, {
      type: 'in',
      run_id: '01hx5zzkbkactav9wevgemstale',
      provider: 'linear',
      created_at: '2026-08-10T00:00:00.000Z',
      ops: [{ kind: 'update_issue', external_id: 'missing-forever', patch: { title: 'x' } }],
    });

    const epic = bead('is-01hx5zzkbkactav9wevgemmvrz');
    store.set(epic.id, epic);
    const result = await run([epic]); // clean outbound create + a failing replay

    expect(result.failures).toHaveLength(1); // the stale replay, reported
    expect(result.createdOutbound).toEqual(['mvrz']); // this run's work landed
    const remaining = await listIntentFiles(dir, 'linear');
    // Only the stale file survives; this run's journal was consumed.
    expect(remaining.map((f) => f.run_id)).toEqual(['01hx5zzkbkactav9wevgemstale']);
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
