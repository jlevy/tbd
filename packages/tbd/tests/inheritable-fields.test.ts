/**
 * Tests for inheritable-fields.ts - Generic parent→child field inheritance.
 *
 * Covers:
 * - inheritFromParent() copies registered fields when not explicitly set
 * - inheritFromParent() does NOT overwrite explicitly set fields
 * - propagateToChildren() updates children with null or old-matching values
 * - propagateToChildren() skips children with explicitly different values
 * - captureInheritableValues() captures all registered fields
 * - Both spec_path and external_issue_url are exercised
 */

import { describe, it, expect, vi } from 'vitest';
import type { Issue } from '../src/lib/types.js';
import {
  inheritFromParent,
  propagateToChildren,
  captureInheritableValues,
  INHERITABLE_FIELDS,
} from '../src/lib/inheritable-fields.js';

const makeIssue = (overrides: Partial<Issue> = {}): Issue => ({
  type: 'is',
  id: 'is-00000000000000000000000001',
  version: 1,
  kind: 'task',
  title: 'Test issue',
  status: 'open',
  priority: 2,
  labels: [],
  dependencies: [],
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
  ...overrides,
});

// =============================================================================
// INHERITABLE_FIELDS registry
// =============================================================================

describe('INHERITABLE_FIELDS', () => {
  it('includes spec_path', () => {
    expect(INHERITABLE_FIELDS.some((f) => f.field === 'spec_path')).toBe(true);
  });

  it('includes external_issue_url', () => {
    expect(INHERITABLE_FIELDS.some((f) => f.field === 'external_issue_url')).toBe(true);
  });
});

// =============================================================================
// inheritFromParent
// =============================================================================

describe('inheritFromParent', () => {
  it('copies spec_path from parent when not explicitly set', () => {
    const parent = makeIssue({ spec_path: 'docs/spec-a.md' });
    const child: Partial<Issue> = {};

    inheritFromParent(child, parent, new Set());

    expect(child.spec_path).toBe('docs/spec-a.md');
  });

  it('copies external_issue_url from parent when not explicitly set', () => {
    const parent = makeIssue({
      external_issue_url: 'https://github.com/owner/repo/issues/1',
    });
    const child: Partial<Issue> = {};

    inheritFromParent(child, parent, new Set());

    expect(child.external_issue_url).toBe('https://github.com/owner/repo/issues/1');
  });

  it('copies both fields from parent when neither is explicitly set', () => {
    const parent = makeIssue({
      spec_path: 'docs/spec-a.md',
      external_issue_url: 'https://github.com/owner/repo/issues/1',
    });
    const child: Partial<Issue> = {};

    inheritFromParent(child, parent, new Set());

    expect(child.spec_path).toBe('docs/spec-a.md');
    expect(child.external_issue_url).toBe('https://github.com/owner/repo/issues/1');
  });

  it('does NOT overwrite explicitly set spec_path', () => {
    const parent = makeIssue({ spec_path: 'docs/parent-spec.md' });
    const child: Partial<Issue> = { spec_path: 'docs/child-spec.md' };

    inheritFromParent(child, parent, new Set(['spec_path']));

    expect(child.spec_path).toBe('docs/child-spec.md');
  });

  it('does NOT overwrite explicitly set external_issue_url', () => {
    const parent = makeIssue({
      external_issue_url: 'https://github.com/owner/repo/issues/1',
    });
    const child: Partial<Issue> = {
      external_issue_url: 'https://github.com/owner/repo/issues/2',
    };

    inheritFromParent(child, parent, new Set(['external_issue_url']));

    expect(child.external_issue_url).toBe('https://github.com/owner/repo/issues/2');
  });

  it('inherits one field while respecting explicit set on another', () => {
    const parent = makeIssue({
      spec_path: 'docs/parent-spec.md',
      external_issue_url: 'https://github.com/owner/repo/issues/1',
    });
    const child: Partial<Issue> = { spec_path: 'docs/child-spec.md' };

    inheritFromParent(child, parent, new Set(['spec_path']));

    expect(child.spec_path).toBe('docs/child-spec.md');
    expect(child.external_issue_url).toBe('https://github.com/owner/repo/issues/1');
  });

  it('does not inherit when parent has no value', () => {
    const parent = makeIssue({});
    const child: Partial<Issue> = {};

    inheritFromParent(child, parent, new Set());

    expect(child.spec_path).toBeUndefined();
    expect(child.external_issue_url).toBeUndefined();
  });
});

// =============================================================================
// propagateToChildren
// =============================================================================

describe('propagateToChildren', () => {
  it('propagates spec_path change to children with null value', async () => {
    const parent = makeIssue({
      id: 'is-00000000000000000000000001',
      spec_path: 'docs/new-spec.md',
    });
    const child = makeIssue({
      id: 'is-00000000000000000000000002',
      parent_id: parent.id,
      spec_path: undefined,
    });

    const writeFn = vi.fn().mockResolvedValue(undefined);
    const count = await propagateToChildren(
      parent,
      { spec_path: undefined },
      [child],
      writeFn,
      '2025-06-01T00:00:00Z',
    );

    expect(count).toBe(1);
    expect(child.spec_path).toBe('docs/new-spec.md');
    expect(writeFn).toHaveBeenCalledOnce();
  });

  it('propagates spec_path change to children with old value', async () => {
    const parent = makeIssue({ spec_path: 'docs/new-spec.md' });
    const child = makeIssue({ spec_path: 'docs/old-spec.md' });

    const writeFn = vi.fn().mockResolvedValue(undefined);
    const count = await propagateToChildren(
      parent,
      { spec_path: 'docs/old-spec.md' },
      [child],
      writeFn,
      '2025-06-01T00:00:00Z',
    );

    expect(count).toBe(1);
    expect(child.spec_path).toBe('docs/new-spec.md');
  });

  it('skips children with different value from old', async () => {
    const parent = makeIssue({ spec_path: 'docs/new-spec.md' });
    const child = makeIssue({ spec_path: 'docs/different-spec.md' });

    const writeFn = vi.fn().mockResolvedValue(undefined);
    const count = await propagateToChildren(
      parent,
      { spec_path: 'docs/old-spec.md' },
      [child],
      writeFn,
      '2025-06-01T00:00:00Z',
    );

    expect(count).toBe(0);
    expect(child.spec_path).toBe('docs/different-spec.md');
    expect(writeFn).not.toHaveBeenCalled();
  });

  it('propagates external_issue_url to children', async () => {
    const parent = makeIssue({
      external_issue_url: 'https://github.com/owner/repo/issues/2',
    });
    const child = makeIssue({ external_issue_url: undefined });

    const writeFn = vi.fn().mockResolvedValue(undefined);
    const count = await propagateToChildren(
      parent,
      { external_issue_url: undefined },
      [child],
      writeFn,
      '2025-06-01T00:00:00Z',
    );

    expect(count).toBe(1);
    expect(child.external_issue_url).toBe('https://github.com/owner/repo/issues/2');
  });

  it('propagates multiple fields in one pass', async () => {
    const parent = makeIssue({
      spec_path: 'docs/new-spec.md',
      external_issue_url: 'https://github.com/owner/repo/issues/2',
    });
    const child = makeIssue({
      spec_path: undefined,
      external_issue_url: undefined,
    });

    const writeFn = vi.fn().mockResolvedValue(undefined);
    const count = await propagateToChildren(
      parent,
      { spec_path: undefined, external_issue_url: undefined },
      [child],
      writeFn,
      '2025-06-01T00:00:00Z',
    );

    expect(count).toBe(1);
    expect(child.spec_path).toBe('docs/new-spec.md');
    expect(child.external_issue_url).toBe('https://github.com/owner/repo/issues/2');
    // Should only write once even though two fields changed
    expect(writeFn).toHaveBeenCalledOnce();
  });

  it('increments version and sets updated_at on modified children', async () => {
    const parent = makeIssue({ spec_path: 'docs/new-spec.md' });
    const child = makeIssue({ version: 3, spec_path: undefined });

    const writeFn = vi.fn().mockResolvedValue(undefined);
    await propagateToChildren(
      parent,
      { spec_path: undefined },
      [child],
      writeFn,
      '2025-06-01T12:00:00Z',
    );

    expect(child.version).toBe(4);
    expect(child.updated_at).toBe('2025-06-01T12:00:00Z');
  });

  it('does not modify children when field did not change', async () => {
    const parent = makeIssue({ spec_path: 'docs/same-spec.md' });
    const child = makeIssue({ spec_path: 'docs/same-spec.md' });

    const writeFn = vi.fn().mockResolvedValue(undefined);
    const count = await propagateToChildren(
      parent,
      { spec_path: 'docs/same-spec.md' },
      [child],
      writeFn,
      '2025-06-01T00:00:00Z',
    );

    expect(count).toBe(0);
    expect(writeFn).not.toHaveBeenCalled();
  });

  it('handles empty children array', async () => {
    const parent = makeIssue({ spec_path: 'docs/new-spec.md' });

    const writeFn = vi.fn().mockResolvedValue(undefined);
    const count = await propagateToChildren(
      parent,
      { spec_path: undefined },
      [],
      writeFn,
      '2025-06-01T00:00:00Z',
    );

    expect(count).toBe(0);
    expect(writeFn).not.toHaveBeenCalled();
  });

  it('handles mixed children: some eligible, some not', async () => {
    const parent = makeIssue({
      spec_path: 'docs/new-spec.md',
      external_issue_url: 'https://github.com/owner/repo/issues/2',
    });
    const child1 = makeIssue({
      id: 'is-00000000000000000000000010',
      spec_path: 'docs/old-spec.md',
      external_issue_url: undefined,
    });
    const child2 = makeIssue({
      id: 'is-00000000000000000000000011',
      spec_path: 'docs/different-spec.md',
      external_issue_url: 'https://github.com/owner/repo/issues/99',
    });
    const child3 = makeIssue({
      id: 'is-00000000000000000000000012',
      spec_path: undefined,
      external_issue_url: undefined,
    });

    const writeFn = vi.fn().mockResolvedValue(undefined);
    const count = await propagateToChildren(
      parent,
      { spec_path: 'docs/old-spec.md', external_issue_url: undefined },
      [child1, child2, child3],
      writeFn,
      '2025-06-01T00:00:00Z',
    );

    // child1: spec_path matches old, external_issue_url is null → both updated
    expect(child1.spec_path).toBe('docs/new-spec.md');
    expect(child1.external_issue_url).toBe('https://github.com/owner/repo/issues/2');

    // child2: spec_path is different, external_issue_url is different → neither updated
    expect(child2.spec_path).toBe('docs/different-spec.md');
    expect(child2.external_issue_url).toBe('https://github.com/owner/repo/issues/99');

    // child3: both null → both updated
    expect(child3.spec_path).toBe('docs/new-spec.md');
    expect(child3.external_issue_url).toBe('https://github.com/owner/repo/issues/2');

    expect(count).toBe(2); // child1 and child3 updated
    expect(writeFn).toHaveBeenCalledTimes(2);
  });
});

// =============================================================================
// captureInheritableValues
// =============================================================================

describe('captureInheritableValues', () => {
  it('captures both spec_path and external_issue_url', () => {
    const issue = makeIssue({
      spec_path: 'docs/spec.md',
      external_issue_url: 'https://github.com/owner/repo/issues/1',
    });
    const values = captureInheritableValues(issue);

    expect(values.spec_path).toBe('docs/spec.md');
    expect(values.external_issue_url).toBe('https://github.com/owner/repo/issues/1');
  });

  it('captures undefined when fields are not set', () => {
    const issue = makeIssue({});
    const values = captureInheritableValues(issue);

    expect(values.spec_path).toBeUndefined();
    expect(values.external_issue_url).toBeUndefined();
  });
});
