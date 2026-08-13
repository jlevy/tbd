/**
 * Parent/child hierarchy invariants.
 *
 * A `parent_id` cycle makes every ancestor walk non-terminating: tree rendering,
 * hierarchy-aware listing, and any integration that walks ancestors to decide
 * mirror depth would all hang. Nothing prevented a cycle before, so these checks
 * run on the write path and are also available to `doctor` for existing data.
 */

import type { Issue } from './types.js';

/** Deepest parent chain allowed. Beyond this, a hierarchy is unusable anyway. */
export const MAX_PARENT_DEPTH = 10;

export type HierarchyProblem =
  | { kind: 'cycle'; path: string[] }
  | { kind: 'too_deep'; path: string[]; depth: number };

/**
 * Walk from an issue to its root, returning the path (nearest ancestor first).
 *
 * Stops and reports rather than looping when it revisits an id or exceeds the
 * depth limit.
 */
export function ancestorPath(
  startId: string,
  parentOf: (id: string) => string | null | undefined,
): { path: string[]; problem?: HierarchyProblem } {
  const path: string[] = [];
  const seen = new Set<string>([startId]);

  let current = parentOf(startId);
  while (current) {
    if (seen.has(current)) {
      return { path, problem: { kind: 'cycle', path: [...path, current] } };
    }
    seen.add(current);
    path.push(current);
    if (path.length > MAX_PARENT_DEPTH) {
      return { path, problem: { kind: 'too_deep', path, depth: path.length } };
    }
    current = parentOf(current);
  }
  return { path };
}

/**
 * Check whether setting `parentId` as the parent of `childId` is legal.
 *
 * Returns undefined when the assignment is fine.
 */
export function checkParentAssignment(
  childId: string,
  parentId: string,
  parentOf: (id: string) => string | null | undefined,
): HierarchyProblem | undefined {
  if (childId === parentId) {
    return { kind: 'cycle', path: [childId] };
  }

  // Walk up from the proposed parent: reaching the child means the edge closes a
  // loop.
  const seen = new Set<string>([parentId]);
  const path: string[] = [parentId];
  let current = parentOf(parentId);
  while (current) {
    if (current === childId) {
      return { kind: 'cycle', path: [...path, current] };
    }
    if (seen.has(current)) {
      // A pre-existing cycle above the proposed parent; report it rather than
      // spinning.
      return { kind: 'cycle', path: [...path, current] };
    }
    seen.add(current);
    path.push(current);
    if (path.length > MAX_PARENT_DEPTH) {
      return { kind: 'too_deep', path, depth: path.length };
    }
    current = parentOf(current);
  }
  return undefined;
}

/**
 * Render a hierarchy problem as an actionable message.
 *
 * `format` renders an internal id the way the user sees it, so the message names
 * the ids they typed rather than internal ULIDs.
 */
export function describeHierarchyProblem(
  problem: HierarchyProblem,
  format: (id: string) => string,
): string {
  const path = problem.path.map(format).join(' -> ');
  if (problem.kind === 'cycle') {
    return `That parent would create a cycle (${path}). An issue cannot be its own ancestor.`;
  }
  return `That parent would nest ${problem.depth} levels deep, past the limit of ${MAX_PARENT_DEPTH} (${path}).`;
}

/**
 * Find every hierarchy problem in a set of issues. Used by `doctor`.
 */
export function findHierarchyProblems(
  issues: readonly Issue[],
): { issueId: string; problem: HierarchyProblem }[] {
  const parents = new Map<string, string | null | undefined>();
  for (const issue of issues) {
    parents.set(issue.id, issue.parent_id);
  }
  const parentOf = (id: string): string | null | undefined => parents.get(id);

  const problems: { issueId: string; problem: HierarchyProblem }[] = [];
  for (const issue of issues) {
    const { problem } = ancestorPath(issue.id, parentOf);
    if (problem) {
      problems.push({ issueId: issue.id, problem });
    }
  }
  return problems;
}
