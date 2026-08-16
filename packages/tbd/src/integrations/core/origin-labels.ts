/**
 * Origin labels: the marks that make a shared tracker legible.
 *
 * Every mirrored item carries a `tbd` label and a `repo:<name>` label. Two things
 * follow, and both are the point:
 *
 * - **A human can filter agent traffic out.** Linear views support "is not", so
 *   `label is not tbd` gives a person their own board back in a workspace that agents
 *   also write to. Without a uniform marker there is no such filter.
 * - **Many repositories can report into one surface.** `repo:<name>` answers "where did
 *   this come from", which is the question that otherwise makes a shared team or project
 *   unusable past the second repository.
 *
 * They apply in **every** integration mode, by default. A single-repo setup pays nothing
 * for them and becomes consolidation-ready for free; a repository that genuinely does not
 * want them sets `labels.origin: false`.
 *
 * ## Why both are flat, and why the marker is bare
 *
 * A Linear label name must be unique across the **entire team**, and a label group does
 * *not* scope it: Linear stores only the leaf name and rejects a duplicate outright. So
 * an earlier shape — a `repo` group whose children were bare repository names — put the
 * marker and the label for a repository named `tbd` in direct conflict, and Linear
 * refused to create the second. Mirroring this very repository was impossible.
 *
 * Prefixing the *repository* labels instead of the marker resolves it in the direction
 * that reads better. {@link sanitizeRepoLabel} emits only `[a-z0-9._-]`, so a repository
 * segment can never contain a colon — which makes `repo:<name>` unable to collide with
 * the bare marker, with another repository's label, or with a plain name a human chose.
 * Disjoint by construction rather than by luck, exactly as before, but now the common
 * label on every bead is simply `tbd`.
 *
 * The cost is Linear's one-label-per-group guarantee, which the group form gave for
 * free. It is a small loss: tbd asserts exactly one repository label per item, so the
 * invariant already holds from this side, and the group's other use — "show me
 * everything from any tbd repository" — is what the `tbd` marker is for.
 *
 * {@link TBD_LABEL_PREFIX} remains for tbd's occasional purposeful carriers
 * (`tbd:blocked`, `tbd:deferred`). Those are deliberately uncommon; the label on *every*
 * mirrored item is the bare marker.
 */

import type { ProviderSettings, RepoLabelSetting } from './provider-settings.js';
import { parseRepoSlug } from './permalink.js';

/**
 * Namespace for tbd's own purposeful carriers — `tbd:blocked`, `tbd:deferred`.
 *
 * Deliberately NOT where the origin marker lives: these mark specific conditions on
 * some items, whereas the marker is on every mirrored item and should read as plainly
 * as possible.
 */
export const TBD_LABEL_PREFIX = 'tbd:';

/**
 * The marker every mirrored item carries.
 *
 * Bare on purpose. It is the single most-seen label in the workspace, it is what the
 * documented `label is not tbd` filter names, and nothing forces it to be longer: the
 * repository labels carry the prefix instead (see {@link REPO_LABEL_PREFIX}).
 */
export const ORIGIN_LABEL = 'tbd';

/**
 * Prefix for the per-repository label, e.g. `repo:tbd`.
 *
 * The colon is load-bearing. Repository segments are sanitized to `[a-z0-9._-]`, so a
 * prefixed name can never equal a bare one — which is what keeps `repo:tbd` and the
 * `tbd` marker from being the same Linear label in a namespace that has no scoping.
 */
export const REPO_LABEL_PREFIX = 'repo:';

/**
 * Colors tbd asks for when it creates one of its own labels.
 *
 * Set only at creation, never on update: the color is a presentation choice, and once a
 * label exists it belongs to the workspace. Someone who recolors `tbd` to fit their own
 * scheme should not have it changed back on the next sync.
 *
 * The marker is deliberately the odd one out. It appears on every mirrored item, so it
 * is the one that has to be recognizable at a glance in a mixed board; the repository
 * labels are supporting detail and share a quieter tone.
 */
export function labelColorFor(name: string): string | undefined {
  if (name.startsWith(REPO_LABEL_PREFIX)) {
    return '#6B7280'; // slate — metadata, not a signal
  }
  if (name === `${TBD_LABEL_PREFIX}blocked`) {
    return '#EB5757'; // red, matching what "blocked" means everywhere else
  }
  if (name === `${TBD_LABEL_PREFIX}deferred`) {
    return '#F2C94C'; // amber: paused, not stopped
  }
  if (name === ORIGIN_LABEL || name.startsWith(TBD_LABEL_PREFIX)) {
    return '#556B2F'; // dark olive green: tbd's mark, distinct from Linear's own palette
  }
  return undefined;
}

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
    // but not the repository label sets `labels.repo: false` instead.
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
    labels.push(`${REPO_LABEL_PREFIX}${repoName}`);
  }
  return labels;
}

/**
 * Whether a label names a repository other than this one.
 *
 * Used by the inbound scan: a candidate carrying a sibling repository's label is that
 * repository's business, and importing it here would duplicate the bead on both sides of
 * a shared scope.
 */
export function isForeignRepoLabel(label: string, ownRepoName: string | undefined): boolean {
  if (!label.startsWith(REPO_LABEL_PREFIX)) {
    return false;
  }
  return label.slice(REPO_LABEL_PREFIX.length) !== ownRepoName;
}

/**
 * Whether a label is one tbd owns and needs, as opposed to one mirrored from a bead.
 *
 * The set is deliberately small and structural: the origin marker itself, anything in
 * the `tbd:` namespace (the status carriers, and mirrored bead labels under the prefixed
 * mode — those are only ever sent when the operator asked for them, so treating the
 * prefix as tbd-owned is right), and any `repo:` label.
 *
 * `originName` is consulted separately because an operator may rename the marker via
 * `labels.origin: <string>`, and a renamed marker is still tbd's.
 */
export function isTbdOwnedLabel(name: string, originName: string = ORIGIN_LABEL): boolean {
  return (
    name === originName ||
    name === ORIGIN_LABEL ||
    name.startsWith(TBD_LABEL_PREFIX) ||
    name.startsWith(REPO_LABEL_PREFIX)
  );
}
