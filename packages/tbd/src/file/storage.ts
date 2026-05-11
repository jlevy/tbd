/**
 * Storage layer for issue files.
 *
 * Provides atomic file operations and issue CRUD operations.
 * All operations work on the hidden worktree at .tbd/data-sync/issues/.
 *
 * See: tbd-design.md §3.2 Storage Layer
 */

import { readFile, unlink, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { writeFile } from 'atomically';
import { ZodError } from 'zod';

import type { Issue } from '../lib/types.js';
import { IssueSchema } from '../lib/schemas.js';
import { parseIssue, serializeIssue } from './parser.js';

/**
 * Information about a file that failed to parse.
 */
export interface SkippedIssueFile {
  file: string;
  reason: string;
}

/**
 * Format any error (especially ZodError) into a stable, human-readable string.
 *
 * Plain `console.warn(label, err)` runs the value through `util.inspect`, which
 * crashes on certain ZodError shapes under Node v24 (see issue #115). Always
 * stringify here before passing to logging.
 */
export function formatIssueParseError(error: unknown): string {
  if (error instanceof ZodError) {
    return error.issues
      .map((i) => {
        const path = i.path.join('.') || '<root>';
        return `${path}: ${i.message}`;
      })
      .join('; ');
  }
  if (error instanceof Error) return error.message;
  return String(error);
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
 *
 * Validates against IssueSchema before serializing so we never persist an
 * issue that listIssues won't be able to read back. See issue #115.
 */
export async function writeIssue(baseDir: string, issue: Issue): Promise<void> {
  // Throws ZodError on schema violations (e.g. title > 500 chars).
  // Callers that want a friendlier message should validate user input
  // up-front before constructing the Issue.
  const validated = IssueSchema.parse(issue);
  const filePath = getIssuePath(baseDir, validated.id);
  const content = serializeIssue(validated);
  await writeFile(filePath, content);
}

/**
 * List all issues in the worktree, with details of files that failed to parse.
 *
 * Files that fail to parse are skipped (not thrown) so a single corrupt file
 * doesn't kill `tbd list`/`ready`/`stats`. The list of skipped files is
 * returned so callers (e.g. `tbd doctor`) can surface them to the user.
 *
 * Uses parallel file reading for better performance with many issues.
 */
export async function listIssuesDetailed(
  baseDir: string,
): Promise<{ issues: Issue[]; skipped: SkippedIssueFile[] }> {
  const issuesDir = join(baseDir, 'issues');

  let files: string[];
  try {
    files = await readdir(issuesDir);
  } catch {
    // Directory doesn't exist - return empty
    return { issues: [], skipped: [] };
  }

  // Filter to only .md files
  const mdFiles = files.filter((f) => f.endsWith('.md'));

  // Read files in batches to avoid EMFILE (too many open files) on large repos.
  // Unbounded Promise.all on thousands of files exceeds typical fd limits (1024-4096).
  const BATCH_SIZE = 200;
  const issues: Issue[] = [];
  const skipped: SkippedIssueFile[] = [];

  for (let i = 0; i < mdFiles.length; i += BATCH_SIZE) {
    const batch = mdFiles.slice(i, i + BATCH_SIZE);
    const fileContents = await Promise.all(
      batch.map(async (file) => {
        const filePath = join(issuesDir, file);
        try {
          const content = await readFile(filePath, 'utf-8');
          return { file, content, readError: null as unknown };
        } catch (readError) {
          return { file, content: null, readError };
        }
      }),
    );

    for (const { file, content, readError } of fileContents) {
      if (content === null) {
        skipped.push({ file, reason: formatIssueParseError(readError) });
        continue;
      }
      try {
        const issue = parseIssue(content);
        issues.push(issue);
      } catch (error) {
        skipped.push({ file, reason: formatIssueParseError(error) });
      }
    }
  }

  return { issues, skipped };
}

/**
 * List all issues in the worktree.
 * Returns empty array if issues directory doesn't exist.
 *
 * Files that fail to parse are skipped with a single warning line each. For
 * structured access to the skip list, use {@link listIssuesDetailed}.
 */
export async function listIssues(baseDir: string): Promise<Issue[]> {
  const { issues, skipped } = await listIssuesDetailed(baseDir);

  // Emit one warning line per skipped file. Always pass a fully formatted
  // string — never the raw Error/ZodError — to avoid console.warn invoking
  // util.inspect on objects that may crash under certain Node versions
  // (see issue #115).
  for (const { file, reason } of skipped) {
    console.warn(`Skipping invalid issue file: ${file}: ${reason}`);
  }
  if (skipped.length > 0) {
    console.warn(`(${skipped.length} issue file(s) skipped — run 'tbd doctor' to see details)`);
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
