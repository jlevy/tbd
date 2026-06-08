/**
 * End-to-end coverage for the "Shared lock writability" doctor check (issue #164).
 *
 * The failing (EPERM) path is not reproducible as root, so this asserts the
 * happy path: a normal repo reports the lock as writable and the check takes its
 * place in the full health-check list (doctor does not abort).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { spawnSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir, platform } from 'node:os';
import { join } from 'node:path';

const execFileAsync = promisify(execFile);
const isWindows = platform() === 'win32';
const describeUnlessWindows = isWindows ? describe.skip : describe;
const tbdBin = join(__dirname, '..', 'dist', 'bin.mjs');

async function gitIn(dir: string, ...args: string[]): Promise<void> {
  await execFileAsync('git', args, { cwd: dir });
}

function runTbd(cwd: string, args: string[]): { stdout: string; stderr: string; status: number } {
  const result = spawnSync('node', [tbdBin, ...args], {
    cwd,
    encoding: 'utf-8',
    env: { ...process.env, FORCE_COLOR: '0' },
  });
  return { stdout: result.stdout || '', stderr: result.stderr || '', status: result.status ?? 1 };
}

interface DoctorJson {
  healthy: boolean;
  healthChecks: { name: string; status: string }[];
}

describeUnlessWindows('doctor shared lock writability (e2e)', { timeout: 30000 }, () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'tbd-lockwrite-e2e-'));
    await gitIn(dir, 'init', '--initial-branch=main');
    await gitIn(dir, 'config', 'user.email', 'test@test.com');
    await gitIn(dir, 'config', 'user.name', 'Test');
    expect(runTbd(dir, ['init', '--prefix=test']).status).toBe(0);
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('reports the lock as writable in a normal repo and keeps the full check list', () => {
    const result = runTbd(dir, ['doctor', '--json']);
    expect(result.status).toBe(0);

    const report = JSON.parse(result.stdout) as DoctorJson;
    const names = report.healthChecks.map((c) => c.name);

    const lockCheck = report.healthChecks.find((c) => c.name === 'Shared lock writability');
    expect(lockCheck, `lock check missing; got: ${names.join(', ')}`).toBeDefined();
    expect(lockCheck?.status).toBe('ok');

    // The new check does not displace existing ones — doctor lists the whole set
    // and no core health check errors in a clean repo.
    expect(names).toContain('Worktree');
    expect(names).toContain('Common-dir layout');
    expect(report.healthChecks.filter((c) => c.status === 'error')).toEqual([]);
  });
});
