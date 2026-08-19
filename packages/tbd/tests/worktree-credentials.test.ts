/**
 * Credential resolution across linked worktrees.
 *
 * `.env` is gitignored, and gitignored files do not propagate to worktrees, so a
 * configured repository looked unconfigured from any worktree of it. These tests
 * run over real `git worktree` checkouts created outside the main one, because a
 * temp directory standing in for a worktree cannot exercise the resolution this
 * feature exists for: the whole question is what git reports about a directory.
 */

import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { git } from '../src/file/git.js';
import { resolveCredential } from '../src/integrations/core/credentials.js';
import { integrationStatus } from '../src/integrations/core/status.js';
import { resolveMainWorktree } from '../src/lib/paths.js';
import type { Config } from '../src/lib/types.js';

/**
 * The realpath of a directory, matching what git reports.
 *
 * macOS resolves `/tmp` to `/private/tmp`, so a literal temp path and git's answer
 * for the same directory are different strings.
 */
async function realish(dir: string): Promise<string> {
  return realpath(dir).catch(() => dir);
}

const MAIN_SECRET = 'lin_api_mainworktree_0123456789';
const LOCAL_SECRET = 'lin_api_worktreelocal_9876543210';
const EXPORTED_SECRET = 'lin_api_exported_abcdefabcdef';

function config(): Config {
  return {
    version: 1,
    display: { id_prefix: 'tbd' },
    settings: { auto_sync: false, doc_auto_sync_hours: 24, use_gh_cli: true },
    sync: { branch: 'tbd-sync' },
    integrations: {
      on_tbd_sync: 'off' as const,
      linear: {
        enabled: true,
        team_key: 'FIN',
        select: { kinds: ['epic'], statuses: ['open'], labels: [], linked: true },
        max_nesting: 2,
        create_labels: true,
        user_map: {},
      },
    },
  } as unknown as Config;
}

/**
 * Identity and signing, set per repository.
 *
 * The suite must not depend on the developer's global git config, and a machine
 * with `commit.gpgsign` on would otherwise fail in the fixture rather than in
 * anything a test is about.
 */
async function configureCommits(dir: string): Promise<void> {
  await git('-C', dir, 'config', 'user.name', 'tbd tests');
  await git('-C', dir, 'config', 'user.email', 'tests@example.invalid');
  await git('-C', dir, 'config', 'commit.gpgsign', 'false');
}

/** A repository with one commit, so `git worktree add` has something to branch from. */
async function initRepo(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true });
  await git('-C', dir, 'init', '-q');
  await configureCommits(dir);
  await git('-C', dir, 'commit', '-q', '--allow-empty', '-m', 'init');
}

/** A checkout whose git dir sits outside it, the shape a bare dirname resolves wrong. */
async function initSeparateGitDirRepo(checkout: string, gitDir: string): Promise<void> {
  await git('-C', dirname(checkout), 'init', '-q', `--separate-git-dir=${gitDir}`, checkout);
  await configureCommits(checkout);
  await git('-C', checkout, 'commit', '-q', '--allow-empty', '-m', 'init');
}

describe('main worktree resolution', () => {
  let root: string;
  let main: string;
  let linked: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'tbd-wt-'));
    main = join(root, 'main');
    // Deliberately a sibling of the checkout rather than a child. Five of six real
    // worktrees measured on one machine lived outside their checkout, which is what
    // rules out directory-walking as an implementation.
    linked = join(root, 'linked');
    await initRepo(main);
    await git('-C', main, 'worktree', 'add', '-q', '-b', 'wt', linked);
    delete process.env.LINEAR_API_KEY;
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
    delete process.env.LINEAR_API_KEY;
  });

  it('resolves the main checkout from a linked worktree outside it', async () => {
    await expect(resolveMainWorktree(linked)).resolves.toBe(await realish(main));
  });

  it('resolves the main checkout from the main checkout, so callers need no special case', async () => {
    await expect(resolveMainWorktree(main)).resolves.toBe(await realish(main));
  });

  it('returns nothing outside a git repository rather than raising', async () => {
    const outside = await mkdtemp(join(tmpdir(), 'tbd-nogit-'));
    try {
      await expect(resolveMainWorktree(outside)).resolves.toBeUndefined();
    } finally {
      await rm(outside, { recursive: true, force: true });
    }
  });

  it('rejects the candidate under --separate-git-dir instead of reaching a sibling directory', async () => {
    // The common dir's parent here is `root`, which is not a checkout of this
    // repository. A bare dirname would hand back a directory holding unrelated
    // projects, which is exactly the cross-project `.env` read this rules out.
    const sepRoot = await mkdtemp(join(tmpdir(), 'tbd-sep-'));
    const sepMain = join(sepRoot, 'checkout');
    const sepGitDir = join(sepRoot, 'gitdir');
    try {
      await initSeparateGitDirRepo(sepMain, sepGitDir);
      await expect(resolveMainWorktree(sepMain)).resolves.toBeUndefined();
    } finally {
      await rm(sepRoot, { recursive: true, force: true });
    }
  });
});

describe('credential resolution across worktrees', () => {
  let root: string;
  let main: string;
  let linked: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'tbd-wtcred-'));
    main = join(root, 'main');
    linked = join(root, 'linked');
    await initRepo(main);
    await git('-C', main, 'worktree', 'add', '-q', '-b', 'wt', linked);
    delete process.env.LINEAR_API_KEY;
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
    delete process.env.LINEAR_API_KEY;
  });

  it('reads the main checkout .env from a linked worktree that has none', async () => {
    await writeFile(join(main, '.env'), `LINEAR_API_KEY=${MAIN_SECRET}\n`);

    const credential = await resolveCredential('linear', linked);

    expect(credential?.value).toBe(MAIN_SECRET);
    expect(credential?.source).toBe('dotenv');
    expect(credential?.path).toBe(join(await realish(main), '.env'));
  });

  it('prefers a worktree-local .env over the main one', async () => {
    await writeFile(join(main, '.env'), `LINEAR_API_KEY=${MAIN_SECRET}\n`);
    await writeFile(join(linked, '.env'), `LINEAR_API_KEY=${LOCAL_SECRET}\n`);

    const credential = await resolveCredential('linear', linked);

    expect(credential?.value).toBe(LOCAL_SECRET);
    expect(credential?.path).toBe(join(linked, '.env'));
  });

  it('prefers an exported variable over both files', async () => {
    await writeFile(join(main, '.env'), `LINEAR_API_KEY=${MAIN_SECRET}\n`);
    await writeFile(join(linked, '.env'), `LINEAR_API_KEY=${LOCAL_SECRET}\n`);
    process.env.LINEAR_API_KEY = EXPORTED_SECRET;

    const credential = await resolveCredential('linear', linked);

    expect(credential?.value).toBe(EXPORTED_SECRET);
    expect(credential?.source).toBe('env');
    expect(credential?.path).toBeUndefined();
  });

  it('finds nothing when neither worktree holds a key', async () => {
    await expect(resolveCredential('linear', linked)).resolves.toBeUndefined();
  });

  it('does not read a .env outside the repository under --separate-git-dir', async () => {
    const sepRoot = await mkdtemp(join(tmpdir(), 'tbd-sepcred-'));
    const sepMain = join(sepRoot, 'checkout');
    const sepGitDir = join(sepRoot, 'gitdir');
    try {
      await initSeparateGitDirRepo(sepMain, sepGitDir);
      // Sitting where a bare dirname would land. Nothing may read it.
      await writeFile(join(sepRoot, '.env'), `LINEAR_API_KEY=${MAIN_SECRET}\n`);

      await expect(resolveCredential('linear', sepMain)).resolves.toBeUndefined();
    } finally {
      await rm(sepRoot, { recursive: true, force: true });
    }
  });

  it('leaves behavior unchanged outside a git repository', async () => {
    const outside = await mkdtemp(join(tmpdir(), 'tbd-nogitcred-'));
    try {
      await expect(resolveCredential('linear', outside)).resolves.toBeUndefined();

      await writeFile(join(outside, '.env'), `LINEAR_API_KEY=${LOCAL_SECRET}\n`);
      const credential = await resolveCredential('linear', outside);
      expect(credential?.value).toBe(LOCAL_SECRET);
    } finally {
      await rm(outside, { recursive: true, force: true });
    }
  });
});

describe('status reporting of the credential source', () => {
  let root: string;
  let main: string;
  let linked: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'tbd-wtstatus-'));
    main = join(root, 'main');
    linked = join(root, 'linked');
    await initRepo(main);
    await git('-C', main, 'worktree', 'add', '-q', '-b', 'wt', linked);
    delete process.env.LINEAR_API_KEY;
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
    delete process.env.LINEAR_API_KEY;
  });

  it('names the main checkout file it loaded, and never prints the key', async () => {
    await writeFile(join(main, '.gitignore'), '.env\n');
    await writeFile(join(main, '.env'), `LINEAR_API_KEY=${MAIN_SECRET}\n`);

    const status = await integrationStatus({ config: config(), repoRoot: linked });
    const credential = status.providers[0]?.findings.find((f) => f.label === 'credential');

    expect(credential?.state).toBe('ok');
    expect(credential?.detail).toContain(join(await realish(main), '.env'));
    expect(credential?.detail).not.toContain(MAIN_SECRET);
  });

  it('reports .env safety for the file actually read, not the empty local one', async () => {
    // No .gitignore anywhere, so the file in use is exposed. Reporting on the
    // worktree's absent `.env` would call that safe.
    await writeFile(join(main, '.env'), `LINEAR_API_KEY=${MAIN_SECRET}\n`);

    const status = await integrationStatus({ config: config(), repoRoot: linked });

    expect(status.envFile.state).toBe('error');
    expect(status.envFile.detail).toContain('NOT gitignored');
    expect(status.envFile.detail).toContain(join(await realish(main), '.env'));
  });

  it('says nothing about another file when the local .env answered', async () => {
    await writeFile(join(linked, '.gitignore'), '.env\n');
    await writeFile(join(linked, '.env'), `LINEAR_API_KEY=${LOCAL_SECRET}\n`);

    const status = await integrationStatus({ config: config(), repoRoot: linked });

    expect(status.envFile.state).toBe('ok');
    expect(status.envFile.detail).toBe('present and gitignored');
  });
});
