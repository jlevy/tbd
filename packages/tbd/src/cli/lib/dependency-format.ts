/**
 * Dependency direction formatting shared by CLI commands.
 */

import type { Issue } from '../../lib/types.js';

/**
 * Human-facing dependency directions for an issue.
 */
export interface DependencyDirections {
  /** Issues this issue blocks. */
  blocks: string[];
  /** Issues that block this issue. */
  blockedBy: string[];
}

/**
 * Compute display-ready dependency directions for an issue.
 */
export function getDependencyDirections(
  issue: Issue,
  allIssues: Issue[],
  displayId: (internalId: string) => string,
): DependencyDirections {
  const blocks = issue.dependencies
    .filter((dep) => dep.type === 'blocks')
    .map((dep) => displayId(dep.target));

  const blockedBy: string[] = [];
  for (const other of allIssues) {
    for (const dep of other.dependencies) {
      if (dep.type === 'blocks' && dep.target === issue.id) {
        blockedBy.push(displayId(other.id));
      }
    }
  }

  return { blocks, blockedBy };
}

/**
 * Render dependency directions as YAML comments for round-trippable show output.
 */
export function formatDependencyDirectionComments(directions: DependencyDirections): string[] {
  const lines: string[] = [];

  if (directions.blocks.length > 0) {
    lines.push(`# Blocks: ${directions.blocks.join(', ')}`);
  }
  if (directions.blockedBy.length > 0) {
    lines.push(`# Blocked by: ${directions.blockedBy.join(', ')}`);
  }

  return lines;
}
