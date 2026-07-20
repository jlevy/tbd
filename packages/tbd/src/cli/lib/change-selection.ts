/** Shared CLI parsing and validation for `changes` and `watch` selectors. */

import { IssueStatus } from '../../lib/schemas.js';
import type { IssueChangeSelection } from '../../lib/issue-changes.js';
import { ValidationError } from './errors.js';

/** Raw Commander options common to both bead change commands. */
export interface ChangeSelectionOptions {
  bead?: string[];
  label?: string[];
  spec?: string;
  status?: string;
  ready?: boolean;
  all?: boolean;
}

/** Validate mutually exclusive modes and return the core selection union. */
export function parseChangeSelection(
  options: ChangeSelectionOptions,
  requireExplicit: boolean,
): IssueChangeSelection {
  const hasBeads = (options.bead?.length ?? 0) > 0;
  const spec = options.spec === '' ? null : (options.spec ?? null);
  const hasFilters =
    (options.label?.length ?? 0) > 0 ||
    spec !== null ||
    options.status !== undefined ||
    options.ready === true;

  if (options.all && (hasBeads || hasFilters)) {
    throw new ValidationError('--all cannot be combined with other selectors');
  }
  if (hasBeads && hasFilters) {
    throw new ValidationError('--bead cannot be combined with dynamic filters');
  }
  if (options.all) return { kind: 'all' };
  if (hasBeads) return { kind: 'beads', ids: options.bead! };
  if (hasFilters) {
    const statusResult = IssueStatus.nullable().safeParse(options.status ?? null);
    if (!statusResult.success) {
      throw new ValidationError(`Invalid status: ${options.status}`);
    }
    return {
      kind: 'filter',
      labels: options.label ?? [],
      spec,
      status: statusResult.data,
      ready: options.ready ?? false,
    };
  }
  if (requireExplicit) {
    throw new ValidationError(
      'A selector is required: use --bead, --label, --spec, --status, --ready, or --all',
    );
  }
  return { kind: 'all' };
}
