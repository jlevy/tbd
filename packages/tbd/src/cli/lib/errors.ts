/**
 * CLI error types and helpers for structured error handling.
 *
 * See: research-modern-typescript-cli-patterns.md#3-base-command-pattern
 */

import { findTbdRoot } from '../../file/config.js';

/**
 * Find and return the tbd repository root, starting from the given directory.
 * Walks up the directory tree to find .tbd/.
 *
 * @param cwd - Working directory to start from (defaults to process.cwd())
 * @returns The tbd repository root path
 * @throws NotInitializedError if tbd is not initialized in any parent directory
 */
export async function requireInit(cwd: string = process.cwd()): Promise<string> {
  const tbdRoot = await findTbdRoot(cwd);
  if (!tbdRoot) {
    throw new NotInitializedError();
  }
  return tbdRoot;
}

/**
 * Base CLI error. Thrown for operational errors that should exit
 * with a specific code but don't need stack traces.
 */
export class CLIError extends Error {
  constructor(
    message: string,
    public exitCode = 1,
  ) {
    super(message);
    this.name = 'CLIError';
  }
}

/**
 * Validation error for usage/argument issues.
 * Exit code 2 follows Unix convention.
 */
export class ValidationError extends CLIError {
  constructor(message: string) {
    super(message, 2);
    this.name = 'ValidationError';
  }
}

/**
 * Not initialized error - tbd repository not found.
 * Uses the stable error message defined in design spec §5.6.
 */
export class NotInitializedError extends CLIError {
  constructor(message = "Not a tbd repository (run 'tbd setup --auto --prefix=<name>' first)") {
    super(message, 1);
    this.name = 'NotInitializedError';
  }
}

/**
 * Entity not found error (issue, config, etc.).
 */
export class NotFoundError extends CLIError {
  constructor(entityType: string, id: string) {
    super(`${entityType} not found: ${id}`, 1);
    this.name = 'NotFoundError';
  }
}

/**
 * Sync/conflict error.
 */
export class SyncError extends CLIError {
  constructor(message: string) {
    super(message, 1);
    this.name = 'SyncError';
  }
}

/**
 * Unrelated-history error - the local and remote tbd-sync share no common
 * ancestor, so a push can never fast-forward and a plain git merge refuses.
 * `tbd sync` cannot resolve this; the rescue lives in `tbd doctor --fix`.
 * See: plan-2026-05-29-tbd-sync-unrelated-history-hardening.md
 */
export class UnrelatedHistoriesError extends SyncError {
  constructor(remote = 'origin', syncBranch = 'tbd-sync') {
    super(
      `${remote}/${syncBranch} has an unrelated history (no common ancestor); ` +
        `push cannot fast-forward and a merge would refuse.\n` +
        `Run \`tbd doctor --fix\` to reconcile the unrelated histories (non-destructive; ` +
        `a backup branch is created first).`,
    );
    this.name = 'UnrelatedHistoriesError';
  }
}

/**
 * Sync branch error - issues with the tbd-sync branch.
 * This can indicate the branch is missing, orphaned, or has diverged.
 * See: tbd-design.md §2.3.6 Worktree Error Classes
 */
export class SyncBranchError extends CLIError {
  constructor(message: string) {
    super(message, 1);
    this.name = 'SyncBranchError';
  }
}

/**
 * Classification of sync errors for auto-save/retry decisions.
 * - 'permanent': Error indicates push is blocked (e.g., 403, protected branch).
 *   Auto-save to outbox is appropriate.
 * - 'transient': Error is likely temporary (e.g., network timeout).
 *   User should retry.
 * - 'unknown': Cannot determine error type.
 *   Treat conservatively (suggest retry, mention save option).
 */
export type SyncErrorType = 'permanent' | 'transient' | 'unknown';

/**
 * Classify a sync error to determine appropriate recovery action.
 *
 * Used by `tbd sync` to decide whether to:
 * - Auto-save to outbox (permanent failure - push is blocked)
 * - Suggest retry (transient failure - might work next time)
 * - Offer both options (unknown - let user decide)
 *
 * @param error - Error message or Error object from git push
 * @returns Classification of the error type
 */
export function classifySyncError(error: Error | string): SyncErrorType {
  const msg = typeof error === 'string' ? error : error.message;
  const lower = msg.toLowerCase();

  // Permanent indicators - push is blocked by policy/permissions
  const permanentPatterns = [
    /403/, // HTTP 403 Forbidden
    /forbidden/,
    /permission denied/,
    /401/, // HTTP 401 Unauthorized
    /unauthorized/,
    /protected branch/,
    /remote rejected/,
    /pre-receive hook declined/,
    /push declined/,
    /not allowed to push/,
  ];

  for (const pattern of permanentPatterns) {
    if (pattern.test(lower)) return 'permanent';
  }

  // Transient indicators - likely temporary, should retry
  const transientPatterns = [
    /timeout/,
    /timed out/,
    /connection refused/,
    /connection reset/,
    /network/,
    /dns/,
    /5\d\d/, // HTTP 5xx server errors
    /server error/,
    /temporarily/,
    /try again/,
    /could not resolve/,
    /no route to host/,
    /connection closed/,
  ];

  for (const pattern of transientPatterns) {
    if (pattern.test(lower)) return 'transient';
  }

  return 'unknown';
}
