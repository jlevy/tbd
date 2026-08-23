import { readdir } from 'node:fs/promises';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { guidelineGroupFor } from '../src/file/doc-cache.js';

const GUIDELINES_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'guidelines');

async function bundledGuidelineNames(): Promise<string[]> {
  const entries = await readdir(GUIDELINES_DIR);
  return entries.filter((f) => extname(f) === '.md').map((f) => f.slice(0, -'.md'.length));
}

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

  it('has a bundled guideline for every name a group matches explicitly', async () => {
    // A group that names documents which do not exist renders as an empty heading:
    // the routing test passes, the generated directory shows nothing, and the gap is
    // invisible. Both explicit name sets are checked against what is actually bundled.
    const bundled = new Set(await bundledGuidelineNames());
    const named = [
      'backward-compatibility-rules',
      'commit-conventions',
      'error-handling-rules',
      'golden-testing-guidelines',
      'ci-and-gates-rules',
      'code-review-rules',
      'filesystem-rules',
      'release-engineering-rules',
    ];
    const missing = named.filter((name) => !bundled.has(name));
    expect(missing, `named in a guideline group but not bundled: ${missing.join(', ')}`).toEqual(
      [],
    );
  });

  it('files every bundled guideline in a group whose heading is non-empty', async () => {
    const grouped = new Map<string, string[]>();
    for (const name of await bundledGuidelineNames()) {
      const heading = guidelineGroupFor(name);
      grouped.set(heading, [...(grouped.get(heading) ?? []), name]);
    }
    // Every language family that has bundled documents must have them routed to its own
    // group rather than falling through to the catch-all.
    expect(grouped.get('Rust')?.sort()).toEqual(
      (await bundledGuidelineNames()).filter((n) => n.startsWith('rust-')).sort(),
    );
    expect(grouped.get('Cross-cutting engineering topics')?.length).toBeGreaterThan(0);
  });
});
