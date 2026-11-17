/**
 * What a discarded merge value looks like once it is archived.
 *
 * The attic is the only place a value a merge dropped can be recovered from without
 * reading git history, so an entry has to say two true things: what was lost, verbatim
 * enough to put back, and which side supplied the value that was kept.
 *
 * The second one used to be a guess. Both callers computed it once per bead from
 * `updated_at`, which is right for an ordinary field and wrong for the two cases where
 * the merge decides on something else: a namespace deleted on one side survives from the
 * other whatever the timestamps say, and a provider relink resolves on link lineage. An
 * entry that names the wrong winner points whoever is recovering data at the value they
 * already have. So the side now travels on the conflict, set by the branch that made the
 * decision.
 */

import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { saveConflictToAttic } from '../src/file/attic-entry.js';
import { mergeIssues } from '../src/file/git.js';
import { AtticEntrySchema } from '../src/lib/schemas.js';
import type { AtticEntry, Issue } from '../src/lib/types.js';

let atticDir: string;

beforeEach(async () => {
  atticDir = await mkdtemp(join(tmpdir(), 'tbd-attic-archive-'));
});

afterEach(async () => {
  await rm(atticDir, { recursive: true, force: true });
});

function issue(overrides: Partial<Issue> = {}): Issue {
  return {
    type: 'is',
    id: 'is-01k9zzzzzzzzzzzzzzzzzzzzzz',
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

/** Merge, archive every conflict it produced, and read the entries back off disk. */
async function archive(base: Issue, local: Issue, remote: Issue): Promise<AtticEntry[]> {
  const { conflicts } = mergeIssues(base, local, remote);
  for (const conflict of conflicts) {
    await saveConflictToAttic(atticDir, conflict);
  }
  const files = (await readdir(atticDir)).sort();
  return Promise.all(
    files.map(async (file) =>
      AtticEntrySchema.parse(
        // The entry is YAML, but every value in it is a scalar, so reading it back
        // through the schema is what proves the file is loadable at all.
        (await import('yaml')).parse(await readFile(join(atticDir, file), 'utf8')),
      ),
    ),
  );
}

const PENDING_COMMENT = {
  local_id: '01aaaaaaaaaaaaaaaaaaaaaaaa',
  at: '2026-08-10T00:00:00.000Z',
  body: 'never posted to the old link',
};

describe('a relinked provider namespace', () => {
  it('archives the abandoned link with its undelivered comment', async () => {
    // The bead was relinked locally. The remote still holds the old link, and a comment
    // that was authored against it and never pushed. Different lineage, so the two
    // cannot be unioned, and the old link loses.
    const base = issue({ extensions: { linear: { id: 'link-old', comments: [] } } });
    const local = issue({
      version: 2,
      updated_at: '2026-08-10T02:00:00.000Z',
      extensions: { linear: { id: 'link-new', comments: [] } },
    });
    const remote = issue({
      version: 2,
      updated_at: '2026-08-10T01:00:00.000Z',
      extensions: { linear: { id: 'link-old', comments: [PENDING_COMMENT] } },
    });

    const entries = await archive(base, local, remote);

    const relink = entries.find((entry) => entry.field === 'extensions.linear');
    expect(relink).toBeDefined();
    expect(relink!.winner_source).toBe('local');
    expect(relink!.loser_source).toBe('remote');

    // The comment is recoverable: it survives into the entry, body and identity intact.
    const lost = JSON.parse(relink!.lost_value) as {
      id: string;
      comments?: { local_id: string; body: string }[];
    };
    expect(lost.id).toBe('link-old');
    expect(lost.comments).toEqual([PENDING_COMMENT]);
  });
});

describe('winner_source, in the cases a per-bead guess gets wrong', () => {
  it('names the surviving side when the newer side deleted the namespace', async () => {
    // Local is newer AND unlinked; remote edited the link. The edit wins — re-unlinking
    // is cheap, hunting down an orphaned tracker issue is not — so the winner is remote
    // even though local holds the later timestamp.
    const base = issue({ extensions: { linear: { id: 'link-1' } } });
    const local = issue({ version: 2, updated_at: '2026-08-10T02:00:00.000Z', extensions: {} });
    const remote = issue({
      version: 2,
      updated_at: '2026-08-10T01:00:00.000Z',
      extensions: { linear: { id: 'link-1', key: 'OS-9' } },
    });

    const entries = await archive(base, local, remote);

    expect(entries).toHaveLength(1);
    expect(entries[0]!.field).toBe('extensions.linear');
    expect(entries[0]!.winner_source).toBe('remote');
    expect(entries[0]!.loser_source).toBe('local');
  });

  it('names local when an ordinary field resolves in local’s favor', async () => {
    const base = issue({ title: 'Original' });
    const local = issue({ version: 2, updated_at: '2026-08-10T02:00:00.000Z', title: 'From A' });
    const remote = issue({ version: 2, updated_at: '2026-08-10T01:00:00.000Z', title: 'From B' });

    const entries = await archive(base, local, remote);

    const title = entries.find((entry) => entry.field === 'title');
    expect(title).toBeDefined();
    expect(title!.winner_source).toBe('local');
    expect(JSON.parse(title!.lost_value)).toBe('From B');
  });

  it('names remote when the same field resolves the other way', async () => {
    const base = issue({ title: 'Original' });
    const local = issue({ version: 2, updated_at: '2026-08-10T01:00:00.000Z', title: 'From A' });
    const remote = issue({ version: 2, updated_at: '2026-08-10T02:00:00.000Z', title: 'From B' });

    const entries = await archive(base, local, remote);

    const title = entries.find((entry) => entry.field === 'title');
    expect(title).toBeDefined();
    expect(title!.winner_source).toBe('remote');
    expect(JSON.parse(title!.lost_value)).toBe('From A');
  });
});
