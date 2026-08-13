/**
 * Bridge records across a real git merge: the newest observation wins, and
 * absence (an unlink, a consumed intent) is never resurrected.
 *
 * These run against actual `git merge` conflicts, not simulated ones, because
 * the property being pinned is "two machines can sync concurrently and their
 * bridge state converges" — which lives or dies on how conflicted paths leave
 * the merge.
 */

import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { git, pickNewestLinkRecord, resolveBridgeConflicts } from '../src/file/git.js';
import { DATA_SYNC_DIR } from '../src/lib/paths.js';
import { stringifyYaml } from '../src/utils/yaml-utils.js';
import type { LinkRecord } from '../src/lib/types.js';

const BEAD_ID = 'is-01hx5zzkbkactav9wevgemmvrz';
const REL_PATH = `${DATA_SYNC_DIR}/bridge/linear/links/${BEAD_ID}.yml`;

function record(remoteUpdatedAt: string, syncedAt: string, title = 'T'): LinkRecord {
  return {
    type: 'lk',
    bead_id: BEAD_ID,
    external_id: 'uuid-1',
    base: {
      title,
      status: 'open',
      priority: 2,
      labels: [],
      description_hash: 'sha256:x',
    },
    remote_updated_at: remoteUpdatedAt,
    synced_at: syncedAt,
    state: 'linked',
  };
}

describe('pickNewestLinkRecord', () => {
  const older = record('2026-08-10T20:00:00.000Z', '2026-08-10T20:00:01.000Z', 'older');
  const newer = record('2026-08-10T23:00:00.000Z', '2026-08-10T23:00:01.000Z', 'newer');

  it('prefers the higher remote_updated_at in either position', () => {
    expect(pickNewestLinkRecord(older, newer).base.title).toBe('newer');
    expect(pickNewestLinkRecord(newer, older).base.title).toBe('newer');
  });

  it('falls back to synced_at, then ours', () => {
    const a = record('2026-08-10T20:00:00.000Z', '2026-08-10T20:00:05.000Z', 'a');
    const b = record('2026-08-10T20:00:00.000Z', '2026-08-10T20:00:01.000Z', 'b');
    expect(pickNewestLinkRecord(a, b).base.title).toBe('a');
    expect(pickNewestLinkRecord(b, a).base.title).toBe('a');

    const tie = record('2026-08-10T20:00:00.000Z', '2026-08-10T20:00:01.000Z', 'ours');
    const tieOther = record('2026-08-10T20:00:00.000Z', '2026-08-10T20:00:01.000Z', 'theirs');
    expect(pickNewestLinkRecord(tie, tieOther).base.title).toBe('ours');
  });
});

describe('resolveBridgeConflicts across a real merge', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'tbd-bridge-merge-'));
    await git('-C', dir, 'init', '-q', '--initial-branch=main');
    await git('-C', dir, 'config', 'user.email', 't@e.com');
    await git('-C', dir, 'config', 'user.name', 'T');
    await git('-C', dir, 'config', 'commit.gpgsign', 'false');
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  async function commitRecord(rec: LinkRecord, message: string): Promise<void> {
    await mkdir(join(dir, `${DATA_SYNC_DIR}/bridge/linear/links`), { recursive: true });
    await writeFile(join(dir, REL_PATH), stringifyYaml(rec));
    await git('-C', dir, 'add', '-A');
    await git('-C', dir, 'commit', '-q', '-m', message);
  }

  async function divergeAndMerge(
    oursMutation: () => Promise<void>,
    theirsMutation: () => Promise<void>,
  ): Promise<void> {
    await git('-C', dir, 'checkout', '-q', '-b', 'theirs');
    await theirsMutation();
    await git('-C', dir, 'checkout', '-q', 'main');
    await oursMutation();
    // The merge must conflict for the resolver to have anything to do.
    await expect(git('-C', dir, 'merge', 'theirs')).rejects.toThrow();
  }

  it('keeps the newest observation when both sides updated the record', async () => {
    await commitRecord(record('2026-08-10T10:00:00.000Z', '2026-08-10T10:00:01.000Z'), 'base');
    await divergeAndMerge(
      async () =>
        commitRecord(
          record('2026-08-10T12:00:00.000Z', '2026-08-10T12:00:01.000Z', 'ours'),
          'ours',
        ),
      async () =>
        commitRecord(
          record('2026-08-10T15:00:00.000Z', '2026-08-10T15:00:01.000Z', 'theirs'),
          'theirs',
        ),
    );

    const result = await resolveBridgeConflicts(dir);
    expect(result.resolved).toBe(1);
    expect(result.deleted).toBe(0);

    const content = await readFile(join(dir, REL_PATH), 'utf8');
    expect(content).not.toContain('<<<<<<<');
    expect(content).toContain('theirs'); // the newer observation won
  });

  it('honors a deletion (unlink) over a concurrent update', async () => {
    await commitRecord(record('2026-08-10T10:00:00.000Z', '2026-08-10T10:00:01.000Z'), 'base');
    await divergeAndMerge(
      async () =>
        commitRecord(
          record('2026-08-10T12:00:00.000Z', '2026-08-10T12:00:01.000Z', 'ours'),
          'ours',
        ),
      async () => {
        await rm(join(dir, REL_PATH));
        await git('-C', dir, 'add', '-A');
        await git('-C', dir, 'commit', '-q', '-m', 'unlink');
      },
    );

    const result = await resolveBridgeConflicts(dir);
    expect(result.deleted).toBe(1);
    await expect(readFile(join(dir, REL_PATH), 'utf8')).rejects.toThrow();
  });

  it('leaves non-bridge conflicts alone', async () => {
    await mkdir(join(dir, DATA_SYNC_DIR), { recursive: true });
    await writeFile(join(dir, `${DATA_SYNC_DIR}/other.txt`), 'base\n');
    await git('-C', dir, 'add', '-A');
    await git('-C', dir, 'commit', '-q', '-m', 'base');
    await divergeAndMerge(
      async () => {
        await writeFile(join(dir, `${DATA_SYNC_DIR}/other.txt`), 'ours\n');
        await git('-C', dir, 'add', '-A');
        await git('-C', dir, 'commit', '-q', '-m', 'ours');
      },
      async () => {
        await writeFile(join(dir, `${DATA_SYNC_DIR}/other.txt`), 'theirs\n');
        await git('-C', dir, 'add', '-A');
        await git('-C', dir, 'commit', '-q', '-m', 'theirs');
      },
    );

    const result = await resolveBridgeConflicts(dir);
    expect(result.resolved + result.deleted).toBe(0);
    const content = await readFile(join(dir, `${DATA_SYNC_DIR}/other.txt`), 'utf8');
    expect(content).toContain('<<<<<<<'); // untouched; the bead path owns it
  });
});
