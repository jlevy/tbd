/**
 * Directed-graph checks for issue blocker dependencies.
 */

import type { Issue } from './types.js';

type DependencyAdjacency = ReadonlyMap<string, readonly string[]>;

interface TraversalFrame {
  node: string;
  nextNeighbor: number;
}

/**
 * Find one representative closed path for every cyclic dependency component.
 *
 * A stored `blocks` edge points from a blocker to its blocked issue. Returned paths
 * reverse that storage direction so they read like the CLI: each issue depends on the
 * next issue, and the final repeated ID closes the cycle.
 */
export function findDependencyCycles(issues: readonly Issue[]): string[][] {
  const adjacency = buildDependsOnAdjacency(issues);
  const components = stronglyConnectedComponents(adjacency);

  return components
    .filter((component) => isCyclicComponent(component, adjacency))
    .map((component) => representativeCycle(component, adjacency))
    .sort((left, right) => left[0]!.localeCompare(right[0]!));
}

function buildDependsOnAdjacency(issues: readonly Issue[]): DependencyAdjacency {
  const issueIds = new Set(issues.map((issue) => issue.id));
  const blockersByDependent = new Map<string, Set<string>>(
    issues.map((issue) => [issue.id, new Set<string>()]),
  );

  for (const blocker of issues) {
    for (const dependency of blocker.dependencies) {
      if (dependency.type !== 'blocks' || !issueIds.has(dependency.target)) {
        continue;
      }
      blockersByDependent.get(dependency.target)!.add(blocker.id);
    }
  }

  return new Map(
    Array.from(blockersByDependent, ([issueId, blockers]) => [
      issueId,
      Array.from(blockers).sort(),
    ]),
  );
}

function stronglyConnectedComponents(adjacency: DependencyAdjacency): string[][] {
  const nodes = Array.from(adjacency.keys()).sort();
  const finishOrder = dependencyFinishOrder(nodes, adjacency);
  const reverseAdjacency = reverseEdges(nodes, adjacency);
  const assigned = new Set<string>();
  const components: string[][] = [];

  for (let index = finishOrder.length - 1; index >= 0; index -= 1) {
    const start = finishOrder[index]!;
    if (assigned.has(start)) {
      continue;
    }

    const component: string[] = [];
    const stack = [start];
    assigned.add(start);
    while (stack.length > 0) {
      const node = stack.pop()!;
      component.push(node);
      for (const neighbor of reverseAdjacency.get(node) ?? []) {
        if (!assigned.has(neighbor)) {
          assigned.add(neighbor);
          stack.push(neighbor);
        }
      }
    }
    components.push(component.sort());
  }

  return components;
}

function dependencyFinishOrder(nodes: readonly string[], adjacency: DependencyAdjacency): string[] {
  const visited = new Set<string>();
  const finishOrder: string[] = [];

  for (const start of nodes) {
    if (visited.has(start)) {
      continue;
    }

    visited.add(start);
    const stack: TraversalFrame[] = [{ node: start, nextNeighbor: 0 }];
    while (stack.length > 0) {
      const frame = stack[stack.length - 1]!;
      const neighbors = adjacency.get(frame.node) ?? [];
      const neighbor = neighbors[frame.nextNeighbor];
      if (neighbor === undefined) {
        finishOrder.push(frame.node);
        stack.pop();
        continue;
      }

      frame.nextNeighbor += 1;
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        stack.push({ node: neighbor, nextNeighbor: 0 });
      }
    }
  }

  return finishOrder;
}

function reverseEdges(
  nodes: readonly string[],
  adjacency: DependencyAdjacency,
): DependencyAdjacency {
  const reversed = new Map<string, string[]>(nodes.map((node) => [node, []]));
  for (const [source, targets] of adjacency) {
    for (const target of targets) {
      reversed.get(target)!.push(source);
    }
  }
  for (const sources of reversed.values()) {
    sources.sort();
  }
  return reversed;
}

function isCyclicComponent(component: readonly string[], adjacency: DependencyAdjacency): boolean {
  if (component.length > 1) {
    return true;
  }
  const node = component[0];
  return node !== undefined && (adjacency.get(node) ?? []).includes(node);
}

function representativeCycle(
  component: readonly string[],
  adjacency: DependencyAdjacency,
): string[] {
  const start = component[0]!;
  const members = new Set(component);
  const neighbors = (adjacency.get(start) ?? []).filter((neighbor) => members.has(neighbor));

  for (const neighbor of neighbors) {
    if (neighbor === start) {
      return [start, start];
    }
    const pathBack = findPath(neighbor, start, members, adjacency);
    if (pathBack !== null) {
      return [start, ...pathBack];
    }
  }

  throw new Error(`Cyclic dependency component has no closed path from ${start}`);
}

function findPath(
  start: string,
  target: string,
  members: ReadonlySet<string>,
  adjacency: DependencyAdjacency,
): string[] | null {
  const queue = [start];
  const previous = new Map<string, string | null>([[start, null]]);

  for (const node of queue) {
    if (node === target) {
      const path: string[] = [];
      let cursor: string | null = target;
      while (cursor !== null) {
        path.push(cursor);
        cursor = previous.get(cursor) ?? null;
      }
      return path.reverse();
    }

    for (const neighbor of adjacency.get(node) ?? []) {
      if (members.has(neighbor) && !previous.has(neighbor)) {
        previous.set(neighbor, node);
        queue.push(neighbor);
      }
    }
  }

  return null;
}
