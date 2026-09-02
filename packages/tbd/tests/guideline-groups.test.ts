import { readFile, readdir } from 'node:fs/promises';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import type { CachedDoc } from '../src/file/doc-cache.js';
import {
  ALWAYS_LOAD_GUIDELINES,
  EXPLICITLY_GROUPED_GUIDELINES,
  generateShortcutDirectory,
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

  it('routes a declared category to its own group rather than the catch-all', async () => {
    // The grouping matched on name prefixes while every bundled guideline already
    // declares a category, and doc-categories.ts calls name inference retired. The
    // two disagreed: `electron-app-development-patterns` matched the TypeScript
    // prefix, while its siblings `electrobun-` and `tauri-` matched nothing and fell
    // into "Docs, process & tooling", where an agent looking for desktop guidance
    // will not find them. Assert on the declared field, for every category at once,
    // so the next category added cannot land in the catch-all unnoticed.
    const declared = new Map<string, string[]>();
    for (const name of await bundledGuidelineNames()) {
      const content = await readFile(join(GUIDELINES_DIR, `${name}.md`), 'utf8');
      const category = /^category:\s*(\S+)/m.exec(content)?.[1];
      if (category == null || category === 'general') {
        continue; // `general` is the default and is routed by explicit membership.
      }
      declared.set(category, [...(declared.get(category) ?? []), name]);
    }
    expect(declared.size).toBeGreaterThan(0);

    for (const [category, names] of declared) {
      const headings = new Set(names.map((n) => guidelineGroupFor(n, category)));
      expect(headings.size, `${category} split across headings: ${[...headings].join(', ')}`).toBe(
        1,
      );
      const [heading] = headings;
      expect(heading, `${category} (${names.join(', ')}) fell into the catch-all`).not.toBe(
        'Docs, process & tooling',
      );
    }
  });

  it('keeps the desktop frameworks together under their own heading', () => {
    for (const name of [
      'electron-app-development-patterns',
      'electrobun-app-development-patterns',
      'tauri-app-development-patterns',
    ]) {
      expect(guidelineGroupFor(name, 'desktop'), name).toBe('Desktop app frameworks');
    }
  });

  it('files release-notes-guidelines beside the release engineering rules', () => {
    // publishing.md and release-engineering-rules both tell the reader to load these
    // together; the catch-all heading hid one half of that pair.
    expect(guidelineGroupFor('release-notes-guidelines')).toBe('Cross-cutting engineering topics');
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

/**
 * The predicate being right is not enough: the directory is what agents actually read,
 * and the bug this fixes was a value that was computed and then not passed on. Dropping
 * the `category` argument at the `generateShortcutDirectory` call site leaves every
 * predicate test green, so assert the rendered output too.
 */
describe('generateShortcutDirectory guideline routing', () => {
  function doc(name: string, category?: string): CachedDoc {
    return {
      path: `/docs/guidelines/${name}.md`,
      name,
      frontmatter: category === undefined ? undefined : { category },
      content: '',
      sourceDir: 'guidelines',
      sizeBytes: 0,
    } as CachedDoc;
  }

  /** The heading a guideline is rendered under, or null if it is absent. */
  function headingFor(directory: string, name: string): string | null {
    let current: string | null = null;
    for (const line of directory.split('\n')) {
      const heading = /^### (.+)$/.exec(line);
      if (heading) {
        current = heading[1]!;
        continue;
      }
      if (line.startsWith(`| ${name} `) || line.startsWith(`| ${name} |`)) {
        return current;
      }
    }
    return null;
  }

  it('renders a desktop guideline under its declared category, not the catch-all', () => {
    const directory = generateShortcutDirectory(
      [],
      [
        doc('tauri-app-development-patterns', 'desktop'),
        doc('electrobun-app-development-patterns', 'desktop'),
        doc('release-notes-guidelines', 'general'),
      ],
    );
    expect(headingFor(directory, 'tauri-app-development-patterns')).toBe('Desktop app frameworks');
    expect(headingFor(directory, 'electrobun-app-development-patterns')).toBe(
      'Desktop app frameworks',
    );
    // Routed by explicit membership rather than category, so it must not be swept
    // into the catch-all either.
    expect(headingFor(directory, 'release-notes-guidelines')).toBe(
      'Cross-cutting engineering topics',
    );
  });

  it('falls back to the catch-all when a guideline declares no category', () => {
    const directory = generateShortcutDirectory([], [doc('some-unknown-guideline')]);
    expect(headingFor(directory, 'some-unknown-guideline')).toBe('Docs, process & tooling');
  });
});
