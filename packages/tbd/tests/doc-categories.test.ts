/**
 * Tests that every bundled guideline doc declares exactly one valid category
 * in its YAML frontmatter. Categories drive grouped doc listings and
 * category-based selection (e.g. `tbd docs fork --category=...`), so each
 * guideline must land in exactly one category.
 *
 * Walks the SOURCE-level docs (packages/tbd/docs/guidelines) relative to this
 * test file, like doc-references.test.ts does for bundled docs.
 */

import { describe, it, expect } from 'vitest';
import { readFile, readdir } from 'node:fs/promises';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';

import { docCategory } from '../src/lib/doc-categories.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const GUIDELINES_DIR = join(__dirname, '..', 'docs', 'guidelines');

/**
 * The allowed guideline categories. Every bundled guideline must declare
 * exactly one of these in its frontmatter `category` field.
 * (Mirrors the category set in the forkable-docs spec; the CLI-side constant
 * lands separately.)
 */
export const GUIDELINE_CATEGORIES = [
  'general',
  'typescript',
  'python',
  'convex',
  'electron',
] as const;

describe('guideline doc categories', () => {
  it('every bundled guideline declares exactly one valid category', async () => {
    const entries = await readdir(GUIDELINES_DIR);
    const files = entries.filter((f) => extname(f) === '.md').sort();

    // Sanity check: the bundled guidelines must actually be there.
    expect(files.length).toBeGreaterThan(0);

    const failures: string[] = [];

    for (const file of files) {
      const raw = await readFile(join(GUIDELINES_DIR, file), 'utf-8');

      let category: unknown;
      try {
        // gray-matter (js-yaml) rejects duplicated keys, so a doc declaring
        // `category:` twice fails here rather than silently picking one.
        const parsed = matter(raw);
        category = parsed.data.category;
      } catch (error) {
        failures.push(`${file}: frontmatter failed to parse (${(error as Error).message})`);
        continue;
      }

      if (category === undefined || category === null) {
        failures.push(`${file}: missing frontmatter \`category\``);
      } else if (typeof category !== 'string') {
        // e.g. a YAML list — must be exactly one category, as a single string
        failures.push(
          `${file}: \`category\` must be a single string, got ${JSON.stringify(category)}`,
        );
      } else if (!(GUIDELINE_CATEGORIES as readonly string[]).includes(category)) {
        failures.push(
          `${file}: invalid category "${category}" (allowed: ${GUIDELINE_CATEGORIES.join(', ')})`,
        );
      }
    }

    if (failures.length > 0) {
      expect.fail(`Guideline category failures:\n  ${failures.join('\n  ')}`);
    }
  });
});

describe('docCategory()', () => {
  it('returns the declared category when it is a known guideline category', () => {
    expect(docCategory({ category: 'general' })).toBe('general');
    expect(docCategory({ category: 'typescript' })).toBe('typescript');
    expect(docCategory({ category: 'python' })).toBe('python');
  });

  it('returns undefined for an unknown or undeclared category (no general fallback)', () => {
    // Regression for tbd-o6zn: non-guideline docs — e.g. a shortcut declaring
    // `category: review`, or a doc with no category — must NOT collapse to
    // 'general', or `tbd docs fork --category=general` over-forks every one of
    // them (all shortcuts, templates, and references).
    expect(docCategory({ category: 'review' })).toBeUndefined();
    expect(docCategory({ category: 'meta' })).toBeUndefined();
    expect(docCategory({})).toBeUndefined();
    expect(docCategory(undefined)).toBeUndefined();
  });
});
