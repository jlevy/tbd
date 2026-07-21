/**
 * Read-only remote sync-branch polling for `tbd watch`.
 *
 * Network fetches target a collision-resistant private ref and never acquire or inspect
 * the shared data-sync worktree lock.
 */

import { randomUUID } from 'node:crypto';

import type { IssueChangeSelection, IssueChangesReport } from '../lib/issue-changes.js';
import { createChangesReportFromRefs } from './sync-branch-changes.js';
import { git, gitNoPrompt } from './git.js';

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

/** Injectable boundaries keep polling and deadline behavior deterministic in unit tests. */
export interface IssueWatchDependencies {
  now: () => number;
  sleep: (milliseconds: number) => Promise<void>;
  getRemoteTip: () => Promise<string>;
  fetchRemoteTip: () => Promise<string>;
  createReport: (since: string, tip: string) => Promise<IssueChangesReport>;
  cleanup?: () => Promise<void>;
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

const WATCH_REF_NAMESPACE = 'refs/tbd/watch/';

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    // EPERM means the process exists but belongs to another user.
    return (error as NodeJS.ErrnoException).code === 'EPERM';
  }
}

/**
 * Delete leftover private watch refs whose owning process is no longer alive.
 *
 * An interrupted watch (SIGINT/SIGKILL) cannot run its own cleanup, so each new watch
 * sweeps predecessors. Best-effort by design: sweep failures must never prevent the
 * watch itself from running, and refs of live concurrent watches are left alone.
 */
export async function sweepStaleWatchRefs(repoDir: string): Promise<void> {
  let listing: string;
  try {
    listing = await git('-C', repoDir, 'for-each-ref', '--format=%(refname)', WATCH_REF_NAMESPACE);
  } catch {
    return;
  }
  for (const refname of listing.split('\n').filter(Boolean)) {
    const pidMatch = /^refs\/tbd\/watch\/(\d+)-/.exec(refname);
    if (!pidMatch) continue;
    const pid = Number(pidMatch[1]);
    if (pid === process.pid || isProcessAlive(pid)) continue;
    try {
      await git('-C', repoDir, 'update-ref', '-d', refname);
    } catch {
      // Another sweep may have deleted it concurrently; leave it for the next watch.
    }
  }
}

function parseRemoteTip(output: string, remote: string, branch: string): string {
  const [tip] = output.trim().split(/\s+/);
  if (!tip || !/^[0-9a-f]{40,64}$/.test(tip)) {
    throw new Error(`Remote sync branch not found: ${remote}/${branch}`);
  }
  return tip;
}

function createGitWatchDependencies(options: IssueWatchOptions): IssueWatchDependencies {
  const privateRef = `${WATCH_REF_NAMESPACE}${process.pid}-${randomUUID()}`;
  return {
    now: Date.now,
    sleep,
    getRemoteTip: async () => {
      let output;
      try {
        output = await gitNoPrompt(
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
    fetchRemoteTip: async () => {
      try {
        await gitNoPrompt(
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
      } catch (error) {
        throw new Error(`Failed to remove private watch ref ${privateRef}`, { cause: error });
      }
    },
  };
}

/** Poll until the selected graph changes or the optional deadline elapses. */
export async function watchForIssueChanges(
  options: IssueWatchOptions,
  injectedDependencies?: IssueWatchDependencies,
): Promise<IssueWatchResult> {
  const dependencies = injectedDependencies ?? createGitWatchDependencies(options);
  const startedAt = dependencies.now();
  const deadline = options.timeoutMs === null ? null : startedAt + options.timeoutMs;

  try {
    let observedTip = await dependencies.getRemoteTip();
    let baseline = options.since ?? observedTip;

    if (options.since !== null) {
      const comparisonTip =
        options.since === observedTip ? observedTip : await dependencies.fetchRemoteTip();
      const report = await dependencies.createReport(baseline, comparisonTip);
      if (report.changes.length > 0) return { kind: 'changed', report };
      baseline = report.tip;
      observedTip = comparisonTip;
    } else if (options.selection.kind === 'beads') {
      // Fail fast on unknown bead IDs: without --since there is no initial report, so a
      // typo'd --bead would otherwise block silently until the first remote movement.
      // A tip-to-tip report is empty by construction but resolves every requested ID.
      const fetchedTip = await dependencies.fetchRemoteTip();
      await dependencies.createReport(fetchedTip, fetchedTip);
      observedTip = fetchedTip;
      baseline = fetchedTip;
    }

    while (true) {
      const remaining = deadline === null ? options.intervalMs : deadline - dependencies.now();
      if (remaining <= 0) return { kind: 'timeout' };
      await dependencies.sleep(Math.min(options.intervalMs, remaining));
      if (deadline !== null && dependencies.now() >= deadline) return { kind: 'timeout' };

      const nextObservedTip = await dependencies.getRemoteTip();
      if (nextObservedTip === observedTip) continue;

      const fetchedTip = await dependencies.fetchRemoteTip();
      observedTip = fetchedTip;
      if (fetchedTip === baseline) continue;
      const report = await dependencies.createReport(baseline, fetchedTip);
      if (report.changes.length > 0) return { kind: 'changed', report };
      baseline = report.tip;
    }
  } finally {
    await dependencies.cleanup?.();
  }
}
