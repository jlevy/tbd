/**
 * End-to-end tests for the shared common-dir layout lifecycle through the CLI.
 *
 * Covers post-review hardening (PR #121 follow-up):
 * - H3: tbd doctor --fix repairs a layout/config tbd_format mismatch and
 *   surfaces the future-format upgrade message instead of attempting repair.
 * - H3: tbd doctor surfaces an IncompatibleFormatError config as a newer-tbd
 *   error instead of a generic "Invalid config file".
 * - H1: a read command on an f04+ repo with missing layout.yml regenerates the
 *   layout under the shared lock and never writes a direct .tbd/data-sync/ path.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, readFile, writeFile, access } from 'node:fs/promises';
import { tmpdir, platform } from 'node:os';
import { join } from 'node:path';

const execFileAsync = promisify(execFile);
const isWindows = platform() === 'win32';
const describeUnlessWindows = isWindows ? describe.skip : describe;
const tbdBin = join(__dirname, '..', 'dist', 'bin.mjs');

async function gitIn(dir: string, ...args: string[]): Promise<string> {
  const { stdout } = await execFileAsync('git', args, { cwd: dir });
  return stdout.trim();
}

function runTbd(cwd: string, args: string[]): { stdout: string; stderr: string; status: number } {
  const result = spawnSync('node', [tbdBin, ...args], {
    cwd,
    encoding: 'utf-8',
    env: { ...process.env, FORCE_COLOR: '0' },
  });
  return {
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    status: result.status ?? 1,
  };
}

/**
 * Async variant for tests that need real concurrent invocations (e.g. proving the
 * shared-lock contract under racing writers). `runTbd` uses `spawnSync` and would
 * serialize the two calls through the event loop, defeating the test.
 */
async function runTbdAsync(
  cwd: string,
  args: string[],
): Promise<{ stdout: string; stderr: string; status: number }> {
  try {
    const { stdout, stderr } = await execFileAsync('node', [tbdBin, ...args], {
      cwd,
      encoding: 'utf-8',
      env: { ...process.env, FORCE_COLOR: '0' },
    });
    return { stdout: stdout ?? '', stderr: stderr ?? '', status: 0 };
  } catch (error) {
    const err = error as { stdout?: string; stderr?: string; code?: number };
    return { stdout: err.stdout ?? '', stderr: err.stderr ?? '', status: err.code ?? 1 };
  }
}

async function setupRepo(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'tbd-layout-e2e-'));
  await gitIn(dir, 'init', '--initial-branch=main');
  await gitIn(dir, 'config', 'user.email', 'test@test.com');
  await gitIn(dir, 'config', 'user.name', 'Test');
  const init = runTbd(dir, ['init', '--prefix=test']);
  expect(init.status).toBe(0);
  // Create an issue so the shared worktree is fully populated.
  const create = runTbd(dir, ['create', 'Seed', '--type', 'task', '--json', '--no-sync']);
  expect(create.status).toBe(0);
  return dir;
}

async function exists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

describeUnlessWindows('common-dir layout via CLI', { timeout: 30000 }, () => {
  let dir: string;

  beforeEach(async () => {
    dir = await setupRepo();
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  describe('doctor --fix (H3)', () => {
    it('repairs a layout/config tbd_format mismatch under the shared lock', async () => {
      const layoutPath = join(dir, '.git', 'tbd', 'layout.yml');
      const original = await readFile(layoutPath, 'utf-8');
      expect(original).toContain('tbd_format: f05');

      // Simulate a partial migration / manual edit by downgrading the layout.
      await writeFile(layoutPath, original.replace('tbd_format: f05', 'tbd_format: f03'));

      // Plain doctor reports it as fixable. The mismatch is a ✗ finding so the
      // exit is 1 (per tbd-r7rt).
      const diagnose = runTbd(dir, ['doctor']);
      expect(diagnose.status).toBe(1);
      expect(diagnose.stdout + diagnose.stderr).toMatch(/Common-dir layout/i);
      expect(diagnose.stdout + diagnose.stderr).toMatch(/mismatched|doctor --fix/i);

      // doctor --fix rewrites layout.yml from config; resulting state is clean.
      const fix = runTbd(dir, ['doctor', '--fix']);
      expect(fix.status).toBe(0);
      const repaired = await readFile(layoutPath, 'utf-8');
      expect(repaired).toContain('tbd_format: f05');
    });

    it('surfaces future-format layout as needing a newer tbd (no fix attempted)', async () => {
      const layoutPath = join(dir, '.git', 'tbd', 'layout.yml');
      const original = await readFile(layoutPath, 'utf-8');
      await writeFile(layoutPath, original.replace('tbd_format: f05', 'tbd_format: f99'));

      const fix = runTbd(dir, ['doctor', '--fix']);
      // Future-format markers are ✗ findings: scripts/CI must see exit 1 (tbd-r7rt).
      expect(fix.status).toBe(1);
      const out = fix.stdout + fix.stderr;
      expect(out).toMatch(/newer tbd|f99/i);
      // Layout was not silently rewritten back to f05.
      const layout = await readFile(layoutPath, 'utf-8');
      expect(layout).toContain('tbd_format: f99');
    });

    it('surfaces future-format config as a newer-tbd error in checkConfig', async () => {
      const configPath = join(dir, '.tbd', 'config.yml');
      const original = await readFile(configPath, 'utf-8');
      await writeFile(configPath, original.replace('tbd_format: f05', 'tbd_format: f99'));

      const out = runTbd(dir, ['doctor']);
      // Future-format config is a ✗ finding: exit 1 (tbd-r7rt).
      expect(out.status).toBe(1);
      const combined = out.stdout + out.stderr;
      // checkConfig must distinguish IncompatibleFormatError from generic parse errors.
      expect(combined).toMatch(/newer tbd|f99/i);
      expect(combined).not.toMatch(/Invalid config file/i);
    });
  });

  describe('doctor --fix initializes missing worktree (tbd-nrvj)', () => {
    it('migrates from missing to valid via doctor --fix instead of forcing the user to discover tbd sync', async () => {
      const worktreePath = join(dir, '.git', 'tbd', 'data-sync-worktree');
      const layoutPath = join(dir, '.git', 'tbd', 'layout.yml');

      // Simulate a checkout where the worktree was never created or has been deleted.
      // Git's worktree registry still tracks it (the prunable case) — pruning takes it
      // back to the missing case which is what fresh f03→f04 transitions look like.
      await rm(worktreePath, { recursive: true, force: true });
      await rm(layoutPath, { force: true });
      await gitIn(dir, 'worktree', 'prune');

      // Without --fix, doctor must not report this as a hard error — it is a fresh
      // state that will resolve on the next mutating command.
      const before = runTbd(dir, ['doctor']);
      expect(before.status).toBe(0);
      expect(before.stdout + before.stderr).toMatch(/not created yet|not initialized/i);

      // With --fix the user is asking us to repair things now. We must initialize the
      // shared worktree and layout instead of saying "ok, run sync later".
      const fix = runTbd(dir, ['doctor', '--fix']);
      expect(fix.status).toBe(0);
      expect(await exists(worktreePath)).toBe(true);
      expect(await exists(layoutPath)).toBe(true);
      const layout = await readFile(layoutPath, 'utf-8');
      expect(layout).toContain('tbd_format: f05');
    });

    it('serializes concurrent doctor --fix init under the shared data-sync lock (tbd-p6zo)', async () => {
      const worktreePath = join(dir, '.git', 'tbd', 'data-sync-worktree');
      const layoutPath = join(dir, '.git', 'tbd', 'layout.yml');

      // Reset to the missing-worktree state on disk and in the git registry, exactly
      // as the f03 → f04 transition looks before the first command runs.
      await rm(worktreePath, { recursive: true, force: true });
      await rm(layoutPath, { force: true });
      await gitIn(dir, 'worktree', 'prune');

      // Two concurrent doctor --fix invocations against the same repo race the
      // init/migrate/repair path. Without withSharedDataSyncLock around
      // prepareDataSyncContext, the second runner can clobber the first writer's
      // half-written shared layout (or its worktree registry mutation) and either
      // process can fail. With the lock, the second runner waits on the lockfile,
      // then re-probes inside the lock and either no-ops (ready) or finishes the
      // init/migrate work cleanly. Both processes must exit 0 and the repo state
      // must be exactly one shared worktree + one valid layout.
      //
      // runTbdAsync (vs runTbd) is required here: spawnSync blocks the event loop
      // and would serialize the two calls, defeating the regression test.
      const [first, second] = await Promise.all([
        runTbdAsync(dir, ['doctor', '--fix']),
        runTbdAsync(dir, ['doctor', '--fix']),
      ]);
      expect(first.status).toBe(0);
      expect(second.status).toBe(0);
      expect(await exists(worktreePath)).toBe(true);
      expect(await exists(layoutPath)).toBe(true);
      const layout = await readFile(layoutPath, 'utf-8');
      expect(layout).toContain('tbd_format: f05');

      const worktreeList = await gitIn(dir, 'worktree', 'list', '--porcelain');
      const sharedWorktreeLines = worktreeList
        .split('\n')
        .filter((line) => line.startsWith('worktree ') && line.includes('data-sync-worktree'));
      expect(sharedWorktreeLines).toHaveLength(1);
    });
  });

  describe('sibling-checkout config bump notice (tbd-afjh)', () => {
    it('prints a one-time stderr notice when this checkout migrates .tbd/config.yml to a newer tbd_format', async () => {
      const configPath = join(dir, '.tbd', 'config.yml');
      const original = await readFile(configPath, 'utf-8');
      // The setup is f05; "downgrade" the on-disk format marker so the next mutating
      // command sees a stale per-checkout config and migrates it back in place. This
      // matches a real sibling worktree on a branch that did not yet pick up the
      // main checkout's f03 → f04 commit.
      await writeFile(configPath, original.replace('tbd_format: f05', 'tbd_format: f03'));

      const create = runTbd(dir, ['create', 'sibling-bump probe', '--type', 'task', '--no-sync']);
      expect(create.status).toBe(0);
      // The notice goes to stderr so it cannot pollute JSON output on stdout.
      expect(create.stderr).toContain('tbd_format');
      expect(create.stderr).toContain('→ f05');
      expect(create.stderr).toMatch(/commit on this branch or merge main/i);
      // The on-disk config is now at f05 — the migration ran.
      const after = await readFile(configPath, 'utf-8');
      expect(after).toContain('tbd_format: f05');

      // Second mutating call must NOT re-emit the notice: nothing left to migrate.
      const second = runTbd(dir, ['create', 'sibling-bump probe 2', '--type', 'task', '--no-sync']);
      expect(second.status).toBe(0);
      expect(second.stderr).not.toContain('tbd_format');
    });
  });

  describe('f04 → f05 upgrade (forkable-docs gate)', () => {
    it('upgrades config and layout in place; the loop is revertible and repeatable', async () => {
      const configPath = join(dir, '.tbd', 'config.yml');
      const layoutPath = join(dir, '.git', 'tbd', 'layout.yml');

      const migrateOnceFromF04 = async (round: number) => {
        // Rewind both files to the genuine pre-upgrade state — exactly what
        // reverting the config bump commit + downgrading (or deleting) the
        // machine-local layout looks like.
        await writeFile(
          configPath,
          (await readFile(configPath, 'utf-8')).replace('tbd_format: f05', 'tbd_format: f04'),
        );
        await writeFile(
          layoutPath,
          (await readFile(layoutPath, 'utf-8')).replace('tbd_format: f05', 'tbd_format: f04'),
        );

        // A plain data command must succeed (NOT fail with a layout/config
        // mismatch), migrate the config, re-stamp the layout, and emit the
        // one-time migration notice.
        const create = runTbd(dir, [
          'create',
          `upgrade probe ${round}`,
          '--type',
          'task',
          '--no-sync',
        ]);
        expect(create.status).toBe(0);
        expect(create.stderr).toContain('f04 → f05');
        expect(await readFile(configPath, 'utf-8')).toContain('tbd_format: f05');
        expect(await readFile(layoutPath, 'utf-8')).toContain('tbd_format: f05');
      };

      await migrateOnceFromF04(1);
      // Revert and repeat: migrating from the restored f04 state is idempotent.
      await migrateOnceFromF04(2);

      // Steady state afterwards: no further migration notices.
      const steady = runTbd(dir, ['create', 'steady probe', '--type', 'task', '--no-sync']);
      expect(steady.status).toBe(0);
      expect(steady.stderr).not.toContain('tbd_format');
    });

    it('read commands upgrade an older layout under the lock, preserving created_at', async () => {
      // Config already f05 (e.g. a teammate committed the bump) but this
      // machine's layout is still f04: a read must auto-upgrade, not error.
      const layoutPath = join(dir, '.git', 'tbd', 'layout.yml');
      const before = await readFile(layoutPath, 'utf-8');
      const createdAt = before.split('\n').find((l) => l.startsWith('created_at:'));
      await writeFile(layoutPath, before.replace('tbd_format: f05', 'tbd_format: f04'));

      const list = runTbd(dir, ['list', '--json']);
      expect(list.status).toBe(0);
      const after = await readFile(layoutPath, 'utf-8');
      expect(after).toContain('tbd_format: f05');
      expect(after).toContain(createdAt);
    });
  });

  describe('read fast-path (H1)', () => {
    it('regenerates a missing layout.yml on first read without writing direct data path', async () => {
      const layoutPath = join(dir, '.git', 'tbd', 'layout.yml');
      const sharedDataSync = join(
        dir,
        '.git',
        'tbd',
        'data-sync-worktree',
        '.tbd',
        'data-sync',
        'issues',
      );
      const directDataSync = join(dir, '.tbd', 'data-sync', 'issues');

      // Simulate a checkout where layout.yml has not been initialized yet.
      await rm(layoutPath);
      expect(await exists(layoutPath)).toBe(false);

      // A read command must regenerate layout.yml under the shared lock.
      const list = runTbd(dir, ['list', '--json']);
      expect(list.status).toBe(0);
      expect(await exists(layoutPath)).toBe(true);
      const layout = await readFile(layoutPath, 'utf-8');
      expect(layout).toContain('tbd_format: f05');

      // No direct .tbd/data-sync/ leakage: f04+ must fail closed, not fall back.
      expect(await exists(sharedDataSync)).toBe(true);
      expect(await exists(directDataSync)).toBe(false);
    });
  });
});
