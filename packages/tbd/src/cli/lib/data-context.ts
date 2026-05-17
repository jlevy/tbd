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
import type { Config } from '../../lib/types.js';
import { resolveDataSyncDir, resolveSharedTbdPaths, type SharedTbdPaths } from '../../lib/paths.js';
import { formatDisplayId, formatDebugId } from '../../lib/ids.js';
import type { CommandContext } from './context.js';
import { getCommandContext } from './context.js';
import { requireInit, NotFoundError } from './errors.js';
import { checkWorktreeHealth, repairWorktree } from '../../file/git.js';
import type { WorktreeStatus } from '../../file/git.js';
import {
  readCommonDirLayout,
  validateCommonDirLayout,
  writeCommonDirLayout,
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
 * Load all common data context needed by tbd commands.
 *
 * This loads:
 * - dataSyncDir from resolveDataSyncDir()
 * - mapping from loadIdMapping()
 * - config from readConfig()
 * - prefix from config.display.id_prefix
 *
 * Call this once at the start of a command handler instead of
 * loading each piece separately.
 *
 * @param tbdRoot - The tbd repository root directory (from requireInit or findTbdRoot)
 * @throws Error if any of the resources fail to load
 */
export async function prepareDataSyncContext(tbdRoot: string): Promise<TbdDataContext> {
  const { config, migrated } = await readConfigWithMigration(tbdRoot);
  const sharedPaths = await resolveSharedTbdPaths(tbdRoot);

  const existingLayout = await readCommonDirLayout(sharedPaths.sharedLayoutPath);
  if (existingLayout) {
    validateCommonDirLayout(existingLayout, config);
  }

  const health = await checkWorktreeHealth(tbdRoot, config.sync.branch);
  let repairedWorktreeStatus: WorktreeStatus | undefined;
  if (!health.valid) {
    if (health.status === 'missing' || health.status === 'prunable') {
      const repairResult = await repairWorktree(
        tbdRoot,
        health.status,
        config.sync.remote,
        config.sync.branch,
      );
      if (!repairResult.success) {
        throw new Error(`Failed to initialize shared data-sync worktree: ${repairResult.error}`);
      }
      repairedWorktreeStatus = health.status;
    } else {
      throw new Error(
        `Shared data-sync worktree is ${health.status}: ${
          health.error ?? 'unknown error'
        }. Run 'tbd doctor --fix' to repair.`,
      );
    }
  }

  if (existingLayout) {
    validateCommonDirLayout(existingLayout, config);
  } else {
    await writeCommonDirLayout(sharedPaths, config, existingLayout);
  }

  if (migrated) {
    await writeConfig(tbdRoot, config);
  }

  const dataSyncDir = await resolveDataSyncDir(tbdRoot, { allowFallback: false });
  const mapping = await loadIdMapping(dataSyncDir);
  return {
    dataSyncDir,
    mapping,
    config,
    prefix: config.display.id_prefix,
    sharedPaths,
    repairedWorktreeStatus,
  };
}

/**
 * Prepare shared data-sync context and optionally hold the repo-scoped lock
 * for the whole caller critical section.
 */
export async function withDataSyncContext<T>(
  tbdRoot: string,
  options: { lock: boolean },
  fn: (context: TbdDataContext) => Promise<T>,
): Promise<T> {
  const run = async () => fn(await prepareDataSyncContext(tbdRoot));
  if (options.lock) {
    return withSharedDataSyncLock(tbdRoot, run);
  }
  return run();
}

export async function loadDataContext(tbdRoot: string): Promise<TbdDataContext> {
  return withDataSyncContext(tbdRoot, { lock: true }, async (context) => context);
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
