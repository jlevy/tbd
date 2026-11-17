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

  const parts: string[] = [];
  if (result.added.length > 0) {
    parts.push(`+${result.added.length}`);
  }
  if (result.updated.length > 0) {
    parts.push(`~${result.updated.length}`);
  }
  if (result.removed.length > 0) {
    parts.push(`-${result.removed.length}`);
  }

  if (parts.length > 0) {
    output.success(`Synced docs: ${parts.join(' ')} doc(s)`);
  }

  if (result.pruned.length > 0) {
    output.info(`Removed ${result.pruned.length} stale config entry/entries`);
  }

  for (const err of result.errors) {
    output.warn(`Doc sync error: ${err.path}: ${err.error}`);
  }
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

/**
 * Print what a docs-cache sync would write, as dry-run output: the same counts
 * `printDocSyncResult` reports after a real sync.
 */
export function printDocSyncDryRun(output: OutputManager, result: SyncDocsResult): void {
  const counts = [
    ['+', result.added.length],
    ['~', result.updated.length],
    ['-', result.removed.length],
  ] as const;
  const docs = counts.filter(([, count]) => count > 0).map(([sign, count]) => `${sign}${count}`);
  const changes: string[] = [];
  if (docs.length > 0) {
    changes.push(`${docs.join(' ')} doc(s)`);
  }
  if (result.pruned.length > 0) {
    changes.push(`remove ${result.pruned.length} stale config entry/entries`);
  }
  if (result.configChanged) {
    changes.push('update docs_cache in .tbd/config.yml');
  }

  if (changes.length === 0) {
    output.success('Docs up to date');
  } else {
    output.dryRun(`Would sync docs: ${changes.join('; ')}`, {
      added: result.added.length,
      updated: result.updated.length,
      removed: result.removed.length,
      pruned: result.pruned.length,
      configChanged: result.configChanged,
    });
  }
  for (const err of result.errors) {
    output.warn(`Doc sync error: ${err.path}: ${err.error}`);
  }
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
