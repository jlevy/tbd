/**
 * Shared data context for tbd commands.
 *
 * Provides a single point to load common data needed by most commands:
 * - dataSyncDir: the path to the data sync directory
 * - mapping: the ID mapping (ULID to short ID)
 * - config: the project configuration
 * - prefix: the display prefix (from config.display.id_prefix)
 *
 * This eliminates the repetitive pattern of loading these individually in each command.
 *
 * For unified CLI + data context with helper methods, use FullCommandContext and
 * loadFullContext() which adds displayId() and other conveniences.
 */

import type { Command } from 'commander';
import type { IdMapping } from '../../file/id-mapping.js';
import { loadIdMapping, resolveToInternalId } from '../../file/id-mapping.js';
import { readConfigWithMigration, writeConfig } from '../../file/config.js';
import { CURRENT_FORMAT } from '../../lib/tbd-format.js';
import type { Config, CommonDirLayout } from '../../lib/types.js';
import { resolveDataSyncDir, resolveSharedTbdPaths, type SharedTbdPaths } from '../../lib/paths.js';
import { formatDisplayId, formatDebugId } from '../../lib/ids.js';
import type { CommandContext } from './context.js';
import { getCommandContext } from './context.js';
import { requireInit, NotFoundError } from './errors.js';
import { checkWorktreeHealth, repairWorktree } from '../../file/git.js';
import type { WorktreeHealth, WorktreeStatus } from '../../file/git.js';
import {
  ensureCommonDirLayout,
  readCommonDirLayout,
  validateCommonDirLayout,
  withSharedDataSyncLock,
} from '../../file/common-dir-layout.js';

/**
 * Data context containing commonly needed data for tbd commands.
 */
export interface TbdDataContext {
  /** Path to the data sync directory */
  dataSyncDir: string;
  /** ID mapping (ULID to short ID and vice versa) */
  mapping: IdMapping;
  /** Project configuration */
  config: Config;
  /** Display prefix from config (convenience accessor) */
  prefix: string;
  /** Resolved shared common-dir paths for the repo-scoped sync layout */
  sharedPaths: SharedTbdPaths;
  /** Worktree health status that was repaired while preparing the context, if any */
  repairedWorktreeStatus?: WorktreeStatus;
}

/**
 * Full command context combining CLI options with data context.
 * Provides unified access to all command needs with helper methods.
 */
export interface FullCommandContext extends TbdDataContext {
  /** CLI options (dryRun, verbose, json, debug, etc.) */
  cli: CommandContext;
  /**
   * Format an internal issue ID for display.
   * Automatically respects debug mode to show full internal ID.
   */
  displayId(internalId: string): string;
  /**
   * Resolve user input ID to internal ID.
   * @throws NotFoundError if the ID cannot be resolved
   */
  resolveId(inputId: string): string;
}

/**
 * Pure read-only snapshot of shared data-sync state.
 *
 * `probeDataSyncReadiness()` performs no I/O mutation. `ready === true` means the
 * shared layout and worktree are already valid and the on-disk config matches the
 * in-memory format, so a caller can read issue data without acquiring the shared
 * lock. `ready === false` means the caller must take the lock and run
 * `ensureSharedDataSyncLayout()` before reading.
 */
interface DataSyncProbe {
  config: Config;
  migrated: boolean;
  /** The `tbd_format` found in the on-disk config before migration ran, if any. */
  fromFormat: string | undefined;
  sharedPaths: SharedTbdPaths;
  layout: CommonDirLayout | null;
  health: WorktreeHealth;
  ready: boolean;
}

async function probeDataSyncReadiness(tbdRoot: string): Promise<DataSyncProbe> {
  const { config, migrated, fromFormat } = await readConfigWithMigration(tbdRoot);
  const sharedPaths = await resolveSharedTbdPaths(tbdRoot);
  const layout = await readCommonDirLayout(sharedPaths.sharedLayoutPath);
  if (layout) {
    // Validate eagerly even on the read path so future-format / mismatched
    // layouts fail closed before any I/O the caller might perform.
    validateCommonDirLayout(layout, config);
  }
  const health = await checkWorktreeHealth(tbdRoot, config.sync.branch);
  const ready = !migrated && layout !== null && health.valid;
  return { config, migrated, fromFormat, sharedPaths, layout, health, ready };
}

/**
 * Apply any pending first-use initialization, migration, or repair to the shared
 * data-sync layout. MUST be called while holding `withSharedDataSyncLock` so that
 * worktree repair, layout writes, and migrated-config writes are serialized.
 */
async function ensureSharedDataSyncLayout(
  tbdRoot: string,
  probe: DataSyncProbe,
): Promise<WorktreeStatus | undefined> {
  let repairedWorktreeStatus: WorktreeStatus | undefined;
  if (!probe.health.valid) {
    if (probe.health.status === 'missing' || probe.health.status === 'prunable') {
      const repairResult = await repairWorktree(
        tbdRoot,
        probe.health.status,
        probe.config.sync.remote,
        probe.config.sync.branch,
      );
      if (!repairResult.success) {
        throw new Error(`Failed to initialize shared data-sync worktree: ${repairResult.error}`);
      }
      repairedWorktreeStatus = probe.health.status;
    } else {
      throw new Error(
        `Shared data-sync worktree is ${probe.health.status}: ${
          probe.health.error ?? 'unknown error'
        }. Run 'tbd doctor --fix' to repair.`,
      );
    }
  }
  // Re-read inside the lock via ensureCommonDirLayout: if another writer wrote
  // a valid layout between our probe and lock acquisition this returns it
  // unchanged instead of overwriting.
  await ensureCommonDirLayout(probe.sharedPaths, probe.config);
  if (probe.migrated) {
    await writeConfig(tbdRoot, probe.config);
    notifyConfigMigrated(probe.fromFormat, CURRENT_FORMAT);
  }
  return repairedWorktreeStatus;
}

/**
 * Emit a one-time stderr notice when this checkout's `.tbd/config.yml` was migrated
 * (typically `fXX → fYY`). The config bump is the "publish" step of the format
 * migration and lands as a tracked diff on the current branch; users on a sibling
 * worktree (and even on main) deserve to know that without having to discover the
 * diff themselves later.
 *
 * See: docs/tbd-format-versioning.md (internal contributor guide) and
 * plan-2026-05-17-shared-common-dir-sync-worktree.md.
 */
function notifyConfigMigrated(fromFormat: string | undefined, toFormat: string): void {
  if (fromFormat === toFormat) return;
  const arrow = fromFormat ? `${fromFormat} → ${toFormat}` : `→ ${toFormat}`;
  process.stderr.write(
    `• tbd_format ${arrow}: .tbd/config.yml updated in this checkout. ` +
      `Commit on this branch or merge main to publish the format upgrade.\n`,
  );
}

/**
 * Emit a one-line stderr notice when a data command auto-materialized a missing
 * sync worktree at the point of use.
 *
 * The shared worktree can be absent in a fresh/ephemeral clone (or if it was
 * deleted). `withDataSyncContext` heals it transparently, but a silent heal on a
 * read/write command looks indistinguishable from "the tracker is empty" or "my
 * issue was saved normally" — the exact confusion reported in #135. A terse
 * stderr note keeps stdout (and JSON) clean while making the heal visible.
 */
export function notifyWorktreeRepaired(status: WorktreeStatus | undefined): void {
  if (status !== 'missing' && status !== 'prunable') return;
  process.stderr.write(
    `• tbd-sync worktree was ${status} — auto-materialized it ` +
      `(fresh clone, or the worktree was removed).\n`,
  );
}

async function assembleDataContext(
  tbdRoot: string,
  probe: DataSyncProbe,
  repairedWorktreeStatus?: WorktreeStatus,
): Promise<TbdDataContext> {
  const dataSyncDir = await resolveDataSyncDir(tbdRoot, { allowFallback: false });
  const mapping = await loadIdMapping(dataSyncDir);
  return {
    dataSyncDir,
    mapping,
    config: probe.config,
    prefix: probe.config.display.id_prefix,
    sharedPaths: probe.sharedPaths,
    repairedWorktreeStatus,
  };
}

/**
 * Load all common data context needed by tbd commands.
 *
 * For writers this is called inside `withSharedDataSyncLock` by
 * `withDataSyncContext({ lock: true }, ...)`, so any ensure/migrate/repair work
 * is serialized.
 */
export async function prepareDataSyncContext(tbdRoot: string): Promise<TbdDataContext> {
  const probe = await probeDataSyncReadiness(tbdRoot);
  const repairedWorktreeStatus = probe.ready
    ? undefined
    : await ensureSharedDataSyncLayout(tbdRoot, probe);
  return assembleDataContext(tbdRoot, probe, repairedWorktreeStatus);
}

/**
 * Prepare shared data-sync context, optionally holding the repo-scoped lock.
 *
 * - `{ lock: true }` (writers): always acquire the lock, then prepare under it.
 * - `{ lock: false }` (readers): probe first; only acquire the lock if first-use
 *   init/migrate/repair is actually required. Steady-state reads take no lock.
 */
export async function withDataSyncContext<T>(
  tbdRoot: string,
  options: { lock: boolean },
  fn: (context: TbdDataContext) => Promise<T>,
): Promise<T> {
  if (options.lock) {
    return withSharedDataSyncLock(tbdRoot, async () => fn(await prepareDataSyncContext(tbdRoot)));
  }
  const probe = await probeDataSyncReadiness(tbdRoot);
  if (probe.ready) {
    return fn(await assembleDataContext(tbdRoot, probe));
  }
  return withSharedDataSyncLock(tbdRoot, async () => {
    const reProbe = await probeDataSyncReadiness(tbdRoot);
    const repairedWorktreeStatus = reProbe.ready
      ? undefined
      : await ensureSharedDataSyncLayout(tbdRoot, reProbe);
    return fn(await assembleDataContext(tbdRoot, reProbe, repairedWorktreeStatus));
  });
}

/**
 * Load the shared data-sync context for a read-only command.
 *
 * Read commands skip the shared lock when the layout and worktree are already
 * valid and the on-disk config needs no migration. When first-use
 * init/migrate/repair IS required, the underlying `withDataSyncContext` takes
 * the lock and runs the ensure path so concurrent readers cannot race
 * migration or worktree repair.
 */
export async function loadDataContext(tbdRoot: string): Promise<TbdDataContext> {
  return withDataSyncContext(tbdRoot, { lock: false }, async (context) => {
    // Surface a silent worktree heal at the point of use (read commands). #135
    notifyWorktreeRepaired(context.repairedWorktreeStatus);
    return context;
  });
}

/**
 * Load unified command context with CLI options, data, and helper methods.
 *
 * This is the recommended way to initialize command context. It:
 * 1. Checks that tbd is initialized (calls requireInit)
 * 2. Loads data context (dataSyncDir, mapping, config, prefix)
 * 3. Extracts CLI context from Commander
 * 4. Provides helper methods like displayId() and resolveId()
 *
 * Usage:
 * ```ts
 * class MyHandler extends BaseCommand {
 *   async run(id: string): Promise<void> {
 *     const ctx = await loadFullContext(this.command);
 *     const internalId = ctx.resolveId(id);
 *     const issue = await readIssue(ctx.dataSyncDir, internalId);
 *     console.log(ctx.displayId(issue.id));
 *   }
 * }
 * ```
 *
 * @param command - The Commander command instance
 * @throws Error if tbd is not initialized or resources fail to load
 */
export async function loadFullContext(command: Command): Promise<FullCommandContext> {
  const tbdRoot = await requireInit();

  const cli = getCommandContext(command);
  const dataCtx = await loadDataContext(tbdRoot);

  return {
    ...dataCtx,
    cli,
    displayId(internalId: string): string {
      return cli.debug
        ? formatDebugId(internalId, dataCtx.mapping, dataCtx.prefix)
        : formatDisplayId(internalId, dataCtx.mapping, dataCtx.prefix);
    },
    resolveId(inputId: string): string {
      try {
        return resolveToInternalId(inputId, dataCtx.mapping);
      } catch {
        throw new NotFoundError('Issue', inputId);
      }
    },
  };
}
