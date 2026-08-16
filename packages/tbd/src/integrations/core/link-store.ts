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
 * Every link key `writeLink` owns — the ones it writes, plus the ones it
 * retires.
 *
 * `key` and `url` are no longer stored on the bead (see {@link writeLink}) but
 * stay listed here so a bead written by an earlier tbd has them stripped the
 * next time its link is rewritten, rather than preserved forever as opaque
 * siblings. Dropping them from this list would make the stale value permanent.
 */
export const PERSISTED_LINK_KEYS = ['id', 'key', 'url', 'linked_at'] as const;

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
 * Other namespaces and non-link siblings inside this provider namespace are
 * preserved untouched. The latter matters because comments (and future
 * provider-owned state) live beside the link identity.
 *
 * The stored payload is built field by field rather than by spreading `entry`.
 * Beads are committed to git and read by everyone with the repository, so what
 * lands in them from `entry` is a deliberate allow-list: the provider's id and
 * when the link was made. Nothing else about the external item, and never
 * anything derived from a credential. Pre-existing opaque siblings are retained
 * for mixed-version compatibility; spreading `entry` would instead let a future
 * field start persisting silently.
 *
 * The tracker's human identifier and URL are deliberately *not* stored here,
 * though `entry` still carries them for callers that render immediately. Both
 * are derived from mutable tracker state — a Linear identifier is
 * `{teamKey}-{number}`, so a team rename rewrites every identifier in it — and
 * a bead is the wrong place for a value the tracker can invalidate wholesale:
 * it is committed, merged across branches, and read by everyone with the
 * repository. They live on the bridge record instead, which is rewritten every
 * sync and so repairs itself. See `LinkRecordSchema.external_key`.
 */
export function writeLink(issue: Issue, entry: LinkedEntryType): Issue {
  const current = issue.extensions?.[entry.provider];
  const siblings =
    typeof current === 'object' && current !== null && !Array.isArray(current)
      ? Object.fromEntries(
          Object.entries(current).filter(
            ([key]) => !PERSISTED_LINK_KEYS.includes(key as (typeof PERSISTED_LINK_KEYS)[number]),
          ),
        )
      : {};
  const payload: Record<string, unknown> = {
    id: entry.id,
    linked_at: entry.linked_at,
  };

  return {
    ...issue,
    extensions: {
      ...(issue.extensions ?? {}),
      [entry.provider]: { ...siblings, ...payload },
    },
  };
}

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
 *
 * `keyByExternalId` supplies the human identifier for the report, since the
 * bead no longer carries one — build it from bridge records. It is a map rather
 * than a lookup so this stays pure and both callers share one code path.
 * Omitting it costs only a less friendly label: the report falls back to the
 * external id, which is the identity anyway.
 */
export function duplicateExternalLinks(
  issues: readonly Issue[],
  provider: ProviderNameType,
  keyByExternalId?: ReadonlyMap<string, string | null>,
): DuplicateExternalLink[] {
  const byExternal = new Map<string, { beadId: string; key: string | null }[]>();
  for (const issue of issues) {
    const link = readLink(issue, provider);
    if (!link) {
      continue;
    }
    const holders = byExternal.get(link.id) ?? [];
    // `link.key` is legacy: beads written before the identifier moved to the
    // bridge record still carry one, so prefer the record and fall back.
    holders.push({ beadId: issue.id, key: keyByExternalId?.get(link.id) ?? link.key ?? null });
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
