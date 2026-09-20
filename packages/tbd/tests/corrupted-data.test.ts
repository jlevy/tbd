/**
 * Integration tests for corrupted data scenarios.
 *
 * These tests verify that tbd provides helpful error messages when
 * data files are corrupted, particularly from unresolved merge conflicts.
 *
 * See: error-handling-rules.md Anti-Pattern 9
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { ISSUE_TITLE_MAX_LENGTH } from '../src/lib/schemas.js';
import { subprocessTestTimeout, TEST_ULIDS, testId } from './test-helpers.js';

describe('corrupted data scenarios', { timeout: subprocessTestTimeout() }, () => {
  let tempDir: string;
  const tbdBin = join(__dirname, '..', 'dist', 'bin.mjs');

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'tbd-corrupted-data-test-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  interface CommandResult {
    stdout: string;
    stderr: string;
    status: number;
  }

  // Vitest cannot interrupt spawnSync, so bound the subprocess itself as well.
  function runCommand(
    command: string,
    args: string[],
    cwd = tempDir,
    timeout = subprocessTestTimeout(),
  ): CommandResult {
    const result = spawnSync(command, args, {
      cwd,
      encoding: 'utf-8',
      env: { ...process.env, FORCE_COLOR: '0' },
      timeout,
      killSignal: 'SIGKILL',
    });
    if (result.error || result.signal) {
      throw new Error(
        `${command} ${args.join(' ')}: status=${result.status}, signal=${result.signal}, ` +
          `error=${result.error?.message ?? 'none'}\n` +
          `stdout:\n${result.stdout ?? ''}\nstderr:\n${result.stderr ?? ''}`,
      );
    }
    return {
      stdout: result.stdout || '',
      stderr: result.stderr || '',
      status: result.status ?? 1,
    };
  }

  function requireSuccess(command: string, result: CommandResult): CommandResult {
    if (result.status !== 0) {
      throw new Error(
        `${command}: status=${result.status}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
      );
    }
    return result;
  }

  function runTbd(args: string[], cwd = tempDir): CommandResult {
    return runCommand(process.execPath, [tbdBin, ...args], cwd);
  }

  function runGit(args: string[]): string {
    return requireSuccess(`git ${args.join(' ')}`, runCommand('git', args)).stdout.trim();
  }

  /**
   * Initialize git repo and tbd in temp directory.
   *
   * Disables commit signing so the test is hermetic against any global git
   * config (e.g., remote-execution containers that wire commit.gpgsign to a
   * signing server). Without this, `tbd init`'s initial worktree commit can
   * silently fail and leave the worktree HEAD unresolved, which makes the
   * doctor's Worktree health check fire spuriously.
   */
  function initGitAndTbd(initializeTbd = runTbd): void {
    runGit(['init', '--initial-branch=main']);
    runGit(['config', 'user.email', 'test@example.com']);
    runGit(['config', 'user.name', 'Test']);
    runGit(['config', 'commit.gpgsign', 'false']);
    runGit(['config', 'tag.gpgsign', 'false']);
    requireSuccess('tbd init', initializeTbd(['init', '--prefix=test']));
  }

  it('stops at a failed fixture initialization and reports its output', () => {
    const failedInit = () => ({
      status: 1,
      stdout: 'initialization started',
      stderr: 'injected initialization failure',
    });
    expect(() => {
      initGitAndTbd(failedInit);
    }).toThrow(
      /tbd init.*status=1[\s\S]*initialization started[\s\S]*injected initialization failure/u,
    );
  });

  it('terminates a hung subprocess and reports its status and output', () => {
    expect(() =>
      runCommand(
        process.execPath,
        ['-e', 'process.stdout.write("waiting"); setInterval(() => {}, 1000)'],
        tempDir,
        // Deliberately exercise the timeout, without the Windows integration-test floor.
        1000,
      ),
    ).toThrow(/status=.*signal=.*error=.*ETIMEDOUT[\s\S]*stdout:[\s\S]*stderr:/u);
  });

  function sharedDataSyncDir(): string {
    const gitCommonDir = runGit(['rev-parse', '--path-format=absolute', '--git-common-dir']);
    return join(gitCommonDir, 'tbd', 'data-sync-worktree', '.tbd', 'data-sync');
  }

  describe('ids.yml with merge conflict markers', () => {
    it('provides helpful error message when ids.yml has conflict markers', async () => {
      initGitAndTbd();

      // Create a valid issue first
      requireSuccess('tbd create', runTbd(['create', 'Test issue', '--type=task']));

      // Now corrupt the ids.yml file with merge conflict markers
      const idsPath = join(sharedDataSyncDir(), 'mappings', 'ids.yml');
      await writeFile(
        idsPath,
        `<<<<<<< HEAD
a1b2: 01hx5zzkbkactav9wevgemmvrz
=======
c3d4: 01hx5zzkbkbctav9wevgemmvrw
>>>>>>> origin/tbd-sync
`,
      );

      // Try to list issues - should fail with helpful error
      const listResult = runTbd(['list']);

      expect(listResult.status).toBe(1);
      expect(listResult.stderr).toContain('merge conflict');
    });

    it('shows stack trace in debug mode', async () => {
      initGitAndTbd();

      // Create a valid issue first
      requireSuccess('tbd create', runTbd(['create', 'Test issue', '--type=task']));

      // Corrupt ids.yml
      const idsPath = join(sharedDataSyncDir(), 'mappings', 'ids.yml');
      await writeFile(idsPath, '<<<<<<< HEAD\na1b2: 01hx5zzkbkactav9wevgemmvrz\n');

      // Run with --debug flag
      const listResult = runTbd(['list', '--debug']);

      expect(listResult.status).toBe(1);
      expect(listResult.stderr).toContain('Stack trace:');
    });
  });

  describe('invalid YAML syntax', () => {
    it('shows parse error details, not generic message', async () => {
      initGitAndTbd();

      // Create a valid issue first
      requireSuccess('tbd create', runTbd(['create', 'Test issue', '--type=task']));

      // Corrupt ids.yml with invalid YAML
      const idsPath = join(sharedDataSyncDir(), 'mappings', 'ids.yml');
      await writeFile(idsPath, 'this: is: not: valid: yaml:');

      const listResult = runTbd(['list']);

      expect(listResult.status).toBe(1);
      // Should show actual YAML error, not "Failed to read issues"
      expect(listResult.stderr).not.toContain('Failed to read issues');
    });
  });

  describe('invalid issue files', () => {
    it('skips invalid issue files and reports them in doctor', async () => {
      initGitAndTbd();

      requireSuccess('tbd create', runTbd(['create', 'Valid issue', '--type=task']));

      const invalidId = testId(TEST_ULIDS.DOCTOR_4);
      const issuePath = join(sharedDataSyncDir(), 'issues', `${invalidId}.md`);
      await writeFile(
        issuePath,
        `---
type: is
id: ${invalidId}
title: ${'x'.repeat(ISSUE_TITLE_MAX_LENGTH + 1)}
kind: task
status: open
priority: 2
version: 1
created_at: 2025-01-01T00:00:00Z
updated_at: 2025-01-01T00:00:00Z
labels: []
dependencies: []
---
`,
      );

      const listResult = runTbd(['list']);
      expect(listResult.status).toBe(0);
      expect(listResult.stdout).toContain('Valid issue');
      expect(listResult.stderr).toContain(`Skipping invalid issue file: ${invalidId}.md: title:`);

      const doctorResult = runTbd(['doctor']);
      // ✗ Issue validity is a hard error: invalid on-disk data scripts/CI should
      // notice. Doctor exits 1 (per tbd-r7rt).
      expect(doctorResult.status).toBe(1);
      expect(doctorResult.stderr).toContain('Issues found that may require manual intervention.');
      expect(doctorResult.stderr).not.toContain('Skipping invalid issue file');
      expect(doctorResult.stdout).toMatch(
        /✗ Issue validity - 1 invalid issue file\(s\) \(\.tbd[\\/]issues\)/,
      );
      expect(doctorResult.stdout).toContain(`${invalidId}.md: title:`);
    });
  });
});
