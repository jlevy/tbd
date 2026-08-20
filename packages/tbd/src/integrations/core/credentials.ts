/**
 * Credential resolution for external tracker integrations.
 *
 * Credentials are read from the process environment, this working tree's `.env`,
 * or the main worktree's `.env`, and travel only through the `ResolvedCredential`
 * returned here. They are never written into `process.env` (see lib/env-file.ts
 * for why), never persisted to bridge state, and never logged or included in JSON
 * output.
 */

import { execFile } from 'node:child_process';
import { realpath } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';

import { ENV_FILE_NAME, readEnvFile } from '../../lib/env-file.js';
import { resolveMainWorktree } from '../../lib/paths.js';
import type { ProviderNameType } from '../../lib/types.js';

const execFileAsync = promisify(execFile);

/** Where a credential was found. Safe to display. */
export type CredentialSource = 'env' | 'dotenv' | 'gh-cli';

export interface ResolvedCredential {
  /** The secret. Never log, serialize, or include in command output. */
  value: string;
  source: CredentialSource;
  /**
   * Absolute path the value was read from, for `dotenv` only.
   *
   * A `.env` can now be loaded from outside the current directory, so the source
   * alone no longer identifies the file. Safe to display: it is a path, not a
   * secret, and naming it is what keeps a cross-directory read from being silent.
   */
  path?: string;
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
 * The main checkout's root, when it is a different directory than `repoRoot`.
 *
 * Returns undefined in the main checkout itself, where the fallback would reread
 * the file layer 2 already tried, and outside a repository, where there is no
 * main checkout to find.
 */
async function otherWorktreeRoot(repoRoot: string): Promise<string | undefined> {
  const mainWorktree = await resolveMainWorktree(repoRoot);
  if (!mainWorktree) {
    return undefined;
  }
  const here = await realpath(repoRoot).catch(() => repoRoot);
  return mainWorktree === here ? undefined : mainWorktree;
}

/**
 * Resolve a provider credential.
 *
 * Order, first match wins: process environment, this working tree's `.env`, the
 * main worktree's `.env`, then (GitHub only) the `gh` CLI. The process
 * environment wins so a one-off override does not require editing a file, and a
 * worktree's own `.env` beats the main checkout's so pointing one worktree at
 * different credentials stays possible.
 *
 * The main-worktree layer exists because `.env` is gitignored and gitignored
 * files do not propagate to linked worktrees, which made a configured repository
 * look unconfigured from any worktree of it. It is read-only: nothing here or in
 * setup writes to the main checkout's `.env`.
 *
 * Every layer past the first costs a git subprocess, so the common cases pay
 * nothing: an exported variable returns before any git call, and a worktree-local
 * `.env` returns before the main-worktree lookup.
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
    return { value: fromDotenv, source: 'dotenv', path: join(repoRoot, ENV_FILE_NAME) };
  }

  const mainWorktree = await otherWorktreeRoot(repoRoot);
  if (mainWorktree) {
    const mainDotenv = await readEnvFile(mainWorktree);
    const fromMainDotenv = mainDotenv.get(varName);
    if (fromMainDotenv && fromMainDotenv.length > 0) {
      return {
        value: fromMainDotenv,
        source: 'dotenv',
        path: join(mainWorktree, ENV_FILE_NAME),
      };
    }
  }

  if (provider === 'github') {
    const token = await ghCliToken();
    if (token) {
      return { value: token, source: 'gh-cli' };
    }
  }

  return undefined;
}
