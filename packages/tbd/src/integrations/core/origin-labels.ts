/**
 * Origin labels: the marks that make a shared tracker legible.
 *
 * Every mirrored item carries a `tbd:sync` label and a per-repository label in a group
 * named `repo`. Two things follow, and both are the point:
 *
 * - **A human can filter agent traffic out.** Linear views support "is not", so
 *   `label is not tbd:sync` gives a person their own board back in a workspace that
 *   agents also write to. Without a uniform marker there is no such filter.
 * - **Many repositories can report into one surface.** The `repo` group answers "where
 *   did this come from", which is the question that otherwise makes a shared team or
 *   project unusable past the second repository.
 *
 * They apply in **every** integration mode, by default. A single-repo setup pays nothing
 * for them and becomes consolidation-ready for free; a repository that genuinely does not
 * want them sets `labels.origin: false`.
 *
 * The group form (`repo/<name>`) is Linear's native namespace convention, and a Linear
 * label group allows only one of its labels per issue — which matches one-repo-per-bead
 * structurally rather than by a rule this code has to enforce.
 *
 * A group does **not**, however, scope the label's name: Linear stores only the leaf and
 * enforces uniqueness across the entire team, so `repo/tbd` and a root `tbd` are a
 * genuine conflict that Linear rejects outright. That is why tbd's own markers live
 * behind {@link TBD_LABEL_PREFIX}, which repository names provably cannot reach. A repo
 * name can still collide with a label a human already made; that is a real conflict and
 * `tbd integration setup` reports it rather than half-applying.
 */

import type { ProviderSettings, RepoLabelSetting } from './provider-settings.js';
import { parseRepoSlug } from './permalink.js';

/**
 * Namespace for every root-level label tbd creates for itself.
 *
 * A Linear label name must be unique across the whole team — a label group does *not*
 * scope it, which is the constraint the rest of this file is shaped around. Since
 * {@link sanitizeRepoLabel} can only emit `[a-z0-9._-]`, a name containing `:` can never
 * collide with a repository label, so putting tbd's own markers behind this prefix makes
 * the two namespaces disjoint by construction rather than by luck.
 */
export const TBD_LABEL_PREFIX = 'tbd:';

/**
 * Default name for the plain marker every mirrored item carries.
 *
 * Prefixed rather than a bare `tbd` because the bare form shares one flat namespace with
 * repository labels and every label a human already made. Mirroring a repository named
 * `tbd` — this one — made Linear reject the whole provisioning run with
 * `Label "tbd" already exists in team`, and a repository named `docs` would collide with
 * an existing `docs` label just as hard.
 */
export const ORIGIN_LABEL = `${TBD_LABEL_PREFIX}sync`;

/** Linear label-group prefix for the per-repository label. */
export const REPO_LABEL_GROUP = 'repo';

/**
 * Sanitize a repository name into a label segment.
 *
 * Conservative on purpose: the value becomes a tracker label and a filter term, so it
 * stays lowercase alphanumerics plus `-`, `.`, and `_`.
 */
export function sanitizeRepoLabel(name: string): string {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'repo'
  );
}

/**
 * Resolve the repository label's name.
 *
 * `auto` derives it from the git origin remote; an explicit string wins outright; `false`
 * disables the label. The `idPrefix` fallback covers a repository with no remote — a
 * local-only checkout still gets a stable name rather than dropping the label silently.
 *
 * Deliberately the repo NAME, not `owner/name`: the owner is the same for every
 * repository in most workspaces, so including it would add noise to every label without
 * distinguishing anything. A repository whose bare name collides with a sibling's sets
 * `labels.repo` explicitly.
 */
export function resolveRepoLabelName(options: {
  setting: RepoLabelSetting;
  originRemoteUrl?: string;
  idPrefix?: string;
}): string | undefined {
  const { setting, originRemoteUrl, idPrefix } = options;
  if (setting === false) {
    return undefined;
  }
  if (setting !== 'auto') {
    return sanitizeRepoLabel(setting);
  }
  const slug = originRemoteUrl ? parseRepoSlug(originRemoteUrl) : undefined;
  if (slug) {
    return sanitizeRepoLabel(slug.repo);
  }
  return idPrefix ? sanitizeRepoLabel(idPrefix) : undefined;
}

/**
 * The labels every mirrored item for this repository must carry.
 *
 * Returns an empty list when origin labelling is off, so callers can pass the result
 * straight through without branching.
 */
export function originLabelsFor(options: {
  settings: Pick<ProviderSettings, 'originLabel' | 'repoLabel'>;
  originRemoteUrl?: string;
  idPrefix?: string;
}): string[] {
  const { settings, originRemoteUrl, idPrefix } = options;
  if (settings.originLabel === false) {
    // One switch turns off the whole scheme. A repository that wants the plain marker
    // but not the repo group sets `labels.repo: false` instead.
    return [];
  }

  // `true` means the default name; a string overrides it, which a workspace already
  // using `tbd` for something else needs.
  const originName =
    typeof settings.originLabel === 'string'
      ? sanitizeRepoLabel(settings.originLabel)
      : ORIGIN_LABEL;
  const labels = [originName];
  const repoName = resolveRepoLabelName({
    setting: settings.repoLabel,
    originRemoteUrl,
    idPrefix,
  });
  if (repoName) {
    labels.push(`${REPO_LABEL_GROUP}/${repoName}`);
  }
  return labels;
}

/**
 * Whether a label belongs to another repository's `repo` group.
 *
 * Used by the inbound scan: a candidate carrying a sibling repository's origin label is
 * that repository's business, and importing it here would duplicate the bead on both
 * sides of a shared scope.
 */
export function isForeignRepoLabel(label: string, ownRepoName: string | undefined): boolean {
  if (!label.startsWith(`${REPO_LABEL_GROUP}/`)) {
    return false;
  }
  const name = label.slice(REPO_LABEL_GROUP.length + 1);
  return name !== ownRepoName;
}

/**
 * Whether a label is one tbd owns and needs, as opposed to one mirrored from a bead.
 *
 * The set is deliberately small and structural: anything in the `tbd:` namespace (the
 * default origin marker, the status carriers, and mirrored bead labels under the
 * prefixed mode — mirrored ones are only ever sent when the operator asked for them, so
 * treating the prefix as tbd-owned is right), plus anything in the `repo` group.
 *
 * `originName` is still consulted because an operator may override the marker with a
 * bare name via `labels.origin: <string>`. That override is theirs to make, but it opts
 * out of the collision-proofing the prefix provides.
 */
export function isTbdOwnedLabel(name: string, originName: string = ORIGIN_LABEL): boolean {
  return (
    name === originName ||
    name.startsWith(TBD_LABEL_PREFIX) ||
    name.startsWith(`${REPO_LABEL_GROUP}/`)
  );
}
