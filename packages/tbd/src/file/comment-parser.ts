/** Parser and canonical serializer for immutable native comment records. */

import {
  NATIVE_COMMENT_FIELD_ORDER,
  NativeCommentSchema,
  type NativeComment,
} from '../lib/native-comment.js';
import { normalizeLineEndings } from '../utils/markdown-utils.js';
import { sortKeys, stringifyYaml } from '../utils/yaml-utils.js';
import { parseFrontmatterDocument } from './parser.js';

/**
 * Normalize representation-only Markdown differences at the persistence boundary.
 *
 * LF line endings and one file-terminal newline make equivalent retries byte-stable.
 * Terminal blank lines carry no rendered Markdown content, so they are omitted while
 * whitespace on the final content line remains intact.
 */
export function canonicalizeNativeCommentBody(body: string): string {
  return normalizeLineEndings(body).replace(/(?:\n[\t ]*)+$/u, '');
}

/** Parse and validate one native comment Markdown document. */
export function parseNativeComment(content: string): NativeComment {
  const { frontmatter, body } = parseFrontmatterDocument(content);
  if (Object.hasOwn(frontmatter, 'body')) {
    throw new Error('Native comment body must be Markdown after the frontmatter delimiter');
  }
  return NativeCommentSchema.parse({
    ...frontmatter,
    body: canonicalizeNativeCommentBody(body),
  });
}

/** Serialize one native comment into its deterministic Markdown representation. */
export function serializeNativeComment(comment: NativeComment): string {
  const canonical = NativeCommentSchema.parse({
    ...comment,
    body: canonicalizeNativeCommentBody(comment.body),
  });
  const { body, ...metadata } = canonical;
  const yaml = stringifyYaml(sortKeys(metadata, NATIVE_COMMENT_FIELD_ORDER), {
    lineWidth: 0,
    nullStr: 'null',
    sortMapEntries: false,
  });

  return `---\n${yaml.trim()}\n---\n${body}\n`;
}
