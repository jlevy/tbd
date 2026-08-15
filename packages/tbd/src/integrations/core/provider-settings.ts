/**
 * Provider-settings resolution: the f08 groups, with the pre-f08 flat keys as fallback.
 *
 * The provider block grew one flat key at a time and ended up mixing five concerns as
 * siblings — where work goes, what is selected, how it is marked, who it maps to, and
 * how the operation runs. f08 groups them (`target` / `policy` / `labels` / `identity`)
 * so a future decision is a value inside an existing group rather than another flat
 * sibling.
 *
 * Reading has to tolerate both shapes for one release, for a specific reason: the
 * migration rewrites `.tbd/config.yml`, but that file is committed, so a teammate can be
 * running this build against a branch whose config still carries the old spelling. Every
 * consumer therefore reads through here rather than reaching into the config, and no
 * consumer needs to know which shape it got.
 *
 * Resolution is total: every field comes back with a value, so nothing downstream
 * branches on "which spelling was it".
 */

import { resolvePolicy } from './policy.js';
import type { PolicyConfigSlice } from './policy.js';

/**
 * Per-repository label setting: the literal `'auto'`, an explicit name, or `false` to
 * disable. Typed as `string | false` because `'auto' | string` collapses to `string`;
 * the sentinel is documented here rather than repeated in a union the compiler flattens.
 */
export type RepoLabelSetting = string | false;

/**
 * The provider-config slice these settings come from. Structural rather than a
 * provider-specific type so Linear and GitHub resolve identically.
 */
export interface ProviderConfigSlice extends PolicyConfigSlice {
  target?: { team_key?: string; project?: string; repo?: string };
  labels?: { origin?: boolean; repo?: RepoLabelSetting; mirror?: boolean; create?: boolean };
  identity?: { user_map?: Record<string, string> };

  // Pre-f08 spellings. Retained for reading only; the f08 migration moves them.
  team_key?: string;
  project?: string;
  repo?: string;
  max_nesting?: number;
  mirror_labels?: boolean;
  create_labels?: boolean;
  user_map?: Record<string, string>;
}

/** Everything a provider needs, with both config shapes already reconciled. */
export interface ProviderSettings {
  teamKey?: string;
  project?: string;
  repo?: string;
  /** Levels of sub-issue nesting to mirror. */
  maxNesting: number;
  /** Attach a plain `tbd` label to every mirrored issue. */
  originLabel: boolean;
  /** Per-repository label: `'auto'` derives from the git origin, `false` disables. */
  repoLabel: RepoLabelSetting;
  /** Push bead labels as tracker labels. */
  mirrorLabels: boolean;
  /** Create labels that do not yet exist in the team on push. */
  createLabels: boolean;
  userMap: Record<string, string>;
}

/**
 * Defaults live here, not in the schema, because the schema fields are optional so that
 * the f08 migration's moves stick. A default in the schema would re-materialize the flat
 * key on every parse and write it straight back beside the new group.
 */
const DEFAULTS = {
  maxNesting: 2,
  originLabel: true,
  repoLabel: 'auto' as RepoLabelSetting,
  mirrorLabels: false,
  createLabels: true,
};

/**
 * Resolve a provider's effective settings from either config shape.
 *
 * Precedence is new-shape-first in every case. A config carrying both spellings is
 * mid-migration or hand-edited; honouring the group means the value a reader sees
 * matches the shape the tooling writes.
 */
export function resolveProviderSettings(config: ProviderConfigSlice): ProviderSettings {
  const policy = resolvePolicy(config);

  return {
    teamKey: config.target?.team_key ?? config.team_key,
    project: config.target?.project ?? config.project,
    repo: config.target?.repo ?? config.repo,

    // max_nesting rode into policy.outbound in f08, so the resolved policy is the
    // primary source and the flat key is the fallback.
    maxNesting: policy.outbound.max_nesting ?? config.max_nesting ?? DEFAULTS.maxNesting,

    originLabel: config.labels?.origin ?? DEFAULTS.originLabel,
    repoLabel: config.labels?.repo ?? DEFAULTS.repoLabel,
    mirrorLabels: config.labels?.mirror ?? config.mirror_labels ?? DEFAULTS.mirrorLabels,
    createLabels: config.labels?.create ?? config.create_labels ?? DEFAULTS.createLabels,
    userMap: config.identity?.user_map ?? config.user_map ?? {},
  };
}
