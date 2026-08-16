/**
 * Which branch a spec permalink names.
 *
 * These URLs are rendered into the managed block and pushed to a tracker that
 * outlives the branch they were written on. Naming the working branch produced
 * links that 404 after the branch is deleted, and — because the link is part of
 * the block — made the block differ on every sync run from a different branch,
 * rewriting the whole mirror for no reason.
 */

import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { findBranchContaining, specPermalink } from '../src/integrations/core/permalink.js';
import { resolveSpecLinks } from '../src/cli/lib/integration-runner.js';
import { git } from '../src/file/git.js';
import type { Issue } from '../src/lib/types.js';

const SPEC = 'docs/spec.md';
const SLUG = { owner: 'jlevy', repo: 'tbd' };

/** Trunk first, working branch last — the order the runner builds. */
function candidates(working: string) {
  return [
    { check: 'origin/main', url: 'main' },
    { check: 'main', url: 'main' },
    { check: working, url: working },
  ];
}

describe('spec permalink branch selection', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'tbd-permalink-'));
    await git('-C', dir, 'init', '--initial-branch=main');
    await git('-C', dir, 'config', 'user.email', 'test@example.com');
    await git('-C', dir, 'config', 'user.name', 'Test');
    await mkdir(join(dir, 'docs'), { recursive: true });
    await writeFile(join(dir, 'README.md'), 'seed\n');
    await git('-C', dir, 'add', '-A');
    await git('-C', dir, 'commit', '-m', 'seed');
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('names the trunk when the spec is on it, even while on a feature branch', async () => {
    await writeFile(join(dir, SPEC), '# spec\n');
    await git('-C', dir, 'add', '-A');
    await git('-C', dir, 'commit', '-m', 'add spec');
    await git('-C', dir, 'checkout', '-b', 'feature/x');
    await writeFile(join(dir, SPEC), '# spec, edited\n');
    await git('-C', dir, 'add', '-A');
    await git('-C', dir, 'commit', '-m', 'edit spec on the branch');

    // Both branches contain the file. The durable one wins, so the link keeps
    // working after `feature/x` is deleted.
    expect(await findBranchContaining(dir, SPEC, candidates('feature/x'))).toBe('main');
    expect(
      await specPermalink({
        repoDir: dir,
        specPath: SPEC,
        slug: SLUG,
        candidates: candidates('feature/x'),
      }),
    ).toBe('https://github.com/jlevy/tbd/blob/main/docs/spec.md');
  });

  it('falls back to the working branch for a spec that exists nowhere else', async () => {
    await git('-C', dir, 'checkout', '-b', 'feature/new-spec');
    await writeFile(join(dir, SPEC), '# brand new\n');
    await git('-C', dir, 'add', '-A');
    await git('-C', dir, 'commit', '-m', 'new spec, not merged');

    // Unmerged work still gets a link rather than none; the first sync after the
    // merge moves it to the trunk on its own.
    expect(await findBranchContaining(dir, SPEC, candidates('feature/new-spec'))).toBe(
      'feature/new-spec',
    );
  });

  it('returns undefined when no candidate has the spec', async () => {
    expect(await findBranchContaining(dir, 'docs/absent.md', candidates('main'))).toBeUndefined();
  });

  it('resolveSpecLinks builds that order for real, from the branch it runs on', async () => {
    // The ordering the fix actually turns on lives in the runner, not in
    // findBranchContaining, so exercise the whole path: a spec present on main,
    // a sync running from a feature branch, and a URL that must name main.
    await git('-C', dir, 'remote', 'add', 'origin', 'git@github.com:jlevy/tbd.git');
    await writeFile(join(dir, SPEC), '# spec\n');
    await git('-C', dir, 'add', '-A');
    await git('-C', dir, 'commit', '-m', 'add spec');
    await git('-C', dir, 'checkout', '-b', 'claude/some-working-branch');

    const links = await resolveSpecLinks(
      dir,
      [{ id: 'is-1', spec_path: SPEC } as unknown as Issue],
      'tbd-sync',
    );

    expect(links.get(SPEC)).toBe('https://github.com/jlevy/tbd/blob/main/docs/spec.md');
  });

  it('names the plain branch even when the remote-tracking ref answered', async () => {
    // A local `main` that has not been pulled may lack a spec the remote has.
    // `origin/main` is what gets inspected; `main` is what a reader opens.
    await writeFile(join(dir, SPEC), '# on the remote\n');
    await git('-C', dir, 'add', '-A');
    await git('-C', dir, 'commit', '-m', 'spec');
    await git('-C', dir, 'update-ref', 'refs/remotes/origin/main', 'HEAD');
    await git('-C', dir, 'checkout', '-b', 'feature/y');
    await git('-C', dir, 'rm', '-q', SPEC);
    await git('-C', dir, 'commit', '-m', 'not here');
    // Rewind local main so only origin/main carries the spec.
    await git('-C', dir, 'branch', '-f', 'main', 'HEAD');

    expect(await findBranchContaining(dir, SPEC, candidates('feature/y'))).toBe('main');
  });
});
