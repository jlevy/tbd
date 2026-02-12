/**
 * External issue synchronization: pull/push status and labels between
 * local beads and linked GitHub Issues/PRs.
 *
 * Pull: read GitHub issue/PR state → update local bead status
 * Push: read local bead status → update GitHub issue/PR state
 *
 * Uses the staging-area model: local create/update/close have no external
 * side effects. External sync only happens during `tbd sync`.
 *
 * See: plan-2026-02-10-external-issue-linking.md §3b
 */

import type { Issue } from '../lib/types.js';
import type { OperationLogger } from '../lib/types.js';
import {
  parseGitHubIssueUrl,
  getGitHubIssueState,
  closeGitHubIssue,
  reopenGitHubIssue,
  addGitHubLabel,
  removeGitHubLabel,
  computeLabelDiff,
  githubToTbdStatus,
  TBD_TO_GITHUB_STATUS,
  type GitHubIssueRef,
} from './github-issues.js';

// =============================================================================
// Types
// =============================================================================

export interface ExternalSyncResult {
  pulled: number;
  pushed: number;
  labelsPulled: number;
  labelsPushed: number;
  errors: string[];
}

// =============================================================================
// External Pull
// =============================================================================

/**
 * Pull: fetch GitHub issue states and labels, update local beads.
 *
 * For each bead with an external_issue_url:
 * 1. Parse the GitHub issue URL
 * 2. Fetch the current GitHub issue state and labels
 * 3. Map GitHub state to tbd status and merge labels (union semantics)
 * 4. Update the bead if status or labels changed
 *
 * @returns Number of beads updated and any errors
 */
export async function externalPull(
  issues: Issue[],
  writeIssueFn: (issue: Issue) => Promise<void>,
  timestamp: string,
  logger: OperationLogger,
): Promise<{ pulled: number; labelsPulled: number; errors: string[] }> {
  const linked = issues.filter((i) => i.external_issue_url);
  if (linked.length === 0) {
    return { pulled: 0, labelsPulled: 0, errors: [] };
  }

  logger.progress(`Checking ${linked.length} linked issue(s)...`);
  let pulled = 0;
  let labelsPulled = 0;
  const errors: string[] = [];

  for (const issue of linked) {
    const ref = parseGitHubIssueUrl(issue.external_issue_url!);
    if (!ref) {
      errors.push(`${issue.id}: invalid external_issue_url: ${issue.external_issue_url}`);
      continue;
    }

    try {
      const ghState = await getGitHubIssueState(ref);
      let changed = false;

      // Status sync
      const newStatus = githubToTbdStatus(ghState.state, ghState.state_reason, issue.status);
      if (newStatus) {
        logger.info(`${issue.id}: ${issue.status} → ${newStatus} (from GitHub)`);
        issue.status = newStatus as Issue['status'];
        if (newStatus === 'closed') {
          issue.closed_at = timestamp;
        }
        changed = true;
        pulled++;
      }

      // Label sync: pull new labels from GitHub (union semantics)
      const localSet = new Set(issue.labels);
      const newLabels = ghState.labels.filter((l) => !localSet.has(l));
      if (newLabels.length > 0) {
        logger.info(
          `${issue.id}: pulling ${newLabels.length} label(s) from GitHub: ${newLabels.join(', ')}`,
        );
        issue.labels = [...issue.labels, ...newLabels];
        changed = true;
        labelsPulled += newLabels.length;
      }

      if (changed) {
        issue.version += 1;
        issue.updated_at = timestamp;
        await writeIssueFn(issue);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${issue.id}: failed to fetch GitHub state: ${msg}`);
      logger.warn(`${issue.id}: ${msg}`);
    }
  }

  return { pulled, labelsPulled, errors };
}

// =============================================================================
// External Push
// =============================================================================

/**
 * Push: push local bead statuses and labels to linked GitHub Issues.
 *
 * For each bead with an external_issue_url:
 * 1. Parse the GitHub issue URL
 * 2. Map tbd status to GitHub state and compute label diff
 * 3. Update GitHub issue if state or labels differ
 *
 * @returns Number of GitHub issues updated and any errors
 */
export async function externalPush(
  issues: Issue[],
  logger: OperationLogger,
): Promise<{ pushed: number; labelsPushed: number; errors: string[] }> {
  const linked = issues.filter((i) => i.external_issue_url);
  if (linked.length === 0) {
    return { pushed: 0, labelsPushed: 0, errors: [] };
  }

  logger.progress(`Pushing status and labels to ${linked.length} linked issue(s)...`);
  let pushed = 0;
  let labelsPushed = 0;
  const errors: string[] = [];

  for (const issue of linked) {
    const ref = parseGitHubIssueUrl(issue.external_issue_url!);
    if (!ref) {
      errors.push(`${issue.id}: invalid external_issue_url: ${issue.external_issue_url}`);
      continue;
    }

    try {
      const ghState = await getGitHubIssueState(ref);

      // Status sync
      const mapping = TBD_TO_GITHUB_STATUS[issue.status];
      if (mapping !== null && mapping !== undefined && ghState.state !== mapping.state) {
        await pushStatusToGitHub(ref, mapping, logger, issue.id);
        pushed++;
      }

      // Label sync: push local labels that GitHub doesn't have
      const { toAdd, toRemove } = computeLabelDiff(issue.labels, ghState.labels);
      for (const label of toAdd) {
        logger.info(`${issue.id}: adding label "${label}" to GitHub`);
        await addGitHubLabel(ref, label);
        labelsPushed++;
      }
      for (const label of toRemove) {
        logger.info(`${issue.id}: removing label "${label}" from GitHub`);
        await removeGitHubLabel(ref, label);
        labelsPushed++;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${issue.id}: failed to push to GitHub: ${msg}`);
      logger.warn(`${issue.id}: ${msg}`);
    }
  }

  return { pushed, labelsPushed, errors };
}

async function pushStatusToGitHub(
  ref: GitHubIssueRef,
  mapping: { state: 'open' | 'closed'; state_reason?: 'completed' | 'not_planned' },
  logger: OperationLogger,
  issueId: string,
): Promise<void> {
  if (mapping.state === 'closed') {
    logger.info(`${issueId}: closing GitHub issue (${mapping.state_reason ?? 'completed'})`);
    await closeGitHubIssue(ref, mapping.state_reason ?? 'completed');
  } else {
    logger.info(`${issueId}: reopening GitHub issue`);
    await reopenGitHubIssue(ref);
  }
}
