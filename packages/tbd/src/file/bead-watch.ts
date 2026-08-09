/**
 * Read-only remote sync-branch polling for `tbd watch`.
 *
 * Network fetches target a collision-resistant private ref and never acquire or inspect
 * the shared data-sync worktree lock.
 */

import { randomUUID } from 'node:crypto';

import type { IssueChangeSelection, IssueChangesReport } from '../lib/issue-changes.js';
import { createChangesReportFromRefs, validateBeadSelectionAtRef } from './sync-branch-changes.js';
import { git, gitNoPromptWithTimeout } from './git.js';

export interface IssueWatchOptions {
  repoDir: string;
  remote: string;
  branch: string;
  prefix: string;
  selection: IssueChangeSelection;
  since: string | null;
  intervalMs: number;
  timeoutMs: number | null;
}

export type IssueWatchResult =
  | { kind: 'changed'; report: IssueChangesReport }
  | { kind: 'timeout' };

/**
 * Consecutive failed remote polls tolerated before an established watch aborts.
 * Each failed poll waits the normal interval, so a brief network outage does not
 * kill an unattended watch; startup failures still fail fast.
 */
const MAX_CONSECUTIVE_POLL_FAILURES = 5;

/** Maximum wall time allocated to one remote-tip observation, including its fetch. */
const MAX_REMOTE_POLL_DURATION_MS = 30_000;

/** Injectable boundaries keep polling and deadline behavior deterministic in unit tests. */
export interface IssueWatchDependencies {
  now: () => number;
  sleep: (milliseconds: number) => Promise<void>;
  prepare?: () => Promise<void>;
  validateSelection?: () => Promise<void>;
  getRemoteTip: (timeoutMs: number) => Promise<string>;
  fetchRemoteTip: (timeoutMs: number) => Promise<string>;
  createReport: (since: string, tip: string) => Promise<IssueChangesReport>;
  cleanup?: () => Promise<void>;
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function parseRemoteTip(output: string, remote: string, branch: string): string {
  const [tip] = output.trim().split(/\s+/);
  if (!tip || !/^[0-9a-f]{40,64}$/.test(tip)) {
    throw new Error(`Remote sync branch not found: ${remote}/${branch}`);
  }
  return tip;
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return !(
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'ESRCH'
    );
  }
}

/** Remove private refs left by watcher processes that are no longer running. */
export async function removeStaleWatchRefs(
  repoDir: string,
  processIsAlive: (pid: number) => boolean = isProcessAlive,
): Promise<void> {
  const output = await git('-C', repoDir, 'for-each-ref', '--format=%(refname)', 'refs/tbd/watch/');
  for (const ref of output.split('\n').filter(Boolean)) {
    const match = /^refs\/tbd\/watch\/(\d+)-/.exec(ref);
    if (!match) {
      continue;
    }
    const pid = Number(match[1]);
    if (Number.isSafeInteger(pid) && pid > 0 && !processIsAlive(pid)) {
      await git('-C', repoDir, 'update-ref', '-d', ref);
    }
  }
}

function createGitWatchDependencies(options: IssueWatchOptions): IssueWatchDependencies {
  const privateRef = `refs/tbd/watch/${process.pid}-${randomUUID()}`;
  return {
    now: Date.now,
    sleep,
    prepare: () => removeStaleWatchRefs(options.repoDir),
    validateSelection: async () => {
      // A --since report validates against the union of both endpoints immediately,
      // which permits watching a bead deleted after that baseline.
      if (options.since !== null) {
        return;
      }
      await validateBeadSelectionAtRef(
        options.repoDir,
        `refs/heads/${options.branch}`,
        options.selection,
      );
    },
    getRemoteTip: async (timeoutMs) => {
      let output;
      try {
        output = await gitNoPromptWithTimeout(
          timeoutMs,
          '-C',
          options.repoDir,
          'ls-remote',
          '--exit-code',
          options.remote,
          `refs/heads/${options.branch}`,
        );
      } catch (error) {
        throw new Error(`Failed to read remote sync tip ${options.remote}/${options.branch}`, {
          cause: error,
        });
      }
      return parseRemoteTip(output, options.remote, options.branch);
    },
    fetchRemoteTip: async (timeoutMs) => {
      try {
        await gitNoPromptWithTimeout(
          timeoutMs,
          '-C',
          options.repoDir,
          'fetch',
          '--no-write-fetch-head',
          '--no-tags',
          options.remote,
          `+refs/heads/${options.branch}:${privateRef}`,
        );
        return await git('-C', options.repoDir, 'rev-parse', '--verify', `${privateRef}^{commit}`);
      } catch (error) {
        throw new Error(`Failed to fetch remote sync tip ${options.remote}/${options.branch}`, {
          cause: error,
        });
      }
    },
    createReport: (since, tip) =>
      createChangesReportFromRefs({
        repoDir: options.repoDir,
        sinceRef: since,
        tipRef: tip,
        prefix: options.prefix,
        selection: options.selection,
      }),
    cleanup: async () => {
      try {
        await git('-C', options.repoDir, 'update-ref', '-d', privateRef);
      } catch {
        // Best-effort, like the startup reclaim: this runs in a `finally`, so throwing
        // here would discard the change report the watch just produced. A ref left by
        // a failed delete is reclaimed by the next watch once this PID is gone.
      }
    },
  };
}

function calculateRemotePollDeadline(
  now: number,
  watchDeadline: number | null,
  remotePollDurationMs: number,
): number {
  const boundedPollDeadline = now + remotePollDurationMs;
  // Before the watch boundary, the overall remaining time is the tighter bound.
  // A poll that starts at the boundary is the explicit final inclusive observation
  // and gets one bounded poll budget of its own.
  return watchDeadline !== null && now < watchDeadline
    ? Math.min(boundedPollDeadline, watchDeadline)
    : boundedPollDeadline;
}

function remainingRemotePollTime(deadline: number, now: number): number {
  return Math.max(1, deadline - now);
}

/** Poll until the selected graph changes or the optional deadline elapses. */
export async function watchForIssueChanges(
  options: IssueWatchOptions,
  injectedDependencies?: IssueWatchDependencies,
): Promise<IssueWatchResult> {
  const dependencies = injectedDependencies ?? createGitWatchDependencies(options);
  const startedAt = dependencies.now();
  const deadline = options.timeoutMs === null ? null : startedAt + options.timeoutMs;
  const remotePollDurationMs = Math.max(
    1,
    Math.min(options.intervalMs, MAX_REMOTE_POLL_DURATION_MS),
  );

  try {
    await dependencies.prepare?.();
    await dependencies.validateSelection?.();
    let remotePollDeadline = calculateRemotePollDeadline(
      dependencies.now(),
      deadline,
      remotePollDurationMs,
    );
    let observedTip = await dependencies.getRemoteTip(
      remainingRemotePollTime(remotePollDeadline, dependencies.now()),
    );
    let lastRemoteObservationAt = dependencies.now();
    let baseline = options.since ?? observedTip;

    if (options.since !== null) {
      const comparisonTip =
        options.since === observedTip
          ? observedTip
          : await dependencies.fetchRemoteTip(
              remainingRemotePollTime(remotePollDeadline, dependencies.now()),
            );
      const report = await dependencies.createReport(baseline, comparisonTip);
      if (report.changes.length > 0) {
        return { kind: 'changed', report };
      }
      baseline = report.tip;
      observedTip = comparisonTip;
    }

    let consecutivePollFailures = 0;
    while (true) {
      const currentTime = dependencies.now();
      if (deadline !== null && currentTime >= deadline && lastRemoteObservationAt >= deadline) {
        return { kind: 'timeout' };
      }
      if (deadline === null || currentTime < deadline) {
        const remaining = deadline === null ? options.intervalMs : deadline - currentTime;
        await dependencies.sleep(Math.min(options.intervalMs, remaining));
      }

      let fetchedTip: string;
      remotePollDeadline = calculateRemotePollDeadline(
        dependencies.now(),
        deadline,
        remotePollDurationMs,
      );
      try {
        const nextObservedTip = await dependencies.getRemoteTip(
          remainingRemotePollTime(remotePollDeadline, dependencies.now()),
        );
        lastRemoteObservationAt = dependencies.now();
        if (nextObservedTip === observedTip) {
          consecutivePollFailures = 0;
          continue;
        }
        fetchedTip = await dependencies.fetchRemoteTip(
          remainingRemotePollTime(remotePollDeadline, dependencies.now()),
        );
      } catch (error) {
        if (deadline !== null && dependencies.now() >= deadline) {
          throw new Error('Unable to confirm remote state at the watch timeout boundary', {
            cause: error,
          });
        }
        consecutivePollFailures += 1;
        if (consecutivePollFailures >= MAX_CONSECUTIVE_POLL_FAILURES) {
          throw new Error(
            `Watch aborted after ${MAX_CONSECUTIVE_POLL_FAILURES} consecutive remote poll failures`,
            { cause: error },
          );
        }
        continue;
      }
      consecutivePollFailures = 0;
      observedTip = fetchedTip;
      if (fetchedTip === baseline) {
        continue;
      }
      const report = await dependencies.createReport(baseline, fetchedTip);
      if (report.changes.length > 0) {
        return { kind: 'changed', report };
      }
      baseline = report.tip;
    }
  } finally {
    await dependencies.cleanup?.();
  }
}
