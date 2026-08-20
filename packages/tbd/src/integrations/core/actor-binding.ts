/**
 * Who a tbd handle is, on each provider that knows them.
 *
 * The problem this replaces: `user_map` made every person a config entry, keyed by an
 * email or UUID someone had to look up and paste. Adding a teammate meant editing
 * config, a rename could orphan the entry silently, and the same table had to serve
 * providers whose identifiers have nothing in common — a Linear UUID and a GitHub login
 * are not interchangeable, so one map keyed by handle could never hold both.
 *
 * So identity is resolved rather than configured. The tracker already knows its own
 * members; tbd asks it, matches by the things a person actually recognizes (email, then
 * display name), and records the answer **by provider user id**. Binding by id is what
 * makes a rename survive: the display name is a label, the id is the identity.
 *
 * Bindings are managed data, not config. They live under `bridge/<provider>/users/`,
 * one file per identity — per-provider by construction, since that is how bridge state
 * is already laid out, and one-file-per-identity avoids the union-merge duplicate-key
 * hazard a flat map would reintroduce.
 *
 * Deliberately no email is stored. The binding needs an id and a handle; keeping the
 * address out means the sync branch does not become a directory of everyone's contact
 * details.
 */

/** One member as a provider reports them. */
export interface ProviderMember {
  /** The provider's stable identifier. The thing a binding is keyed by. */
  id: string;
  /** Human-facing name. A label: it may change without changing who this is. */
  displayName: string;
  /** Used for matching only, never persisted into a binding. */
  email?: string;
  /** GitHub-style handle, where the provider has one. */
  login?: string;
  /** False for deactivated members, who should not win a match. */
  active?: boolean;
}

/** A recorded answer to "which provider user is this handle?". */
export interface ActorBinding {
  handle: string;
  provider_user_id: string;
  /** What the name was at bind time, so `doctor` can report drift. */
  display_name: string;
  bound_at: string;
}

/** How a handle resolved, so a diagnostic can explain itself. */
export type ActorResolutionVia = 'override' | 'binding' | 'email' | 'login' | 'display_name';

export interface ActorResolution {
  member?: ProviderMember;
  via?: ActorResolutionVia;
  /** Set when several members matched and none could be preferred. */
  ambiguous?: ProviderMember[];
}

const sameText = (a: string | undefined, b: string | undefined): boolean =>
  Boolean(a && b) && a!.trim().toLowerCase() === b!.trim().toLowerCase();

/**
 * Resolve a tbd handle to a provider member.
 *
 * Order, first match wins:
 *
 *   1. `user_map` override — the legacy table, still honoured so no existing config
 *      breaks, and still the escape hatch when the directory cannot answer
 *   2. a recorded binding, matched by provider user id
 *   3. exact email
 *   4. exact login
 *   5. exact display name
 *
 * Steps 3-5 are exact and case-insensitive, never fuzzy. A wrong actor is worse than an
 * unresolved one: it publishes work under someone else's name, and nothing downstream
 * would flag it. Several matches with no way to choose returns `ambiguous` so the
 * caller can ask or report, rather than picking the first.
 *
 * Deactivated members are excluded from matching but can still be reached through an
 * existing binding, so historical assignments keep resolving.
 */
export function resolveActor(
  handle: string,
  members: readonly ProviderMember[],
  bindings: readonly ActorBinding[],
  override?: string,
): ActorResolution {
  const byId = new Map(members.map((member) => [member.id, member]));

  if (override) {
    const matched =
      byId.get(override) ??
      members.find((member) => sameText(member.email, override)) ??
      members.find((member) => sameText(member.id, override));
    if (matched) {
      return { member: matched, via: 'override' };
    }
  }

  const bound = bindings.find((binding) => sameText(binding.handle, handle));
  if (bound) {
    const member = byId.get(bound.provider_user_id);
    if (member) {
      return { member, via: 'binding' };
    }
  }

  const active = members.filter((member) => member.active !== false);
  for (const [via, match] of [
    ['email', (m: ProviderMember) => sameText(m.email, handle)],
    ['login', (m: ProviderMember) => sameText(m.login, handle)],
    ['display_name', (m: ProviderMember) => sameText(m.displayName, handle)],
  ] as const) {
    const hits = active.filter(match);
    if (hits.length === 1) {
      return { member: hits[0], via };
    }
    if (hits.length > 1) {
      return { ambiguous: hits };
    }
  }

  return {};
}

/** Build the record to persist once a handle has been resolved. */
export function bindingFor(handle: string, member: ProviderMember, boundAt: string): ActorBinding {
  return {
    handle,
    provider_user_id: member.id,
    display_name: member.displayName,
    bound_at: boundAt,
  };
}

/**
 * Bindings whose recorded name no longer matches the directory.
 *
 * Not an error: binding by id means a rename keeps working, which is the point. It is
 * reported so the recorded label can be refreshed and stop confusing whoever reads it.
 */
export function driftedBindings(
  bindings: readonly ActorBinding[],
  members: readonly ProviderMember[],
): { binding: ActorBinding; currentName: string }[] {
  const byId = new Map(members.map((member) => [member.id, member]));
  const drifted: { binding: ActorBinding; currentName: string }[] = [];
  for (const binding of bindings) {
    const member = byId.get(binding.provider_user_id);
    if (member && !sameText(member.displayName, binding.display_name)) {
      drifted.push({ binding, currentName: member.displayName });
    }
  }
  return drifted;
}
