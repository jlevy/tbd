/**
 * Generic parent→child field inheritance and propagation.
 *
 * All inheritable fields follow the same three rules:
 *
 * 1. On create with --parent: if the field is not explicitly set, inherit
 *    from parent.
 * 2. On re-parenting: if the field is not explicitly set and the child has
 *    no value, inherit from new parent.
 * 3. On parent update: if the field changes on the parent, propagate to
 *    children whose field is null/undefined or matches the old value.
 *
 * Adding a new inheritable field means adding one entry to INHERITABLE_FIELDS.
 * No other code changes are needed for inheritance behavior.
 *
 * See: plan-2026-02-10-external-issue-linking.md §1c
 */

import type { Issue } from './types.js';

// =============================================================================
// Registry
// =============================================================================

/**
 * Configuration for a field that inherits from parent to child beads.
 */
interface InheritableFieldConfig {
  /** The field name on the Issue type */
  field: keyof Issue;
}

/**
 * Registry of all inheritable fields.
 * To add a new inheritable field, add one entry here.
 */
export const INHERITABLE_FIELDS: InheritableFieldConfig[] = [
  { field: 'spec_path' },
  { field: 'external_issue_url' },
];

// =============================================================================
// Inheritance
// =============================================================================

/**
 * Inherit fields from a parent issue to a child issue being created.
 *
 * For each inheritable field: if the child has no value and the field
 * was not explicitly set by the user, copy from parent.
 *
 * @param child - The child issue data (mutated in place)
 * @param parent - The parent issue to inherit from
 * @param explicitlySet - Set of field names that the user explicitly provided
 */
export function inheritFromParent(
  child: Partial<Issue>,
  parent: Issue,
  explicitlySet: Set<string>,
): void {
  for (const config of INHERITABLE_FIELDS) {
    const { field } = config;
    // Only inherit if: user didn't explicitly set it AND child has no value
    if (!explicitlySet.has(field) && !child[field]) {
      const parentValue = parent[field];
      if (parentValue != null) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
        (child as any)[field] = parentValue;
      }
    }
  }
}

/**
 * Propagate field changes from a parent to its children.
 *
 * For each inheritable field that changed on the parent:
 * update children whose value is null/undefined or matches the old value.
 *
 * @param parent - The parent issue (with updated values)
 * @param oldValues - The parent's old values for inheritable fields
 * @param children - All direct children of the parent
 * @param writeIssueFn - Function to persist a modified child
 * @param timestamp - The timestamp for updated_at
 * @returns The number of children that were updated
 */
export async function propagateToChildren(
  parent: Issue,
  oldValues: Partial<Record<string, unknown>>,
  children: Issue[],
  writeIssueFn: (issue: Issue) => Promise<void>,
  timestamp: string,
): Promise<number> {
  let updatedCount = 0;

  for (const child of children) {
    let childModified = false;

    for (const config of INHERITABLE_FIELDS) {
      const { field } = config;
      const newValue = parent[field];
      const oldValue = oldValues[field];

      // Only propagate if the parent's field actually changed
      if (newValue === oldValue) continue;
      // Only propagate if there's a new value to set
      if (newValue == null) continue;

      const childValue = child[field];
      // Propagate if child has no value or had the old inherited value
      if (!childValue || childValue === oldValue) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
        (child as any)[field] = newValue;
        childModified = true;
      }
    }

    if (childModified) {
      child.version += 1;
      child.updated_at = timestamp;
      await writeIssueFn(child);
      updatedCount++;
    }
  }

  return updatedCount;
}

/**
 * Capture the current values of all inheritable fields from an issue.
 * Used before applying updates, so propagation can compare old vs new.
 */
export function captureInheritableValues(issue: Issue): Partial<Record<string, unknown>> {
  const values: Partial<Record<string, unknown>> = {};
  for (const config of INHERITABLE_FIELDS) {
    values[config.field] = issue[config.field];
  }
  return values;
}
