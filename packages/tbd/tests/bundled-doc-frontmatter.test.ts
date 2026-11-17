/**
 * Every bundled doc's YAML frontmatter parses, with a title (or skill name) and a
 * description.
 *
 * Doc listings (`tbd docs list`, `tbd shortcut --list`, and the per-kind readers) show
 * the title and description, and a doc whose frontmatter fails to parse is listed with
 * neither, silently. A plain scalar containing ": " is the usual cause (tbd-4tfn); quote
 * the value instead.
 */

import { readFile, readdir } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { hasMarkdownFrontmatter, parseMarkdownMatter } from '../src/utils/gray-matter.js';

const DOCS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'docs');
const KIND_DIRS = ['guidelines', 'references', 'shortcuts', 'templates'];

async function markdownFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        return markdownFiles(path);
      }
      return Promise.resolve(entry.name.endsWith('.md') ? [path] : []);
    }),
  );
  return nested.flat().sort();
}

describe('bundled doc frontmatter', () => {
  it('parses for every guideline, reference, shortcut, and template', async () => {
    const files = (await Promise.all(KIND_DIRS.map((kind) => markdownFiles(join(DOCS_DIR, kind)))))
      .flat()
      .sort();
    expect(files.length).toBeGreaterThan(100);
    const problems: string[] = [];
    for (const file of files) {
      const name = relative(DOCS_DIR, file);
      const content = await readFile(file, 'utf-8');
      if (!hasMarkdownFrontmatter(content)) {
        problems.push(`${name}: no frontmatter`);
        continue;
      }
      try {
        const data = parseMarkdownMatter(content).data as Record<string, unknown>;
        const text = (field: string) => typeof data[field] === 'string' && data[field] !== '';
        // A skill tier is Agent Skill frontmatter, which names itself with `name`.
        if (!text('title') && !text('name')) {
          problems.push(`${name}: no title`);
        }
        if (!text('description')) {
          problems.push(`${name}: no description`);
        }
      } catch (error) {
        problems.push(`${name}: ${(error as Error).message.split('\n')[0]}`);
      }
    }
    expect(problems).toEqual([]);
  });
});
