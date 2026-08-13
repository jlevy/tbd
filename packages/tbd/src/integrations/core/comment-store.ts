/**
 * Where a bead records its synchronized comments.
 *
 * Comments live as an append-only array under `extensions.<provider>.comments`,
 * alongside the link identity that namespace already carries. Each entry is an
 * allow-list — identity, timestamp, author display name, capped body — because
 * beads are committed to git and read by everyone with the repository.
 *
 * Identity rules: an inbound comment carries the provider's immutable `id`; a
 * locally authored one starts with a ulid `local_id` and gains `id` when
 * pushed. The merge layer unions on that identity (see lib/comment-union.ts),
 * so concurrent appends from different machines both survive.
 */

import { ulid } from 'ulid';
import type { z } from 'zod';

import { COMMENT_BODY_CAP, COMMENTS_PER_BEAD_CAP, CommentEntry } from '../../lib/schemas.js';
import type { Issue, ProviderNameType } from '../../lib/types.js';
import { unionCommentArrays } from '../../lib/comment-union.js';
import type { ExternalComment } from './types.js';

export type CommentEntryType = z.infer<typeof CommentEntry>;

/** Read a bead's valid comment entries for one provider. Invalid ones skip. */
export function readComments(issue: Issue, provider: ProviderNameType): CommentEntryType[] {
  const namespace = issue.extensions?.[provider];
  if (typeof namespace !== 'object' || namespace === null) {
    return [];
  }
  const raw = (namespace as Record<string, unknown>).comments;
  if (!Array.isArray(raw)) {
    return [];
  }
  const entries: CommentEntryType[] = [];
  for (const candidate of raw) {
    const parsed = CommentEntry.safeParse(candidate);
    if (parsed.success) {
      entries.push(parsed.data);
    }
  }
  return entries;
}

/** Entries authored locally that have not been pushed yet. */
export function unpushedComments(issue: Issue, provider: ProviderNameType): CommentEntryType[] {
  return readComments(issue, provider).filter((entry) => entry.id === undefined);
}

function writeEntries(
  issue: Issue,
  provider: ProviderNameType,
  entries: CommentEntryType[],
): Issue {
  const namespace = issue.extensions?.[provider];
  const existing = typeof namespace === 'object' && namespace !== null ? namespace : {};
  return {
    ...issue,
    extensions: {
      ...(issue.extensions ?? {}),
      [provider]: { ...existing, comments: capEntries(entries) },
    },
  };
}

/**
 * Enforce the caps: bodies truncate with a marker, and beyond the per-bead
 * count the OLDEST entries collapse to id/timestamp stubs — the full text
 * stays in the tracker, which is the system of record for comment prose.
 */
export function capEntries(entries: readonly CommentEntryType[]): CommentEntryType[] {
  const bounded = entries.map((entry) =>
    entry.id !== undefined && entry.body.length > COMMENT_BODY_CAP
      ? {
          ...entry,
          body: `${entry.body.slice(0, COMMENT_BODY_CAP)}\n… (truncated; full text in the tracker)`,
        }
      : entry,
  );
  const providerHeldIndexes = bounded.flatMap((entry, index) =>
    entry.id === undefined ? [] : [index],
  );
  const overflow = providerHeldIndexes.length - COMMENTS_PER_BEAD_CAP;
  if (overflow <= 0) {
    return bounded;
  }
  const collapsedIndexes = new Set(providerHeldIndexes.slice(0, overflow));
  return bounded.map((entry, index) =>
    collapsedIndexes.has(index) && entry.body !== '' ? { ...entry, body: '' } : entry,
  );
}

/** Append a locally authored comment. Works offline; pushes on the next sync. */
export function appendLocalComment(
  issue: Issue,
  provider: ProviderNameType,
  body: string,
  at: string,
  author = 'tbd',
): { issue: Issue; entry: CommentEntryType } {
  const entry: CommentEntryType = { local_id: ulid().toLowerCase(), at, author, body };
  const merged = unionCommentArrays(readComments(issue, provider), [entry]);
  return {
    issue: writeEntries(issue, provider, merged as CommentEntryType[]),
    entry,
  };
}

/** Record the provider id a pushed comment came back with. */
export function recordPushedComment(
  issue: Issue,
  provider: ProviderNameType,
  localId: string,
  externalId: string,
): Issue {
  const entries = readComments(issue, provider).map((entry) =>
    entry.local_id === localId ? { ...entry, id: externalId } : entry,
  );
  return writeEntries(issue, provider, entries);
}

/**
 * Fold freshly fetched external comments into the bead. Returns how many were
 * new; zero means the bead is untouched (same object), so callers can skip a
 * write entirely.
 */
export function mergeExternalComments(
  issue: Issue,
  provider: ProviderNameType,
  external: readonly ExternalComment[],
): { issue: Issue; added: number } {
  const current = readComments(issue, provider);
  const seen = new Set(current.map((entry) => entry.id).filter(Boolean));
  const fresh = external
    .filter((comment) => !seen.has(comment.id))
    .map((comment) => ({
      id: comment.id,
      at: comment.createdAt,
      author: comment.author,
      body: comment.body,
    }));
  if (fresh.length === 0) {
    return { issue, added: 0 };
  }
  const merged = unionCommentArrays(current, fresh);
  return {
    issue: writeEntries(issue, provider, merged as CommentEntryType[]),
    added: fresh.length,
  };
}
