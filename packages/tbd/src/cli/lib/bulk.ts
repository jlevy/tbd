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
import { readIssue, writeIssue } from '../../file/storage.js';
import { NotFoundError, CLIError } from './errors.js';
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
  /** Every deduplicated input in first-occurrence argv order (resolved and missing). */
  orderedInputs: string[];
}

/**
 * Resolve every input ID up front (validate-all-then-apply). Unknown inputs are
 * collected in `missing` so the caller can fail closed before any write.
 *
 * Duplicates are processed once: inputs resolving to an already-seen internal ID
 * (including the same issue under alias and canonical forms) are dropped, keeping
 * the first occurrence, so an issue is never mutated twice in one invocation.
 * `orderedInputs` records the surviving inputs in argv order so per-item results
 * can be reported in the order the user asked for them.
 */
export function resolveAllIds(inputIds: string[], mapping: IdMapping): IdResolution {
  const resolved: ResolvedId[] = [];
  const missing: string[] = [];
  const orderedInputs: string[] = [];
  const seenInternal = new Set<string>();
  const seenMissing = new Set<string>();
  for (const input of inputIds) {
    try {
      const internalId = resolveToInternalId(input, mapping);
      if (seenInternal.has(internalId)) {
        continue;
      }
      seenInternal.add(internalId);
      resolved.push({ input, internalId });
      orderedInputs.push(input);
    } catch {
      if (seenMissing.has(input)) {
        continue;
      }
      seenMissing.add(input);
      missing.push(input);
      orderedInputs.push(input);
    }
  }
  return { resolved, missing, orderedInputs };
}

export interface LoadedIssue extends ResolvedId {
  issue: Issue;
}

/**
 * Read every resolved issue before the caller writes anything, extending
 * validate-all-then-apply to the read layer.
 *
 * Only a genuinely absent file (`ENOENT`, i.e. a stale mapping) counts as a
 * missing issue: it aborts the batch with `NotFoundError`, or becomes a
 * `missing` outcome under `ignoreMissing`. Every other read failure — malformed
 * YAML, schema violations, permission or I/O errors — is a repository problem,
 * not an unknown ID, and always aborts the whole batch before any write, even
 * with `--ignore-missing`, preserving the original error.
 */
export async function loadAllIssues(
  dataSyncDir: string,
  resolved: ResolvedId[],
  ignoreMissing: boolean,
  outcomes: Map<string, BulkItemResult>,
): Promise<LoadedIssue[]> {
  const loaded: LoadedIssue[] = [];
  for (const { input, internalId } of resolved) {
    try {
      loaded.push({ input, internalId, issue: await readIssue(dataSyncDir, internalId) });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
      if (!ignoreMissing) {
        throw new NotFoundError('Issue', input);
      }
      outcomes.set(input, { id: input, action: 'missing', ok: false, skippedReason: 'not found' });
    }
  }
  return loaded;
}

/**
 * Assemble per-item outcomes into first-occurrence argv order, so results (text
 * and `--json`) always line up with what the user asked for, regardless of the
 * order in which reads, skips, and writes happened.
 */
export function orderedResults(
  orderedInputs: string[],
  outcomes: Map<string, BulkItemResult>,
): BulkItemResult[] {
  const results: BulkItemResult[] = [];
  for (const input of orderedInputs) {
    const r = outcomes.get(input);
    if (r) {
      results.push(r);
    }
  }
  return results;
}

/**
 * Fail loudly after a partially-applied batch: names every failed ID with its
 * underlying error on stderr (never suppressed, including under `--quiet`) and
 * exits non-zero. `attempted` counts only real write attempts, not skips.
 */
export function throwOnWriteFailures(results: BulkItemResult[], verb: string): void {
  const failed = results.filter((r) => r.action === 'failed');
  if (failed.length === 0) {
    return;
  }
  const changed = results.filter(
    (r) => r.action !== 'skipped' && r.action !== 'missing' && r.action !== 'failed',
  ).length;
  const detail = failed.map((f) => `${f.id} (${f.skippedReason ?? 'unknown error'})`).join(', ');
  throw new CLIError(
    `${failed.length} of ${failed.length + changed} attempted ${verb} writes failed: ${detail}`,
  );
}

export interface DependencyWriteOutcome {
  /** Display IDs whose blocker file was changed and persisted, in input order. */
  changed: string[];
  /** Display IDs where the requested edge was already in the desired state. */
  unchanged: string[];
  /** Per-target write failures, in input order. */
  failed: { id: string; message: string }[];
}

/**
 * Apply a dependency mutation across several blocker issue files, capturing
 * per-target write failures instead of aborting mid-batch. Multi-file
 * dependency writes have no transaction, so a failure after earlier
 * successes must be reported exactly (which edges landed and which did not),
 * never as a bare error that hides the partially-applied state. Shared by
 * `dep add`/`dep remove` (multi form) and `create --depends-on`.
 */
export async function applyDependencyWrites(
  dataSyncDir: string,
  blockers: { internalId: string; issue: Issue }[],
  displayOf: (internalId: string) => string,
  mutate: (issue: Issue) => 'changed' | 'unchanged',
): Promise<DependencyWriteOutcome> {
  const outcome: DependencyWriteOutcome = { changed: [], unchanged: [], failed: [] };
  for (const { internalId, issue } of blockers) {
    const displayId = displayOf(internalId);
    if (mutate(issue) === 'unchanged') {
      outcome.unchanged.push(displayId);
      continue;
    }
    try {
      await writeIssue(dataSyncDir, issue);
    } catch (error) {
      outcome.failed.push({
        id: displayId,
        message: error instanceof Error ? error.message : String(error),
      });
      continue;
    }
    outcome.changed.push(displayId);
  }
  return outcome;
}

/**
 * Fail loudly after a partially-applied dependency batch: name every failed
 * target with its underlying error, state that earlier writes persisted, and
 * give the exact command that finishes the job. Exit stays non-zero.
 */
export function throwOnDependencyWriteFailures(
  outcome: DependencyWriteOutcome,
  remedyCommand: string,
): void {
  if (outcome.failed.length === 0) {
    return;
  }
  const attempted = outcome.failed.length + outcome.changed.length;
  const detail = outcome.failed.map((f) => `${f.id} (${f.message})`).join(', ');
  throw new CLIError(
    `${outcome.failed.length} of ${attempted} dependency writes failed: ${detail}. ` +
      `Applied edges are kept; run \`${remedyCommand}\` to finish.`,
  );
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
    if (r.action === 'skipped') {
      skipped++;
    } else if (r.action === 'missing') {
      missing++;
    } else if (r.action === 'failed') {
      failed++;
    } else {
      changed++;
    }
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
    // Always present so the machine contract has a stable top-level shape;
    // the hint appears only when there is actually something to publish.
    sync: syncPending ? { pending: true, hint: 'Run `tbd sync` to publish.' } : { pending: false },
  };

  output.data(json, () => {
    const parts = [`${opts.verb} ${summary.changed}`];
    if (summary.skipped > 0) {
      parts.push(`skipped ${summary.skipped} (${opts.skippedNote})`);
    }
    if (summary.missing > 0) {
      parts.push(`not found ${summary.missing}`);
    }
    if (summary.failed > 0) {
      parts.push(`failed ${summary.failed}`);
    }
    const idList = results.map((r) => r.id).join(' ');
    const line = `${parts.join(', ')}: ${idList}`;
    // A batch with write failures must not carry the success marker; the
    // caller follows up with a per-ID error on stderr and a non-zero exit.
    if (summary.failed > 0) {
      output.warn(line);
    } else {
      output.success(line);
    }
    if (syncPending) {
      output.notice('Unsynced changes — run `tbd sync` to publish.');
    }
  });
}
