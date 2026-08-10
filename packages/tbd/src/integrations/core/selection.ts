/**
 * Which beads an integration mirrors outward.
 *
 * The point of the mirror is the filter: mirroring the whole store would defeat
 * it. A bead qualifies by being an interesting *kind* (an epic) or by carrying a
 * live *plan spec*, with status acting as a gate over both so finished work
 * drops out.
 */

import type { Issue, IntegrationSelect, ProviderNameType } from '../../lib/types.js';

/**
 * Directory segment marking a spec as still active.
 *
 * Specs move out of `active/` when they are done or abandoned, so this is what
 * makes the mirror shrink on its own rather than accumulating forever.
 */
const ACTIVE_SPEC_SEGMENT = '/specs/active/';

/**
 * True when the bead carries a link to the given provider.
 */
export function isLinkedTo(issue: Issue, provider: ProviderNameType): boolean {
  return (issue.linked ?? []).some((entry) => entry.provider === provider);
}

/**
 * True when the bead's spec qualifies under the configured rule.
 */
export function matchesSpecRule(issue: Issue, rule: IntegrationSelect['specs']): boolean {
  if (rule === 'none') {
    return false;
  }
  const specPath = issue.spec_path;
  if (!specPath) {
    return false;
  }
  if (rule === 'any') {
    return true;
  }
  // Normalize separators so a Windows-authored path still matches.
  return specPath.replace(/\\/g, '/').includes(ACTIVE_SPEC_SEGMENT);
}

/** Status gate, shared by the kind and spec rules. */
function statusAllowed(issue: Issue, select: IntegrationSelect): boolean {
  return select.statuses.length === 0 || select.statuses.includes(issue.status);
}

/** Label gate. Empty means no requirement, not "must have no labels". */
function labelsAllowed(issue: Issue, select: IntegrationSelect): boolean {
  if (select.labels.length === 0) {
    return true;
  }
  const labels = issue.labels ?? [];
  return select.labels.some((label) => labels.includes(label));
}

/**
 * True when the bead qualifies on its kind.
 */
function matchesKindRule(issue: Issue, select: IntegrationSelect): boolean {
  return select.kinds.length > 0 && select.kinds.includes(issue.kind);
}

/**
 * The set of beads to mirror.
 *
 * A bead qualifies when it is explicitly linked, or when it passes the status
 * and label gates AND matches either the kind rule or the spec rule. The two
 * rules are alternatives rather than requirements, so "every open epic" and
 * "everything with a live spec" can both be selected without one excluding the
 * other.
 *
 * An explicitly linked bead is always included, even once it stops matching:
 * someone linked it deliberately, and dropping it would strand the external item.
 */
export function mirrorSet(
  issues: readonly Issue[],
  select: IntegrationSelect,
  provider: ProviderNameType,
): Issue[] {
  return issues.filter((issue) => {
    if (select.linked && isLinkedTo(issue, provider)) {
      return true;
    }
    if (!statusAllowed(issue, select) || !labelsAllowed(issue, select)) {
      return false;
    }
    // With neither rule configured, the gates alone decide.
    if (select.kinds.length === 0 && select.specs === 'none') {
      return true;
    }
    return matchesKindRule(issue, select) || matchesSpecRule(issue, select.specs);
  });
}
