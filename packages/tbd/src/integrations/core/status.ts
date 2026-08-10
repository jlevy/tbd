/**
 * Integration readiness reporting.
 *
 * Every finding carries a remedy, because the common case for this command is a
 * user or agent who does not yet know what is missing. A repository with no
 * integration configured is a normal state, not an error, and must not require
 * a network call to report.
 */

import { checkEnvIgnored, ENV_FILE_NAME } from '../../lib/env-file.js';
import type { Config, ProviderNameType } from '../../lib/types.js';
import {
  CREDENTIAL_ENV_VARS,
  maskSecret,
  resolveCredential,
  type CredentialSource,
} from './credentials.js';
import { configuredProviders, type ProviderConfig } from './registry.js';

export type CheckState = 'ok' | 'warn' | 'error' | 'skipped';

export interface StatusFinding {
  label: string;
  state: CheckState;
  detail: string;
  /** What to do about it. Absent when the finding is `ok`. */
  remedy?: string;
}

export interface ProviderStatus {
  provider: ProviderNameType;
  enabled: boolean;
  findings: StatusFinding[];
}

export interface IntegrationStatus {
  /** True when nothing is configured, so every check was skipped. */
  inert: boolean;
  envFile: StatusFinding;
  providers: ProviderStatus[];
}

/** A probe that verifies a credential actually works. Injected so status can be
 * tested and so an offline run can skip it. */
export type ReachabilityProbe = (
  provider: ProviderNameType,
  credential: string,
  target: string | undefined,
) => Promise<{ ok: true; detail: string } | { ok: false; detail: string }>;

export interface StatusOptions {
  config: Config;
  repoRoot: string;
  /** Omit to skip network checks entirely. */
  probe?: ReachabilityProbe;
}

function describeSource(source: CredentialSource): string {
  switch (source) {
    case 'env':
      return 'process environment';
    case 'dotenv':
      return ENV_FILE_NAME;
    case 'gh-cli':
      return 'gh auth token';
  }
}

/**
 * Check `.env` safety.
 *
 * An unignored `.env` holding an API key is the highest-cost, lowest-visibility
 * failure in this feature, so it is reported as an error even though nothing is
 * broken yet.
 */
async function envFileFinding(repoRoot: string): Promise<StatusFinding> {
  const status = await checkEnvIgnored(repoRoot);
  if (!status.exists) {
    return {
      label: ENV_FILE_NAME,
      state: 'ok',
      detail: 'not present',
    };
  }
  if (!status.ignored) {
    return {
      label: ENV_FILE_NAME,
      state: 'error',
      detail: 'present and NOT gitignored',
      remedy: `Add ${ENV_FILE_NAME} to .gitignore before putting any credential in it. If a key was already committed, rotate it.`,
    };
  }
  return { label: ENV_FILE_NAME, state: 'ok', detail: 'present and gitignored' };
}

async function providerStatus(
  entry: ProviderConfig,
  repoRoot: string,
  probe?: ReachabilityProbe,
): Promise<ProviderStatus> {
  const findings: StatusFinding[] = [];
  const varName = CREDENTIAL_ENV_VARS[entry.provider];

  if (!entry.enabled) {
    findings.push({
      label: 'enabled',
      state: 'skipped',
      detail: 'configured but disabled',
      remedy: `Set integrations.${entry.provider}.enabled: true to use it.`,
    });
    return { provider: entry.provider, enabled: false, findings };
  }

  findings.push({ label: 'enabled', state: 'ok', detail: 'yes' });

  if (entry.configError) {
    findings.push({
      label: 'config',
      state: 'error',
      detail: entry.configError,
      remedy: `Set the missing value in .tbd/config.yml under integrations.${entry.provider}.`,
    });
  } else {
    findings.push({
      label: 'target',
      state: 'ok',
      detail: entry.target ?? 'unset',
    });
  }

  const credential = await resolveCredential(entry.provider, repoRoot);
  if (!credential) {
    findings.push({
      label: 'credential',
      state: 'error',
      detail: `${varName} not found`,
      remedy: `Set ${varName} in the environment or add it to ${ENV_FILE_NAME} (which must be gitignored).`,
    });
    return { provider: entry.provider, enabled: true, findings };
  }

  findings.push({
    label: 'credential',
    state: 'ok',
    // Enough to tell two keys apart, never enough to use.
    detail: `${maskSecret(credential.value)} from ${describeSource(credential.source)}`,
  });

  if (!probe) {
    findings.push({
      label: 'reachable',
      state: 'skipped',
      detail: 'network check not run',
    });
    return { provider: entry.provider, enabled: true, findings };
  }

  const result = await probe(entry.provider, credential.value, entry.target);
  findings.push(
    result.ok
      ? { label: 'reachable', state: 'ok', detail: result.detail }
      : {
          label: 'reachable',
          state: 'error',
          detail: result.detail,
          remedy: `Check that ${varName} is valid and that the configured target exists.`,
        },
  );

  return { provider: entry.provider, enabled: true, findings };
}

/**
 * Build the full integration status report.
 */
export async function integrationStatus(options: StatusOptions): Promise<IntegrationStatus> {
  const entries = configuredProviders(options.config);
  const envFile = await envFileFinding(options.repoRoot);

  const providers: ProviderStatus[] = [];
  for (const entry of entries) {
    providers.push(await providerStatus(entry, options.repoRoot, options.probe));
  }

  return { inert: entries.length === 0, envFile, providers };
}

/** True when any finding is an error, so a caller can set an exit code. */
export function hasErrors(status: IntegrationStatus): boolean {
  if (status.envFile.state === 'error') {
    return true;
  }
  return status.providers.some((provider) =>
    provider.findings.some((finding) => finding.state === 'error'),
  );
}
