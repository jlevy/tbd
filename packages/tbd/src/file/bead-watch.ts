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

function parseRemoteTip(output: string, remote: string, branch: string): string {
  const [tip] = output.trim().split(/\s+/);
  if (!tip || !/^[0-9a-f]{40,64}$/.test(tip)) {
    throw new Error(`Remote sync branch not found: ${remote}/${branch}`);
  }
  return tip;
}

function createGitWatchDependencies(options: IssueWatchOptions): IssueWatchDependencies {
  const privateRef = `refs/tbd/watch/${process.pid}-${randomUUID()}`;
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
