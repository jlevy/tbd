/**
 * Linking-policy resolution: presets, inline definitions, and the legacy
 * `select` fold.
 *
 * A policy answers three directional questions per integration: when a bead
 * should create a tracker issue (`outbound`), when a tracker issue should
 * become a bead (`inbound`), and how a linked pair's fields and comments flow
 * (`field_sync`). The names state their direction deliberately; `sync` is
 * reserved for the full synchronization the sync command performs.
 *
 * Resolution is total: every provider config resolves to a complete
 * `PolicyDefinition`, so nothing downstream ever branches on "policy absent".
 */

import { PolicyDefinitionSchema } from '../../lib/schemas.js';
import type { PolicyDefinition, PolicyNameType } from '../../lib/types.js';

/**
 * The provider-config slice policy resolution needs. Structural rather than a
 * provider-specific config type so Linear and GitHub resolve identically.
 */
export interface PolicyConfigSlice {
  policy?: PolicyNameType | PolicyDefinition;
  select?: unknown;
}

/**
 * Named presets, expanded through the schema so every preset is complete.
 *
 * `default` names the recommended practice: mirror major epics and beads with
 * active specs (typically ~10% of open work), report importable items rather
 * than auto-importing, and let linked pairs converge on every mapped field.
 */
const PRESETS: Record<PolicyNameType, PolicyDefinition> = {
  default: PolicyDefinitionSchema.parse({
    outbound: { specs: 'active' },
  }),
};

/** Expand a preset by name. */
export function presetPolicy(name: PolicyNameType): PolicyDefinition {
  return PRESETS[name];
}

/**
 * Resolve a provider's policy.
 *
 * - A preset name expands from the table.
 * - An inline definition is used as parsed (schema defaults fill the gaps).
 * - Absent means legacy: the Phase 1 `select` key becomes the outbound clause
 *   and everything else takes defaults, which preserves Phase 1 behavior
 *   exactly for existing configs.
 */
export function resolvePolicy(config: PolicyConfigSlice): PolicyDefinition {
  if (typeof config.policy === 'string') {
    return presetPolicy(config.policy);
  }
  if (config.policy !== undefined) {
    return config.policy;
  }
  return PolicyDefinitionSchema.parse({ outbound: config.select ?? {} });
}
