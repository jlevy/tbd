/**
 * Union of append-only comment sequences.
 *
 * A comment's identity is its `local_id` (a ulid minted at authoring) when it
 * has one, else the provider's immutable `id`. A pushed comment carries BOTH —
 * it keeps its local_id and gains the provider id — so the same comment
 * observed pre-push on one machine and post-push on another unifies on
 * local_id, and the post-push observation (the one with `id`) wins.
 *
 * Order is (at, identity): creation time with a stable tiebreak. Append-only
 * means union never loses an entry, which is what makes concurrent comment
 * writes conflict-free.
 *
 * Lives in lib/ because both the merge engine (file/git.ts) and the comment
 * store (integrations/) need it, and file/ must not import integrations/.
 */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function identityOf(entry: Record<string, unknown>): string {
  const localId = typeof entry.local_id === 'string' ? entry.local_id : undefined;
  const id = typeof entry.id === 'string' ? entry.id : undefined;
  return localId ?? id ?? JSON.stringify(entry);
}

function sortKey(entry: Record<string, unknown>): string {
  const at = typeof entry.at === 'string' ? entry.at : '';
  return `${at}\u0000${identityOf(entry)}`;
}

/**
 * Whether a value is an array this module may union without losing anything.
 *
 * The union drops non-object entries and re-sorts the rest, which is correct for a
 * provider comment log and destructive for anything else. `extensions` is the
 * documented home for third-party data, and a namespace this build knows nothing
 * about may legitimately keep a `comments` key holding strings, or objects with no
 * comment identity. Callers that key off the name alone would silently rewrite it.
 *
 * So identify a comment log by shape, not by key: every entry must be an object with
 * an identity (`local_id` or `id`), an `at` timestamp, and a `body`. That is the
 * `CommentEntry` contract in `lib/schemas.ts`, checked structurally here because this
 * module is the one both the merge engine and the comment store share. An empty array
 * qualifies — a log with nothing in it is still a log, and unioning it loses nothing.
 */
export function isCommentLog(value: unknown): value is Record<string, unknown>[] {
  return (
    Array.isArray(value) &&
    value.every(
      (entry) =>
        isRecord(entry) &&
        (typeof entry.local_id === 'string' || typeof entry.id === 'string') &&
        typeof entry.at === 'string' &&
        typeof entry.body === 'string',
    )
  );
}

/**
 * Union two comment arrays by identity, ordered by creation time.
 *
 * Non-array inputs read as empty; non-object entries are dropped. Where the
 * same identity appears on both sides, the entry carrying a provider `id`
 * (i.e. the pushed observation) wins.
 *
 * Callers merging an arbitrary `extensions` namespace must gate this on
 * `isCommentLog` for both sides first; see the note there.
 */
export function unionCommentArrays(a: unknown, b: unknown): Record<string, unknown>[] {
  const entries = (value: unknown): Record<string, unknown>[] =>
    Array.isArray(value) ? value.filter(isRecord) : [];

  const byIdentity = new Map<string, Record<string, unknown>>();
  for (const entry of [...entries(a), ...entries(b)]) {
    const key = identityOf(entry);
    const existing = byIdentity.get(key);
    if (!existing) {
      byIdentity.set(key, entry);
      continue;
    }
    // Prefer the observation that knows the provider id.
    if (typeof entry.id === 'string' && typeof existing.id !== 'string') {
      byIdentity.set(key, entry);
    }
  }

  return [...byIdentity.values()].sort((x, y) => sortKey(x).localeCompare(sortKey(y)));
}
