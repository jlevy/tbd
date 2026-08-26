/**
 * Shared issue predicates used by list-like commands and snapshot change detection.
 */

import type { Issue, IssueKindType, IssueStatusType } from './types.js';
import { matchesSpecPath } from './spec-matching.js';

/** Filters whose semantics are shared with `tbd list`. */
export interface SharedIssueFilters {
  labels: readonly string[];
  spec: string | null;
  status: IssueStatusType | null;
  /** Issue kind, e.g. `epic`. Null means any kind. */
  kind?: IssueKindType | null;
}

/** Match the label, spec, status, and kind predicates shared by list and watch. */
export function issueMatchesSharedFilters(issue: Issue, filters: SharedIssueFilters): boolean {
  if (filters.status !== null && issue.status !== filters.status) {
    return false;
  }
  if (filters.kind != null && issue.kind !== filters.kind) {
    return false;
  }
  if (filters.labels.some((label) => !issue.labels.includes(label))) {
    return false;
  }
  if (
    filters.spec !== null &&
    (issue.spec_path == null || !matchesSpecPath(issue.spec_path, filters.spec))
  ) {
    return false;
  }
  return true;
}

/**
 * Whether a bead is still waiting out a `deferred_until` at `now`.
 *
 * A deferral exactly at `now` has arrived, so the work is available. An unparseable
 * timestamp fails open — the schema validates the field, and hiding work because a
 * date could not be read is the worse failure of the two.
 */
function deferralPending(issue: Issue, now: number): boolean {
  if (issue.deferred_until == null) {
    return false;
  }
  const until = Date.parse(issue.deferred_until);
  return Number.isFinite(until) && until > now;
}

/**
 * Compute ready issue IDs from one complete issue snapshot.
 *
 * A `blocks` relation is stored on the blocker and points to its blocked target.
 *
 * Ready means: open, unheld, unblocked, and nobody acting on it.
 *
 * "Nobody acting" reads `delegate`, not `assignee`. The two stopped being the same
 * question when the actor axis landed: `assignee` is who is *accountable*, which in an
 * agent-driven repository is often the same person on every bead, and treating that as
 * "taken" would empty the ready list the moment ownership was recorded. `delegate` is
 * who is *doing it*, which is the fact readiness actually depends on.
 *
 * A held bead is never ready regardless of its dependencies: `blocked` means it is
 * waiting on something and `paused` means it was deliberately set down, and offering
 * either to an agent looking for work is how a hold gets quietly ignored.
 *
 * A `deferred_until` still in the future is the same kind of hold, written as a date
 * instead of a flag. It used to be recorded and then ignored here, so a bead deferred
 * to next year was offered as available work today and the field read as scheduling
 * while scheduling nothing.
 *
 * `now` is a parameter rather than a `Date.now()` read inside the filter because
 * `issue-changes.ts` computes this set twice to diff two snapshots: if each call took
 * its own clock, a bead whose deferral elapsed between them would surface as a ready
 * transition that no edit caused.
 */
export function readyIssueIds(
  issues: Iterable<Issue>,
  now: number = Date.now(),
): ReadonlySet<string> {
  const allIssues = Array.from(issues);
  const issueById = new Map(allIssues.map((issue) => [issue.id, issue]));
  const blockerIdsByTarget = new Map<string, string[]>();

  for (const issue of allIssues) {
    for (const dependency of issue.dependencies) {
      if (dependency.type !== 'blocks') {
        continue;
      }
      const blockerIds = blockerIdsByTarget.get(dependency.target) ?? [];
      blockerIds.push(issue.id);
      blockerIdsByTarget.set(dependency.target, blockerIds);
    }
  }

  return new Set(
    allIssues
      .filter((issue) => {
        if (issue.status !== 'open' || issue.delegate || issue.hold) {
          return false;
        }
        if (deferralPending(issue, now)) {
          return false;
        }
        const blockerIds = blockerIdsByTarget.get(issue.id) ?? [];
        return !blockerIds.some((blockerId) => issueById.get(blockerId)?.status !== 'closed');
      })
      .map((issue) => issue.id),
  );
}
