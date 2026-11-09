/**
 * Central YAML-only frontmatter boundary.
 *
 * Delimiters occupy complete lines; YAML parsing belongs to the existing YAML 1.2
 * library. Only the header's line endings are normalized. Markdown body bytes,
 * including blank lines and CRLF, are returned unchanged.
 */

import { parse as parseYaml } from 'yaml';

export interface MarkdownMatter {
  data: Record<string, unknown>;
  content: string;
}

// Permit a BOM and the YAML language markers used by existing documents. A
// longer thematic break (----) is Markdown, not a frontmatter opener.
const OPENING_DELIMITER = /^\uFEFF?---(?!-)([^\r\n]*)(?:\r?\n|$)/;
const ALLOWED_LANGUAGES = new Set(['', 'yaml', 'yml']);

/** Return whether content begins with a frontmatter opening line. */
export function hasMarkdownFrontmatter(content: string): boolean {
  return OPENING_DELIMITER.test(content);
}

/** Parse a YAML header, or return untouched Markdown when there is no opener. */
export function parseMarkdownMatter(content: string): MarkdownMatter {
  const opening = OPENING_DELIMITER.exec(content);
  if (!opening) {
    return { data: {}, content };
  }

  const language = (opening[1] ?? '').trim().toLowerCase();
  if (!ALLOWED_LANGUAGES.has(language)) {
    throw new Error(`Unsupported front-matter language "${language}"; tbd accepts YAML only`);
  }

  const closingDelimiter = /^---[\t ]*(?:\r?\n|$)/gm;
  closingDelimiter.lastIndex = opening[0].length;
  const closing = closingDelimiter.exec(content);
  if (!closing) {
    throw new Error('Invalid format: missing front matter closing delimiter');
  }

  const header = content.slice(opening[0].length, closing.index).replace(/\r\n?/g, '\n');
  return {
    data: (parseYaml(header) ?? {}) as Record<string, unknown>,
    content: content.slice(closing.index + closing[0].length),
  };
}
