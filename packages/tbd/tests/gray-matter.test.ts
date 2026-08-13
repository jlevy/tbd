import { afterEach, describe, expect, it } from 'vitest';
import { readFile, readdir } from 'node:fs/promises';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseMarkdownMatter } from '../src/utils/gray-matter.js';

const EXECUTION_MARKER = '__tbdGrayMatterExecutionMarker';
const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const SOURCE_ROOT = resolve(TEST_DIR, '../src');
const GRAY_MATTER_BOUNDARY = resolve(SOURCE_ROOT, 'utils/gray-matter.ts');
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
  it('rejects JavaScript front matter before gray-matter can evaluate it', () => {
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

  it('normalizes CRLF inside front matter without changing the body', () => {
    const parsed = parseMarkdownMatter(
      '---\r\ntitle: Safe\r\ncategory: typescript\r\n---\r\nBody.\r\n',
    );

    expect(parsed.data).toEqual({ title: 'Safe', category: 'typescript' });
    expect(parsed.content).toBe('Body.\r\n');
  });

  it('keeps every production gray-matter import behind the checked boundary', async () => {
    const relativePaths = await readdir(SOURCE_ROOT, { recursive: true });
    const offenders: string[] = [];

    for (const relativePath of relativePaths) {
      if (!PRODUCTION_SOURCE_EXTENSIONS.has(extname(relativePath))) {
        continue;
      }

      const sourcePath = resolve(SOURCE_ROOT, relativePath);
      if (sourcePath === GRAY_MATTER_BOUNDARY) {
        continue;
      }

      const source = await readFile(sourcePath, 'utf8');
      if (/from\s+['"]gray-matter['"]/.test(source)) {
        offenders.push(relativePath);
      }
    }

    expect(offenders.sort()).toEqual([]);
  });
});
