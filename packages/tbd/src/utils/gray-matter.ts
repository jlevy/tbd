/**
 * The single gray-matter boundary used by tbd.
 *
 * gray-matter provides mature front-matter delimiter handling, while the
 * repository's existing `yaml` dependency provides YAML 1.2 parsing and keeps
 * date-like scalars as strings. Passing these options on every call also keeps
 * gray-matter's legacy default js-yaml engine out of the parsing path.
 */

import matter from 'gray-matter';
import { parse as parseYaml } from 'yaml';

import { stringifyYaml } from './yaml-utils.js';

const matterOptions = {
  engines: {
    yaml: {
      // gray-matter slices at the LF in a CRLF closing delimiter, leaving the
      // preceding CR in the YAML block. Normalize the block, not the Markdown
      // body, so the final plain scalar cannot acquire a trailing newline.
      parse: (input: string): object => parseYaml(input.replace(/\r\n?/g, '\n')) as object,
      stringify: (data: object): string => stringifyYaml(data),
    },
  },
};

const ALLOWED_FRONTMATTER_LANGUAGES = new Set(['yaml', 'yml']);

function assertYamlLanguage(content: string): void {
  if (!matter.test(content, matterOptions)) {
    return;
  }

  const language = matter.language(content, matterOptions).name.toLowerCase();
  if (language !== '' && !ALLOWED_FRONTMATTER_LANGUAGES.has(language)) {
    throw new Error(`Unsupported front-matter language "${language}"; tbd accepts YAML only`);
  }
}

/** Return whether content begins with a front-matter delimiter. */
export function hasMarkdownFrontmatter(content: string): boolean {
  return matter.test(content, matterOptions);
}

/** Parse Markdown front matter with tbd's YAML engine. */
export function parseMarkdownMatter(content: string): matter.GrayMatterFile<string> {
  // gray-matter also ships a JavaScript engine that evaluates explicit
  // `---javascript` blocks. tbd's file format is YAML-only, so validate before
  // gray-matter can select any built-in engine.
  assertYamlLanguage(content);
  return matter(content, matterOptions);
}
