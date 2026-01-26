/**
 * Markdown utilities for processing markdown content.
 *
 * Uses gray-matter for consistent frontmatter parsing across the codebase.
 */

import matter from 'gray-matter';

/**
 * Parse YAML frontmatter from markdown content.
 * Returns the frontmatter content (without delimiters) or null if no valid frontmatter.
 * Handles both LF and CRLF line endings.
 */
export function parseFrontmatter(content: string): string | null {
  if (!matter.test(content)) {
    return null;
  }

  try {
    // Normalize CRLF to LF before parsing
    const normalizedContent = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const parsed = matter(normalizedContent);

    // gray-matter's `matter` property contains the raw frontmatter string
    // It may include leading whitespace/newlines that we need to strip
    const raw = parsed.matter;
    if (!raw || raw.trim() === '') {
      // Empty frontmatter (just --- followed by ---)
      return '';
    }

    // Strip leading whitespace/newlines to get clean frontmatter
    return raw.replace(/^[\s\n]+/, '');
  } catch {
    // Invalid/unclosed frontmatter - return null
    return null;
  }
}

/**
 * Insert content after YAML frontmatter.
 * If no frontmatter exists, prepends the content.
 * Handles both LF and CRLF line endings.
 */
export function insertAfterFrontmatter(content: string, toInsert: string): string {
  // Normalize CRLF to LF
  const normalizedContent = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Match frontmatter: starts with ---, ends with --- on its own line
  // Capture the full frontmatter block including delimiters
  const frontmatterRegex = /^(---\n[\s\S]*?\n---)\n*/;
  const match = frontmatterRegex.exec(normalizedContent);

  if (!match) {
    // No frontmatter found, just prepend
    return toInsert + content;
  }

  // Found frontmatter - insert after it
  const frontmatterBlock = match[1];
  const afterFrontmatter = normalizedContent.slice(match[0].length);
  const body = afterFrontmatter.replace(/^\n+/, ''); // Trim leading newlines from body

  return frontmatterBlock + '\n' + toInsert + '\n\n' + body;
}

/**
 * Strip YAML frontmatter from markdown content.
 * Returns the body content without frontmatter, with leading newlines trimmed.
 * Handles both LF and CRLF line endings.
 */
export function stripFrontmatter(content: string): string {
  if (!matter.test(content)) {
    return content;
  }

  try {
    // Normalize CRLF to LF before parsing
    const normalizedContent = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const parsed = matter(normalizedContent);
    // Trim leading newlines to match previous behavior
    return parsed.content.replace(/^\n+/, '');
  } catch {
    // Invalid/unclosed frontmatter - return original content
    return content;
  }
}
