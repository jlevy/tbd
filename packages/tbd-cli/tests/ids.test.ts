/**
 * Tests for ID generation.
 *
 * The system uses dual IDs:
 * - Internal ID: ULID-based, globally unique (is-01hx5zzk...)
 * - Short ID: Base36, human-friendly for CLI (a7k2)
 */

import { describe, it, expect } from 'vitest';
import {
  generateInternalId,
  generateShortId,
  validateIssueId,
  validateShortId,
  normalizeIssueId,
  isInternalId,
  isShortId,
  formatDisplayId,
} from '../src/lib/ids.js';
import { IssueId } from '../src/lib/schemas.js';

// Sample valid ULID for testing (26 lowercase alphanumeric chars)
const VALID_ULID = '01hx5zzkbkactav9wevgemmvrz';

describe('generateInternalId', () => {
  it('generates valid ULID-based issue ID format', () => {
    const id = generateInternalId();
    expect(id).toMatch(/^is-[0-9a-z]{26}$/);
    expect(IssueId.safeParse(id).success).toBe(true);
  });

  it('generates unique IDs', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      ids.add(generateInternalId());
    }
    expect(ids.size).toBe(100);
  });

  it('generates lowercase IDs', () => {
    const id = generateInternalId();
    expect(id).toBe(id.toLowerCase());
  });
});

describe('generateShortId', () => {
  it('generates base36 short ID', () => {
    const id = generateShortId();
    expect(id).toMatch(/^[a-z0-9]{4}$/);
  });

  it('generates unique IDs', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      ids.add(generateShortId());
    }
    // High probability of uniqueness (36^4 = 1.6M possibilities)
    expect(ids.size).toBeGreaterThan(95);
  });
});

describe('validateIssueId', () => {
  it('accepts valid ULID-based internal IDs', () => {
    expect(validateIssueId(`is-${VALID_ULID}`)).toBe(true);
    expect(validateIssueId('is-00000000000000000000000000')).toBe(true);
    expect(validateIssueId('is-zzzzzzzzzzzzzzzzzzzzzzzzzz')).toBe(true);
  });

  it('rejects invalid IDs', () => {
    expect(validateIssueId('is-a1b2c3')).toBe(false); // old 6-char format
    expect(validateIssueId(`bd-${VALID_ULID}`)).toBe(false); // wrong prefix
    expect(validateIssueId(VALID_ULID)).toBe(false); // missing prefix
    expect(validateIssueId('is-')).toBe(false); // empty
    expect(validateIssueId(`IS-${VALID_ULID}`)).toBe(false); // uppercase prefix
  });
});

describe('validateShortId', () => {
  it('accepts valid short IDs', () => {
    expect(validateShortId('a7k2')).toBe(true);
    expect(validateShortId('0000')).toBe(true);
    expect(validateShortId('zzzz')).toBe(true);
    expect(validateShortId('a7k2x')).toBe(true); // 5 chars
  });

  it('rejects invalid short IDs', () => {
    expect(validateShortId('abc')).toBe(false); // too short
    expect(validateShortId('abcdef')).toBe(false); // too long
    expect(validateShortId('ABC1')).toBe(false); // uppercase
  });
});

describe('isInternalId', () => {
  it('identifies internal IDs correctly', () => {
    expect(isInternalId(`is-${VALID_ULID}`)).toBe(true);
    expect(isInternalId('a7k2')).toBe(false);
    expect(isInternalId('bd-a7k2')).toBe(false);
  });
});

describe('isShortId', () => {
  it('identifies short IDs correctly', () => {
    expect(isShortId('a7k2')).toBe(true);
    expect(isShortId('bd-a7k2')).toBe(true);
    expect(isShortId(`is-${VALID_ULID}`)).toBe(false);
  });
});

describe('normalizeIssueId', () => {
  it('passes through valid internal IDs', () => {
    expect(normalizeIssueId(`is-${VALID_ULID}`)).toBe(`is-${VALID_ULID}`);
  });

  it('converts uppercase to lowercase', () => {
    expect(normalizeIssueId(`IS-${VALID_ULID.toUpperCase()}`)).toBe(`is-${VALID_ULID}`);
  });

  it('adds is- prefix to bare ULIDs', () => {
    expect(normalizeIssueId(VALID_ULID)).toBe(`is-${VALID_ULID}`);
  });

  it('converts bd- prefix to is- for full ULIDs', () => {
    expect(normalizeIssueId(`bd-${VALID_ULID}`)).toBe(`is-${VALID_ULID}`);
  });

  it('returns short IDs unchanged (cannot resolve without mapping)', () => {
    // Short IDs require mapping lookup which normalizeIssueId doesn't have access to
    expect(normalizeIssueId('bd-a7k2')).toBe('bd-a7k2');
    expect(normalizeIssueId('a7k2')).toBe('a7k2');
  });

  it('returns corrupted is- IDs as-is for later validation', () => {
    // IDs that start with is- but have wrong length
    expect(normalizeIssueId('is-abc')).toBe('is-abc');
    expect(normalizeIssueId('is-toolong1234567890123456789')).toBe('is-toolong1234567890123456789');
  });

  it('returns bd- short IDs unchanged when not full ULID', () => {
    // bd- prefix with short ID (not 26 chars)
    expect(normalizeIssueId('bd-a7k2x')).toBe('bd-a7k2x');
    expect(normalizeIssueId('bd-12345')).toBe('bd-12345');
  });

  it('returns other prefixed IDs unchanged', () => {
    // Other prefixes that aren't is- or bd-
    expect(normalizeIssueId('xx-abcdef')).toBe('xx-abcdef');
  });
});

describe('formatDisplayId', () => {
  it('formats internal ID with default bd- prefix', () => {
    const displayId = formatDisplayId(`is-${VALID_ULID}`);
    expect(displayId).toBe('bd-01hx5z');
  });

  it('uses custom prefix when provided', () => {
    const displayId = formatDisplayId(`is-${VALID_ULID}`, 'issue');
    expect(displayId).toBe('issue-01hx5z');
  });

  it('handles IDs without is- prefix', () => {
    const displayId = formatDisplayId(VALID_ULID);
    expect(displayId).toBe('bd-01hx5z');
  });

  it('truncates to first 6 chars of ULID', () => {
    const displayId = formatDisplayId('is-abcdef123456789012345678');
    expect(displayId).toBe('bd-abcdef');
  });
});

// Tests for test-helpers.ts ID validation functions
import {
  isValidShortIdFormat,
  isValidInternalIdFormat,
  isDisplayIdNotInternal,
  isCorrectWorktreePath,
  isWrongMainBranchPath,
  hasCorrectFrontmatterFormat,
  BEADS_TO_TBD_STATUS,
} from './test-helpers.js';

describe('test helper: isValidShortIdFormat', () => {
  it('accepts valid 4-char short IDs', () => {
    expect(isValidShortIdFormat('a7k2')).toBe(true);
    expect(isValidShortIdFormat('bd-a7k2')).toBe(true);
    expect(isValidShortIdFormat('tbd-a7k2')).toBe(true);
  });

  it('accepts valid 5-char short IDs', () => {
    expect(isValidShortIdFormat('a7k2x')).toBe(true);
    expect(isValidShortIdFormat('bd-a7k2x')).toBe(true);
  });

  it('rejects 26-char ULIDs (the bug we want to catch)', () => {
    expect(isValidShortIdFormat('bd-01kf2sp62c0dhqcwahs6ah5k92')).toBe(false);
    expect(isValidShortIdFormat('01kf2sp62c0dhqcwahs6ah5k92')).toBe(false);
  });

  it('rejects IDs that are too short or too long', () => {
    expect(isValidShortIdFormat('abc')).toBe(false);
    expect(isValidShortIdFormat('abcdef')).toBe(false);
  });
});

describe('test helper: isValidInternalIdFormat', () => {
  it('accepts valid internal IDs', () => {
    expect(isValidInternalIdFormat('is-01kf2sp62c0dhqcwahs6ah5k92')).toBe(true);
    expect(isValidInternalIdFormat('is-00000000000000000000000000')).toBe(true);
  });

  it('rejects short IDs', () => {
    expect(isValidInternalIdFormat('is-a7k2')).toBe(false);
    expect(isValidInternalIdFormat('a7k2')).toBe(false);
  });

  it('rejects wrong prefix', () => {
    expect(isValidInternalIdFormat('bd-01kf2sp62c0dhqcwahs6ah5k92')).toBe(false);
  });
});

describe('test helper: isDisplayIdNotInternal', () => {
  it('accepts short display IDs', () => {
    expect(isDisplayIdNotInternal('bd-a7k2')).toBe(true);
    expect(isDisplayIdNotInternal('bd-abcde')).toBe(true);
  });

  it('rejects internal ULID IDs shown as display IDs (the bug)', () => {
    expect(isDisplayIdNotInternal('bd-01kf2sp62c0dhqcwahs6ah5k92')).toBe(false);
  });
});

describe('test helper: isCorrectWorktreePath', () => {
  it('accepts paths in the worktree', () => {
    expect(
      isCorrectWorktreePath('.tbd/data-sync-worktree/.tbd/data-sync/issues/is-abc123.md'),
    ).toBe(true);
  });

  it('rejects paths directly on main branch', () => {
    expect(isCorrectWorktreePath('.tbd/data-sync/issues/is-abc123.md')).toBe(false);
  });
});

describe('test helper: isWrongMainBranchPath', () => {
  it('identifies files wrongly on main branch', () => {
    expect(isWrongMainBranchPath('.tbd/data-sync/issues/is-abc123.md')).toBe(true);
  });

  it('does not flag correct worktree paths', () => {
    expect(
      isWrongMainBranchPath('.tbd/data-sync-worktree/.tbd/data-sync/issues/is-abc123.md'),
    ).toBe(false);
  });
});

describe('test helper: hasCorrectFrontmatterFormat', () => {
  it('accepts content with no extra newline after frontmatter', () => {
    const correct = `---
title: Test
---
Body content here.`;
    expect(hasCorrectFrontmatterFormat(correct)).toBe(true);
  });

  it('rejects content with extra newline after frontmatter (the bug)', () => {
    const incorrect = `---
title: Test
---

Body content here.`;
    expect(hasCorrectFrontmatterFormat(incorrect)).toBe(false);
  });

  it('accepts content with empty body', () => {
    const emptyBody = `---
title: Test
---
`;
    expect(hasCorrectFrontmatterFormat(emptyBody)).toBe(true);
  });
});

describe('test helper: BEADS_TO_TBD_STATUS', () => {
  it('maps all beads statuses correctly', () => {
    expect(BEADS_TO_TBD_STATUS.open).toBe('open');
    expect(BEADS_TO_TBD_STATUS.in_progress).toBe('in_progress');
    expect(BEADS_TO_TBD_STATUS.blocked).toBe('blocked');
    expect(BEADS_TO_TBD_STATUS.deferred).toBe('deferred');
    expect(BEADS_TO_TBD_STATUS.closed).toBe('closed');
    expect(BEADS_TO_TBD_STATUS.tombstone).toBe('closed');
  });

  it('maps done to closed (the bug tbd-1813)', () => {
    // This is a critical mapping that was missing in import.ts
    expect(BEADS_TO_TBD_STATUS.done).toBe('closed');
  });

  it('has all expected beads statuses', () => {
    const expectedStatuses = [
      'open',
      'in_progress',
      'done',
      'closed',
      'tombstone',
      'blocked',
      'deferred',
    ];
    for (const status of expectedStatuses) {
      expect(BEADS_TO_TBD_STATUS[status]).toBeDefined();
    }
  });
});
