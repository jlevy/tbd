/**
 * The provider registry.
 *
 * One place that knows which providers exist and how to read their configuration,
 * so commands iterate providers generically rather than special-casing Linear.
 */

import type { Config, PolicyDefinition, ProviderNameType } from '../../lib/types.js';
import { resolvePolicy } from './policy.js';

/** Every provider tbd knows about, in a stable display order. */
export const PROVIDERS: readonly ProviderNameType[] = ['linear', 'github'] as const;

/** A provider's configuration, normalized across providers. */
export interface ProviderConfig {
  provider: ProviderNameType;
  enabled: boolean;
  /**
   * The fully resolved linking policy. Always complete: a preset expands, an
   * inline definition fills defaults, and a legacy `select` folds into
   * `policy.outbound`.
   */
  policy: PolicyDefinition;
  maxNesting: number;
  /** The provider's target: a Linear team key or a GitHub `owner/repo`. */
  target?: string;
  /** Why the provider cannot be used, if it is configured but incomplete. */
  configError?: string;
}

/**
 * Read a provider's configuration.
 *
 * Returns undefined when the provider has no config block at all, which is
 * distinct from being present and disabled.
 */
export function providerConfig(
  config: Config,
  provider: ProviderNameType,
): ProviderConfig | undefined {
  const integrations = config.integrations;
  if (!integrations) {
    return undefined;
  }

  if (provider === 'linear') {
    const linear = integrations.linear;
    if (!linear) {
      return undefined;
    }
    return {
      provider,
      enabled: linear.enabled,
      policy: resolvePolicy(linear),
      maxNesting: linear.max_nesting,
      target: linear.team_key,
      configError:
        linear.enabled && !linear.team_key
          ? 'integrations.linear.team_key is required when Linear is enabled'
          : undefined,
    };
  }

  const github = integrations.github;
  if (!github) {
    return undefined;
  }
  return {
    provider,
    enabled: github.enabled,
    policy: resolvePolicy(github),
    maxNesting: github.max_nesting,
    target: github.repo,
    configError:
      github.enabled && !github.repo
        ? 'integrations.github.repo is required when GitHub is enabled'
        : undefined,
  };
}

/**
 * Every provider with a config block, in registry order.
 */
export function configuredProviders(config: Config): ProviderConfig[] {
  return PROVIDERS.map((provider) => providerConfig(config, provider)).filter(
    (entry): entry is ProviderConfig => entry !== undefined,
  );
}

/**
 * Every provider that is configured and switched on.
 */
export function enabledProviders(config: Config): ProviderConfig[] {
  return configuredProviders(config).filter((entry) => entry.enabled);
}

/**
 * True when no integration is enabled, so integration commands and checks stay
 * inert and offline.
 */
export function integrationsInert(config: Config): boolean {
  return enabledProviders(config).length === 0;
}
