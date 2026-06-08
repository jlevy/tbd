/**
 * Centralized path constants for tbd.
 *
 * Directory structure (per spec):
 *
 * On main/dev branches:
 *   .tbd/
 *     Committed to the repo:
 *       config.yml            - Project configuration
 *       .gitignore            - Controls what's gitignored below
 *       workspaces/           - Persistent state (outbox, named workspaces)
 *     Gitignored (local only):
 *       state.yml             - Local state
 *       docs/                 - Installed documentation (regenerated on setup)
 *
 * In the Git common dir shared by all linked worktrees:
 *   $GIT_COMMON_DIR/tbd/
 *     layout.yml              - Shared layout metadata
 *     locks/data-sync.lock/   - Repo-scoped lock directory
 *     backups/                - Local repair/migration backups
 *     data-sync-worktree/     - Hidden worktree checkout of tbd-sync branch
 *       .tbd/data-sync/       - issues/, mappings/, attic/, meta.yml
 *
 * On tbd-sync branch:
 *   .tbd/
 *     data-sync/
 *       issues/
 *       mappings/
 *       attic/
 *       meta.yml
 */

import { execFile } from 'node:child_process';
import { homedir } from 'node:os';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { promisify } from 'node:util';

/** The tbd configuration directory on main branch */
export const TBD_DIR = '.tbd';

/** The config file path */
export const CONFIG_FILE = join(TBD_DIR, 'config.yml');

/** The local state file (gitignored) */
export const STATE_FILE = join(TBD_DIR, 'state.yml');

/** The worktree directory name */
export const WORKTREE_DIR_NAME = 'data-sync-worktree';

/** Legacy per-checkout worktree path used by f03 and earlier clients. */
export const LEGACY_WORKTREE_DIR = join(TBD_DIR, WORKTREE_DIR_NAME);

/**
 * @internal Primary-checkout relative path to the shared sync worktree.
 *
 * Only valid when `.git` is a directory (i.e., the primary checkout). Production
 * code must call resolveSharedTbdPaths() instead: linked worktrees have a `.git`
 * file, so this constant resolves to the wrong location for them. Intended for
 * tests and the non-git fallback in resolveDataSyncDir().
 */
export const PRIMARY_CHECKOUT_WORKTREE_DIR = join('.git', 'tbd', WORKTREE_DIR_NAME);

/** The data directory name on the sync branch */
export const DATA_SYNC_DIR_NAME = 'data-sync';

/**
 * The data directory path as it appears on the tbd-sync branch.
 * In a normal checkout this same relative path is a legacy/wrong-location fallback;
 * production callers should resolve the absolute shared worktree path with
 * resolveDataSyncDir().
 */
export const DATA_SYNC_DIR = join(TBD_DIR, DATA_SYNC_DIR_NAME);

/**
 * @internal Primary-checkout relative path to the synced data via the shared worktree.
 *
 * Same caveat as `PRIMARY_CHECKOUT_WORKTREE_DIR`: only valid for a primary checkout.
 * Production code should resolve the absolute path with resolveDataSyncDir(); this
 * constant is intended for tests and the non-git fallback path.
 */
export const PRIMARY_CHECKOUT_DATA_SYNC_DIR = join(
  PRIMARY_CHECKOUT_WORKTREE_DIR,
  TBD_DIR,
  DATA_SYNC_DIR_NAME,
);

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
// Git Common-Dir Shared Sync Paths
// =============================================================================

const execFileAsync = promisify(execFile);

/** Directory name under $GIT_COMMON_DIR for tbd local machinery. */
export const GIT_COMMON_TBD_DIR_NAME = 'tbd';

/** Common-dir layout metadata file name. */
export const COMMON_DIR_LAYOUT_FILE_NAME = 'layout.yml';

/** Shared lock directory name under $GIT_COMMON_DIR/tbd/. */
export const SHARED_LOCKS_DIR_NAME = 'locks';

/** Shared backups directory name under $GIT_COMMON_DIR/tbd/. */
export const SHARED_BACKUPS_DIR_NAME = 'backups';

/** Directory-lock name for shared data-sync operations. */
export const DATA_SYNC_LOCK_DIR_NAME = 'data-sync.lock';

/**
 * Resolved Git common-dir paths for the repo-scoped sync layout.
 */
export interface SharedTbdPaths {
  /** Absolute Git common directory shared by all linked worktrees. */
  gitCommonDir: string;
  /** Absolute $GIT_COMMON_DIR/tbd path. */
  sharedTbdDir: string;
  /** Absolute shared hidden worktree path. */
  sharedWorktreePath: string;
  /** Absolute data-sync directory inside the shared worktree. */
  sharedDataSyncDir: string;
  /** Absolute common-dir layout metadata path. */
  sharedLayoutPath: string;
  /** Absolute shared lock directory parent. */
  sharedLocksDir: string;
  /** Absolute data-sync lock path. */
  sharedLockPath: string;
  /** Absolute shared backups directory. */
  sharedBackupsDir: string;
}

/**
 * Resolve Git's common directory from any checkout or linked worktree.
 */
export async function resolveGitCommonDir(cwd: string): Promise<string> {
  let output: string;
  try {
    const { stdout } = await execFileAsync('git', ['-C', cwd, 'rev-parse', '--git-common-dir'], {
      maxBuffer: 1024 * 1024,
    });
    output = stdout.trim();
  } catch {
    const { stdout } = await execFileAsync(
      'git',
      ['-C', cwd, 'rev-parse', '--path-format=absolute', '--git-common-dir'],
      { maxBuffer: 1024 * 1024 },
    );
    output = stdout.trim();
  }

  if (!output) {
    throw new Error(`Unable to resolve Git common directory from ${cwd}`);
  }

  const gitCommonDir = isAbsolute(output) ? output : resolve(cwd, output);
  return realpath(gitCommonDir).catch(() => gitCommonDir);
}

/**
 * Build all shared tbd paths from an absolute Git common directory.
 */
export function buildSharedTbdPaths(gitCommonDir: string): SharedTbdPaths {
  const sharedTbdDir = join(gitCommonDir, GIT_COMMON_TBD_DIR_NAME);
  const sharedWorktreePath = join(sharedTbdDir, WORKTREE_DIR_NAME);
  const sharedDataSyncDir = join(sharedWorktreePath, TBD_DIR, DATA_SYNC_DIR_NAME);
  const sharedLayoutPath = join(sharedTbdDir, COMMON_DIR_LAYOUT_FILE_NAME);
  const sharedLocksDir = join(sharedTbdDir, SHARED_LOCKS_DIR_NAME);
  const sharedLockPath = join(sharedLocksDir, DATA_SYNC_LOCK_DIR_NAME);
  const sharedBackupsDir = join(sharedTbdDir, SHARED_BACKUPS_DIR_NAME);

  return {
    gitCommonDir,
    sharedTbdDir,
    sharedWorktreePath,
    sharedDataSyncDir,
    sharedLayoutPath,
    sharedLocksDir,
    sharedLockPath,
    sharedBackupsDir,
  };
}

/**
 * Resolve the shared tbd paths for the repository containing baseDir.
 */
export async function resolveSharedTbdPaths(baseDir: string): Promise<SharedTbdPaths> {
  return buildSharedTbdPaths(await resolveGitCommonDir(baseDir));
}

/**
 * True when the Git common dir lives outside the project checkout — the linked
 * worktree shape where the checkout can be writable while `$GIT_COMMON_DIR/tbd`
 * (shared sync state + lock) is not. This is the generic signal behind the
 * Codex-sandbox case in #164; it does not depend on any `CODEX_*` env var, which
 * that sandbox did not expose. Used by both the `doctor` lock-writability finding
 * and the write-side `SharedLockUnwritableError` so their wording matches.
 */
export function isCommonDirOutsideProject(gitCommonDir: string, projectRoot: string): boolean {
  const rel = relative(resolve(projectRoot), resolve(gitCommonDir));
  return rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel);
}

// =============================================================================
// Workspace Paths (for sync failure recovery, backups, bulk editing)
// =============================================================================

/** The workspaces directory name within .tbd/ */
export const WORKSPACES_DIR_NAME = 'workspaces';

/** Full path to workspaces directory: .tbd/workspaces/ */
export const WORKSPACES_DIR = join(TBD_DIR, WORKSPACES_DIR_NAME);

/**
 * Get the path to a named workspace directory.
 *
 * Workspaces are stored at: .tbd/workspaces/{name}/
 *
 * @param workspaceName - The name of the workspace (e.g., 'outbox', 'my-feature')
 * @returns Path to the workspace directory
 */
export function getWorkspaceDir(workspaceName: string): string {
  return join(WORKSPACES_DIR, workspaceName);
}

/**
 * Get the path to a workspace's issues directory.
 *
 * @param workspaceName - The name of the workspace
 * @returns Path to the workspace's issues directory
 */
export function getWorkspaceIssuesDir(workspaceName: string): string {
  return join(getWorkspaceDir(workspaceName), 'issues');
}

/**
 * Get the path to a workspace's mappings directory.
 *
 * @param workspaceName - The name of the workspace
 * @returns Path to the workspace's mappings directory
 */
export function getWorkspaceMappingsDir(workspaceName: string): string {
  return join(getWorkspaceDir(workspaceName), 'mappings');
}

/**
 * Get the path to a workspace's attic directory.
 *
 * The attic stores conflict backups during workspace save operations.
 *
 * @param workspaceName - The name of the workspace
 * @returns Path to the workspace's attic directory
 */
export function getWorkspaceAtticDir(workspaceName: string): string {
  return join(getWorkspaceDir(workspaceName), 'attic');
}

/**
 * Validate a workspace name.
 *
 * Valid workspace names:
 * - Lowercase alphanumeric characters
 * - Hyphens and underscores allowed
 * - Must not be empty
 * - Must not contain path separators or dots at start
 *
 * @param name - The workspace name to validate
 * @returns true if the name is valid
 */
export function isValidWorkspaceName(name: string): boolean {
  if (!name || name.length === 0) {
    return false;
  }

  // Must not start with dot (hidden files)
  if (name.startsWith('.')) {
    return false;
  }

  // Only allow lowercase alphanumeric, hyphens, and underscores
  // No spaces, path separators, or special characters
  const validPattern = /^[a-z0-9][a-z0-9_-]*$/;
  return validPattern.test(name);
}

// =============================================================================
// Documentation/Shortcuts Paths
// =============================================================================

/** Docs directory name within .tbd/ */
export const DOCS_DIR = 'docs';

/** Shortcuts directory name within docs/ */
export const SHORTCUTS_DIR = 'shortcuts';

/** System shortcuts directory name (core docs like skill-baseline.md) */
export const SYSTEM_DIR = 'system';

/** Standard shortcuts directory name (workflow shortcuts) */
export const STANDARD_DIR = 'standard';

/** Guidelines directory name (coding rules and best practices) */
export const GUIDELINES_DIR = 'guidelines';

/** Templates directory name (document templates) */
export const TEMPLATES_DIR = 'templates';

/** Full path to docs directory: .tbd/docs/ */
export const TBD_DOCS_DIR = join(TBD_DIR, DOCS_DIR);

/** Full path to shortcuts directory: .tbd/docs/shortcuts/ */
export const TBD_SHORTCUTS_DIR = join(TBD_DOCS_DIR, SHORTCUTS_DIR);

/** Full path to system shortcuts: .tbd/docs/shortcuts/system/ */
export const TBD_SHORTCUTS_SYSTEM = join(TBD_SHORTCUTS_DIR, SYSTEM_DIR);

/** Full path to standard shortcuts: .tbd/docs/shortcuts/standard/ */
export const TBD_SHORTCUTS_STANDARD = join(TBD_SHORTCUTS_DIR, STANDARD_DIR);

/** Full path to guidelines: .tbd/docs/guidelines/ (top-level, not under shortcuts) */
export const TBD_GUIDELINES_DIR = join(TBD_DOCS_DIR, GUIDELINES_DIR);

/** Full path to templates: .tbd/docs/templates/ (top-level, not under shortcuts) */
export const TBD_TEMPLATES_DIR = join(TBD_DOCS_DIR, TEMPLATES_DIR);

/** Built-in docs source paths (relative to package docs/) */
export const BUILTIN_SHORTCUTS_SYSTEM = join(SHORTCUTS_DIR, SYSTEM_DIR);
export const BUILTIN_SHORTCUTS_STANDARD = join(SHORTCUTS_DIR, STANDARD_DIR);

/** Built-in guidelines source path (relative to package docs/) */
export const BUILTIN_GUIDELINES_DIR = GUIDELINES_DIR;

/** Built-in templates source path (relative to package docs/) */
export const BUILTIN_TEMPLATES_DIR = TEMPLATES_DIR;

/** Install directory name (header files for tool-specific installation) */
export const INSTALL_DIR = 'install';

/** Built-in install source path (relative to package docs/) */
export const BUILTIN_INSTALL_DIR = INSTALL_DIR;

/**
 * Default shortcut lookup paths (searched in order, relative to tbd root).
 * Earlier paths take precedence over later paths.
 * Note: Guidelines and templates are now separate top-level directories.
 */
export const DEFAULT_SHORTCUT_PATHS = [
  TBD_SHORTCUTS_SYSTEM, // .tbd/docs/shortcuts/system/
  TBD_SHORTCUTS_STANDARD, // .tbd/docs/shortcuts/standard/
];

/**
 * Default guidelines lookup paths (relative to tbd root).
 */
export const DEFAULT_GUIDELINES_PATHS = [
  TBD_GUIDELINES_DIR, // .tbd/docs/guidelines/
];

/**
 * Default template lookup paths (relative to tbd root).
 */
export const DEFAULT_TEMPLATE_PATHS = [
  TBD_TEMPLATES_DIR, // .tbd/docs/templates/
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

import { access, realpath } from 'node:fs/promises';

/**
 * Options for resolveDataSyncDir.
 */
export interface ResolveDataSyncDirOptions {
  /**
   * Allow fallback to direct path when worktree is missing.
   * Set to true for test environments or diagnostic tools.
   * Default: true. When false and worktree is missing, throws WorktreeMissingError.
   */
  allowFallback?: boolean;
}

/**
 * Error thrown when worktree is missing and fallback is not allowed.
 * Defined inline to avoid circular dependency with errors.ts.
 */
export class WorktreeMissingError extends Error {
  constructor(
    message = "Shared worktree not found under $GIT_COMMON_DIR/tbd/data-sync-worktree/. Run 'tbd doctor --fix' to repair.",
  ) {
    super(message);
    this.name = 'WorktreeMissingError';
  }
}

/**
 * Cache for resolved data sync directory.
 * Reset when baseDir changes.
 */
let _resolvedDataSyncDir: string | null = null;
let _resolvedBaseDir: string | null = null;
let _resolvedAllowFallback: boolean | null = null;

/**
 * Resolve the actual data sync directory path.
 *
 * This function detects whether we're running with a git worktree
 * (production) or in a test environment without worktree.
 *
 * Order of preference:
 * 1. Shared worktree path if it exists:
 *    $GIT_COMMON_DIR/tbd/data-sync-worktree/.tbd/data-sync/
 * 2. Direct path as fallback (only if allowFallback: true, for tests/diagnostics)
 *
 * @param baseDir - The tbd root directory (from requireInit or findTbdRoot)
 * @param options - Options for path resolution
 * @returns Resolved data sync directory path
 * @throws WorktreeMissingError if worktree missing and allowFallback is false
 *
 * See: plan-2026-01-28-sync-worktree-recovery-and-hardening.md
 */
export async function resolveDataSyncDir(
  baseDir: string,
  options?: ResolveDataSyncDirOptions,
): Promise<string> {
  const allowFallback = options?.allowFallback ?? true;

  // Return cached result if baseDir and options haven't changed
  if (
    _resolvedDataSyncDir &&
    _resolvedBaseDir === baseDir &&
    _resolvedAllowFallback === allowFallback
  ) {
    return _resolvedDataSyncDir;
  }

  let worktreePath: string | null = null;
  try {
    worktreePath = (await resolveSharedTbdPaths(baseDir)).sharedDataSyncDir;
  } catch {
    // Not in a git repository or git is unavailable. Check the static primary-checkout
    // path for unit tests before falling back to the direct diagnostic path.
    worktreePath = join(baseDir, PRIMARY_CHECKOUT_DATA_SYNC_DIR);
  }
  const directPath = join(baseDir, DATA_SYNC_DIR);

  // Check if worktree path exists
  if (worktreePath) {
    try {
      await access(worktreePath);
      _resolvedDataSyncDir = worktreePath;
      _resolvedBaseDir = baseDir;
      _resolvedAllowFallback = allowFallback;
      return worktreePath;
    } catch {
      // Worktree doesn't exist
    }
  }

  {
    // Worktree doesn't exist
    if (!allowFallback) {
      throw new WorktreeMissingError();
    }

    // Fallback to direct path (test mode or diagnostic tools)
    // Note: In production, sync.ts checks worktree health before calling this
    // Debug warning to help detect unintended fallback usage
    if (process.env.DEBUG || process.env.TBD_DEBUG) {
      console.warn(
        '[tbd:paths] resolveDataSyncDir: worktree not found, falling back to direct path',
      );
    }
    // Intentionally do NOT cache the fallback result: a later call after the
    // worktree is created must rediscover the real path, not keep returning
    // the stale fallback.
    return directPath;
  }
}

/**
 * Resolve issues directory path.
 */
export async function resolveIssuesDir(
  baseDir: string,
  options?: ResolveDataSyncDirOptions,
): Promise<string> {
  const dataSyncDir = await resolveDataSyncDir(baseDir, options);
  return join(dataSyncDir, 'issues');
}

/**
 * Resolve mappings directory path.
 */
export async function resolveMappingsDir(
  baseDir: string,
  options?: ResolveDataSyncDirOptions,
): Promise<string> {
  const dataSyncDir = await resolveDataSyncDir(baseDir, options);
  return join(dataSyncDir, 'mappings');
}

/**
 * Resolve attic directory path.
 */
export async function resolveAtticDir(
  baseDir: string,
  options?: ResolveDataSyncDirOptions,
): Promise<string> {
  const dataSyncDir = await resolveDataSyncDir(baseDir, options);
  return join(dataSyncDir, 'attic');
}

/**
 * Clear the resolved path cache.
 * Call this when the repository state changes (e.g., after init).
 */
export function clearPathCache(): void {
  _resolvedDataSyncDir = null;
  _resolvedBaseDir = null;
  _resolvedAllowFallback = null;
}

// =============================================================================
// Doc Path Resolution
// =============================================================================

/**
 * Resolve a doc path for consistent handling across the codebase.
 *
 * Path resolution rules:
 * - Absolute paths (starting with /): used as-is
 * - Home directory paths (starting with ~/): expanded to user home directory
 * - Relative paths: resolved from tbd root (baseDir)
 *
 * @param docPath - The path to resolve
 * @param baseDir - The tbd root directory (parent of .tbd/)
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
export function resolveDocPath(docPath: string, baseDir: string): string {
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

// =============================================================================
// Token Estimation Settings
// =============================================================================

/**
 * Characters per token ratio for estimating token counts.
 *
 * Based on research of OpenAI (tiktoken) and Claude tokenizers:
 * - Pure English prose: ~4-5 chars/token
 * - Code and symbols: ~3 chars/token
 * - Mixed markdown/code docs: ~3.5 chars/token
 *
 * We use 3.5 as our docs are markdown with code examples.
 * This provides ~15-20% accuracy, sufficient for cost estimation.
 */
export const CHARS_PER_TOKEN = 3.5;
