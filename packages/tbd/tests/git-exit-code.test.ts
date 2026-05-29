/**
 * Unit tests for the git() wrapper carrying a structured exit code.
 *
 * Callers that must distinguish git exit statuses (e.g. probeRemoteBranch
 * telling "branch absent" (ls-remote --exit-code => 2) from a connection
 * failure, or checkRemoteBranchHealth telling "unrelated histories"
 * (merge-base => 1) from a transient error) need the exit code without
 * string-matching stderr.
 *
 * See: tbd-as47 (plan-2026-05-29-tbd-sync-unrelated-history-hardening.md)
 */

import { describe, it, expect } from 'vitest';

import { git, GitError, exitCodeOf } from '../src/file/git.js';

describe('git() exit code propagation', () => {
  it('throws a GitError carrying a numeric exitCode when a command fails', async () => {
    // `git rev-parse --verify <bogus>` exits 128 with no resolvable ref.
    await expect(git('rev-parse', '--verify', 'refs/heads/tbd-bogus-ref-xyz')).rejects.toThrow(
      GitError,
    );

    let captured: unknown;
    try {
      await git('rev-parse', '--verify', 'refs/heads/tbd-bogus-ref-xyz');
    } catch (err) {
      captured = err;
    }

    expect(captured).toBeInstanceOf(GitError);
    const gitErr = captured as GitError;
    expect(typeof gitErr.exitCode).toBe('number');
    expect(gitErr.exitCode).toBeGreaterThan(0);
    // The original stderr/message is preserved so message-based classifiers
    // (classifySyncError) keep working.
    expect(gitErr.message.length).toBeGreaterThan(0);
    expect(gitErr.args).toContain('rev-parse');
  });

  it('exitCodeOf reads the exit code from a GitError', async () => {
    let captured: unknown;
    try {
      await git('rev-parse', '--verify', 'refs/heads/tbd-bogus-ref-xyz');
    } catch (err) {
      captured = err;
    }
    expect(exitCodeOf(captured)).toBe((captured as GitError).exitCode);
    expect(typeof exitCodeOf(captured)).toBe('number');
  });

  it('exitCodeOf returns null for a plain Error', () => {
    expect(exitCodeOf(new Error('not a git error'))).toBeNull();
    expect(exitCodeOf(undefined)).toBeNull();
    expect(exitCodeOf('string error')).toBeNull();
  });

  it('git() still returns trimmed stdout on success', async () => {
    const out = await git('rev-parse', '--is-inside-work-tree');
    expect(out).toBe('true');
  });
});
