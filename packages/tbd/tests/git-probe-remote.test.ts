/**
 * Unit/integration tests for probeRemoteBranch tri-state.
 *
 * Distinguishes:
 *  - 'present'      ls-remote finds the ref
 *  - 'absent'       remote reachable, ref missing (ls-remote --exit-code => 2)
 *  - 'check-failed' remote unreachable / auth / transient (any other failure)
 *
 * The 'check-failed' case MUST NOT collapse to 'absent', so orphan-creating
 * callers never create a divergent local branch on a flaky check.
 *
 * See: tbd-ptj3 (plan-2026-05-29-tbd-sync-unrelated-history-hardening.md)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, rm, writeFile as fsWriteFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir, platform } from 'node:os';
import { randomBytes } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { probeRemoteBranch, remoteBranchExists } from '../src/file/git.js';

const execFileAsync = promisify(execFile);
const isWindows = platform() === 'win32';
const describeUnlessWindows = isWindows ? describe.skip : describe;

async function gitInDir(dir: string, ...args: string[]): Promise<string> {
  const { stdout } = await execFileAsync('git', args, { cwd: dir });
  return stdout.trim();
}

describeUnlessWindows('probeRemoteBranch', () => {
  let testDir: string;
  let barePath: string;
  let workPath: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `tbd-probe-test-${randomBytes(4).toString('hex')}`);
    barePath = join(testDir, 'remote.git');
    workPath = join(testDir, 'work');
    await mkdir(barePath, { recursive: true });
    await execFileAsync('git', ['init', '--bare', barePath]);
    await mkdir(workPath, { recursive: true });
    await gitInDir(workPath, 'init', '-b', 'main');
    await gitInDir(workPath, 'config', 'user.email', 'test@test.com');
    await gitInDir(workPath, 'config', 'user.name', 'Test User');
    await gitInDir(workPath, 'config', 'commit.gpgsign', 'false');
    await gitInDir(workPath, 'remote', 'add', 'origin', barePath);
    await fsWriteFile(join(workPath, 'README.md'), '# t\n');
    await gitInDir(workPath, 'add', 'README.md');
    await gitInDir(workPath, 'commit', '-m', 'init');
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true }).catch(() => undefined);
  });

  it("returns 'absent' when the remote is reachable but the branch is missing", async () => {
    const probe = await probeRemoteBranch('origin', 'tbd-sync', workPath);
    expect(probe).toBe('absent');
  });

  it("returns 'present' when the branch exists on the remote", async () => {
    await gitInDir(workPath, 'push', 'origin', 'HEAD:refs/heads/tbd-sync');
    const probe = await probeRemoteBranch('origin', 'tbd-sync', workPath);
    expect(probe).toBe('present');
  });

  it("returns 'check-failed' when the remote is unreachable (not 'absent')", async () => {
    const bogus = join(testDir, 'does-not-exist.git');
    const probe = await probeRemoteBranch(bogus, 'tbd-sync', workPath);
    expect(probe).toBe('check-failed');
  });

  it('remoteBranchExists wrapper stays fail-closed (present => true, else false)', async () => {
    expect(await remoteBranchExists('origin', 'tbd-sync', workPath)).toBe(false);
    await gitInDir(workPath, 'push', 'origin', 'HEAD:refs/heads/tbd-sync');
    expect(await remoteBranchExists('origin', 'tbd-sync', workPath)).toBe(true);
    // Unreachable remote must NOT read as "exists".
    const bogus = join(testDir, 'nope.git');
    expect(await remoteBranchExists(bogus, 'tbd-sync', workPath)).toBe(false);
  });
});
