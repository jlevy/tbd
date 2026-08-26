/**
 * CLI validation helpers for user-provided issue fields.
 */

import { ISSUE_TITLE_MAX_LENGTH, IssueTitle } from '../../lib/schemas.js';
import { formatZodError } from '../../utils/zod-error-utils.js';
import { ValidationError } from './errors.js';

interface IssueTitleValidationOptions {
  /** Error message used when the title is empty. */
  emptyMessage: string;
  /** When true, whitespace-only titles are treated as empty. */
  rejectBlank?: boolean;
}

/**
 * Validate a CLI-provided issue title with actionable user-facing errors.
 */
export function validateIssueTitle(title: string, options: IssueTitleValidationOptions): string {
  const isEmpty = options.rejectBlank ? title.trim().length === 0 : title.length === 0;
  if (isEmpty) {
    throw new ValidationError(options.emptyMessage);
  }

  if (title.length > ISSUE_TITLE_MAX_LENGTH) {
    throw new ValidationError(
      `Title is too long (${title.length} chars, max ${ISSUE_TITLE_MAX_LENGTH}). Move detail into the description body.`,
    );
  }

  const result = IssueTitle.safeParse(title);
  if (!result.success) {
    throw new ValidationError(`Invalid title: ${formatZodError(result.error)}`);
  }

  return title;
}

/**
 * Parse a user-supplied date flag into a normalized ISO timestamp.
 *
 * Shared by every date-valued flag so an unusable value fails loudly at the CLI
 * boundary. A filter that silently accepts garbage and then matches everything is
 * indistinguishable to the caller from a filter that did not run.
 */
export function parseDateOption(value: string, flag: string): string {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    throw new ValidationError(`Invalid ${flag} value: ${value}. Expected a date or timestamp.`);
  }
  return new Date(parsed).toISOString();
}
