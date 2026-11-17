/**
 * `tbd sync --dry-run` previews every surface and writes nothing (tbd-y42m).
 *
 * The docs surface used to honor only `--status`, so a dry run wrote the docs cache
 * and `.tbd/config.yml` and then printed "Synced docs". The issue surface opened the
 * locked data-sync context before its dry-run check, which advances the data-sync
 * epoch and can materialize a missing worktree. Each case snapshots the checkout's
 * `.tbd/` tree and the shared `$GIT_COMMON_DIR/tbd` tree, runs the dry run, and then
 * runs the real command to show the preview reported work that was actually pending.
 */

import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtemp, readFile, readdir, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import { resolveSharedTbdPaths } from '../src/lib/paths.js';
import { subprocessTestTimeout } from './test-helpers.js';

const tbdBin = join(fileURLToPath(new URL('..', import.meta.url)), 'dist', 'bin.mjs');
const TIMEOUT_MS = subprocessTestTimeout(60_000);
const cleanup: string[] = [];

afterEach(async () => {
  await Promise.all(cleanup.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

function git(cwd: string, ...args: string[]): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

function runTbd(cwd: string, args: string[]) {
  const result = spawnSync(process.execPath, [tbdBin, ...args], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' },
  });
  expect(result.status, `${args.join(' ')}: ${result.stderr}`).toBe(0);
  return result;
}

/** A git repository after `tbd init`, which leaves the docs cache unpopulated. */
async function initRepo(): Promise<string> {
  const dir = await realpath(await mkdtemp(join(tmpdir(), 'tbd-sync-dry-run-')));
  cleanup.push(dir);
  git(dir, 'init', '-q', '-b', 'main');
  git(dir, 'config', 'user.email', 'test@example.com');
  git(dir, 'config', 'user.name', 'Test User');
  git(dir, 'config', 'commit.gpgsign', 'false');
  git(dir, 'commit', '-q', '--allow-empty', '-m', 'init');
  runTbd(dir, ['init', '--prefix=test']);
  return dir;
}

/** Every file and directory under `root` (missing root: empty), with file contents. */
async function snapshot(root: string): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  async function visit(relative: string): Promise<void> {
    let entries;
    try {
      entries = await readdir(join(root, relative), { withFileTypes: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return;
      }
      throw error;
    }
    for (const entry of entries) {
      const path = join(relative, entry.name);
      if (entry.isDirectory()) {
        result[path] = 'directory';
        await visit(path);
      } else {
        result[path] = (await readFile(join(root, path))).toString('base64');
      }
    }
  }
  await visit('');
  return result;
}

/** The checkout's tbd state, the shared tbd tree, and the registered worktrees. */
async function state(dir: string) {
  const shared = await resolveSharedTbdPaths(dir);
  return {
    checkout: await snapshot(join(dir, '.tbd')),
    shared: await snapshot(shared.sharedTbdDir),
    worktrees: git(dir, 'worktree', 'list', '--porcelain'),
  };
}

describe('tbd sync --dry-run writes nothing', () => {
  it(
    'previews a docs sync without writing the docs cache or .tbd/config.yml',
    async () => {
      const dir = await initRepo();
      const before = await state(dir);

      const dry = runTbd(dir, ['sync', '--docs', '--dry-run']);
      expect(dry.stdout).toMatch(/\[DRY-RUN\] Would sync docs: \+\d+ doc\(s\)/);
      expect(dry.stdout).not.toContain('Synced docs');
      expect(await state(dir)).toEqual(before);

      // The real run makes exactly the changes the preview reported.
      const real = runTbd(dir, ['sync', '--docs']);
      expect(real.stdout).toMatch(/Synced docs: \+\d+ doc\(s\)/);
      expect((await state(dir)).checkout).not.toEqual(before.checkout);
    },
    TIMEOUT_MS,
  );

  it.each([
    { name: 'sync --issues', flags: ['--issues'] },
    { name: 'sync --push', flags: ['--push'] },
    { name: 'a full sync', flags: [] },
  ])(
    'previews $name without taking the writer lock or repairing the worktree',
    async ({ flags }) => {
      const dir = await initRepo();
      const shared = await resolveSharedTbdPaths(dir);
      git(dir, 'worktree', 'remove', '--force', shared.sharedWorktreePath);
      const before = await state(dir);

      const dry = runTbd(dir, ['sync', ...flags, '--dry-run']);
      expect(dry.stdout).toContain('[DRY-RUN] Would prepare the shared data-sync state');
      expect(dry.stdout).toContain('[DRY-RUN] Would sync repository');
      if (flags.length === 0) {
        expect(dry.stdout).toContain('[DRY-RUN] Would sync docs');
      }
      expect(await state(dir)).toEqual(before);

      // The preparation the preview named is real: any data command performs it.
      runTbd(dir, ['list']);
      expect(git(dir, 'worktree', 'list', '--porcelain')).toContain(shared.sharedWorktreePath);

      // With the state prepared, a dry run still leaves it alone, data-sync epoch included.
      const prepared = await state(dir);
      const again = runTbd(dir, ['sync', ...flags, '--dry-run']);
      expect(again.stdout).not.toContain('Would prepare');
      expect(again.stdout).toContain('[DRY-RUN] Would sync repository');
      expect(await state(dir)).toEqual(prepared);
    },
    TIMEOUT_MS,
  );
});
