/** Candidate f09 schema and types for immutable native comments. */

import { z } from 'zod';

import { validateCommentId } from './ids.js';
import { IssueId, Timestamp } from './schemas.js';

function isWellFormedUnicode(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
      const nextCodeUnit = value.charCodeAt(index + 1);
      if (!(nextCodeUnit >= 0xdc00 && nextCodeUnit <= 0xdfff)) {
        return false;
      }
      index += 1;
    } else if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) {
      return false;
    }
  }
  return true;
}

const NativeCommentDisplayText = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .refine(isWellFormedUnicode, { message: 'must contain well-formed Unicode' });

/** Portable identity minted for an agent independently of its runtime or checkout. */
export const AgentId = z.string().regex(/^agid-[0-9a-z]{26}$/);

/** Native comment ID in its own namespace, independent of issue display IDs. */
export const NativeCommentId = z
  .string()
  .refine(validateCommentId, { message: 'must be cm- plus a lowercase canonical ULID' });

/** Maximum durable native-comment body size, measured after UTF-8 encoding. */
export const NATIVE_COMMENT_BODY_MAX_BYTES = 64 * 1024;

/** Author categories that can participate in a native conversation. */
export const NativeCommentAuthorKind = z.enum(['agent', 'human', 'service', 'unknown']);

/** Immutable author snapshot stored with a native comment. */
export const NativeCommentAuthorSchema = z
  .object({
    kind: NativeCommentAuthorKind,
    display_name: NativeCommentDisplayText,
    agent_id: AgentId.optional(),
    provenance: z
      .object({
        harness: NativeCommentDisplayText.optional(),
        model: NativeCommentDisplayText.optional(),
      })
      .strict()
      .optional(),
  })
  .strict()
  .superRefine((author, ctx) => {
    if (author.agent_id !== undefined && author.kind !== 'agent') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['agent_id'],
        message: 'agent_id is only valid for an agent author',
      });
    }
  });

/** One immutable native comment document. */
export const NativeCommentSchema = z
  .object({
    type: z.literal('cm'),
    id: NativeCommentId,
    issue_id: IssueId,
    author: NativeCommentAuthorSchema,
    created_at: Timestamp,
    reply_to: NativeCommentId.optional(),
    body: z
      .string()
      .refine(isWellFormedUnicode, { message: 'body must contain well-formed Unicode' })
      .refine((body) => body.trim().length > 0, {
        message: 'body must contain visible content',
      })
      .refine(
        (body) => new TextEncoder().encode(body).byteLength <= NATIVE_COMMENT_BODY_MAX_BYTES,
        {
          message: `body must be at most ${NATIVE_COMMENT_BODY_MAX_BYTES} UTF-8 bytes`,
        },
      ),
  })
  .strict()
  .superRefine((comment, ctx) => {
    if (comment.reply_to === comment.id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['reply_to'],
        message: 'a native comment cannot reply to itself',
      });
    }
  });

/** Canonical field order for native comment YAML frontmatter. */
export const NATIVE_COMMENT_FIELD_ORDER = [
  'type',
  'id',
  'issue_id',
  'author',
  'created_at',
  'reply_to',
] as const;

/** An immutable native comment linked to an internal issue ID. */
export type NativeComment = z.infer<typeof NativeCommentSchema>;

/** The author snapshot embedded in an immutable native comment. */
export type NativeCommentAuthor = z.infer<typeof NativeCommentAuthorSchema>;

/** Native comment author category. */
export type NativeCommentAuthorKindType = z.infer<typeof NativeCommentAuthorKind>;
