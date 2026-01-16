/**
 * Storage layer for issue files.
 *
 * Provides atomic file operations and issue CRUD operations.
 * All operations work on the hidden worktree at .tbd/data-sync/issues/.
 *
 * See: tbd-design-v3.md §3.2 Storage Layer
 */

import { readFile, writeFile, unlink, readdir, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { randomBytes } from 'node:crypto';

import type { Issue } from '../lib/types.js';
import { parseIssue, serializeIssue } from './parser.js';

/**
 * Atomic file write using temp file + rename pattern.
 * Prevents corruption from crashes during write.
 */
export async function atomicWriteFile(filePath: string, content: string): Promise<void> {
  // Ensure parent directory exists
  const dir = dirname(filePath);
  await mkdir(dir, { recursive: true });

  // Write to temp file then rename
  const tempPath = `${filePath}.${randomBytes(8).toString('hex')}.tmp`;

  try {
    await writeFile(tempPath, content, 'utf-8');
    // Rename is atomic on POSIX systems
    const { rename } = await import('node:fs/promises');
    await rename(tempPath, filePath);
  } catch (error) {
    // Clean up temp file on error
    try {
      await unlink(tempPath);
    } catch {
      // Ignore cleanup errors
    }
    throw error;
  }
}

/**
 * Get the path to an issue file.
 */
function getIssuePath(baseDir: string, id: string): string {
  return join(baseDir, 'issues', `${id}.md`);
}

/**
 * Read an issue from the worktree.
 * @throws If the issue file doesn't exist or is invalid.
 */
export async function readIssue(baseDir: string, id: string): Promise<Issue> {
  const filePath = getIssuePath(baseDir, id);
  const content = await readFile(filePath, 'utf-8');
  return parseIssue(content);
}

/**
 * Write an issue to the worktree.
 * Uses atomic write to prevent corruption.
 */
export async function writeIssue(baseDir: string, issue: Issue): Promise<void> {
  const filePath = getIssuePath(baseDir, issue.id);
  const content = serializeIssue(issue);
  await atomicWriteFile(filePath, content);
}

/**
 * List all issues in the worktree.
 * Returns empty array if issues directory doesn't exist.
 */
export async function listIssues(baseDir: string): Promise<Issue[]> {
  const issuesDir = join(baseDir, 'issues');

  let files: string[];
  try {
    files = await readdir(issuesDir);
  } catch {
    // Directory doesn't exist - return empty
    return [];
  }

  const issues: Issue[] = [];

  for (const file of files) {
    if (!file.endsWith('.md')) continue;

    const id = file.slice(0, -3); // Remove .md extension
    try {
      const issue = await readIssue(baseDir, id);
      issues.push(issue);
    } catch (error) {
      // Skip invalid files with a warning (in production, would log this)
      console.warn(`Skipping invalid issue file: ${file}`, error);
    }
  }

  return issues;
}

/**
 * Delete an issue from the worktree.
 * Does not throw if issue doesn't exist.
 */
export async function deleteIssue(baseDir: string, id: string): Promise<void> {
  const filePath = getIssuePath(baseDir, id);
  try {
    await unlink(filePath);
  } catch (error) {
    // Ignore ENOENT (file doesn't exist)
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }
}
