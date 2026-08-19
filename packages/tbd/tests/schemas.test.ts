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
    expect(ShortId.safeParse('').success).toBe(false); // empty
    expect(ShortId.safeParse('ABC1').success).toBe(false); // uppercase
    expect(ShortId.safeParse('a b').success).toBe(false); // contains space
  });

  it('accepts short IDs of various lengths for import preservation', () => {
    // New IDs are 4 chars, but imports can preserve longer IDs like "100" from "tbd-100"
    expect(ShortId.safeParse('1').success).toBe(true);
    expect(ShortId.safeParse('100').success).toBe(true);
    expect(ShortId.safeParse('abc').success).toBe(true);
    expect(ShortId.safeParse('abcdef').success).toBe(true);
  });

  it('accepts short IDs with special characters from imports', () => {
    // Imports may have dots (legacy hierarchical), dashes, or underscores
    expect(ShortId.safeParse('208.1').success).toBe(true); // legacy dotted
    expect(ShortId.safeParse('stat-open').success).toBe(true); // dash
    expect(ShortId.safeParse('stat-in_progress').success).toBe(true); // dash and underscore
    expect(ShortId.safeParse('a-b').success).toBe(true); // simple dash
    expect(ShortId.safeParse('a_b').success).toBe(true); // simple underscore
  });
});

describe('ExternalIssueIdInput', () => {
  it('accepts valid external input IDs', () => {
    expect(ExternalIssueIdInput.safeParse('bd-a7k2').success).toBe(true);
    expect(ExternalIssueIdInput.safeParse('proj-a7k2').success).toBe(true);
    expect(ExternalIssueIdInput.safeParse('e2e-a7k2').success).toBe(true);
    expect(ExternalIssueIdInput.safeParse('proj.v2-a7k2').success).toBe(true);
    expect(ExternalIssueIdInput.safeParse('my_app1-a7k2').success).toBe(true);
    expect(ExternalIssueIdInput.safeParse('a7k2').success).toBe(true);
    expect(ExternalIssueIdInput.safeParse('a7k2x').success).toBe(true); // 5 chars
  });

  it('accepts preserved import IDs of various lengths', () => {
    // Import preserves IDs like "100" from "tbd-100"
    expect(ExternalIssueIdInput.safeParse('bd-100').success).toBe(true);
    expect(ExternalIssueIdInput.safeParse('bd-abc').success).toBe(true);
    expect(ExternalIssueIdInput.safeParse('bd-abcdef').success).toBe(true);
    expect(ExternalIssueIdInput.safeParse('100').success).toBe(true);
    expect(ExternalIssueIdInput.safeParse('proj-stat-in_progress').success).toBe(true);
  });

  it('rejects invalid external input IDs', () => {
    expect(ExternalIssueIdInput.safeParse('').success).toBe(false); // empty
    expect(ExternalIssueIdInput.safeParse('bd-').success).toBe(false); // prefix only
    expect(ExternalIssueIdInput.safeParse('BD-a7k2').success).toBe(false); // uppercase prefix
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

  describe('resolution and duplicate_of', () => {
    const closed = (extra: Record<string, unknown>) => ({
      type: 'is',
      id: `is-${VALID_ULID}`,
      version: 1,
      title: 'Test',
      status: 'closed',
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
      ...extra,
    });

    it('accepts each terminal resolution on a closed issue', () => {
      for (const resolution of ['completed', 'canceled', 'duplicate']) {
        const extra =
          resolution === 'duplicate'
            ? { resolution, duplicate_of: `is-${VALID_ULID_2}` }
            : { resolution };
        expect(IssueSchema.safeParse(closed(extra)).success).toBe(true);
      }
    });

    it('reads an absent resolution as completed rather than requiring a backfill', () => {
      // The whole no-migration argument rests on this: every existing closed bead
      // stays correct because absent means completed.
      const result = IssueSchema.safeParse(closed({}));
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.resolution).toBeUndefined();
      }
    });

    it('rejects a resolution on work that is not closed', () => {
      for (const status of ['open', 'in_progress']) {
        const issue = { ...closed({ resolution: 'canceled' }), status };
        expect(IssueSchema.safeParse(issue).success).toBe(false);
      }
    });

    it('requires duplicate_of when the resolution is duplicate', () => {
      // Both Linear and GitHub model duplicate as reason plus pointer; a bare
      // `duplicate` cannot be rendered on either.
      expect(IssueSchema.safeParse(closed({ resolution: 'duplicate' })).success).toBe(false);
    });

    it('rejects duplicate_of without the duplicate resolution', () => {
      expect(
        IssueSchema.safeParse(
          closed({ resolution: 'canceled', duplicate_of: `is-${VALID_ULID_2}` }),
        ).success,
      ).toBe(false);
    });

    it('rejects an unknown resolution value', () => {
      expect(IssueSchema.safeParse(closed({ resolution: 'superseded' })).success).toBe(false);
    });
  });

  describe('delegate field', () => {
    it('records an acting agent beside the accountable assignee', () => {
      const result = IssueSchema.safeParse({
        type: 'is',
        id: `is-${VALID_ULID}`,
        version: 1,
        title: 'Test',
        assignee: 'josh',
        delegate: 'claude-code@spud10',
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.assignee).toBe('josh');
        expect(result.data.delegate).toBe('claude-code@spud10');
      }
    });

    it('treats an absent delegate as unset rather than defaulting it', () => {
      const result = IssueSchema.safeParse({
        type: 'is',
        id: `is-${VALID_ULID}`,
        version: 1,
        title: 'Test',
        assignee: 'josh',
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.delegate).toBeUndefined();
      }
    });
  });

  describe('spec_path field', () => {
    it('accepts valid spec_path strings', () => {
      const issue = {
        type: 'is',
        id: `is-${VALID_ULID}`,
        version: 1,
        title: 'Test issue',
        spec_path: 'docs/project/specs/active/plan-2026-01-26-feature.md',
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
      };

      const result = IssueSchema.safeParse(issue);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.spec_path).toBe('docs/project/specs/active/plan-2026-01-26-feature.md');
      }
    });

    it('accepts missing spec_path (undefined)', () => {
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
        expect(result.data.spec_path).toBeUndefined();
      }
    });

    it('accepts null spec_path', () => {
      const issue = {
        type: 'is',
        id: `is-${VALID_ULID}`,
        version: 1,
        title: 'Test issue',
        spec_path: null,
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
      };

      const result = IssueSchema.safeParse(issue);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.spec_path).toBeNull();
      }
    });

    it('accepts short spec_path like filename only', () => {
      const issue = {
        type: 'is',
        id: `is-${VALID_ULID}`,
        version: 1,
        title: 'Test issue',
        spec_path: 'feature.md',
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
      };

      const result = IssueSchema.safeParse(issue);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.spec_path).toBe('feature.md');
      }
    });
  });
});

describe('ConfigSchema', () => {
  it('parses minimal config with defaults', () => {
    // Note: display.id_prefix is now required (no default)
    const config = {
      tbd_version: '3.0.0',
      display: { id_prefix: 'proj' },
    };

    const result = ConfigSchema.safeParse(config);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.sync.branch).toBe('tbd-sync');
      expect(result.data.sync.remote).toBe('origin');
      expect(result.data.display.id_prefix).toBe('proj');
      expect(result.data.settings.auto_sync).toBe(false);
    }
  });

  it('rejects config without required id_prefix', () => {
    const config = {
      tbd_version: '3.0.0',
    };

    const result = ConfigSchema.safeParse(config);
    expect(result.success).toBe(false);
  });

  it('preserves the optional launcher fallback for setup and boundary validation', () => {
    const base = {
      tbd_version: '3.0.1-dev.2.abc1234',
      display: { id_prefix: 'proj' },
    };

    const result = ConfigSchema.safeParse({ ...base, tbd_fallback_version: '3.1.0-beta.2' });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.tbd_fallback_version).toBe('3.1.0-beta.2');
    }
  });

  describe('docs_cache', () => {
    it('parses config with docs_cache.files', () => {
      const config = {
        tbd_version: '3.0.0',
        display: { id_prefix: 'proj' },
        docs_cache: {
          files: {
            'shortcuts/standard/code-review-and-commit.md':
              'internal:shortcuts/standard/code-review-and-commit.md',
            'custom/my-doc.md': 'https://example.com/my-doc.md',
          },
        },
      };

      const result = ConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.docs_cache?.files).toEqual({
          'shortcuts/standard/code-review-and-commit.md':
            'internal:shortcuts/standard/code-review-and-commit.md',
          'custom/my-doc.md': 'https://example.com/my-doc.md',
        });
      }
    });

    it('parses config with docs_cache.lookup_path', () => {
      const config = {
        tbd_version: '3.0.0',
        display: { id_prefix: 'proj' },
        docs_cache: {
          lookup_path: [
            '.tbd/docs/shortcuts/custom',
            '.tbd/docs/shortcuts/system',
            '.tbd/docs/shortcuts/standard',
          ],
        },
      };

      const result = ConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.docs_cache?.lookup_path).toEqual([
          '.tbd/docs/shortcuts/custom',
          '.tbd/docs/shortcuts/system',
          '.tbd/docs/shortcuts/standard',
        ]);
      }
    });

    it('parses config with full docs_cache structure', () => {
      const config = {
        tbd_version: '3.0.0',
        display: { id_prefix: 'proj' },
        docs_cache: {
          files: {
            'shortcuts/standard/code-review-and-commit.md':
              'internal:shortcuts/standard/code-review-and-commit.md',
          },
          lookup_path: ['.tbd/docs/shortcuts/system', '.tbd/docs/shortcuts/standard'],
        },
      };

      const result = ConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.docs_cache?.files).toBeDefined();
        expect(result.data.docs_cache?.lookup_path).toBeDefined();
      }
    });

    it('uses default lookup_path when not specified', () => {
      const config = {
        tbd_version: '3.0.0',
        display: { id_prefix: 'proj' },
        docs_cache: {},
      };

      const result = ConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.docs_cache?.lookup_path).toEqual([
          '.tbd/docs/shortcuts/system',
          '.tbd/docs/shortcuts/standard',
        ]);
      }
    });
  });
});
