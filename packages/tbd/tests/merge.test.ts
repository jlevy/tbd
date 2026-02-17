/**
 * Tests for issue merge algorithm.
 *
 * The three-way merge algorithm uses field-level strategies:
 * - LWW (Last-Write-Wins): Compare updated_at timestamps
 * - Union: Combine arrays, deduplicate
 * - Max: Take maximum value (for version)
 * - Immutable: Keep base value
 *
 * See: tbd-design.md §3.4 Conflict Detection and Resolution
 */

import { describe, it, expect } from 'vitest';
import { mergeIssues, issuesSubstantivelyEqual } from '../src/file/git.js';
import type { Issue } from '../src/lib/types.js';

const makeIssue = (overrides: Partial<Issue> = {}): Issue => ({
  type: 'is',
  id: 'is-a1b2c3',
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

describe('mergeIssues', () => {
  describe('no base (independent creation)', () => {
    it('takes issue with earlier created_at when no base', () => {
      const local = makeIssue({
        title: 'Local issue',
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
      });
      const remote = makeIssue({
        title: 'Remote issue',
        created_at: '2025-01-02T00:00:00Z',
        updated_at: '2025-01-02T00:00:00Z',
      });

      const result = mergeIssues(null, local, remote);

      expect(result.merged.title).toBe('Local issue');
      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0]!.field).toBe('whole_issue');
    });

    it('takes remote when remote was created first', () => {
      const local = makeIssue({
        title: 'Local issue',
        created_at: '2025-01-02T00:00:00Z',
      });
      const remote = makeIssue({
        title: 'Remote issue',
        created_at: '2025-01-01T00:00:00Z',
      });

      const result = mergeIssues(null, local, remote);

      expect(result.merged.title).toBe('Remote issue');
      expect(result.conflicts).toHaveLength(1);
    });

    it('no conflict when issues are identical', () => {
      const local = makeIssue({ title: 'Same' });
      const remote = makeIssue({ title: 'Same' });

      const result = mergeIssues(null, local, remote);

      expect(result.conflicts).toHaveLength(0);
    });
  });

  describe('LWW strategy (title, description, status)', () => {
    it('takes value from issue with later updated_at', () => {
      const base = makeIssue({ title: 'Original' });
      const local = makeIssue({
        title: 'Local change',
        updated_at: '2025-01-02T00:00:00Z',
      });
      const remote = makeIssue({
        title: 'Remote change',
        updated_at: '2025-01-03T00:00:00Z',
      });

      const result = mergeIssues(base, local, remote);

      expect(result.merged.title).toBe('Remote change');
      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0]!.field).toBe('title');
      expect(result.conflicts[0]!.lost_value).toBe('Local change');
      expect(result.conflicts[0]!.winner_value).toBe('Remote change');
    });

    it('takes local when local has later timestamp', () => {
      const base = makeIssue({ title: 'Original' });
      const local = makeIssue({
        title: 'Local change',
        updated_at: '2025-01-03T00:00:00Z',
      });
      const remote = makeIssue({
        title: 'Remote change',
        updated_at: '2025-01-02T00:00:00Z',
      });

      const result = mergeIssues(base, local, remote);

      expect(result.merged.title).toBe('Local change');
    });

    it('applies LWW to status field', () => {
      const base = makeIssue({ status: 'open' });
      const local = makeIssue({
        status: 'in_progress',
        updated_at: '2025-01-02T00:00:00Z',
      });
      const remote = makeIssue({
        status: 'closed',
        updated_at: '2025-01-03T00:00:00Z',
      });

      const result = mergeIssues(base, local, remote);

      expect(result.merged.status).toBe('closed');
    });

    it('applies LWW to description field', () => {
      const base = makeIssue({ description: 'Original desc' });
      const local = makeIssue({
        description: 'Local desc',
        updated_at: '2025-01-03T00:00:00Z',
      });
      const remote = makeIssue({
        description: 'Remote desc',
        updated_at: '2025-01-02T00:00:00Z',
      });

      const result = mergeIssues(base, local, remote);

      expect(result.merged.description).toBe('Local desc');
    });
  });

  describe('Union strategy (labels, dependencies)', () => {
    it('combines labels from both sides', () => {
      const base = makeIssue({ labels: ['bug'] });
      const local = makeIssue({
        labels: ['bug', 'urgent'],
        updated_at: '2025-01-02T00:00:00Z',
      });
      const remote = makeIssue({
        labels: ['bug', 'backend'],
        updated_at: '2025-01-02T00:00:00Z',
      });

      const result = mergeIssues(base, local, remote);

      expect(result.merged.labels).toContain('bug');
      expect(result.merged.labels).toContain('urgent');
      expect(result.merged.labels).toContain('backend');
    });

    it('deduplicates labels', () => {
      const base = makeIssue({ labels: [] });
      const local = makeIssue({
        labels: ['bug', 'urgent'],
        updated_at: '2025-01-02T00:00:00Z',
      });
      const remote = makeIssue({
        labels: ['bug', 'backend'],
        updated_at: '2025-01-02T00:00:00Z',
      });

      const result = mergeIssues(base, local, remote);

      const bugCount = result.merged.labels.filter((l) => l === 'bug').length;
      expect(bugCount).toBe(1);
    });

    it('combines dependencies from both sides', () => {
      const base = makeIssue({ dependencies: [] });
      const local = makeIssue({
        dependencies: [{ type: 'blocks', target: 'is-aaaaaa' }],
        updated_at: '2025-01-02T00:00:00Z',
      });
      const remote = makeIssue({
        dependencies: [{ type: 'blocks', target: 'is-bbbbbb' }],
        updated_at: '2025-01-02T00:00:00Z',
      });

      const result = mergeIssues(base, local, remote);

      expect(result.merged.dependencies).toHaveLength(2);
      expect(result.merged.dependencies.map((d) => d.target)).toContain('is-aaaaaa');
      expect(result.merged.dependencies.map((d) => d.target)).toContain('is-bbbbbb');
    });
  });

  describe('Max strategy (version)', () => {
    it('returns higher version without bumping when no substantive changes', () => {
      const base = makeIssue({ version: 1 });
      const local = makeIssue({ version: 3, updated_at: '2025-01-02T00:00:00Z' });
      const remote = makeIssue({ version: 5, updated_at: '2025-01-02T00:00:00Z' });

      const result = mergeIssues(base, local, remote);

      // No substantive changes - returns higher version (remote=5) without bumping
      expect(result.merged.version).toBe(5);
    });

    it('bumps version when there are substantive changes', () => {
      const base = makeIssue({ version: 1 });
      const local = makeIssue({
        title: 'Local title',
        version: 3,
        updated_at: '2025-01-02T00:00:00Z',
      });
      const remote = makeIssue({
        description: 'Remote desc',
        version: 5,
        updated_at: '2025-01-02T00:00:00Z',
      });

      const result = mergeIssues(base, local, remote);

      // Substantive changes in both sides - max(3, 5) + 1 = 6
      expect(result.merged.version).toBe(6);
      expect(result.merged.title).toBe('Local title');
      expect(result.merged.description).toBe('Remote desc');
    });
  });

  describe('Immutable strategy (id, type, created_at)', () => {
    it('keeps base id even if both changed', () => {
      const base = makeIssue({ id: 'is-original' });
      const local = makeIssue({
        id: 'is-local',
        updated_at: '2025-01-02T00:00:00Z',
      });
      const remote = makeIssue({
        id: 'is-remote',
        updated_at: '2025-01-03T00:00:00Z',
      });

      const result = mergeIssues(base, local, remote);

      expect(result.merged.id).toBe('is-original');
    });

    it('keeps base created_at', () => {
      const base = makeIssue({ created_at: '2025-01-01T00:00:00Z' });
      const local = makeIssue({
        created_at: '2025-01-02T00:00:00Z',
        updated_at: '2025-01-03T00:00:00Z',
      });
      const remote = makeIssue({
        created_at: '2025-01-03T00:00:00Z',
        updated_at: '2025-01-04T00:00:00Z',
      });

      const result = mergeIssues(base, local, remote);

      expect(result.merged.created_at).toBe('2025-01-01T00:00:00Z');
    });
  });

  describe('One-sided changes', () => {
    it('takes local change when remote unchanged', () => {
      const base = makeIssue({ title: 'Original' });
      const local = makeIssue({ title: 'Changed locally' });
      const remote = makeIssue({ title: 'Original' });

      const result = mergeIssues(base, local, remote);

      expect(result.merged.title).toBe('Changed locally');
      expect(result.conflicts).toHaveLength(0);
    });

    it('takes remote change when local unchanged', () => {
      const base = makeIssue({ title: 'Original' });
      const local = makeIssue({ title: 'Original' });
      const remote = makeIssue({ title: 'Changed remotely' });

      const result = mergeIssues(base, local, remote);

      expect(result.merged.title).toBe('Changed remotely');
      expect(result.conflicts).toHaveLength(0);
    });

    it('no change when both unchanged from base', () => {
      const base = makeIssue({ title: 'Original', status: 'open' });
      const local = makeIssue({ title: 'Original', status: 'open' });
      const remote = makeIssue({ title: 'Original', status: 'open' });

      const result = mergeIssues(base, local, remote);

      expect(result.merged.title).toBe('Original');
      expect(result.merged.status).toBe('open');
    });
  });

  describe('Conflict entry generation', () => {
    it('records conflict with correct metadata', () => {
      const base = makeIssue({ title: 'Original' });
      const local = makeIssue({
        title: 'Local',
        version: 2,
        updated_at: '2025-01-02T00:00:00Z',
      });
      const remote = makeIssue({
        title: 'Remote',
        version: 3,
        updated_at: '2025-01-03T00:00:00Z',
      });

      const result = mergeIssues(base, local, remote);

      expect(result.conflicts).toHaveLength(1);
      const conflict = result.conflicts[0]!;
      expect(conflict.field).toBe('title');
      expect(conflict.lost_value).toBe('Local');
      expect(conflict.winner_value).toBe('Remote');
      expect(conflict.local_version).toBe(2);
      expect(conflict.remote_version).toBe(3);
      expect(conflict.resolution).toBe('lww');
    });

    it('generates timestamp for conflict entry', () => {
      const base = makeIssue({ title: 'Original' });
      const local = makeIssue({ title: 'Local', updated_at: '2025-01-02T00:00:00Z' });
      const remote = makeIssue({ title: 'Remote', updated_at: '2025-01-03T00:00:00Z' });

      const result = mergeIssues(base, local, remote);

      expect(result.conflicts[0]!.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}Z$/);
    });
  });

  describe('Complex scenarios', () => {
    it('handles multiple field conflicts', () => {
      const base = makeIssue({
        title: 'Original title',
        description: 'Original desc',
        status: 'open',
      });
      const local = makeIssue({
        title: 'Local title',
        description: 'Local desc',
        status: 'in_progress',
        updated_at: '2025-01-02T00:00:00Z',
      });
      const remote = makeIssue({
        title: 'Remote title',
        description: 'Remote desc',
        status: 'closed',
        updated_at: '2025-01-03T00:00:00Z',
      });

      const result = mergeIssues(base, local, remote);

      // Remote wins all LWW fields due to later timestamp
      expect(result.merged.title).toBe('Remote title');
      expect(result.merged.description).toBe('Remote desc');
      expect(result.merged.status).toBe('closed');
      expect(result.conflicts).toHaveLength(3);
    });

    it('handles mix of strategies in one merge', () => {
      const base = makeIssue({
        title: 'Original',
        labels: ['bug'],
        version: 1,
      });
      const local = makeIssue({
        title: 'Local title',
        labels: ['bug', 'urgent'],
        version: 2,
        updated_at: '2025-01-03T00:00:00Z',
      });
      const remote = makeIssue({
        title: 'Remote title',
        labels: ['bug', 'backend'],
        version: 3,
        updated_at: '2025-01-02T00:00:00Z',
      });

      const result = mergeIssues(base, local, remote);

      // LWW: local wins (later timestamp)
      expect(result.merged.title).toBe('Local title');
      // Union: all labels combined
      expect(result.merged.labels).toContain('urgent');
      expect(result.merged.labels).toContain('backend');
      // Substantive changes (title changed, labels changed) - version bumped: max(2, 3) + 1 = 4
      expect(result.merged.version).toBe(4);
    });
  });

  describe('No-op merge detection', () => {
    it('does not bump version when merge is a no-op (identical issues)', () => {
      const base = makeIssue({ version: 1 });
      const local = makeIssue({ version: 2, updated_at: '2025-01-02T00:00:00Z' });
      const remote = makeIssue({ version: 3, updated_at: '2025-01-03T00:00:00Z' });

      const result = mergeIssues(base, local, remote);

      // No substantive changes - returns higher version (remote=3) without bumping
      expect(result.merged.version).toBe(3);
      expect(result.conflicts).toHaveLength(0);
    });

    it('does not bump version when one-sided change matches latest', () => {
      const base = makeIssue({ title: 'Original' });
      const local = makeIssue({ title: 'Changed', version: 5, updated_at: '2025-01-02T00:00:00Z' });
      const remote = makeIssue({ title: 'Original', version: 3 });

      const result = mergeIssues(base, local, remote);

      // Local changed title, remote didn't. Merged matches local.
      // Since local has higher version, return local as-is.
      expect(result.merged.title).toBe('Changed');
      expect(result.merged.version).toBe(5);
    });

    it('bumps version when merge produces content not in either input', () => {
      const base = makeIssue({ title: 'Original', description: 'Original desc' });
      const local = makeIssue({
        title: 'Local title',
        description: 'Original desc',
        version: 2,
        updated_at: '2025-01-02T00:00:00Z',
      });
      const remote = makeIssue({
        title: 'Original',
        description: 'Remote desc',
        version: 3,
        updated_at: '2025-01-02T00:00:00Z',
      });

      const result = mergeIssues(base, local, remote);

      // Both sides changed different fields - true three-way merge
      expect(result.merged.title).toBe('Local title');
      expect(result.merged.description).toBe('Remote desc');
      // max(2, 3) + 1 = 4
      expect(result.merged.version).toBe(4);
    });
  });

  describe('issuesSubstantivelyEqual', () => {
    it('returns true for identical issues', () => {
      const a = makeIssue();
      const b = makeIssue();
      expect(issuesSubstantivelyEqual(a, b)).toBe(true);
    });

    it('returns true when only version differs', () => {
      const a = makeIssue({ version: 1 });
      const b = makeIssue({ version: 5 });
      expect(issuesSubstantivelyEqual(a, b)).toBe(true);
    });

    it('returns true when only updated_at differs', () => {
      const a = makeIssue({ updated_at: '2025-01-01T00:00:00Z' });
      const b = makeIssue({ updated_at: '2025-12-31T23:59:59Z' });
      expect(issuesSubstantivelyEqual(a, b)).toBe(true);
    });

    it('returns true when only version and updated_at differ', () => {
      const a = makeIssue({ version: 1, updated_at: '2025-01-01T00:00:00Z' });
      const b = makeIssue({ version: 99, updated_at: '2025-12-31T23:59:59Z' });
      expect(issuesSubstantivelyEqual(a, b)).toBe(true);
    });

    it('returns false when title differs', () => {
      const a = makeIssue({ title: 'Title A' });
      const b = makeIssue({ title: 'Title B' });
      expect(issuesSubstantivelyEqual(a, b)).toBe(false);
    });

    it('returns false when status differs', () => {
      const a = makeIssue({ status: 'open' });
      const b = makeIssue({ status: 'closed' });
      expect(issuesSubstantivelyEqual(a, b)).toBe(false);
    });

    it('returns false when labels differ', () => {
      const a = makeIssue({ labels: ['bug'] });
      const b = makeIssue({ labels: ['feature'] });
      expect(issuesSubstantivelyEqual(a, b)).toBe(false);
    });
  });
});
