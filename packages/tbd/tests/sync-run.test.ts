import { describe, expect, it, vi } from 'vitest';

import { runIssueSync } from '../src/file/sync-run.js';
import type { IssueSyncDependencies, IssueSyncTarget } from '../src/file/sync-run.js';
import type { OperationLogger } from '../src/lib/types.js';

const target: IssueSyncTarget = {
  worktreePath: '/repo/.git/tbd/data-sync-worktree',
  syncBranch: 'tbd-sync',
  remote: 'origin',
};

function harness(outputs: string[]): {
  dependencies: IssueSyncDependencies;
  logger: OperationLogger;
  git: ReturnType<typeof vi.fn>;
  attach: ReturnType<typeof vi.fn>;
} {
  const git = vi.fn((..._args: string[]) => Promise.resolve(outputs.shift() ?? ''));
  const boundedGit = vi.fn((..._args: unknown[]) => Promise.resolve(''));
  const attach = vi.fn(() => Promise.resolve());
  return {
    dependencies: {
      git,
      gitNoPromptWithTimeout: boundedGit,
      ensureWorktreeAttachedToBranch: attach,
    },
    logger: {
      progress: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    },
    git,
    attach,
  };
}

describe('runIssueSync pull mode', () => {
  it('reports an up-to-date remote without touching the worktree', async () => {
    const { dependencies, logger, git, attach } = harness(['', '0']);

    await expect(runIssueSync(target, { pull: true }, logger, dependencies)).resolves.toEqual({
      kind: 'up-to-date',
    });

    expect(git.mock.calls).toEqual([
      ['fetch', 'origin', 'tbd-sync'],
      ['rev-list', '--count', 'tbd-sync..origin/tbd-sync'],
    ]);
    expect(attach).not.toHaveBeenCalled();
    expect(logger.progress).toHaveBeenCalledWith('Pulling from remote...');
  });

  it('fast-forwards the shared worktree and returns the received commit count', async () => {
    const { dependencies, logger, git, attach } = harness(['', '3', '']);

    await expect(runIssueSync(target, { pull: true }, logger, dependencies)).resolves.toEqual({
      kind: 'pulled',
      commits: 3,
    });

    expect(attach).toHaveBeenCalledWith(target.worktreePath, target.syncBranch);
    expect(git.mock.calls.at(-1)).toEqual([
      '-C',
      target.worktreePath,
      'merge',
      '--ff-only',
      'origin/tbd-sync',
    ]);
    expect(logger.debug).toHaveBeenCalledWith('Behind remote by 3 commit(s)');
  });

  it('classifies a missing remote branch as a normal first-sync result', async () => {
    const { dependencies, logger } = harness([]);
    dependencies.git = vi.fn(() =>
      Promise.reject(new Error("remote ref 'tbd-sync' does not exist")),
    );

    await expect(runIssueSync(target, { pull: true }, logger, dependencies)).resolves.toEqual({
      kind: 'remote-missing',
    });
  });

  it('preserves the cause of operational pull failures', async () => {
    const cause = new Error('authentication failed');
    const { dependencies, logger } = harness([]);
    dependencies.git = vi.fn(() => Promise.reject(cause));

    const promise = runIssueSync(target, { pull: true }, logger, dependencies);
    await expect(promise).rejects.toThrow('Failed to pull: authentication failed');
    await expect(promise).rejects.toHaveProperty('cause', cause);
  });

  it('uses a cancellable bounded fetch for embedded callers', async () => {
    const { dependencies, logger, git } = harness(['0']);
    const controller = new AbortController();

    await expect(
      runIssueSync(
        target,
        { pull: true, signal: controller.signal, networkTimeoutMs: 12_000 },
        logger,
        dependencies,
      ),
    ).resolves.toEqual({ kind: 'up-to-date' });

    expect(dependencies.gitNoPromptWithTimeout).toHaveBeenCalledWith(
      { timeoutMs: 12_000, signal: controller.signal },
      'fetch',
      'origin',
      'tbd-sync',
    );
    expect(git).toHaveBeenCalledTimes(1);
    expect(git).toHaveBeenCalledWith('rev-list', '--count', 'tbd-sync..origin/tbd-sync');
  });
});
