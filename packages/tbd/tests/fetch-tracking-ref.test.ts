/**
 * Fetch must advance the remote-tracking ref, not just FETCH_HEAD.
 *
 * Every ahead/behind count and every merge-and-retry in the sync path compares against
 * `refs/remotes/<remote>/<branch>`. A destination-less `git fetch <remote> <branch>`
 * updates that ref only when the remote's configured refspec happens to cover the
 * branch — and for `tbd-sync` that is exactly the case that fails, because a
 * single-branch clone configures `+refs/heads/<default>:refs/remotes/origin/<default>`
 * and the sync branch is by definition never the default.
 *
 * Single-branch clones are ordinary: CI checkouts and agent sandboxes make them by
 * default. In one, sync reported "Already in sync" against a remote 283 commits ahead,
 * and a push rejected as non-fast-forward was reported as "Remote has conflicting
 * changes" — silent staleness in the direction that looks like success.
 *
 * Run against real git, because the bug is a fact about what git does with a
 * destination-less refspec under a given refmap. A stub would encode the belief that
 * was wrong, and the first version of this test did exactly that: written against a
 * full clone it asserted the bare fetch was stale, and git proved otherwise.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { git, trackingRefspec } from '../src/file/git.js';

let root: string;
let origin: string;
let single: string;
let full: string;

async function commit(dir: string, name: string): Promise<void> {
  await writeFile(join(dir, name), name);
  await git('-C', dir, 'add', '-A');
  await git('-C', dir, 'commit', '-q', '-m', name);
}

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'tbd-fetchref-'));
  origin = join(root, 'origin');
  single = join(root, 'single');
  full = join(root, 'full');
  await git('init', '-q', '--bare', '--initial-branch=main', origin);

  const seed = join(root, 'seed');
  await git('init', '-q', '--initial-branch=main', seed);
  await git('-C', seed, 'config', 'user.email', 'test@example.com');
  await git('-C', seed, 'config', 'user.name', 'Test');
  await commit(seed, 'first');
  await git('-C', seed, 'remote', 'add', 'origin', origin);
  await git('-C', seed, 'push', '-q', 'origin', 'main');

  // The sync branch, which is never the default branch.
  await git('-C', seed, 'checkout', '-q', '-b', 'tbd-sync');
  await commit(seed, 'beads');
  await git('-C', seed, 'push', '-q', 'origin', 'tbd-sync');

  await git('clone', '-q', '--single-branch', '--branch', 'main', origin, single);
  await git('clone', '-q', origin, full);
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

describe('fetching the sync branch', () => {
  it('leaves the tracking ref unwritten in a single-branch clone', async () => {
    // The real condition. The refmap covers `main` only, so nothing creates
    // refs/remotes/origin/tbd-sync and every comparison against it reads a ref that
    // does not exist or never moves.
    const refspec = await git('-C', single, 'config', '--get', 'remote.origin.fetch');
    expect(refspec.trim()).toBe('+refs/heads/main:refs/remotes/origin/main');

    await git('-C', single, 'fetch', 'origin', 'tbd-sync');
    await expect(
      git('-C', single, 'rev-parse', '--verify', 'refs/remotes/origin/tbd-sync'),
    ).rejects.toThrow();
  });

  it('writes it with the refspec tbd now sends', async () => {
    await git('-C', single, 'fetch', 'origin', trackingRefspec('origin', 'tbd-sync'));
    const sha = await git('-C', single, 'rev-parse', 'refs/remotes/origin/tbd-sync');
    expect(sha.trim()).toMatch(/^[0-9a-f]{40}$/);
  });

  it('is harmless where the configured refmap already covers the branch', async () => {
    // A full clone was never broken, which is why this went unnoticed: the explicit
    // refspec has to be right in both worlds, not just the failing one.
    await git('-C', full, 'fetch', 'origin', trackingRefspec('origin', 'tbd-sync'));
    const sha = await git('-C', full, 'rev-parse', 'refs/remotes/origin/tbd-sync');
    expect(sha.trim()).toMatch(/^[0-9a-f]{40}$/);
  });

  it('names both ends explicitly', () => {
    expect(trackingRefspec('origin', 'tbd-sync')).toBe(
      'refs/heads/tbd-sync:refs/remotes/origin/tbd-sync',
    );
  });
});
