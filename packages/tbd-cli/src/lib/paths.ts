/**
 * Centralized path constants for tbd.
 *
 * Directory structure (per spec):
 *
 * On main/dev branches:
 *   .tbd/
 *     config.yml              - Project configuration (tracked)
 *     .gitignore              - Ignores cache/, data-sync-worktree/, data-sync/
 *     cache/                  - Local state (gitignored)
 *     data-sync-worktree/     - Hidden worktree checkout of tbd-sync branch
 *       .tbd/
 *         data-sync/
 *           issues/
 *           mappings/
 *           attic/
 *           meta.yml
 *
 * On tbd-sync branch:
 *   .tbd/
 *     data-sync/
 *       issues/
 *       mappings/
 *       attic/
 *       meta.yml
 */

import { join } from 'node:path';

/** The tbd configuration directory on main branch */
export const TBD_DIR = '.tbd';

/** The config file path */
export const CONFIG_FILE = join(TBD_DIR, 'config.yml');

/** The local cache directory (gitignored) */
export const CACHE_DIR = join(TBD_DIR, 'cache');

/** The worktree directory name */
export const WORKTREE_DIR_NAME = 'data-sync-worktree';

/** The worktree path (gitignored) */
export const WORKTREE_DIR = join(TBD_DIR, WORKTREE_DIR_NAME);

/** The data directory name on the sync branch */
export const DATA_SYNC_DIR_NAME = 'data-sync';

/**
 * The base directory for synced data.
 *
 * NOTE: This is currently pointing directly to .tbd/data-sync/ which is WRONG
 * per the spec. The correct path should be via the worktree:
 *   .tbd/data-sync-worktree/.tbd/data-sync/
 *
 * TODO(tbd-208): Update this to use the worktree path once worktree
 * management is implemented.
 */
export const DATA_SYNC_DIR = join(TBD_DIR, DATA_SYNC_DIR_NAME);

/**
 * The correct path for synced data via worktree (per spec).
 * Use this once worktree management is implemented.
 */
export const DATA_SYNC_DIR_VIA_WORKTREE = join(WORKTREE_DIR, TBD_DIR, DATA_SYNC_DIR_NAME);

/** Issues directory */
export const ISSUES_DIR = join(DATA_SYNC_DIR, 'issues');

/** Mappings directory */
export const MAPPINGS_DIR = join(DATA_SYNC_DIR, 'mappings');

/** Attic directory for conflict resolution */
export const ATTIC_DIR = join(DATA_SYNC_DIR, 'attic');

/** Meta file for schema version */
export const META_FILE = join(DATA_SYNC_DIR, 'meta.yml');

/** The sync branch name */
export const SYNC_BRANCH = 'tbd-sync';

/**
 * Get the full path to an issue file.
 */
export function getIssuePath(issueId: string): string {
  return join(ISSUES_DIR, `${issueId}.md`);
}

/**
 * Get the full path to a mapping file.
 */
export function getMappingPath(name: string): string {
  return join(MAPPINGS_DIR, `${name}.yml`);
}

/**
 * Get the full path to an attic entry.
 */
export function getAtticPath(issueId: string, filename: string): string {
  return join(ATTIC_DIR, 'conflicts', issueId, filename);
}
