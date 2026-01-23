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

/** Cached shortcut directory for embedding in skill output */
export const SHORTCUT_DIRECTORY_CACHE = join(CACHE_DIR, 'shortcut-directory.md');

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

// =============================================================================
// Documentation/Shortcuts Paths
// =============================================================================

/** Docs directory name within .tbd/ */
export const DOCS_DIR = 'docs';

/** Shortcuts directory name within docs/ */
export const SHORTCUTS_DIR = 'shortcuts';

/** System shortcuts directory name (core docs like skill.md) */
export const SYSTEM_DIR = 'system';

/** Standard shortcuts directory name (workflow shortcuts) */
export const STANDARD_DIR = 'standard';

/** Guidelines directory name (coding rules and best practices) */
export const GUIDELINES_DIR = 'guidelines';

/** Full path to docs directory: .tbd/docs/ */
export const TBD_DOCS_DIR = join(TBD_DIR, DOCS_DIR);

/** Full path to shortcuts directory: .tbd/docs/shortcuts/ */
export const TBD_SHORTCUTS_DIR = join(TBD_DOCS_DIR, SHORTCUTS_DIR);

/** Full path to system shortcuts: .tbd/docs/shortcuts/system/ */
export const TBD_SHORTCUTS_SYSTEM = join(TBD_SHORTCUTS_DIR, SYSTEM_DIR);

/** Full path to standard shortcuts: .tbd/docs/shortcuts/standard/ */
export const TBD_SHORTCUTS_STANDARD = join(TBD_SHORTCUTS_DIR, STANDARD_DIR);

/** Full path to guidelines: .tbd/docs/shortcuts/guidelines/ */
export const TBD_SHORTCUTS_GUIDELINES = join(TBD_SHORTCUTS_DIR, GUIDELINES_DIR);

/** Built-in docs source paths (relative to package docs/) */
export const BUILTIN_SHORTCUTS_SYSTEM = join(SHORTCUTS_DIR, SYSTEM_DIR);
export const BUILTIN_SHORTCUTS_STANDARD = join(SHORTCUTS_DIR, STANDARD_DIR);
export const BUILTIN_SHORTCUTS_GUIDELINES = join(SHORTCUTS_DIR, GUIDELINES_DIR);

/** Install directory name (header files for tool-specific installation) */
export const INSTALL_DIR = 'install';

/** Built-in install source path (relative to package docs/) */
export const BUILTIN_INSTALL_DIR = INSTALL_DIR;

/**
 * Default doc lookup paths (searched in order, relative to tbd root).
 * Earlier paths take precedence over later paths.
 */
export const DEFAULT_DOC_PATHS = [
  TBD_SHORTCUTS_SYSTEM, // .tbd/docs/shortcuts/system/
  TBD_SHORTCUTS_STANDARD, // .tbd/docs/shortcuts/standard/
  TBD_SHORTCUTS_GUIDELINES, // .tbd/docs/shortcuts/guidelines/
];

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

// =============================================================================
// Dynamic Path Resolution
// =============================================================================

import { access } from 'node:fs/promises';

/**
 * Cache for resolved data sync directory.
 * Reset when baseDir changes.
 */
let _resolvedDataSyncDir: string | null = null;
let _resolvedBaseDir: string | null = null;

/**
 * Resolve the actual data sync directory path.
 *
 * This function detects whether we're running with a git worktree
 * (production) or in a test environment without worktree.
 *
 * Order of preference:
 * 1. Worktree path if worktree exists: .tbd/data-sync-worktree/.tbd/data-sync/
 * 2. Direct path as fallback: .tbd/data-sync/
 *
 * @param baseDir - The base directory of the repository (default: process.cwd())
 * @returns Resolved data sync directory path
 */
export async function resolveDataSyncDir(baseDir: string = process.cwd()): Promise<string> {
  // Return cached result if baseDir hasn't changed
  if (_resolvedDataSyncDir && _resolvedBaseDir === baseDir) {
    return _resolvedDataSyncDir;
  }

  const worktreePath = join(baseDir, DATA_SYNC_DIR_VIA_WORKTREE);
  const directPath = join(baseDir, DATA_SYNC_DIR);

  // Check if worktree path exists
  try {
    await access(worktreePath);
    _resolvedDataSyncDir = worktreePath;
    _resolvedBaseDir = baseDir;
    return worktreePath;
  } catch {
    // Worktree doesn't exist, use direct path
    _resolvedDataSyncDir = directPath;
    _resolvedBaseDir = baseDir;
    return directPath;
  }
}

/**
 * Resolve issues directory path.
 */
export async function resolveIssuesDir(baseDir: string = process.cwd()): Promise<string> {
  const dataSyncDir = await resolveDataSyncDir(baseDir);
  return join(dataSyncDir, 'issues');
}

/**
 * Resolve mappings directory path.
 */
export async function resolveMappingsDir(baseDir: string = process.cwd()): Promise<string> {
  const dataSyncDir = await resolveDataSyncDir(baseDir);
  return join(dataSyncDir, 'mappings');
}

/**
 * Resolve attic directory path.
 */
export async function resolveAtticDir(baseDir: string = process.cwd()): Promise<string> {
  const dataSyncDir = await resolveDataSyncDir(baseDir);
  return join(dataSyncDir, 'attic');
}

/**
 * Clear the resolved path cache.
 * Call this when the repository state changes (e.g., after init).
 */
export function clearPathCache(): void {
  _resolvedDataSyncDir = null;
  _resolvedBaseDir = null;
}

// =============================================================================
// Doc Path Resolution
// =============================================================================

import { isAbsolute } from 'node:path';
import { homedir } from 'node:os';

/**
 * Resolve a doc path for consistent handling across the codebase.
 *
 * Path resolution rules:
 * - Absolute paths (starting with /): used as-is
 * - Home directory paths (starting with ~/): expanded to user home directory
 * - Relative paths: resolved from tbd root (baseDir)
 *
 * @param docPath - The path to resolve
 * @param baseDir - The tbd root directory (parent of .tbd/), defaults to cwd
 * @returns Resolved absolute path
 *
 * @example
 * // Absolute path - returned as-is
 * resolveDocPath('/usr/local/docs/file.md') // => '/usr/local/docs/file.md'
 *
 * // Home path - expanded
 * resolveDocPath('~/docs/file.md') // => '/Users/username/docs/file.md'
 *
 * // Relative path - resolved from baseDir
 * resolveDocPath('docs/file.md', '/project') // => '/project/docs/file.md'
 */
export function resolveDocPath(docPath: string, baseDir: string = process.cwd()): string {
  // Handle home directory expansion
  if (docPath.startsWith('~/')) {
    return join(homedir(), docPath.slice(2));
  }

  // Absolute paths used as-is
  if (isAbsolute(docPath)) {
    return docPath;
  }

  // Relative paths resolved from baseDir (tbd root)
  return join(baseDir, docPath);
}
