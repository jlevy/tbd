/**
 * Issue aggregation shared by `tbd stats` and any other surface that reports counts.
 *
 * Pure and node-free: it takes a loaded issue collection and returns plain data, so the
 * CLI renderer and a server response cannot disagree about what "active" means or which
 * statuses are counted.
 */

import type { Issue, IssueKindType, IssueStatusType } from './types.js';

/** Non-closed statuses. The definition of "active" lives here and nowhere else. */
export const ACTIVE_STATUSES: readonly IssueStatusType[] = [
  'open',
  'in_progress',
  'blocked',
  'deferred',
];

/** All statuses in display order. */
export const STATUS_ORDER: readonly IssueStatusType[] = [
  'open',
  'in_progress',
  'blocked',
  'deferred',
  'closed',
];

/** All kinds in display order. */
export const KIND_ORDER: readonly IssueKindType[] = ['bug', 'feature', 'task', 'epic', 'chore'];

/** Human labels for the five priority levels, indexed by priority. */
export const PRIORITY_LABELS: readonly string[] = ['Critical', 'High', 'Medium', 'Low', 'Lowest'];

/** Aggregate counts over one issue collection. */
export interface IssueStats {
  total: number;
  active: number;
  closed: number;
  byStatus: Record<IssueStatusType, number>;
  byKindActive: Record<IssueKindType, number>;
  byKindClosed: Record<IssueKindType, number>;
  byPriorityActive: Record<number, number>;
  byPriorityClosed: Record<number, number>;
}

function emptyStatusCounts(): Record<IssueStatusType, number> {
  return { open: 0, in_progress: 0, blocked: 0, deferred: 0, closed: 0 };
}

function emptyKindCounts(): Record<IssueKindType, number> {
  return { bug: 0, feature: 0, task: 0, epic: 0, chore: 0 };
}

function emptyPriorityCounts(): Record<number, number> {
  return { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };
}

/** Count one issue collection by status, kind, and priority, split active vs closed. */
export function computeIssueStats(issues: Iterable<Issue>): IssueStats {
  const byStatus = emptyStatusCounts();
  const byKindActive = emptyKindCounts();
  const byKindClosed = emptyKindCounts();
  const byPriorityActive = emptyPriorityCounts();
  const byPriorityClosed = emptyPriorityCounts();
  let total = 0;

  for (const issue of issues) {
    total += 1;
    byStatus[issue.status] += 1;

    const isActive = issue.status !== 'closed';
    const kindCounts = isActive ? byKindActive : byKindClosed;
    const priorityCounts = isActive ? byPriorityActive : byPriorityClosed;
    kindCounts[issue.kind] += 1;
    if (issue.priority >= 0 && issue.priority <= 4) {
      priorityCounts[issue.priority] = (priorityCounts[issue.priority] ?? 0) + 1;
    }
  }

  const active = ACTIVE_STATUSES.reduce((sum, status) => sum + byStatus[status], 0);

  return {
    total,
    active,
    closed: byStatus.closed,
    byStatus,
    byKindActive,
    byKindClosed,
    byPriorityActive,
    byPriorityClosed,
  };
}
