/**
 * In-process issue synchronization shared by CLI commands and long-running surfaces.
 *
 * This module deliberately owns no presentation. Callers supply an OperationLogger and
 * translate the structured result into their own output contract.
 */

import type { OperationLogger } from '../lib/types.js';
import { noopLogger } from '../lib/types.js';
import { ensureWorktreeAttachedToBranch, git, gitNoPromptWithTimeout } from './git.js';
import type { GitTimeoutOptions } from './git.js';

export interface IssueSyncTarget {
  /** Hidden data-sync worktree that owns the local sync branch. */
  worktreePath: string;
  /** Local and remote branch containing committed issue state. */
  syncBranch: string;
  /** Configured Git remote. */
  remote: string;
}

export interface IssueSyncOptions {
  /** Pull-only mode. Kept explicit so later modes cannot be selected accidentally. */
  pull: true;
  /** Optional cancellation for embedded callers such as the foreground web server. */
  signal?: AbortSignal;
  /** Bound the network fetch without changing the interactive CLI's existing behavior. */
  networkTimeoutMs?: number;
}

export type IssueSyncResult =
  | { kind: 'up-to-date' }
  | { kind: 'pulled'; commits: number }
  | { kind: 'remote-missing' };

/** Injectable boundaries keep the orchestration deterministic in unit tests. */
export interface IssueSyncDependencies {
  git: (...args: string[]) => Promise<string>;
  gitNoPromptWithTimeout: (options: GitTimeoutOptions, ...args: string[]) => Promise<string>;
  ensureWorktreeAttachedToBranch: (worktreePath: string, branch: string) => Promise<unknown>;
}

const defaultDependencies: IssueSyncDependencies = {
  git,
  gitNoPromptWithTimeout,
  ensureWorktreeAttachedToBranch,
};

function isMissingRemoteBranch(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes('not found') || message.includes('does not exist');
}

/**
 * Pull committed issue state into the hidden worktree without spawning the CLI.
 *
 * The sequence is intentionally identical to the historical `tbd sync --pull` path:
 * fetch, count commits behind, attach the worktree to the sync branch, then fast-forward.
 */
export async function runIssueSync(
  target: IssueSyncTarget,
  options: IssueSyncOptions,
  logger: OperationLogger = noopLogger,
  dependencies: IssueSyncDependencies = defaultDependencies,
): Promise<IssueSyncResult> {
  if (!options.pull) {
    throw new Error('runIssueSync currently requires pull mode');
  }
  if (
    options.networkTimeoutMs !== undefined &&
    (!Number.isSafeInteger(options.networkTimeoutMs) || options.networkTimeoutMs <= 0)
  ) {
    throw new RangeError('runIssueSync networkTimeoutMs must be a positive integer');
  }

  logger.progress('Pulling from remote...');
  try {
    if (options.signal !== undefined || options.networkTimeoutMs !== undefined) {
      await dependencies.gitNoPromptWithTimeout(
        {
          timeoutMs: options.networkTimeoutMs ?? 30_000,
          ...(options.signal === undefined ? {} : { signal: options.signal }),
        },
        'fetch',
        target.remote,
        target.syncBranch,
      );
    } else {
      await dependencies.git('fetch', target.remote, target.syncBranch);
    }
    const behindOutput = await dependencies.git(
      'rev-list',
      '--count',
      `${target.syncBranch}..${target.remote}/${target.syncBranch}`,
    );
    const commits = Number.parseInt(behindOutput, 10) || 0;
    logger.debug(`Behind remote by ${commits} commit(s)`);
    if (commits === 0) {
      return { kind: 'up-to-date' };
    }

    await dependencies.ensureWorktreeAttachedToBranch(target.worktreePath, target.syncBranch);
    await dependencies.git(
      '-C',
      target.worktreePath,
      'merge',
      '--ff-only',
      `${target.remote}/${target.syncBranch}`,
    );
    return { kind: 'pulled', commits };
  } catch (error) {
    if (isMissingRemoteBranch(error)) {
      return { kind: 'remote-missing' };
    }
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to pull: ${message}`, { cause: error });
  }
}
