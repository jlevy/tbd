/**
 * End-to-end tests for the shared common-dir layout lifecycle through the CLI.
 *
 * Covers post-review hardening (PR #121 follow-up):
 * - H3: tbd doctor --fix repairs a layout/config tbd_format mismatch and
 *   surfaces the future-format upgrade message instead of attempting repair.
 * - H3: tbd doctor surfaces an IncompatibleFormatError config as a newer-tbd
 *   error instead of a generic "Invalid config file".
 * - H1: a read command on an f04 repo with missing layout.yml regenerates the
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
      expect(original).toContain('tbd_format: f04');

      // Simulate a partial migration / manual edit by downgrading the layout.
      await writeFile(layoutPath, original.replace('tbd_format: f04', 'tbd_format: f03'));

      // Plain doctor reports it as fixable.
      const diagnose = runTbd(dir, ['doctor']);
      expect(diagnose.stdout + diagnose.stderr).toMatch(/Common-dir layout/i);
      expect(diagnose.stdout + diagnose.stderr).toMatch(/mismatched|doctor --fix/i);

      // doctor --fix rewrites layout.yml from config.
      const fix = runTbd(dir, ['doctor', '--fix']);
      expect(fix.status).toBe(0);
      const repaired = await readFile(layoutPath, 'utf-8');
      expect(repaired).toContain('tbd_format: f04');
    });

    it('surfaces future-format layout as needing a newer tbd (no fix attempted)', async () => {
      const layoutPath = join(dir, '.git', 'tbd', 'layout.yml');
      const original = await readFile(layoutPath, 'utf-8');
      await writeFile(layoutPath, original.replace('tbd_format: f04', 'tbd_format: f99'));

      const fix = runTbd(dir, ['doctor', '--fix']);
      const out = fix.stdout + fix.stderr;
      expect(out).toMatch(/newer tbd|f99/i);
      // Layout was not silently rewritten back to f04.
      const layout = await readFile(layoutPath, 'utf-8');
      expect(layout).toContain('tbd_format: f99');
    });

    it('surfaces future-format config as a newer-tbd error in checkConfig', async () => {
      const configPath = join(dir, '.tbd', 'config.yml');
      const original = await readFile(configPath, 'utf-8');
      await writeFile(configPath, original.replace('tbd_format: f04', 'tbd_format: f99'));

      const out = runTbd(dir, ['doctor']);
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
      expect(layout).toContain('tbd_format: f04');
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

      // Simulate an f04 checkout where layout.yml has not been initialized yet.
      await rm(layoutPath);
      expect(await exists(layoutPath)).toBe(false);

      // A read command must regenerate layout.yml under the shared lock.
      const list = runTbd(dir, ['list', '--json']);
      expect(list.status).toBe(0);
      expect(await exists(layoutPath)).toBe(true);
      const layout = await readFile(layoutPath, 'utf-8');
      expect(layout).toContain('tbd_format: f04');

      // No direct .tbd/data-sync/ leakage: f04 must fail closed, not fall back.
      expect(await exists(sharedDataSync)).toBe(true);
      expect(await exists(directDataSync)).toBe(false);
    });
  });
});
