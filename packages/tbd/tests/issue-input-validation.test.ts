/**
 * Unit tests for CLI issue title validation.
 */

import { describe, it, expect } from 'vitest';
import { validateIssueTitle } from '../src/cli/lib/issue-input-validation.js';
import { ValidationError } from '../src/cli/lib/errors.js';
import { ISSUE_TITLE_MAX_LENGTH } from '../src/lib/schemas.js';

describe('validateIssueTitle', () => {
  it('returns the input unchanged when valid', () => {
    expect(validateIssueTitle('A normal title', { emptyMessage: 'Title is required' })).toBe(
      'A normal title',
    );
  });

  it('accepts a title exactly at the maximum length', () => {
    const title = 'x'.repeat(ISSUE_TITLE_MAX_LENGTH);
    expect(validateIssueTitle(title, { emptyMessage: 'Title is required' })).toBe(title);
  });

  it('throws the supplied empty message for an empty string', () => {
    expect(() => validateIssueTitle('', { emptyMessage: 'Custom empty message' })).toThrow(
      ValidationError,
    );
    expect(() => validateIssueTitle('', { emptyMessage: 'Custom empty message' })).toThrow(
      'Custom empty message',
    );
  });

  it('accepts whitespace-only titles when rejectBlank is omitted', () => {
    expect(validateIssueTitle('   ', { emptyMessage: 'Title is required' })).toBe('   ');
  });

  it('rejects whitespace-only titles when rejectBlank is true', () => {
    expect(() =>
      validateIssueTitle('   ', { emptyMessage: 'Title cannot be empty', rejectBlank: true }),
    ).toThrow('Title cannot be empty');
  });

  it('rejects titles longer than the maximum with an actionable message', () => {
    const title = 'x'.repeat(ISSUE_TITLE_MAX_LENGTH + 1);
    expect(() => validateIssueTitle(title, { emptyMessage: 'Title is required' })).toThrow(
      `Title is too long (${ISSUE_TITLE_MAX_LENGTH + 1} chars, max ${ISSUE_TITLE_MAX_LENGTH}). Move detail into the description body.`,
    );
  });

  it('throws ValidationError (not a generic Error)', () => {
    try {
      validateIssueTitle('', { emptyMessage: 'Title is required' });
      expect.fail('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
    }
  });
});
