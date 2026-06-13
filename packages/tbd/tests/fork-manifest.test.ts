/**
 * Tests for the fork manifest, base snapshots, hashing, and state computation.
 *
 * The state computation is covered as a table-driven matrix (base/file/cache
 * hashes + conflicted flag -> state), per the spec's testing strategy.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtemp, rm, mkdir, writeFile as writeFileRaw } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';

import {
  type ForkEntry,
  type ForkKind,
  type ForkManifest,
  type DocState,
  CONFLICT_LABELS,
  hashContent,
  normalizeLineEndings,
  hasConflictMarkers,
  hasUnresolvedConflict,
  isSafeDocName,
  computeForkStatus,
  findFork,
  upsertFork,
  removeFork,
  emptyManifest,
  readForkManifest,
  writeForkManifest,
  forksFilePath,
  readBaseContent,
  writeBaseContent,
  removeBaseContent,
} from '../src/file/fork-manifest.js';

describe('hashContent', () => {
  it('is stable across CRLF/CR/LF line endings', () => {
    const lf = 'line one\nline two\n';
    const crlf = 'line one\r\nline two\r\n';
    const cr = 'line one\rline two\r';
    expect(hashContent(lf)).toBe(hashContent(crlf));
    expect(hashContent(lf)).toBe(hashContent(cr));
  });

  it('produces a sha256: prefixed hex digest', () => {
    expect(hashContent('x')).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it('differs for different content', () => {
    expect(hashContent('a')).not.toBe(hashContent('b'));
  });

  it('normalizeLineEndings collapses CRLF and CR to LF', () => {
    expect(normalizeLineEndings('a\r\nb\rc')).toBe('a\nb\nc');
  });
});

describe('hasConflictMarkers', () => {
  it('detects a real three-marker conflict', () => {
    const conflict = ['<<<<<<< ours', 'mine', '=======', 'theirs', '>>>>>>> upstream'].join('\n');
    expect(hasConflictMarkers(conflict)).toBe(true);
  });

  it('does not flag prose that merely mentions one marker', () => {
    expect(hasConflictMarkers('Resolve the <<<<<<< marker by editing.')).toBe(false);
    expect(hasConflictMarkers('A line of ======= in a table border.')).toBe(false);
  });
});

describe('isSafeDocName', () => {
  it('accepts the punctuation real doc names use', () => {
    for (const n of ['python-rules', 'a', 'tbd.design', 'foo_bar', 'v1', 'A1._-']) {
      expect(isSafeDocName(n)).toBe(true);
    }
  });

  it('rejects path-traversal and otherwise-unsafe names (S2)', () => {
    // These must never round-trip through the manifest: a crafted name is how a
    // doc could otherwise escape the fork dir (e.g. unfork --force deleting an
    // out-of-tree file).
    for (const n of [
      '',
      '..',
      '../victim',
      '../../etc/passwd',
      'a/b',
      'foo/../bar',
      '/abs',
      '.hidden',
      'name.md', // the ".md" is added by path construction, not part of identity
      'has space',
      'tab\tname',
      'nul\u0000name',
    ]) {
      expect(isSafeDocName(n)).toBe(false);
    }
  });
});

describe('hasUnresolvedConflict', () => {
  it("is true only for tbd's own labeled markers (S7)", () => {
    const tbd =
      `<<<<<<< ${CONFLICT_LABELS.ours}\nmine\n=======\n` +
      `theirs\n>>>>>>> ${CONFLICT_LABELS.theirs}\n`;
    expect(hasUnresolvedConflict(tbd)).toBe(true);
  });

  it('is false for generic/example conflict markers and plain prose', () => {
    // A git tutorial (or our own golden-testing guideline) that shows generic
    // <<<<<<< HEAD markers must not be treated as an unresolved tbd conflict.
    expect(hasUnresolvedConflict('<<<<<<< HEAD\na\n=======\nb\n>>>>>>> branch\n')).toBe(false);
    expect(hasUnresolvedConflict('no markers at all')).toBe(false);
  });
});

describe('computeForkStatus matrix', () => {
  const BASE = hashContent('base');
  const EDITED = hashContent('edited');
  const MOVED = hashContent('moved');

  interface Row {
    label: string;
    input: Parameters<typeof computeForkStatus>[0];
    expected: Partial<ReturnType<typeof computeForkStatus>> & { state: DocState };
  }

  const rows: Row[] = [
    {
      label: 'not in manifest, no file -> upstream',
      input: { inManifest: false, forkFileExists: false },
      expected: { state: 'upstream', customized: false, stale: false },
    },
    {
      label: 'file present, no manifest entry -> local',
      input: { inManifest: false, forkFileExists: true },
      expected: { state: 'local' },
    },
    {
      label: 'manifest entry, file deleted -> missing',
      input: { inManifest: true, forkFileExists: false, baseHash: BASE },
      expected: { state: 'missing' },
    },
    {
      label: 'file == base, cache == base -> forked',
      input: {
        inManifest: true,
        forkFileExists: true,
        forkHash: BASE,
        baseHash: BASE,
        cacheHash: BASE,
      },
      expected: { state: 'forked', customized: false, stale: false },
    },
    {
      label: 'file != base, cache == base -> customized (not stale)',
      input: {
        inManifest: true,
        forkFileExists: true,
        forkHash: EDITED,
        baseHash: BASE,
        cacheHash: BASE,
      },
      expected: { state: 'customized', customized: true, stale: false },
    },
    {
      label: 'file == base, cache != base -> stale (unmodified)',
      input: {
        inManifest: true,
        forkFileExists: true,
        forkHash: BASE,
        baseHash: BASE,
        cacheHash: MOVED,
      },
      expected: { state: 'stale', customized: false, stale: true },
    },
    {
      label: 'file != base, cache != base -> customized + stale',
      input: {
        inManifest: true,
        forkFileExists: true,
        forkHash: EDITED,
        baseHash: BASE,
        cacheHash: MOVED,
      },
      expected: { state: 'customized', customized: true, stale: true },
    },
    {
      label: 'cache absent (source gone) -> orphaned',
      input: {
        inManifest: true,
        forkFileExists: true,
        forkHash: BASE,
        baseHash: BASE,
        cacheHash: undefined,
      },
      expected: { state: 'orphaned', orphaned: true, stale: false },
    },
    {
      label: 'conflicted flag + markers present -> conflicted',
      input: {
        inManifest: true,
        forkFileExists: true,
        forkHash: EDITED,
        baseHash: BASE,
        cacheHash: MOVED,
        conflictedFlag: true,
        markersPresent: true,
      },
      expected: { state: 'conflicted', conflicted: true },
    },
    {
      label: 'conflicted flag but markers resolved -> not conflicted (customized)',
      input: {
        inManifest: true,
        forkFileExists: true,
        forkHash: EDITED,
        baseHash: BASE,
        cacheHash: MOVED,
        conflictedFlag: true,
        markersPresent: false,
      },
      expected: { state: 'customized', conflicted: false },
    },
  ];

  it.each(rows)('$label', ({ input, expected }) => {
    expect(computeForkStatus(input)).toMatchObject(expected);
  });
});

describe('manifest helpers', () => {
  const entry = (name: string, kind: ForkKind = 'guideline'): ForkEntry => ({
    name,
    kind,
    path: `docs/tbd/${kind}s/${name}.md`,
    source: `internal:${kind}s/${name}.md`,
    base_hash: hashContent(name),
  });

  it('findFork matches by name and optional kind', () => {
    const m = { forks: [entry('a'), entry('b', 'shortcut')] };
    expect(findFork(m, 'a')?.kind).toBe('guideline');
    expect(findFork(m, 'b', 'guideline')).toBeUndefined();
    expect(findFork(m, 'b', 'shortcut')?.name).toBe('b');
  });

  it('upsertFork inserts, replaces by kind+name, and keeps sorted order', () => {
    let m = emptyManifest();
    m = upsertFork(m, entry('zeta'));
    m = upsertFork(m, entry('alpha'));
    expect(m.forks.map((f) => f.name)).toEqual(['alpha', 'zeta']);

    const replaced = { ...entry('alpha'), base_hash: 'sha256:changed' };
    m = upsertFork(m, replaced);
    expect(m.forks).toHaveLength(2);
    expect(findFork(m, 'alpha')?.base_hash).toBe('sha256:changed');
  });

  it('removeFork drops the matching entry', () => {
    const m = { forks: [entry('a'), entry('b')] };
    expect(removeFork(m, 'a').forks.map((f) => f.name)).toEqual(['b']);
  });
});

describe('filesystem round-trip', () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'tbd-fork-manifest-'));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('reads an empty manifest when none exists', async () => {
    expect(await readForkManifest(dir)).toEqual({ forks: [] });
  });

  it('drops invalid/unsafe entries on read and warns, keeping good ones (S2/S8)', async () => {
    const raw = [
      'forks:',
      '  - name: good-doc',
      '    kind: guideline',
      '    path: docs/tbd/guidelines/good-doc.md',
      '    source: internal:guidelines/good-doc.md',
      '    base_hash: sha256:abc',
      '  - name: ../../../etc/evil', // path traversal -> dropped
      '    kind: guideline',
      '    path: whatever',
      '    source: internal:x',
      '    base_hash: sha256:def',
      '  - name: bad-kind-doc', // unknown kind -> dropped
      '    kind: not-a-kind',
      '    path: docs/tbd/x/bad.md',
      '    source: internal:x',
      '    base_hash: sha256:ghi',
      '',
    ].join('\n');
    await mkdir(dirname(forksFilePath(dir)), { recursive: true });
    await writeFileRaw(forksFilePath(dir), raw, 'utf-8');

    const writes: string[] = [];
    const spy = vi.spyOn(process.stderr, 'write').mockImplementation((chunk: unknown) => {
      writes.push(String(chunk));
      return true;
    });
    const manifest = await readForkManifest(dir);
    spy.mockRestore();

    // Only the valid entry survives; the crafted/unsafe ones never reach callers.
    expect(manifest.forks.map((f) => f.name)).toEqual(['good-doc']);
    expect(writes.join('')).toContain('Ignored 2 invalid');
  });

  it('round-trips a manifest through write/read', async () => {
    const manifest: ForkManifest = {
      forks: [
        {
          name: 'python-rules',
          kind: 'guideline',
          path: 'docs/tbd/guidelines/python-rules.md',
          source: 'internal:guidelines/python-rules.md',
          base_hash: hashContent('python base'),
          tbd_version: '0.2.3',
        },
      ],
    };
    await writeForkManifest(dir, manifest);
    expect(await readForkManifest(dir)).toEqual(manifest);
  });

  it('round-trips base content verbatim and removes it', async () => {
    const content = '# Python Rules\n\nbase content\n';
    await writeBaseContent(dir, 'guideline', 'python-rules', content);
    expect(await readBaseContent(dir, 'guideline', 'python-rules')).toBe(content);
    await removeBaseContent(dir, 'guideline', 'python-rules');
    expect(await readBaseContent(dir, 'guideline', 'python-rules')).toBeNull();
  });
});
