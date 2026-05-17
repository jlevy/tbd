/**
 * Git common-dir layout metadata for shared issue sync machinery.
 */

import { readFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { writeFile } from 'atomically';
import { parse as parseYaml } from 'yaml';

import type { CommonDirLayout, Config } from '../lib/types.js';
import { CommonDirLayoutSchema, COMMON_DIR_LAYOUT_FIELD_ORDER } from '../lib/schemas.js';
import { resolveSharedTbdPaths, type SharedTbdPaths } from '../lib/paths.js';
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
        `'${config.tbd_format}'. Run 'tbd doctor --fix' to repair.`,
    );
  }

  const layoutStorage: string = layout.sync_storage;
  const configStorage: string = config.sync.storage;
  if (layoutStorage !== configStorage) {
    throw new CommonDirLayoutError(
      `Common-dir sync storage '${layoutStorage}' does not match config storage ` +
        `'${configStorage}'. Run 'tbd doctor --fix' to repair.`,
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
 * Run a critical section while holding the repo-scoped data-sync lock.
 */
export async function withSharedDataSyncLock<T>(tbdRoot: string, fn: () => Promise<T>): Promise<T> {
  const paths = await resolveSharedTbdPaths(tbdRoot);
  await mkdir(paths.sharedLocksDir, { recursive: true });
  return withLockfile(paths.sharedLockPath, fn, DATA_SYNC_LOCK_OPTIONS);
}
