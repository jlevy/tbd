/**
 * Credential resolution for external tracker integrations.
 *
 * Credentials are read from the process environment or the repository `.env`,
 * and travel only through the `ResolvedCredential` returned here. They are never
 * written into `process.env` (see lib/env-file.ts for why), never persisted to
 * bridge state, and never logged or included in JSON output.
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { readEnvFile } from '../../lib/env-file.js';
import type { ProviderNameType } from '../../lib/types.js';

const execFileAsync = promisify(execFile);

/** Where a credential was found. Safe to display. */
export type CredentialSource = 'env' | 'dotenv' | 'gh-cli';

export interface ResolvedCredential {
  /** The secret. Never log, serialize, or include in command output. */
  value: string;
  source: CredentialSource;
}

/** The environment variable each provider reads. */
export const CREDENTIAL_ENV_VARS: Record<ProviderNameType, string> = {
  linear: 'LINEAR_API_KEY',
  github: 'GITHUB_TOKEN',
};

/**
 * Render a credential for display: enough to tell two keys apart, not enough to
 * use. Short values are fully masked rather than partly revealed.
 */
export function maskSecret(value: string): string {
  const visible = 4;
  if (value.length <= visible * 2) {
    return '*'.repeat(8);
  }
  return `${'*'.repeat(8)}${value.slice(-visible)}`;
}

/**
 * Ask the GitHub CLI for its token, if it is installed and authenticated.
 *
 * Any failure (missing binary, not logged in) means "no credential from this
 * source", which is a normal state, so it returns undefined rather than throwing.
 */
async function ghCliToken(): Promise<string | undefined> {
  try {
    const { stdout } = await execFileAsync('gh', ['auth', 'token'], { timeout: 5_000 });
    const token = stdout.trim();
    return token.length > 0 ? token : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Resolve a provider credential.
 *
 * Order, first match wins: process environment, then repository `.env`, then
 * (GitHub only) the `gh` CLI. The process environment wins so a one-off override
 * does not require editing a file.
 */
export async function resolveCredential(
  provider: ProviderNameType,
  repoRoot: string,
): Promise<ResolvedCredential | undefined> {
  const varName = CREDENTIAL_ENV_VARS[provider];

  const fromEnv = process.env[varName];
  if (fromEnv && fromEnv.length > 0) {
    return { value: fromEnv, source: 'env' };
  }

  const dotenv = await readEnvFile(repoRoot);
  const fromDotenv = dotenv.get(varName);
  if (fromDotenv && fromDotenv.length > 0) {
    return { value: fromDotenv, source: 'dotenv' };
  }

  if (provider === 'github') {
    const token = await ghCliToken();
    if (token) {
      return { value: token, source: 'gh-cli' };
    }
  }

  return undefined;
}
