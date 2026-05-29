/**
 * Unit tests for categorizeIssuesByUlid (the pure core of the unrelated-history
 * rescue). Buckets issues across two unrelated roots by ULID/id so the rescue
 * never relies on a git merge base.
 *
 * See: tbd-6l8r (plan-2026-05-29-tbd-sync-unrelated-history-hardening.md)
 */

import { describe, it, expect } from 'vitest';

import { categorizeIssuesByUlid } from '../src/file/git.js';
import { createTestIssue } from './test-helpers.js';

const A = '01rescuecat00000000000000a1';
const B = '01rescuecat00000000000000b2';
const C = '01rescuecat00000000000000c3';
const D = '01rescuecat00000000000000d4';

describe('categorizeIssuesByUlid', () => {
  it('buckets issues into local-only / remote-only / identical / different', () => {
    const local = [
      createTestIssue({ id: `is-${A}`, title: 'shared identical' }),
      createTestIssue({ id: `is-${B}`, title: 'local title' }),
      createTestIssue({ id: `is-${C}`, title: 'local only' }),
    ];
    const remote = [
      createTestIssue({ id: `is-${A}`, title: 'shared identical' }),
      createTestIssue({ id: `is-${B}`, title: 'remote title' }),
      createTestIssue({ id: `is-${D}`, title: 'remote only' }),
    ];

    const buckets = categorizeIssuesByUlid(local, remote);

    expect(buckets.localOnly.map((i) => i.id)).toEqual([`is-${C}`]);
    expect(buckets.remoteOnly.map((i) => i.id)).toEqual([`is-${D}`]);
    expect(buckets.bothIdentical.map((i) => i.id)).toEqual([`is-${A}`]);
    expect(buckets.bothDifferent.map((p) => p.local.id)).toEqual([`is-${B}`]);
    expect(buckets.bothDifferent[0]?.local.title).toBe('local title');
    expect(buckets.bothDifferent[0]?.remote.title).toBe('remote title');
  });

  it('treats version/timestamp-only differences as identical (substantive equality)', () => {
    const local = [
      createTestIssue({
        id: `is-${A}`,
        title: 'same',
        version: 9,
        updated_at: '2026-05-01T00:00:00Z',
      }),
    ];
    const remote = [
      createTestIssue({
        id: `is-${A}`,
        title: 'same',
        version: 2,
        updated_at: '2026-01-01T00:00:00Z',
      }),
    ];
    const buckets = categorizeIssuesByUlid(local, remote);
    expect(buckets.bothIdentical).toHaveLength(1);
    expect(buckets.bothDifferent).toHaveLength(0);
  });

  it('handles empty inputs', () => {
    const buckets = categorizeIssuesByUlid([], []);
    expect(buckets.localOnly).toHaveLength(0);
    expect(buckets.remoteOnly).toHaveLength(0);
    expect(buckets.bothIdentical).toHaveLength(0);
    expect(buckets.bothDifferent).toHaveLength(0);
  });
});
