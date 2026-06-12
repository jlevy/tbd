/**
 * Product-level GIT_DIR isolation (tbd-tgwi, the product half of tbd-a1lc):
 * running the built tbd CLI inside a git-hook-like environment — ambient
 * GIT_DIR/GIT_WORK_TREE pointing at a DIFFERENT repository — must operate on
 * the repository containing cwd, warn once that the ambient value is ignored,
 * and leave the other repository completely untouched.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync, spawnSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const tbdBin = join(__dirname, '..', 'dist', 'bin.mjs');

function initRepo(dir: string, prefix: string): void {
  execSync('git init --initial-branch=main', { cwd: dir });
  execSync('git config user.email "t@t.t"', { cwd: dir });
  execSync('git config user.name "T"', { cwd: dir });
  execSync('git config commit.gpgsign false', { cwd: dir });
  const init = spawnSync('node', [tbdBin, 'init', `--prefix=${prefix}`], {
    cwd: dir,
    encoding: 'utf-8',
    env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' },
    timeout: 60000,
  });
  if (init.status !== 0) throw new Error(`init failed: ${init.stderr}`);
}

function snapshotRefs(dir: string): string {
  return execSync('git for-each-ref', { cwd: dir, encoding: 'utf-8' });
}

describe('ambient GIT_DIR isolation (product)', { timeout: 120_000 }, () => {
  let workRepo: string;
  let victimRepo: string;

  beforeEach(async () => {
    workRepo = await mkdtemp(join(tmpdir(), 'tbd-gitenv-work-'));
    victimRepo = await mkdtemp(join(tmpdir(), 'tbd-gitenv-victim-'));
    initRepo(workRepo, 'wk');
    initRepo(victimRepo, 'vc');
    await writeFile(join(victimRepo, 'real.txt'), 'real\n');
    execSync('git add -A && git commit -m real', { cwd: victimRepo });
  });

  afterEach(async () => {
    await rm(workRepo, { recursive: true, force: true });
    await rm(victimRepo, { recursive: true, force: true });
  });

  function runTbdHostile(args: string[]): { stdout: string; stderr: string; status: number } {
    // The git-hook condition: absolute GIT_DIR (and work tree) name the OTHER repo.
    const result = spawnSync('node', [tbdBin, ...args], {
      cwd: workRepo,
      encoding: 'utf-8',
      env: {
        ...process.env,
        FORCE_COLOR: '0',
        NO_COLOR: '1',
        GIT_DIR: join(victimRepo, '.git'),
        GIT_WORK_TREE: victimRepo,
      },
      timeout: 60000,
    });
    return {
      stdout: result.stdout || '',
      stderr: result.stderr || '',
      status: result.status ?? 1,
    };
  }

  it('operates on the cwd repository, warns once, and never touches the GIT_DIR repo', async () => {
    const victimRefsBefore = snapshotRefs(victimRepo);
    const victimIds = await readFile(join(victimRepo, '.git', 'tbd', 'layout.yml'), 'utf-8').catch(
      () => null,
    );

    const create = runTbdHostile(['create', 'isolation probe issue', '--no-sync']);
    expect(create.status).toBe(0);
    expect(create.stderr).toContain('ignoring inherited GIT_DIR');
    // Warned once, not per git call.
    expect(create.stderr.match(/ignoring inherited GIT_DIR/g)).toHaveLength(1);

    // The issue landed in the cwd repo…
    const listWork = spawnSync('node', [tbdBin, 'list'], {
      cwd: workRepo,
      encoding: 'utf-8',
      env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' },
      timeout: 60000,
    });
    expect(listWork.stdout).toContain('isolation probe issue');

    // …and not in the GIT_DIR repo.
    const listVictim = spawnSync('node', [tbdBin, 'list'], {
      cwd: victimRepo,
      encoding: 'utf-8',
      env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' },
      timeout: 60000,
    });
    expect(listVictim.stdout).not.toContain('isolation probe issue');

    // The GIT_DIR repo is byte-identical: refs and shared tbd layout.
    expect(snapshotRefs(victimRepo)).toBe(victimRefsBefore);
    const victimIdsAfter = await readFile(
      join(victimRepo, '.git', 'tbd', 'layout.yml'),
      'utf-8',
    ).catch(() => null);
    expect(victimIdsAfter).toBe(victimIds);
  });

  it('status and docs commands resolve the cwd repository under ambient GIT_DIR', () => {
    const status = runTbdHostile(['status']);
    expect(status.status).toBe(0);
    expect(status.stdout).toContain('wk');

    const docs = runTbdHostile(['docs']);
    expect(docs.status).toBe(0);
    expect(docs.stdout).toContain('managed documentation');
  });
});
