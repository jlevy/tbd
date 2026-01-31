/**
 * Workspace operations for sync failure recovery, backups, and bulk editing.
 *
 * Workspaces are directories under .tbd/workspaces/ that store issue data.
 * They mirror the data-sync directory structure:
 *   .tbd/workspaces/{name}/
 *     issues/
 *     mappings/
 *     attic/
 *
 * See: plan-2026-01-30-workspace-sync-alt.md
 */

import { mkdir, readdir, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { stringify as stringifyYaml } from 'yaml';
import { writeFile } from 'atomically';

import { listIssues, writeIssue, readIssue } from './storage.js';
import { mergeIssues, type ConflictEntry } from './git.js';
import { WORKSPACES_DIR, getWorkspaceDir, isValidWorkspaceName } from '../lib/paths.js';
import { now } from '../utils/time-utils.js';
import type { AtticEntry } from '../lib/types.js';

/**
 * Options for saveToWorkspace.
 * One of workspace, dir, or outbox must be specified.
 */
export interface SaveOptions {
  /** Named workspace under .tbd/workspaces/ */
  workspace?: string;
  /** Arbitrary directory path */
  dir?: string;
  /** Shortcut for --workspace=outbox --updates-only */
  outbox?: boolean;
  /** Only save issues modified since last sync */
  updatesOnly?: boolean;
}

/**
 * Result from saveToWorkspace operation.
 */
export interface SaveResult {
  /** Number of issues saved */
  saved: number;
  /** Number of conflicts (went to attic) */
  conflicts: number;
  /** Target directory where issues were saved */
  targetDir: string;
}

/**
 * Options for importFromWorkspace.
 * One of workspace, dir, or outbox must be specified.
 */
export interface ImportOptions {
  /** Named workspace under .tbd/workspaces/ */
  workspace?: string;
  /** Arbitrary directory path */
  dir?: string;
  /** Shortcut for --workspace=outbox --clear-on-success */
  outbox?: boolean;
  /** Delete workspace after successful import */
  clearOnSuccess?: boolean;
}

/**
 * Result from importFromWorkspace operation.
 */
export interface ImportResult {
  /** Number of issues imported */
  imported: number;
  /** Number of conflicts (went to attic) */
  conflicts: number;
  /** Source directory where issues were imported from */
  sourceDir: string;
  /** Whether the source was deleted after import */
  cleared: boolean;
}

/**
 * Ensure a directory exists.
 */
async function ensureDir(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true });
}

/**
 * Convert ConflictEntry to AtticEntry format and save to workspace attic.
 */
async function saveConflictToAttic(
  atticDir: string,
  conflict: ConflictEntry,
  winnerSource: 'local' | 'remote',
): Promise<void> {
  const timestamp = now();

  // Convert lost_value to string - handle objects, primitives, and nullish
  const lostValueStr =
    conflict.lost_value == null
      ? ''
      : typeof conflict.lost_value === 'object'
        ? JSON.stringify(conflict.lost_value)
        : JSON.stringify(conflict.lost_value);

  const entry: AtticEntry = {
    entity_id: conflict.issue_id,
    timestamp,
    field: conflict.field,
    lost_value: lostValueStr,
    winner_source: winnerSource,
    loser_source: winnerSource === 'local' ? 'remote' : 'local',
    context: {
      local_version: conflict.local_version,
      remote_version: conflict.remote_version,
      local_updated_at: timestamp,
      remote_updated_at: timestamp,
    },
  };

  // Create filename: {entity_id}_{timestamp}_{field}.yml
  const safeTimestamp = timestamp.replace(/:/g, '-');
  const filename = `${conflict.issue_id}_${safeTimestamp}_${conflict.field}.yml`;
  const filepath = join(atticDir, filename);

  const content = stringifyYaml(entry, { sortMapEntries: true });
  await writeFile(filepath, content);
}

/**
 * Get the target/source directory for workspace operations.
 */
function resolveWorkspaceDir(
  tbdRoot: string,
  options: { workspace?: string; dir?: string; outbox?: boolean },
): string {
  if (options.dir) {
    return options.dir;
  }

  const workspaceName = options.outbox ? 'outbox' : options.workspace;
  if (!workspaceName) {
    throw new Error('One of --workspace, --dir, or --outbox is required');
  }

  if (!isValidWorkspaceName(workspaceName)) {
    throw new Error(`Invalid workspace name: ${workspaceName}`);
  }

  return join(tbdRoot, getWorkspaceDir(workspaceName));
}

/**
 * Get the target directory for save operation.
 * @deprecated Use resolveWorkspaceDir instead
 */
function getTargetDir(tbdRoot: string, options: SaveOptions): string {
  return resolveWorkspaceDir(tbdRoot, options);
}

/**
 * Save issues from data-sync directory to a workspace or directory.
 *
 * Uses mergeIssues() for proper conflict detection when an issue exists
 * in both source (worktree) and target (workspace). Conflicts are saved
 * to the workspace's attic.
 *
 * @param tbdRoot - The root directory of the tbd project
 * @param dataSyncDir - The data-sync directory containing source issues
 * @param options - Save options (workspace name, directory, or outbox)
 * @returns Save result with counts
 */
export async function saveToWorkspace(
  tbdRoot: string,
  dataSyncDir: string,
  options: SaveOptions,
): Promise<SaveResult> {
  const targetDir = getTargetDir(tbdRoot, options);

  // Create target directory structure
  const atticDir = join(targetDir, 'attic');

  await ensureDir(join(targetDir, 'issues'));
  await ensureDir(join(targetDir, 'mappings'));
  await ensureDir(atticDir);

  // List all issues in source (worktree)
  const sourceIssues = await listIssues(dataSyncDir);

  // TODO: Implement --updates-only logic
  // For now, save all issues (ignoring updatesOnly flag)
  const _isUpdatesOnly = options.updatesOnly ?? options.outbox;

  let saved = 0;
  let conflicts = 0;

  // Save each issue to target, merging if needed
  for (const sourceIssue of sourceIssues) {
    // Check if issue already exists in workspace
    let targetIssue = null;
    try {
      targetIssue = await readIssue(targetDir, sourceIssue.id);
    } catch {
      // Issue doesn't exist in target - will be created
    }

    if (targetIssue) {
      // Issue exists in both - merge
      // Use null base since we don't track common ancestor
      // mergeIssues uses created_at as tiebreaker, so put newer version as "local" to win
      const sourceTime = new Date(sourceIssue.updated_at).getTime();
      const targetTime = new Date(targetIssue.updated_at).getTime();

      let result;
      let winnerSource: 'local' | 'remote';
      if (sourceTime >= targetTime) {
        // Source (worktree) is newer - put as local so it wins
        result = mergeIssues(null, sourceIssue, targetIssue);
        winnerSource = 'local';
      } else {
        // Target (workspace) is newer - put as local so it wins
        result = mergeIssues(null, targetIssue, sourceIssue);
        winnerSource = 'remote';
      }

      // Save merged issue
      await writeIssue(targetDir, result.merged);
      saved++;

      // Save any conflicts to workspace attic
      for (const conflict of result.conflicts) {
        await saveConflictToAttic(atticDir, conflict, winnerSource);
        conflicts++;
      }
    } else {
      // New issue - just save
      await writeIssue(targetDir, sourceIssue);
      saved++;
    }
  }

  // TODO: Copy mappings

  return {
    saved,
    conflicts,
    targetDir,
  };
}

/**
 * Import issues from a workspace or directory to the data-sync directory.
 *
 * Uses mergeIssues() for proper conflict detection when an issue exists
 * in both source (workspace) and target (worktree). Conflicts are saved
 * to the worktree's attic.
 *
 * @param tbdRoot - The root directory of the tbd project
 * @param dataSyncDir - The data-sync directory to import into
 * @param options - Import options (workspace name, directory, or outbox)
 * @returns Import result with counts
 */
export async function importFromWorkspace(
  tbdRoot: string,
  dataSyncDir: string,
  options: ImportOptions,
): Promise<ImportResult> {
  const sourceDir = resolveWorkspaceDir(tbdRoot, options);

  // Determine if we should clear on success
  // --outbox implies --clear-on-success
  const shouldClear = options.clearOnSuccess ?? options.outbox ?? false;

  // Create attic directory in target (worktree)
  const atticDir = join(dataSyncDir, 'attic');
  await ensureDir(atticDir);

  // List all issues in source workspace
  const sourceIssues = await listIssues(sourceDir);

  let imported = 0;
  let conflicts = 0;

  // Import each issue to data-sync, merging if needed
  for (const sourceIssue of sourceIssues) {
    // Check if issue already exists in worktree
    let targetIssue = null;
    try {
      targetIssue = await readIssue(dataSyncDir, sourceIssue.id);
    } catch {
      // Issue doesn't exist in target - will be created
    }

    if (targetIssue) {
      // Issue exists in both - merge
      // Use null base since we don't track common ancestor
      // mergeIssues uses created_at as tiebreaker, so put newer version as "local" to win
      const sourceTime = new Date(sourceIssue.updated_at).getTime();
      const targetTime = new Date(targetIssue.updated_at).getTime();

      let result;
      let winnerSource: 'local' | 'remote';
      if (sourceTime >= targetTime) {
        // Source (workspace) is newer - put as local so it wins
        result = mergeIssues(null, sourceIssue, targetIssue);
        winnerSource = 'local';
      } else {
        // Target (worktree) is newer - put as local so it wins
        result = mergeIssues(null, targetIssue, sourceIssue);
        winnerSource = 'remote';
      }

      // Save merged issue
      await writeIssue(dataSyncDir, result.merged);
      imported++;

      // Save any conflicts to worktree attic
      for (const conflict of result.conflicts) {
        await saveConflictToAttic(atticDir, conflict, winnerSource);
        conflicts++;
      }
    } else {
      // New issue - just save
      await writeIssue(dataSyncDir, sourceIssue);
      imported++;
    }
  }

  // TODO: Copy mappings

  // Clear source workspace if requested
  let cleared = false;
  if (shouldClear && imported > 0) {
    const workspaceName = options.outbox ? 'outbox' : options.workspace;
    if (workspaceName) {
      await deleteWorkspace(tbdRoot, workspaceName);
      cleared = true;
    }
  }

  return {
    imported,
    conflicts,
    sourceDir,
    cleared,
  };
}

/**
 * List all workspaces in .tbd/workspaces/.
 *
 * @param tbdRoot - The root directory of the tbd project
 * @returns Array of workspace names
 */
export async function listWorkspaces(tbdRoot: string): Promise<string[]> {
  const workspacesDir = join(tbdRoot, WORKSPACES_DIR);

  let entries: string[];
  try {
    entries = await readdir(workspacesDir);
  } catch {
    // Directory doesn't exist
    return [];
  }

  // Filter to directories only
  const workspaces: string[] = [];
  for (const entry of entries) {
    try {
      const entryPath = join(workspacesDir, entry);
      const entryStat = await stat(entryPath);
      if (entryStat.isDirectory()) {
        workspaces.push(entry);
      }
    } catch {
      // Skip entries we can't stat
    }
  }

  return workspaces;
}

/**
 * Delete a workspace.
 *
 * @param tbdRoot - The root directory of the tbd project
 * @param name - Workspace name
 */
export async function deleteWorkspace(tbdRoot: string, name: string): Promise<void> {
  const workspaceDir = join(tbdRoot, getWorkspaceDir(name));

  try {
    await rm(workspaceDir, { recursive: true, force: true });
  } catch {
    // Ignore errors if workspace doesn't exist
  }
}

/**
 * Check if a workspace exists.
 *
 * @param tbdRoot - The root directory of the tbd project
 * @param name - Workspace name
 * @returns true if the workspace directory exists
 */
export async function workspaceExists(tbdRoot: string, name: string): Promise<boolean> {
  const workspaceDir = join(tbdRoot, getWorkspaceDir(name));

  try {
    const s = await stat(workspaceDir);
    return s.isDirectory();
  } catch {
    return false;
  }
}
