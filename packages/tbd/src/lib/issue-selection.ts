/**
 * Shared issue predicates used by list-like commands and snapshot change detection.
 */

import type { Issue, IssueStatusType } from './types.js';
import { matchesSpecPath } from './spec-matching.js';

/** Filters whose semantics are shared with `tbd list`. */
export interface SharedIssueFilters {
  labels: readonly string[];
  spec: string | null;
  status: IssueStatusType | null;
}

/** Match the label, spec, and status predicates shared by list and watch. */
export function issueMatchesSharedFilters(issue: Issue, filters: SharedIssueFilters): boolean {
  if (filters.status !== null && issue.status !== filters.status) return false;
  if (filters.labels.some((label) => !issue.labels.includes(label))) return false;
  if (
    filters.spec !== null &&
    (issue.spec_path == null || !matchesSpecPath(issue.spec_path, filters.spec))
  ) {
    return false;
  }
  return true;
}

/**
 * Compute ready issue IDs from one complete issue snapshot.
 *
 * A `blocks` relation is stored on the blocker and points to its blocked target.
 */
export function readyIssueIds(issues: Iterable<Issue>): ReadonlySet<string> {
  const allIssues = Array.from(issues);
  const issueById = new Map(allIssues.map((issue) => [issue.id, issue]));
  const blockerIdsByTarget = new Map<string, string[]>();

  for (const issue of allIssues) {
    for (const dependency of issue.dependencies) {
      if (dependency.type !== 'blocks') continue;
      const blockerIds = blockerIdsByTarget.get(dependency.target) ?? [];
      blockerIds.push(issue.id);
      blockerIdsByTarget.set(dependency.target, blockerIds);
    }
  }

  return new Set(
    allIssues
      .filter((issue) => {
        if (issue.status !== 'open' || issue.assignee) return false;
        const blockerIds = blockerIdsByTarget.get(issue.id) ?? [];
        return !blockerIds.some((blockerId) => issueById.get(blockerId)?.status !== 'closed');
      })
      .map((issue) => issue.id),
  );
}
