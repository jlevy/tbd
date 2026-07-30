/**
 * Near-miss suggestions for unknown issue IDs, so "Issue not found" errors
 * point at the likely intended bead instead of stranding the agent in a
 * list/grep detour.
 */

import type { IdMapping } from '../../file/id-mapping.js';
import { resolveToInternalId } from '../../file/id-mapping.js';
import { NotFoundError } from './errors.js';

/**
 * Suggestion limits. Beyond MAX_SUGGESTION_DISTANCE edits a candidate is more
 * likely to mislead than help (IDs are only ~9 characters), and more than
 * MAX_SUGGESTIONS entries turns an error into a listing.
 */
const ID_SUGGESTION_LIMITS = {
  maxDistance: 2,
  maxSuggestions: 3,
} as const;

/** Levenshtein edit distance (insert/delete/substitute, cost 1 each). */
function editDistance(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const dist: number[] = Array.from({ length: cols }, (_, j) => j);
  for (let i = 1; i < rows; i++) {
    let prevDiagonal = dist[0]!;
    dist[0] = i;
    for (let j = 1; j < cols; j++) {
      const previous = dist[j]!;
      dist[j] = Math.min(
        dist[j]! + 1,
        dist[j - 1]! + 1,
        prevDiagonal + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      prevDiagonal = previous;
    }
  }
  return dist[cols - 1]!;
}

/**
 * Rank known display IDs near the unknown inputs. Distance is measured
 * against both the full display ID (`proj-ab3k`) and the bare short ID, so a
 * missing or mistyped prefix still suggests well. Empty when nothing is close
 * enough; no suggestion beats a wrong one.
 */
export function suggestSimilarIds(inputs: string[], mapping: IdMapping, prefix: string): string[] {
  const scored = new Map<string, number>();
  for (const shortId of mapping.shortToUlid.keys()) {
    const displayId = `${prefix}-${shortId}`;
    let best = Infinity;
    for (const rawInput of inputs) {
      const input = rawInput.toLowerCase();
      best = Math.min(best, editDistance(input, displayId), editDistance(input, shortId));
    }
    if (best <= ID_SUGGESTION_LIMITS.maxDistance) {
      scored.set(displayId, Math.min(best, scored.get(displayId) ?? Infinity));
    }
  }
  return Array.from(scored.entries())
    .sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]))
    .slice(0, ID_SUGGESTION_LIMITS.maxSuggestions)
    .map(([displayId]) => displayId);
}

/**
 * Resolve an issue ID or throw the standard `NotFoundError` carrying
 * near-miss suggestions. Every single-ID CLI boundary should resolve through
 * this (bulk paths use `resolveAllIds` and attach the hint to their
 * fail-closed error), so recovery hints never depend on which handler
 * happened to resolve the ID.
 */
export function resolveIssueId(input: string, mapping: IdMapping, prefix: string): string {
  try {
    return resolveToInternalId(input, mapping);
  } catch {
    throw new NotFoundError('Issue', input, issueNotFoundHint([input], mapping, prefix));
  }
}

/**
 * Compose the optional "Issue not found" hint: a did-you-mean line plus a
 * pointer to `tbd search` (which also matches IDs). Undefined when there is
 * no close candidate, keeping the plain error stable for that case.
 */
export function issueNotFoundHint(
  inputs: string[],
  mapping: IdMapping,
  prefix: string,
): string | undefined {
  const suggestions = suggestSimilarIds(inputs, mapping, prefix);
  if (suggestions.length === 0) {
    return undefined;
  }
  return `Did you mean: ${suggestions.join(', ')}? (\`tbd search <text>\` finds issues by content or ID)`;
}
