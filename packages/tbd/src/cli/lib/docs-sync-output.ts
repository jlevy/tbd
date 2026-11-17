/**
 * Shared rendering for docs-cache sync results and the forked-docs drift notice.
 *
 * Used by both `tbd docs sync` (the canonical command) and `tbd sync --docs`
 * (kept as a deprecated alias), so the two surfaces cannot drift apart.
 */

import type { OutputManager } from './output.js';
import type { SyncDocsResult } from '../../file/doc-sync.js';
import { FORK_DIR } from '../../lib/paths.js';
import { readForkManifest } from '../../file/fork-manifest.js';
import { computeForkDriftSummary } from '../../file/doc-fork.js';
import { stripControlCharacters } from '../../lib/format-utils.js';

/** The counts a docs-cache sync reports, and carries in `--json` output. */
export interface DocSyncCounts {
  added: number;
  updated: number;
  removed: number;
  pruned: number;
  configChanged: boolean;
}

/** What a docs-cache sync would change, for a dry run. */
export interface DocSyncPreview {
  /** The dry-run line, such as `Would sync docs: +1 ~1 doc(s)`, or `Docs up to date`. */
  action: string;
  /** Whether a real sync would write anything. */
  pending: boolean;
  counts: DocSyncCounts;
}

export function docSyncCounts(result: SyncDocsResult): DocSyncCounts {
  return {
    added: result.added.length,
    updated: result.updated.length,
    removed: result.removed.length,
    pruned: result.pruned.length,
    configChanged: result.configChanged,
  };
}

/**
 * The `+N ~N -N` doc counts, or `''` when no doc changes. One helper for the dry run
 * and the real sync, so the preview reports the counts the real run prints.
 */
function docChangeSummary(result: SyncDocsResult): string {
  const counts = [
    ['+', result.added.length],
    ['~', result.updated.length],
    ['-', result.removed.length],
  ] as const;
  return counts
    .filter(([, count]) => count > 0)
    .map(([sign, count]) => `${sign}${count}`)
    .join(' ');
}

/**
 * Doc paths and error text come from `.tbd/config.yml` and the doc sources, which a
 * dry run may be reading in a repository the user does not yet trust: print them on
 * one line with control and format characters removed.
 */
function displayDocSyncText(text: string): string {
  return stripControlCharacters(text.replace(/[\r\n\t]+/gu, ' '));
}

function printDocSyncErrors(output: OutputManager, result: SyncDocsResult): void {
  for (const err of result.errors) {
    output.warn(
      `Doc sync error: ${displayDocSyncText(err.path)}: ${displayDocSyncText(err.error)}`,
    );
  }
}

/** Print the result of a docs-cache sync (writes applied). */
export function printDocSyncResult(output: OutputManager, result: SyncDocsResult): void {
  const hasChanges =
    result.added.length > 0 ||
    result.updated.length > 0 ||
    result.removed.length > 0 ||
    result.pruned.length > 0;

  if (!hasChanges) {
    output.success('Docs up to date');
    return;
  }

  const summary = docChangeSummary(result);
  if (summary) {
    output.success(`Synced docs: ${summary} doc(s)`);
  }

  if (result.pruned.length > 0) {
    output.info(`Removed ${result.pruned.length} stale config entry/entries`);
  }

  printDocSyncErrors(output, result);
}

/** Print what a docs-cache sync would change (dry-run / status view). */
export function printDocSyncStatus(output: OutputManager, result: SyncDocsResult): void {
  // This renderer writes a raw multi-line block to stdout, which under --json would
  // corrupt the machine-readable stream with a human banner whenever the docs cache
  // is stale (tbd-q5c7). The JSON document carries the sync state; the banner is
  // text-mode only.
  if (output.isJson) {
    return;
  }
  const colors = output.getColors();
  const hasChanges =
    result.added.length > 0 ||
    result.updated.length > 0 ||
    result.removed.length > 0 ||
    result.pruned.length > 0;

  if (!hasChanges) {
    output.success('Docs up to date');
    return;
  }

  console.log(colors.bold('Docs:'));
  if (result.added.length > 0) {
    console.log(`  ${colors.success(`+${result.added.length}`)} new doc(s) available`);
  }
  if (result.updated.length > 0) {
    console.log(`  ${colors.warn(`~${result.updated.length}`)} doc(s) to update`);
  }
  if (result.removed.length > 0) {
    console.log(`  ${colors.error(`-${result.removed.length}`)} doc(s) to remove`);
  }
  if (result.pruned.length > 0) {
    console.log(`  ${colors.dim(`${result.pruned.length}`)} stale config entry/entries`);
  }
}

/** What a docs-cache sync would write, as `printDocSyncResult` would then report it. */
export function previewDocSync(result: SyncDocsResult): DocSyncPreview {
  const changes: string[] = [];
  const summary = docChangeSummary(result);
  if (summary) {
    changes.push(`${summary} doc(s)`);
  }
  if (result.pruned.length > 0) {
    changes.push(`remove ${result.pruned.length} stale config entry/entries`);
  }
  if (result.configChanged) {
    changes.push('update docs_cache in .tbd/config.yml');
  }
  return {
    action: changes.length > 0 ? `Would sync docs: ${changes.join('; ')}` : 'Docs up to date',
    pending: changes.length > 0,
    counts: docSyncCounts(result),
  };
}

/**
 * Print a docs-cache dry run and return its preview. Text mode prints the preview line.
 * Under `--json` nothing goes to stdout, so the caller can put the counts in its one
 * result document. Errors go to stderr in both modes.
 */
export function printDocSyncDryRun(output: OutputManager, result: SyncDocsResult): DocSyncPreview {
  const preview = previewDocSync(result);
  if (!output.isJson) {
    if (preview.pending) {
      output.dryRun(preview.action, preview.counts);
    } else {
      output.success(preview.action);
    }
  }
  printDocSyncErrors(output, result);
  return preview;
}

/**
 * One-line awareness notice for forked docs: a cache refresh is exactly when
 * forks become stale, so drift is surfaced here, but never acted on (only the
 * explicit `tbd docs update` mutates tracked files). Best-effort: never fails
 * the surrounding sync.
 */
export async function printForkDriftNotice(output: OutputManager, tbdRoot: string): Promise<void> {
  try {
    const manifest = await readForkManifest(tbdRoot);
    const drift = await computeForkDriftSummary(tbdRoot, FORK_DIR, manifest);
    if (drift.forks === 0) {
      return;
    }
    const parts: string[] = [];
    if (drift.stale > 0) {
      parts.push(`${drift.stale} forked doc(s) have upstream updates; run 'tbd docs update'`);
    }
    if (drift.conflicted > 0) {
      parts.push(`${drift.conflicted} with unresolved conflict markers`);
    }
    if (drift.missing > 0) {
      parts.push(`${drift.missing} missing (deleted/renamed); see 'tbd docs status'`);
    }
    if (parts.length > 0) {
      output.notice(`Docs: ${parts.join('; ')}`);
    }
  } catch {
    // Drift awareness is best-effort; never fail a sync over it.
  }
}
