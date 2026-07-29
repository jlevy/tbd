/**
 * Unit tests for near-miss ID suggestions (agent CLI ergonomics round 2,
 * tbd-xgge): ranking, the distance threshold (a wrong suggestion is worse
 * than none), and the composed error hint.
 */

import { describe, it, expect } from 'vitest';

import { suggestSimilarIds, issueNotFoundHint } from '../src/cli/lib/id-suggestions.js';
import type { IdMapping } from '../src/file/id-mapping.js';

function mappingOf(shortIds: string[]): IdMapping {
  return {
    shortToUlid: new Map(shortIds.map((s, i) => [s, `01hx${i}zzzzzzzzzzzzzzzzzzzz`])),
    ulidToShort: new Map(),
  };
}

describe('suggestSimilarIds', () => {
  it('suggests a one-typo display ID', () => {
    const mapping = mappingOf(['ab3k', 'xq9m']);
    expect(suggestSimilarIds(['test-ab3x'], mapping, 'test')).toEqual(['test-ab3k']);
  });

  it('suggests when the prefix is missing from the input', () => {
    const mapping = mappingOf(['ab3k']);
    expect(suggestSimilarIds(['ab3x'], mapping, 'test')).toEqual(['test-ab3k']);
  });

  it('suggests nothing for a distant input', () => {
    const mapping = mappingOf(['ab3k', 'xq9m']);
    expect(suggestSimilarIds(['test-zzzz'], mapping, 'test')).toEqual([]);
  });

  it('ranks closer candidates first and caps the list at three', () => {
    const mapping = mappingOf(['ab30', 'ab31', 'ab32', 'ab33']);
    const suggestions = suggestSimilarIds(['test-ab30'], mapping, 'test');
    expect(suggestions).toHaveLength(3);
    expect(suggestions[0]).toBe('test-ab30');
  });

  it('is case-insensitive on input', () => {
    const mapping = mappingOf(['ab3k']);
    expect(suggestSimilarIds(['TEST-AB3K'], mapping, 'test')).toEqual(['test-ab3k']);
  });
});

describe('issueNotFoundHint', () => {
  it('is undefined when there is no close candidate', () => {
    const mapping = mappingOf(['ab3k']);
    expect(issueNotFoundHint(['test-zzzz'], mapping, 'test')).toBeUndefined();
  });

  it('names the candidates and points at search', () => {
    const mapping = mappingOf(['ab3k']);
    const hint = issueNotFoundHint(['test-ab3x'], mapping, 'test');
    expect(hint).toContain('Did you mean: test-ab3k?');
    expect(hint).toContain('tbd search');
  });
});
