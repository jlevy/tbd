/**
 * Git utilities for sync operations.
 *
 * Provides:
 * - Isolated index operations (protect user's staging area)
 * - Field-level merge algorithm
 * - Push retry with exponential backoff
 *
 * See: tbd-design.md §3.3 Sync Operations
 */

import { execFile } from 'node:child_process';

import { gitSafeEnv } from '../lib/git-env.js';
import { mkdir } from 'node:fs/promises';
import { promisify } from 'node:util';
import { basename, dirname, join, normalize } from 'node:path';

import { writeFile } from 'atomically';

import type { Issue } from '../lib/types.js';
import { now, nowFilenameTimestamp } from '../utils/time-utils.js';
import { parseIssue, serializeIssue } from './parser.js';
import { listIssues, writeIssue } from './storage.js';

const execFileAsync = promisify(execFile);

/**
 * Error thrown by {@link git} when a git command exits non-zero.
 *
 * Carries the process `exitCode` so callers can branch on git's exit status
 * (e.g. `ls-remote --exit-code` => 2 means "ref absent", `merge-base` => 1
 * means "no common ancestor") instead of string-matching stderr. The original
 * message/stderr is preserved so existing message-based classifiers
 * (classifySyncError) keep working.
 */
export class GitError extends Error {
  /** Process exit code, or null for a spawn failure (e.g. git not found). */
  readonly exitCode: number | null;
  readonly stderr: string;
  readonly stdout: string;
  readonly args: string[];
  /** True when an explicit execFile timeout terminated the command. */
  readonly timedOut: boolean;
  /** Configured timeout for this command, or null when no timeout was set. */
  readonly timeoutMs: number | null;

  constructor(
    message: string,
    opts: {
      exitCode: number | null;
      stderr: string;
      stdout: string;
      args: string[];
      timedOut?: boolean;
      timeoutMs?: number | null;
    },
  ) {
    super(message);
    this.name = 'GitError';
    this.exitCode = opts.exitCode;
    this.stderr = opts.stderr;
    this.stdout = opts.stdout;
    this.args = opts.args;
    this.timedOut = opts.timedOut ?? false;
    this.timeoutMs = opts.timeoutMs ?? null;
  }

  /**
   * Wrap a raw execFile rejection into a GitError.
   *
   * Node's execFile rejection carries `code` (numeric exit code for a normal
   * exit, or a string like 'ENOENT' for a spawn failure), plus `stderr`/`stdout`.
   */
  static from(err: unknown, args: string[], timeoutMs: number | null = null): GitError {
    const raw = err as {
      message?: string;
      code?: unknown;
      stderr?: unknown;
      stdout?: unknown;
      killed?: unknown;
    };
    const exitCode = typeof raw.code === 'number' ? raw.code : null;
    const stderr = typeof raw.stderr === 'string' ? raw.stderr : '';
    const stdout = typeof raw.stdout === 'string' ? raw.stdout : '';
    const timedOut = timeoutMs !== null && raw.killed === true;
    const message = timedOut
      ? `git ${args.join(' ')} timed out after ${timeoutMs} ms`
      : (raw.message ?? `git ${args.join(' ')} failed`);
    return new GitError(message, { exitCode, stderr, stdout, args, timedOut, timeoutMs });
  }
}

/**
 * Read the git exit code from a thrown value, or null if it is not a GitError
 * (or carries no numeric code, e.g. a spawn failure).
 */
export function exitCodeOf(err: unknown): number | null {
  return err instanceof GitError ? err.exitCode : null;
}

/**
 * Maximum buffer size for git command output.
 *
 * Node.js child_process.execFile() defaults to 1MB (1024 * 1024 bytes).
 * When exceeded, the child process is terminated with "stdout maxBuffer length exceeded".
 * Git commands like push/fetch with verbose output or diff on large changesets can exceed 1MB.
 *
 * See: https://nodejs.org/api/child_process.html#child_processexecfilefile-args-options-callback
 */
const GIT_MAX_BUFFER = 50 * 1024 * 1024; // 50MB

/**
 * Execute a git command and return stdout.
 * Uses execFile for security - prevents shell injection attacks.
 */
export async function git(...args: string[]): Promise<string> {
  try {
    const { stdout } = await execFileAsync('git', args, {
      maxBuffer: GIT_MAX_BUFFER,
      env: gitSafeEnv(),
    });
    return stdout.trim();
  } catch (err) {
    throw GitError.from(err, args);
  }
}

/**
 * Like {@link git} but with `GIT_TERMINAL_PROMPT=0` so a network operation
 * (e.g. a best-effort push) fails fast instead of blocking on a credential
 * prompt in a non-interactive environment.
 */
export async function gitNoPrompt(...args: string[]): Promise<string> {
  try {
    const { stdout } = await execFileAsync('git', args, {
      maxBuffer: GIT_MAX_BUFFER,
      env: gitSafeEnv({ GIT_TERMINAL_PROMPT: '0' }),
    });
    return stdout.trim();
  } catch (err) {
    throw GitError.from(err, args);
  }
}

/**
 * Like {@link gitNoPrompt}, but terminate the Git process after a positive timeout.
 * Network-facing callers should use this variant so a stalled transport cannot block
 * an unattended workflow forever.
 */
export async function gitNoPromptWithTimeout(
  timeoutMs: number,
  ...args: string[]
): Promise<string> {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) {
    throw new RangeError(`Git timeout must be a positive integer, got ${timeoutMs}`);
  }
  try {
    const { stdout } = await execFileAsync('git', args, {
      maxBuffer: GIT_MAX_BUFFER,
      timeout: timeoutMs,
      env: gitSafeEnv({ GIT_TERMINAL_PROMPT: '0' }),
    });
    return stdout.trim();
  } catch (err) {
    throw GitError.from(err, args, timeoutMs);
  }
}

/**
 * Run `git commit` in a worktree with gpg signing disabled at the command level.
 *
 * Internal tbd-sync commits are machine-generated data commits on the data branch,
 * not user commits. They must not depend on ambient `commit.gpgsign` config: in
 * signed-by-default environments without a usable signing key, an unguarded
 * `git commit` fails and leaves `tbd-sync` unborn, which the f04 fail-closed
 * health check then surfaces as "worktree corrupted" on every command.
 */
export async function gitCommit(workdir: string, ...args: string[]): Promise<string> {
  return git('-c', 'commit.gpgsign=false', '-C', workdir, 'commit', ...args);
}

// =============================================================================
// Git Version Detection
// See: plan spec §3.4 Git Integration Architecture
// =============================================================================

/**
 * Minimum Git version required.
 * Git 2.42 (August 2023) introduced `git worktree add --orphan` which tbd requires.
 */
export const MIN_GIT_VERSION = '2.42.0';

/**
 * Parsed Git version information.
 */
/**
 * Find the git repository root directory.
 * Uses `git rev-parse --show-toplevel` which returns the absolute path.
 *
 * @param cwd - Directory to start from (default: process.cwd())
 * @returns Absolute path to the git root, or null if not in a git repo
 */
export async function findGitRoot(cwd?: string): Promise<string | null> {
  try {
    const args = ['rev-parse', '--show-toplevel'];
    if (cwd) {
      args.unshift('-C', cwd);
    }
    return await git(...args);
  } catch {
    return null;
  }
}

/**
 * Check if the current directory is inside a git repository.
 */
export async function isInGitRepo(cwd?: string): Promise<boolean> {
  try {
    const args = ['rev-parse', '--is-inside-work-tree'];
    if (cwd) {
      args.unshift('-C', cwd);
    }
    const result = await git(...args);
    return result === 'true';
  } catch {
    return false;
  }
}

export interface GitVersion {
  major: number;
  minor: number;
  patch: number;
  raw: string;
}

/**
 * Get the installed Git version.
 *
 * @returns Parsed version information
 * @throws Error if git is not installed or version cannot be parsed
 */
export async function getGitVersion(): Promise<GitVersion> {
  const versionOutput = await git('--version');
  // Output format: "git version 2.42.0" or "git version 2.42.0.windows.1"
  const versionRegex = /git version (\d+)\.(\d+)\.(\d+)/;
  const match = versionRegex.exec(versionOutput);

  const major = match?.[1];
  const minor = match?.[2];
  const patch = match?.[3];

  if (!major || !minor || !patch) {
    throw new Error(`Unable to parse git version from: ${versionOutput}`);
  }

  return {
    major: parseInt(major, 10),
    minor: parseInt(minor, 10),
    patch: parseInt(patch, 10),
    raw: versionOutput,
  };
}

/**
 * Compare two version strings.
 *
 * @returns -1 if a < b, 0 if a === b, 1 if a > b
 */
export function compareVersions(a: GitVersion, b: string): number {
  const parts = b.split('.');
  const bMajor = parseInt(parts[0] ?? '0', 10);
  const bMinor = parseInt(parts[1] ?? '0', 10);
  const bPatch = parseInt(parts[2] ?? '0', 10);

  if (a.major !== bMajor) {
    return a.major < bMajor ? -1 : 1;
  }
  if (a.minor !== bMinor) {
    return a.minor < bMinor ? -1 : 1;
  }
  if (a.patch !== bPatch) {
    return a.patch < bPatch ? -1 : 1;
  }
  return 0;
}

/**
 * Check if the installed Git version meets minimum requirements.
 *
 * @returns Object with version info and whether it meets requirements
 * @throws Error with upgrade instructions if Git version is too old
 */
export async function checkGitVersion(): Promise<{
  version: GitVersion;
  supported: boolean;
}> {
  const version = await getGitVersion();
  const supported = compareVersions(version, MIN_GIT_VERSION) >= 0;
  return { version, supported };
}

/**
 * Require minimum Git version, throwing an error if not met.
 */
export async function requireGitVersion(): Promise<GitVersion> {
  const { version, supported } = await checkGitVersion();
  if (!supported) {
    throw new Error(getUpgradeInstructions(version));
  }
  return version;
}

/**
 * Get platform-specific upgrade instructions.
 * Points to official documentation rather than detailed commands for easier maintenance.
 */
function getUpgradeInstructions(currentVersion: GitVersion): string {
  const platform = process.platform;
  const versionStr = `${currentVersion.major}.${currentVersion.minor}.${currentVersion.patch}`;

  let upgradeUrl: string;
  switch (platform) {
    case 'darwin':
      upgradeUrl = 'https://git-scm.com/download/mac';
      break;
    case 'linux':
      upgradeUrl = 'https://git-scm.com/download/linux';
      break;
    case 'win32':
      upgradeUrl = 'https://git-scm.com/download/win';
      break;
    default:
      upgradeUrl = 'https://git-scm.com/downloads';
  }

  return `Git ${versionStr} detected. Git ${MIN_GIT_VERSION}+ required for tbd.\nUpgrade: ${upgradeUrl}`;
}

/**
 * Execute a git command with isolated index.
 * This protects the user's staging area during sync operations.
 *
 * See: tbd-design.md §3.3.2 Writing to Sync Branch
 */
export async function withIsolatedIndex<T>(fn: () => Promise<T>): Promise<T> {
  const gitDir = await git('rev-parse', '--git-dir');
  const isolatedIndex = join(gitDir, 'tbd-index');
  const originalIndex = process.env.GIT_INDEX_FILE;

  try {
    process.env.GIT_INDEX_FILE = isolatedIndex;
    return await fn();
  } finally {
    if (originalIndex) {
      process.env.GIT_INDEX_FILE = originalIndex;
    } else {
      delete process.env.GIT_INDEX_FILE;
    }
  }
}

/**
 * Commit changes to sync branch using isolated index.
 */
export async function commitToSyncBranch(
  syncBranch: string,
  message: string,
  files: string[],
): Promise<string> {
  return withIsolatedIndex(async () => {
    // Try to read existing tree from sync branch
    try {
      await git('read-tree', syncBranch);
    } catch {
      // Branch doesn't exist - start fresh
    }

    // Add changed files to index
    for (const file of files) {
      await git('add', file);
    }

    // Write tree object
    const tree = await git('write-tree');

    // Get parent commit if exists
    let parent: string | null = null;
    try {
      parent = await git('rev-parse', syncBranch);
    } catch {
      // No parent - orphan commit
    }

    // Create commit
    // Note: With execFile, we pass the message directly without shell quoting
    const commitArgs = ['commit-tree', tree, '-m', message];
    if (parent) {
      commitArgs.push('-p', parent);
    }

    const commit = await git(...commitArgs);

    // Update branch ref
    await git('update-ref', `refs/heads/${syncBranch}`, commit);

    return commit;
  });
}

/**
 * Field-level merge strategy types.
 */
type MergeStrategy = 'lww' | 'union' | 'max' | 'immutable' | 'namespace_merge';

/**
 * Field-level merge strategies for Issue fields.
 * See: tbd-design.md §3.5 Merge Rules
 */
const FIELD_STRATEGIES: Record<keyof Issue, MergeStrategy> = {
  // Immutable - never change after creation
  type: 'immutable',
  id: 'immutable',
  created_at: 'immutable',
  created_by: 'immutable',

  // LWW (Last-Write-Wins) - compare updated_at
  version: 'max',
  kind: 'lww',
  title: 'lww',
  description: 'lww',
  notes: 'lww',
  status: 'lww',
  priority: 'lww',
  assignee: 'lww',
  parent_id: 'lww',
  // Append-only set of child IDs (parent->child wiring). Must never lose a
  // concurrently-added child, so union (dedupe), not LWW. See issue #155.
  child_order_hints: 'union',
  updated_at: 'max',
  closed_at: 'lww',
  close_reason: 'lww',
  due_date: 'lww',
  deferred_until: 'lww',
  spec_path: 'lww',

  // Union - combine arrays, deduplicate
  labels: 'union',
  dependencies: 'union',

  // Merged per top-level namespace, not as one opaque value: two writers touching
  // different namespaces must both survive. Whole-object LWW here silently
  // dropped one side's namespace, which now matters more because external
  // tracker links live in these namespaces.
  extensions: 'namespace_merge',
};

/**
 * Strategy for a key that is not in {@link FIELD_STRATEGIES} — a field written by a
 * newer tbd that this one does not know about (f08+).
 *
 * LWW is the only defensible default. Union would silently corrupt a scalar into an
 * array, and immutable would freeze a field the owning version expects to update; LWW
 * at worst discards one side of a genuine concurrent edit, and records that in the
 * attic like any other LWW field. The alternative — dropping the key — is the data loss
 * f08 exists to stop.
 */
const UNKNOWN_FIELD_STRATEGY: MergeStrategy = 'lww';

/**
 * Keys present on any side of a merge that {@link FIELD_STRATEGIES} does not cover.
 *
 * Order is deterministic (sorted) so a merge is reproducible regardless of YAML key
 * order or which side introduced the key.
 */
function unknownIssueKeys(...sides: (Issue | null)[]): string[] {
  const known = new Set(Object.keys(FIELD_STRATEGIES));
  const seen = new Set<string>();
  for (const side of sides) {
    if (!side) {
      continue;
    }
    for (const key of Object.keys(side)) {
      if (!known.has(key)) {
        seen.add(key);
      }
    }
  }
  return [...seen].sort();
}

/**
 * Conflict entry for attic storage.
 */
export interface ConflictEntry {
  issue_id: string;
  field: string;
  timestamp: string;
  lost_value: unknown;
  winner_value: unknown;
  local_version: number;
  remote_version: number;
  resolution: 'lww' | 'union' | 'manual';
}

/**
 * Merge result with merged issue and any conflicts.
 */
export interface MergeResult {
  merged: Issue;
  conflicts: ConflictEntry[];
}

/**
 * Fields that are metadata-only and should be ignored when checking
 * for substantive changes between issues. These fields change on every
 * merge operation and don't represent meaningful content changes.
 */
const METADATA_ONLY_FIELDS: ReadonlySet<keyof Issue> = new Set(['version', 'updated_at']);

/**
 * Check if two issues are substantively equal, ignoring metadata fields
 * (version, updated_at) that change on every merge.
 *
 * This prevents trivial timestamp/version bumps from being treated as
 * real changes during outbox saves and sync operations.
 */
export function issuesSubstantivelyEqual(a: Issue, b: Issue): boolean {
  for (const key of Object.keys(FIELD_STRATEGIES) as (keyof Issue)[]) {
    if (METADATA_ONLY_FIELDS.has(key)) {
      continue;
    }
    if (!deepEqual(a[key], b[key])) {
      return false;
    }
  }
  // Unknown keys count too (f08+). Without this, an edit that touches only a field a
  // newer tbd added reads as "no change" and is never saved — the preserved key would
  // survive parsing and then quietly fail to persist.
  for (const key of unknownIssueKeys(a, b)) {
    if (!deepEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key])) {
      return false;
    }
  }
  return true;
}

/**
 * Deep equality check for values.
 */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) {
    return true;
  }
  if (a === null || b === null) {
    return a === b;
  }
  if (typeof a !== typeof b) {
    return false;
  }

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) {
      return false;
    }
    return a.every((item, i) => deepEqual(item, b[i]));
  }

  if (typeof a === 'object' && typeof b === 'object') {
    const aKeys = Object.keys(a);
    const bKeys = Object.keys(b);
    if (aKeys.length !== bKeys.length) {
      return false;
    }
    return aKeys.every((key) =>
      deepEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]),
    );
  }

  return false;
}

/**
 * Union arrays with deduplication.
 */
function unionArrays<T>(a: T[], b: T[]): T[] {
  const result = [...a];
  for (const item of b) {
    if (!result.some((existing) => deepEqual(existing, item))) {
      result.push(item);
    }
  }
  return result;
}

/**
 * Recorded in the attic when a namespace deletion lost to a concurrent edit.
 * Distinguishes "the deletion was discarded" from "a null value was discarded".
 */
export const DELETED_NAMESPACE = '<deleted>';

/**
 * A value that is a plain object (not an array, not null).
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Merge `extensions` one top-level namespace at a time.
 *
 * Namespaces are independent: two writers touching `github` and `linear` must
 * both survive. Only a namespace that both sides changed differently is a real
 * conflict, and only that namespace is reported lost.
 */
/** Outcome for one namespace: present with a value, or intentionally absent. */
type NamespaceResolution = { present: true; value: unknown } | { present: false };

/**
 * Merge one namespace three ways.
 *
 * Absence is a value here, not a gap: a namespace removed since the base was
 * *deleted* on purpose (`tbd integration unlink`), and a two-way presence check
 * cannot tell that apart from "the other side simply never had it". Getting this
 * wrong silently resurrects an unlinked bead, so deletion is treated as an edit
 * like any other.
 */
function resolveNamespace(
  namespace: string,
  base: Record<string, unknown>,
  local: Record<string, unknown>,
  remote: Record<string, unknown>,
  onConflict: (namespace: string, lost: unknown, winner: unknown) => void,
  localWins: boolean,
): NamespaceResolution {
  const inBase = Object.hasOwn(base, namespace);
  const inLocal = Object.hasOwn(local, namespace);
  const inRemote = Object.hasOwn(remote, namespace);

  const localChanged = inLocal ? !deepEqual(local[namespace], base[namespace]) || !inBase : inBase;
  const remoteChanged = inRemote
    ? !deepEqual(remote[namespace], base[namespace]) || !inBase
    : inBase;

  // Unchanged on both sides: carry the base through untouched.
  if (!localChanged && !remoteChanged) {
    return inBase ? { present: true, value: base[namespace] } : { present: false };
  }
  // Exactly one side edited: take that edit, including a deletion.
  if (localChanged && !remoteChanged) {
    return inLocal ? { present: true, value: local[namespace] } : { present: false };
  }
  if (remoteChanged && !localChanged) {
    return inRemote ? { present: true, value: remote[namespace] } : { present: false };
  }

  // Both edited. Agreement is not a conflict, including agreeing to delete.
  if (!inLocal && !inRemote) {
    return { present: false };
  }
  if (inLocal && inRemote && deepEqual(local[namespace], remote[namespace])) {
    return { present: true, value: local[namespace] };
  }

  // Delete on one side, edit on the other. Keep the edit: re-deleting is cheap,
  // whereas recovering a discarded link means hunting down the external issue.
  // The discarded deletion is still reported so it is not silent.
  if (!inLocal || !inRemote) {
    const survivor = inLocal ? local[namespace] : remote[namespace];
    onConflict(namespace, DELETED_NAMESPACE, survivor);
    return { present: true, value: survivor };
  }

  // Both sides are objects and at least one carries a `comments` array: the
  // sequences are append-only, so they union by identity instead of one side
  // losing. Two machines appending different comments is the NORMAL case for
  // comment sync, not a conflict — only divergence beyond `comments` is.
  const localNs = local[namespace];
  const remoteNs = remote[namespace];
  if (isPlainObject(localNs) && isPlainObject(remoteNs)) {
    const hasComments = Array.isArray(localNs.comments) || Array.isArray(remoteNs.comments);
    if (hasComments) {
      const winnerNs = localWins ? localNs : remoteNs;
      const loserNs = localWins ? remoteNs : localNs;
      const value = {
        ...winnerNs,
        comments: unionCommentArrays(localNs.comments, remoteNs.comments),
      };
      if (!deepEqual(omitComments(localNs), omitComments(remoteNs))) {
        onConflict(namespace, omitComments(loserNs), omitComments(winnerNs));
      }
      return { present: true, value };
    }
  }

  const winner = localWins ? local[namespace] : remote[namespace];
  const loser = localWins ? remote[namespace] : local[namespace];
  onConflict(namespace, loser, winner);
  return { present: true, value: winner };
}

/** A namespace value without its comments array, for beyond-comments compare. */
function omitComments(value: Record<string, unknown>): Record<string, unknown> {
  const { comments: _comments, ...rest } = value;
  return rest;
}

/**
 * Merge `extensions` one top-level namespace at a time.
 *
 * Namespaces are independent: two writers touching `github` and `linear` must
 * both survive. Only a namespace that both sides changed differently is a real
 * conflict, and only that namespace is reported lost.
 */
function mergeNamespaces(
  baseVal: unknown,
  localVal: unknown,
  remoteVal: unknown,
  onConflict: (namespace: string, lost: unknown, winner: unknown) => void,
  localWins: boolean,
): Record<string, unknown> {
  const base = isPlainObject(baseVal) ? baseVal : {};
  const local = isPlainObject(localVal) ? localVal : {};
  const remote = isPlainObject(remoteVal) ? remoteVal : {};

  const merged: Record<string, unknown> = {};
  // Base keys are included so a namespace deleted on one side is still visited.
  for (const namespace of new Set([
    ...Object.keys(base),
    ...Object.keys(local),
    ...Object.keys(remote),
  ])) {
    const resolution = resolveNamespace(namespace, base, local, remote, onConflict, localWins);
    if (resolution.present) {
      merged[namespace] = resolution.value;
    }
  }
  return merged;
}

/**
 * Create an attic entry for a conflict.
 */
function createConflictEntry(
  issueId: string,
  field: string,
  lostValue: unknown,
  winnerValue: unknown,
  localVersion: number,
  remoteVersion: number,
  resolution: 'lww' | 'union' | 'manual',
): ConflictEntry {
  const timestamp = nowFilenameTimestamp();

  return {
    issue_id: issueId,
    field,
    timestamp,
    lost_value: lostValue,
    winner_value: winnerValue,
    local_version: localVersion,
    remote_version: remoteVersion,
    resolution,
  };
}

/**
 * Three-way merge algorithm for issues.
 * See: tbd-design.md §3.4 Conflict Detection and Resolution
 *
 * @param base - Common ancestor (null if new issue)
 * @param local - Local version
 * @param remote - Remote version
 */
export function mergeIssues(base: Issue | null, local: Issue, remote: Issue): MergeResult {
  const conflicts: ConflictEntry[] = [];

  // If no base, check if these are versions of the same issue or independent creations
  if (!base) {
    const localTime = new Date(local.created_at).getTime();
    const remoteTime = new Date(remote.created_at).getTime();

    // Same created_at means same original creation - these are versions of the same issue
    // Use field-by-field merge instead of whole_issue conflict
    if (localTime === remoteTime) {
      // Use the one with the lower version as a synthetic base
      // This forces field-by-field comparison
      base = local.version <= remote.version ? local : remote;
      // Fall through to field-by-field merge below
    } else {
      // Different creation times - truly independent issues
      // Use whole_issue conflict (original behavior)
      if (localTime < remoteTime) {
        // Local was created first - it wins
        if (!deepEqual(local, remote)) {
          conflicts.push(
            createConflictEntry(
              remote.id,
              'whole_issue',
              remote,
              local,
              remote.version,
              local.version,
              'lww',
            ),
          );
        }
        return { merged: local, conflicts };
      } else {
        // Remote was created first - it wins
        if (!deepEqual(local, remote)) {
          conflicts.push(
            createConflictEntry(
              local.id,
              'whole_issue',
              local,
              remote,
              local.version,
              remote.version,
              'lww',
            ),
          );
        }
        return { merged: remote, conflicts };
      }
    }
  }

  // Field-by-field merge
  const merged = { ...base } as Issue;

  // Unknown keys (f08+) merge by the same rules, with a default strategy. Building the
  // pair list this way — rather than iterating FIELD_STRATEGIES alone — is what stops a
  // field a newer tbd added from being dropped here after the schema preserved it.
  const strategyPairs: [string, MergeStrategy][] = [
    ...Object.entries(FIELD_STRATEGIES),
    ...unknownIssueKeys(base, local, remote).map(
      (key) => [key, UNKNOWN_FIELD_STRATEGY] as [string, MergeStrategy],
    ),
  ];

  for (const [field, strategy] of strategyPairs) {
    const key = field as keyof Issue;
    const localVal = local[key];
    const remoteVal = remote[key];
    const baseVal = base[key];

    // Skip if both unchanged from base
    if (deepEqual(localVal, baseVal) && deepEqual(remoteVal, baseVal)) {
      continue;
    }

    // Only one changed - take changed value
    if (deepEqual(localVal, baseVal)) {
      (merged as Record<string, unknown>)[key] = remoteVal;
      continue;
    }
    if (deepEqual(remoteVal, baseVal)) {
      (merged as Record<string, unknown>)[key] = localVal;
      continue;
    }

    // Both changed - apply strategy
    switch (strategy) {
      case 'immutable':
        // Keep base value (shouldn't change)
        break;

      case 'lww': {
        // Only create conflicts when values actually differ (data is discarded)
        // See: tbd-design.md §3.5 "Attic entries are created only when a merge strategy discards data"
        if (deepEqual(localVal, remoteVal)) {
          // Values are identical - no conflict, use either one
          (merged as Record<string, unknown>)[key] = localVal;
          break;
        }

        // Values differ - apply LWW based on updated_at timestamps
        const localTime = new Date(local.updated_at).getTime();
        const remoteTime = new Date(remote.updated_at).getTime();

        if (localTime >= remoteTime) {
          (merged as Record<string, unknown>)[key] = localVal;
          conflicts.push(
            createConflictEntry(
              local.id,
              field,
              remoteVal,
              localVal,
              local.version,
              remote.version,
              'lww',
            ),
          );
        } else {
          (merged as Record<string, unknown>)[key] = remoteVal;
          conflicts.push(
            createConflictEntry(
              local.id,
              field,
              localVal,
              remoteVal,
              local.version,
              remote.version,
              'lww',
            ),
          );
        }
        break;
      }

      case 'union':
        // Combine arrays and deduplicate. Coerce non-array values (null /
        // undefined) to []: union fields like child_order_hints are nullable
        // (a cleared list is null), and union ignores deletions. See #155.
        (merged as Record<string, unknown>)[key] = unionArrays(
          (Array.isArray(localVal) ? localVal : []) as unknown[],
          (Array.isArray(remoteVal) ? remoteVal : []) as unknown[],
        );
        break;

      case 'max':
        // Take maximum value
        (merged as Record<string, unknown>)[key] = Math.max(
          localVal as number,
          remoteVal as number,
        );
        break;

      case 'namespace_merge': {
        // Per-namespace merge; only a namespace both sides changed conflicts.
        const nsLocalTime = new Date(local.updated_at).getTime();
        const nsRemoteTime = new Date(remote.updated_at).getTime();
        (merged as Record<string, unknown>)[key] = mergeNamespaces(
          baseVal,
          localVal,
          remoteVal,
          (namespace, lost, winner) => {
            conflicts.push(
              createConflictEntry(
                local.id,
                `${field}.${namespace}`,
                lost,
                winner,
                local.version,
                remote.version,
                'lww',
              ),
            );
          },
          nsLocalTime >= nsRemoteTime,
        );
        break;
      }
    }
  }

  // Check if the merge produced any substantive changes compared to the
  // highest-versioned input. If not, return that input as-is to avoid
  // gratuitous version/timestamp bumps that cause bulk outbox saves.
  const latest = local.version >= remote.version ? local : remote;
  if (issuesSubstantivelyEqual(merged, latest)) {
    // No substantive change - return the latest version without bumping
    return { merged: { ...latest }, conflicts };
  }

  // Actual substantive changes from merge - bump version
  merged.version = Math.max(local.version, remote.version) + 1;
  merged.updated_at = now();

  return { merged, conflicts };
}

/**
 * Issues bucketed by ULID/id across two (possibly unrelated) tbd-sync roots.
 */
export interface UlidBuckets {
  /** Present only locally; must be re-applied onto the adopted remote base. */
  localOnly: Issue[];
  /** Present only on the remote; already on the adopted base; nothing to do. */
  remoteOnly: Issue[];
  /** Same id, substantively equal; no action (remote version kept). */
  bothIdentical: Issue[];
  /** Same id, differing content; must be field-merged, never dropped. */
  bothDifferent: { local: Issue; remote: Issue }[];
}

/**
 * Categorize issues from two unrelated tbd-sync roots by id (which embeds the
 * globally unique ULID). Pure and git-free so the rescue is robust to the
 * missing merge base. Substantive equality ignores version/updated_at so
 * trivial bumps don't masquerade as conflicts.
 */
export function categorizeIssuesByUlid(local: Issue[], remote: Issue[]): UlidBuckets {
  const localById = new Map(local.map((i) => [i.id, i]));
  const remoteById = new Map(remote.map((i) => [i.id, i]));
  const buckets: UlidBuckets = {
    localOnly: [],
    remoteOnly: [],
    bothIdentical: [],
    bothDifferent: [],
  };

  for (const [id, localIssue] of localById) {
    const remoteIssue = remoteById.get(id);
    if (!remoteIssue) {
      buckets.localOnly.push(localIssue);
    } else if (issuesSubstantivelyEqual(localIssue, remoteIssue)) {
      buckets.bothIdentical.push(remoteIssue);
    } else {
      buckets.bothDifferent.push({ local: localIssue, remote: remoteIssue });
    }
  }
  for (const [id, remoteIssue] of remoteById) {
    if (!localById.has(id)) {
      buckets.remoteOnly.push(remoteIssue);
    }
  }
  return buckets;
}

/**
 * Maximum retry attempts for push operations.
 */
const MAX_PUSH_RETRIES = 3;

/**
 * Check if error is a non-fast-forward rejection (also the init race signal).
 */
function isNonFastForward(error: unknown): boolean {
  const msg =
    error instanceof GitError
      ? `${error.stderr}\n${error.message}`
      : error instanceof Error
        ? error.message
        : String(error);
  return /non-fast-forward|fetch first|rejected|updates were rejected/i.test(msg);
}

/**
 * Push result with retry information.
 */
export interface PushResult {
  success: boolean;
  attempt: number;
  conflicts?: ConflictEntry[];
  error?: string;
}

/**
 * Push with retry and merge on conflict.
 * See: tbd-design.md §3.3.3 Sync Algorithm
 *
 * @param syncBranch - The sync branch name
 * @param remote - The remote name
 * @param onMergeNeeded - Callback to merge remote changes
 * @param baseDir - Repository root directory (uses process.cwd() if not provided)
 */
export async function pushWithRetry(
  syncBranch: string,
  remote: string,
  onMergeNeeded: () => Promise<ConflictEntry[]>,
  baseDir?: string,
): Promise<PushResult> {
  // Use explicit refspec to avoid ambiguity with tags or other refs
  const refspec = `refs/heads/${syncBranch}:refs/heads/${syncBranch}`;
  // `--no-verify` for the same reason the sync-branch COMMITS use it: the
  // branch carries bead bookkeeping, never source code, so a parent repo's
  // pre-push gate (lefthook, husky) has nothing to say about it. Without this
  // every sync pays for that gate — a full test suite in this repository — and
  // the retry loop below pays for it again on each non-fast-forward.
  const pushArgs = ['push', '--no-verify', remote, refspec];
  // Build -C prefix args when baseDir is provided
  const dirArgs = baseDir ? ['-C', baseDir] : [];

  // Field-level conflicts accumulate across retries; they are informational
  // (the data is preserved in the attic) and must NOT abort the retry loop;
  // the merge that produced them has been committed, so the next push can
  // fast-forward. Surfaced on the final result for reporting.
  const allConflicts: ConflictEntry[] = [];

  for (let attempt = 1; attempt <= MAX_PUSH_RETRIES; attempt++) {
    try {
      // Try to push
      await git(...dirArgs, ...pushArgs);
      return {
        success: true,
        attempt,
        conflicts: allConflicts.length > 0 ? allConflicts : undefined,
      };
    } catch (error) {
      if (!isNonFastForward(error)) {
        // Unrecoverable error
        return {
          success: false,
          attempt,
          error: error instanceof Error ? error.message : String(error),
          conflicts: allConflicts.length > 0 ? allConflicts : undefined,
        };
      }

      if (attempt === MAX_PUSH_RETRIES) {
        return {
          success: false,
          attempt,
          error: `Push failed after ${MAX_PUSH_RETRIES} attempts. Remote has conflicting changes.`,
          conflicts: allConflicts.length > 0 ? allConflicts : undefined,
        };
      }

      // Fetch the advanced remote and integrate it (a real merge that commits),
      // so the next push fast-forwards. onMergeNeeded must advance local
      // `syncBranch` to include `${remote}/${syncBranch}`.
      await git(...dirArgs, 'fetch', remote, syncBranch);
      allConflicts.push(...(await onMergeNeeded()));

      // Loop to retry push.
    }
  }

  return { success: false, attempt: MAX_PUSH_RETRIES, error: 'Unexpected error in push retry' };
}

/**
 * Get the current branch name.
 */
export async function getCurrentBranch(baseDir?: string): Promise<string> {
  const dirArgs = baseDir ? ['-C', baseDir] : [];
  return git(...dirArgs, 'rev-parse', '--abbrev-ref', 'HEAD');
}

/**
 * Check if a branch exists locally.
 */
export async function branchExists(branch: string, baseDir?: string): Promise<boolean> {
  try {
    const dirArgs = baseDir ? ['-C', baseDir] : [];
    await git(...dirArgs, 'rev-parse', '--verify', `refs/heads/${branch}`);
    return true;
  } catch {
    return false;
  }
}

/**
 * Tri-state result of probing whether a remote branch exists.
 *
 * - `present`      ls-remote found the ref.
 * - `absent`       remote reachable, ref missing (ls-remote --exit-code => 2).
 * - `check-failed` the check itself failed (auth/network/transient).
 */
export type RemoteBranchProbe = 'present' | 'absent' | 'check-failed';

/**
 * Probe whether a remote branch exists, distinguishing a clean "absent" from a
 * "check failed".
 *
 * `git ls-remote --exit-code` exits 2 when the connection succeeded but no ref
 * matched; any other failure (auth/network/transient, or git not found) is a
 * check failure. Orphan-creating callers MUST branch on all three states and
 * never treat `check-failed` as `absent`; doing so risks creating a divergent
 * local branch when the remote is merely unreachable.
 */
export async function probeRemoteBranch(
  remote: string,
  branch: string,
  baseDir?: string,
): Promise<RemoteBranchProbe> {
  const dirArgs = baseDir ? ['-C', baseDir] : [];
  try {
    await git(...dirArgs, 'ls-remote', '--exit-code', remote, `refs/heads/${branch}`);
    return 'present';
  } catch (err) {
    return exitCodeOf(err) === 2 ? 'absent' : 'check-failed';
  }
}

/**
 * Check if a remote branch exists (fail-closed boolean wrapper).
 *
 * Returns true only for a confirmed `present`; both `absent` and `check-failed`
 * read as false. Retained for read-only / status-style callers (e.g. uninstall)
 * where fail-closed is acceptable. Orphan-creating paths MUST use
 * {@link probeRemoteBranch} directly so they can refuse on `check-failed`.
 */
export async function remoteBranchExists(
  remote: string,
  branch: string,
  baseDir?: string,
): Promise<boolean> {
  return (await probeRemoteBranch(remote, branch, baseDir)) === 'present';
}

/**
 * Get the remote URL.
 */
export async function getRemoteUrl(remote: string): Promise<string | null> {
  try {
    return await git('remote', 'get-url', remote);
  } catch {
    return null;
  }
}

// =============================================================================
// Worktree Management
// See: tbd-design.md §2.3 Hidden Worktree Model
// =============================================================================

import { access, rm, cp, readdir, readFile, realpath } from 'node:fs/promises';
import {
  WORKTREE_DIR_NAME,
  LEGACY_WORKTREE_DIR,
  TBD_DIR,
  DATA_SYNC_DIR,
  DATA_SYNC_DIR_NAME,
  SYNC_BRANCH,
  resolveSharedTbdPaths,
  type SharedTbdPaths,
} from '../lib/paths.js';
import { DATA_SYNC_SCHEMA_VERSION, LinkRecordSchema } from '../lib/schemas.js';
import type { LinkRecord } from '../lib/types.js';
import { parseYamlWithConflictDetection, stringifyYaml } from '../utils/yaml-utils.js';
import { unionCommentArrays } from '../lib/comment-union.js';
import {
  loadIdMapping,
  mergeIdMappings,
  reconcileMappings,
  parseIdMappingFromYaml,
  replaceRecoveredIdMapping,
  resolveIdMappingConflicts,
  saveIdMapping,
  type IdMapping,
} from './id-mapping.js';

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function pathsReferToSameLocation(a: string, b: string): Promise<boolean> {
  if (normalize(a) === normalize(b)) {
    return true;
  }
  try {
    return normalize(await realpath(a)) === normalize(await realpath(b));
  } catch {
    return false;
  }
}

async function getSharedPaths(baseDir: string): Promise<SharedTbdPaths> {
  return resolveSharedTbdPaths(baseDir);
}

/**
 * Check if the hidden worktree exists and is valid.
 */
export async function worktreeExists(baseDir: string): Promise<boolean> {
  const { sharedWorktreePath: worktreePath } = await getSharedPaths(baseDir);
  try {
    await access(worktreePath);
    // Also verify it's a valid git worktree by checking for .git file
    await access(join(worktreePath, '.git'));
    return true;
  } catch {
    return false;
  }
}

/**
 * Worktree health status values.
 * See: tbd-design.md §2.3.4 Worktree Health States
 */
export type WorktreeStatus = 'valid' | 'missing' | 'prunable' | 'corrupted';

/**
 * Worktree health status.
 */
export interface WorktreeHealth {
  /** Whether the worktree directory exists on disk */
  exists: boolean;
  /** Whether the worktree is valid and functional */
  valid: boolean;
  /** Detailed status: valid, missing, prunable, or corrupted */
  status: WorktreeStatus;
  /** The branch checked out in the worktree */
  branch: string | null;
  /** The commit HEAD points to */
  commit: string | null;
  /** Error message if status is not 'valid' */
  error?: string;
}

/**
 * Check worktree health and return status.
 * See: tbd-design.md §2.3 Worktree Lifecycle
 * See: plan-2026-01-28-sync-worktree-recovery-and-hardening.md §3
 */
export async function checkWorktreeHealth(
  baseDir: string,
  syncBranch: string = SYNC_BRANCH,
): Promise<WorktreeHealth> {
  const { sharedWorktreePath: worktreePath } = await getSharedPaths(baseDir);

  // First check if git reports the worktree as prunable
  // This catches the case where worktree directory was deleted but git still tracks it
  try {
    const worktreeList = await git('-C', baseDir, 'worktree', 'list', '--porcelain');

    // Check if our shared worktree path appears in the list as prunable
    const lines = worktreeList.split('\n');
    let foundWorktree = false;
    let isPrunable = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Check if this entry is for our worktree path
      if (
        line?.startsWith('worktree ') &&
        (await pathsReferToSameLocation(line.slice('worktree '.length), worktreePath))
      ) {
        foundWorktree = true;
        // Look for prunable marker in subsequent lines until next worktree entry
        for (let j = i + 1; j < lines.length && !lines[j]?.startsWith('worktree '); j++) {
          if (lines[j]?.startsWith('prunable')) {
            isPrunable = true;
            break;
          }
        }
        break;
      }
    }

    if (isPrunable) {
      return {
        exists: false,
        valid: false,
        status: 'prunable',
        branch: null,
        commit: null,
        error: 'Worktree directory was deleted but git still tracks it. Run: git worktree prune',
      };
    }

    // If git doesn't know about the worktree, check if directory exists
    if (!foundWorktree) {
      try {
        await access(worktreePath);
        // Directory exists but git doesn't know about it - corrupted
        return {
          exists: true,
          valid: false,
          status: 'corrupted',
          branch: null,
          commit: null,
          error: 'Worktree directory exists but is not registered with git',
        };
      } catch {
        // Directory doesn't exist and git doesn't know about it - missing
        return {
          exists: false,
          valid: false,
          status: 'missing',
          branch: null,
          commit: null,
        };
      }
    }
  } catch {
    // git worktree list failed - likely not in a git repo
    // Fall through to directory-based checks
  }

  // Check if worktree directory exists
  try {
    await access(worktreePath);
  } catch {
    return {
      exists: false,
      valid: false,
      status: 'missing',
      branch: null,
      commit: null,
    };
  }

  // Check if it's a valid git worktree
  try {
    await access(join(worktreePath, '.git'));
  } catch {
    return {
      exists: true,
      valid: false,
      status: 'corrupted',
      branch: null,
      commit: null,
      error: 'Worktree directory exists but is not a valid git worktree (missing .git)',
    };
  }

  // Get current commit and branch info
  try {
    const commit = await git('-C', worktreePath, 'rev-parse', 'HEAD');
    let branch: string | null = null;

    try {
      const refName = await git('-C', worktreePath, 'symbolic-ref', '-q', 'HEAD');
      branch = refName.replace('refs/heads/', '');
    } catch {
      branch = null;
    }

    if (branch !== syncBranch) {
      return {
        exists: true,
        valid: false,
        status: 'corrupted',
        branch,
        commit,
        error:
          branch === null
            ? `Shared worktree is detached; expected branch ${syncBranch}`
            : `Shared worktree is on ${branch}; expected branch ${syncBranch}`,
      };
    }

    return { exists: true, valid: true, status: 'valid', branch, commit };
  } catch (error) {
    return {
      exists: true,
      valid: false,
      status: 'corrupted',
      branch: null,
      commit: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

interface LegacyWorktreeMigrationResult {
  success: boolean;
  migrated: number;
  error?: string;
}

function isLegacyDataSyncWorktreePath(path: string, sharedWorktreePath: string): boolean {
  const normalized = normalize(path);
  if (normalized === normalize(sharedWorktreePath)) {
    return false;
  }

  return basename(normalized) === WORKTREE_DIR_NAME && basename(dirname(normalized)) === TBD_DIR;
}

async function listLegacyWorktreePaths(
  baseDir: string,
  sharedWorktreePath: string,
): Promise<string[]> {
  const paths = new Set<string>();

  try {
    const worktreeList = await git('-C', baseDir, 'worktree', 'list', '--porcelain');
    for (const line of worktreeList.split('\n')) {
      if (!line.startsWith('worktree ')) {
        continue;
      }
      const worktreePath = line.slice('worktree '.length);
      if (isLegacyDataSyncWorktreePath(worktreePath, sharedWorktreePath)) {
        paths.add(worktreePath);
      }
    }
  } catch {
    // If git cannot list worktrees, still inspect the current checkout legacy path below.
  }

  const currentCheckoutLegacyPath = join(baseDir, LEGACY_WORKTREE_DIR);
  if (
    currentCheckoutLegacyPath !== sharedWorktreePath &&
    (await pathExists(currentCheckoutLegacyPath))
  ) {
    paths.add(currentCheckoutLegacyPath);
  }

  return Array.from(paths);
}

async function preserveLegacyWorktreeHead(
  baseDir: string,
  legacyPath: string,
  syncBranch: string,
): Promise<void> {
  if (!(await pathExists(join(legacyPath, '.git')))) {
    return;
  }

  const status = await git('-C', legacyPath, 'status', '--porcelain').catch(() => '');
  if (status.trim()) {
    await git('-C', legacyPath, 'add', '-A');
    await gitCommit(legacyPath, '--no-verify', '-m', 'tbd: preserve legacy sync data').catch(
      (error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        if (!message.includes('nothing to commit')) {
          throw error;
        }
      },
    );
  }

  const head = await git('-C', legacyPath, 'rev-parse', 'HEAD').catch(() => '');
  if (!head) {
    return;
  }

  const branchHead = await git('-C', baseDir, 'rev-parse', syncBranch).catch(() => '');
  if (!branchHead) {
    await git('-C', baseDir, 'branch', syncBranch, head);
    return;
  }

  if (head === branchHead) {
    return;
  }

  const branchIsAncestor = await git('-C', baseDir, 'merge-base', '--is-ancestor', branchHead, head)
    .then(() => true)
    .catch(() => false);
  if (branchIsAncestor) {
    await git('-C', baseDir, 'update-ref', `refs/heads/${syncBranch}`, head);
    return;
  }

  const headIsAncestor = await git('-C', baseDir, 'merge-base', '--is-ancestor', head, branchHead)
    .then(() => true)
    .catch(() => false);
  if (headIsAncestor) {
    return;
  }

  const backupBranch = `tbd-legacy-preserve-${nowFilenameTimestamp()}`;
  await git('-C', baseDir, 'branch', backupBranch, head);
  throw new Error(
    `Legacy sync worktree at ${legacyPath} diverges from ${syncBranch}. ` +
      `Preserved its HEAD as ${backupBranch}; run 'tbd doctor --fix' after reviewing the backup branch.`,
  );
}

/**
 * Preserve and remove f03 per-checkout sync worktrees before creating the shared worktree.
 */
export async function migrateLegacyWorktreesToShared(
  baseDir: string,
  syncBranch: string = SYNC_BRANCH,
): Promise<LegacyWorktreeMigrationResult> {
  const { sharedWorktreePath } = await getSharedPaths(baseDir);
  const legacyPaths = await listLegacyWorktreePaths(baseDir, sharedWorktreePath);
  let migrated = 0;

  try {
    for (const legacyPath of legacyPaths) {
      await preserveLegacyWorktreeHead(baseDir, legacyPath, syncBranch);
      try {
        await git('-C', baseDir, 'worktree', 'remove', legacyPath, '--force');
      } catch {
        await rm(legacyPath, { recursive: true, force: true });
      }
      migrated += 1;
    }

    if (legacyPaths.length > 0) {
      await git('-C', baseDir, 'worktree', 'prune');
    }

    return { success: true, migrated };
  } catch (error) {
    return {
      success: false,
      migrated,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Whether the given remote is configured (has a URL) in the repo at baseDir.
 * A local-only repo (no remote) is safe to orphan and never pushes.
 */
async function remoteIsConfigured(remote: string, baseDir: string): Promise<boolean> {
  try {
    await git('-C', baseDir, 'config', '--get', `remote.${remote}.url`);
    return true;
  } catch {
    return false;
  }
}

/**
 * Whether the data-sync worktree carries any user issue files (is-<ulid>.md),
 * as opposed to only the initial orphan scaffold (.gitkeep / .gitattributes).
 */
async function worktreeHasUserIssues(dataSyncPath: string): Promise<boolean> {
  try {
    const entries = await readdir(join(dataSyncPath, 'issues'));
    return entries.some((name) => /^is-.*\.md$/.test(name));
  } catch {
    return false;
  }
}

/**
 * Push a freshly-created orphan tbd-sync immediately so "first init wins"
 * (closes the #137 race window). Classifies the outcome:
 *
 *  - success            => pushed: true ("first init wins").
 *  - transient/permanent network/auth failure => best-effort, ignored
 *    (branch stays local-only until the first reachable sync).
 *  - non-fast-forward rejection => a detected init race (environment B pushed
 *    its own orphan first). Fetch, then:
 *      - scaffold-only local  => adopt the remote (reset local to remote).
 *      - local has user issues => fail loudly toward `tbd doctor --fix` so the
 *        local work is never silently discarded.
 *
 * MUST be called after the orphan's initial commit, while the worktree is on
 * syncBranch.
 */
export async function pushFreshOrphan(
  baseDir: string,
  worktreePath: string,
  remote: string,
  syncBranch: string,
  dataSyncPath: string,
): Promise<{ pushed: boolean; adopted: boolean }> {
  try {
    // `--no-verify` for the same reason as pushWithRetry: the sync branch is
    // bead bookkeeping, not source, so parent-repo pre-push gates do not apply.
    await gitNoPrompt(
      '-C',
      worktreePath,
      'push',
      '--no-verify',
      remote,
      `HEAD:refs/heads/${syncBranch}`,
    );
    return { pushed: true, adopted: false };
  } catch (err) {
    if (!isNonFastForward(err)) {
      // Transient / permanent (restricted egress, no auth, network); the push
      // is best-effort and setup must not break. The window simply shrinks to
      // "until the first reachable sync".
      return { pushed: false, adopted: false };
    }

    // Detected init race: the remote already has a (different) branch.
    await gitNoPrompt('-C', baseDir, 'fetch', remote, syncBranch);

    if (await worktreeHasUserIssues(dataSyncPath)) {
      throw new Error(
        `Detected unrelated ${remote}/${syncBranch} histories during init, and the local ` +
          `branch already contains issues. Refusing to discard local work. ` +
          `Run \`tbd doctor --fix\` to reconcile the histories.`,
      );
    }

    // Scaffold-only local: adopt the remote as canonical ("first init wins").
    await git('-C', worktreePath, 'reset', '--hard', `${remote}/${syncBranch}`);
    return { pushed: false, adopted: true };
  }
}

const DATA_SYNC_RELATIVE_PATH = `${TBD_DIR}/${DATA_SYNC_DIR_NAME}`;
const GIT_PATH_BATCH_SIZE = 128;

async function writeScaffoldFileIfMissing(path: string, contents: string): Promise<boolean> {
  if (await pathExists(path)) {
    return false;
  }
  await writeFile(path, contents);
  return true;
}

/**
 * Materialize the current data-sync scaffold without disturbing legacy branch files.
 *
 * Older tbd releases could create a tbd-sync branch containing a repository snapshot
 * but no `.tbd/data-sync` directory. That branch is a valid Git worktree, so worktree
 * health checks alone cannot distinguish it from an initialized data branch. This
 * additive repair restores missing historical data when available, creates any remaining
 * scaffold files, and records the repair in one internal commit. Existing worktree files
 * are never overwritten.
 *
 * MUST be called while holding `withSharedDataSyncLock`.
 */
async function ensureDataSyncScaffold(baseDir: string): Promise<number> {
  const { sharedWorktreePath: worktreePath, sharedDataSyncDir: dataSyncPath } =
    await getSharedPaths(baseDir);
  const hasHead = await git('-C', worktreePath, 'rev-parse', '--verify', 'HEAD').then(
    () => true,
    () => false,
  );
  const scaffoldCommitted =
    hasHead &&
    (await git(
      '-C',
      worktreePath,
      'cat-file',
      '-e',
      `HEAD:${DATA_SYNC_RELATIVE_PATH}/meta.yml`,
    ).then(
      () => true,
      () => false,
    ));
  const repairedPaths: string[] = [];
  let recoveredHistoricalData = false;

  if (!scaffoldCommitted && hasHead) {
    const scaffoldCommits = await git(
      '-C',
      worktreePath,
      'rev-list',
      'HEAD',
      '--',
      DATA_SYNC_RELATIVE_PATH,
    );
    for (const commit of scaffoldCommits.split('\n').filter(Boolean)) {
      const hasHistoricalScaffold = await git(
        '-C',
        worktreePath,
        'cat-file',
        '-e',
        `${commit}:${DATA_SYNC_RELATIVE_PATH}/meta.yml`,
      ).then(
        () => true,
        () => false,
      );
      if (!hasHistoricalScaffold) {
        continue;
      }

      const historicalPaths = (
        await git(
          '-C',
          worktreePath,
          'ls-tree',
          '-r',
          '--name-only',
          commit,
          '--',
          DATA_SYNC_RELATIVE_PATH,
        )
      )
        .split('\n')
        .filter(Boolean);
      const missingPaths: string[] = [];
      for (const path of historicalPaths) {
        if (!(await pathExists(join(worktreePath, path)))) {
          missingPaths.push(path);
        }
      }
      if (missingPaths.length > 0) {
        for (let index = 0; index < missingPaths.length; index += GIT_PATH_BATCH_SIZE) {
          await git(
            '-C',
            worktreePath,
            'checkout',
            commit,
            '--',
            ...missingPaths.slice(index, index + GIT_PATH_BATCH_SIZE),
          );
        }
        repairedPaths.push(...missingPaths);
        recoveredHistoricalData = true;
      }
      break;
    }
  }

  await mkdir(join(dataSyncPath, 'issues'), { recursive: true });
  await mkdir(join(dataSyncPath, 'mappings'), { recursive: true });
  await mkdir(join(dataSyncPath, 'attic', 'conflicts'), { recursive: true });

  const scaffoldFiles = [
    {
      relative: `${DATA_SYNC_RELATIVE_PATH}/meta.yml`,
      contents: `schema_version: ${DATA_SYNC_SCHEMA_VERSION}\n`,
    },
    { relative: `${DATA_SYNC_RELATIVE_PATH}/issues/.gitkeep`, contents: '' },
    { relative: `${DATA_SYNC_RELATIVE_PATH}/mappings/.gitkeep`, contents: '' },
    {
      relative: `${DATA_SYNC_RELATIVE_PATH}/mappings/.gitattributes`,
      contents: 'ids.yml merge=union\n',
    },
  ];
  for (const file of scaffoldFiles) {
    if (await writeScaffoldFileIfMissing(join(worktreePath, file.relative), file.contents)) {
      repairedPaths.push(file.relative);
    }
  }

  if (repairedPaths.length === 0 && scaffoldCommitted) {
    return 0;
  }

  // A legacy repository snapshot on tbd-sync may carry the main branch's rule
  // that ignores `.tbd/data-sync`. These are tbd's managed data files, so force the
  // managed directory through that unrelated ignore rule. Staging the directory also
  // finishes an interrupted recovery whose files reached disk before its commit.
  await git('-C', worktreePath, 'add', '--force', '--', DATA_SYNC_RELATIVE_PATH);
  if (hasHead) {
    await gitCommit(
      worktreePath,
      '--no-verify',
      '--only',
      '-m',
      recoveredHistoricalData
        ? 'Restore missing tbd-sync data layout'
        : 'Initialize tbd-sync data layout',
      '--',
      DATA_SYNC_RELATIVE_PATH,
    );
  } else {
    await gitCommit(worktreePath, '--no-verify', '-m', 'Initialize tbd-sync branch');
  }
  return recoveredHistoricalData ? repairedPaths.length : 0;
}

/** Whether the required scaffold exists both in the worktree and its current commit. */
export async function isDataSyncScaffoldReady(baseDir: string): Promise<boolean> {
  const { sharedWorktreePath: worktreePath, sharedDataSyncDir: dataSyncPath } =
    await getSharedPaths(baseDir);
  if (!(await pathExists(join(dataSyncPath, 'meta.yml')))) {
    return false;
  }
  return git('-C', worktreePath, 'cat-file', '-e', `HEAD:${DATA_SYNC_RELATIVE_PATH}/meta.yml`).then(
    () => true,
    () => false,
  );
}

/**
 * Initialize the hidden worktree for the tbd-sync branch.
 * Follows the decision tree from tbd-design.md §2.3.
 *
 * MUST be called while holding `withSharedDataSyncLock`; it migrates legacy
 * per-checkout worktrees and creates the shared attached worktree on tbd-sync,
 * so concurrent callers can otherwise race branch ownership and migration.
 *
 * @param baseDir - The base directory of the repository
 * @param remote - The remote name (default: 'origin')
 * @param syncBranch - The sync branch name (default: 'tbd-sync')
 * @returns Path to the worktree or error message
 */
export async function initWorktree(
  baseDir: string,
  remote = 'origin',
  syncBranch: string = SYNC_BRANCH,
): Promise<{
  success: boolean;
  path?: string;
  created?: boolean;
  restoredDataFiles?: number;
  error?: string;
}> {
  const paths = await getSharedPaths(baseDir);
  const worktreePath = paths.sharedWorktreePath;

  // Check if worktree already exists and is valid
  if (await worktreeExists(baseDir)) {
    try {
      const restoredDataFiles = await ensureDataSyncScaffold(baseDir);
      return { success: true, path: worktreePath, created: false, restoredDataFiles };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  await mkdir(paths.sharedTbdDir, { recursive: true });

  // Preserve and remove old per-checkout sync worktrees before the shared
  // attached worktree claims the tbd-sync branch.
  const migrationResult = await migrateLegacyWorktreesToShared(baseDir, syncBranch);
  if (!migrationResult.success) {
    return { success: false, error: migrationResult.error };
  }

  // Remove any stale worktree directory
  try {
    await rm(worktreePath, { recursive: true, force: true });
  } catch {
    // Ignore errors - directory might not exist
  }

  try {
    // Check if local branch exists
    const localExists = await branchExists(syncBranch, baseDir);
    if (localExists) {
      // Create worktree on local branch (no --detach, so commits update the branch)
      // Note: Don't use --detach here - we want commits to update tbd-sync branch
      await git('-C', baseDir, 'worktree', 'add', worktreePath, syncBranch);
      const restoredDataFiles = await ensureDataSyncScaffold(baseDir);
      return { success: true, path: worktreePath, created: true, restoredDataFiles };
    }

    // Probe the remote. A configured-but-unreachable remote must NOT fall
    // through to orphan creation (that is how unrelated histories are born);
    // a local-only repo with no remote is safe to orphan and never pushes.
    const hasRemote = await remoteIsConfigured(remote, baseDir);
    const probe: RemoteBranchProbe = hasRemote
      ? await probeRemoteBranch(remote, syncBranch, baseDir)
      : 'absent';

    if (probe === 'check-failed') {
      return {
        success: false,
        error:
          `Could not verify whether ${remote}/${syncBranch} exists (remote check failed); ` +
          `refusing to create a divergent local branch. Check connectivity/auth and retry.`,
      };
    }

    if (probe === 'present') {
      // Fetch and create worktree from remote branch with local tracking branch
      await git('-C', baseDir, 'fetch', remote, syncBranch);
      // Use -b to create local branch tracking remote, not --detach
      // This ensures commits update the local branch which can then be pushed
      await git(
        '-C',
        baseDir,
        'worktree',
        'add',
        '-b',
        syncBranch,
        worktreePath,
        `${remote}/${syncBranch}`,
      );
      const restoredDataFiles = await ensureDataSyncScaffold(baseDir);
      return { success: true, path: worktreePath, created: true, restoredDataFiles };
    }

    // No branch exists (probe === 'absent') - create orphan worktree (requires Git 2.42+)
    // Syntax: git worktree add --orphan -b <branch> <path>
    await requireGitVersion();
    await git('-C', baseDir, 'worktree', 'add', '--orphan', '-b', syncBranch, worktreePath);

    // Initialize the data-sync directory structure in the worktree.
    const dataSyncPath = join(worktreePath, TBD_DIR, DATA_SYNC_DIR_NAME);
    let restoredDataFiles = await ensureDataSyncScaffold(baseDir);

    // Push the fresh orphan immediately so "first init wins" and the #137 race
    // window closes. Only when a remote is configured; best-effort on transient
    // failure, adopt-or-fail-loud on a detected rejected-race.
    if (hasRemote) {
      const pushResult = await pushFreshOrphan(
        baseDir,
        worktreePath,
        remote,
        syncBranch,
        dataSyncPath,
      );
      if (pushResult.adopted) {
        restoredDataFiles = await ensureDataSyncScaffold(baseDir);
      }
    }

    return { success: true, path: worktreePath, created: true, restoredDataFiles };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Update the hidden worktree to latest sync branch state.
 * Called after sync operations to ensure worktree reflects current state.
 *
 * @param baseDir - The base directory of the repository
 * @param remote - The remote name (default: 'origin')
 * @param syncBranch - The sync branch name (default: 'tbd-sync')
 */
export async function updateWorktree(
  baseDir: string,
  remote = 'origin',
  syncBranch: string = SYNC_BRANCH,
): Promise<{ success: boolean; error?: string }> {
  const { sharedWorktreePath: worktreePath } = await getSharedPaths(baseDir);

  // Ensure worktree exists
  if (!(await worktreeExists(baseDir))) {
    const initResult = await initWorktree(baseDir, remote, syncBranch);
    if (!initResult.success) {
      return { success: false, error: initResult.error };
    }
  }

  try {
    try {
      await git('-C', baseDir, 'fetch', remote, syncBranch);
    } catch {
      // Remote fetch may fail if offline - that's ok
    }

    await ensureWorktreeAttachedToBranch(worktreePath, syncBranch);

    const remoteRefExists = await git('-C', baseDir, 'rev-parse', `${remote}/${syncBranch}`)
      .then(() => true)
      .catch(() => false);
    if (remoteRefExists) {
      await git('-C', worktreePath, 'merge', '--ff-only', `${remote}/${syncBranch}`).catch(
        () => undefined,
      );
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// =============================================================================
// Branch Health Checks
// See: tbd-design.md §2.3 Hidden Worktree Model, plan spec §4b
// =============================================================================

/**
 * Local branch health status.
 */
export interface LocalBranchHealth {
  exists: boolean;
  orphaned: boolean;
  head?: string;
}

/**
 * Check local sync branch health.
 * See: plan-2026-01-28-sync-worktree-recovery-and-hardening.md §4b
 *
 * @param syncBranch - The sync branch name (default: 'tbd-sync')
 * @returns Health status indicating if branch exists and has commits
 */
export async function checkLocalBranchHealth(
  syncBranch: string = SYNC_BRANCH,
  baseDir?: string,
): Promise<LocalBranchHealth> {
  const dirArgs = baseDir ? ['-C', baseDir] : [];
  try {
    const head = await git(...dirArgs, 'rev-parse', `refs/heads/${syncBranch}`);
    return { exists: true, orphaned: false, head: head.trim() };
  } catch {
    // Check if branch ref exists but is orphaned (no commits)
    try {
      await git(...dirArgs, 'show-ref', '--verify', `refs/heads/${syncBranch}`);
      return { exists: true, orphaned: true };
    } catch {
      return { exists: false, orphaned: false };
    }
  }
}

/**
 * Remote branch health status.
 */
export interface RemoteBranchHealth {
  exists: boolean;
  diverged: boolean;
  /**
   * True when a local tbd-sync exists but shares no common ancestor with the
   * remote (merge-base finds nothing). This is the #139 worst case: push can
   * never fast-forward and a plain merge refuses. `diverged` is also true.
   */
  unrelated: boolean;
  head?: string;
}

/**
 * Check remote sync branch health.
 * See: plan-2026-01-28-sync-worktree-recovery-and-hardening.md §4b
 *
 * @param remote - The remote name (default: 'origin')
 * @param syncBranch - The sync branch name (default: 'tbd-sync')
 * @returns Health status indicating if remote branch exists and divergence state
 */
export async function checkRemoteBranchHealth(
  remote = 'origin',
  syncBranch: string = SYNC_BRANCH,
  baseDir?: string,
): Promise<RemoteBranchHealth> {
  const dirArgs = baseDir ? ['-C', baseDir] : [];
  try {
    await git(...dirArgs, 'fetch', remote, syncBranch);
    const head = await git(...dirArgs, 'rev-parse', `refs/remotes/${remote}/${syncBranch}`);
    const remoteHead = head.trim();

    // Determine divergence / unrelated state. Distinguish "no local branch"
    // (stays false/false) from "local exists but no common ancestor" (the
    // unrelated worst case); the old bare catch collapsed both to false.
    let diverged = false;
    let unrelated = false;
    if (await branchExists(syncBranch, baseDir)) {
      const localHead = (await git(...dirArgs, 'rev-parse', syncBranch)).trim();
      try {
        const mergeBase = (
          await git(...dirArgs, 'merge-base', syncBranch, `${remote}/${syncBranch}`)
        ).trim();
        // Diverged if merge-base is neither local nor remote HEAD.
        diverged = mergeBase !== localHead && mergeBase !== remoteHead;
      } catch (err) {
        // merge-base exits 1 with no output when the two commits share no
        // ancestor: unrelated histories. Any other exit is a transient/unknown
        // failure and must NOT masquerade as "unrelated".
        if (exitCodeOf(err) === 1) {
          unrelated = true;
          diverged = true;
        }
      }
    }

    return { exists: true, diverged, unrelated, head: remoteHead };
  } catch {
    return { exists: false, diverged: false, unrelated: false };
  }
}

/**
 * Sync consistency status.
 */
export interface SyncConsistency {
  /** Worktree HEAD commit SHA */
  worktreeHead: string;
  /** Local branch HEAD commit SHA */
  localHead: string;
  /** Remote branch HEAD commit SHA */
  remoteHead: string;
  /** Whether worktree HEAD matches local branch HEAD */
  worktreeMatchesLocal: boolean;
  /** Number of commits local is ahead of remote */
  localAhead: number;
  /** Number of commits local is behind remote */
  localBehind: number;
}

/**
 * Check consistency between worktree, local branch, and remote.
 * See: plan-2026-01-28-sync-worktree-recovery-and-hardening.md §4b
 *
 * @param baseDir - The base directory of the repository
 * @param syncBranch - The sync branch name (default: 'tbd-sync')
 * @param remote - The remote name (default: 'origin')
 * @returns Consistency status with HEAD comparisons and ahead/behind counts
 */
export async function checkSyncConsistency(
  baseDir: string,
  syncBranch: string = SYNC_BRANCH,
  remote = 'origin',
): Promise<SyncConsistency> {
  const { sharedWorktreePath: worktreePath } = await getSharedPaths(baseDir);

  // Get worktree HEAD
  const worktreeHead = await git('-C', worktreePath, 'rev-parse', 'HEAD').catch(() => '');

  // Get local branch HEAD
  const localHead = await git('-C', baseDir, 'rev-parse', syncBranch).catch(() => '');

  // Get remote branch HEAD
  const remoteHead = await git('-C', baseDir, 'rev-parse', `${remote}/${syncBranch}`).catch(
    () => '',
  );

  // Calculate ahead/behind counts
  let localAhead = 0;
  let localBehind = 0;

  if (localHead && remoteHead) {
    try {
      const aheadOutput = await git(
        '-C',
        baseDir,
        'rev-list',
        '--count',
        `${remote}/${syncBranch}..${syncBranch}`,
      );
      localAhead = parseInt(aheadOutput.trim(), 10) || 0;
    } catch {
      // Ignore errors
    }

    try {
      const behindOutput = await git(
        '-C',
        baseDir,
        'rev-list',
        '--count',
        `${syncBranch}..${remote}/${syncBranch}`,
      );
      localBehind = parseInt(behindOutput.trim(), 10) || 0;
    } catch {
      // Ignore errors
    }
  }

  return {
    worktreeHead: worktreeHead.trim(),
    localHead: localHead.trim(),
    remoteHead: remoteHead.trim(),
    worktreeMatchesLocal: worktreeHead.trim() === localHead.trim(),
    localAhead,
    localBehind,
  };
}

/**
 * Outcome of a non-destructive unrelated-history rescue.
 */
export interface RescueResult {
  /** Backup branch holding the pre-rescue local HEAD (always recoverable). */
  backupBranch: string;
  /** Number of local-only issues re-applied onto the adopted remote base. */
  localOnly: number;
  /** Number of same-id divergent issues field-merged. */
  merged: number;
  /** Number of those merges that preserved a losing version in attic/conflicts/. */
  conflicts: number;
  /** Total issue files after the rescue. */
  totalIssues: number;
}

/** Read all issues from a git ref's data-sync tree (no checkout needed). */
async function readBranchIssues(baseDir: string, ref: string): Promise<Issue[]> {
  let listing: string;
  try {
    listing = await git(
      '-C',
      baseDir,
      'ls-tree',
      '-r',
      '--name-only',
      ref,
      '--',
      `${DATA_SYNC_DIR}/issues/`,
    );
  } catch {
    return [];
  }
  const issues: Issue[] = [];
  for (const path of listing.split('\n').filter((p) => /\/is-.*\.md$/.test(p))) {
    try {
      const content = await git('-C', baseDir, 'show', `${ref}:${path}`);
      issues.push(parseIssue(content));
    } catch {
      // Skip unreadable/invalid issue files; rescue is best-effort per file.
    }
  }
  return issues;
}

/** Read the ID mapping from a git ref's ids.yml (empty if absent). */
async function readBranchMapping(baseDir: string, ref: string): Promise<IdMapping> {
  try {
    const content = await git('-C', baseDir, 'show', `${ref}:${DATA_SYNC_DIR}/mappings/ids.yml`);
    return parseIdMappingFromYaml(content);
  } catch {
    return { shortToUlid: new Map(), ulidToShort: new Map() };
  }
}

/**
 * Three-way merge a single bead read directly from git refs.
 *
 * Resolves the common ancestor with `git merge-base` and reads base/ours/theirs
 * from committed blobs (never the working tree), so a conflict-marker-corrupted
 * working file is never parsed. Feeds the field-level {@link mergeIssues} engine
 * a real base, which is what lets `union` fields (e.g. child_order_hints) combine
 * both sides instead of one side winning.
 *
 * Returns `null` when the bead does not exist on the `theirsRef` side (nothing to
 * merge, keep ours). Used by sync's conflict paths in place of git's line-based
 * text merge. See issue #155.
 *
 * @param repoDir - Directory to run git in (the data-sync worktree). `oursRef` and
 *   `theirsRef` (e.g. `HEAD`/`MERGE_HEAD`, or a branch and `origin/<branch>`) must
 *   resolve there.
 */
export async function mergeBeadAcrossRefs(
  repoDir: string,
  issueId: string,
  oursRef: string,
  theirsRef: string,
): Promise<MergeResult | null> {
  const path = `${DATA_SYNC_DIR}/issues/${issueId}.md`;

  const ours = parseIssue(await git('-C', repoDir, 'show', `${oursRef}:${path}`));

  // Read the other side's blob. A missing git object means the bead does not
  // exist there (nothing to merge, keep ours). A blob that EXISTS but fails to
  // parse is corruption (e.g. committed conflict markers) and must propagate to
  // the fail-loud path; never be silently treated as absent. So the git read
  // and the parse are separated: only git-object errors map to "absent". (#155)
  let theirsContent: string;
  try {
    theirsContent = await git('-C', repoDir, 'show', `${theirsRef}:${path}`);
  } catch (err) {
    if (err instanceof GitError) {
      return null;
    } // bead absent on the other side
    throw err;
  }
  const theirs = parseIssue(theirsContent);

  let baseSha = '';
  try {
    baseSha = (await git('-C', repoDir, 'merge-base', oursRef, theirsRef)).trim();
  } catch (err) {
    // Exit 1 = the refs share no common ancestor (unrelated histories); any
    // other exit status is a real failure and must propagate.
    if (exitCodeOf(err) !== 1) {
      throw err;
    }
  }

  let base: Issue | null = null;
  if (baseSha) {
    let baseContent: string | null = null;
    try {
      baseContent = await git('-C', repoDir, 'show', `${baseSha}:${path}`);
    } catch (err) {
      // Bead added independently on both sides (absent at the ancestor); no
      // base. A non-git error is unexpected and must propagate.
      if (!(err instanceof GitError)) {
        throw err;
      }
    }
    if (baseContent !== null) {
      base = parseIssue(baseContent);
    }
  }

  return mergeIssues(base, ours, theirs);
}

/**
 * Pick the newer observation of a link record.
 *
 * Both sides of a sync-branch merge are observations of the same external
 * truth (the tracker item), so the later observation wins outright — higher
 * `remote_updated_at`, then `synced_at`, then ours for determinism. This is
 * conflict-free by construction: no field-level merge, no attic, no report.
 */
export function pickNewestLinkRecord(ours: LinkRecord, theirs: LinkRecord): LinkRecord {
  if (ours.remote_updated_at !== theirs.remote_updated_at) {
    return ours.remote_updated_at > theirs.remote_updated_at ? ours : theirs;
  }
  if (ours.synced_at !== theirs.synced_at) {
    return ours.synced_at > theirs.synced_at ? ours : theirs;
  }
  return ours;
}

/** Read and validate a bridge link record blob from a git ref, or undefined. */
async function readLinkRecordBlob(
  repoDir: string,
  ref: string,
  path: string,
): Promise<LinkRecord | undefined> {
  let content: string;
  try {
    content = await git('-C', repoDir, 'show', `${ref}:${path}`);
  } catch (err) {
    if (err instanceof GitError) {
      return undefined; // absent on that side
    }
    throw err;
  }
  try {
    const parsed = LinkRecordSchema.safeParse(parseYamlWithConflictDetection(content));
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Resolve every conflicted bridge file left by a sync-branch merge.
 *
 * Bridge state lives under `DATA_SYNC_DIR/bridge/<provider>/`, one file per
 * link (plus intents and a meta cache), and git's text merge cannot resolve
 * concurrent updates to the same record. The rules, in order:
 *
 * - **Absence wins.** A side that deleted the file did so deliberately (an
 *   unlink, or an intent consumed by replay); recreating it would resurrect
 *   state someone removed. Mirrors the extensions namespace-merge rule.
 * - **Link records** (`links/*.yml`): the newest observation wins
 *   ({@link pickNewestLinkRecord}). An invalid side loses to a valid one; two
 *   invalid sides resolve to deletion, and the next sync re-seeds the base.
 * - **Anything else** (intents, meta cache): ours wins. Intent replay is
 *   idempotent and the meta cache refreshes on demand, so either side is fine.
 *
 * Called while a merge is in progress (MERGE_HEAD set), before the caller's
 * `add -A`; the conflict-marker safety check downstream would otherwise refuse
 * to commit these files at all.
 */
export async function resolveBridgeConflicts(
  worktreePath: string,
): Promise<{ resolved: number; deleted: number }> {
  const conflictedList = await git(
    '-C',
    worktreePath,
    'diff',
    '--name-only',
    '--diff-filter=U',
    '--',
    `${DATA_SYNC_DIR}/bridge`,
  );
  const paths = conflictedList
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  let resolved = 0;
  let deleted = 0;
  for (const path of paths) {
    const absolute = join(worktreePath, path);
    const isLinkRecord = /\/links\/[^/]+\.yml$/.test(path);

    if (isLinkRecord) {
      const ours = await readLinkRecordBlob(worktreePath, 'HEAD', path);
      const theirs = await readLinkRecordBlob(worktreePath, 'MERGE_HEAD', path);
      // A delete/modify conflict reads the deleted side as undefined only when
      // the blob is truly absent; distinguish "absent" from "present but
      // invalid" via ls-files stages: stage 2 = ours, stage 3 = theirs.
      const stages = await git('-C', worktreePath, 'ls-files', '-u', '--', path);
      const hasOurs = /\s2\t/.test(stages);
      const hasTheirs = /\s3\t/.test(stages);

      if (!hasOurs || !hasTheirs) {
        // Deleted on one side: absence wins.
        await rm(absolute, { force: true });
        deleted++;
      } else if (ours && theirs) {
        await writeFile(absolute, stringifyYaml(pickNewestLinkRecord(ours, theirs)));
        resolved++;
      } else if (ours || theirs) {
        await writeFile(absolute, stringifyYaml(ours ?? theirs));
        resolved++;
      } else {
        // Both sides present but unreadable: delete and let sync re-seed.
        await rm(absolute, { force: true });
        deleted++;
      }
      continue;
    }

    // Intents and meta: absence wins, else ours.
    const stages = await git('-C', worktreePath, 'ls-files', '-u', '--', path);
    const hasOurs = /\s2\t/.test(stages);
    const hasTheirs = /\s3\t/.test(stages);
    if (!hasOurs || !hasTheirs) {
      await rm(absolute, { force: true });
      deleted++;
    } else {
      const content = await git('-C', worktreePath, 'show', `HEAD:${path}`);
      await writeFile(absolute, content);
      resolved++;
    }
  }

  return { resolved, deleted };
}

/** Preserve a losing issue version explicitly under attic/conflicts/. */
async function preserveLosingVersion(dataSyncPath: string, loser: Issue): Promise<void> {
  const conflictsDir = join(dataSyncPath, 'attic', 'conflicts');
  await mkdir(conflictsDir, { recursive: true });
  const filename = `${loser.id}__${nowFilenameTimestamp()}.md`;
  await writeFile(join(conflictsDir, filename), serializeIssue(loser));
}

/**
 * Non-destructively rescue an unrelated tbd-sync history (#139).
 *
 * Reconciles at the issue-file layer (ULIDs guarantee no collisions), never via
 * a git history merge. Adopts the remote as the canonical base and replays
 * local work onto it. The only destructive step (the reset) happens AFTER a
 * backup branch is created, so the pre-rescue HEAD is always recoverable and
 * the rescue is restartable.
 *
 * MUST be called while holding `withSharedDataSyncLock`. A merge in progress
 * aborts the rescue; a merely-dirty worktree does not; its uncommitted
 * tbd-owned data-sync changes are committed first (so the backup branch captures
 * them), while any dirty path outside the data-sync tree aborts. See issue #158.
 */
export async function rescueUnrelatedHistory(
  baseDir: string,
  remote = 'origin',
  syncBranch: string = SYNC_BRANCH,
): Promise<RescueResult> {
  const { sharedWorktreePath: worktreePath, sharedDataSyncDir: dataSyncPath } =
    await getSharedPaths(baseDir);

  // Preconditions. A half-finished merge is a genuinely unsafe base to reset
  // over, so refuse it. But a merely-dirty worktree is tbd's own uncommitted
  // data-sync state (this worktree is dedicated to DATA_SYNC_DIR); commit it
  // first so the backup branch captures it faithfully and the reset is safe,
  // rather than refusing and sending the user into a sync ⇄ doctor loop. (#158)
  const mergeInProgress = await git('-C', worktreePath, 'rev-parse', '-q', '--verify', 'MERGE_HEAD')
    .then(() => true)
    .catch(() => false);
  if (mergeInProgress) {
    throw new Error(
      'Refusing to rescue: a merge is in progress in the tbd-sync worktree at ' +
        `${worktreePath}. Run \`git -C "${worktreePath}" merge --abort\`, then re-run ` +
        '`tbd doctor --fix`.',
    );
  }

  const dirty = (await git('-C', worktreePath, 'status', '--porcelain')).trim();
  if (dirty) {
    // Defensive: this worktree only ever holds DATA_SYNC_DIR. If anything
    // outside it is dirty, do not auto-commit foreign changes; refuse clearly.
    // Let git do the filtering (an exclude pathspec) rather than parse porcelain.
    const foreign = (
      await git('-C', worktreePath, 'status', '--porcelain', '--', '.', `:!${DATA_SYNC_DIR}`)
    ).trim();
    if (foreign) {
      throw new Error(
        'Refusing to rescue: the tbd-sync worktree has changes outside the data-sync ' +
          `tree:\n${foreign}\nRemove or commit them, then re-run \`tbd doctor --fix\`.`,
      );
    }
    await git('-C', worktreePath, 'add', '-A');
    await gitCommit(
      worktreePath,
      '--no-verify',
      '-m',
      'tbd rescue: snapshot uncommitted data-sync state before rescue',
    );
  }

  // 1. Fetch the remote so origin/<syncBranch> is current.
  await gitNoPrompt('-C', baseDir, 'fetch', remote, syncBranch);

  // Capture local state BEFORE the reset.
  const localIssues = await listIssues(dataSyncPath);
  const localMapping = await loadIdMapping(dataSyncPath);
  const remoteIssues = await readBranchIssues(baseDir, `${remote}/${syncBranch}`);
  const remoteMapping = await readBranchMapping(baseDir, `${remote}/${syncBranch}`);

  // 2. Safety net: a backup branch at the pre-rescue local HEAD.
  const localHead = (await git('-C', baseDir, 'rev-parse', syncBranch)).trim();
  const backupBranch = `tbd-backup-${nowFilenameTimestamp()}`;
  await git('-C', baseDir, 'branch', backupBranch, localHead);

  // 3. Categorize by ULID (pure; robust to the missing merge base).
  const buckets = categorizeIssuesByUlid(localIssues, remoteIssues);

  // 4. Adopt the remote as the canonical base (the only destructive step, now
  //    safely after the backup branch).
  await git('-C', worktreePath, 'reset', '--hard', `${remote}/${syncBranch}`);

  // 5. Replay local work onto the base.
  let conflicts = 0;
  for (const issue of buckets.localOnly) {
    await writeIssue(dataSyncPath, issue);
  }
  for (const { local, remote: remoteIssue } of buckets.bothDifferent) {
    // No common ancestor between unrelated roots, so mergeIssues has no
    // trustworthy base (with equal created_at it synthesizes one from the
    // lower-version side). Preserve EVERY substantively-different side that the
    // merge does not keep, so an edit is never silently dropped without an
    // attic artifact; independent of whether mergeIssues reported a field
    // conflict.
    const { merged } = mergeIssues(null, local, remoteIssue);
    await writeIssue(dataSyncPath, merged);
    for (const side of [local, remoteIssue]) {
      if (!issuesSubstantivelyEqual(side, merged)) {
        await preserveLosingVersion(dataSyncPath, side);
        conflicts++;
      }
    }
  }

  // Union the ID mappings (additive). The remote is the adopted canonical base,
  // so it MUST win short-ID collisions; give remoteMapping precedence so an
  // issue already on the shared remote keeps its public ID. reconcileMappings
  // then regenerates only the conflicting local-only mappings.
  const mergedMapping = mergeIdMappings(remoteMapping, localMapping);
  const allIssues = await listIssues(dataSyncPath);
  reconcileMappings(
    allIssues.map((i) => i.id),
    mergedMapping,
    remoteMapping,
  );
  await saveIdMapping(dataSyncPath, mergedMapping);

  // 6. Commit. The push is now a clean fast-forward over origin/<syncBranch>.
  // If adopting the remote base left nothing to reconcile (e.g. two
  // scaffold-only roots, or identical issue sets + mappings), the reset already
  // adopted the base successfully; skip the commit rather than failing on
  // "nothing to commit".
  await git('-C', worktreePath, 'add', '-A');
  const pending = (await git('-C', worktreePath, 'status', '--porcelain')).trim();
  if (pending) {
    await gitCommit(
      worktreePath,
      '--no-verify',
      '-m',
      `tbd rescue: adopt remote base + reconcile ${buckets.localOnly.length + buckets.bothDifferent.length} issue(s) ` +
        `(${buckets.localOnly.length} local-only, ${buckets.bothDifferent.length} merged)`,
    );
  }

  return {
    backupBranch,
    localOnly: buckets.localOnly.length,
    merged: buckets.bothDifferent.length,
    conflicts,
    totalIssues: allIssues.length,
  };
}

/**
 * Count issues on a remote sync branch without creating a worktree.
 * Used by doctor to show accurate statistics on fresh clones.
 *
 * @param remote - The remote name (default: 'origin')
 * @param syncBranch - The sync branch name (default: 'tbd-sync')
 * @returns Number of issue files on the remote branch, or null if branch doesn't exist
 */
export async function countRemoteIssues(
  remote = 'origin',
  syncBranch: string = SYNC_BRANCH,
  baseDir?: string,
): Promise<number | null> {
  const dirArgs = baseDir ? ['-C', baseDir] : [];
  try {
    // Fetch the remote branch first
    await git(...dirArgs, 'fetch', remote, syncBranch);

    // List all files in the remote branch
    const remoteBranch = `${remote}/${syncBranch}`;
    const output = await git(...dirArgs, 'ls-tree', '-r', '--name-only', remoteBranch);

    // Count issue files in the issues directory
    // Uses path constants to avoid hardcoded paths
    const issuesDir = `${TBD_DIR}/${DATA_SYNC_DIR_NAME}/issues/`;
    const lines = output.split('\n').filter(Boolean);
    const issueCount = lines.filter(
      (line) => line.startsWith(issuesDir) && line.endsWith('.md'),
    ).length;

    return issueCount;
  } catch {
    // Remote branch doesn't exist or fetch failed
    return null;
  }
}

/**
 * Remove the hidden worktree.
 * Used by doctor --fix when worktree is corrupted.
 */
export async function removeWorktree(
  baseDir: string,
): Promise<{ success: boolean; error?: string }> {
  const { sharedWorktreePath: worktreePath } = await getSharedPaths(baseDir);

  try {
    // First try to properly remove via git
    try {
      await git('-C', baseDir, 'worktree', 'remove', worktreePath, '--force');
    } catch {
      // If git worktree remove fails, just delete the directory
      await rm(worktreePath, { recursive: true, force: true });
    }

    // Prune stale worktree references
    await git('-C', baseDir, 'worktree', 'prune');

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Repair an unhealthy worktree.
 *
 * Follows decision tree from spec Appendix E:
 * - PRUNABLE: git worktree prune, then recreate
 * - CORRUPTED: backup to .tbd/backups/, remove, then recreate
 * - MISSING: just create
 *
 * MUST be called while holding `withSharedDataSyncLock`; repair mutates
 * shared worktree and branch state and shares the same locking contract as
 * `initWorktree`.
 *
 * See: plan-2026-01-28-sync-worktree-recovery-and-hardening.md
 *
 * @param baseDir - The base directory of the repository
 * @param status - Current worktree health status
 * @param remote - The remote name (default: 'origin')
 * @param syncBranch - The sync branch name (default: 'tbd-sync')
 */
export async function repairWorktree(
  baseDir: string,
  status: 'missing' | 'prunable' | 'corrupted',
  remote = 'origin',
  syncBranch: string = SYNC_BRANCH,
): Promise<{
  success: boolean;
  path?: string;
  backedUp?: string;
  restoredDataFiles?: number;
  error?: string;
}> {
  const { sharedWorktreePath: worktreePath, sharedBackupsDir } = await getSharedPaths(baseDir);

  try {
    // Always prune stale worktree entries first for missing and prunable states
    // This ensures git's worktree list is clean before creating a new worktree
    if (status === 'missing' || status === 'prunable') {
      await git('-C', baseDir, 'worktree', 'prune');
    }

    // Handle corrupted status: backup before removal
    if (status === 'corrupted') {
      await mkdir(sharedBackupsDir, { recursive: true });

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const backupPath = join(sharedBackupsDir, `corrupted-worktree-backup-${timestamp}`);

      // Copy corrupted worktree to backup before removal
      try {
        await cp(worktreePath, backupPath, { recursive: true });
      } catch {
        // If copy fails, the directory might not exist or be accessible
        // Continue with repair anyway
      }

      // Remove the corrupted worktree
      await rm(worktreePath, { recursive: true, force: true });
      await git('-C', baseDir, 'worktree', 'prune');

      // Initialize fresh worktree
      const result = await initWorktree(baseDir, remote, syncBranch);
      return { ...result, backedUp: backupPath };
    }

    // For missing or prunable (after prune), just initialize
    const result = await initWorktree(baseDir, remote, syncBranch);
    return result;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Ensure worktree is attached to sync branch, not detached HEAD.
 * Old tbd versions (pre-v0.1.9) created worktrees with --detach flag.
 * This repairs them automatically.
 *
 * @param worktreePath - Path to the worktree directory
 * @returns true if worktree was detached and repaired, false if already attached
 */
export async function ensureWorktreeAttached(worktreePath: string): Promise<boolean> {
  return ensureWorktreeAttachedToBranch(worktreePath, SYNC_BRANCH);
}

/**
 * Ensure worktree is attached to the requested sync branch, not detached HEAD.
 */
export async function ensureWorktreeAttachedToBranch(
  worktreePath: string,
  syncBranch: string = SYNC_BRANCH,
): Promise<boolean> {
  try {
    const currentBranch = await git('-C', worktreePath, 'branch', '--show-current').catch(() => '');

    if (currentBranch !== syncBranch) {
      await git('-C', worktreePath, 'checkout', syncBranch);
      return true; // Was detached, now repaired
    }

    return false; // Already attached to the requested branch
  } catch (error) {
    // If we can't check/fix, that's a problem but don't fail the operation
    console.warn('Warning: Could not check worktree HEAD status:', error);
    return false;
  }
}

/**
 * Migrate data from wrong location (.tbd/data-sync/) to worktree.
 *
 * Used when data was incorrectly written to the direct path instead of the worktree.
 * Per spec Appendix E:
 * 1. Backup to .tbd/backups/
 * 2. Copy issues/mappings from .tbd/data-sync/ to worktree
 * 3. Commit in worktree
 * 4. Optionally remove wrong location data
 *
 * See: plan-2026-01-28-sync-worktree-recovery-and-hardening.md
 *
 * @param baseDir - The base directory of the repository
 * @param removeSource - Whether to remove data from wrong location after migration
 */
export async function migrateDataToWorktree(
  baseDir: string,
  removeSource = false,
): Promise<{
  success: boolean;
  migratedCount: number;
  backupPath?: string;
  error?: string;
  /** Whether this run recorded a commit. False when already migrated. */
  committed?: boolean;
}> {
  const wrongPath = join(baseDir, TBD_DIR, DATA_SYNC_DIR_NAME);
  const {
    sharedDataSyncDir: correctPath,
    sharedWorktreePath: worktreePath,
    sharedBackupsDir,
  } = await getSharedPaths(baseDir);

  try {
    // Ensure worktree is attached to sync branch (repair old tbd repos)
    await ensureWorktreeAttached(worktreePath);
    // Check if there's data in the wrong location
    const wrongIssuesPath = join(wrongPath, 'issues');
    const wrongMappingsPath = join(wrongPath, 'mappings');

    let issueFiles: string[] = [];
    let mappingFiles: string[] = [];

    issueFiles = await readdir(wrongIssuesPath).catch(() => []);
    mappingFiles = await readdir(wrongMappingsPath).catch(() => []);

    // Filter out .gitkeep files
    issueFiles = issueFiles.filter((f) => f !== '.gitkeep');
    mappingFiles = mappingFiles.filter((f) => f !== '.gitkeep');

    if (issueFiles.length === 0 && mappingFiles.length === 0) {
      return { success: true, migratedCount: 0 };
    }

    // Step 1: Backup to .tbd/backups/
    await mkdir(sharedBackupsDir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const backupPath = join(sharedBackupsDir, `data-sync-backup-${timestamp}`);

    await cp(wrongPath, backupPath, { recursive: true });

    // Step 2: Copy issues and mappings to worktree
    const correctIssuesPath = join(correctPath, 'issues');
    const correctMappingsPath = join(correctPath, 'mappings');

    await mkdir(correctIssuesPath, { recursive: true });
    await mkdir(correctMappingsPath, { recursive: true });

    for (const file of issueFiles) {
      await cp(join(wrongIssuesPath, file), join(correctIssuesPath, file));
    }

    // Merge ID mappings instead of overwriting; ids.yml is append-only, so a
    // raw cp would destroy existing entries in the worktree. Import and use the
    // merge utilities so both source and destination entries are preserved.
    for (const file of mappingFiles) {
      if (file === 'ids.yml') {
        const sourceContent = await readFile(join(wrongMappingsPath, file), 'utf-8');
        const sourceMapping = resolveIdMappingConflicts(sourceContent);

        let targetMapping;
        try {
          const targetContent = await readFile(join(correctMappingsPath, file), 'utf-8');
          targetMapping = resolveIdMappingConflicts(targetContent);
        } catch {
          targetMapping = await loadIdMapping(correctPath);
        }

        const merged = mergeIdMappings(targetMapping, sourceMapping);
        await replaceRecoveredIdMapping(correctPath, merged);
      } else {
        await cp(join(wrongMappingsPath, file), join(correctMappingsPath, file));
      }
    }

    // Step 3: Commit in worktree (if there are changes)
    // Use --no-verify to bypass parent repo hooks (lefthook, husky, etc.)
    const totalFiles = issueFiles.length + mappingFiles.length;
    await git('-C', worktreePath, 'add', '-A');

    // Check if there are staged changes before committing
    const hasChanges = await git('-C', worktreePath, 'diff', '--cached', '--quiet')
      .then(() => false)
      .catch(() => true);

    let committed = false;
    if (hasChanges) {
      await gitCommit(
        worktreePath,
        '--no-verify',
        '-m',
        `tbd: migrate ${totalFiles} file(s) from incorrect location`,
      );
      committed = true;
    } else {
      // Nothing staged. That is legitimate when a previous run already migrated
      // and committed these files, and a bug in every other case: the copy
      // above would be unrecorded, and step 4 is about to delete the source.
      // Verify against the committed tree rather than assuming the benign case.
      const missing: string[] = [];
      for (const file of issueFiles) {
        const tracked = await git(
          '-C',
          worktreePath,
          'ls-files',
          '--error-unmatch',
          join(TBD_DIR, DATA_SYNC_DIR_NAME, 'issues', file),
        )
          .then(() => true)
          .catch(() => false);
        if (!tracked) {
          missing.push(file);
        }
      }
      if (missing.length > 0) {
        return {
          success: false,
          migratedCount: 0,
          backupPath,
          error:
            `Migration copied ${totalFiles} file(s) but committed nothing, and ` +
            `${missing.length} of them are absent from the sync branch ` +
            `(${missing.slice(0, 3).join(', ')}). Source files were left in place. ` +
            `The backup is at ${backupPath}.`,
        };
      }
    }

    // Step 4: Optionally remove wrong location data. Only reached once the files
    // are known to be recorded on the sync branch, so a failed commit cannot
    // take the source with it.
    if (removeSource) {
      // Remove issue and mapping files, but keep directory structure
      for (const file of issueFiles) {
        await rm(join(wrongIssuesPath, file));
      }
      for (const file of mappingFiles) {
        await rm(join(wrongMappingsPath, file));
      }
    }

    return {
      success: true,
      migratedCount: totalFiles,
      backupPath,
      committed,
    };
  } catch (error) {
    return {
      success: false,
      migratedCount: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
