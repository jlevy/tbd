/**
 * Where the refinement record lives, and why — settled by measurement.
 *
 * A refinement is the exact tracker state id for a column tbd has no name of its own
 * for (a team's "In QA"). It has to survive two clones syncing concurrently, or a sync
 * will drag issues out of columns people deliberately put them in.
 *
 * Two candidates were on the table, both on the sync branch, and the spec said to
 * settle it by testing concurrent behavior rather than arguing from the merge tables.
 * These are those tests, kept because they are the evidence:
 *
 * A refinement is the exact tracker state id for a column tbd has no name for (a team's
 * own "In QA"). It must survive two clones syncing concurrently, or a sync will drag
 * issues out of columns people put them in.
 *
 *   - `extensions.<provider>` on the bead merges per namespace, last writer wins. The
 *     refinement survives, but a clone that concurrently refreshed `external_key` on the
 *     same namespace loses it. Measured below.
 *   - The pair's link record resolves conflicts by newest observation, as a whole
 *     record, so the refinement and the link it describes can never disagree.
 *
 * The link record won. It is also what the schema already says: the bead records
 * identity, the link record records dynamics, and a column id the tracker can
 * invalidate wholesale is dynamics.
 */

import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { git, resolveBridgeConflicts, mergeIssues } from '../src/file/git.js';
import { DATA_SYNC_DIR } from '../src/lib/paths.js';
import { stringifyYaml, parseYamlWithConflictDetection } from '../src/utils/yaml-utils.js';
import type { Issue } from '../src/lib/types.js';

let repo: string;

beforeEach(async () => {
  repo = await mkdtemp(join(tmpdir(), 'tbd-refine-exp-'));
  await git('-C', repo, 'init', '-q', '--initial-branch=main', '.');
  await git('-C', repo, 'config', 'user.email', 'test@example.com');
  await git('-C', repo, 'config', 'user.name', 'Test');
});
afterEach(async () => {
  await rm(repo, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

const LINK = join(DATA_SYNC_DIR, 'bridge', 'linear', 'links', 'is-01hx5zzkbkactav9wevgemmvrz.yml');

async function commitAll(message: string): Promise<void> {
  await git('-C', repo, 'add', '-A');
  await git('-C', repo, 'commit', '-q', '-m', message);
}

async function writeLink(refinement: string, syncedAt: string): Promise<void> {
  await mkdir(join(repo, DATA_SYNC_DIR, 'bridge', 'linear', 'links'), { recursive: true });
  await writeFile(
    join(repo, LINK),
    stringifyYaml({
      type: 'lk',
      bead_id: 'is-01hx5zzkbkactav9wevgemmvrz',
      external_id: 'uuid-1',
      state: 'linked',
      remote_updated_at: '2026-08-20T00:00:00.000Z',
      synced_at: syncedAt,
      refinement_state_id: refinement,
      base: {
        title: 'T',
        status: 'in_progress',
        priority: 2,
        labels: [],
        description_hash: 'sha256v7:abc',
      },
    }),
  );
}

describe('the refinement survives a real concurrent merge in the link record', () => {
  it('reports what survives when two clones record different refinements', async () => {
    await writeLink('state-in-qa', '2026-08-20T01:00:00.000Z');
    await commitAll('base');
    await git('-C', repo, 'branch', 'other');

    // Clone A observes the issue in the team's In QA column, later.
    await writeLink('state-in-qa', '2026-08-20T03:00:00.000Z');
    await commitAll('clone A');

    // Clone B, concurrently, observed it in a different custom column earlier.
    await git('-C', repo, 'checkout', '-q', 'other');
    await writeLink('state-staging', '2026-08-20T02:00:00.000Z');
    await commitAll('clone B');

    await git('-C', repo, 'checkout', '-q', 'main');
    let conflicted = false;
    try {
      await git('-C', repo, 'merge', 'other', '-m', 'merge');
    } catch {
      conflicted = true;
      await resolveBridgeConflicts(repo);
    }

    const merged = parseYamlWithConflictDetection(
      await readFile(join(repo, LINK), 'utf-8'),
      'link',
    ) as Record<string, unknown>;
    console.log(
      `LINK RECORD → conflicted=${conflicted} survivor=${String(merged.refinement_state_id)}`,
    );
    // The newest observation wins, deterministically, and the record stays whole.
    expect(merged.refinement_state_id).toBe('state-in-qa');
  });
});

describe('why not extensions: the namespace merge drops a concurrent sibling write', () => {
  it('loses external_key when another clone recorded a refinement', () => {
    const bead = (ext: Record<string, unknown>, updatedAt: string): Issue =>
      ({
        type: 'is',
        id: 'is-01hx5zzkbkactav9wevgemmvrz',
        version: 1,
        title: 'T',
        kind: 'task',
        status: 'in_progress',
        priority: 2,
        labels: [],
        dependencies: [],
        created_at: '2026-08-20T00:00:00.000Z',
        updated_at: updatedAt,
        extensions: { linear: ext },
      }) as unknown as Issue;

    const base = bead(
      { id: 'uuid-1', provider: 'linear', linked_at: '2026-08-20T00:00:00.000Z' },
      '2026-08-20T00:00:00.000Z',
    );
    // Clone A records the refinement.
    const local = bead(
      {
        id: 'uuid-1',
        provider: 'linear',
        linked_at: '2026-08-20T00:00:00.000Z',
        refinement_state_id: 'state-in-qa',
      },
      '2026-08-20T03:00:00.000Z',
    );
    // Clone B refreshes the human-facing key on the same namespace, concurrently.
    const remote = bead(
      {
        id: 'uuid-1',
        provider: 'linear',
        linked_at: '2026-08-20T00:00:00.000Z',
        key: 'OS-123',
      },
      '2026-08-20T02:00:00.000Z',
    );

    const result = mergeIssues(base, local, remote);
    const ext = (result.merged.extensions as Record<string, Record<string, unknown>>).linear!;
    console.log(
      `EXTENSIONS → refinement=${String(ext.refinement_state_id)} key=${String(ext.key)}`,
    );
    // The refinement survived, and the concurrent `external_key` did not. That is the
    // measured cost of putting it on the bead, and the reason it lives elsewhere.
    expect(ext.refinement_state_id).toBe('state-in-qa');
    expect(ext.key).toBeUndefined();
  });
});
