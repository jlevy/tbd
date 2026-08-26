/**
 * `deferred_until` is a scheduling field, and two surfaces ignored it.
 *
 * `tbd ready` offered a bead deferred to 2027 as available work today, so the field
 * read as scheduling while changing nothing about what was surfaced. And
 * `tbd list --defer-before <date>` was declared in the option table and help text but
 * never read by any filter, so it returned the same rows as no flag at all — a silent
 * no-op is worse than a missing flag, because the caller believes the filter applied.
 */

import { describe, expect, it } from 'vitest';

import { ValidationError } from '../src/cli/lib/errors.js';
import { parseDateOption } from '../src/cli/lib/issue-input-validation.js';
import { defaultIssueQuery, selectIssues } from '../src/lib/issue-query.js';
import { readyIssueIds } from '../src/lib/issue-selection.js';
import type { Issue } from '../src/lib/types.js';

const NOW = Date.parse('2026-06-01T00:00:00.000Z');

function issue(id: string, overrides: Partial<Issue> = {}): Issue {
  return {
    type: 'is',
    id: `is-01HZZZZZZZZZZZZZZZZZ${id.padStart(6, '0')}`,
    version: 1,
    title: `Issue ${id}`,
    kind: 'task',
    status: 'open',
    priority: 2,
    labels: [],
    dependencies: [],
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  } as unknown as Issue;
}

describe('deferred_until and tbd ready', () => {
  it('does not offer a bead deferred into the future', () => {
    const future = issue('1', { deferred_until: '2027-01-01T00:00:00.000Z' } as Partial<Issue>);
    expect(readyIssueIds([future], NOW).has(future.id)).toBe(false);
  });

  it('offers a bead whose deferral has elapsed', () => {
    const past = issue('2', { deferred_until: '2026-01-15T00:00:00.000Z' } as Partial<Issue>);
    expect(readyIssueIds([past], NOW).has(past.id)).toBe(true);
  });

  it('offers a bead with no deferral', () => {
    const plain = issue('3');
    expect(readyIssueIds([plain], NOW).has(plain.id)).toBe(true);
  });

  it('treats a deferral exactly at now as elapsed', () => {
    // The boundary has to fall on one side deliberately: a deferral "until now" has
    // arrived, so the work is available.
    const boundary = issue('4', { deferred_until: '2026-06-01T00:00:00.000Z' } as Partial<Issue>);
    expect(readyIssueIds([boundary], NOW).has(boundary.id)).toBe(true);
  });

  it('keeps the existing holds independent of deferral', () => {
    const closed = issue('5', { status: 'closed' });
    const deferredAndClosed = issue('6', {
      status: 'closed',
      deferred_until: '2026-01-15T00:00:00.000Z',
    } as Partial<Issue>);
    const ready = readyIssueIds([closed, deferredAndClosed], NOW);
    expect(ready.has(closed.id)).toBe(false);
    expect(ready.has(deferredAndClosed.id)).toBe(false);
  });

  it('uses one caller-supplied instant so before/after snapshots cannot disagree', () => {
    // issue-changes.ts computes the ready set twice to diff two snapshots. If each
    // call read its own clock, a bead whose deferral elapsed between them would show
    // as a ready transition that no edit caused.
    const bead = issue('7', { deferred_until: '2026-06-01T00:00:01.000Z' } as Partial<Issue>);
    expect(readyIssueIds([bead], NOW).has(bead.id)).toBe(false);
    expect(readyIssueIds([bead], NOW + 2000).has(bead.id)).toBe(true);
  });
});

describe('tbd list --defer-before', () => {
  const deferred2027 = issue('1', { deferred_until: '2027-01-01T00:00:00.000Z' } as Partial<Issue>);
  const deferred2026 = issue('2', { deferred_until: '2026-03-01T00:00:00.000Z' } as Partial<Issue>);
  const notDeferred = issue('3');
  const corpus = [deferred2027, deferred2026, notDeferred];

  function idsFor(deferBefore: string | null): string[] {
    return selectIssues(corpus, { ...defaultIssueQuery(), deferBefore }).map((i) => i.id);
  }

  it('is off by default', () => {
    expect(idsFor(null)).toHaveLength(3);
  });

  it('keeps only beads deferred before the given date', () => {
    expect(idsFor('2026-06-01T00:00:00.000Z')).toEqual([deferred2026.id]);
  });

  it('excludes a bead with no deferral, which is not deferred before anything', () => {
    // Sorted: this asserts membership, not the ULID tiebreak that orders the rows.
    expect(idsFor('2028-01-01T00:00:00.000Z').sort()).toEqual(
      [deferred2026.id, deferred2027.id].sort(),
    );
  });

  it('is exclusive at the boundary', () => {
    expect(idsFor('2026-03-01T00:00:00.000Z')).toEqual([]);
  });

  it('rejects an unusable date at the CLI boundary rather than matching everything', () => {
    // The failure mode being designed out: a filter that cannot read its argument and
    // then returns every row is indistinguishable, to the caller, from one that never
    // ran. `--defer-before` reaches the query module already parsed, so the rejection
    // happens where the user can see it.
    expect(() => parseDateOption('not-a-date', '--defer-before')).toThrow(ValidationError);
    expect(parseDateOption('2027-01-01', '--defer-before')).toBe('2027-01-01T00:00:00.000Z');
  });

  it('is not a silent no-op: a filter that matches nothing returns nothing', () => {
    // The defect this pins: the flag parsed, was stored on the options object, and
    // then returned every row. An empty result proves the predicate actually ran.
    expect(idsFor('2020-01-01T00:00:00.000Z')).toEqual([]);
  });
});
