/**
 * f08 contract: a bead field this tbd does not know must survive.
 *
 * This is the format's whole reason for existing. Before f08 `IssueSchema` parsed in Zod
 * strip mode, so a client silently DELETED any bead field outside its schema — and
 * `tbd sync` rewrites beads during ordinary merges, which turns that into data loss
 * across every bead an old client touches rather than one file losing one key on an
 * explicit edit.
 *
 * Preservation has three layers and all three are pinned here, because any one of them
 * failing alone reintroduces the loss silently:
 *
 *   parse      — IssueSchema keeps the key
 *   serialize  — sortKeys emits whatever it is handed (already true; asserted anyway)
 *   merge      — mergeIssues carries keys outside FIELD_STRATEGIES
 *
 * The fourth, less obvious layer is change detection: if `issuesSubstantivelyEqual`
 * ignores unknown keys, an edit that touches only one is treated as a no-op and never
 * written, so the key survives parsing and then fails to persist.
 */

import { describe, it, expect } from 'vitest';

import { IssueSchema } from '../src/lib/schemas.js';
import { mergeIssues, issuesSubstantivelyEqual } from '../src/file/git.js';
import { serializeIssue, parseIssue } from '../src/file/parser.js';
import { isFormatCompatibleWithSupported, CURRENT_FORMAT } from '../src/lib/tbd-format.js';
import type { Issue } from '../src/lib/types.js';

const ULID_A = 'is-01aaaaaaaaaaaaaaaaaaaaaaaa';

/** A bead as a newer tbd would write it: known fields plus one this build never saw. */
function beadWithFutureField(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    type: 'is',
    id: ULID_A,
    title: 'A bead from a newer tbd',
    kind: 'task',
    status: 'open',
    priority: 2,
    version: 1,
    created_at: '2026-08-15T00:00:00.000Z',
    updated_at: '2026-08-15T00:00:00.000Z',
    labels: [],
    dependencies: [],
    future_field: { shape: 'unknown', nested: [1, 2, 3] },
    ...overrides,
  };
}

function asIssue(raw: Record<string, unknown>): Issue {
  return IssueSchema.parse(raw) as unknown as Issue;
}

describe('f08: unknown bead keys survive parse', () => {
  it('IssueSchema preserves a field it does not declare', () => {
    const parsed = IssueSchema.parse(beadWithFutureField()) as Record<string, unknown>;

    expect(parsed.future_field).toEqual({ shape: 'unknown', nested: [1, 2, 3] });
  });

  it('preserves a scalar unknown key, not only object-valued ones', () => {
    const parsed = IssueSchema.parse(
      beadWithFutureField({ future_scalar: 'plain string' }),
    ) as Record<string, unknown>;

    expect(parsed.future_scalar).toBe('plain string');
  });
});

describe('f08: unknown bead keys survive a file round trip', () => {
  it('serialize → parse keeps the key and its value', () => {
    const issue = asIssue(beadWithFutureField());

    const serialized = serializeIssue(issue);
    // The frontmatter must actually carry it — a key that round-trips only in memory
    // would still be lost the moment another process read the file.
    expect(serialized).toContain('future_field:');

    const reparsed = parseIssue(serialized) as unknown as Record<string, unknown>;
    expect(reparsed.future_field).toEqual({ shape: 'unknown', nested: [1, 2, 3] });
  });
});

describe('f08: unknown bead keys survive a three-way merge', () => {
  it('carries a key changed on only one side', () => {
    const base = asIssue(beadWithFutureField());
    const local = asIssue(
      beadWithFutureField({
        future_field: { shape: 'edited-locally' },
        version: 2,
        updated_at: '2026-08-15T01:00:00.000Z',
      }),
    );
    const remote = asIssue(
      beadWithFutureField({
        title: 'Retitled remotely',
        version: 2,
        updated_at: '2026-08-15T00:30:00.000Z',
      }),
    );

    const { merged } = mergeIssues(base, local, remote);

    // Both sides' independent edits survive: this is the case a fixed strategy table
    // silently dropped, because the unknown key was never iterated at all.
    expect((merged as unknown as Record<string, unknown>).future_field).toEqual({
      shape: 'edited-locally',
    });
    expect(merged.title).toBe('Retitled remotely');
  });

  it('keeps the key when only the remote side introduced it', () => {
    // The realistic upgrade order: this client wrote the bead, a newer one added a field.
    const withoutField = beadWithFutureField();
    delete withoutField.future_field;

    const base = asIssue(withoutField);
    const local = asIssue(withoutField);
    const remote = asIssue(
      beadWithFutureField({ version: 2, updated_at: '2026-08-15T02:00:00.000Z' }),
    );

    const { merged } = mergeIssues(base, local, remote);

    expect((merged as unknown as Record<string, unknown>).future_field).toEqual({
      shape: 'unknown',
      nested: [1, 2, 3],
    });
  });

  it('resolves a both-sides edit by last-write-wins and records the loss', () => {
    const base = asIssue(beadWithFutureField());
    const local = asIssue(
      beadWithFutureField({
        future_field: { shape: 'local' },
        version: 2,
        updated_at: '2026-08-15T03:00:00.000Z',
      }),
    );
    const remote = asIssue(
      beadWithFutureField({
        future_field: { shape: 'remote' },
        version: 2,
        updated_at: '2026-08-15T01:00:00.000Z',
      }),
    );

    const { merged, conflicts } = mergeIssues(base, local, remote);

    // Later updated_at wins, and the discarded side goes to the attic like any other
    // LWW field — an unknown key is not a reason to lose data quietly.
    expect((merged as unknown as Record<string, unknown>).future_field).toEqual({
      shape: 'local',
    });
    expect(conflicts.some((c) => c.field === 'future_field')).toBe(true);
  });

  it('merges deterministically regardless of which side is passed first', () => {
    const base = asIssue(beadWithFutureField());
    const a = asIssue(
      beadWithFutureField({
        future_a: 'from-a',
        version: 2,
        updated_at: '2026-08-15T04:00:00.000Z',
      }),
    );
    const b = asIssue(
      beadWithFutureField({
        future_b: 'from-b',
        version: 2,
        updated_at: '2026-08-15T05:00:00.000Z',
      }),
    );

    // Two clones each adding a different unknown field must converge to both.
    const one = mergeIssues(base, a, b).merged as unknown as Record<string, unknown>;
    const other = mergeIssues(base, b, a).merged as unknown as Record<string, unknown>;

    expect(one.future_a).toBe('from-a');
    expect(one.future_b).toBe('from-b');
    expect(other.future_a).toBe('from-a');
    expect(other.future_b).toBe('from-b');
  });
});

describe('f08: unknown keys count as substantive change', () => {
  it('an edit touching only an unknown key is not "no change"', () => {
    const before = asIssue(beadWithFutureField());
    const after = asIssue(beadWithFutureField({ future_field: { shape: 'changed' } }));

    // If this returned true the edit would be discarded before it was ever written,
    // which looks exactly like the stripping bug f08 exists to prevent.
    expect(issuesSubstantivelyEqual(before, after)).toBe(false);
  });

  it('still reports equality when nothing but metadata differs', () => {
    const a = asIssue(beadWithFutureField());
    const b = asIssue(beadWithFutureField({ version: 9, updated_at: '2026-09-01T00:00:00.000Z' }));

    expect(issuesSubstantivelyEqual(a, b)).toBe(true);
  });
});

describe('f08: older clients fail closed', () => {
  it('a client supporting only up to f07 refuses an f08 repository', () => {
    // The gate is the other half of the fix. Preservation protects future clients;
    // it cannot retroactively fix already-published ones, which parse in strip mode.
    expect(isFormatCompatibleWithSupported(CURRENT_FORMAT, 'f07')).toBe(false);
  });

  it('an f08 client accepts an f08 repository', () => {
    expect(isFormatCompatibleWithSupported(CURRENT_FORMAT, CURRENT_FORMAT)).toBe(true);
  });
});
