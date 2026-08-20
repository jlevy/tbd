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
 * Origin-label setting: `true` for the default name, a string to override it, `false` to
 * disable. Typed as `string | boolean` because `'tbd' | string` collapses to `string`.
 */
export type OriginLabelSetting = string | boolean;

/** How much of the repository's own bead labels to project. */
export type LabelMirrorModeType = 'none' | 'prefixed' | 'verbatim';

/** Which missing labels tbd may create on push. */
export type LabelCreateModeType = 'none' | 'tbd' | 'all';

/**
 * The provider-config slice these settings come from. Structural rather than a
 * provider-specific type so Linear and GitHub resolve identically.
 */
export interface ProviderConfigSlice extends PolicyConfigSlice {
  target?: { team_key?: string; project?: string; repo?: string };
  labels?: {
    origin?: OriginLabelSetting;
    repo?: RepoLabelSetting;
    mirror?: LabelMirrorModeType;
    create?: LabelCreateModeType;
  };
  identity?: {
    user_map?: Record<string, string>;
    state_map?: Record<string, string>;
    agent_map?: Record<string, string>;
  };

  // Pre-f08 spellings. Retained for reading only; the f08 migration moves them.
  team_key?: string;
  project?: string;
  repo?: string;
  max_nesting?: number;
  mirror_labels?: boolean;
  create_labels?: boolean;
  user_map?: Record<string, string>;
  state_map?: Record<string, string>;
  agent_map?: Record<string, string>;
}

/** Everything a provider needs, with both config shapes already reconciled. */
export interface ProviderSettings {
  teamKey?: string;
  project?: string;
  repo?: string;
  /** Levels of sub-issue nesting to mirror. */
  maxNesting: number;
  /** Origin marker: `true` for the default name, a string to override, `false` to skip. */
  originLabel: OriginLabelSetting;
  /** Per-repository label: `'auto'` derives from the git origin, `false` disables. */
  repoLabel: RepoLabelSetting;
  /** How to project the repository's own bead labels. */
  mirrorLabels: LabelMirrorModeType;
  /** Which missing labels tbd may create on push. */
  createLabels: LabelCreateModeType;
  userMap: Record<string, string>;
  /** Absent when the team needs no override; the resolver falls back to names. */
  stateMap?: Record<string, string>;
  /** Absent when no agent may publish; the common case. */
  agentMap?: Record<string, string>;
}

/**
 * Defaults live here, not in the schema, because the schema fields are optional so that
 * the f08 migration's moves stick. A default in the schema would re-materialize the flat
 * key on every parse and write it straight back beside the new group.
 */
const DEFAULTS = {
  maxNesting: 2,
  originLabel: true as OriginLabelSetting,
  repoLabel: 'auto' as RepoLabelSetting,
  mirrorLabels: 'none' as LabelMirrorModeType,
  createLabels: 'tbd' as LabelCreateModeType,
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
    // The pre-f08 booleans map onto the modes that preserve their behavior exactly:
    // `mirror_labels: true` always meant prefixed, and `create_labels: true` meant
    // create anything asked for. A fresh config gets the safer `tbd` default instead,
    // which is a deliberate change of default, not of the legacy meaning.
    mirrorLabels:
      config.labels?.mirror ??
      (config.mirror_labels === undefined
        ? DEFAULTS.mirrorLabels
        : config.mirror_labels
          ? 'prefixed'
          : 'none'),
    createLabels:
      config.labels?.create ??
      (config.create_labels === undefined
        ? DEFAULTS.createLabels
        : config.create_labels
          ? 'all'
          : 'none'),
    userMap: config.identity?.user_map ?? config.user_map ?? {},
    ...((config.identity?.state_map ?? config.state_map)
      ? { stateMap: config.identity?.state_map ?? config.state_map }
      : {}),
  };
}

/** Resolved posture for the integration fold inside plain `tbd sync`. */
export type SyncFoldModeType = 'auto' | 'guarded' | 'report' | 'off';

/** How a fold-mode translates into the runner's execution options. */
export interface SyncFoldPosture {
  /** Whether the fold runs at all. */
  runs: boolean;
  /** Plan and report without writing. */
  dryRun: boolean;
  /** Affirm the bulk thresholds rather than letting the guard refuse. */
  assumeYes: boolean;
}

/**
 * Resolve the integration fold mode from the integrations block.
 *
 * The pre-f08 boolean maps onto the two modes that preserve its behavior exactly:
 * `true` folded in with the bulk thresholds affirmed (`auto`), `false` kept providers
 * out of `tbd sync` entirely (`off`). The two new modes were unreachable before, so no
 * legacy value can produce them.
 *
 * The unset default is `guarded`, not `auto`. Enabling an integration is the opt-in to
 * folding it into `tbd sync`, but it is not an opt-in to a write of unbounded size, and
 * those are different consents. `guarded` differs from `auto` only above the bulk
 * thresholds, so an ordinary session-end sync of a few changed beads is unaffected; a
 * first sync that would create hundreds of issues stops and says so instead. That case
 * is exactly where the operator has the least idea what the policy selected.
 */
export function resolveSyncFoldMode(
  integrations: { on_tbd_sync?: SyncFoldModeType; sync_on_tbd_sync?: boolean } | undefined,
): SyncFoldModeType {
  if (!integrations) {
    return 'guarded';
  }
  if (integrations.on_tbd_sync !== undefined) {
    return integrations.on_tbd_sync;
  }
  if (integrations.sync_on_tbd_sync !== undefined) {
    return integrations.sync_on_tbd_sync ? 'auto' : 'off';
  }
  return 'guarded';
}

/**
 * The execution posture a fold mode implies.
 *
 * `assumeYes` is what the boolean used to hide: the folded run is non-interactive, so
 * the bulk guard either refuses an oversized run or is waived, and only `guarded` picks
 * the first. `report` waives it too — nothing is written, so there is nothing to guard.
 */
export function syncFoldPosture(mode: SyncFoldModeType): SyncFoldPosture {
  switch (mode) {
    case 'off':
      return { runs: false, dryRun: false, assumeYes: false };
    case 'report':
      return { runs: true, dryRun: true, assumeYes: true };
    case 'guarded':
      return { runs: true, dryRun: false, assumeYes: false };
    case 'auto':
      return { runs: true, dryRun: false, assumeYes: true };
  }
}
