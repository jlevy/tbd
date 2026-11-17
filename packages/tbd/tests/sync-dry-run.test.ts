/**
 * `tbd sync --dry-run` previews every surface and writes nothing (tbd-y42m).
 *
 * The docs surface used to honor only `--status`, so a dry run wrote the docs cache
 * and `.tbd/config.yml` and then printed "Synced docs". The issue surface opened the
 * locked data-sync context before its dry-run check, which advances the data-sync
 * epoch and can materialize a missing worktree or write a migrated config. Each case
 * snapshots the whole repository, `.git` included, and its bare `origin`, plus every
 * ref and the local git config; runs the dry run; and then runs the real command to
 * show the preview reported work that was actually pending.
 */

import { execFileSync, spawn, spawnSync } from 'node:child_process';
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rm,
  utimes,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import { resolveSharedTbdPaths } from '../src/lib/paths.js';
import { CURRENT_FORMAT } from '../src/lib/tbd-format.js';
import { armAutoGc, subprocessTestTimeout } from './test-helpers.js';

const tbdBin = join(fileURLToPath(new URL('..', import.meta.url)), 'dist', 'bin.mjs');
const TIMEOUT_MS = subprocessTestTimeout(60_000);
const cleanup: string[] = [];

afterEach(async () => {
  await Promise.all(cleanup.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

function git(cwd: string, ...args: string[]): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

/** Run the built CLI, whatever its exit status. */
function spawnTbd(cwd: string, args: string[]) {
  return spawnSync(process.execPath, [tbdBin, ...args], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' },
  });
}

function runTbd(cwd: string, args: string[]) {
  const result = spawnTbd(cwd, args);
  expect(result.status, `${args.join(' ')}: ${result.stderr}`).toBe(0);
  return result;
}

interface Fixture {
  dir: string;
  origin: string;
  sharedWorktreePath: string;
}

/**
 * A repository after `tbd init` and one real issue sync to a bare `origin`, so the
 * sync branch, its remote-tracking ref, and the remote all exist. `tbd init` leaves
 * the docs cache unpopulated, so a docs sync is pending.
 */
async function initRepo(): Promise<Fixture> {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'tbd-sync-dry-run-')));
  cleanup.push(root);
  const dir = join(root, 'repo');
  const origin = join(root, 'origin.git');
  await mkdir(dir);
  git(root, 'init', '-q', '--bare', origin);
  git(dir, 'init', '-q', '-b', 'main');
  git(dir, 'config', 'user.email', 'test@example.com');
  git(dir, 'config', 'user.name', 'Test User');
  git(dir, 'config', 'commit.gpgsign', 'false');
  git(dir, 'remote', 'add', 'origin', origin);
  git(dir, 'commit', '-q', '--allow-empty', '-m', 'init');
  git(dir, 'push', '-q', 'origin', 'main');
  runTbd(dir, ['init', '--prefix=test']);
  runTbd(dir, ['create', 'An issue']);
  runTbd(dir, ['sync', '--issues']);
  const shared = await resolveSharedTbdPaths(dir);
  return { dir, origin, sharedWorktreePath: shared.sharedWorktreePath };
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

/**
 * Everything a dry run could write: the repository directory, `.git` and with it the
 * shared tbd tree (epoch, locks, layout) and the sync worktree's files; the remote;
 * the refs on both sides, remote-tracking refs included; and the local git config.
 */
async function state({ dir, origin }: Fixture) {
  return {
    repository: await snapshot(dir),
    origin: await snapshot(origin),
    refs: git(dir, 'for-each-ref'),
    originRefs: git(origin, 'for-each-ref'),
    config: git(dir, 'config', '--list', '--local'),
    worktrees: git(dir, 'worktree', 'list', '--porcelain'),
  };
}

/** Remove the sync worktree, the state of a fresh clone or a deleted worktree. */
function removeWorktree({ dir, sharedWorktreePath }: Fixture): void {
  git(dir, 'worktree', 'remove', '--force', sharedWorktreePath);
}

/** The `+N` doc count in a dry-run or real docs line. */
function addedDocs(stdout: string): number {
  const match = /(?:Would sync docs|Synced docs): \+(\d+) /.exec(stdout);
  expect(match, stdout).not.toBeNull();
  return Number(match![1]);
}

/** Every `tbd sync` flag set that reaches a surface, as a dry run. */
const FLAG_SETS = [
  { name: 'a full sync', flags: [] },
  { name: 'sync --docs', flags: ['--docs'] },
  { name: 'sync --issues', flags: ['--issues'] },
  { name: 'sync --push', flags: ['--push'] },
  { name: 'sync --pull', flags: ['--pull'] },
  { name: 'sync --integrations', flags: ['--integrations'] },
  { name: 'sync --push --integrations', flags: ['--push', '--integrations'] },
];
/** The flag sets that reach the issue surface. */
const ISSUE_FLAG_SETS = FLAG_SETS.filter(
  ({ flags }) => !(flags.length === 1 && (flags[0] === '--docs' || flags[0] === '--integrations')),
);

describe('tbd sync --dry-run writes nothing', () => {
  it(
    'previews a docs sync without writing the docs cache or .tbd/config.yml',
    async () => {
      const fixture = await initRepo();
      const before = await state(fixture);

      const dry = runTbd(fixture.dir, ['sync', '--docs', '--dry-run']);
      expect(dry.stdout).toMatch(/\[DRY-RUN\] Would sync docs: \+\d+ doc\(s\)/);
      expect(dry.stdout).not.toContain('Synced docs');
      expect(await state(fixture)).toEqual(before);

      // The real run makes exactly the changes the preview reported.
      const real = runTbd(fixture.dir, ['sync', '--docs']);
      expect(addedDocs(real.stdout)).toBe(addedDocs(dry.stdout));
      expect((await state(fixture)).repository).not.toEqual(before.repository);
    },
    TIMEOUT_MS,
  );

  it.each(ISSUE_FLAG_SETS)(
    'previews $name without taking the writer lock or repairing the worktree',
    async ({ flags }) => {
      const fixture = await initRepo();
      removeWorktree(fixture);
      const before = await state(fixture);

      const dry = runTbd(fixture.dir, ['sync', ...flags, '--dry-run']);
      expect(dry.stdout).toContain('[DRY-RUN] Would prepare the shared data-sync state');
      expect(dry.stdout).toContain('[DRY-RUN] Would sync repository');
      if (flags.length === 0) {
        expect(dry.stdout).toContain('[DRY-RUN] Would sync docs');
      }
      expect(await state(fixture)).toEqual(before);

      // The preparation the preview named is real: any data command performs it.
      runTbd(fixture.dir, ['list']);
      // `git worktree list` prints forward slashes on Windows; the resolved path is native.
      const toSlashes = (path: string) => path.replace(/\\/g, '/');
      expect(toSlashes(git(fixture.dir, 'worktree', 'list', '--porcelain'))).toContain(
        toSlashes(fixture.sharedWorktreePath),
      );

      // With the state prepared, a dry run still leaves it alone, data-sync epoch included.
      const prepared = await state(fixture);
      const again = runTbd(fixture.dir, ['sync', ...flags, '--dry-run']);
      expect(again.stdout).not.toContain('Would prepare');
      expect(again.stdout).toContain('[DRY-RUN] Would sync repository');
      expect(await state(fixture)).toEqual(prepared);
    },
    TIMEOUT_MS,
  );

  it(
    'previews a config format migration without writing the migrated config',
    async () => {
      const fixture = await initRepo();
      const configPath = join(fixture.dir, '.tbd', 'config.yml');
      const config = await readFile(configPath, 'utf8');
      expect(config).toContain(`tbd_format: ${CURRENT_FORMAT}`);
      await writeFile(
        configPath,
        config.replace(`tbd_format: ${CURRENT_FORMAT}`, 'tbd_format: f07'),
      );
      const before = await state(fixture);

      for (const flags of [[], ['--issues'], ['--pull']]) {
        const dry = runTbd(fixture.dir, ['sync', ...flags, '--dry-run']);
        expect(dry.stdout).toContain('[DRY-RUN] Would prepare the shared data-sync state');
        expect(await state(fixture)).toEqual(before);
      }

      // The migration the preview named is real: any data command performs it.
      runTbd(fixture.dir, ['list']);
      expect(await readFile(configPath, 'utf8')).toContain(`tbd_format: ${CURRENT_FORMAT}`);
    },
    TIMEOUT_MS,
  );

  // A dry run that announces a sync the real run refuses has failed at its one job.
  it.each([
    { name: 'sync --issues', flags: ['--issues'] },
    { name: 'a full sync', flags: [] },
  ])(
    "previews $name over a worktree it cannot repair with the real run's error",
    async ({ flags }) => {
      const fixture = await initRepo();
      removeWorktree(fixture);
      // A directory git does not know is `corrupted`, which only `tbd doctor --fix` repairs.
      await mkdir(join(fixture.sharedWorktreePath, 'stray'), { recursive: true });
      const before = await state(fixture);

      const dry = spawnTbd(fixture.dir, ['sync', ...flags, '--dry-run']);
      expect(await state(fixture)).toEqual(before);
      const real = spawnTbd(fixture.dir, ['sync', ...flags]);
      const errorLine = (stderr: string) =>
        stderr.split('\n').find((line) => line.includes('Shared data-sync worktree is corrupted'));
      expect(dry.status).toBe(1);
      expect(real.status).toBe(1);
      expect(errorLine(real.stderr)).toContain("Run 'tbd doctor --fix' to repair.");
      expect(errorLine(dry.stderr)).toBe(errorLine(real.stderr));
      expect(dry.stdout).not.toContain('Would sync repository');
    },
    TIMEOUT_MS,
  );
});

describe('tbd sync --dry-run --json prints one result document', () => {
  // Earlier releases printed exactly one document; scripts and agents parse stdout whole.
  it(
    'for every surface selection, with docs pending and the worktree missing',
    async () => {
      const fixture = await initRepo();
      removeWorktree(fixture);
      const before = await state(fixture);

      for (const { name, flags } of FLAG_SETS) {
        const dry = runTbd(fixture.dir, ['sync', ...flags, '--dry-run', '--json']);
        const document = JSON.parse(dry.stdout) as Record<string, unknown>;
        expect(document.dryRun, name).toBe(true);
        if (ISSUE_FLAG_SETS.some((set) => set.name === name)) {
          expect(document, name).toMatchObject({
            action: 'Would sync repository',
            syncBranch: 'tbd-sync',
            remote: 'origin',
            prepareDataSyncState: true,
          });
        }
        if (flags.length === 0 || flags.includes('--docs')) {
          expect((document.docs as { added: number }).added, name).toBeGreaterThan(0);
        }
        if (flags.length === 0 || flags.includes('--integrations')) {
          expect(document.integrations, name).toEqual({ runs: false, evaluated: false });
        }
      }

      const docs = runTbd(fixture.dir, ['docs', 'sync', '--dry-run', '--json']);
      // The same shape as the `docs` part of `tbd sync --dry-run --json`.
      expect(JSON.parse(docs.stdout)).toMatchObject({
        dryRun: true,
        docs: { added: expect.any(Number) as number, configChanged: true },
      });
      expect(await state(fixture)).toEqual(before);
    },
    TIMEOUT_MS,
  );

  it(
    'when nothing would change',
    async () => {
      const fixture = await initRepo();
      runTbd(fixture.dir, ['sync', '--docs']);

      for (const args of [
        ['sync', '--dry-run', '--json'],
        ['sync', '--docs', '--dry-run', '--json'],
        ['docs', 'sync', '--dry-run', '--json'],
      ]) {
        const document = JSON.parse(runTbd(fixture.dir, args).stdout) as Record<string, unknown>;
        expect(document.dryRun, args.join(' ')).toBe(true);
        expect(document.prepareDataSyncState ?? false, args.join(' ')).toBe(false);
      }
    },
    TIMEOUT_MS,
  );
});

describe('tbd sync --status is read-only (tbd-incg)', () => {
  it(
    'takes no lock, re-creates no worktree, and migrates no config, with or without --dry-run',
    async () => {
      const fixture = await initRepo();
      removeWorktree(fixture);
      const configPath = join(fixture.dir, '.tbd', 'config.yml');
      const config = await readFile(configPath, 'utf8');
      await writeFile(
        configPath,
        config.replace(`tbd_format: ${CURRENT_FORMAT}`, 'tbd_format: f07'),
      );
      const before = await state(fixture);

      for (const args of [
        ['sync', '--status'],
        ['sync', '--status', '--dry-run'],
        ['sync', '--issues', '--status'],
        ['sync', '--issues', '--status', '--json'],
      ]) {
        const status = runTbd(fixture.dir, args);
        expect(await state(fixture), args.join(' ')).toEqual(before);
        if (!args.includes('--json')) {
          expect(status.stdout, args.join(' ')).toContain('The data-sync worktree is missing');
        }
      }
    },
    TIMEOUT_MS,
  );

  it(
    'lists the first changed path whole',
    async () => {
      const fixture = await initRepo();
      // Leaves ` M .tbd/data-sync/mappings/ids.yml` as the first porcelain line, whose
      // leading space a trimmed read loses, cutting the path's first character.
      runTbd(fixture.dir, ['create', 'Another issue']);

      const status = runTbd(fixture.dir, ['sync', '--issues', '--status', '--json']);
      const { localChanges } = JSON.parse(status.stdout) as { localChanges: string[] };
      expect(localChanges[0]).toBe('modified: .tbd/data-sync/mappings/ids.yml');
      expect(localChanges.slice(1)).toEqual([
        expect.stringMatching(/^new: \.tbd\/data-sync\/issues\/is-[0-9a-z]{26}\.md$/) as string,
      ]);
    },
    TIMEOUT_MS,
  );

  it(
    "raises the writer's error over a worktree it cannot repair",
    async () => {
      const fixture = await initRepo();
      removeWorktree(fixture);
      await mkdir(join(fixture.sharedWorktreePath, 'stray'), { recursive: true });
      const errorLine = (stderr: string) =>
        stderr.split('\n').find((line) => line.includes('Shared data-sync worktree is corrupted'));
      const writer = spawnTbd(fixture.dir, ['sync', '--issues']);
      expect(writer.status).toBe(1);
      for (const args of [
        ['sync', '--issues', '--status'],
        ['sync', '--issues', '--status', '--dry-run'],
      ]) {
        const status = spawnTbd(fixture.dir, args);
        expect(status.status, args.join(' ')).toBe(1);
        expect(errorLine(status.stderr), args.join(' ')).toBe(errorLine(writer.stderr));
      }
    },
    TIMEOUT_MS,
  );

  it(
    'says it could not read the remote instead of reporting in sync',
    async () => {
      const fixture = await initRepo();
      // One local commit the remote has not seen, then a remote nobody can read.
      git(fixture.sharedWorktreePath, 'commit', '-q', '--allow-empty', '-m', 'local only');
      git(fixture.dir, 'remote', 'set-url', 'origin', join(fixture.origin, 'missing.git'));

      const json = runTbd(fixture.dir, ['sync', '--issues', '--status', '--json']);
      expect(JSON.parse(json.stdout)).toMatchObject({
        synced: false,
        remoteChecked: false,
        ahead: 1,
        behind: 0,
      });
      expect(json.stderr).toContain('"remoteChecked":false');
      const text = runTbd(fixture.dir, ['sync', '--issues', '--status']);
      expect(text.stdout).toContain('Could not read origin/tbd-sync');
      expect(text.stdout).not.toContain('Repository is in sync');
    },
    TIMEOUT_MS,
  );
});

/** A second clone of the fixture's remote, with tbd ready to create and sync. */
function cloneRemote(fixture: Fixture, name: string): string {
  // `tbd init` left .tbd uncommitted; publish it on main so a clone is a tbd checkout.
  if (git(fixture.dir, 'status', '--porcelain', '--', '.tbd') !== '') {
    git(fixture.dir, 'add', '.tbd');
    git(fixture.dir, 'commit', '-q', '-m', 'tbd');
    git(fixture.dir, 'push', '-q', 'origin', 'main');
  }
  const clone = join(fixture.dir, '..', name);
  git(join(fixture.dir, '..'), 'clone', '-q', '-b', 'main', fixture.origin, clone);
  git(clone, 'config', 'user.email', 'other@example.com');
  git(clone, 'config', 'user.name', 'Other User');
  git(clone, 'config', 'commit.gpgsign', 'false');
  return clone;
}

/** Run the built CLI without waiting, so two can overlap. */
function startTbd(
  cwd: string,
  args: string[],
): Promise<{ status: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [tbdBin, ...args], {
      cwd,
      env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' },
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on('error', reject);
    child.on('close', (status) => {
      resolve({ status, stdout, stderr });
    });
  });
}

/**
 * Forward `git upload-pack`'s output a chunk at a time with a delay, standing in for a
 * network round trip, so two fetches started together overlap for most of their length.
 */
const SLOW_UPLOAD_PACK = `
import { spawn } from 'node:child_process';
import { Transform } from 'node:stream';
const [delay, ...args] = process.argv.slice(2);
const child = spawn('git', ['upload-pack', ...args], { stdio: ['inherit', 'pipe', 'inherit'] });
const slow = new Transform({
  transform(chunk, _encoding, done) {
    setTimeout(() => done(null, chunk), Number(delay));
  },
});
child.stdout.pipe(slow).pipe(process.stdout);
child.on('exit', (code) => {
  process.exitCode = code ?? 1;
});
`;

// Status reads the remote without a lock, so it must not write the ref every sync
// fetches into: `git fetch` checks a ref's old value when it writes, and the slower of
// two overlapping fetches of one ref fails with `cannot lock ref`. The uploadpack
// wrapper is run through git's POSIX shell, which Windows runners do not provide.
describe.skipIf(process.platform === 'win32')('tbd sync --status beside a concurrent fetch', () => {
  it(
    'counts what is behind without moving a ref, and races neither status nor sync',
    async () => {
      const fixture = await initRepo();
      const other = cloneRemote(fixture, 'other');
      const remoteTip = () => git(fixture.origin, 'rev-parse', 'refs/heads/tbd-sync');
      const localTip = () => git(fixture.dir, 'rev-parse', 'refs/heads/tbd-sync');
      const publishFromOther = (title: string) => {
        runTbd(other, ['create', title]);
        runTbd(other, ['sync', '--issues']);
      };
      const wrapper = join(fixture.dir, '..', 'slow-upload-pack.mjs');
      await writeFile(wrapper, SLOW_UPLOAD_PACK);
      git(
        fixture.dir,
        'config',
        'remote.origin.uploadpack',
        `'${process.execPath}' '${wrapper}' 300`,
      );
      const status = ['sync', '--issues', '--status', '--json'];
      const parse = (result: { stdout: string; stderr: string }) =>
        JSON.parse(result.stdout) as { synced: boolean; behind: number; remoteChecked: boolean };

      // Two statuses at once both see the commit waiting, and neither writes a ref.
      publishFromOther('First from the other clone');
      const refs = git(fixture.dir, 'for-each-ref');
      const results = await Promise.all([
        startTbd(fixture.dir, status),
        startTbd(fixture.dir, status),
      ]);
      for (const result of results) {
        expect(result.status, result.stderr).toBe(0);
        expect(parse(result), result.stderr).toMatchObject({
          synced: false,
          behind: 1,
          remoteChecked: true,
        });
      }
      expect(git(fixture.dir, 'for-each-ref')).toBe(refs);

      // A pull beside a status completes and lands on the remote tip.
      const [pull, pullStatus] = await Promise.all([
        startTbd(fixture.dir, ['sync', '--pull']),
        startTbd(fixture.dir, status),
      ]);
      expect(pull.status, pull.stderr).toBe(0);
      expect(pull.stderr).not.toContain('cannot lock ref');
      expect(pullStatus.status, pullStatus.stderr).toBe(0);
      expect(localTip()).toBe(remoteTip());

      // So does a full issue sync beside a status, after the remote moves again.
      publishFromOther('Second from the other clone');
      const [sync, syncStatus] = await Promise.all([
        startTbd(fixture.dir, ['sync', '--issues']),
        startTbd(fixture.dir, status),
      ]);
      expect(sync.status, sync.stderr).toBe(0);
      expect(syncStatus.status, syncStatus.stderr).toBe(0);
      expect(git(fixture.dir, 'merge-base', '--is-ancestor', remoteTip(), localTip())).toBe('');
    },
    TIMEOUT_MS,
  );
});

/** Everything in `state()` except the object store, which a status may add to. */
async function stateOutsideObjects(fixture: Fixture) {
  const current = await state(fixture);
  const objects = join('.git', 'objects');
  const repository = Object.fromEntries(
    Object.entries(current.repository).filter(([path]) => !path.startsWith(objects)),
  );
  return { ...current, repository };
}

interface StatusJson {
  synced: boolean;
  ahead: number;
  behind: number;
  remoteChecked: boolean;
}

// Unlike the race test above, these need no uploadpack wrapper, so they run everywhere.
describe('tbd sync --status reads the remote as an observer', () => {
  it(
    'fetches a commit it lacks without writing outside the object store',
    async () => {
      const fixture = await initRepo();
      const other = cloneRemote(fixture, 'other');
      runTbd(other, ['create', 'From the other clone']);
      runTbd(other, ['sync', '--issues']);
      // A tracked file whose stat no longer matches the index: a refreshing
      // `git status` would rewrite the worktree's index to record it.
      const tracked = join(fixture.sharedWorktreePath, '.tbd', 'data-sync', 'mappings', 'ids.yml');
      await utimes(tracked, new Date('2001-01-01'), new Date('2001-01-01'));
      armAutoGc(fixture.dir);
      const before = await stateOutsideObjects(fixture);

      const status = runTbd(fixture.dir, ['sync', '--issues', '--status', '--json']);
      expect(JSON.parse(status.stdout)).toMatchObject({
        synced: false,
        behind: 1,
        remoteChecked: true,
      });
      // No ref, `FETCH_HEAD`, `packed-refs`, reflog, or index changed.
      expect(await stateOutsideObjects(fixture)).toEqual(before);
    },
    TIMEOUT_MS,
  );

  it(
    'compares with the exact remote branch, and with an absent one',
    async () => {
      const fixture = await initRepo();
      // `ls-remote` matches a path suffix and may print this decoy first.
      git(fixture.dir, 'push', '-q', 'origin', 'main:refs/heads/a/refs/heads/tbd-sync');
      const json = () =>
        JSON.parse(
          runTbd(fixture.dir, ['sync', '--issues', '--status', '--json']).stdout,
        ) as StatusJson;
      expect(json()).toMatchObject({ synced: true, ahead: 0, behind: 0, remoteChecked: true });

      // The remote answers without the branch: every local commit is still to push.
      // First with only the decoy left (`ls-remote` exits 0), then with nothing (exit 2).
      git(fixture.origin, 'update-ref', '-d', 'refs/heads/tbd-sync');
      const localCommits = Number(git(fixture.dir, 'rev-list', '--count', 'refs/heads/tbd-sync'));
      const absent = { synced: false, ahead: localCommits, behind: 0, remoteChecked: true };
      expect(json()).toMatchObject(absent);
      git(fixture.origin, 'update-ref', '-d', 'refs/heads/a/refs/heads/tbd-sync');
      expect(json()).toMatchObject(absent);
    },
    TIMEOUT_MS,
  );

  it(
    'is not in sync with a remote it could not read, even with nothing pending',
    async () => {
      const fixture = await initRepo();
      git(fixture.dir, 'remote', 'set-url', 'origin', join(fixture.origin, 'missing.git'));

      const json = runTbd(fixture.dir, ['sync', '--issues', '--status', '--json']);
      expect(JSON.parse(json.stdout)).toMatchObject({
        synced: false,
        ahead: 0,
        behind: 0,
        remoteChecked: false,
      });
      const text = runTbd(fixture.dir, ['sync', '--issues', '--status']);
      expect(text.stdout).toContain('No commits to push or pull against the last fetched copy');
      expect(text.stdout).not.toContain('Repository is in sync');
    },
    TIMEOUT_MS,
  );

  it(
    'says the remote tip is known when its commits cannot be fetched',
    async () => {
      const fixture = await initRepo();
      const other = cloneRemote(fixture, 'other');
      runTbd(other, ['create', 'From the other clone']);
      runTbd(other, ['sync', '--issues']);
      // A setting only `git fetch` reads: `ls-remote` answers, the commit fetch fails.
      git(fixture.dir, 'config', 'fetch.output', 'not-a-format');

      const remoteTip = git(fixture.origin, 'rev-parse', 'refs/heads/tbd-sync');
      const json = runTbd(fixture.dir, ['sync', '--issues', '--status', '--json']);
      // The document says the counts are against the last fetched copy, which matches
      // the local branch here: the commit waiting on the remote is not counted.
      expect(JSON.parse(json.stdout)).toMatchObject({
        synced: false,
        ahead: 0,
        behind: 0,
        remoteChecked: true,
        remoteTip,
        fetched: false,
      });
      const notice = json.stderr
        .split('\n')
        .filter((line) => line.startsWith('{'))
        .map((line) => JSON.parse(line) as Record<string, unknown>)
        .find((entry) => entry.fetched === false);
      expect(notice).toMatchObject({
        remoteChecked: true,
        remoteTip,
        reason: expect.stringMatching(/^fatal: .*not-a-format/) as string,
      });
      const text = runTbd(fixture.dir, ['sync', '--issues', '--status']);
      expect(text.stdout).toContain('but its commits could not be fetched to count them');
      expect(text.stdout).toContain('No commits to push or pull against the last fetched copy');
      expect(text.stdout).not.toContain('Could not read');
      expect(text.stdout).not.toContain('Repository is in sync');
    },
    TIMEOUT_MS,
  );
});
