/**
 * The single query implementation behind `tbd list`, `tbd ready`, and `tbd web`.
 *
 * Pure and node-free, like `issue-selection.ts` and `issue-stats.ts`. Callers own
 * CLI-shaped concerns — flag parsing, display-id → internal-id resolution, and limit
 * strings — and hand this module a fully-resolved `IssueQuery`; this module owns the
 * semantics, so two surfaces answering the same query cannot disagree.
 *
 * The filter and sort bodies are ports of `ListHandler.filterIssues`/`sortIssues` and
 * the `ready` pipeline, verified behavior-identical by the parity oracle in
 * `tests/issue-query.test.ts`.
 */

import { comparisonChain, ordering } from './comparison-chain.js';
import { extractUlidFromInternalId } from './ids.js';
import { issueMatchesSharedFilters, readyIssueIds } from './issue-selection.js';
import type { Issue, IssueKindType, IssueStatusType } from './types.js';

export type IssueSort = 'priority' | 'created' | 'updated';

/** One fully-resolved query. Field names track the CLI flags they implement. */
export interface IssueQuery {
  /** `--status`; an explicit status always wins over the closed-hide default. */
  status: IssueStatusType | null;
  /** `--all`: include closed in the default (no-status) view. */
  includeClosed: boolean;
  /** `--type` */
  kind: IssueKindType | null;
  /** `--priority`, already parsed; null means no filter (including unparseable input). */
  priority: number | null;
  /** `--assignee` */
  assignee: string | null;
  /** `--label`, repeatable, ANDed. */
  labels: readonly string[];
  /** `--parent`, already resolved to an internal id; resolution failures are the caller's. */
  parentId: string | null;
  /** `--spec`; empty-string input means "no filter" and is normalized to null by callers. */
  spec: string | null;
  /** `--deferred` */
  deferred: boolean;
  /** `tbd ready` semantics: open, unassigned, and unblocked per `readyIssueIds`. */
  ready: boolean;
  /** `--sort` */
  sort: IssueSort;
  /**
   * Maximum rows after sorting, or null for all. CLI callers keep their `applyLimit`
   * string parsing and pass null here; `tbd web` passes a number.
   */
  limit: number | null;
}

/** A query with every filter off: `tbd list`'s defaults. */
export function defaultIssueQuery(): IssueQuery {
  return {
    status: null,
    includeClosed: false,
    kind: null,
    priority: null,
    assignee: null,
    labels: [],
    parentId: null,
    spec: null,
    deferred: false,
    ready: false,
    sort: 'priority',
    limit: null,
  };
}

/**
 * Filter, sort, and limit one issue collection.
 *
 * Order and semantics are exactly `tbd list`'s: closed issues are hidden unless
 * `includeClosed` or an explicit `status: 'closed'`; label/spec/status run through the
 * shared predicate; sorting is priority ascending or created/updated newest-first, with
 * the internal-ULID tiebreak (chronological and deterministic, unlike the random short
 * display ids).
 */
export function selectIssues(issues: readonly Issue[], query: IssueQuery): Issue[] {
  const readyIds = query.ready ? readyIssueIds(issues) : null;

  const filtered = issues.filter((issue) => {
    // By default, exclude closed issues unless --all or --status closed
    if (!query.includeClosed && query.status !== 'closed' && issue.status === 'closed') {
      return false;
    }
    if (
      !issueMatchesSharedFilters(issue, {
        labels: query.labels,
        spec: query.spec,
        status: query.status,
      })
    ) {
      return false;
    }
    if (query.kind !== null && issue.kind !== query.kind) {
      return false;
    }
    if (query.priority !== null && issue.priority !== query.priority) {
      return false;
    }
    if (query.assignee !== null && issue.assignee !== query.assignee) {
      return false;
    }
    if (query.parentId !== null && issue.parent_id !== query.parentId) {
      return false;
    }
    if (query.deferred && issue.status !== 'deferred') {
      return false;
    }
    if (readyIds !== null && !readyIds.has(issue.id)) {
      return false;
    }
    return true;
  });

  const sorted = sortIssues(filtered, query.sort);
  return query.limit === null ? sorted : sorted.slice(0, query.limit);
}

/** Sort per `tbd list --sort`, ULID tiebreak. Exported for callers that sort supersets. */
export function sortIssues(issues: readonly Issue[], sortField: IssueSort): Issue[] {
  const primarySelector: (issue: Issue) => number =
    sortField === 'created'
      ? (issue) => new Date(issue.created_at).getTime()
      : sortField === 'updated'
        ? (issue) => new Date(issue.updated_at).getTime()
        : (issue) => issue.priority;

  // For created/updated, reverse so newest comes first; for priority, ascending
  const primaryOrdering =
    sortField === 'created' || sortField === 'updated' ? ordering.reversed : ordering.default;

  return [...issues].sort(
    comparisonChain<Issue>()
      .compare(primarySelector, primaryOrdering)
      // Tiebreak by internal ULID (chronological and deterministic, unlike random short IDs)
      .compare((issue) => extractUlidFromInternalId(issue.id))
      .result(),
  );
}

/**
 * The CLI invocation equivalent to a query, so a UI can teach the CLI instead of
 * replacing it.
 *
 * `exact` is false when no single command reproduces the view: `tbd ready` is its own
 * command accepting only `--type` and `--limit`, so any other active filter (or a
 * non-default sort, which `tbd ready` does not expose) makes the view narrower than
 * the printed command.
 *
 * `parentDisplayId` is the human-facing form of `query.parentId`: the filter runs on
 * internal ids, but a printed command must show what a user would type.
 */
export function describeQuery(
  query: IssueQuery,
  parentDisplayId?: string,
): { command: string; exact: boolean } {
  if (query.ready) {
    const parts = ['tbd ready'];
    if (query.kind !== null) {
      parts.push(`--type ${query.kind}`);
    }
    if (query.limit !== null) {
      parts.push(`--limit ${query.limit}`);
    }
    const unsupported =
      query.includeClosed ||
      query.status !== null ||
      query.priority !== null ||
      query.assignee !== null ||
      query.labels.length > 0 ||
      query.parentId !== null ||
      query.spec !== null ||
      query.deferred ||
      query.sort !== 'priority';
    return { command: parts.join(' '), exact: !unsupported };
  }

  const parts = ['tbd list'];
  if (query.includeClosed) {
    parts.push('--all');
  }
  if (query.status !== null) {
    parts.push(`--status ${query.status}`);
  }
  if (query.kind !== null) {
    parts.push(`--type ${query.kind}`);
  }
  if (query.priority !== null) {
    parts.push(`--priority ${query.priority}`);
  }
  if (query.assignee !== null) {
    parts.push(`--assignee ${query.assignee}`);
  }
  for (const label of query.labels) {
    parts.push(`--label ${label}`);
  }
  if (query.parentId !== null) {
    parts.push(`--parent ${parentDisplayId ?? query.parentId}`);
  }
  if (query.spec !== null) {
    parts.push(`--spec ${query.spec}`);
  }
  if (query.deferred) {
    parts.push('--deferred');
  }
  if (query.sort !== 'priority') {
    parts.push(`--sort ${query.sort}`);
  }
  if (query.limit !== null) {
    parts.push(`--limit ${query.limit}`);
  }
  return { command: parts.join(' '), exact: true };
}
