/**
 * Tests for the standalone docref grammar module.
 *
 * Acts as a spec-mirror: every supported form and normalization is exercised here,
 * so the module can be lifted to its own package with its behavior pinned.
 */

import { describe, it, expect } from 'vitest';
import {
  type DocRef,
  DocRefError,
  parseDocRef,
  tryParseDocRef,
  formatDocRef,
  normalizeDocRef,
  isDocRef,
  docRefsEqual,
} from '../src/docref/index.js';

describe('parseDocRef', () => {
  it('parses internal bundled docs', () => {
    expect(parseDocRef('internal:guidelines/python-rules.md')).toEqual({
      kind: 'internal',
      path: 'guidelines/python-rules.md',
    });
  });

  it('parses anchored local paths (./ , ../ , absolute, drive letter)', () => {
    expect(parseDocRef('./docs/general/')).toEqual({ kind: 'local', path: './docs/general/' });
    expect(parseDocRef('../shared/rules.md')).toEqual({
      kind: 'local',
      path: '../shared/rules.md',
    });
    expect(parseDocRef('/abs/path/file.md')).toEqual({ kind: 'local', path: '/abs/path/file.md' });
    expect(parseDocRef('C:/Users/x/file.md')).toEqual({
      kind: 'local',
      path: 'C:/Users/x/file.md',
    });
    expect(parseDocRef('c:\\docs\\file.md')).toEqual({ kind: 'local', path: 'c:\\docs\\file.md' });
  });

  it('rejects bare relative and home-relative paths (strict grammar)', () => {
    // Bare strings are not docrefs; consumers may coerce by prepending "./" at
    // their own boundary. Strict-now can loosen later; the reverse cannot.
    expect(() => parseDocRef('guidelines/python-rules.md')).toThrow(DocRefError);
    expect(() => parseDocRef('hello world')).toThrow(DocRefError);
    expect(() => parseDocRef('~/docs/rules.md')).toThrow(/home-relative/);
  });

  it('parses plain URLs', () => {
    expect(parseDocRef('https://example.com/style.md')).toEqual({
      kind: 'url',
      url: 'https://example.com/style.md',
    });
  });

  it('parses github: scheme with a ref', () => {
    expect(parseDocRef('github:acme/eng-docs@main//guidelines/style.md')).toEqual({
      kind: 'git',
      host: 'github',
      owner: 'acme',
      repo: 'eng-docs',
      ref: 'main',
      path: 'guidelines/style.md',
    });
  });

  it('parses github: scheme without a ref', () => {
    expect(parseDocRef('github:acme/eng-docs//guidelines/style.md')).toEqual({
      kind: 'git',
      host: 'github',
      owner: 'acme',
      repo: 'eng-docs',
      path: 'guidelines/style.md',
    });
  });

  it('parses a fragment on the path and keeps it separate', () => {
    expect(parseDocRef('github:acme/eng-docs@main//guidelines/style.md#naming')).toEqual({
      kind: 'git',
      host: 'github',
      owner: 'acme',
      repo: 'eng-docs',
      ref: 'main',
      path: 'guidelines/style.md',
      fragment: 'naming',
    });
  });

  it('parses gitlab: scheme', () => {
    expect(parseDocRef('gitlab:org/repo@v1.0//a/b.md').kind).toBe('git');
  });

  it('rejects the dropped git: scheme as unknown', () => {
    // v0.1 supports github:/gitlab: only; a host-bearing git: form may be added
    // in a future version.
    expect(() => parseDocRef('git:org/repo@sha//a/b.md')).toThrow(/unknown scheme/);
  });

  it('trims surrounding whitespace', () => {
    expect(parseDocRef('  internal:a.md  ')).toEqual({ kind: 'internal', path: 'a.md' });
  });

  it('rejects empty, scheme-only, and malformed git refs', () => {
    expect(() => parseDocRef('')).toThrow(DocRefError);
    expect(() => parseDocRef('internal:')).toThrow(DocRefError);
    expect(() => parseDocRef('github:owner-only//path.md')).toThrow(DocRefError);
    expect(() => parseDocRef('github:owner/repo/no-double-slash.md')).toThrow(DocRefError);
    expect(() => parseDocRef('github:owner/repo@main//')).toThrow(DocRefError);
    expect(() => parseDocRef('github:owner/repo@main//#frag-only')).toThrow(DocRefError);
    expect(() => parseDocRef('mailto:someone@example.com')).toThrow(DocRefError);
  });
});

describe('normalizeDocRef', () => {
  it('normalizes a github blob URL to the github: scheme', () => {
    expect(normalizeDocRef('https://github.com/o/r/blob/main/f.md')).toBe('github:o/r@main//f.md');
  });

  it('normalizes a raw.githubusercontent.com URL to the github: scheme', () => {
    expect(normalizeDocRef('https://raw.githubusercontent.com/o/r/main/dir/f.md')).toBe(
      'github:o/r@main//dir/f.md',
    );
  });

  it('normalizes a gitlab blob URL to the gitlab: scheme', () => {
    expect(normalizeDocRef('https://gitlab.com/o/r/-/blob/main/f.md')).toBe(
      'gitlab:o/r@main//f.md',
    );
  });

  it('preserves URL fragments through normalization (never silently dropped)', () => {
    expect(normalizeDocRef('https://github.com/o/r/blob/main/f.md#testing')).toBe(
      'github:o/r@main//f.md#testing',
    );
  });

  it('leaves non-git URLs and other forms unchanged', () => {
    expect(normalizeDocRef('https://example.com/x.md')).toBe('https://example.com/x.md');
    expect(normalizeDocRef('https://example.com/x.md#frag')).toBe('https://example.com/x.md#frag');
    expect(normalizeDocRef('internal:a/b.md')).toBe('internal:a/b.md');
  });
});

describe('formatDocRef round-trips', () => {
  const cases: string[] = [
    'internal:guidelines/python-rules.md',
    './docs/general/',
    '/abs/file.md',
    'C:/Users/x/file.md',
    'https://example.com/style.md',
    'github:acme/eng-docs@main//guidelines/style.md',
    'github:acme/eng-docs//guidelines/style.md',
    'github:acme/eng-docs@main//guidelines/style.md#naming',
    'gitlab:org/repo@v1.0//a/b.md',
  ];
  it.each(cases)('parse->format is identity for %s', (input) => {
    expect(formatDocRef(parseDocRef(input))).toBe(input);
  });
});

describe('helpers', () => {
  it('isDocRef reflects validity', () => {
    expect(isDocRef('internal:a.md')).toBe(true);
    expect(isDocRef('mailto:x@y.com')).toBe(false);
    expect(isDocRef('bare-string.md')).toBe(false);
  });

  it('tryParseDocRef returns null on invalid input', () => {
    expect(tryParseDocRef('')).toBeNull();
    expect(tryParseDocRef('internal:a.md')).not.toBeNull();
  });

  it('docRefsEqual ignores a leading ./ on local paths', () => {
    const a = parseDocRef('./guidelines/x.md');
    // A consumer-coerced bare path: equal modulo the "./" anchor.
    const b: DocRef = { kind: 'local', path: 'guidelines/x.md' };
    expect(docRefsEqual(a, b)).toBe(true);
  });

  it('docRefsEqual distinguishes different kinds', () => {
    const a: DocRef = parseDocRef('internal:x.md');
    const b: DocRef = parseDocRef('https://e.com/x.md');
    expect(docRefsEqual(a, b)).toBe(false);
  });
});
