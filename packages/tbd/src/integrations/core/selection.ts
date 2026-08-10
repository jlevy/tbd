/**
 * Which beads an integration mirrors outward.
 *
 * The point of the mirror is the filter: mirroring the whole store would defeat
 * it, so the default selects epics in an active status.
 */

import type { Issue, IntegrationSelect, ProviderNameType } from '../../lib/types.js';

/**
 * True when the bead carries a link to the given provider.
 */
export function isLinkedTo(issue: Issue, provider: ProviderNameType): boolean {
  return (issue.linked ?? []).some((entry) => entry.provider === provider);
}

/**
 * True when the bead matches the configured selection predicates.
 *
 * Empty `labels` means "no label requirement", not "must have no labels".
 */
function matchesSelect(issue: Issue, select: IntegrationSelect): boolean {
  if (select.kinds.length > 0 && !select.kinds.includes(issue.kind)) {
    return false;
  }
  if (select.statuses.length > 0 && !select.statuses.includes(issue.status)) {
    return false;
  }
  if (select.labels.length > 0) {
    const labels = issue.labels ?? [];
    if (!select.labels.some((label) => labels.includes(label))) {
      return false;
    }
  }
  return true;
}

/**
 * The set of beads to mirror.
 *
 * An explicitly linked bead is always included when `select.linked` is set, even
 * if it no longer matches the predicates: someone linked it deliberately, and
 * silently dropping it would strand the external item.
 */
export function mirrorSet(
  issues: readonly Issue[],
  select: IntegrationSelect,
  provider: ProviderNameType,
): Issue[] {
  return issues.filter(
    (issue) => matchesSelect(issue, select) || (select.linked && isLinkedTo(issue, provider)),
  );
}
