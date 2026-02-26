/**
 * Sync-branch resolver utilities.
 *
 * This module separates canonical remote sync-branch identity from the
 * checkout-local sync branch that owns the hidden worktree.
 */

import { createHash } from 'node:crypto';
import { realpath } from 'node:fs/promises';
import { normalize, resolve } from 'node:path';

import type { Config } from '../lib/types.js';
import { WORKTREE_DIR } from '../lib/paths.js';
import { readLocalState, updateLocalState } from './config.js';
import { git, isBranchCheckedOutInOtherWorktree } from './git.js';

const MANAGED_BRANCH_MARKER = '--wt-';
const MAX_BRANCH_NAME_LENGTH = 255;

/**
 * Resolved sync branch refs for one checkout.
 */
export interface SyncBranchRefs {
  /** Git remote name that hosts the canonical sync branch. */
  remoteName: string;
  /** Canonical shared remote sync branch from config (e.g., tbd-sync). */
  remoteSyncBranch: string;
  /** Local branch used by this checkout's hidden worktree. */
  localSyncBranch: string;
  /** Source used to resolve localSyncBranch. */
  source: 'state' | 'canonical' | 'managed';
}

/**
 * Resolver behavior options.
 */
export interface ResolveSyncBranchRefsOptions {
  /** Persist resolved local branch to state.yml when true. */
  forWrite?: boolean;
}

/**
 * Build a deterministic per-checkout managed local branch name.
 */
export function makeManagedLocalBranchName(remoteSyncBranch: string, checkoutPath: string): string {
  const normalizedPath = normalize(resolve(checkoutPath));
  const fingerprint = createHash('sha1').update(normalizedPath).digest('hex').slice(0, 8);
  const suffix = `${MANAGED_BRANCH_MARKER}${fingerprint}`;
  const maxPrefixLength = MAX_BRANCH_NAME_LENGTH - suffix.length;
  const prefix =
    maxPrefixLength > 0 ? remoteSyncBranch.slice(0, maxPrefixLength) : remoteSyncBranch;
  return `${prefix}${suffix}`;
}

/**
 * Check if a local branch is a managed per-worktree branch for a canonical sync branch.
 */
export function isManagedLocalBranch(localBranch: string, remoteSyncBranch: string): boolean {
  return localBranch.startsWith(`${remoteSyncBranch}${MANAGED_BRANCH_MARKER}`);
}

/**
 * List all managed local branches for the canonical sync branch.
 */
export async function listManagedLocalBranches(
  baseDir: string,
  remoteSyncBranch: string,
): Promise<string[]> {
  try {
    const output = await git(
      '-C',
      baseDir,
      'for-each-ref',
      '--format=%(refname:short)',
      `refs/heads/${remoteSyncBranch}${MANAGED_BRANCH_MARKER}*`,
    );
    return output
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Resolve local + remote sync refs for this checkout/worktree.
 */
export async function resolveSyncBranchRefs(
  baseDir: string,
  config: Config,
  options?: ResolveSyncBranchRefsOptions,
): Promise<SyncBranchRefs> {
  const forWrite = options?.forWrite === true;
  const remoteName = config.sync.remote;
  const remoteSyncBranch = config.sync.branch;
  const worktreePath = joinWorktreePath(baseDir);

  const state = await readLocalState(baseDir);
  const stateBranch = state.local_sync_branch;

  if (stateBranch) {
    const stateBranchOccupiedElsewhere = await isBranchCheckedOutInOtherWorktree(
      baseDir,
      stateBranch,
      worktreePath,
    );
    if (!stateBranchOccupiedElsewhere) {
      return {
        remoteName,
        remoteSyncBranch,
        localSyncBranch: stateBranch,
        source: 'state',
      };
    }
  }

  const canonicalOccupiedElsewhere = await isBranchCheckedOutInOtherWorktree(
    baseDir,
    remoteSyncBranch,
    worktreePath,
  );
  if (!canonicalOccupiedElsewhere) {
    if (forWrite && stateBranch !== remoteSyncBranch) {
      await updateLocalState(baseDir, { local_sync_branch: remoteSyncBranch });
    }
    return {
      remoteName,
      remoteSyncBranch,
      localSyncBranch: remoteSyncBranch,
      source: 'canonical',
    };
  }

  const checkoutRealPath = await resolveCheckoutPath(baseDir);
  const baseManagedName = makeManagedLocalBranchName(remoteSyncBranch, checkoutRealPath);
  let selectedManaged = baseManagedName;
  for (let suffixIndex = 2; ; suffixIndex += 1) {
    const occupiedElsewhere = await isBranchCheckedOutInOtherWorktree(
      baseDir,
      selectedManaged,
      worktreePath,
    );
    if (!occupiedElsewhere) {
      break;
    }
    selectedManaged = appendManagedCollisionSuffix(baseManagedName, suffixIndex);
  }

  if (forWrite && stateBranch !== selectedManaged) {
    await updateLocalState(baseDir, { local_sync_branch: selectedManaged });
  }

  return {
    remoteName,
    remoteSyncBranch,
    localSyncBranch: selectedManaged,
    source: 'managed',
  };
}

/**
 * Resolve checkout path for stable fingerprinting.
 */
async function resolveCheckoutPath(baseDir: string): Promise<string> {
  try {
    return await realpath(baseDir);
  } catch {
    return normalize(resolve(baseDir));
  }
}

/**
 * Build hidden worktree path for this checkout.
 */
function joinWorktreePath(baseDir: string): string {
  return resolve(baseDir, WORKTREE_DIR);
}

/**
 * Append deterministic collision suffix while honoring branch length limits.
 */
function appendManagedCollisionSuffix(baseName: string, index: number): string {
  const suffix = `-${index}`;
  if (baseName.length + suffix.length <= MAX_BRANCH_NAME_LENGTH) {
    return `${baseName}${suffix}`;
  }
  return `${baseName.slice(0, MAX_BRANCH_NAME_LENGTH - suffix.length)}${suffix}`;
}
