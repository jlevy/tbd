/**
 * Git common-dir layout metadata for shared issue sync machinery.
 */

import { readFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { writeFile } from 'atomically';
import { parse as parseYaml } from 'yaml';

import type { CommonDirLayout, Config } from '../lib/types.js';
import { CommonDirLayoutSchema, COMMON_DIR_LAYOUT_FIELD_ORDER } from '../lib/schemas.js';
import {
  isCommonDirOutsideProject,
  resolveSharedTbdPaths,
  type SharedTbdPaths,
} from '../lib/paths.js';
import { CURRENT_FORMAT, formatUpgradeMessage, isCompatibleFormat } from '../lib/tbd-format.js';
import { sortKeys, stringifyYaml } from '../utils/yaml-utils.js';
import { now } from '../utils/time-utils.js';
import { DATA_SYNC_LOCK_OPTIONS, withLockfile } from '../utils/lockfile.js';

/**
 * Error thrown when common-dir layout metadata cannot be used safely.
 */
export class CommonDirLayoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CommonDirLayoutError';
  }
}

/**
 * Read $GIT_COMMON_DIR/tbd/layout.yml, returning null when it has not been created yet.
 */
export async function readCommonDirLayout(layoutPath: string): Promise<CommonDirLayout | null> {
  try {
    const content = await readFile(layoutPath, 'utf-8');
    return CommonDirLayoutSchema.parse(parseYaml(content));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    throw new CommonDirLayoutError(
      `Invalid tbd common-dir layout metadata at ${layoutPath}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

/**
 * Validate that common-dir layout metadata matches the checkout config.
 */
export function validateCommonDirLayout(layout: CommonDirLayout, config: Config): void {
  if (!isCompatibleFormat(layout.tbd_format)) {
    throw new CommonDirLayoutError(
      formatUpgradeMessage('Common-dir layout', layout.tbd_format, CURRENT_FORMAT),
    );
  }

  if (layout.tbd_format !== config.tbd_format) {
    throw new CommonDirLayoutError(
      `Common-dir layout format '${layout.tbd_format}' does not match config format ` +
        `'${config.tbd_format}'. This indicates a partial migration or manual edit. ` +
        `Run 'tbd doctor --fix' to rewrite the layout from the current config. ` +
        `(Manual fallback: rm "$(git rev-parse --git-common-dir)/tbd/layout.yml".)`,
    );
  }

  const layoutStorage: string = layout.sync_storage;
  const configStorage: string = config.sync.storage;
  if (layoutStorage !== configStorage) {
    throw new CommonDirLayoutError(
      `Common-dir sync storage '${layoutStorage}' does not match config storage ` +
        `'${configStorage}'. This indicates a partial migration or manual edit. ` +
        `Run 'tbd doctor --fix' to rewrite the layout from the current config. ` +
        `(Manual fallback: rm "$(git rev-parse --git-common-dir)/tbd/layout.yml".)`,
    );
  }
}

/**
 * Write common-dir layout metadata using the synchronized tbd_format ID.
 */
export async function writeCommonDirLayout(
  paths: SharedTbdPaths,
  config: Config,
  existing?: CommonDirLayout | null,
): Promise<CommonDirLayout> {
  await mkdir(dirname(paths.sharedLayoutPath), { recursive: true });

  const timestamp = now();
  const layout = CommonDirLayoutSchema.parse({
    tbd_format: config.tbd_format,
    sync_storage: config.sync.storage,
    data_sync_worktree: 'data-sync-worktree',
    lock_profile: 'data-sync-v1',
    created_at: existing?.created_at ?? timestamp,
    updated_at: timestamp,
  });

  const sorted = sortKeys(
    layout as unknown as Record<string, unknown>,
    COMMON_DIR_LAYOUT_FIELD_ORDER,
  );
  const yaml = stringifyYaml(sorted, { lineWidth: 0, sortMapEntries: false });
  await writeFile(paths.sharedLayoutPath, yaml);
  return layout;
}

/**
 * Ensure layout metadata exists and matches the checkout config.
 */
export async function ensureCommonDirLayout(
  paths: SharedTbdPaths,
  config: Config,
): Promise<CommonDirLayout> {
  const existing = await readCommonDirLayout(paths.sharedLayoutPath);
  if (existing) {
    validateCommonDirLayout(existing, config);
    return existing;
  }

  return writeCommonDirLayout(paths, config);
}

/**
 * Error thrown when the shared data-sync lock cannot be created because the lock
 * path is not writable by this process (EPERM/EACCES).
 *
 * The common trigger is an agent sandbox (e.g. Codex) where the *checkout* is
 * writable but `$GIT_COMMON_DIR/tbd` — which holds the shared sync worktree and
 * the lock — lives in the user's original repo directory, outside the sandbox's
 * writable boundary. Read-only commands work, but any write needs the lock and
 * fails here. This is fatal for the command: without the lock we cannot safely
 * mutate shared state. See issue #164.
 */
export class SharedLockUnwritableError extends Error {
  constructor(
    public readonly code: string,
    paths: SharedTbdPaths,
    projectRoot: string,
  ) {
    // Mirror the doctor finding's inside/outside classification so the wording is
    // accurate in both the agent-sandbox case (common dir outside the checkout)
    // and a plain filesystem-permission case (common dir inside the checkout).
    const outside = isCommonDirOutsideProject(paths.gitCommonDir, projectRoot);
    const cause = outside
      ? `The checkout is writable, but the shared tbd state under ${paths.sharedTbdDir} ` +
        `is outside this process's writable area (a common agent-sandbox shape, e.g. Codex ` +
        `worktrees), so write commands cannot proceed.`
      : `The shared tbd state under ${paths.sharedTbdDir} is not writable by this process, ` +
        `so write commands cannot proceed.`;
    const fix = outside
      ? `Fix: grant write access to ${paths.sharedTbdDir} — in an agent sandbox such as Codex ` +
        `add it to the writable roots, or re-run with sandbox escalation.`
      : `Fix: ensure ${paths.sharedTbdDir} is writable by this user (check filesystem permissions).`;
    super(
      `Cannot acquire the shared tbd data-sync lock (${code}): ${paths.sharedLockPath}\n` +
        `${cause}\n${fix} Run \`tbd doctor\` to confirm the diagnosis.`,
    );
    this.name = 'SharedLockUnwritableError';
  }
}

/**
 * Return the EPERM/EACCES code if `error` is a filesystem permission error,
 * otherwise undefined. Used to translate raw lock-creation failures into a
 * clear, actionable error.
 */
function lockPermissionCode(error: unknown): string | undefined {
  const code = (error as NodeJS.ErrnoException | undefined)?.code;
  return code === 'EPERM' || code === 'EACCES' ? code : undefined;
}

/**
 * Run a critical section while holding the repo-scoped data-sync lock.
 *
 * A permission failure creating either the locks directory or the lock itself
 * is rethrown as a `SharedLockUnwritableError` with remediation. The lock-path
 * match keeps an unrelated EPERM thrown by `fn` (e.g. writing issue data) from
 * being misreported as a lock-writability problem.
 */
export async function withSharedDataSyncLock<T>(tbdRoot: string, fn: () => Promise<T>): Promise<T> {
  const paths = await resolveSharedTbdPaths(tbdRoot);

  try {
    // `mkdir(..., { recursive: true })` resolves silently when the directory
    // already exists, so an EPERM here means the locks tree itself is unwritable.
    await mkdir(paths.sharedLocksDir, { recursive: true });
  } catch (error) {
    const code = lockPermissionCode(error);
    if (code) {
      throw new SharedLockUnwritableError(code, paths, tbdRoot);
    }
    throw error;
  }

  try {
    return await withLockfile(paths.sharedLockPath, fn, DATA_SYNC_LOCK_OPTIONS);
  } catch (error) {
    // Only translate a permission failure on the lock directory itself. `fn`
    // writes issue data elsewhere (the worktree), so its errors pass through.
    // The `.path` match relies on withLockfile surfacing the raw `mkdir`
    // ErrnoException (which carries `.path`); revisit this guard if that changes.
    const code = lockPermissionCode(error);
    if (code && (error as NodeJS.ErrnoException | undefined)?.path === paths.sharedLockPath) {
      throw new SharedLockUnwritableError(code, paths, tbdRoot);
    }
    throw error;
  }
}
