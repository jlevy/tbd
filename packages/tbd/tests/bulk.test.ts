import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  emitBulkSummary,
  resolveAllIds,
  summarizeBulk,
  toJsonResult,
  type BulkItemResult,
} from '../src/cli/lib/bulk.js';
import type { CommandContext } from '../src/cli/lib/context.js';
import { OutputManager } from '../src/cli/lib/output.js';
import { addIdMapping, type IdMapping } from '../src/file/id-mapping.js';

function makeCtx(over: Partial<CommandContext> = {}): CommandContext {
  return {
    dryRun: false,
    verbose: false,
    quiet: false,
    json: false,
    color: 'never',
    debug: false,
    ...over,
  };
}

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

  it('processes a repeated input once, keeping the first occurrence', () => {
    const mapping = makeMapping({ aaaa: ULID_A, bbbb: ULID_B });
    const { resolved, missing } = resolveAllIds(['aaaa', 'aaaa', 'bbbb'], mapping);
    expect(resolved.map((r) => r.input)).toEqual(['aaaa', 'bbbb']);
    expect(missing).toHaveLength(0);
  });

  it('dedupes the same issue given under alias and canonical forms', () => {
    const mapping = makeMapping({ aaaa: ULID_A });
    const { resolved } = resolveAllIds(['aaaa', ULID_A], mapping);
    expect(resolved).toHaveLength(1);
    expect(resolved[0]!.input).toBe('aaaa');
    expect(resolved[0]!.internalId).toBe(`is-${ULID_A}`);
  });

  it('reports a repeated unknown input once', () => {
    const { missing } = resolveAllIds(['zzzz', 'zzzz'], makeMapping({}));
    expect(missing).toEqual(['zzzz']);
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
    expect(summarizeBulk(results)).toEqual({
      changed: 2,
      skipped: 1,
      missing: 1,
      failed: 0,
      total: 4,
    });
  });

  it('counts reopened and updated as changed', () => {
    const results: BulkItemResult[] = [
      { id: 'a', action: 'reopened', ok: true },
      { id: 'b', action: 'updated', ok: true },
    ];
    expect(summarizeBulk(results)).toEqual({
      changed: 2,
      skipped: 0,
      missing: 0,
      failed: 0,
      total: 2,
    });
  });

  it('tallies write failures separately from changed items', () => {
    const results: BulkItemResult[] = [
      { id: 'a', action: 'closed', ok: true },
      { id: 'b', action: 'failed', ok: false, skippedReason: 'EACCES: permission denied' },
    ];
    expect(summarizeBulk(results)).toEqual({
      changed: 1,
      skipped: 0,
      missing: 0,
      failed: 1,
      total: 2,
    });
  });

  it('summarizes an empty result set', () => {
    expect(summarizeBulk([])).toEqual({ changed: 0, skipped: 0, missing: 0, failed: 0, total: 0 });
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

describe('emitBulkSummary', () => {
  afterEach(() => vi.restoreAllMocks());

  it('prints one summary line (changed, skipped, missing) plus the sync hint in text mode', () => {
    const out = new OutputManager(makeCtx());
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    emitBulkSummary(
      out,
      [
        { id: 'a', action: 'closed', ok: true },
        { id: 'b', action: 'skipped', ok: true, skippedReason: 'already closed' },
        { id: 'c', action: 'missing', ok: false, skippedReason: 'not found' },
      ],
      { verb: 'Closed', skippedNote: 'already closed' },
    );
    const lines = log.mock.calls.map((c) => String(c[0]));
    expect(
      lines.some((l) => l.includes('Closed 1, skipped 1 (already closed), not found 1: a b c')),
    ).toBe(true);
    expect(lines.some((l) => l.includes('Unsynced changes'))).toBe(true);
  });

  it('omits the skipped clause for verbs that never skip (update)', () => {
    const out = new OutputManager(makeCtx());
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    emitBulkSummary(
      out,
      [
        { id: 'a', action: 'updated', ok: true },
        { id: 'b', action: 'updated', ok: true },
      ],
      { verb: 'Updated', skippedNote: 'unchanged' },
    );
    const lines = log.mock.calls.map((c) => String(c[0]));
    expect(lines.some((l) => l.includes('Updated 2: a b'))).toBe(true);
    expect(lines.some((l) => l.includes('skipped'))).toBe(false);
  });

  it('emits structured results, summary, and sync.pending under --json', () => {
    const out = new OutputManager(makeCtx({ json: true }));
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    emitBulkSummary(
      out,
      [
        { id: 'proj-a', action: 'closed', ok: true },
        { id: 'proj-b', action: 'skipped', ok: true, skippedReason: 'already closed' },
      ],
      { verb: 'Closed', skippedNote: 'already closed' },
    );
    expect(log).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(String(log.mock.calls[0]![0]));
    expect(payload.results).toEqual([
      { id: 'proj-a', action: 'closed', ok: true },
      { id: 'proj-b', action: 'skipped', ok: true, skippedReason: 'already closed' },
    ]);
    expect(payload.summary).toEqual({ changed: 1, skipped: 1, missing: 0, failed: 0, total: 2 });
    expect(payload.sync).toEqual({ pending: true, hint: 'Run `tbd sync` to publish.' });
  });

  it('carries missing and failed items (ok: false) through the --json results', () => {
    const out = new OutputManager(makeCtx({ json: true }));
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    emitBulkSummary(
      out,
      [
        { id: 'proj-a', action: 'closed', ok: true },
        { id: 'zzzz', action: 'missing', ok: false, skippedReason: 'not found' },
        { id: 'proj-c', action: 'failed', ok: false, skippedReason: 'EACCES: permission denied' },
      ],
      { verb: 'Closed', skippedNote: 'already closed' },
    );
    const payload = JSON.parse(String(log.mock.calls[0]![0]));
    expect(payload.results).toEqual([
      { id: 'proj-a', action: 'closed', ok: true },
      { id: 'zzzz', action: 'missing', ok: false, skippedReason: 'not found' },
      { id: 'proj-c', action: 'failed', ok: false, skippedReason: 'EACCES: permission denied' },
    ]);
    expect(payload.summary).toEqual({ changed: 1, skipped: 0, missing: 1, failed: 1, total: 3 });
    // Something DID change, so the sync hint must still be present.
    expect(payload.sync).toEqual({ pending: true, hint: 'Run `tbd sync` to publish.' });
  });

  it('renders the failed clause in the text summary line', () => {
    const out = new OutputManager(makeCtx());
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    emitBulkSummary(
      out,
      [
        { id: 'a', action: 'closed', ok: true },
        { id: 'b', action: 'failed', ok: false, skippedReason: 'disk full' },
      ],
      { verb: 'Closed', skippedNote: 'already closed' },
    );
    const lines = log.mock.calls.map((c) => String(c[0]));
    expect(lines.some((l) => l.includes('Closed 1, failed 1: a b'))).toBe(true);
  });

  it('omits sync when nothing changed', () => {
    const out = new OutputManager(makeCtx({ json: true }));
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    emitBulkSummary(
      out,
      [{ id: 'a', action: 'skipped', ok: true, skippedReason: 'already closed' }],
      { verb: 'Closed', skippedNote: 'already closed' },
    );
    const payload = JSON.parse(String(log.mock.calls[0]![0]));
    expect(payload.summary.changed).toBe(0);
    expect(payload.sync).toBeUndefined();
  });
});
