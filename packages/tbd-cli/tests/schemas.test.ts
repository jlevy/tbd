/**
 * Tests for Zod schemas.
 */

import { describe, it, expect } from 'vitest';
import {
  IssueSchema,
  IssueId,
  ShortId,
  ExternalIssueIdInput,
  ConfigSchema,
} from '../src/lib/schemas.js';

// Sample valid ULID for testing (26 lowercase alphanumeric chars)
const VALID_ULID = '01hx5zzkbkactav9wevgemmvrz';
const VALID_ULID_2 = '01hx5zzkbkbctav9wevgemmvrs';
const VALID_ULID_3 = '01hx5zzkbkcdtav9wevgemmvrt';

describe('IssueId', () => {
  it('accepts valid ULID-based issue IDs', () => {
    expect(IssueId.safeParse(`is-${VALID_ULID}`).success).toBe(true);
    expect(IssueId.safeParse('is-00000000000000000000000000').success).toBe(true);
    expect(IssueId.safeParse('is-zzzzzzzzzzzzzzzzzzzzzzzzzz').success).toBe(true);
  });

  it('rejects invalid issue IDs', () => {
    expect(IssueId.safeParse('is-a1b2').success).toBe(false); // too short
    expect(IssueId.safeParse('is-a1b2c3').success).toBe(false); // old 6-char format
    expect(IssueId.safeParse(`bd-${VALID_ULID}`).success).toBe(false); // wrong prefix
    expect(IssueId.safeParse(`is-${VALID_ULID.toUpperCase()}`).success).toBe(false); // uppercase
    expect(IssueId.safeParse('is-01hx5zzkbkactav9wevgemmvrz!').success).toBe(false); // invalid char
  });
});

describe('ShortId', () => {
  it('accepts valid short IDs', () => {
    expect(ShortId.safeParse('a7k2').success).toBe(true);
    expect(ShortId.safeParse('b3m9x').success).toBe(true);
    expect(ShortId.safeParse('0000').success).toBe(true);
    expect(ShortId.safeParse('zzzz').success).toBe(true);
  });

  it('rejects invalid short IDs', () => {
    expect(ShortId.safeParse('abc').success).toBe(false); // too short
    expect(ShortId.safeParse('abcdef').success).toBe(false); // too long
    expect(ShortId.safeParse('ABC1').success).toBe(false); // uppercase
  });
});

describe('ExternalIssueIdInput', () => {
  it('accepts valid external input IDs', () => {
    expect(ExternalIssueIdInput.safeParse('bd-a7k2').success).toBe(true);
    expect(ExternalIssueIdInput.safeParse('proj-a7k2').success).toBe(true);
    expect(ExternalIssueIdInput.safeParse('a7k2').success).toBe(true);
    expect(ExternalIssueIdInput.safeParse('a7k2x').success).toBe(true); // 5 chars
  });

  it('rejects invalid external input IDs', () => {
    expect(ExternalIssueIdInput.safeParse('bd-abc').success).toBe(false); // too short
    expect(ExternalIssueIdInput.safeParse('bd-abcdef').success).toBe(false); // too long
    expect(ExternalIssueIdInput.safeParse(`bd-${VALID_ULID}`).success).toBe(false); // full ULID not external
  });
});

describe('IssueSchema', () => {
  it('parses a minimal valid issue', () => {
    const issue = {
      type: 'is',
      id: `is-${VALID_ULID}`,
      version: 1,
      title: 'Test issue',
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
    };

    const result = IssueSchema.safeParse(issue);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.kind).toBe('task'); // default
      expect(result.data.status).toBe('open'); // default
      expect(result.data.priority).toBe(2); // default
      expect(result.data.labels).toEqual([]); // default
    }
  });

  it('parses a complete issue', () => {
    const issue = {
      type: 'is',
      id: `is-${VALID_ULID}`,
      version: 5,
      title: 'Fix authentication bug',
      description: 'Users are logged out after 5 minutes.',
      notes: 'Found issue in session.ts',
      kind: 'bug',
      status: 'in_progress',
      priority: 1,
      assignee: 'alice',
      labels: ['backend', 'security'],
      dependencies: [{ type: 'blocks', target: `is-${VALID_ULID_2}` }],
      parent_id: `is-${VALID_ULID_3}`,
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-02T00:00:00Z',
      created_by: 'bob',
      due_date: '2025-02-01T00:00:00Z',
      extensions: { github: { issue_number: 123 } },
    };

    const result = IssueSchema.safeParse(issue);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.title).toBe('Fix authentication bug');
      expect(result.data.labels).toEqual(['backend', 'security']);
      expect(result.data.extensions?.github).toEqual({ issue_number: 123 });
    }
  });

  it('rejects invalid status', () => {
    const issue = {
      type: 'is',
      id: `is-${VALID_ULID}`,
      version: 1,
      title: 'Test',
      status: 'invalid_status',
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
    };

    const result = IssueSchema.safeParse(issue);
    expect(result.success).toBe(false);
  });

  it('rejects invalid priority', () => {
    const issue = {
      type: 'is',
      id: `is-${VALID_ULID}`,
      version: 1,
      title: 'Test',
      priority: 5, // invalid: max is 4
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
    };

    const result = IssueSchema.safeParse(issue);
    expect(result.success).toBe(false);
  });
});

describe('ConfigSchema', () => {
  it('parses minimal config with defaults', () => {
    const config = {
      tbd_version: '3.0.0',
    };

    const result = ConfigSchema.safeParse(config);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.sync.branch).toBe('tbd-sync');
      expect(result.data.sync.remote).toBe('origin');
      expect(result.data.display.id_prefix).toBe('bd');
      expect(result.data.settings.auto_sync).toBe(false);
    }
  });
});
