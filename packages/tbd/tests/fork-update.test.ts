/**
 * Tests for the merge wrapper (git merge-file) and the update decision table.
 */

import { describe, it, expect } from 'vitest';

import {
  mergeContents,
  diffContents,
  updateOne,
  type UpdateStrategy,
} from '../src/file/fork-update.js';
import { type ForkEntry, hashContent, hasConflictMarkers } from '../src/file/fork-manifest.js';

const BASE = 'line one\nline two\nline three\n';

function entry(overrides: Partial<ForkEntry> = {}): ForkEntry {
  return {
    name: 'python-rules',
    kind: 'guideline',
    path: 'docs/tbd/guidelines/python-rules.md',
    source: 'internal:guidelines/python-rules.md',
    base_hash: hashContent(BASE),
    ...overrides,
  };
}

describe('mergeContents', () => {
  it('merges non-overlapping edits cleanly', async () => {
    const ours = 'line ONE\nline two\nline three\n'; // edited line 1
    const theirs = 'line one\nline two\nline THREE\n'; // edited line 3
    const result = await mergeContents(ours, BASE, theirs);
    expect(result.conflicts).toBe(0);
    expect(result.merged).toBe('line ONE\nline two\nline THREE\n');
  });

  it('reports conflicts and writes markers for overlapping edits', async () => {
    const ours = 'line one\nMINE\nline three\n';
    const theirs = 'line one\nTHEIRS\nline three\n';
    const result = await mergeContents(ours, BASE, theirs);
    expect(result.conflicts).toBeGreaterThan(0);
    expect(hasConflictMarkers(result.merged)).toBe(true);
  });

  it('merges a CRLF fork against LF base/upstream without spurious conflict (S5)', async () => {
    // Without LF-normalization, a CRLF fork vs an LF base/upstream makes git
    // merge-file see every line as changed and report a whole-file conflict.
    // Edits are on non-adjacent lines (1 and 3) so the only thing under test is
    // the line-ending mismatch, not git's adjacent-hunk conflict behavior.
    const ours = 'line ONE\r\nline two\r\nline three\r\n'; // CRLF, edited line 1
    const theirs = 'line one\nline two\nline THREE\n'; // LF, edited line 3
    const result = await mergeContents(ours, BASE, theirs);
    expect(result.conflicts).toBe(0);
    expect(result.merged).toBe('line ONE\nline two\nline THREE\n');
  });
});

describe('diffContents', () => {
  it('returns empty for identical content', async () => {
    expect(await diffContents(BASE, BASE)).toBe('');
  });

  it('shows changed lines with the given labels', async () => {
    const diff = await diffContents(BASE, 'line one\nCHANGED\nline three\n', {
      left: 'upstream',
      right: 'ours',
    });
    expect(diff).toContain('--- upstream');
    expect(diff).toContain('+++ ours');
    expect(diff).toContain('+CHANGED');
    expect(diff).toContain('-line two');
  });
});

describe('updateOne decision table', () => {
  const EDITED = 'line ONE\nline two\nline three\n'; // diverges from BASE on line 1
  const UPSTREAM_NONCONFLICT = 'line one\nline two\nline THREE\n'; // line 3
  const UPSTREAM_CONFLICT = 'line ONE-theirs\nline two\nline three\n'; // line 1, conflicts with EDITED

  it('skips a missing forked file', async () => {
    const r = await updateOne({
      entry: entry(),
      forkContent: null,
      baseContent: BASE,
      upstreamContent: UPSTREAM_NONCONFLICT,
      strategy: 'default',
    });
    expect(r.action).toBe('skip-missing');
  });

  it('skips an orphaned doc (upstream gone)', async () => {
    const r = await updateOne({
      entry: entry(),
      forkContent: BASE,
      baseContent: BASE,
      upstreamContent: null,
      strategy: 'default',
    });
    expect(r.action).toBe('skip-orphaned');
  });

  it('skips an unresolved conflicted doc (tbd-labeled markers)', async () => {
    const withMarkers = '<<<<<<< ours (your fork)\na\n=======\nb\n>>>>>>> theirs (upstream)\n';
    const r = await updateOne({
      entry: entry({ conflicted: true }),
      forkContent: withMarkers,
      baseContent: BASE,
      upstreamContent: UPSTREAM_NONCONFLICT,
      strategy: 'default',
    });
    expect(r.action).toBe('skip-unresolved');
  });

  it('does NOT treat generic/legit conflict-marker text as unresolved (S7)', async () => {
    // A doc that merely contains example markers (e.g. a git tutorial) with the
    // conflicted flag still set must not be stuck — only tbd's own labels count.
    const generic = '<<<<<<< HEAD\na\n=======\nb\n>>>>>>> branch\n';
    const r = await updateOne({
      entry: entry({ conflicted: true }),
      forkContent: generic, // unmodified vs base
      baseContent: generic,
      upstreamContent: generic + 'upstream line\n', // stale, non-conflicting
      strategy: 'default',
    });
    expect(r.action).not.toBe('skip-unresolved');
    expect(r.action).toBe('replaced');
  });

  it('is a no-op when not stale', async () => {
    const r = await updateOne({
      entry: entry(),
      forkContent: EDITED,
      baseContent: BASE,
      upstreamContent: BASE, // upstream == base => not stale
      strategy: 'default',
    });
    expect(r.action).toBe('skip-not-stale');
  });

  it('replaces an unmodified stale fork (default)', async () => {
    const r = await updateOne({
      entry: entry(),
      forkContent: BASE, // unmodified
      baseContent: BASE,
      upstreamContent: UPSTREAM_NONCONFLICT, // stale
      strategy: 'default',
    });
    expect(r.action).toBe('replaced');
    expect(r.newFileContent).toBe(UPSTREAM_NONCONFLICT);
    expect(r.newBaseContent).toBe(UPSTREAM_NONCONFLICT);
  });

  it('applies a clean three-way merge (default)', async () => {
    const r = await updateOne({
      entry: entry(),
      forkContent: EDITED,
      baseContent: BASE,
      upstreamContent: UPSTREAM_NONCONFLICT,
      strategy: 'default',
    });
    expect(r.action).toBe('merged-clean');
    expect(r.newFileContent).toBe('line ONE\nline two\nline THREE\n');
    expect(r.newBaseContent).toBe(UPSTREAM_NONCONFLICT);
  });

  it('skips a conflicting merge by default and asks for a decision', async () => {
    const r = await updateOne({
      entry: entry(),
      forkContent: EDITED,
      baseContent: BASE,
      upstreamContent: UPSTREAM_CONFLICT,
      strategy: 'default',
    });
    expect(r.action).toBe('skip-conflict-listed');
    expect(r.needsDecision).toBe(true);
  });

  it('writes conflict markers and advances base with --merge', async () => {
    const r = await updateOne({
      entry: entry(),
      forkContent: EDITED,
      baseContent: BASE,
      upstreamContent: UPSTREAM_CONFLICT,
      strategy: 'merge',
    });
    expect(r.action).toBe('merged-conflict');
    expect(r.setConflicted).toBe(true);
    expect(hasConflictMarkers(r.newFileContent ?? '')).toBe(true);
    expect(r.newBaseContent).toBe(UPSTREAM_CONFLICT);
  });

  it('keeps the local version and advances base with --keep-ours', async () => {
    const r = await updateOne({
      entry: entry(),
      forkContent: EDITED,
      baseContent: BASE,
      upstreamContent: UPSTREAM_CONFLICT,
      strategy: 'keep-ours',
    });
    expect(r.action).toBe('kept');
    expect(r.newFileContent).toBeUndefined(); // file untouched
    expect(r.newBaseContent).toBe(UPSTREAM_CONFLICT);
  });

  it('repairs a missing base with --keep-ours', async () => {
    const r = await updateOne({
      entry: entry(),
      forkContent: EDITED,
      baseContent: null, // base file gone
      upstreamContent: UPSTREAM_NONCONFLICT,
      strategy: 'keep-ours',
    });
    expect(r.action).toBe('repaired');
    expect(r.newBaseContent).toBe(UPSTREAM_NONCONFLICT);
  });

  it('skips a missing base by default and points at --keep-ours', async () => {
    const r = await updateOne({
      entry: entry(),
      forkContent: EDITED,
      baseContent: null,
      upstreamContent: UPSTREAM_NONCONFLICT,
      strategy: 'default',
    });
    expect(r.action).toBe('skip-no-base');
    expect(r.needsDecision).toBe(true);
  });

  it('keep-ours on an unmodified stale fork advances base without touching the file', async () => {
    const strategy: UpdateStrategy = 'keep-ours';
    const r = await updateOne({
      entry: entry(),
      forkContent: BASE,
      baseContent: BASE,
      upstreamContent: UPSTREAM_NONCONFLICT,
      strategy,
    });
    expect(r.action).toBe('kept');
    expect(r.newFileContent).toBeUndefined();
    expect(r.newBaseContent).toBe(UPSTREAM_NONCONFLICT);
  });
});

describe('version-skew guard', () => {
  const UPSTREAM_OLDER = 'line one\nline two\n'; // this client's (older) bundle

  it('skips a doc whose base was advanced by a newer tbd, under every strategy', async () => {
    for (const strategy of ['default', 'merge', 'keep-ours'] as const) {
      const r = await updateOne({
        entry: entry({ tbd_version: '0.9.0' }),
        forkContent: BASE,
        baseContent: BASE,
        upstreamContent: UPSTREAM_OLDER, // differs from base -> would look "stale"
        strategy,
        runningVersion: '0.3.0',
      });
      expect(r.action).toBe('skip-newer-base');
      expect(r.newFileContent).toBeUndefined();
      expect(r.newBaseContent).toBeUndefined();
      expect(r.message).toContain('upgrade tbd');
    }
  });

  it('proceeds when the running tbd is the same or newer than the fork point', async () => {
    for (const v of ['0.9.0', '1.0.0']) {
      const r = await updateOne({
        entry: entry({ tbd_version: '0.9.0' }),
        forkContent: BASE,
        baseContent: BASE,
        upstreamContent: 'line one\nline two\nline three plus\n',
        strategy: 'default',
        runningVersion: v,
      });
      expect(r.action).toBe('replaced');
    }
  });

  it('does not guard on unparseable or absent versions', async () => {
    const noEntryVersion = await updateOne({
      entry: entry(),
      forkContent: BASE,
      baseContent: BASE,
      upstreamContent: 'changed\n',
      strategy: 'default',
      runningVersion: '0.3.0',
    });
    expect(noEntryVersion.action).toBe('replaced');

    const weird = await updateOne({
      entry: entry({ tbd_version: 'development' }),
      forkContent: BASE,
      baseContent: BASE,
      upstreamContent: 'changed\n',
      strategy: 'default',
      runningVersion: '0.3.0',
    });
    expect(weird.action).toBe('replaced');
  });

  it('compareVersionsLoose ignores prerelease and rejects garbage', async () => {
    const { compareVersionsLoose } = await import('../src/file/fork-manifest.js');
    expect(compareVersionsLoose('0.2.3-dev.333.abc', '0.2.3')).toBe(0);
    expect(compareVersionsLoose('0.2.3', '0.10.0')).toBe(-1);
    expect(compareVersionsLoose('1.0.0', '0.9.9')).toBe(1);
    expect(compareVersionsLoose('development', '0.1.0')).toBeNull();
  });
});
