import { describe, it, expect } from 'vitest';

import {
  resolveAllIds,
  summarizeBulk,
  toJsonResult,
  type BulkItemResult,
} from '../src/cli/lib/bulk.js';
import { addIdMapping, type IdMapping } from '../src/file/id-mapping.js';

const ULID_A = 'a'.repeat(26);
const ULID_B = 'b'.repeat(26);

function makeMapping(shorts: Record<string, string>): IdMapping {
  const mapping: IdMapping = { shortToUlid: new Map(), ulidToShort: new Map() };
  for (const [short, ulid] of Object.entries(shorts)) {
    addIdMapping(mapping, ulid, short);
  }
  return mapping;
}

describe('resolveAllIds', () => {
  it('resolves known IDs and collects unknown ones, preserving order', () => {
    const mapping = makeMapping({ aaaa: ULID_A, bbbb: ULID_B });
    const { resolved, missing } = resolveAllIds(['aaaa', 'zzzz', 'bbbb'], mapping);
    expect(resolved.map((r) => r.input)).toEqual(['aaaa', 'bbbb']);
    expect(missing).toEqual(['zzzz']);
  });

  it('reports every input as missing when nothing resolves', () => {
    const { resolved, missing } = resolveAllIds(['zzzz', 'yyyy'], makeMapping({}));
    expect(resolved).toHaveLength(0);
    expect(missing).toEqual(['zzzz', 'yyyy']);
  });

  it('handles an empty input list', () => {
    const { resolved, missing } = resolveAllIds([], makeMapping({}));
    expect(resolved).toHaveLength(0);
    expect(missing).toHaveLength(0);
  });
});

describe('summarizeBulk', () => {
  it('tallies changed, skipped, and missing', () => {
    const results: BulkItemResult[] = [
      { id: 'a', action: 'closed', ok: true },
      { id: 'b', action: 'closed', ok: true },
      { id: 'c', action: 'skipped', ok: true, skippedReason: 'already closed' },
      { id: 'd', action: 'missing', ok: false, skippedReason: 'not found' },
    ];
    expect(summarizeBulk(results)).toEqual({ changed: 2, skipped: 1, missing: 1, total: 4 });
  });

  it('counts reopened and updated as changed', () => {
    const results: BulkItemResult[] = [
      { id: 'a', action: 'reopened', ok: true },
      { id: 'b', action: 'updated', ok: true },
    ];
    expect(summarizeBulk(results)).toEqual({ changed: 2, skipped: 0, missing: 0, total: 2 });
  });

  it('summarizes an empty result set', () => {
    expect(summarizeBulk([])).toEqual({ changed: 0, skipped: 0, missing: 0, total: 0 });
  });
});

describe('toJsonResult', () => {
  it('omits skippedReason when absent', () => {
    expect(toJsonResult({ id: 'a', action: 'closed', ok: true })).toEqual({
      id: 'a',
      action: 'closed',
      ok: true,
    });
  });

  it('includes skippedReason when present', () => {
    expect(
      toJsonResult({ id: 'a', action: 'skipped', ok: true, skippedReason: 'already closed' }),
    ).toEqual({ id: 'a', action: 'skipped', ok: true, skippedReason: 'already closed' });
  });
});
