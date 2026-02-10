/**
 * Tests for github-issues.ts - GitHub issue URL parsing, validation, and status mapping.
 *
 * URL parsing tests run without network access.
 * API operation tests mock child_process.
 */

import { describe, it, expect } from 'vitest';

import {
  parseGitHubIssueUrl,
  isGitHubIssueUrl,
  isGitHubPrUrl,
  formatGitHubIssueRef,
  githubToTbdStatus,
  computeLabelDiff,
  TBD_TO_GITHUB_STATUS,
} from '../src/file/github-issues.js';

// =============================================================================
// parseGitHubIssueUrl
// =============================================================================

describe('parseGitHubIssueUrl', () => {
  it('parses valid HTTPS issue URL', () => {
    const result = parseGitHubIssueUrl('https://github.com/owner/repo/issues/123');
    expect(result).toEqual({
      owner: 'owner',
      repo: 'repo',
      number: 123,
      url: 'https://github.com/owner/repo/issues/123',
    });
  });

  it('parses valid HTTP issue URL', () => {
    const result = parseGitHubIssueUrl('http://github.com/owner/repo/issues/456');
    expect(result).toEqual({
      owner: 'owner',
      repo: 'repo',
      number: 456,
      url: 'http://github.com/owner/repo/issues/456',
    });
  });

  it('extracts correct owner/repo/number from complex names', () => {
    const result = parseGitHubIssueUrl('https://github.com/my-org/my-repo.js/issues/9999');
    expect(result).toEqual({
      owner: 'my-org',
      repo: 'my-repo.js',
      number: 9999,
      url: 'https://github.com/my-org/my-repo.js/issues/9999',
    });
  });

  it('rejects URL with trailing slash', () => {
    expect(parseGitHubIssueUrl('https://github.com/owner/repo/issues/123/')).toBeNull();
  });

  it('rejects URL with query params', () => {
    expect(parseGitHubIssueUrl('https://github.com/owner/repo/issues/123?foo=bar')).toBeNull();
  });

  it('rejects GitHub PR URL', () => {
    expect(parseGitHubIssueUrl('https://github.com/owner/repo/pull/123')).toBeNull();
  });

  it('rejects GitHub repo URL (no issue number)', () => {
    expect(parseGitHubIssueUrl('https://github.com/owner/repo')).toBeNull();
  });

  it('rejects GitHub blob URL', () => {
    expect(parseGitHubIssueUrl('https://github.com/owner/repo/blob/main/file.ts')).toBeNull();
  });

  it('rejects non-GitHub URL', () => {
    expect(parseGitHubIssueUrl('https://jira.example.com/PROJ-123')).toBeNull();
  });

  it('rejects malformed input', () => {
    expect(parseGitHubIssueUrl('not-a-url')).toBeNull();
  });

  it('rejects URL with no issue number', () => {
    expect(parseGitHubIssueUrl('https://github.com/owner/repo/issues/')).toBeNull();
  });

  it('rejects URL with non-numeric issue number', () => {
    expect(parseGitHubIssueUrl('https://github.com/owner/repo/issues/abc')).toBeNull();
  });

  it('rejects issues path with extra segments', () => {
    expect(parseGitHubIssueUrl('https://github.com/owner/repo/issues/123/comments')).toBeNull();
  });
});

// =============================================================================
// isGitHubIssueUrl
// =============================================================================

describe('isGitHubIssueUrl', () => {
  it('returns true for valid issue URL', () => {
    expect(isGitHubIssueUrl('https://github.com/owner/repo/issues/123')).toBe(true);
  });

  it('returns false for PR URL', () => {
    expect(isGitHubIssueUrl('https://github.com/owner/repo/pull/123')).toBe(false);
  });

  it('returns false for repo URL', () => {
    expect(isGitHubIssueUrl('https://github.com/owner/repo')).toBe(false);
  });
});

// =============================================================================
// isGitHubPrUrl
// =============================================================================

describe('isGitHubPrUrl', () => {
  it('returns true for PR URL', () => {
    expect(isGitHubPrUrl('https://github.com/owner/repo/pull/123')).toBe(true);
  });

  it('returns false for issue URL', () => {
    expect(isGitHubPrUrl('https://github.com/owner/repo/issues/123')).toBe(false);
  });

  it('returns false for non-GitHub URL', () => {
    expect(isGitHubPrUrl('https://example.com/pull/123')).toBe(false);
  });
});

// =============================================================================
// formatGitHubIssueRef
// =============================================================================

describe('formatGitHubIssueRef', () => {
  it('formats as owner/repo#number', () => {
    expect(
      formatGitHubIssueRef({
        owner: 'jlevy',
        repo: 'tbd',
        number: 83,
        url: 'https://github.com/jlevy/tbd/issues/83',
      }),
    ).toBe('jlevy/tbd#83');
  });
});

// =============================================================================
// TBD_TO_GITHUB_STATUS mapping
// =============================================================================

describe('TBD_TO_GITHUB_STATUS', () => {
  it('maps open to GitHub open', () => {
    expect(TBD_TO_GITHUB_STATUS.open).toEqual({ state: 'open' });
  });

  it('maps in_progress to GitHub open', () => {
    expect(TBD_TO_GITHUB_STATUS.in_progress).toEqual({ state: 'open' });
  });

  it('maps blocked to null (no change)', () => {
    expect(TBD_TO_GITHUB_STATUS.blocked).toBeNull();
  });

  it('maps deferred to GitHub closed/not_planned', () => {
    expect(TBD_TO_GITHUB_STATUS.deferred).toEqual({
      state: 'closed',
      state_reason: 'not_planned',
    });
  });

  it('maps closed to GitHub closed/completed', () => {
    expect(TBD_TO_GITHUB_STATUS.closed).toEqual({
      state: 'closed',
      state_reason: 'completed',
    });
  });
});

// =============================================================================
// githubToTbdStatus
// =============================================================================

describe('githubToTbdStatus', () => {
  describe('GitHub open → tbd', () => {
    it('reopens closed bead', () => {
      expect(githubToTbdStatus('open', null, 'closed')).toBe('open');
    });

    it('reopens deferred bead', () => {
      expect(githubToTbdStatus('open', null, 'deferred')).toBe('open');
    });

    it('does not change open bead', () => {
      expect(githubToTbdStatus('open', null, 'open')).toBeNull();
    });

    it('does not change in_progress bead', () => {
      expect(githubToTbdStatus('open', null, 'in_progress')).toBeNull();
    });

    it('does not change blocked bead', () => {
      expect(githubToTbdStatus('open', null, 'blocked')).toBeNull();
    });

    it('handles reopened reason same as null', () => {
      expect(githubToTbdStatus('open', 'reopened', 'closed')).toBe('open');
    });
  });

  describe('GitHub closed → tbd', () => {
    it('closes open bead on completed', () => {
      expect(githubToTbdStatus('closed', 'completed', 'open')).toBe('closed');
    });

    it('closes in_progress bead on completed', () => {
      expect(githubToTbdStatus('closed', 'completed', 'in_progress')).toBe('closed');
    });

    it('closes blocked bead on completed', () => {
      expect(githubToTbdStatus('closed', 'completed', 'blocked')).toBe('closed');
    });

    it('does not change already closed bead', () => {
      expect(githubToTbdStatus('closed', 'completed', 'closed')).toBeNull();
    });

    it('defers open bead on not_planned', () => {
      expect(githubToTbdStatus('closed', 'not_planned', 'open')).toBe('deferred');
    });

    it('does not change already deferred bead', () => {
      expect(githubToTbdStatus('closed', 'not_planned', 'deferred')).toBeNull();
    });

    it('closes bead on duplicate reason', () => {
      expect(githubToTbdStatus('closed', 'duplicate', 'open')).toBe('closed');
    });

    it('closes bead when state_reason is null', () => {
      expect(githubToTbdStatus('closed', null, 'open')).toBe('closed');
    });
  });
});

// =============================================================================
// computeLabelDiff
// =============================================================================

describe('computeLabelDiff', () => {
  it('detects labels to add and remove', () => {
    const result = computeLabelDiff(['bug', 'p1', 'new-label'], ['bug', 'p1', 'old-label']);
    expect(result.toAdd).toEqual(['new-label']);
    expect(result.toRemove).toEqual(['old-label']);
  });

  it('returns empty diffs when labels are identical', () => {
    const result = computeLabelDiff(['bug', 'p1'], ['bug', 'p1']);
    expect(result.toAdd).toEqual([]);
    expect(result.toRemove).toEqual([]);
  });

  it('handles empty local labels', () => {
    const result = computeLabelDiff([], ['bug', 'p1']);
    expect(result.toAdd).toEqual([]);
    expect(result.toRemove).toEqual(['bug', 'p1']);
  });

  it('handles empty remote labels', () => {
    const result = computeLabelDiff(['bug', 'p1'], []);
    expect(result.toAdd).toEqual(['bug', 'p1']);
    expect(result.toRemove).toEqual([]);
  });

  it('handles both empty', () => {
    const result = computeLabelDiff([], []);
    expect(result.toAdd).toEqual([]);
    expect(result.toRemove).toEqual([]);
  });
});
