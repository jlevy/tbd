/**
 * YAML front matter parser and serializer for issue files.
 *
 * Issues are stored as Markdown files with YAML front matter:
 * ---
 * type: is
 * id: is-a1b2c3
 * ...
 * ---
 *
 * Description body here.
 *
 * ## Notes
 *
 * Working notes here.
 *
 * See: tbd-design.md §2.1 Markdown + YAML Front Matter Format
 */

import { hasMarkdownFrontmatter, parseMarkdownMatter } from '../utils/gray-matter.js';
import { normalizeLineEndings } from '../utils/markdown-utils.js';
import { sortKeys, stringifyYaml } from '../utils/yaml-utils.js';
import type { Issue } from '../lib/types.js';
import { IssueSchema, ISSUE_FIELD_ORDER } from '../lib/schemas.js';

/**
 * Parsed issue file content.
 */
export interface ParsedIssueFile {
  frontmatter: Record<string, unknown>;
  description: string;
  notes: string;
}

/** Parsed YAML-frontmatter Markdown without issue-specific body interpretation. */
export interface ParsedFrontmatterDocument {
  frontmatter: Record<string, unknown>;
  body: string;
}

/**
 * Parse the common frontmatter envelope while leaving its Markdown body intact.
 */
export function parseFrontmatterDocument(content: string): ParsedFrontmatterDocument {
  const normalizedContent = normalizeLineEndings(content);

  if (!hasMarkdownFrontmatter(normalizedContent)) {
    throw new Error('Invalid format: missing front matter opening delimiter');
  }

  const parsed = parseMarkdownMatter(normalizedContent);

  // gray-matter returns an empty matter string for an unterminated header. An actually
  // empty header is valid, so distinguish it by looking for a later delimiter.
  if (parsed.matter === '' && !normalizedContent.includes('---\n---')) {
    const lines = normalizedContent.split('\n');
    const hasClosing = lines.slice(1).some((line) => line.trim() === '---');
    if (!hasClosing) {
      throw new Error('Invalid format: missing front matter closing delimiter');
    }
  }

  return {
    frontmatter: parsed.data as Record<string, unknown>,
    body: parsed.content,
  };
}

/**
 * Parse a Markdown file with YAML front matter.
 * Uses gray-matter for consistent frontmatter parsing.
 * Handles both LF and CRLF line endings.
 */
export function parseMarkdownWithFrontmatter(content: string): ParsedIssueFile {
  const { frontmatter, body: rawBody } = parseFrontmatterDocument(content);

  // Parse body - split into description and notes
  const body = rawBody.trim();

  // Find the notes section. The heading may open the body (an issue with notes
  // but no description serializes to a body that STARTS with `## Notes`), so
  // anchor on start-of-body as well as newline — requiring a preceding newline
  // silently folded such notes into the description, and the next write then
  // serialized that corrupted description plus a second `## Notes` section.
  const notesMatch = /(^|\n)## Notes\n/i.exec(body);
  let description = body;
  let notes = '';

  if (notesMatch?.index !== undefined) {
    description = body.slice(0, notesMatch.index).trim();
    notes = body.slice(notesMatch.index + notesMatch[0].length).trim();
  }

  return { frontmatter, description, notes };
}

/**
 * Parse an issue from Markdown file content.
 */
export function parseIssue(content: string): Issue {
  const { frontmatter, description, notes } = parseMarkdownWithFrontmatter(content);

  // Merge body content into frontmatter
  const data = {
    ...frontmatter,
    description: description || undefined,
    notes: notes || undefined,
  };

  // Validate and parse with Zod
  return IssueSchema.parse(data);
}

/**
 * Serialize an issue to Markdown file content.
 * Uses canonical serialization for deterministic output.
 */
export function serializeIssue(issue: Issue): string {
  // Extract body fields
  const { description, notes, ...metadata } = issue;

  // Sort keys using canonical field order (not alphabetical)
  const sortedMetadata = sortKeys(metadata, ISSUE_FIELD_ORDER);

  // Serialize YAML with compact output for frontmatter.
  // sortMapEntries: false preserves our manual ordering.
  const yaml = stringifyYaml(sortedMetadata, {
    lineWidth: 0,
    nullStr: 'null',
    sortMapEntries: false,
  });

  // Build the file content
  // Note: No blank line between closing --- and body content
  const parts = ['---', yaml.trim(), '---'];

  if (description) {
    parts.push(description.trim());
  }

  if (notes) {
    parts.push('');
    parts.push('## Notes');
    parts.push('');
    parts.push(notes.trim());
  }

  // Single newline at end
  return parts.join('\n') + '\n';
}
