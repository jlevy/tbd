/**
 * Tests for the docmap lookup-key resolution algorithm (spec §4.3).
 */

import { describe, expect, it } from 'vitest';

import type { DocMapEntry } from '../src/docmap/index.js';
import {
  LookupAmbiguous,
  LookupNotFound,
  parseLookupKey,
  resolveLookupKey,
} from '../src/docmap/index.js';

// `documents` must be in source priority order. Earlier entries beat later
// entries when both match the same (type, name). The fixture below mirrors
// a manifest where `coding` is listed before `writing`, which is listed
// before `flask`.
const DOCS: readonly DocMapEntry[] = [
  // Bundle: coding (highest priority)
  {
    key: 'coding:guideline/typescript',
    bundle: 'coding',
    type: 'guideline',
    path: 'guidelines/typescript.md',
  },
  {
    key: 'coding:guideline/python',
    bundle: 'coding',
    type: 'guideline',
    path: 'guidelines/python.md',
  },
  {
    key: 'coding:shortcut/review-code',
    bundle: 'coding',
    type: 'shortcut',
    path: 'shortcuts/review-code.md',
  },
  {
    key: 'coding:shortcut/typescript',
    bundle: 'coding',
    type: 'shortcut',
    path: 'shortcuts/typescript.md',
  },
  // Bundle: writing (lower priority — same (type, name) as coding's
  // typescript guideline, used to test that priority wins)
  {
    key: 'writing:reference/writing-overview',
    bundle: 'writing',
    type: 'reference',
    path: 'references/writing-overview.md',
  },
  {
    key: 'writing:guideline/typescript',
    bundle: 'writing',
    type: 'guideline',
    path: 'guidelines/typescript.md',
  },
  // Bundle: flask (aggregate / `as:` source)
  { key: 'flask', bundle: 'flask', type: 'reference', path: '' },
];

describe('parseLookupKey', () => {
  it('canonical key', () => {
    expect(parseLookupKey('coding:guideline/typescript')).toEqual({
      bundleScope: 'coding',
      name: 'guideline/typescript',
      repoSubpath: null,
    });
  });

  it('bare basename', () => {
    expect(parseLookupKey('python')).toEqual({
      bundleScope: null,
      name: 'python',
      repoSubpath: null,
    });
  });

  it('repo-subpath', () => {
    expect(parseLookupKey('flask//src/flask/app.py')).toEqual({
      bundleScope: 'flask',
      name: '',
      repoSubpath: 'src/flask/app.py',
    });
  });

  it('bundle-scoped basename', () => {
    expect(parseLookupKey('writing:typescript')).toEqual({
      bundleScope: 'writing',
      name: 'typescript',
      repoSubpath: null,
    });
  });
});

describe('resolveLookupKey', () => {
  it('resolves an exact canonical key', () => {
    const entry = resolveLookupKey(DOCS, 'coding:guideline/typescript');
    expect(entry.key).toBe('coding:guideline/typescript');
  });

  it('resolves a bundle-scoped basename when unique within the bundle', () => {
    // `coding:python` matches only `coding:guideline/python` — unique
    // within the bundle, so the basename match resolves cleanly.
    const entry = resolveLookupKey(DOCS, 'coding:python');
    expect(entry.key).toBe('coding:guideline/python');
  });

  it('throws Ambiguous on a bundle-scoped basename that spans types', () => {
    // `coding:typescript` matches both `coding:guideline/typescript` and
    // `coding:shortcut/typescript`. Bundle scope alone can't disambiguate
    // typed lookups; caller must use a fully qualified canonical key.
    expect(() => resolveLookupKey(DOCS, 'coding:typescript')).toThrow(LookupAmbiguous);
  });

  it('resolves a unique bare basename', () => {
    const entry = resolveLookupKey(DOCS, 'python');
    expect(entry.key).toBe('coding:guideline/python');
  });

  it('priority wins when multiple bundles share the same (type, name)', () => {
    // `typescript` matches both `coding:guideline/typescript` and
    // `writing:guideline/typescript`. They share the same (type, name)
    // — `guideline/typescript` — so source priority resolves to the
    // first listed (coding).
    //
    // It ALSO matches `coding:shortcut/typescript` — but the priority-
    // resolution logic operates per (type, name); see the next test
    // for the cross-type ambiguity case.
    //
    // For this test we drop the cross-type entry to isolate priority
    // behavior. The cross-type case is tested separately.
    const guidelineOnly = DOCS.filter((d) => d.type === 'guideline');
    const entry = resolveLookupKey(guidelineOnly, 'typescript');
    expect(entry.key).toBe('coding:guideline/typescript');
  });

  it('throws Ambiguous when basename matches across different doc types', () => {
    // `typescript` matches both `coding:guideline/typescript` and
    // `coding:shortcut/typescript`. Source priority can't disambiguate
    // a typed lookup, so this is ambiguous.
    expect(() => resolveLookupKey(DOCS, 'typescript')).toThrow(LookupAmbiguous);
    try {
      resolveLookupKey(DOCS, 'typescript');
    } catch (e) {
      expect(e).toBeInstanceOf(LookupAmbiguous);
      expect((e as LookupAmbiguous).matches).toEqual([
        'coding:guideline/typescript',
        'coding:shortcut/typescript',
        'writing:guideline/typescript',
      ]);
    }
  });

  it('resolves repo-subpath form to the aggregate entry', () => {
    const entry = resolveLookupKey(DOCS, 'flask//src/flask/app.py');
    expect(entry.key).toBe('flask');
  });

  it('throws NotFound when no match', () => {
    expect(() => resolveLookupKey(DOCS, 'nonexistent')).toThrow(LookupNotFound);
  });

  it('throws NotFound when bundle scope is wrong', () => {
    expect(() => resolveLookupKey(DOCS, 'coding:writing-overview')).toThrow(LookupNotFound);
  });

  it('matches alias when provided', () => {
    const aliases = new Map<string, string[]>([['coding:guideline/typescript', ['ts-rules']]]);
    const entry = resolveLookupKey(DOCS, 'ts-rules', { aliases });
    expect(entry.key).toBe('coding:guideline/typescript');
  });

  it('priority wins when an alias is shared across same-type entries', () => {
    // Same (type, name) bucket across two bundles → priority wins.
    const aliases = new Map<string, string[]>([
      ['coding:guideline/typescript', ['ts']],
      ['writing:guideline/typescript', ['ts']],
    ]);
    const entry = resolveLookupKey(DOCS, 'ts', { aliases });
    expect(entry.key).toBe('coding:guideline/typescript');
  });

  it('throws Ambiguous when an alias matches across different doc types', () => {
    // Different types → genuine ambiguity, not resolvable by priority.
    const aliases = new Map<string, string[]>([
      ['coding:guideline/typescript', ['ts']],
      ['coding:shortcut/typescript', ['ts']],
    ]);
    expect(() => resolveLookupKey(DOCS, 'ts', { aliases })).toThrow(LookupAmbiguous);
  });
});
