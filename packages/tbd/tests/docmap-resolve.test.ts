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

const DOCS: readonly DocMapEntry[] = [
  // Bundle: coding (priority 0 — listed first)
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
  // Bundle: writing
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

  it('resolves a bundle-scoped basename', () => {
    const entry = resolveLookupKey(DOCS, 'coding:typescript');
    expect(entry.key).toBe('coding:guideline/typescript');
  });

  it('resolves a unique bare basename', () => {
    const entry = resolveLookupKey(DOCS, 'python');
    expect(entry.key).toBe('coding:guideline/python');
  });

  it('throws Ambiguous on a basename that matches multiple bundles', () => {
    expect(() => resolveLookupKey(DOCS, 'typescript')).toThrow(LookupAmbiguous);
    try {
      resolveLookupKey(DOCS, 'typescript');
    } catch (e) {
      expect(e).toBeInstanceOf(LookupAmbiguous);
      expect((e as LookupAmbiguous).matches).toEqual([
        'coding:guideline/typescript',
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

  it('throws Ambiguous when alias is shared across multiple entries', () => {
    const aliases = new Map<string, string[]>([
      ['coding:guideline/typescript', ['ts']],
      ['writing:guideline/typescript', ['ts']],
    ]);
    expect(() => resolveLookupKey(DOCS, 'ts', { aliases })).toThrow(LookupAmbiguous);
  });
});
