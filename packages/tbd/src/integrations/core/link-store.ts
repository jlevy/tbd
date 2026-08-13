/**
 * Where a bead records its link to an external tracker.
 *
 * Links live under `extensions.<provider>`, not as a top-level issue field.
 * `extensions` is already part of `BaseEntity` and its contents are opaque to
 * the schema, so a tbd that predates this feature reads and rewrites a linked
 * bead without touching the link. A top-level field would be silently stripped
 * by Zod on the first write from an older CLI, which is exactly the kind of
 * quiet data loss that forces a format bump. Using the namespace avoids both.
 *
 * The namespace key is the provider name, so "at most one link per provider" is
 * structural rather than an invariant the merge code has to police.
 */

import { LinkedEntry } from '../../lib/schemas.js';
import type { Issue, LinkedEntryType, ProviderNameType } from '../../lib/types.js';

/**
 * Read a bead's link for one provider.
 *
 * Returns undefined when absent or malformed. A hand-edited or
 * foreign-written namespace should not crash a mirror run: the bead is simply
 * treated as unlinked, and the next mirror re-establishes the link.
 */
export function readLink(issue: Issue, provider: ProviderNameType): LinkedEntryType | undefined {
  const namespace = issue.extensions?.[provider];
  if (namespace === undefined || namespace === null) {
    return undefined;
  }
  const parsed = LinkedEntry.safeParse({ provider, ...(namespace as object) });
  return parsed.success ? parsed.data : undefined;
}

/**
 * Return a copy of the issue carrying `entry` for its provider.
 *
 * Other namespaces are preserved untouched, which matters because a bead can
 * carry a Linear link and a GitHub link at once.
 *
 * The stored payload is built field by field rather than by spreading `entry`.
 * Beads are committed to git and read by everyone with the repository, so what
 * lands in them is a deliberate allow-list: the provider's id, the human
 * identifier, the URL, and when the link was made. Nothing else about the
 * external item, and never anything derived from a credential. Spreading would
 * let a future field on `LinkedEntry` start persisting silently.
 */
export function writeLink(issue: Issue, entry: LinkedEntryType): Issue {
  const payload: Record<string, unknown> = {
    id: entry.id,
    linked_at: entry.linked_at,
  };
  if (entry.key != null) {
    payload.key = entry.key;
  }
  if (entry.url != null) {
    payload.url = entry.url;
  }

  return {
    ...issue,
    extensions: {
      ...(issue.extensions ?? {}),
      [entry.provider]: payload,
    },
  };
}

/** Exactly the keys `writeLink` will ever persist. Asserted by tests. */
export const PERSISTED_LINK_KEYS = ['id', 'key', 'url', 'linked_at'] as const;

/**
 * Return a copy of the issue with one provider's link removed.
 */
export function clearLink(issue: Issue, provider: ProviderNameType): Issue {
  if (!issue.extensions || !(provider in issue.extensions)) {
    return issue;
  }
  // Rebuild without the key rather than deleting from a copy: a dynamic delete
  // is both slower and, per the lint rule, easy to get wrong on inherited keys.
  const extensions = Object.fromEntries(
    Object.entries(issue.extensions).filter(([key]) => key !== provider),
  );
  return { ...issue, extensions };
}

/**
 * Every provider this bead is linked to.
 */
export function linkedProviders(issue: Issue): ProviderNameType[] {
  const providers: ProviderNameType[] = [];
  for (const provider of ['linear', 'github'] as const) {
    if (readLink(issue, provider)) {
      providers.push(provider);
    }
  }
  return providers;
}

export interface DuplicateExternalLink {
  externalId: string;
  externalKey: string | null;
  beadIds: string[];
}

/**
 * Find corrupt many-beads-to-one-item links already present in the store.
 *
 * The normal link command prevents these, but imports, hand edits, and older
 * migrations can predate that guard. Keep this pure so sync and doctor enforce
 * exactly the same invariant.
 */
export function duplicateExternalLinks(
  issues: readonly Issue[],
  provider: ProviderNameType,
): DuplicateExternalLink[] {
  const byExternal = new Map<string, { beadId: string; key: string | null }[]>();
  for (const issue of issues) {
    const link = readLink(issue, provider);
    if (!link) {
      continue;
    }
    const holders = byExternal.get(link.id) ?? [];
    holders.push({ beadId: issue.id, key: link.key ?? null });
    byExternal.set(link.id, holders);
  }

  const duplicates: DuplicateExternalLink[] = [];
  for (const [externalId, holders] of byExternal) {
    if (holders.length < 2) {
      continue;
    }
    holders.sort((left, right) => left.beadId.localeCompare(right.beadId));
    duplicates.push({
      externalId,
      externalKey: holders.find((holder) => holder.key !== null)?.key ?? null,
      beadIds: holders.map((holder) => holder.beadId),
    });
  }
  duplicates.sort((left, right) => left.externalId.localeCompare(right.externalId));
  return duplicates;
}
