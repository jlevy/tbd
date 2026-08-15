/**
 * The sync-branch push must not run the parent repository's `pre-push` hook.
 *
 * tbd already passes `--no-verify` on its sync-branch COMMITS, deliberately, so
 * bead bookkeeping never triggers lefthook/husky. The push has to make the same
 * promise: the branch carries no source code, so a repository whose `pre-push`
 * runs a test suite would otherwise pay for it on every sync — and again on
 * each non-fast-forward retry.
 *
 * The hook here exits non-zero unconditionally, so a push that runs hooks
 * fails and a push that skips them succeeds. That makes the assertion about
 * behavior rather than about argument strings.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { chmod, mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir, platform } from 'node:os';
import { randomBytes } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { pushWithRetry } from '../src/file/git.js';

const execFileAsync = promisify(execFile);
const describeUnlessWindows = platform() === 'win32' ? describe.skip : describe;

const SYNC_BRANCH = 'tbd-sync';

async function git(dir: string, ...args: string[]): Promise<string> {
  const { stdout } = await execFileAsync('git', args, {
    cwd: dir,
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
  });
  return stdout.trim();
}

describeUnlessWindows('sync-branch push and parent-repo hooks', () => {
  let root: string;
  let repo: string;
  let remote: string;

  beforeEach(async () => {
    root = join(tmpdir(), `tbd-push-hooks-${randomBytes(6).toString('hex')}`);
    repo = join(root, 'repo');
    remote = join(root, 'remote.git');

    await mkdir(remote, { recursive: true });
    await git(remote, 'init', '--bare');

    await mkdir(repo, { recursive: true });
    await git(repo, 'init', '-b', SYNC_BRANCH);
    await git(repo, 'config', 'user.email', 'test@test.com');
    await git(repo, 'config', 'user.name', 'Test User');
    await git(repo, 'config', 'commit.gpgsign', 'false');
    await git(repo, 'remote', 'add', 'origin', remote);
    await writeFile(join(repo, 'issue.md'), '# a bead\n');
    await git(repo, 'add', '-A');
    await git(repo, 'commit', '--no-verify', '-m', 'seed');

    // A parent-repo pre-push gate that always refuses, standing in for a
    // lefthook/husky hook that runs a test suite.
    const hook = join(repo, '.git', 'hooks', 'pre-push');
    await writeFile(hook, '#!/bin/sh\necho "pre-push gate ran" >&2\nexit 1\n');
    await chmod(hook, 0o755);
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('pushes the sync branch even when pre-push would reject it', async () => {
    const result = await pushWithRetry(SYNC_BRANCH, 'origin', () => Promise.resolve([]), repo);

    expect(result.error).toBeUndefined();
    expect(result.success).toBe(true);
    // The remote really received it, so this is not a false positive from a
    // push that silently did nothing.
    expect(await git(remote, 'rev-parse', SYNC_BRANCH)).toBe(
      await git(repo, 'rev-parse', SYNC_BRANCH),
    );
  });

  it('the same push fails when hooks are honored, proving the hook is live', async () => {
    // Guards the guard: if this repository's hook were inert, the test above
    // would pass no matter what pushWithRetry did.
    await expect(
      git(repo, 'push', 'origin', `refs/heads/${SYNC_BRANCH}:refs/heads/${SYNC_BRANCH}`),
    ).rejects.toThrow();
  });
});
