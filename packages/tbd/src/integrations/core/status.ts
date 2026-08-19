/**
 * Integration readiness reporting.
 *
 * Every finding carries a remedy, because the common case for this command is a
 * user or agent who does not yet know what is missing. A repository with no
 * integration configured is a normal state, not an error, and must not require
 * a network call to report.
 */

import { dirname, join } from 'node:path';

import { checkEnvIgnored, ENV_FILE_NAME } from '../../lib/env-file.js';
import type { Config, ProviderNameType } from '../../lib/types.js';
import {
  CREDENTIAL_ENV_VARS,
  maskSecret,
  resolveCredential,
  type ResolvedCredential,
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

/**
 * Name where a credential came from.
 *
 * A `.env` is named by its full path, because resolution can reach the main
 * worktree's file and the bare name would not say which one answered. A path is
 * not a secret; the value beside it is already masked.
 */
function describeSource(credential: ResolvedCredential): string {
  switch (credential.source) {
    case 'env':
      return 'process environment';
    case 'dotenv':
      return credential.path ?? ENV_FILE_NAME;
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
async function envFileFinding(repoRoot: string, loadedFrom?: string): Promise<StatusFinding> {
  // Report on the file a credential actually came from. Once resolution can reach
  // the main worktree, checking only the current directory would vouch for a file
  // nobody read while the one in use went unexamined, which is how a committed key
  // stays invisible.
  const target = loadedFrom ? dirname(loadedFrom) : repoRoot;
  const where = loadedFrom ? ` (${loadedFrom})` : '';
  const status = await checkEnvIgnored(target);
  if (!status.exists) {
    if (!status.ignored) {
      return {
        label: ENV_FILE_NAME,
        state: 'warn',
        detail: `not present and not gitignored${where}`,
        remedy: `Add ${ENV_FILE_NAME} to .gitignore before creating it or putting any credential in it.`,
      };
    }
    return {
      label: ENV_FILE_NAME,
      state: 'ok',
      detail: `not present and gitignored${where}`,
    };
  }
  if (!status.ignored) {
    return {
      label: ENV_FILE_NAME,
      state: 'error',
      detail: `present and NOT gitignored${where}`,
      remedy: `Add ${ENV_FILE_NAME} to .gitignore before putting any credential in it. If a key was already committed, rotate it.`,
    };
  }
  return { label: ENV_FILE_NAME, state: 'ok', detail: `present and gitignored${where}` };
}

/** A provider's findings, plus the `.env` its credential came from, if any. */
interface ProviderStatusResult {
  status: ProviderStatus;
  envPath?: string;
}

async function providerStatus(
  entry: ProviderConfig,
  repoRoot: string,
  probe?: ReachabilityProbe,
): Promise<ProviderStatusResult> {
  const findings: StatusFinding[] = [];
  const varName = CREDENTIAL_ENV_VARS[entry.provider];

  if (!entry.enabled) {
    findings.push({
      label: 'enabled',
      state: 'skipped',
      detail: 'configured but disabled',
      remedy: `Set integrations.${entry.provider}.enabled: true to use it.`,
    });
    return { status: { provider: entry.provider, enabled: false, findings } };
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
    return { status: { provider: entry.provider, enabled: true, findings } };
  }

  findings.push({
    label: 'credential',
    state: 'ok',
    // Enough to tell two keys apart, never enough to use.
    detail: `${maskSecret(credential.value)} from ${describeSource(credential)}`,
  });
  const envPath = credential.source === 'dotenv' ? credential.path : undefined;

  if (!probe) {
    findings.push({
      label: 'reachable',
      state: 'skipped',
      detail: 'network check not run',
    });
    return {
      status: { provider: entry.provider, enabled: true, findings },
      ...(envPath ? { envPath } : {}),
    };
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

  return {
    status: { provider: entry.provider, enabled: true, findings },
    ...(envPath ? { envPath } : {}),
  };
}

/**
 * Build the full integration status report.
 */
export async function integrationStatus(options: StatusOptions): Promise<IntegrationStatus> {
  const entries = configuredProviders(options.config);

  const providers: ProviderStatus[] = [];
  const loadedFrom = new Set<string>();
  for (const entry of entries) {
    const result = await providerStatus(entry, options.repoRoot, options.probe);
    providers.push(result.status);
    if (result.envPath) {
      loadedFrom.add(result.envPath);
    }
  }

  // Providers run first so the safety check knows which file to examine. Only a
  // file outside this working tree needs naming; the local one is what the check
  // has always meant, and every provider that reaches outside reaches the same
  // main worktree, so at most one path qualifies.
  const localEnv = join(options.repoRoot, ENV_FILE_NAME);
  const external = [...loadedFrom].find((path) => path !== localEnv);
  const envFile = await envFileFinding(options.repoRoot, external);

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
