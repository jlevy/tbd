/**
 * Shared helpers for bulk (multi-target) mutators: `close`, `reopen`, `update`.
 *
 * Phase 1 of the agent CLI ergonomics work. A single ID keeps each command's
 * legacy behavior byte-for-byte; two or more IDs are processed under one lock
 * with a one-line summary and a structured `--json` results array. See
 * docs/project/specs/active/plan-2026-06-13-agent-cli-ergonomics.md.
 */

import type { Issue } from '../../lib/types.js';
import type { IdMapping } from '../../file/id-mapping.js';
import { resolveToInternalId } from '../../file/id-mapping.js';
import { readIssue } from '../../file/storage.js';
import { NotFoundError } from './errors.js';
import type { OutputManager } from './output.js';

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
 *
 * Duplicates are processed once: inputs resolving to an already-seen internal ID
 * (including the same issue under alias and canonical forms) are dropped, keeping
 * the first occurrence, so an issue is never mutated twice in one invocation.
 */
export function resolveAllIds(inputIds: string[], mapping: IdMapping): IdResolution {
  const resolved: ResolvedId[] = [];
  const missing: string[] = [];
  const seenInternal = new Set<string>();
  const seenMissing = new Set<string>();
  for (const input of inputIds) {
    try {
      const internalId = resolveToInternalId(input, mapping);
      if (seenInternal.has(internalId)) continue;
      seenInternal.add(internalId);
      resolved.push({ input, internalId });
    } catch {
      if (seenMissing.has(input)) continue;
      seenMissing.add(input);
      missing.push(input);
    }
  }
  return { resolved, missing };
}

export interface LoadedIssue extends ResolvedId {
  issue: Issue;
}

/**
 * Read every resolved issue before the caller writes anything, extending
 * validate-all-then-apply to the read layer: an ID that resolves in the mapping
 * but whose file cannot be read (stale mapping, corrupted file) aborts the whole
 * batch with `NotFoundError` — unless `ignoreMissing` is set, in which case it is
 * reported as a `missing` result and the rest of the batch proceeds.
 */
export async function loadAllIssues(
  dataSyncDir: string,
  resolved: ResolvedId[],
  ignoreMissing: boolean,
  results: BulkItemResult[],
): Promise<LoadedIssue[]> {
  const loaded: LoadedIssue[] = [];
  for (const { input, internalId } of resolved) {
    try {
      loaded.push({ input, internalId, issue: await readIssue(dataSyncDir, internalId) });
    } catch {
      if (!ignoreMissing) {
        throw new NotFoundError('Issue', input);
      }
      results.push({ id: input, action: 'missing', ok: false, skippedReason: 'not found' });
    }
  }
  return loaded;
}

export type BulkAction = 'closed' | 'reopened' | 'updated' | 'skipped' | 'missing' | 'failed';

export interface BulkItemResult {
  /** Display ID, or the raw input when the issue could not be resolved/read. */
  id: string;
  action: BulkAction;
  ok: boolean;
  /** Human reason when `action` is `skipped`, `missing`, or `failed`. */
  skippedReason?: string;
}

export interface BulkSummary {
  /** Items actually mutated (action equals the verb, e.g. `closed`). */
  changed: number;
  /** Items left unchanged on purpose (e.g. already closed). */
  skipped: number;
  /** Inputs that could not be resolved (only present with `--ignore-missing`). */
  missing: number;
  /** Items whose write failed after validation (partial application). */
  failed: number;
  total: number;
}

/** Tally a results array into a summary. */
export function summarizeBulk(results: BulkItemResult[]): BulkSummary {
  let changed = 0;
  let skipped = 0;
  let missing = 0;
  let failed = 0;
  for (const r of results) {
    if (r.action === 'skipped') skipped++;
    else if (r.action === 'missing') missing++;
    else if (r.action === 'failed') failed++;
    else changed++;
  }
  return { changed, skipped, missing, failed, total: results.length };
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

/**
 * Emit the shared bulk result: one deterministic summary line in text mode, the
 * structured `results`/`summary`/`sync` object under `--json`, and a visible
 * unsynced-changes hint via `output.notice()`. Shared by `close`, `reopen`, and
 * `update` so the multi-target output contract stays identical across verbs.
 *
 * `verb` is the past-tense word for changed items (e.g. `Closed`); `skippedNote`
 * is the parenthetical reason for skipped items (e.g. `already closed`). A verb
 * that never skips (e.g. `update`) simply never renders the skipped clause.
 */
export function emitBulkSummary(
  output: OutputManager,
  results: BulkItemResult[],
  opts: { verb: string; skippedNote: string },
): void {
  const summary = summarizeBulk(results);
  const syncPending = summary.changed > 0;
  const json: Record<string, unknown> = {
    results: results.map(toJsonResult),
    summary,
  };
  if (syncPending) {
    json.sync = { pending: true, hint: 'Run `tbd sync` to publish.' };
  }

  output.data(json, () => {
    const parts = [`${opts.verb} ${summary.changed}`];
    if (summary.skipped > 0) parts.push(`skipped ${summary.skipped} (${opts.skippedNote})`);
    if (summary.missing > 0) parts.push(`not found ${summary.missing}`);
    if (summary.failed > 0) parts.push(`failed ${summary.failed}`);
    const idList = results.map((r) => r.id).join(' ');
    output.success(`${parts.join(', ')}: ${idList}`);
    if (syncPending) {
      output.notice('Unsynced changes — run `tbd sync` to publish.');
    }
  });
}
