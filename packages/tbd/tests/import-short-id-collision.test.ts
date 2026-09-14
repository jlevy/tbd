/**
 * A Beads import must never overwrite an issue it did not create.
 *
 * Imported beads keep their original short ID where they can: `src-100` wants to stay
 * `100`, because that is the id people and links already use. But a repository that has
 * been in use has its own issues holding short IDs, handed out randomly, and a Beads
 * file from somewhere else can want one of them.
 *
 * The import resolves an incoming short ID against the existing issues before it checks
 * whether that short ID is already taken, and the map it resolves against is built from
 * every existing issue with no regard for where it came from. So an unrelated native
 * issue that happens to own the wanted short ID hands the incoming bead its internal
 * ID, and the bead's content is then written over that issue's file. Both records are
 * lost: the native issue's content, and the bead as a distinct issue.
 *
 * Source identity is the thing that decides this. `extensions.beads.original_id` is
 * written on every import, so a bead that really was imported before is matched by its
 * own id; anything matched only by short ID is, by construction, something else.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const BIN = fileURLToPath(new URL('../dist/bin.mjs', import.meta.url));
let repo: string;

function tbd(args: string[]): string {
  return execFileSync(process.execPath, [BIN, ...args], {
    cwd: repo,
    encoding: 'utf-8',
    env: { ...process.env },
  }).trim();
}

const show = (id: string) => JSON.parse(tbd(['show', id, '--json'])) as Record<string, unknown>;

beforeAll(async () => {
  repo = await mkdtemp(join(tmpdir(), 'tbd-import-collision-'));
  execFileSync('git', ['init', '-q', '.'], { cwd: repo });
  execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: repo });
  execFileSync('git', ['config', 'user.name', 'Test'], { cwd: repo });
  execFileSync('git', ['config', 'commit.gpgsign', 'false'], { cwd: repo });
  execFileSync('git', ['commit', '-q', '--allow-empty', '-m', 'init'], { cwd: repo });
  tbd(['init', '--prefix=coll']);
}, 120_000);

afterAll(async () => {
  await rm(repo, { recursive: true, force: true });
});

describe('Beads import onto an occupied short ID', () => {
  it('preserves the native issue and imports the bead as a separate issue', async () => {
    const native = JSON.parse(tbd(['create', 'Native issue that must survive', '--json'])) as {
      id: string;
    };
    // `coll-abcd` -> `abcd`: the short ID the incoming bead will collide with.
    const shortId = native.id.split('-').slice(1).join('-');
    expect(shortId).toBeTruthy();

    const beadsFile = join(repo, 'incoming.jsonl');
    await writeFile(
      beadsFile,
      JSON.stringify({
        id: `src-${shortId}`,
        title: 'Imported bead from another repository',
        status: 'open',
        issue_type: 'task',
        priority: 2,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      }) + '\n',
    );

    tbd(['import', beadsFile]);

    // The native issue is untouched: same id, same title, and not a Beads import.
    const survivor = show(native.id);
    expect(survivor.title).toBe('Native issue that must survive');
    expect(survivor.extensions ?? {}).not.toHaveProperty('beads');

    // The bead landed as its own issue, under a DIFFERENT short ID.
    //
    // Compare short-ID suffixes, not whole ids: the import detects the incoming prefix
    // and rewrites `display.id_prefix` from `coll` to `src` (import.ts
    // updateConfigPrefixIfNeeded), so every id now renders as `src-…` and comparing
    // whole ids would pass no matter what the import did.
    const all = JSON.parse(tbd(['list', '--all', '--json'])) as Record<string, unknown>[];
    const suffix = (id: string) => id.split('-').slice(1).join('-');

    expect(all).toHaveLength(2);
    const imported = all.filter((i) => i.title === 'Imported bead from another repository');
    expect(imported).toHaveLength(1);
    expect(suffix(imported[0]!.id as string)).not.toBe(shortId);

    // The native issue kept the short ID it already owned.
    const survivors = all.filter((i) => i.title === 'Native issue that must survive');
    expect(survivors).toHaveLength(1);
    expect(suffix(survivors[0]!.id as string)).toBe(shortId);

    // And the imported bead records where it came from.
    const importedShown = show(imported[0]!.id as string);
    expect((importedShown.extensions as { beads: { original_id: string } }).beads.original_id).toBe(
      `src-${shortId}`,
    );
  });
});
