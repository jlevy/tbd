import { describe, expect, it } from 'vitest';

import { guidelineGroupFor } from '../src/file/doc-cache.js';

/**
 * Group assignment decides which guidelines an agent is told to always load.
 * A language-specific document filed under "General engineering" is served to
 * every session regardless of language, so each group's boundary is asserted
 * here rather than left to the generated directory.
 */
describe('guidelineGroupFor', () => {
  it('files general-prefixed and named always-load guidelines under General engineering', () => {
    for (const name of [
      'general-coding-rules',
      'general-testing-rules',
      'general-tdd-guidelines',
      'error-handling-rules',
      'backward-compatibility-rules',
      'commit-conventions',
      'golden-testing-guidelines',
    ]) {
      expect(guidelineGroupFor(name), name).toBe('General engineering');
    }
  });

  it('files language guidelines under their own language group', () => {
    expect(guidelineGroupFor('typescript-rules')).toBe('TypeScript & JS ecosystem');
    expect(guidelineGroupFor('pnpm-monorepo-patterns')).toBe('TypeScript & JS ecosystem');
    expect(guidelineGroupFor('python-rules')).toBe('Python');
    expect(guidelineGroupFor('rust-rules')).toBe('Rust');
    expect(guidelineGroupFor('convex-rules')).toBe('Convex');
  });

  it('keeps language-specific testing rules out of General engineering', () => {
    // A substring match on 'testing' or 'tdd' captures these, which would tell
    // every session to read a single language's rules.
    for (const name of ['rust-testing-rules', 'python-testing-rules', 'typescript-tdd-rules']) {
      expect(guidelineGroupFor(name), name).not.toBe('General engineering');
    }
    expect(guidelineGroupFor('rust-testing-rules')).toBe('Rust');
    expect(guidelineGroupFor('python-testing-rules')).toBe('Python');
  });

  it('files language-neutral topic guidelines under Cross-cutting engineering topics', () => {
    for (const name of [
      'ci-and-gates-rules',
      'code-review-rules',
      'filesystem-rules',
      'release-engineering-rules',
    ]) {
      expect(guidelineGroupFor(name), name).toBe('Cross-cutting engineering topics');
    }
  });

  it('falls through to the catch-all group', () => {
    expect(guidelineGroupFor('common-doc-guidelines')).toBe('Docs, process & tooling');
    expect(guidelineGroupFor('supply-chain-hardening')).toBe('Docs, process & tooling');
  });
});
