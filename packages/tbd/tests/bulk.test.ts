import { afterEach, describe, expect, it, vi } from 'vitest';

import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  emitBulkSummary,
  resolveAllIds,
  loadAllIssues,
  orderedResults,
  summarizeBulk,
  throwOnWriteFailures,
  toJsonResult,
  type BulkItemResult,
} from '../src/cli/lib/bulk.js';
import { serializeIssue } from '../src/file/parser.js';
import { NotFoundError } from '../src/cli/lib/errors.js';
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
    const { resolved, missing, orderedInputs } = resolveAllIds(['aaaa', 'aaaa', 'bbbb'], mapping);
    expect(resolved.map((r) => r.input)).toEqual(['aaaa', 'bbbb']);
    expect(missing).toHaveLength(0);
    expect(orderedInputs).toEqual(['aaaa', 'bbbb']);
  });

  it('interleaves resolved and missing inputs in argv order', () => {
    const mapping = makeMapping({ aaaa: ULID_A, bbbb: ULID_B });
    const { orderedInputs } = resolveAllIds(['zzzz', 'aaaa', 'yyyy', 'bbbb'], mapping);
    expect(orderedInputs).toEqual(['zzzz', 'aaaa', 'yyyy', 'bbbb']);
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

  it('renders the failed clause as a warning, not a success line', () => {
    const out = new OutputManager(makeCtx());
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const err = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    emitBulkSummary(
      out,
      [
        { id: 'a', action: 'closed', ok: true },
        { id: 'b', action: 'failed', ok: false, skippedReason: 'disk full' },
      ],
      { verb: 'Closed', skippedNote: 'already closed' },
    );
    const errLines = err.mock.calls.map((c) => String(c[0]));
    expect(errLines.some((l) => l.includes('Closed 1, failed 1: a b'))).toBe(true);
    const logLines = log.mock.calls.map((c) => String(c[0]));
    expect(logLines.some((l) => l.includes('failed 1'))).toBe(false);
  });

  it('keeps the sync field with pending:false when nothing changed', () => {
    const out = new OutputManager(makeCtx({ json: true }));
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    emitBulkSummary(
      out,
      [{ id: 'a', action: 'skipped', ok: true, skippedReason: 'already closed' }],
      { verb: 'Closed', skippedNote: 'already closed' },
    );
    const payload = JSON.parse(String(log.mock.calls[0]![0]));
    expect(payload.summary.changed).toBe(0);
    expect(payload.sync).toEqual({ pending: false });
  });
});

describe('orderedResults', () => {
  it('assembles outcomes in first-occurrence argv order', () => {
    const outcomes = new Map<string, BulkItemResult>([
      ['b', { id: 'B', action: 'closed', ok: true }],
      ['zzzz', { id: 'zzzz', action: 'missing', ok: false, skippedReason: 'not found' }],
      ['a', { id: 'A', action: 'failed', ok: false, skippedReason: 'disk full' }],
    ]);
    const results = orderedResults(['zzzz', 'a', 'b'], outcomes);
    expect(results.map((r) => r.id)).toEqual(['zzzz', 'A', 'B']);
  });
});

describe('throwOnWriteFailures', () => {
  it('does nothing when no writes failed', () => {
    expect(() => {
      throwOnWriteFailures([{ id: 'a', action: 'closed', ok: true }], 'close');
    }).not.toThrow();
  });

  it('names every failed ID with its error and counts only attempted writes', () => {
    const results: BulkItemResult[] = [
      { id: 'a', action: 'closed', ok: true },
      { id: 'b', action: 'skipped', ok: true, skippedReason: 'already closed' },
      { id: 'c', action: 'failed', ok: false, skippedReason: 'EACCES: permission denied' },
    ];
    expect(() => {
      throwOnWriteFailures(results, 'close');
    }).toThrow('1 of 2 attempted close writes failed: c (EACCES: permission denied)');
  });
});

describe('loadAllIssues', () => {
  const BASE_ISSUE = {
    type: 'is' as const,
    id: `is-${ULID_A}`,
    version: 1,
    kind: 'task' as const,
    title: 'Load test',
    status: 'open' as const,
    priority: 2,
    labels: [],
    dependencies: [],
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
  };

  async function makeDataDir(): Promise<string> {
    const dir = await mkdtemp(join(tmpdir(), 'bulk-load-'));
    await mkdir(join(dir, 'issues'), { recursive: true });
    await writeFile(join(dir, 'issues', `is-${ULID_A}.md`), serializeIssue(BASE_ISSUE), 'utf-8');
    return dir;
  }

  it('treats an absent file as missing under ignoreMissing', async () => {
    const dir = await makeDataDir();
    try {
      const outcomes = new Map<string, BulkItemResult>();
      const loaded = await loadAllIssues(
        dir,
        [
          { input: 'aaaa', internalId: `is-${ULID_A}` },
          { input: 'gone', internalId: `is-${ULID_B}` },
        ],
        true,
        outcomes,
      );
      expect(loaded).toHaveLength(1);
      expect(outcomes.get('gone')).toEqual({
        id: 'gone',
        action: 'missing',
        ok: false,
        skippedReason: 'not found',
      });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('throws NotFoundError for an absent file without ignoreMissing', async () => {
    const dir = await makeDataDir();
    try {
      await expect(
        loadAllIssues(dir, [{ input: 'gone', internalId: `is-${ULID_B}` }], false, new Map()),
      ).rejects.toThrow(NotFoundError);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('aborts on a corrupt issue file even with ignoreMissing (never a skip)', async () => {
    const dir = await makeDataDir();
    try {
      await writeFile(join(dir, 'issues', `is-${ULID_B}.md`), 'not: [valid', 'utf-8');
      const outcomes = new Map<string, BulkItemResult>();
      await expect(
        loadAllIssues(
          dir,
          [
            { input: 'aaaa', internalId: `is-${ULID_A}` },
            { input: 'bad', internalId: `is-${ULID_B}` },
          ],
          true,
          outcomes,
        ),
      ).rejects.toThrow();
      expect(outcomes.size).toBe(0);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
