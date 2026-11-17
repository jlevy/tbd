/**
 * Tests for CLI exit codes.
 *
 * Verifies that errors from commands properly propagate non-zero exit codes.
 * This is a regression test for tbd-wyy6: "Exit codes return 0 on errors".
 *
 * The fix ensures that commands throw CLIError subclasses instead of calling
 * `this.output.error()` and returning, which would exit with code 0.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomBytes } from 'node:crypto';

import {
  CLIError,
  NotFoundError,
  ValidationError,
  NotInitializedError,
  SyncError,
} from '../src/cli/lib/errors.js';
import { runCli } from '../src/cli/cli.js';
import {
  EXIT_INTERRUPTED,
  EXIT_NO_MATCHING_CHANGE,
  EXIT_OPERATIONAL_ERROR,
  EXIT_SUCCESS,
  EXIT_USAGE_ERROR,
} from '../src/cli/lib/exit-codes.js';

const originalArgv = process.argv;
const originalExitCode = process.exitCode;

/**
 * Helper to run CLI with specific arguments.
 */
async function runCliWithArgs(args: string[]): Promise<void> {
  process.argv = args;
  return runCli();
}

describe('exit codes', () => {
  let testDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    originalCwd = process.cwd();
    testDir = join(tmpdir(), `tbd-exit-test-${randomBytes(4).toString('hex')}`);
    await mkdir(testDir, { recursive: true });
    process.chdir(testDir);
    process.exitCode = undefined;
  });

  afterEach(async () => {
    process.exitCode = originalExitCode;
    process.argv = originalArgv;
    process.chdir(originalCwd);
    await rm(testDir, { recursive: true, force: true });
  });

  describe('error class exit codes', () => {
    it('defines every stable CLI exit code in the shared module', () => {
      expect({
        EXIT_SUCCESS,
        EXIT_OPERATIONAL_ERROR,
        EXIT_USAGE_ERROR,
        EXIT_NO_MATCHING_CHANGE,
        EXIT_INTERRUPTED,
      }).toEqual({
        EXIT_SUCCESS: 0,
        EXIT_OPERATIONAL_ERROR: 1,
        EXIT_USAGE_ERROR: 2,
        EXIT_NO_MATCHING_CHANGE: 3,
        EXIT_INTERRUPTED: 130,
      });
    });

    it('CLIError has exit code 1 by default', () => {
      const error = new CLIError('test');
      expect(error.exitCode).toBe(EXIT_OPERATIONAL_ERROR);
    });

    it('CLIError accepts custom exit code', () => {
      const error = new CLIError('test', 42);
      expect(error.exitCode).toBe(42);
    });

    it('NotFoundError has exit code 1', () => {
      const error = new NotFoundError('Issue', 'test-id');
      expect(error.exitCode).toBe(1);
      expect(error.message).toBe('Issue not found: test-id');
    });

    it('ValidationError has exit code 2', () => {
      const error = new ValidationError('Invalid input');
      expect(error.exitCode).toBe(EXIT_USAGE_ERROR);
    });

    it('NotInitializedError has exit code 1', () => {
      const error = new NotInitializedError();
      expect(error.exitCode).toBe(1);
    });

    it('SyncError has exit code 1', () => {
      const error = new SyncError('Sync failed');
      expect(error.exitCode).toBe(1);
    });

    it('all error types are instances of CLIError', () => {
      expect(new NotFoundError('X', 'y')).toBeInstanceOf(CLIError);
      expect(new ValidationError('x')).toBeInstanceOf(CLIError);
      expect(new NotInitializedError()).toBeInstanceOf(CLIError);
      expect(new SyncError('x')).toBeInstanceOf(CLIError);
    });
  });

  describe('integration: NotInitializedError', () => {
    it('returns exit code 1 when not initialized', async () => {
      // No .tbd directory - should trigger NotInitializedError
      await runCliWithArgs(['node', 'tbd', 'list']);

      expect(process.exitCode).toBe(1);
    });

    it('returns exit code 1 for show in uninitialized repo', async () => {
      await runCliWithArgs(['node', 'tbd', 'show', 'test-123']);

      expect(process.exitCode).toBe(1);
    });
  });

  describe('integration: NotFoundError', () => {
    it('returns exit code 1 for issue not found', async () => {
      // Initialize a minimal tbd repo
      await mkdir(join(testDir, '.tbd'), { recursive: true });
      await writeFile(
        join(testDir, '.tbd', 'config.yml'),
        'tbd_version: "1"\nsync:\n  branch: tbd-sync\n  remote: origin\ndisplay:\n  id_prefix: tbd\nsettings:\n  auto_sync: false\n',
      );
      await mkdir(join(testDir, '.tbd', 'data-sync-worktree', '.tbd', 'data-sync', 'issues'), {
        recursive: true,
      });
      // Create empty id-mapping.yml
      await writeFile(
        join(testDir, '.tbd', 'data-sync-worktree', '.tbd', 'data-sync', 'id-mapping.yml'),
        'short_to_ulid: {}\nulid_to_short: {}\n',
      );

      await runCliWithArgs(['node', 'tbd', 'show', 'nonexistent-id']);

      expect(process.exitCode).toBe(1);
    });
  });
});
