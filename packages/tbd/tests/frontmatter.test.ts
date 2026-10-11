import { afterEach, describe, expect, it } from 'vitest';
import { readFile, readdir } from 'node:fs/promises';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { hasMarkdownFrontmatter, parseMarkdownMatter } from '../src/utils/frontmatter.js';

const EXECUTION_MARKER = '__tbdGrayMatterExecutionMarker';
const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const SOURCE_ROOT = resolve(TEST_DIR, '../src');
const PRODUCTION_SOURCE_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.mts',
  '.cts',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
]);

afterEach(() => {
  Reflect.deleteProperty(globalThis, EXECUTION_MARKER);
});

describe('parseMarkdownMatter', () => {
  it('rejects JavaScript front matter without evaluating the payload', () => {
    const content = `---javascript
(globalThis.${EXECUTION_MARKER} = true, { title: 'executed' })
---
Body.`;

    expect(() => parseMarkdownMatter(content)).toThrow(
      'Unsupported front-matter language "javascript"; tbd accepts YAML only',
    );
    expect(Reflect.get(globalThis, EXECUTION_MARKER)).toBeUndefined();
  });

  it('rejects non-executable non-YAML engines too', () => {
    expect(() => parseMarkdownMatter('---json\n{"title":"JSON"}\n---\nBody.')).toThrow(
      'Unsupported front-matter language "json"; tbd accepts YAML only',
    );
  });

  it.each(['', 'yaml', 'yml'])('accepts the %s YAML language marker', (language) => {
    const parsed = parseMarkdownMatter(`---${language}
released: 2025-01-01
legacy_octal: 012
sexagesimal: 1:20
booleanish: yes
---
Body.`);

    expect(parsed.data).toEqual({
      released: '2025-01-01',
      legacy_octal: 12,
      sexagesimal: '1:20',
      booleanish: 'yes',
    });
    expect(parsed.content).toBe('Body.');
  });

  it('recognizes a BOM-prefixed YAML header', () => {
    const content = '\uFEFF---\ntitle: Safe\n---\nBody.\r\n';
    expect(hasMarkdownFrontmatter(content)).toBe(true);
    expect(parseMarkdownMatter(content)).toMatchObject({
      data: { title: 'Safe' },
      content: 'Body.\r\n',
    });
  });

  it.each(['', '\uFEFF'])('rejects executable markers even behind a BOM (%s)', (bom) => {
    const content =
      bom + '---javascript\n(globalThis.' + EXECUTION_MARKER + ' = true, {})\n---\nBody.';
    expect(() => parseMarkdownMatter(content)).toThrow('tbd accepts YAML only');
    expect(Reflect.get(globalThis, EXECUTION_MARKER)).toBeUndefined();
  });

  it.each(['---\n---\nBody.', '---\n# comment\n\n---\nBody.'])(
    'accepts empty and comment-only headers',
    (content) => {
      expect(parseMarkdownMatter(content)).toMatchObject({ data: {}, content: 'Body.' });
    },
  );

  it('preserves Markdown bytes after a complete delimiter line', () => {
    const body = '\r\n  Indented\r\n---inside the body\n\nTrailing spaces  \r\n';
    const parsed = parseMarkdownMatter('---  \r\ntitle: Safe\r\n---  \r\n' + body);
    expect(parsed.data).toEqual({ title: 'Safe' });
    expect(parsed.content).toBe(body);
  });

  it.each(['---\ntitle: Safe', '---', '---\ntitle: Safe\n---suffix\nBody.'])(
    'rejects missing or malformed closing delimiters: %s',
    (content) => {
      expect(() => parseMarkdownMatter(content)).toThrow('missing front matter closing delimiter');
    },
  );

  it.each(['----\nBody.', '---suffix\ntitle: Safe\n---\nBody.'])(
    'does not treat malformed opening delimiters as YAML: %s',
    (content) => {
      if (content.startsWith('----')) {
        expect(hasMarkdownFrontmatter(content)).toBe(false);
        expect(parseMarkdownMatter(content).content).toBe(content);
      } else {
        expect(() => parseMarkdownMatter(content)).toThrow('tbd accepts YAML only');
      }
    },
  );

  it('rejects invalid YAML', () => {
    expect(() => parseMarkdownMatter('---\nlabels: [unterminated\n---\nBody.')).toThrow();
  });

  it('parses nested mappings, aliases, quoted and multiline scalars with YAML 1.2', () => {
    expect(
      parseMarkdownMatter(
        '---\nbase: &base {title: "Use for: testing"}\ncopy: *base\ntext: |-\n  line one\n  line two\n---\nBody.',
      ).data,
    ).toEqual({
      base: { title: 'Use for: testing' },
      copy: { title: 'Use for: testing' },
      text: 'line one\nline two',
    });
  });

  it('leaves Markdown without a header intact', () => {
    const content = '\uFEFFBody.\r\n---\n';
    expect(hasMarkdownFrontmatter(content)).toBe(false);
    expect(parseMarkdownMatter(content)).toMatchObject({ data: {}, content });
  });

  it('normalizes CRLF inside front matter without changing the body', () => {
    const parsed = parseMarkdownMatter(
      '---\r\ntitle: Safe\r\ncategory: typescript\r\n---\r\nBody.\r\n',
    );

    expect(parsed.data).toEqual({ title: 'Safe', category: 'typescript' });
    expect(parsed.content).toBe('Body.\r\n');
  });

  it('does not import executable frontmatter engines in production', async () => {
    const relativePaths = await readdir(SOURCE_ROOT, { recursive: true });
    const offenders: string[] = [];

    for (const relativePath of relativePaths) {
      if (!PRODUCTION_SOURCE_EXTENSIONS.has(extname(relativePath))) {
        continue;
      }

      const sourcePath = resolve(SOURCE_ROOT, relativePath);
      const source = await readFile(sourcePath, 'utf8');
      if (/from\s+['"]gray-matter['"]/.test(source)) {
        offenders.push(relativePath);
      }
    }

    expect(offenders.sort()).toEqual([]);
  });
});
