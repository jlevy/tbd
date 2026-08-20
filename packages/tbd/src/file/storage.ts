/**
 * Storage layer for issue files.
 *
 * Provides atomic file operations and issue CRUD operations.
 * All operations work on the data-sync directory selected by the caller. In production
 * that is the shared hidden worktree under $GIT_COMMON_DIR/tbd/data-sync-worktree/.
 *
 * See: tbd-design.md §3.2 Storage Layer
 */

import { readFile, unlink, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { writeFile } from 'atomically';

import type { Issue } from '../lib/types.js';
import { IssueSchema } from '../lib/schemas.js';
import { ZodError } from 'zod';

import { formatUnknownError, formatZodError } from '../utils/zod-error-utils.js';
import { parseIssue, serializeIssue } from './parser.js';

/**
 * Maximum issue files read concurrently to avoid exhausting file descriptors in large repos.
 */
const ISSUE_READ_BATCH_SIZE = 200;

/**
 * Parse or read failure for an issue file.
 */
export interface InvalidIssueFile {
  /** Issue filename relative to the issues directory. */
  file: string;
  /** Safe, human-readable read or parse failure reason. */
  reason: string;
}

export interface ListIssuesOptions {
  /** When true, emit skipped-file warnings to stderr. */
  warnOnInvalid?: boolean;
  /** Optional callback for callers that need structured skipped-file diagnostics. */
  onInvalidIssue?: (invalidIssue: InvalidIssueFile) => void;
  /** When true, require each parsed issue to live in `<issue.id>.md`. */
  validateFileName?: boolean;
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
  // The write boundary is where cross-field invariants are enforced, so it is also
  // where an ordinary CLI mistake lands — `--hold` on closed work, a duplicate with no
  // pointer. Zod's own rendering of that is a JSON dump of its issue array, which
  // buries a message that is already written for a person to read.
  let validIssue;
  try {
    validIssue = IssueSchema.parse(issue);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new Error(formatZodError(error));
    }
    throw error;
  }
  const filePath = getIssuePath(baseDir, validIssue.id);
  const content = serializeIssue(validIssue);
  await writeFile(filePath, content);
}

/**
 * List all issues in the worktree.
 * Returns empty array if issues directory doesn't exist.
 *
 * Uses parallel file reading for better performance with many issues.
 */
export async function listIssues(
  baseDir: string,
  options: ListIssuesOptions = {},
): Promise<Issue[]> {
  const warnOnInvalid = options.warnOnInvalid ?? true;
  const issuesDir = join(baseDir, 'issues');

  let files: string[];
  try {
    files = await readdir(issuesDir);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== 'ENOENT' && options.onInvalidIssue !== undefined) {
      reportInvalidIssueFile(
        { file: 'issues/', reason: `failed to read directory: ${formatUnknownError(error)}` },
        warnOnInvalid,
        options.onInvalidIssue,
      );
    }
    // A missing issue directory represents an empty store. Other failures remain the
    // historical empty result unless a strict caller supplied onInvalidIssue above.
    return [];
  }

  // Filter to only .md files
  const mdFiles = files.filter((f) => f.endsWith('.md'));

  const issues: Issue[] = [];

  for (let i = 0; i < mdFiles.length; i += ISSUE_READ_BATCH_SIZE) {
    const batch = mdFiles.slice(i, i + ISSUE_READ_BATCH_SIZE);
    const fileContents = await Promise.all(
      batch.map(async (file) => {
        const filePath = join(issuesDir, file);
        try {
          const content = await readFile(filePath, 'utf-8');
          return { file, content };
        } catch (error) {
          return { file, error: formatUnknownError(error) };
        }
      }),
    );

    for (const result of fileContents) {
      if ('error' in result) {
        reportInvalidIssueFile(
          { file: result.file, reason: `failed to read file: ${result.error}` },
          warnOnInvalid,
          options.onInvalidIssue,
        );
        continue;
      }
      try {
        const issue = parseIssue(result.content);
        if (options.validateFileName === true && result.file !== `${issue.id}.md`) {
          reportInvalidIssueFile(
            { file: result.file, reason: `file name does not match ${issue.id}` },
            warnOnInvalid,
            options.onInvalidIssue,
          );
          continue;
        }
        issues.push(issue);
      } catch (error) {
        reportInvalidIssueFile(
          { file: result.file, reason: formatUnknownError(error) },
          warnOnInvalid,
          options.onInvalidIssue,
        );
      }
    }
  }

  return issues;
}

function reportInvalidIssueFile(
  invalidIssue: InvalidIssueFile,
  warnOnInvalid: boolean,
  onInvalidIssue?: (invalidIssue: InvalidIssueFile) => void,
): void {
  onInvalidIssue?.(invalidIssue);
  if (warnOnInvalid) {
    console.warn(`Skipping invalid issue file: ${invalidIssue.file}: ${invalidIssue.reason}`);
  }
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
