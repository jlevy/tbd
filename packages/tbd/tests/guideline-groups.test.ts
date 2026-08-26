import { readFile, readdir } from 'node:fs/promises';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  ALWAYS_LOAD_GUIDELINES,
  EXPLICITLY_GROUPED_GUIDELINES,
  guidelineGroupFor,
} from '../src/file/doc-cache.js';

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
  it('files the always-load core under General engineering', () => {
    expect(ALWAYS_LOAD_GUIDELINES).toEqual(['general-eng-agent-principles']);
    for (const name of ALWAYS_LOAD_GUIDELINES) {
      expect(guidelineGroupFor(name), name).toBe('General engineering');
    }
  });

  it('does not admit a guideline to the always-load core by filename prefix', () => {
    // Membership of the group every session reads is a context budget, not a naming
    // convention. A new `general-*` document must be routed deliberately.
    for (const name of ['general-testing-rules', 'general-tdd-guidelines']) {
      expect(guidelineGroupFor(name), name).toBe('Cross-cutting engineering topics');
    }
    expect(guidelineGroupFor('general-something-new')).toBe('Docs, process & tooling');
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
      'backward-compatibility-rules',
      'ci-and-gates-rules',
      'code-review-rules',
      'commit-conventions',
      'error-handling-rules',
      'filesystem-rules',
      'general-coding-rules',
      'general-comment-rules',
      'golden-testing-guidelines',
      'release-engineering-rules',
      'supply-chain-hardening',
    ]) {
      expect(guidelineGroupFor(name), name).toBe('Cross-cutting engineering topics');
    }
  });

  it('falls through to the catch-all group', () => {
    expect(guidelineGroupFor('common-doc-guidelines')).toBe('Docs, process & tooling');
  });

  it('has a bundled guideline for every name a group matches explicitly', async () => {
    // A group that names documents which do not exist renders as an empty heading:
    // the routing test passes, the generated directory shows nothing, and the gap is
    // invisible. This reads the real name sets rather than a copy of them, so a name
    // added to a group without a document fails here instead of shipping silently.
    const bundled = new Set(await bundledGuidelineNames());
    expect(EXPLICITLY_GROUPED_GUIDELINES.length).toBeGreaterThan(0);
    const missing = EXPLICITLY_GROUPED_GUIDELINES.filter((name) => !bundled.has(name));
    expect(missing, `named in a guideline group but not bundled: ${missing.join(', ')}`).toEqual(
      [],
    );
  });

  it('does not let document-local metadata contradict generated routing', async () => {
    for (const name of await bundledGuidelineNames()) {
      const content = await readFile(join(GUIDELINES_DIR, `${name}.md`), 'utf8');
      expect(content, `${name}: route always-load policy in doc-cache.ts`).not.toMatch(
        /^alwaysApply:/m,
      );
    }
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
