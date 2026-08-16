/**
 * The sync engine end to end against the mock provider: outbound creation,
 * echo-free steady state, pulls, pushes, comments both ways, conflicts with
 * exactly-once reports, and inbound report/import.
 */

import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { clearLink, readLink, writeLink } from '../src/integrations/core/link-store.js';
import { readLinkRecord } from '../src/integrations/core/bridge-state.js';
import { readComments } from '../src/integrations/core/comment-store.js';
import { appendLocalComment, recordPushedComment } from '../src/integrations/core/comment-store.js';
import { listIntentFiles, writeIntentFile } from '../src/integrations/core/intents.js';
import { MANAGED_BLOCK_MARKERS } from '../src/integrations/core/managed-block.js';
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
  let archived: Parameters<SyncCallbacks['archiveConflict']>[0][];

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
    archived = [];
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
          parent_id: input.parentId,
          assignee: input.assignee,
        });
        store.set(issue.id, issue);
        return Promise.resolve(issue);
      },
      afterJournal: () => Promise.resolve(),
      archiveConflict: (conflict) => {
        archived.push(conflict);
        return Promise.resolve(`.tbd/data-sync/attic/${conflict.beadId}_${conflict.field}.yml`);
      },
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
      mirrorLabels: 'none',
      equivalences: {
        priority: (a, b) =>
          priorityToLinear(a as PriorityType) === priorityToLinear(b as PriorityType),
      },
      callbacks,
      dryRun: false,
      now: () => new Date().toISOString(),
    });
  }

  function run(
    allIssues: Issue[],
    policy = POLICY,
    dryRun = false,
    originLabels: string[] = [],
    specUrl?: (issue: Issue) => string | undefined,
  ) {
    return runSync({
      provider: 'linear',
      adapter,
      policy,
      dataSyncDir: dir,
      allIssues,
      displayId: (id) => id.slice(-4),
      mirrorLabels: 'none',
      originLabels,
      ...(specUrl ? { specUrl } : {}),
      callbacks,
      dryRun,
      now: () => new Date().toISOString(),
    });
  }

  it('settles when the managed block contains a link the tracker rewrites', async () => {
    // The third write loop found in this feature, and the one no other check could see.
    // tbd renders `Spec: [name](url)`; Linear stores `[name](<url>)`, which CommonMark
    // renders identically. The managed-block comparison ran on raw strings, so it found
    // a difference every run and rewrote the block forever — and the base hash could not
    // catch it, because hashing strips the managed block before comparing.
    const id = 'is-01hx5zzkbkactav9wevgemma21';
    store.set(
      id,
      bead(id, { spec_path: 'docs/project/specs/active/plan-2026-01-19-transactional.md' }),
    );
    const specUrl = () => 'https://github.com/jlevy/tbd/blob/main/docs/project/specs/active/x.md';

    await run([...store.values()], POLICY, false, [], specUrl);
    await run([...store.values()], POLICY, false, [], specUrl); // settle

    // The stored description really did come back rewritten, or this proves nothing.
    const remote = [...server.issues.values()][0]!;
    expect(remote.description).toContain('](<https://github.com/');

    const settled = await run([...store.values()], POLICY, false, [], specUrl);
    expect(settled.pushed).toEqual([]);
    expect(settled.nothingToDo).toBe(true);
  });

  describe('origin labels in a Linear label group', () => {
    it('creates repo/<name> as a real group, not a flat slash-named label', async () => {
      const epic = bead('is-01hx5zzkbkactav9wevgemmvrz');
      store.set(epic.id, epic);

      await run([...store.values()], POLICY, false, ['tbd:sync', 'repo/tbd']);

      const flat = server.labels.find((l) => l.name === 'repo/tbd');
      expect(flat).toBeUndefined();

      const group = server.labels.find((l) => l.name === 'repo' && l.isGroup);
      expect(group).toBeDefined();

      // The child stores only the LEAF name; the group is carried by `parent`.
      const child = server.labels.find((l) => l.name === 'tbd' && l.parent?.id === group!.id);
      expect(child).toBeDefined();

      // The origin marker is a separate root label, and it must NOT share the repo's
      // leaf name: Linear enforces name uniqueness across the whole team regardless of
      // group, so `tbd` beside `repo/tbd` is rejected outright. The `tbd:` prefix is
      // what keeps the two namespaces disjoint — a repo leaf can never contain a colon.
      const origin = server.labels.find((l) => l.name === 'tbd:sync' && !l.parent);
      expect(origin).toBeDefined();
      expect(origin!.id).not.toBe(child!.id);
    });

    it('refuses the shape Linear refuses: a root label sharing a grouped leaf name', async () => {
      // The guard that would have caught this before it reached a live workspace. If the
      // mock ever stops enforcing team-wide leaf uniqueness, this test goes green while
      // real provisioning stays broken — which is exactly what happened once already.
      const epic = bead('is-01hx5zzkbkactav9wevgemmvrz');
      store.set(epic.id, epic);

      await run([...store.values()], POLICY, false, ['tbd', 'repo/tbd']);

      const rootTbd = server.labels.filter((l) => l.name === 'tbd' && !l.parent);
      const groupedTbd = server.labels.filter((l) => l.name === 'tbd' && l.parent);
      // One of the two can exist, never both.
      expect(rootTbd.length + groupedTbd.length).toBe(1);
    });

    it('applies both labels to the created issue', async () => {
      const epic = bead('is-01hx5zzkbkactav9wevgemmvrz');
      store.set(epic.id, epic);

      await run([...store.values()], POLICY, false, ['tbd:sync', 'repo/tbd']);

      const issue = [...server.issues.values()][0]!;
      const applied = issue.labels.nodes.map((n) =>
        n.parent ? `${n.parent.name}/${n.name}` : n.name,
      );
      expect(applied.sort()).toEqual(['repo/tbd', 'tbd:sync']);
    });

    it('settles once the group exists, rather than re-asserting the grouped label', async () => {
      // The loop this guards against: a grouped label reads back as its bare leaf
      // (`tbd`), so an engine comparing against its required `repo/tbd` never finds it,
      // and re-asserts on every sync for the life of the repository. Qualifying both
      // sides is what makes the comparison terminate.
      const epic = bead('is-01hx5zzkbkactav9wevgemmvrz');
      store.set(epic.id, epic);

      const labels = ['tbd:sync', 'repo/tbd'];
      await run([...store.values()], POLICY, false, labels);
      await run([...store.values()], POLICY, false, labels); // settle, as any mirror does
      const labelCountAfterSettle = server.labels.length;

      const settled = await run([...store.values()], POLICY, false, labels);

      expect(settled.nothingToDo).toBe(true);
      expect(settled.pushed).toEqual([]);
      // No duplicate group or child was minted on the way to quiet.
      expect(server.labels.length).toBe(labelCountAfterSettle);
      expect(server.labels.filter((l) => l.name === 'repo' && l.isGroup)).toHaveLength(1);
    });
  });

  it('plans a create under dryRun without touching the tracker or the bead', async () => {
    // The `report` fold mode depends on this: it reports what a sync would do and
    // writes nothing. If the engine wrote here, `report` would be a silent live sync.
    const epic = bead('is-01hx5zzkbkactav9wevgemmvrz');
    store.set(epic.id, epic);

    const dry = await run([epic], POLICY, true);

    expect(dry.createdOutbound).toEqual(['mvrz']);
    expect(server.issues.size).toBe(0);
    expect(readLink(store.get(epic.id)!, 'linear')).toBeUndefined();
    // Nothing was written, so there was nothing to affirm.
    expect(affirmed).toEqual([]);
  });

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

  it('asserts origin labels once, then stays quiet', async () => {
    // The trap this guards: putting ensureLabels in every patch would make every pair
    // look changed, because a non-empty externalPatch is what "changed" means here. A
    // settled mirror would then write, commit, and push on every sync — undoing the
    // property that makes frequent syncing affordable at all.
    const id = 'is-01hx5zzkbkactav9wevgemmb01';
    store.set(id, bead(id));

    const labels = ['tbd:sync', 'repo/tbd'];
    await run([...store.values()], POLICY, false, labels);
    await run([...store.values()], POLICY, false, labels); // settle, as any mirror does

    // Once the labels are on the remote, asserting them again is not a change.
    const settled = await run([...store.values()], POLICY, false, labels);
    expect(settled.nothingToDo).toBe(true);
  });

  it('backfills origin labels onto an item that predates them', async () => {
    // An item linked before the labels existed — or imported from the tracker — must
    // pick them up rather than staying invisible to the filters they exist for.
    const id = 'is-01hx5zzkbkactav9wevgemmb02';
    store.set(id, bead(id));

    await run([...store.values()]);
    await run([...store.values()]); // settle with no origin labels

    const labelled = await run([...store.values()], POLICY, false, ['tbd:sync', 'repo/tbd']);
    expect(labelled.nothingToDo).toBe(false);

    // And once backfilled, it settles again rather than re-asserting forever.
    const after = await run([...store.values()], POLICY, false, ['tbd:sync', 'repo/tbd']);
    expect(after.nothingToDo).toBe(true);
  });

  it('a settled mirror writes nothing on a further quiet sync', async () => {
    // The property that makes frequent syncing affordable. Rewriting bridge
    // records that only differ by `synced_at` turns a sync with nothing to do
    // into a commit, a push, and whatever the repo's pre-push hook costs.
    const ids = [
      'is-01hx5zzkbkactav9wevgemma01',
      'is-01hx5zzkbkactav9wevgemma02',
      'is-01hx5zzkbkactav9wevgemma03',
    ];
    for (const id of ids) {
      store.set(id, bead(id));
    }
    await run([...store.values()]);
    await run([...store.values()]); // settle

    const linksDir = join(dir, 'bridge', 'linear', 'links');
    const before = new Map<string, string>();
    for (const file of await readdir(linksDir)) {
      before.set(file, await readFile(join(linksDir, file), 'utf8'));
    }
    expect(before.size).toBe(ids.length);

    const quiet = await run([...store.values()]);
    expect(quiet.nothingToDo).toBe(true);

    const after = new Map<string, string>();
    for (const file of await readdir(linksDir)) {
      after.set(file, await readFile(join(linksDir, file), 'utf8'));
    }
    expect(after).toEqual(before);
  });

  it('refreshes a renamed identifier on a settled pair, where nothing else changed', async () => {
    // Renaming a Linear team rewrites every identifier in it (TBD-7 becomes
    // OS-7) while the UUID — the actual link — is untouched. That leaves a
    // settled mirror with nothing to push, so a refresh that only ran for pairs
    // with pending writes would strand every stored identifier at its old
    // value. The record is the one thing every linked pair rewrites, which is
    // why the identifier lives there rather than on the bead.
    const id = 'is-01hx5zzkbkactav9wevgemma11';
    store.set(id, bead(id));
    await run([...store.values()]);
    await run([...store.values()]); // settle

    const before = await readLinkRecord(dir, 'linear', id);
    expect(before?.external_key).toBe('FIN-1');

    const remote = server.issues.get(before!.external_id)!;
    remote.identifier = 'OS-1';
    remote.url = 'https://linear.app/acme/issue/OS-1';

    const renamed = await run([...store.values()]);

    // Nothing was pushed: the rename is a tracker-side relabelling, not a
    // change tbd has any edit to send.
    expect(renamed.pushed).toEqual([]);
    const after = await readLinkRecord(dir, 'linear', id);
    expect(after?.external_key).toBe('OS-1');
    expect(after?.external_url).toBe('https://linear.app/acme/issue/OS-1');
    // The link itself never moved.
    expect(after?.external_id).toBe(before!.external_id);
    // And the bead is untouched — no version churn in git for a remote rename.
    expect(store.get(id)!.extensions?.linear).not.toHaveProperty('key');
  });

  describe('batch failure containment on outbound creates', () => {
    const createAttempts = () =>
      server.requests.filter((request) => request.query.includes('mutation IssueCreate'));

    it('halts remaining creates at the first workspace-limit rejection', async () => {
      // The limit is a property of the workspace, so once one create hits it,
      // every later one in the batch is doomed for the same reason. Observed
      // live: a 77-create sync burned a request per doomed item, then its
      // replay backlog did it again on every subsequent sync.
      const ids = [
        'is-01hx5zzkbkactav9wevgemmc01',
        'is-01hx5zzkbkactav9wevgemmc02',
        'is-01hx5zzkbkactav9wevgemmc03',
        'is-01hx5zzkbkactav9wevgemmc04',
      ];
      for (const id of ids) {
        store.set(id, bead(id, { title: `Epic ${id.slice(-3)}` }));
      }
      server.freeIssueLimit = 1;

      const result = await run([...store.values()]);

      expect(result.createdOutbound).toHaveLength(1);
      expect(result.failures).toHaveLength(3);
      // One success, one limit rejection — the two remaining were never sent.
      expect(createAttempts()).toHaveLength(2);
      const notAttempted = result.failures.filter((failure) =>
        failure.error.startsWith('not attempted:'),
      );
      expect(notAttempted).toHaveLength(2);
    });

    it('does not attempt a child whose parent failed to create in this run', async () => {
      // The child's parentId is the parent's pre-assigned client id, which
      // never came to exist — Linear rejects it with "parentId contained an
      // entry that could not be found" (observed live). Skipping locally keeps
      // both journaled, and a later replay creates parent then child in order.
      const parentId = 'is-01hx5zzkbkactav9wevgemmd01';
      const childId = 'is-01hx5zzkbkactav9wevgemmd02';
      store.set(parentId, bead(parentId, { title: 'Doomed parent' }));
      store.set(childId, bead(childId, { title: 'Orphan child', parent_id: parentId }));
      server.failCreateTitles.add('Doomed parent');

      const result = await run([...store.values()]);

      expect(result.createdOutbound).toHaveLength(0);
      expect(result.failures).toHaveLength(2);
      const childFailure = result.failures.find((failure) => failure.beadId === 'md02');
      expect(childFailure?.error).toContain('parent failed to create');
      // Only the parent's create reached the provider.
      expect(createAttempts()).toHaveLength(1);
    });

    it('replays a halted backlog without re-paying a request per doomed item', async () => {
      const ids = [
        'is-01hx5zzkbkactav9wevgemme01',
        'is-01hx5zzkbkactav9wevgemme02',
        'is-01hx5zzkbkactav9wevgemme03',
      ];
      for (const id of ids) {
        store.set(id, bead(id, { title: `Epic ${id.slice(-3)}` }));
      }
      server.freeIssueLimit = 0;
      await run([...store.values()]); // journals 3 creates, halts after the first rejection

      const before = createAttempts().length;
      const second = await run([...store.values()]);

      // One probe rediscovers the limit; the rest of the backlog stays parked.
      expect(createAttempts().length - before).toBe(1);
      expect(second.createdOutbound).toHaveLength(0);

      // And the backlog is a backlog, not a graveyard: lift the limit and the
      // next sync converges everything.
      server.freeIssueLimit = undefined;
      const recovered = await run([...store.values()]);
      expect(recovered.failures).toEqual([]);
      expect(server.issues.size).toBe(3);
    });

    it('compacts a partially-failed journal so replay pays only for pending ops', async () => {
      // File-granular retention meant a 200-op journal replayed its succeeded
      // ops on every sync until the last one cleared — observed live as ~90
      // redundant requests per run. After a partial pass, the journal keeps
      // only what is still pending.
      const ids = [
        'is-01hx5zzkbkactav9wevgemmf01',
        'is-01hx5zzkbkactav9wevgemmf02',
        'is-01hx5zzkbkactav9wevgemmf03',
      ];
      for (const id of ids) {
        store.set(id, bead(id, { title: `Epic ${id.slice(-3)}` }));
      }
      server.freeIssueLimit = 2; // two fit, the third trips the limit
      await run([...store.values()]); // journals everything, applies partially

      // The first sync keeps its own journal whole — the engine does not track
      // per-op completion. The NEXT sync's replay pass recovers the succeeded
      // ops (idempotently) and it is that pass which compacts.
      const [before] = await listIntentFiles(dir, 'linear');
      expect(before!.ops.filter((op) => op.kind === 'create_issue')).toHaveLength(3);

      await run([...store.values()]); // replay recovers 2, re-fails 1, compacts

      const [journal] = await listIntentFiles(dir, 'linear');
      expect(journal).toBeDefined();
      // Only the doomed create's ops remain; every recovered op is gone, so a
      // third sync pays one probe rather than one request per completed op.
      expect(
        journal!.ops.filter((op) => op.kind === 'create_issue').map((op) => op.bead_id),
      ).toEqual(['is-01hx5zzkbkactav9wevgemmf03']);

      // The compacted journal converges once the limit lifts.
      server.freeIssueLimit = undefined;
      const recovered = await run([...store.values()]);
      expect(recovered.failures).toEqual([]);
      expect(await listIntentFiles(dir, 'linear')).toEqual([]);
      expect(server.issues.size).toBe(3);
    });
  });

  it('backfills and preserves the managed block on a pre-existing linked item', async () => {
    server.addIssue({
      id: 'linked-item',
      identifier: 'FIN-10',
      title: 'Linked issue',
      description: 'Human prose',
    });
    const linked = writeLink(
      bead('is-01hx5zzkbkactav9wevgemmvrz', {
        title: 'Linked issue',
        description: 'Human prose',
      }),
      {
        provider: 'linear',
        id: 'linked-item',
        key: 'FIN-10',
        linked_at: '2026-08-10T00:00:00.000Z',
      },
    );
    store.set(linked.id, linked);

    const backfill = await run([linked]);

    expect(backfill.failures).toEqual([]);
    expect(backfill.pushed).toEqual(['mvrz']);
    expect(server.issues.get('linked-item')?.description).toContain('Human prose');
    expect(server.issues.get('linked-item')?.description).toContain(MANAGED_BLOCK_MARKERS.begin);

    const edited = {
      ...store.get(linked.id)!,
      description: 'Revised human prose',
      updated_at: new Date(Date.now() + 120_000).toISOString(),
    };
    store.set(edited.id, edited);
    const update = await run([edited]);
    const description = server.issues.get('linked-item')?.description ?? '';

    expect(update.failures).toEqual([]);
    expect(description).toContain('Revised human prose');
    expect(description.split(MANAGED_BLOCK_MARKERS.begin)).toHaveLength(2);
    expect(description.split(MANAGED_BLOCK_MARKERS.end)).toHaveLength(2);
  });

  it('does not report a push when the managed-block splice is already satisfied', async () => {
    server.addIssue({
      id: 'linked-item',
      identifier: 'FIN-10',
      title: 'Linked issue',
      description: 'Human prose',
    });
    const linked = writeLink(
      bead('is-01hx5zzkbkactav9wevgemmvrz', {
        title: 'Linked issue',
        description: 'Human prose',
      }),
      {
        provider: 'linear',
        id: 'linked-item',
        key: 'FIN-10',
        linked_at: '2026-08-10T00:00:00.000Z',
      },
    );
    store.set(linked.id, linked);
    vi.spyOn(adapter, 'spliceDescription').mockResolvedValue(null);

    const result = await run([linked]);

    expect(result.failures).toEqual([]);
    expect(result.pushed).toEqual([]);
  });

  it('renders the managed block from values pulled during the same sync', async () => {
    const policy = PolicyDefinitionSchema.parse({
      outbound: { kinds: ['epic'], statuses: ['open'], specs: 'none', linked: true },
      field_sync: { fields: { status: 'remote' } },
    });
    const epic = bead('is-01hx5zzkbkactav9wevgemmvrz');
    store.set(epic.id, epic);

    await run([epic], policy);
    const linked = store.get(epic.id)!;
    const externalId = readLink(linked, 'linear')!.id;
    const remote = server.issues.get(externalId)!;
    remote.state = server.states.find((state) => state.type === 'started')!;
    remote.updatedAt = new Date(Date.now() + 60_000).toISOString();

    const result = await run([linked], policy);
    const description = server.issues.get(externalId)?.description ?? '';

    expect(result.failures).toEqual([]);
    expect(result.pulled).toEqual(['mvrz']);
    expect(store.get(epic.id)?.status).toBe('in_progress');
    expect(description).toContain('· in_progress ·');
    expect(description).not.toContain('· open ·');
  });

  it('fails a linked pair closed before any write when managed markers are malformed', async () => {
    const malformed = `${MANAGED_BLOCK_MARKERS.begin}\nfirst\n${MANAGED_BLOCK_MARKERS.begin}\nsecond\n${MANAGED_BLOCK_MARKERS.end}`;
    server.addIssue({
      id: 'linked-item',
      identifier: 'FIN-10',
      title: 'Remote title',
      description: malformed,
    });
    const linked = writeLink(
      bead('is-01hx5zzkbkactav9wevgemmvrz', {
        title: 'Local title',
        description: 'Local replacement',
      }),
      {
        provider: 'linear',
        id: 'linked-item',
        key: 'FIN-10',
        linked_at: '2026-08-10T00:00:00.000Z',
      },
    );
    store.set(linked.id, linked);

    const result = await run([linked]);

    expect(result.failures).toEqual([
      {
        beadId: 'mvrz',
        error: 'Managed block markers in FIN-10 are malformed; skipped all writes for this pair.',
      },
    ]);
    expect(server.issues.get('linked-item')).toMatchObject({
      title: 'Remote title',
      description: malformed,
    });
  });

  it('reports provider mapping warnings once even when an item appears in multiple fetches', async () => {
    const epic = bead('is-01hx5zzkbkactav9wevgemmvrz');
    store.set(epic.id, epic);
    await run([epic]);
    const linked = store.get(epic.id)!;
    const externalId = readLink(linked, 'linear')!.id;
    const remote = server.issues.get(externalId)!;
    remote.state = { id: 'state-custom', name: 'Needs Triage', type: 'custom_triage' };
    remote.updatedAt = new Date(Date.now() + 60_000).toISOString();

    const result = await run([linked]);

    expect(result.warnings).toEqual([
      {
        externalId,
        externalKey: remote.identifier,
        message: 'Unknown Linear workflow state type "custom_triage"; mapped to open.',
      },
    ]);
    expect(result.nothingToDo).toBe(false);
  });

  it('creates an outbound parent before its child and preserves Linear hierarchy', async () => {
    const parent = bead('is-01hx5zzkbkactav9wevgemmvra', { title: 'Local parent' });
    const child = bead('is-01hx5zzkbkactav9wevgemmvrb', {
      title: 'Local child',
      parent_id: parent.id,
    });
    store.set(parent.id, parent);
    store.set(child.id, child);

    const result = await run([child, parent]);

    const linkedParent = readLink(store.get(parent.id)!, 'linear');
    const linkedChild = readLink(store.get(child.id)!, 'linear');
    expect(result.failures).toEqual([]);
    expect(result.createdOutbound).toEqual(['mvra', 'mvrb']);
    expect(server.issues.get(linkedChild!.id)?.parent?.id).toBe(linkedParent?.id);
  });

  it('skips new outbound beads beyond max_nesting instead of flattening them', async () => {
    const root = bead('is-01hx5zzkbkactav9wevgemmvra', { title: 'Root' });
    const middle = bead('is-01hx5zzkbkactav9wevgemmvrb', {
      title: 'Middle',
      parent_id: root.id,
    });
    const deep = bead('is-01hx5zzkbkactav9wevgemmvrc', {
      title: 'Deep',
      parent_id: middle.id,
    });
    for (const issue of [root, middle, deep]) {
      store.set(issue.id, issue);
    }

    const result = await runSync({
      provider: 'linear',
      adapter,
      policy: POLICY,
      dataSyncDir: dir,
      allIssues: [deep, middle, root],
      displayId: (id) => id.slice(-4),
      mirrorLabels: 'none',
      maxNesting: 2,
      callbacks,
      dryRun: false,
      now: () => new Date().toISOString(),
    });

    expect(result.createdOutbound).toEqual(['mvra', 'mvrb']);
    expect(result.skippedOutbound).toEqual([
      { beadId: 'mvrc', reason: 'nested 3 levels, past max_nesting 2' },
    ]);
    expect(readLink(store.get(deep.id)!, 'linear')).toBeUndefined();
  });

  it('restores the tbd-owned parent relationship after a linked Linear issue is reparented', async () => {
    const parent = bead('is-01hx5zzkbkactav9wevgemmvra', { title: 'Local parent' });
    const child = bead('is-01hx5zzkbkactav9wevgemmvrb', {
      title: 'Local child',
      parent_id: parent.id,
    });
    store.set(parent.id, parent);
    store.set(child.id, child);
    await run([child, parent]);
    await run([store.get(child.id)!, store.get(parent.id)!]);
    const parentLink = readLink(store.get(parent.id)!, 'linear')!;
    const childLink = readLink(store.get(child.id)!, 'linear')!;
    const remoteChild = server.issues.get(childLink.id)!;
    remoteChild.parent = null;
    remoteChild.updatedAt = new Date(Date.now() + 60_000).toISOString();

    const pullOnly = await runSync({
      provider: 'linear',
      adapter,
      policy: POLICY,
      dataSyncDir: dir,
      allIssues: [store.get(child.id)!, store.get(parent.id)!],
      displayId: (id) => id.slice(-4),
      mirrorLabels: 'none',
      callbacks,
      direction: 'inbound',
      dryRun: false,
      now: () => new Date().toISOString(),
    });
    expect(pullOnly.pushed).toEqual([]);
    expect(pullOnly.overwrites).toEqual([]);
    expect(remoteChild.parent).toBeNull();

    const result = await run([store.get(child.id)!, store.get(parent.id)!]);

    expect(result.pushed).toContain('mvrb');
    expect(result.overwrites).toContainEqual({
      beadId: 'mvrb',
      field: 'parent',
      direction: 'push',
    });
    expect(server.issues.get(childLink.id)?.parent?.id).toBe(parentLink.id);
  });

  it('fails duplicate external links closed while unrelated pairs still converge', async () => {
    server.addIssue({ id: 'duplicate-item', identifier: 'FIN-10', title: 'Remote duplicate' });
    server.addIssue({ id: 'safe-item', identifier: 'FIN-11', title: 'Remote safe' });
    const linkedAt = '2026-08-10T00:00:00.000Z';
    const duplicateA = writeLink(bead('is-01hx5zzkbkactav9wevgemmvra', { title: 'Bad A' }), {
      provider: 'linear',
      id: 'duplicate-item',
      key: 'FIN-10',
      linked_at: linkedAt,
    });
    const duplicateB = writeLink(bead('is-01hx5zzkbkactav9wevgemmvrb', { title: 'Bad B' }), {
      provider: 'linear',
      id: 'duplicate-item',
      key: 'FIN-10',
      linked_at: linkedAt,
    });
    const safe = writeLink(bead('is-01hx5zzkbkactav9wevgemmvrc', { title: 'Safe local' }), {
      provider: 'linear',
      id: 'safe-item',
      key: 'FIN-11',
      linked_at: linkedAt,
    });
    for (const issue of [duplicateA, duplicateB, safe]) {
      store.set(issue.id, issue);
    }

    const result = await run([duplicateB, safe, duplicateA]);

    expect(server.issues.get('duplicate-item')?.title).toBe('Remote duplicate');
    expect(server.issues.get('safe-item')?.title).toBe('Safe local');
    expect(result.pushed).toEqual(['mvrc']);
    expect(result.failures).toHaveLength(2);
    expect(result.failures.map((failure) => failure.beadId).sort()).toEqual(['mvra', 'mvrb']);
    for (const failure of result.failures) {
      // The external id, not the human identifier: this check runs before the
      // bridge records are loaded, and the bead no longer carries a key. The
      // parts the remedy acts on — which beads, and which command — are what
      // the message must carry.
      expect(failure.error).toContain('duplicate-item');
      expect(failure.error).toContain('mvra, mvrb');
      expect(failure.error).toContain('integration unlink');
    }
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

  it('round-trips assignees only through an explicit user_map identity', async () => {
    adapter = new LinearAdapter({
      client: new LinearClient({
        apiKey: 'lin_api_test',
        endpoint: server.endpoint,
        sleep: () => Promise.resolve(),
      }),
      teamKey: 'FIN',
      userMap: { josh: 'josh@example.com' },
    });
    const epic = bead('is-01hx5zzkbkactav9wevgemmvrz', { assignee: 'josh' });
    store.set(epic.id, epic);

    await run([epic]);
    const linked = store.get(epic.id)!;
    const externalId = readLink(linked, 'linear')!.id;
    expect(
      server.requests.find((request) => request.query.includes('mutation IssueCreate'))?.variables,
    ).toMatchObject({ input: { assigneeId: 'user-1' } });
    expect(server.issues.get(externalId)?.assignee?.email).toBe('josh@example.com');

    const quiet = await run([linked]);
    expect(quiet.skippedPushes).toEqual([]);
    expect(quiet.pushed).toEqual([]);
    expect(quiet.pulled).toEqual([]);
    expect(store.get(epic.id)?.assignee).toBe('josh');
  });

  it('leaves linked assignee state untouched when the Linear identity is unmapped', async () => {
    adapter = new LinearAdapter({
      client: new LinearClient({
        apiKey: 'lin_api_test',
        endpoint: server.endpoint,
        maxAttempts: 4,
        sleep: () => Promise.resolve(),
      }),
      teamKey: 'FIN',
      userMap: { josh: 'josh@example.com', riley: 'test@example.com' },
    });
    const policy = PolicyDefinitionSchema.parse({
      outbound: { kinds: ['epic'], statuses: ['open'], specs: 'none', linked: true },
      field_sync: { fields: { assignee: 'merge' } },
    });
    const epic = bead('is-01hx5zzkbkactav9wevgemmvrz', { assignee: 'josh' });
    store.set(epic.id, epic);
    await run([epic], policy);
    const linked = store.get(epic.id)!;
    const externalId = readLink(linked, 'linear')!.id;
    await run([linked], policy);

    const remote = server.issues.get(externalId)!;
    remote.assignee = {
      id: 'user-outside-map',
      name: 'Outside Person',
      displayName: 'Outside Person',
      email: 'outside@example.com',
    };
    remote.updatedAt = new Date(Date.now() + 60_000).toISOString();

    const locallyEdited = {
      ...store.get(epic.id)!,
      assignee: 'riley',
      version: store.get(epic.id)!.version + 1,
      updated_at: new Date(Date.now() + 120_000).toISOString(),
    };
    store.set(epic.id, locallyEdited);

    const result = await run([locallyEdited], policy);
    const record = await readLinkRecord(dir, 'linear', epic.id);

    expect(result.pushed).toEqual([]);
    expect(result.pulled).toEqual([]);
    expect(result.warnings.map((warning) => warning.message)).toContain(
      'Linear assignee is not present in user_map; assignee synchronization skipped.',
    );
    expect(store.get(epic.id)?.assignee).toBe('riley');
    expect(record?.base.assignee).toBe('josh');
    expect(remote.assignee.email).toBe('outside@example.com');
    expect(JSON.stringify(store.get(epic.id))).not.toContain('Outside Person');
    expect(JSON.stringify(record)).not.toContain('Outside Person');

    remote.assignee = server.users[0]!;
    remote.updatedAt = new Date(Date.now() + 180_000).toISOString();
    const recovered = await run([store.get(epic.id)!], policy);

    expect(recovered.pushed).toEqual(['mvrz']);
    expect(recovered.pulled).toEqual([]);
    expect(server.issues.get(externalId)?.assignee?.email).toBe('test@example.com');
    expect((await readLinkRecord(dir, 'linear', epic.id))?.base.assignee).toBe('riley');
  });

  it('detects a quiet archived item through the linked-item liveness fetch', async () => {
    const epic = bead('is-01hx5zzkbkactav9wevgemmvrz');
    store.set(epic.id, epic);
    await run([epic]);
    await run([store.get(epic.id)!]);
    const linked = store.get(epic.id)!;
    const externalId = readLink(linked, 'linear')!.id;
    const remote = server.issues.get(externalId)!;

    // Linear archive does not bump updatedAt; it therefore stays outside the
    // watermark delta and can only be observed by the targeted liveness read.
    remote.archivedAt = '2026-08-10T16:00:00.000Z';
    const archived = await run([linked]);

    expect(archived.orphaned).toEqual(['mvrz']);
    expect(store.get(epic.id)?.status).toBe('open');
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
    expect(archived).toEqual([
      expect.objectContaining({
        beadId: epic.id,
        field: 'title',
        lostValue: 'Tracker title',
        winnerSource: 'local',
      }),
    ]);
    expect(server.issues.get(externalId)?.title).toBe('Bead title');
    expect(
      server.comments.some(
        (c) =>
          c.body.includes('tbd sync conflict') &&
          c.body.includes(`.tbd/data-sync/attic/${epic.id}_title.yml`),
      ),
    ).toBe(true);

    const settle = await run([store.get(epic.id)!]);
    expect(settle.conflicts).toEqual([]);
  });

  it('does not overwrite either side when archiving the conflict fails', async () => {
    const epic = bead('is-01hx5zzkbkactav9wevgemmvrz');
    store.set(epic.id, epic);
    await run([epic]);
    await run([store.get(epic.id)!]);
    const linked = store.get(epic.id)!;
    const externalId = readLink(linked, 'linear')!.id;
    const remote = server.issues.get(externalId)!;
    remote.title = 'Tracker wins';
    remote.updatedAt = '2026-08-10T15:00:00.000Z';
    const localEdit = {
      ...linked,
      title: 'Bead loses',
      updated_at: '2026-08-10T14:00:00.000Z',
    };
    store.set(localEdit.id, localEdit);
    callbacks.archiveConflict = () => Promise.reject(new Error('disk full'));

    const failed = await run([localEdit]);

    expect(failed.failures).toEqual([
      expect.objectContaining({ beadId: 'mvrz', error: expect.stringContaining('disk full') }),
    ]);
    expect(store.get(epic.id)?.title).toBe('Bead loses');
    expect(server.issues.get(externalId)?.title).toBe('Tracker wins');
    expect(server.comments).toHaveLength(0);
  });

  it('replays a journaled remote-win conflict exactly once after a crash', async () => {
    const epic = bead('is-01hx5zzkbkactav9wevgemmvrz');
    store.set(epic.id, epic);
    await run([epic]);
    await run([store.get(epic.id)!]);
    const linked = store.get(epic.id)!;
    const externalId = readLink(linked, 'linear')!.id;
    const remote = server.issues.get(externalId)!;
    remote.title = 'Tracker wins after crash';
    remote.updatedAt = '2026-08-10T15:00:00.000Z';
    const localEdit = {
      ...linked,
      title: 'Bead loses after crash',
      updated_at: '2026-08-10T14:00:00.000Z',
    };
    store.set(localEdit.id, localEdit);
    callbacks.afterJournal = () => Promise.reject(new Error('simulated crash'));

    await expect(run([localEdit])).rejects.toThrow('simulated crash');
    expect(await listIntentFiles(dir, 'linear')).toHaveLength(1);
    expect(archived).toHaveLength(1);
    expect(server.comments).toHaveLength(0);

    callbacks.afterJournal = () => Promise.resolve();
    const recovered = await run([store.get(epic.id)!]);

    expect(recovered.replayedOps).toBe(1);
    expect(recovered.conflicts).toEqual([{ beadId: 'mvrz', field: 'title', winner: 'remote' }]);
    expect(store.get(epic.id)?.title).toBe('Tracker wins after crash');
    expect(
      server.comments.filter((comment) => comment.body.includes('tbd sync conflict')),
    ).toHaveLength(1);
    expect(archived).toHaveLength(1);
    expect(await listIntentFiles(dir, 'linear')).toHaveLength(0);

    await run([store.get(epic.id)!]);
    expect(
      server.comments.filter((comment) => comment.body.includes('tbd sync conflict')),
    ).toHaveLength(1);
  });

  it('defers an inbound-only conflict notice and posts it once on the next full sync', async () => {
    const epic = bead('is-01hx5zzkbkactav9wevgemmvrz');
    store.set(epic.id, epic);
    await run([epic]);
    await run([store.get(epic.id)!]);
    const linked = store.get(epic.id)!;
    const externalId = readLink(linked, 'linear')!.id;
    const remote = server.issues.get(externalId)!;
    remote.title = 'Remote winner under pull';
    remote.updatedAt = '2026-08-10T15:00:00.000Z';
    const localEdit = {
      ...linked,
      title: 'Local loser under pull',
      updated_at: '2026-08-10T14:00:00.000Z',
    };
    store.set(localEdit.id, localEdit);

    const inbound = await runSync({
      provider: 'linear',
      adapter,
      policy: POLICY,
      dataSyncDir: dir,
      allIssues: [localEdit],
      displayId: (id) => id.slice(-4),
      mirrorLabels: 'none',
      callbacks,
      direction: 'inbound',
      dryRun: false,
      now: () => new Date().toISOString(),
    });

    expect(inbound.conflicts).toEqual([{ beadId: 'mvrz', field: 'title', winner: 'remote' }]);
    expect(store.get(epic.id)?.title).toBe('Remote winner under pull');
    expect(server.comments).toHaveLength(0);
    expect(await listIntentFiles(dir, 'linear')).toHaveLength(1);

    const full = await run([store.get(epic.id)!]);
    expect(full.replayedOps).toBe(1);
    expect(full.conflicts).toEqual([]);
    expect(
      server.comments.filter((comment) => comment.body.includes('tbd sync conflict')),
    ).toHaveLength(1);
    expect(await listIntentFiles(dir, 'linear')).toHaveLength(0);

    await run([store.get(epic.id)!]);
    expect(
      server.comments.filter((comment) => comment.body.includes('tbd sync conflict')),
    ).toHaveLength(1);
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

  it.each([
    { mode: 'inbound' as const, pushed: 0, pulled: 1, localBodies: ['from the tracker'] },
    { mode: 'outbound' as const, pushed: 1, pulled: 0, localBodies: ['from the bead'] },
    { mode: 'off' as const, pushed: 0, pulled: 0, localBodies: [] },
  ])('enforces the $mode comment-flow boundary', async ({ mode, pushed, pulled, localBodies }) => {
    const epic = bead('is-01hx5zzkbkactav9wevgemmvrz');
    store.set(epic.id, epic);
    await run([epic]);
    await run([store.get(epic.id)!]);
    const externalId = readLink(store.get(epic.id)!, 'linear')!.id;
    const { issue: withComment } = appendLocalComment(
      store.get(epic.id)!,
      'linear',
      'from the bead',
      new Date().toISOString(),
    );
    store.set(withComment.id, withComment);
    await adapter.createComment(externalId, 'from the tracker');
    const policy = PolicyDefinitionSchema.parse({
      ...POLICY,
      field_sync: { ...POLICY.field_sync, comments: mode },
    });

    const result = await run([withComment], policy);

    expect(result.commentsPushed).toBe(pushed);
    expect(result.commentsPulled).toBe(pulled);
    expect(
      readComments(store.get(epic.id)!, 'linear')
        .filter((entry) => entry.id !== undefined)
        .map((entry) => entry.body),
    ).toEqual(localBodies);
    expect(server.comments.map((entry) => entry.body).sort()).toEqual(
      (pushed === 1 ? ['from the bead', 'from the tracker'] : ['from the tracker']).sort(),
    );
  });

  it('defers a pending local comment during pull-only and posts it on the next full sync', async () => {
    const epic = bead('is-01hx5zzkbkactav9wevgemmvrz');
    store.set(epic.id, epic);
    await run([epic]);
    await run([store.get(epic.id)!]);
    const externalId = readLink(store.get(epic.id)!, 'linear')!.id;
    const { issue: withComment } = appendLocalComment(
      store.get(epic.id)!,
      'linear',
      'local waits for a full sync',
      new Date().toISOString(),
    );
    store.set(withComment.id, withComment);
    await adapter.createComment(externalId, 'remote arrives under pull-only');

    const pull = await runSync({
      provider: 'linear',
      adapter,
      policy: POLICY,
      dataSyncDir: dir,
      allIssues: [withComment],
      displayId: (id) => id.slice(-4),
      mirrorLabels: 'none',
      callbacks,
      direction: 'inbound',
      dryRun: false,
      now: () => new Date().toISOString(),
    });

    expect(pull.commentsPulled).toBe(1);
    expect(pull.commentsPushed).toBe(0);
    expect(server.comments.map((entry) => entry.body)).toEqual(['remote arrives under pull-only']);
    const afterPull = readComments(store.get(epic.id)!, 'linear');
    expect(
      afterPull.find((entry) => entry.body === 'local waits for a full sync')?.id,
    ).toBeUndefined();
    expect(afterPull.find((entry) => entry.body === 'remote arrives under pull-only')?.id).toEqual(
      expect.any(String),
    );

    const full = await run([store.get(epic.id)!]);
    expect(full.commentsPushed).toBe(1);
    expect(full.commentsPulled).toBe(0);
    expect(server.comments.map((entry) => entry.body).sort()).toEqual([
      'local waits for a full sync',
      'remote arrives under pull-only',
    ]);

    const quiet = await run([store.get(epic.id)!]);
    expect(quiet.commentsPushed).toBe(0);
    expect(quiet.commentsPulled).toBe(0);
  });

  it('previews actual comment work without mutating either side', async () => {
    const epic = bead('is-01hx5zzkbkactav9wevgemmvrz');
    store.set(epic.id, epic);
    await run([epic]);
    await run([store.get(epic.id)!]);
    const externalId = readLink(store.get(epic.id)!, 'linear')!.id;

    const { issue: withComment } = appendLocalComment(
      store.get(epic.id)!,
      'linear',
      'local comment waiting to push',
      new Date().toISOString(),
    );
    store.set(withComment.id, withComment);
    await adapter.createComment(externalId, 'remote comment waiting to pull');
    const remoteBefore = structuredClone(server.comments);
    const localBefore = readComments(store.get(epic.id)!, 'linear');

    const preview = await run([withComment], POLICY, true);
    expect(preview.commentsPushed).toBe(1);
    expect(preview.commentsPulled).toBe(1);
    expect(preview.nothingToDo).toBe(false);
    expect(server.comments).toEqual(remoteBefore);
    expect(readComments(store.get(epic.id)!, 'linear')).toEqual(localBefore);

    const applied = await run([withComment]);
    expect(applied.commentsPushed).toBe(1);
    expect(applied.commentsPulled).toBe(1);

    const quietPreview = await run([store.get(epic.id)!], POLICY, true);
    expect(quietPreview.commentsPushed).toBe(0);
    expect(quietPreview.commentsPulled).toBe(0);
    expect(quietPreview.nothingToDo).toBe(true);
  });

  it('records a replayed comment before planning so a crash cannot duplicate it', async () => {
    const epic = bead('is-01hx5zzkbkactav9wevgemmvrz');
    store.set(epic.id, epic);
    await run([epic]);
    await run([store.get(epic.id)!]);
    const externalId = readLink(store.get(epic.id)!, 'linear')!.id;
    const { issue: withComment } = appendLocalComment(
      store.get(epic.id)!,
      'linear',
      'landed immediately before the process died',
      new Date().toISOString(),
    );
    store.set(withComment.id, withComment);

    const createComment = adapter.createComment.bind(adapter);
    let simulateCrash = true;
    adapter.createComment = async (id, body, clientId) => {
      const result = await createComment(id, body, clientId);
      if (simulateCrash) {
        simulateCrash = false;
        throw new Error('simulated crash after provider comment write');
      }
      return result;
    };

    const interrupted = await run([withComment]);
    expect(interrupted.failures).toEqual([
      expect.objectContaining({ error: expect.stringContaining('simulated crash') }),
    ]);
    expect(server.comments.filter((comment) => comment.issueId === externalId)).toHaveLength(1);
    expect(await listIntentFiles(dir, 'linear')).toHaveLength(1);

    const recovered = await run([store.get(epic.id)!]);
    expect(recovered.failures).toEqual([]);
    expect(recovered.replayedOps).toBe(1);
    expect(recovered.commentsPushed).toBe(0);
    expect(server.comments.filter((comment) => comment.issueId === externalId)).toHaveLength(1);
    expect(readComments(store.get(epic.id)!, 'linear')).toEqual([
      expect.objectContaining({
        body: 'landed immediately before the process died',
        id: server.comments[0]?.id,
      }),
    ]);
    expect(await listIntentFiles(dir, 'linear')).toHaveLength(0);

    const quiet = await run([store.get(epic.id)!]);
    expect(quiet.commentsPushed).toBe(0);
    expect(server.comments.filter((comment) => comment.issueId === externalId)).toHaveLength(1);
  });

  it('discards a pending comment write after the bead is unlinked', async () => {
    server.addIssue({ id: 'unlinked-item', identifier: 'FIN-90', title: 'Former pair' });
    const linked = writeLink(
      bead('is-01hx5zzkbkactav9wevgemmvrz', { kind: 'task', title: 'Former pair' }),
      {
        provider: 'linear',
        id: 'unlinked-item',
        key: 'FIN-90',
        linked_at: '2026-08-10T00:00:00.000Z',
      },
    );
    const { issue: withComment, entry } = appendLocalComment(
      linked,
      'linear',
      'must be cancelled by unlink',
      new Date().toISOString(),
    );
    const unlinked = clearLink(withComment, 'linear');
    store.set(unlinked.id, unlinked);
    await writeIntentFile(dir, {
      type: 'in',
      run_id: '01hx5zzkbkactav9wevunlink1',
      provider: 'linear',
      created_at: '2026-08-10T00:00:00.000Z',
      ops: [
        {
          kind: 'post_comment',
          external_id: 'unlinked-item',
          bead_id: unlinked.id,
          local_id: entry.local_id!,
          comment_client_id: '41f2c3d4-0000-4000-8000-000000000001',
          body: entry.body,
        },
      ],
    });

    const recovered = await run([unlinked]);

    expect(recovered.failures).toEqual([]);
    expect(recovered.replayedOps).toBe(0);
    expect(server.comments).toEqual([]);
    expect(await listIntentFiles(dir, 'linear')).toEqual([]);

    const quiet = await run([store.get(unlinked.id)!]);
    expect(quiet.failures).toEqual([]);
    expect(server.comments).toEqual([]);
  });

  it('discards every stale provider write after its bead is unlinked', async () => {
    const beadId = 'is-01hx5zzkbkactav9wevgemmvrz';
    const formerExternalId = 'unlinked-item';
    server.addIssue({
      id: formerExternalId,
      identifier: 'FIN-92',
      title: 'Remote must stay unchanged',
      description: 'Remote body',
    });
    const unlinked = bead(beadId, { kind: 'task', title: 'Former local pair' });
    store.set(unlinked.id, unlinked);
    await writeIntentFile(dir, {
      type: 'in',
      run_id: '01hx5zzkbkactav9wevunlink2',
      provider: 'linear',
      created_at: '2026-08-10T00:00:00.000Z',
      ops: [
        {
          kind: 'create_issue',
          client_id: '41f2c3d4-0000-4000-8000-000000000009',
          bead_id: beadId,
          patch: { title: 'Must not be recreated' },
        },
        {
          kind: 'update_issue',
          bead_id: beadId,
          external_id: formerExternalId,
          patch: { title: 'must not land' },
        },
        {
          kind: 'upsert_attachments',
          bead_id: beadId,
          external_id: formerExternalId,
          attachments: [{ url: 'tbd://bead/stale', title: 'must not land' }],
        },
        {
          kind: 'splice_description',
          bead_id: beadId,
          external_id: formerExternalId,
          block: 'must not land',
        },
        {
          kind: 'post_comment',
          external_id: formerExternalId,
          bead_id: beadId,
          local_id: '01hx5zzkbkactav9wevgemstale',
          comment_client_id: '41f2c3d4-0000-4000-8000-000000000010',
          body: 'must not land',
        },
        {
          kind: 'post_conflict',
          bead_id: beadId,
          external_id: formerExternalId,
          comment_client_id: '41f2c3d4-0000-4000-8000-000000000011',
          report: {
            beadId: 'mvrz',
            field: 'title',
            keptValue: 'kept',
            discardedValue: 'discarded',
            atticPath: '.tbd/data-sync/attic/stale.yml',
          },
        },
      ],
    });

    const recovered = await run([unlinked]);

    expect(recovered.failures).toEqual([]);
    expect(recovered.replayedOps).toBe(0);
    expect(server.issues.has('41f2c3d4-0000-4000-8000-000000000009')).toBe(false);
    expect(server.issues.get(formerExternalId)).toMatchObject({
      title: 'Remote must stay unchanged',
      description: 'Remote body',
    });
    expect(server.attachments).toEqual([]);
    expect(server.comments).toEqual([]);
    expect(await listIntentFiles(dir, 'linear')).toEqual([]);
  });

  it('discards a stale comment journal after its local entry was already recorded', async () => {
    server.addIssue({ id: 'linked-item', identifier: 'FIN-91', title: 'Still paired' });
    const linked = writeLink(
      bead('is-01hx5zzkbkactav9wevgemmvrz', { kind: 'task', title: 'Still paired' }),
      {
        provider: 'linear',
        id: 'linked-item',
        key: 'FIN-91',
        linked_at: '2026-08-10T00:00:00.000Z',
      },
    );
    const { issue: withComment, entry } = appendLocalComment(
      linked,
      'linear',
      'already accounted for locally',
      new Date().toISOString(),
    );
    const recorded = recordPushedComment(
      withComment,
      'linear',
      entry.local_id!,
      'provider-comment-id',
    );
    store.set(recorded.id, recorded);
    await writeIntentFile(dir, {
      type: 'in',
      run_id: '01hx5zzkbkactav9wevalready',
      provider: 'linear',
      created_at: '2026-08-10T00:00:00.000Z',
      ops: [
        {
          kind: 'post_comment',
          external_id: 'linked-item',
          bead_id: recorded.id,
          local_id: entry.local_id!,
          comment_client_id: '41f2c3d4-0000-4000-8000-000000000002',
          body: entry.body,
        },
      ],
    });

    const recovered = await run([recorded]);

    expect(recovered.failures).toEqual([]);
    expect(recovered.replayedOps).toBe(0);
    expect(server.comments).toEqual([]);
    expect(await listIntentFiles(dir, 'linear')).toEqual([]);
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

  it('seeds an inbound bead with a safely mapped assignee alias', async () => {
    adapter = new LinearAdapter({
      client: new LinearClient({
        apiKey: 'lin_api_test',
        endpoint: server.endpoint,
        maxAttempts: 4,
        sleep: () => Promise.resolve(),
      }),
      teamKey: 'FIN',
      userMap: { josh: 'josh@example.com' },
    });
    server.addIssue({
      id: 'assigned-external',
      identifier: 'FIN-79',
      title: 'Assigned by a PM',
      assignee: server.users[0]!,
      updatedAt: new Date().toISOString(),
    });
    const autoPolicy = PolicyDefinitionSchema.parse({
      outbound: { kinds: [], statuses: [], specs: 'none', linked: true },
      inbound: { mode: 'auto', as_kind: 'task' },
      field_sync: { fields: { assignee: 'merge' } },
    });

    const imported = await run([], autoPolicy);

    expect(imported.failures).toEqual([]);
    const created = [...store.values()].find((issue) => issue.title === 'Assigned by a PM');
    expect(created?.assignee).toBe('josh');
    expect(JSON.stringify(created)).not.toContain('josh@example.com');
  });

  it('replays a failed inbound ownership claim without duplicating the bead', async () => {
    server.addIssue({
      id: 'claim-retry',
      identifier: 'FIN-78',
      title: 'Needs a durable claim',
      updatedAt: new Date().toISOString(),
    });
    const autoPolicy = PolicyDefinitionSchema.parse({
      outbound: { kinds: [], statuses: [], specs: 'none', linked: true },
      inbound: { mode: 'auto', as_kind: 'task' },
    });
    const original = adapter.upsertAttachments.bind(adapter);
    let attempts = 0;
    adapter.upsertAttachments = async (id, attachments) => {
      attempts += 1;
      if (attempts === 1) {
        throw new Error('claim transport died');
      }
      return original(id, attachments);
    };

    const interrupted = await run([], autoPolicy);
    expect(interrupted.importedInbound).toEqual([]);
    expect(interrupted.failures[0]?.error).toContain('claim transport died');
    expect(
      [...store.values()].filter((issue) => issue.title === 'Needs a durable claim'),
    ).toHaveLength(1);
    expect(server.attachments).toHaveLength(0);
    const pending = await listIntentFiles(dir, 'linear');
    expect(pending).toHaveLength(1);
    expect(pending[0]?.ops).toEqual([
      expect.objectContaining({ kind: 'upsert_attachments', external_id: 'claim-retry' }),
    ]);

    const linked = [...store.values()];
    const recovered = await run(linked, autoPolicy);
    expect(recovered.failures).toEqual([]);
    expect(recovered.replayedOps).toBe(1);
    expect(
      [...store.values()].filter((issue) => issue.title === 'Needs a durable claim'),
    ).toHaveLength(1);
    expect(server.attachments).toHaveLength(1);
    expect(await listIntentFiles(dir, 'linear')).toHaveLength(0);
  });

  it('imports an explicitly selected external item under --pull without external writes', async () => {
    server.addIssue({
      id: 'explicit-external',
      identifier: 'FIN-78',
      title: 'Explicitly selected',
      updatedAt: new Date().toISOString(),
    });
    const offPolicy = PolicyDefinitionSchema.parse({
      outbound: { kinds: [], statuses: [], specs: 'none', linked: true },
      inbound: { mode: 'off', as_kind: 'feature' },
    });

    const imported = await runSync({
      provider: 'linear',
      adapter,
      policy: offPolicy,
      dataSyncDir: dir,
      allIssues: [],
      displayId: (id) => id.slice(-4),
      mirrorLabels: 'none',
      callbacks,
      direction: 'inbound',
      externalIssueIds: ['explicit-external'],
      dryRun: false,
      now: () => new Date().toISOString(),
    });

    expect(imported.importedInbound).toHaveLength(1);
    expect([...store.values()].find((issue) => issue.title === 'Explicitly selected')?.kind).toBe(
      'feature',
    );
    expect(server.attachments).toHaveLength(0);
    expect(server.comments).toHaveLength(0);
    const pending = await listIntentFiles(dir, 'linear');
    expect(pending).toHaveLength(1);
    expect(pending[0]?.ops[0]).toMatchObject({
      kind: 'upsert_attachments',
      external_id: 'explicit-external',
    });

    const importedBead = [...store.values()].find(
      (issue) => issue.title === 'Explicitly selected',
    )!;
    const full = await runSync({
      provider: 'linear',
      adapter,
      policy: offPolicy,
      dataSyncDir: dir,
      allIssues: [importedBead],
      displayId: (id) => id.slice(-4),
      mirrorLabels: 'none',
      callbacks,
      dryRun: false,
      now: () => new Date().toISOString(),
    });
    expect(full.replayedOps).toBe(1);
    expect(server.attachments).toHaveLength(1);
    expect(await listIntentFiles(dir, 'linear')).toHaveLength(0);
  });

  it('imports an explicitly selected Linear parent before its child and preserves hierarchy', async () => {
    server.addIssue({
      id: 'external-parent',
      identifier: 'FIN-201',
      title: 'External parent',
      updatedAt: new Date().toISOString(),
    });
    server.addIssue({
      id: 'external-child',
      identifier: 'FIN-202',
      title: 'External child',
      parent: { id: 'external-parent', identifier: 'FIN-201' },
      updatedAt: new Date().toISOString(),
    });

    const result = await runSync({
      provider: 'linear',
      adapter,
      policy: POLICY,
      dataSyncDir: dir,
      allIssues: [],
      displayId: (id) => id.slice(-4),
      mirrorLabels: 'none',
      callbacks,
      direction: 'inbound',
      externalIssueIds: ['external-child', 'external-parent'],
      dryRun: false,
      now: () => new Date().toISOString(),
    });

    const importedParent = [...store.values()].find((issue) => issue.title === 'External parent');
    const importedChild = [...store.values()].find((issue) => issue.title === 'External child');
    expect(result.failures).toEqual([]);
    expect(result.importedInbound).toHaveLength(2);
    expect(importedChild?.parent_id).toBe(importedParent?.id);
  });

  it('refuses to flatten an inbound sub-issue whose Linear parent is unavailable', async () => {
    server.addIssue({
      id: 'external-child-only',
      identifier: 'FIN-204',
      title: 'External child without its parent',
      parent: { id: 'external-missing-parent', identifier: 'FIN-203' },
      updatedAt: new Date().toISOString(),
    });

    const result = await runSync({
      provider: 'linear',
      adapter,
      policy: POLICY,
      dataSyncDir: dir,
      allIssues: [],
      displayId: (id) => id.slice(-4),
      mirrorLabels: 'none',
      callbacks,
      direction: 'inbound',
      externalIssueIds: ['external-child-only'],
      dryRun: false,
      now: () => new Date().toISOString(),
    });

    expect(result.importedInbound).toEqual([]);
    expect(result.failures).toEqual([
      expect.objectContaining({
        beadId: 'FIN-204',
        error: expect.stringContaining('parent FIN-203'),
      }),
    ]);
    expect(store.size).toBe(0);
  });

  it('refuses to import an item already claimed by another tbd repository', async () => {
    server.addIssue({
      id: 'claimed-external',
      identifier: 'FIN-79',
      title: 'Already claimed',
      updatedAt: new Date().toISOString(),
    });
    server.attachments.push({
      id: 'claim',
      issueId: 'claimed-external',
      url: 'tbd://bead/other-1234',
      title: 'other-1234',
    });

    const result = await runSync({
      provider: 'linear',
      adapter,
      policy: POLICY,
      dataSyncDir: dir,
      allIssues: [],
      displayId: (id) => id.slice(-4),
      mirrorLabels: 'none',
      callbacks,
      direction: 'inbound',
      externalIssueIds: ['claimed-external'],
      dryRun: false,
      now: () => new Date().toISOString(),
    });

    expect(result.importedInbound).toEqual([]);
    expect(result.failures[0]?.error).toContain('already linked by another tbd repository');
    expect(store.size).toBe(0);
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
    expect(item.description ?? '').toContain(MANAGED_BLOCK_MARKERS.begin);
    expect(await listIntentFiles(dir, 'linear')).toHaveLength(0); // consumed
  });

  it('persists a provisional create link before provider I/O so replay has a live claim', async () => {
    const epic = bead('is-01hx5zzkbkactav9wevgemmvrz');
    store.set(epic.id, epic);
    callbacks.afterJournal = () => Promise.reject(new Error('simulated crash after journal'));

    await expect(run([epic])).rejects.toThrow('simulated crash after journal');

    const pendingLink = readLink(store.get(epic.id)!, 'linear');
    expect(pendingLink?.id).toBeDefined();
    expect(server.issues.size).toBe(0);
    expect(await listIntentFiles(dir, 'linear')).toHaveLength(1);

    const withComment = appendLocalComment(
      store.get(epic.id)!,
      'linear',
      'Authored after the provisional link commit',
      '2026-08-10T01:00:00.000Z',
    ).issue;
    store.set(epic.id, withComment);

    callbacks.afterJournal = () => Promise.resolve();
    const recovered = await run([store.get(epic.id)!]);

    expect(recovered.failures).toEqual([]);
    expect(recovered.replayedOps).toBe(3);
    expect(server.issues.size).toBe(1);
    // Identity only. The human identifier and URL live on the bridge record;
    // what the replayed claim has to preserve is the id it claimed under.
    expect(readLink(store.get(epic.id)!, 'linear')).toMatchObject({
      id: pendingLink!.id,
    });
    expect(store.get(epic.id)!.extensions?.linear).not.toHaveProperty('key');
    expect(readComments(store.get(epic.id)!, 'linear')).toEqual([
      expect.objectContaining({
        body: 'Authored after the provisional link commit',
        id: expect.any(String),
      }),
    ]);
    expect(server.comments).toEqual([
      expect.objectContaining({ body: 'Authored after the provisional link commit' }),
    ]);
    expect(await listIntentFiles(dir, 'linear')).toEqual([]);
  });

  it('keeps an uncreated provisional link pending instead of reporting it orphaned', async () => {
    const epic = bead('is-01hx5zzkbkactav9wevgemmvrz');
    store.set(epic.id, epic);
    callbacks.afterJournal = () => Promise.reject(new Error('simulated crash after journal'));

    await expect(run([epic])).rejects.toThrow('simulated crash after journal');
    const pending = store.get(epic.id)!;
    expect(readLink(pending, 'linear')?.id).toBeDefined();
    expect(await listIntentFiles(dir, 'linear')).toHaveLength(1);

    callbacks.afterJournal = () => Promise.resolve();
    adapter.createIssue = () => Promise.reject(new Error('provider unavailable'));
    const failedReplay = await run([pending]);

    expect(failedReplay.failures.length).toBeGreaterThan(0);
    expect(failedReplay.orphaned).toEqual([]);
    expect(await listIntentFiles(dir, 'linear')).toHaveLength(1);

    const inboundOnly = await runSync({
      provider: 'linear',
      adapter,
      policy: POLICY,
      dataSyncDir: dir,
      allIssues: [store.get(epic.id)!],
      displayId: (id) => id.slice(-4),
      mirrorLabels: 'none',
      callbacks,
      direction: 'inbound',
      dryRun: false,
      now: () => new Date().toISOString(),
    });

    expect(inboundOnly.failures).toEqual([]);
    expect(inboundOnly.orphaned).toEqual([]);
    expect(await listIntentFiles(dir, 'linear')).toHaveLength(1);
  });

  it('reconciles a live item even while its create journal retains follow-up work', async () => {
    const epic = bead('is-01hx5zzkbkactav9wevgemmvrz');
    store.set(epic.id, epic);
    await run([epic]);
    await run([store.get(epic.id)!]);
    const linked = store.get(epic.id)!;
    const externalId = readLink(linked, 'linear')!.id;

    // A create journal remains whole when a later attachment or splice fails.
    // The create itself can therefore name an already-live provider item.
    await writeIntentFile(dir, {
      type: 'in',
      run_id: '01hx5zzkbkactav9wevfollow1',
      provider: 'linear',
      created_at: '2026-08-10T00:00:00.000Z',
      ops: [
        {
          kind: 'create_issue',
          client_id: externalId,
          bead_id: epic.id,
          patch: { title: epic.title },
        },
        {
          kind: 'upsert_attachments',
          bead_id: epic.id,
          external_id: externalId,
          attachments: [{ url: 'tbd://bead/pending-follow-up', title: 'pending follow-up' }],
        },
      ],
    });
    const remote = server.issues.get(externalId)!;
    remote.title = 'Remote edit behind retained create journal';
    remote.updatedAt = '2026-08-10T15:00:00.000Z';
    // Force the pair through targeted liveness rather than the broad delta.
    adapter.fetchUpdatedSince = () => Promise.resolve([]);

    const inboundOnly = await runSync({
      provider: 'linear',
      adapter,
      policy: POLICY,
      dataSyncDir: dir,
      allIssues: [linked],
      displayId: (id) => id.slice(-4),
      mirrorLabels: 'none',
      callbacks,
      direction: 'inbound',
      dryRun: false,
      now: () => new Date().toISOString(),
    });

    expect(inboundOnly.failures).toEqual([]);
    expect(inboundOnly.pulled).toEqual(['mvrz']);
    expect(store.get(epic.id)?.title).toBe('Remote edit behind retained create journal');
    // Pull-only reconciled local state but still performed no provider writes.
    expect(server.attachments.some((item) => item.url === 'tbd://bead/pending-follow-up')).toBe(
      false,
    );
    expect(await listIntentFiles(dir, 'linear')).toHaveLength(1);
  });

  it('pulls a live pending create before its first bridge record exists', async () => {
    const epic = bead('is-01hx5zzkbkactav9wevgemmvrz');
    store.set(epic.id, epic);

    // The provider create lands and the provisional link is durable, but the
    // first follow-up fails before the engine can write its three-way base.
    const upsertAttachments = adapter.upsertAttachments.bind(adapter);
    adapter.upsertAttachments = () => Promise.reject(new Error('attachment unavailable'));
    const interrupted = await run([epic]);
    expect(interrupted.failures).toEqual([
      expect.objectContaining({ beadId: 'mvrz', error: 'attachment unavailable' }),
    ]);
    const pending = store.get(epic.id)!;
    const externalId = readLink(pending, 'linear')!.id;
    expect(server.issues.has(externalId)).toBe(true);
    expect(await listIntentFiles(dir, 'linear')).toHaveLength(1);

    adapter.upsertAttachments = upsertAttachments;
    const remote = server.issues.get(externalId)!;
    remote.title = 'Remote edit before the first bridge base';
    remote.description = 'Remote prose before the first bridge base';
    remote.state = server.states.find((state) => state.type === 'started')!;
    remote.priority = 1;
    remote.updatedAt = '2026-08-10T15:00:00.000Z';
    // Force the pair through targeted liveness rather than the broad delta.
    adapter.fetchUpdatedSince = () => Promise.resolve([]);

    const inboundOnly = await runSync({
      provider: 'linear',
      adapter,
      policy: POLICY,
      dataSyncDir: dir,
      allIssues: [pending],
      displayId: (id) => id.slice(-4),
      mirrorLabels: 'none',
      callbacks,
      direction: 'inbound',
      dryRun: false,
      now: () => new Date().toISOString(),
    });

    expect(inboundOnly.failures).toEqual([]);
    expect(inboundOnly.pulled).toEqual(['mvrz']);
    expect(store.get(epic.id)?.title).toBe('Remote edit before the first bridge base');
    expect(store.get(epic.id)?.description).toBe('Remote prose before the first bridge base');
    expect(store.get(epic.id)?.status).toBe('in_progress');
    expect(store.get(epic.id)?.priority).toBe(0);
    // Pull-only neither replays the follow-up nor consumes its journal.
    expect(server.attachments).toEqual([]);
    expect(await listIntentFiles(dir, 'linear')).toHaveLength(1);

    const completed = await run([store.get(epic.id)!]);
    expect(completed.failures).toEqual([]);
    expect(store.get(epic.id)?.title).toBe('Remote edit before the first bridge base');
    expect(server.attachments.length).toBeGreaterThan(0);
    expect(await listIntentFiles(dir, 'linear')).toEqual([]);
  });

  it("a stale replay failure does not block this run's journal cleanup", async () => {
    // Bugbot follow-up: report.failures also carries replay failures from
    // OLDER intent files; those must not pin the current run's journal.
    const staleBead = writeLink(
      bead('is-01hx5zzkbkactav9wevgemmvry', { kind: 'task', title: 'Stale pair' }),
      {
        provider: 'linear',
        id: 'missing-forever',
        linked_at: '2026-08-10T00:00:00.000Z',
      },
    );
    store.set(staleBead.id, staleBead);
    await writeIntentFile(dir, {
      type: 'in',
      run_id: '01hx5zzkbkactav9wevgemstale',
      provider: 'linear',
      created_at: '2026-08-10T00:00:00.000Z',
      ops: [
        {
          kind: 'update_issue',
          bead_id: staleBead.id,
          external_id: 'missing-forever',
          patch: { title: 'x' },
        },
      ],
    });

    const epic = bead('is-01hx5zzkbkactav9wevgemmvrz');
    store.set(epic.id, epic);
    const result = await run([staleBead, epic]); // clean outbound create + a failing replay

    expect(result.failures).toHaveLength(1); // the stale replay, reported
    expect(result.createdOutbound).toEqual(['mvrz']); // this run's work landed
    const remaining = await listIntentFiles(dir, 'linear');
    // Only the stale file survives; this run's journal was consumed.
    expect(remaining.map((f) => f.run_id)).toEqual(['01hx5zzkbkactav9wevgemstale']);
  });

  it('leaves outbound intents pending and the provider untouched during an inbound-only run', async () => {
    const linked = writeLink(
      bead('is-01hx5zzkbkactav9wevgemmvrz', { kind: 'task', title: 'Pending outbound' }),
      {
        provider: 'linear',
        id: 'pending-outbound',
        linked_at: '2026-08-10T00:00:00.000Z',
      },
    );
    store.set(linked.id, linked);
    server.addIssue({
      id: 'pending-outbound',
      identifier: 'FIN-80',
      title: 'Remote before',
      updatedAt: '2026-08-10T00:00:00.000Z',
    });
    await writeIntentFile(dir, {
      type: 'in',
      run_id: '01hx5zzkbkactav9wevgempull1',
      provider: 'linear',
      created_at: '2026-08-10T00:00:00.000Z',
      ops: [
        {
          kind: 'update_issue',
          bead_id: linked.id,
          external_id: 'pending-outbound',
          patch: { title: 'Must wait' },
        },
      ],
    });
    const offPolicy = PolicyDefinitionSchema.parse({
      outbound: { kinds: [], statuses: [], specs: 'none', linked: true },
      inbound: { mode: 'off' },
    });

    const result = await runSync({
      provider: 'linear',
      adapter,
      policy: offPolicy,
      dataSyncDir: dir,
      allIssues: [linked],
      displayId: (id) => id.slice(-4),
      mirrorLabels: 'none',
      callbacks,
      direction: 'inbound',
      dryRun: false,
      now: () => new Date().toISOString(),
    });

    expect(result.replayedOps).toBe(0);
    expect(server.issues.get('pending-outbound')?.title).toBe('Remote before');
    expect(await listIntentFiles(dir, 'linear')).toHaveLength(1);
  });

  it('does not journal a newly suppressed outbound edit during an inbound-only run', async () => {
    const epic = bead('is-01hx5zzkbkactav9wevgemmvrz');
    store.set(epic.id, epic);
    await run([epic]);
    await run([store.get(epic.id)!]);
    const linked = store.get(epic.id)!;
    const externalId = readLink(linked, 'linear')!.id;
    const localEdit = {
      ...linked,
      title: 'Local edit must wait',
      version: linked.version + 1,
      updated_at: new Date(Date.now() + 60_000).toISOString(),
    };
    store.set(epic.id, localEdit);
    callbacks.afterJournal = () => Promise.reject(new Error('pull planned an outbound journal'));

    const pulled = await runSync({
      provider: 'linear',
      adapter,
      policy: POLICY,
      dataSyncDir: dir,
      allIssues: [localEdit],
      displayId: (id) => id.slice(-4),
      mirrorLabels: 'none',
      callbacks,
      direction: 'inbound',
      dryRun: false,
      now: () => new Date().toISOString(),
    });

    expect(pulled.failures).toEqual([]);
    expect(server.issues.get(externalId)?.title).toBe('An epic');
    expect(await listIntentFiles(dir, 'linear')).toEqual([]);

    callbacks.afterJournal = () => Promise.resolve();
    const full = await run([store.get(epic.id)!]);
    expect(full.pushed).toEqual(['mvrz']);
    expect(server.issues.get(externalId)?.title).toBe('Local edit must wait');
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
