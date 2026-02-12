/**
 * GitHub Issues/PR URL parsing, validation, and API operations.
 *
 * Provides functions to parse GitHub issue and pull request URLs, validate
 * them against the GitHub API via `gh` CLI, and perform status/label operations.
 * Both issues and PRs use the same /issues/ API endpoint under the hood.
 *
 * All GitHub API operations use `gh api` via child process, leveraging the
 * existing `gh` CLI that `ensure-gh-cli.sh` installs.
 *
 * See: plan-2026-02-10-external-issue-linking.md §1b
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

// =============================================================================
// URL Parsing
// =============================================================================

/**
 * Matches GitHub issue URLs: https://github.com/{owner}/{repo}/issues/{number}
 */
const GITHUB_ISSUE_RE = /^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/issues\/(\d+)$/;

/**
 * Matches GitHub PR URLs: https://github.com/{owner}/{repo}/pull/{number}
 */
const GITHUB_PR_RE = /^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)$/;

/**
 * Matches either GitHub issue or PR URLs.
 * Both are valid external issue links since PRs use the same /issues/ API.
 */
const GITHUB_ISSUE_OR_PR_RE = /^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/(?:issues|pull)\/(\d+)$/;

/**
 * A parsed GitHub issue reference. Works for both issues and PRs since
 * GitHub's /issues/ API handles both.
 */
export interface GitHubIssueRef {
  owner: string;
  repo: string;
  number: number;
  url: string;
}

/**
 * Parse a GitHub issue or PR URL into its components.
 * Accepts both /issues/ and /pull/ URLs.
 *
 * @returns The parsed reference, or null if the URL doesn't match
 */
export function parseGitHubIssueUrl(url: string): GitHubIssueRef | null {
  const match = GITHUB_ISSUE_OR_PR_RE.exec(url);
  if (!match) return null;
  return {
    owner: match[1]!,
    repo: match[2]!,
    number: parseInt(match[3]!, 10),
    url,
  };
}

/**
 * Check if a URL is a GitHub issue URL (not PR).
 */
export function isGitHubIssueUrl(url: string): boolean {
  return GITHUB_ISSUE_RE.test(url);
}

/**
 * Check if a URL is a GitHub PR URL.
 */
export function isGitHubPrUrl(url: string): boolean {
  return GITHUB_PR_RE.test(url);
}

/**
 * Check if a URL is a GitHub issue or PR URL.
 */
export function isGitHubIssueOrPrUrl(url: string): boolean {
  return GITHUB_ISSUE_OR_PR_RE.test(url);
}

/**
 * Format a GitHubIssueRef as a short string: "owner/repo#number"
 */
export function formatGitHubIssueRef(ref: GitHubIssueRef): string {
  return `${ref.owner}/${ref.repo}#${ref.number}`;
}

// =============================================================================
// GitHub API Operations
// =============================================================================

/**
 * Validate that a GitHub issue or PR exists and is accessible.
 *
 * @returns true if the issue/PR exists, false otherwise
 */
export async function validateGitHubIssue(ref: GitHubIssueRef): Promise<boolean> {
  try {
    await execFileAsync('gh', [
      'api',
      `/repos/${ref.owner}/${ref.repo}/issues/${ref.number}`,
      '--jq',
      '.number',
    ]);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the current state of a GitHub issue.
 */
export async function getGitHubIssueState(
  ref: GitHubIssueRef,
): Promise<{ state: string; state_reason: string | null; labels: string[] }> {
  const { stdout } = await execFileAsync('gh', [
    'api',
    `/repos/${ref.owner}/${ref.repo}/issues/${ref.number}`,
    '--jq',
    '{state: .state, state_reason: .state_reason, labels: [.labels[].name]}',
  ]);
  const data = JSON.parse(stdout) as {
    state: string;
    state_reason: string | null;
    labels: string[];
  };
  return data;
}

/**
 * Close a GitHub issue with a specific reason.
 */
export async function closeGitHubIssue(
  ref: GitHubIssueRef,
  reason: 'completed' | 'not_planned',
): Promise<void> {
  await execFileAsync('gh', [
    'api',
    '--method',
    'PATCH',
    `/repos/${ref.owner}/${ref.repo}/issues/${ref.number}`,
    '-f',
    'state=closed',
    '-f',
    `state_reason=${reason}`,
  ]);
}

/**
 * Reopen a GitHub issue.
 */
export async function reopenGitHubIssue(ref: GitHubIssueRef): Promise<void> {
  await execFileAsync('gh', [
    'api',
    '--method',
    'PATCH',
    `/repos/${ref.owner}/${ref.repo}/issues/${ref.number}`,
    '-f',
    'state=open',
  ]);
}

/**
 * Add a label to a GitHub issue. Creates the label on the repo if needed.
 */
export async function addGitHubLabel(ref: GitHubIssueRef, label: string): Promise<void> {
  // Step 1: Ensure the label exists on the repo (ignore 422 = already exists)
  try {
    await execFileAsync('gh', [
      'api',
      '--method',
      'POST',
      `/repos/${ref.owner}/${ref.repo}/labels`,
      '-f',
      `name=${label}`,
      '-f',
      'color=ededed',
    ]);
  } catch {
    // 422 = label already exists, which is fine
  }

  // Step 2: Add the label to the issue
  await execFileAsync('gh', [
    'api',
    '--method',
    'POST',
    `/repos/${ref.owner}/${ref.repo}/issues/${ref.number}/labels`,
    '-f',
    `labels[]=${label}`,
  ]);
}

/**
 * Remove a label from a GitHub issue.
 */
export async function removeGitHubLabel(ref: GitHubIssueRef, label: string): Promise<void> {
  try {
    await execFileAsync('gh', [
      'api',
      '--method',
      'DELETE',
      `/repos/${ref.owner}/${ref.repo}/issues/${ref.number}/labels/${encodeURIComponent(label)}`,
    ]);
  } catch {
    // Label not on issue — ignore
  }
}

// =============================================================================
// Status Mapping
// =============================================================================

/**
 * tbd → GitHub status mapping.
 * null means "no change" (e.g., `blocked` has no GitHub equivalent).
 */
export const TBD_TO_GITHUB_STATUS: Record<
  string,
  { state: 'open' | 'closed'; state_reason?: 'completed' | 'not_planned' } | null
> = {
  open: { state: 'open' },
  in_progress: { state: 'open' },
  blocked: null,
  deferred: { state: 'closed', state_reason: 'not_planned' },
  closed: { state: 'closed', state_reason: 'completed' },
};

/**
 * Map a GitHub issue state to a tbd status.
 *
 * @param state - GitHub state ('open' or 'closed')
 * @param stateReason - GitHub state_reason (null, 'completed', 'not_planned', 'duplicate', 'reopened')
 * @param currentTbdStatus - The bead's current tbd status
 * @returns The new tbd status, or null if no change is needed
 */
export function githubToTbdStatus(
  state: string,
  stateReason: string | null,
  currentTbdStatus: string,
): string | null {
  if (state === 'open') {
    // Only reopen if bead is closed or deferred
    if (currentTbdStatus === 'closed' || currentTbdStatus === 'deferred') {
      return 'open';
    }
    return null; // in_progress, blocked stay as-is
  }

  if (state === 'closed') {
    if (stateReason === 'not_planned') {
      if (currentTbdStatus !== 'deferred') return 'deferred';
      return null;
    }
    // completed, duplicate, or null reason → closed
    if (currentTbdStatus !== 'closed') return 'closed';
    return null;
  }

  return null;
}

/**
 * Compute the label diff between local and remote label sets.
 */
export function computeLabelDiff(
  localLabels: string[],
  remoteLabels: string[],
): { toAdd: string[]; toRemove: string[] } {
  const localSet = new Set(localLabels);
  const remoteSet = new Set(remoteLabels);

  const toAdd = localLabels.filter((l) => !remoteSet.has(l));
  const toRemove = remoteLabels.filter((l) => !localSet.has(l));

  return { toAdd, toRemove };
}
