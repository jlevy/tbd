/**
 * Which beads an integration mirrors outward.
 *
 * The point of the mirror is the filter: mirroring the whole store would defeat
 * it. A bead qualifies by being an interesting *kind* (an epic) or by carrying a
 * live *plan spec*, with status acting as a gate over both so finished work
 * drops out.
 */

import type { Issue, IntegrationSelect, ProviderNameType } from '../../lib/types.js';
import { readLink } from './link-store.js';

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
  return readLink(issue, provider) !== undefined;
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

/**
 * Why a bead ended up in the mirror set.
 *
 * The total alone cannot be sanity-checked. `spec_path` propagates from a parent
 * to every descendant, so a spec clause that reads like "the handful of plans we
 * are running" selects the whole subtree beneath each of them. Naming the reason
 * turns a number someone has to trust into one they can check: "109 by kind, 690
 * by inherited spec" is recognizably wrong in a way that "799" is not.
 */
export type SelectionReasonType = 'linked' | 'kind' | 'spec' | 'gates';

/**
 * The reason a bead qualifies, or `undefined` when it does not.
 *
 * Evaluated in the same order as `mirrorSet` so the answer always explains that
 * function's actual decision. `kind` wins over `spec` when both apply: kind is
 * the deliberate, bounded clause, and attributing an epic to its spec would
 * inflate the count that matters.
 */
export function selectionReason(
  issue: Issue,
  select: IntegrationSelect,
  provider: ProviderNameType,
): SelectionReasonType | undefined {
  if (select.linked && isLinkedTo(issue, provider)) {
    return 'linked';
  }
  if (!statusAllowed(issue, select) || !labelsAllowed(issue, select)) {
    return undefined;
  }
  if (select.kinds.length === 0 && select.specs === 'none') {
    return 'gates';
  }
  if (matchesKindRule(issue, select)) {
    return 'kind';
  }
  if (matchesSpecRule(issue, select.specs)) {
    return 'spec';
  }
  return undefined;
}

/** Count of selected beads per reason, for reporting a selection's shape. */
export type SelectionBreakdown = Record<SelectionReasonType, number>;

/**
 * Tally why each bead in `issues` was selected.
 *
 * Counts the same population `mirrorSet` returns, so the totals agree by
 * construction rather than by two call sites staying in step.
 */
export function selectionBreakdown(
  issues: readonly Issue[],
  select: IntegrationSelect,
  provider: ProviderNameType,
): SelectionBreakdown {
  const counts: SelectionBreakdown = { linked: 0, kind: 0, spec: 0, gates: 0 };
  for (const issue of issues) {
    const reason = selectionReason(issue, select, provider);
    if (reason) {
      counts[reason] += 1;
    }
  }
  return counts;
}
