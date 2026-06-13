/**
 * Shared helpers for bulk (multi-target) mutators: `close`, `reopen`, `update`.
 *
 * Phase 1 of the agent CLI ergonomics work. A single ID keeps each command's
 * legacy behavior byte-for-byte; two or more IDs are processed under one lock
 * with a one-line summary and a structured `--json` results array. See
 * docs/project/specs/active/plan-2026-06-13-agent-cli-ergonomics.md.
 */

import type { IdMapping } from '../../file/id-mapping.js';
import { resolveToInternalId } from '../../file/id-mapping.js';

export interface ResolvedId {
  /** The ID exactly as the user typed it. */
  input: string;
  /** The resolved internal ULID-based ID. */
  internalId: string;
}

export interface IdResolution {
  resolved: ResolvedId[];
  /** Inputs that did not resolve, in input order. */
  missing: string[];
}

/**
 * Resolve every input ID up front (validate-all-then-apply). Unknown inputs are
 * collected in `missing` so the caller can fail closed before any write.
 */
export function resolveAllIds(inputIds: string[], mapping: IdMapping): IdResolution {
  const resolved: ResolvedId[] = [];
  const missing: string[] = [];
  for (const input of inputIds) {
    try {
      resolved.push({ input, internalId: resolveToInternalId(input, mapping) });
    } catch {
      missing.push(input);
    }
  }
  return { resolved, missing };
}

export type BulkAction = 'closed' | 'reopened' | 'updated' | 'skipped' | 'missing';

export interface BulkItemResult {
  /** Display ID, or the raw input when the issue could not be resolved/read. */
  id: string;
  action: BulkAction;
  ok: boolean;
  /** Human reason when `action` is `skipped` or `missing`. */
  skippedReason?: string;
}

export interface BulkSummary {
  /** Items actually mutated (action equals the verb, e.g. `closed`). */
  changed: number;
  /** Items left unchanged on purpose (e.g. already closed). */
  skipped: number;
  /** Inputs that could not be resolved (only present with `--ignore-missing`). */
  missing: number;
  total: number;
}

/** Tally a results array into a summary. */
export function summarizeBulk(results: BulkItemResult[]): BulkSummary {
  let changed = 0;
  let skipped = 0;
  let missing = 0;
  for (const r of results) {
    if (r.action === 'skipped') skipped++;
    else if (r.action === 'missing') missing++;
    else changed++;
  }
  return { changed, skipped, missing, total: results.length };
}

/** The machine-readable result item shape emitted under `--json`. */
export function toJsonResult(r: BulkItemResult): {
  id: string;
  action: BulkAction;
  ok: boolean;
  skippedReason?: string;
} {
  return r.skippedReason
    ? { id: r.id, action: r.action, ok: r.ok, skippedReason: r.skippedReason }
    : { id: r.id, action: r.action, ok: r.ok };
}
