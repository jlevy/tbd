/** Filesystem tokens used to validate one non-blocking local snapshot read. */

import { stat } from 'node:fs/promises';
import { basename } from 'node:path';

import { readDataSyncEpoch } from '../../file/data-sync-epoch.js';
import { DATA_SYNC_EPOCH_FILE_NAME } from '../../lib/paths.js';

function isMissingPath(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error.code === 'ENOENT' || error.code === 'ENOTDIR')
  );
}

/** Report whether a path exists while preserving unexpected filesystem failures. */
export async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if (isMissingPath(error)) {
      return false;
    }
    // NTFS can report a lock directory as delete-pending with EPERM while another
    // process releases it. Treat that brief state as locked; publishing is less safe
    // than retrying, and the next observer pass will recheck it.
    if (
      process.platform === 'win32' &&
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'EPERM'
    ) {
      return true;
    }
    throw error;
  }
}

/**
 * Read a constant-size metadata token for the paths that define the local web view.
 * The token is intentionally diagnostic rather than a content hash: standard tbd
 * writers also hold the shared writer lock, while this catches uncoordinated changes.
 */
export async function readMetadataMarker(paths: readonly string[]): Promise<string> {
  const parts = await Promise.all(
    paths.map(async (path) => {
      try {
        const metadata = await stat(path, { bigint: true });
        // Directory timestamps are enough to avoid a graph scan on unchanged ticks.
        // Include the bounded epoch contents as well: its UUID changes for every
        // standard writer, so reconciliation cannot miss a complete fast transaction
        // merely because a filesystem exposes coarse or colliding timestamps.
        const content =
          basename(path) === DATA_SYNC_EPOCH_FILE_NAME
            ? `:${(await readDataSyncEpoch(path)).token}`
            : '';
        return `${path}:${metadata.mtimeNs}:${metadata.ctimeNs}:${metadata.size}${content}`;
      } catch (error) {
        if (isMissingPath(error)) {
          return `${path}:missing`;
        }
        throw error;
      }
    }),
  );
  return parts.join('|');
}
