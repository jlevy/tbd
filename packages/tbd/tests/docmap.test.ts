/**
 * Tests for the standalone docmap/0.1 inventory module.
 */

import { describe, it, expect } from 'vitest';
import {
  DOCMAP_VERSION,
  DocMapError,
  createDocMap,
  parseDocMap,
  findEntry,
  groupByType,
  filterByType,
  entryKey,
} from '../src/docmap/index.js';

const sample = [
  {
    name: 'python-rules',
    type: 'guideline',
    path: 'docs/tbd/guidelines/python-rules.md',
    source: 'internal:guidelines/python-rules.md',
    title: 'Python Coding Rules',
    description: 'Type hints, docstrings, exception handling',
    word_count: 2400,
  },
  { name: 'review-code', type: 'shortcut', source: 'internal:shortcuts/standard/review-code.md' },
  { name: 'tbd-docs', type: 'reference', source: 'internal:tbd-docs.md' },
];

describe('createDocMap', () => {
  it('builds a docmap with the version tag and entries', () => {
    const map = createDocMap(sample, { name: 'tbd-docs' });
    expect(map.docmap).toBe(DOCMAP_VERSION);
    expect(map.name).toBe('tbd-docs');
    expect(map.documents).toHaveLength(3);
  });

  it('omits name when not provided', () => {
    const map = createDocMap(sample);
    expect('name' in map).toBe(false);
  });

  it('preserves extension fields (e.g. tbd state)', () => {
    const map = createDocMap([{ name: 'x', type: 'guideline', state: 'customized', stale: true }]);
    expect(map.documents[0]).toMatchObject({ state: 'customized', stale: true });
  });

  it('rejects duplicate (type, name) identities', () => {
    expect(() =>
      createDocMap([
        { name: 'dup', type: 'guideline' },
        { name: 'dup', type: 'guideline' },
      ]),
    ).toThrow(DocMapError);
  });

  it('allows the same name under different types', () => {
    const map = createDocMap([
      { name: 'typescript', type: 'guideline' },
      { name: 'typescript', type: 'template' },
    ]);
    expect(map.documents).toHaveLength(2);
  });
});

describe('parseDocMap', () => {
  it('round-trips a created docmap', () => {
    const map = createDocMap(sample, { name: 'tbd-docs' });
    expect(parseDocMap(map)).toEqual(map);
  });

  it('rejects a missing/wrong version tag', () => {
    expect(() => parseDocMap({ documents: [] })).toThrow(DocMapError);
    expect(() => parseDocMap({ docmap: 'sitemap/1', documents: [] })).toThrow(DocMapError);
  });

  it('rejects entries missing identity fields', () => {
    expect(() => parseDocMap({ docmap: DOCMAP_VERSION, documents: [{ name: 'x' }] })).toThrow(
      DocMapError,
    );
  });

  it('accepts and preserves unknown top-level and entry fields', () => {
    const map = parseDocMap({
      docmap: DOCMAP_VERSION,
      generated_by: 'tbd',
      documents: [{ name: 'x', type: 'guideline', state: 'forked' }],
    });
    expect(map.documents[0]).toMatchObject({ state: 'forked' });
  });
});

describe('queries', () => {
  const map = createDocMap(sample);

  it('finds entries by name and optional type', () => {
    expect(findEntry(map, 'python-rules')?.type).toBe('guideline');
    expect(findEntry(map, 'python-rules', 'shortcut')).toBeUndefined();
  });

  it('groups entries by type', () => {
    const groups = groupByType(map);
    expect([...groups.keys()]).toEqual(['guideline', 'shortcut', 'reference']);
  });

  it('filters to a single type and keeps it a valid docmap', () => {
    const guidelines = filterByType(map, 'guideline');
    expect(guidelines.documents).toHaveLength(1);
    expect(parseDocMap(guidelines)).toEqual(guidelines);
  });

  it('entryKey is stable and identity-based', () => {
    expect(entryKey({ type: 'guideline', name: 'python-rules' })).toBe('guideline:python-rules');
  });
});
