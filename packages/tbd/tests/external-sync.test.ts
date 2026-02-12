/**
 * Tests for external-sync.ts - External issue pull/push operations.
 *
 * Tests mock the GitHub API operations to test sync logic without network.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Issue } from '../src/lib/types.js';
import { noopLogger } from '../src/lib/types.js';

// Mock github-issues module
vi.mock('../src/file/github-issues.js', async (importOriginal) => {
  return {
    ...(await importOriginal()),
    getGitHubIssueState: vi.fn(),
    closeGitHubIssue: vi.fn(),
    reopenGitHubIssue: vi.fn(),
    addGitHubLabel: vi.fn(),
    removeGitHubLabel: vi.fn(),
    validateGitHubIssue: vi.fn(),
  };
});

import {
  getGitHubIssueState,
  closeGitHubIssue,
  reopenGitHubIssue,
  addGitHubLabel,
  removeGitHubLabel,
} from '../src/file/github-issues.js';
import { externalPull, externalPush } from '../src/file/external-sync.js';

const makeIssue = (overrides: Partial<Issue> = {}): Issue => ({
  type: 'is',
  id: 'is-00000000000000000000000001',
  version: 1,
  kind: 'task',
  title: 'Test issue',
  status: 'open',
  priority: 2,
  labels: [],
  dependencies: [],
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
  ...overrides,
});

// =============================================================================
// externalPull
// =============================================================================

describe('externalPull', () => {
  const writeFn = vi.fn().mockResolvedValue(undefined);
  const timestamp = '2025-06-01T00:00:00Z';

  beforeEach(() => {
    vi.mocked(getGitHubIssueState).mockReset();
    vi.mocked(closeGitHubIssue).mockReset();
    vi.mocked(reopenGitHubIssue).mockReset();
    vi.mocked(addGitHubLabel).mockReset();
    vi.mocked(removeGitHubLabel).mockReset();
    writeFn.mockClear();
  });

  it('returns 0 when no issues have external_issue_url', async () => {
    const issues = [makeIssue()];
    const result = await externalPull(issues, writeFn, timestamp, noopLogger);
    expect(result.pulled).toBe(0);
    expect(result.labelsPulled).toBe(0);
    expect(result.errors).toEqual([]);
  });

  it('closes bead when GitHub issue is closed/completed', async () => {
    const issue = makeIssue({
      status: 'open',
      external_issue_url: 'https://github.com/owner/repo/issues/1',
    });

    vi.mocked(getGitHubIssueState).mockResolvedValue({
      state: 'closed',
      state_reason: 'completed',
      labels: [],
    });

    const result = await externalPull([issue], writeFn, timestamp, noopLogger);

    expect(result.pulled).toBe(1);
    expect(issue.status).toBe('closed');
    expect(issue.closed_at).toBe(timestamp);
    expect(writeFn).toHaveBeenCalledOnce();
  });

  it('defers bead when GitHub issue is closed/not_planned', async () => {
    const issue = makeIssue({
      status: 'open',
      external_issue_url: 'https://github.com/owner/repo/issues/1',
    });

    vi.mocked(getGitHubIssueState).mockResolvedValue({
      state: 'closed',
      state_reason: 'not_planned',
      labels: [],
    });

    const result = await externalPull([issue], writeFn, timestamp, noopLogger);

    expect(result.pulled).toBe(1);
    expect(issue.status).toBe('deferred');
  });

  it('reopens closed bead when GitHub issue is open', async () => {
    const issue = makeIssue({
      status: 'closed',
      external_issue_url: 'https://github.com/owner/repo/issues/1',
    });

    vi.mocked(getGitHubIssueState).mockResolvedValue({
      state: 'open',
      state_reason: null,
      labels: [],
    });

    const result = await externalPull([issue], writeFn, timestamp, noopLogger);

    expect(result.pulled).toBe(1);
    expect(issue.status).toBe('open');
  });

  it('does not change in_progress bead when GitHub is open', async () => {
    const issue = makeIssue({
      status: 'in_progress',
      external_issue_url: 'https://github.com/owner/repo/issues/1',
    });

    vi.mocked(getGitHubIssueState).mockResolvedValue({
      state: 'open',
      state_reason: null,
      labels: [],
    });

    const result = await externalPull([issue], writeFn, timestamp, noopLogger);

    expect(result.pulled).toBe(0);
    expect(issue.status).toBe('in_progress');
    expect(writeFn).not.toHaveBeenCalled();
  });

  it('records error when GitHub API fails', async () => {
    const issue = makeIssue({
      external_issue_url: 'https://github.com/owner/repo/issues/1',
    });

    vi.mocked(getGitHubIssueState).mockRejectedValue(new Error('API rate limit'));

    const result = await externalPull([issue], writeFn, timestamp, noopLogger);

    expect(result.pulled).toBe(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('API rate limit');
  });

  it('records error for invalid external_issue_url', async () => {
    const issue = makeIssue({
      external_issue_url: 'https://not-github.com/whatever',
    });

    const result = await externalPull([issue], writeFn, timestamp, noopLogger);

    expect(result.pulled).toBe(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('invalid external_issue_url');
  });

  it('handles mix of linked and unlinked issues', async () => {
    const linked = makeIssue({
      id: 'is-00000000000000000000000001',
      status: 'open',
      external_issue_url: 'https://github.com/owner/repo/issues/1',
    });
    const unlinked = makeIssue({
      id: 'is-00000000000000000000000002',
      status: 'open',
    });

    vi.mocked(getGitHubIssueState).mockResolvedValue({
      state: 'closed',
      state_reason: 'completed',
      labels: [],
    });

    const result = await externalPull([linked, unlinked], writeFn, timestamp, noopLogger);

    expect(result.pulled).toBe(1);
    expect(linked.status).toBe('closed');
    expect(unlinked.status).toBe('open');
  });

  it('pulls new labels from GitHub (union semantics)', async () => {
    const issue = makeIssue({
      labels: ['bug'],
      external_issue_url: 'https://github.com/owner/repo/issues/1',
    });

    vi.mocked(getGitHubIssueState).mockResolvedValue({
      state: 'open',
      state_reason: null,
      labels: ['bug', 'p1', 'enhancement'],
    });

    const result = await externalPull([issue], writeFn, timestamp, noopLogger);

    expect(result.labelsPulled).toBe(2);
    expect(issue.labels).toEqual(['bug', 'p1', 'enhancement']);
    expect(writeFn).toHaveBeenCalledOnce();
  });

  it('does not write when labels and status are unchanged', async () => {
    const issue = makeIssue({
      labels: ['bug', 'p1'],
      external_issue_url: 'https://github.com/owner/repo/issues/1',
    });

    vi.mocked(getGitHubIssueState).mockResolvedValue({
      state: 'open',
      state_reason: null,
      labels: ['bug', 'p1'],
    });

    const result = await externalPull([issue], writeFn, timestamp, noopLogger);

    expect(result.pulled).toBe(0);
    expect(result.labelsPulled).toBe(0);
    expect(writeFn).not.toHaveBeenCalled();
  });

  it('pulls labels and status together', async () => {
    const issue = makeIssue({
      status: 'open',
      labels: [],
      external_issue_url: 'https://github.com/owner/repo/issues/1',
    });

    vi.mocked(getGitHubIssueState).mockResolvedValue({
      state: 'closed',
      state_reason: 'completed',
      labels: ['shipped'],
    });

    const result = await externalPull([issue], writeFn, timestamp, noopLogger);

    expect(result.pulled).toBe(1);
    expect(result.labelsPulled).toBe(1);
    expect(issue.status).toBe('closed');
    expect(issue.labels).toEqual(['shipped']);
  });
});

// =============================================================================
// externalPush
// =============================================================================

describe('externalPush', () => {
  beforeEach(() => {
    vi.mocked(getGitHubIssueState).mockReset();
    vi.mocked(closeGitHubIssue).mockReset();
    vi.mocked(reopenGitHubIssue).mockReset();
    vi.mocked(addGitHubLabel).mockReset();
    vi.mocked(removeGitHubLabel).mockReset();
  });

  it('returns 0 when no issues have external_issue_url', async () => {
    const issues = [makeIssue()];
    const result = await externalPush(issues, noopLogger);
    expect(result.pushed).toBe(0);
    expect(result.labelsPushed).toBe(0);
  });

  it('closes GitHub issue when bead is closed', async () => {
    const issue = makeIssue({
      status: 'closed',
      external_issue_url: 'https://github.com/owner/repo/issues/1',
    });

    vi.mocked(getGitHubIssueState).mockResolvedValue({
      state: 'open',
      state_reason: null,
      labels: [],
    });

    const result = await externalPush([issue], noopLogger);

    expect(result.pushed).toBe(1);
    expect(closeGitHubIssue).toHaveBeenCalledOnce();
    expect(vi.mocked(closeGitHubIssue).mock.calls[0]![1]).toBe('completed');
  });

  it('closes GitHub issue with not_planned when bead is deferred', async () => {
    const issue = makeIssue({
      status: 'deferred',
      external_issue_url: 'https://github.com/owner/repo/issues/1',
    });

    vi.mocked(getGitHubIssueState).mockResolvedValue({
      state: 'open',
      state_reason: null,
      labels: [],
    });

    const result = await externalPush([issue], noopLogger);

    expect(result.pushed).toBe(1);
    expect(closeGitHubIssue).toHaveBeenCalledOnce();
    expect(vi.mocked(closeGitHubIssue).mock.calls[0]![1]).toBe('not_planned');
  });

  it('reopens GitHub issue when bead is open', async () => {
    const issue = makeIssue({
      status: 'open',
      external_issue_url: 'https://github.com/owner/repo/issues/1',
    });

    vi.mocked(getGitHubIssueState).mockResolvedValue({
      state: 'closed',
      state_reason: 'completed',
      labels: [],
    });

    const result = await externalPush([issue], noopLogger);

    expect(result.pushed).toBe(1);
    expect(reopenGitHubIssue).toHaveBeenCalledOnce();
  });

  it('does not push when GitHub state matches tbd status', async () => {
    const issue = makeIssue({
      status: 'open',
      external_issue_url: 'https://github.com/owner/repo/issues/1',
    });

    vi.mocked(getGitHubIssueState).mockResolvedValue({
      state: 'open',
      state_reason: null,
      labels: [],
    });

    const result = await externalPush([issue], noopLogger);

    expect(result.pushed).toBe(0);
    expect(closeGitHubIssue).not.toHaveBeenCalled();
    expect(reopenGitHubIssue).not.toHaveBeenCalled();
  });

  it('skips blocked status push but still syncs labels', async () => {
    const issue = makeIssue({
      status: 'blocked',
      labels: ['bug'],
      external_issue_url: 'https://github.com/owner/repo/issues/1',
    });

    vi.mocked(getGitHubIssueState).mockResolvedValue({
      state: 'open',
      state_reason: null,
      labels: ['bug'],
    });

    const result = await externalPush([issue], noopLogger);

    expect(result.pushed).toBe(0); // status not pushed for blocked
    expect(result.labelsPushed).toBe(0); // labels already in sync
    expect(closeGitHubIssue).not.toHaveBeenCalled();
    expect(reopenGitHubIssue).not.toHaveBeenCalled();
  });

  it('records error when GitHub API fails', async () => {
    const issue = makeIssue({
      status: 'closed',
      external_issue_url: 'https://github.com/owner/repo/issues/1',
    });

    vi.mocked(getGitHubIssueState).mockRejectedValue(new Error('Network error'));

    const result = await externalPush([issue], noopLogger);

    expect(result.pushed).toBe(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('Network error');
  });

  it('pushes local labels to GitHub', async () => {
    const issue = makeIssue({
      status: 'open',
      labels: ['bug', 'p1', 'new-label'],
      external_issue_url: 'https://github.com/owner/repo/issues/1',
    });

    vi.mocked(getGitHubIssueState).mockResolvedValue({
      state: 'open',
      state_reason: null,
      labels: ['bug', 'p1'],
    });
    vi.mocked(addGitHubLabel).mockResolvedValue(undefined);

    const result = await externalPush([issue], noopLogger);

    expect(result.pushed).toBe(0); // status in sync
    expect(result.labelsPushed).toBe(1);
    expect(addGitHubLabel).toHaveBeenCalledOnce();
    expect(vi.mocked(addGitHubLabel).mock.calls[0]![1]).toBe('new-label');
  });

  it('removes labels from GitHub that are not on local bead', async () => {
    const issue = makeIssue({
      status: 'open',
      labels: ['bug'],
      external_issue_url: 'https://github.com/owner/repo/issues/1',
    });

    vi.mocked(getGitHubIssueState).mockResolvedValue({
      state: 'open',
      state_reason: null,
      labels: ['bug', 'old-label'],
    });
    vi.mocked(removeGitHubLabel).mockResolvedValue(undefined);

    const result = await externalPush([issue], noopLogger);

    expect(result.labelsPushed).toBe(1);
    expect(removeGitHubLabel).toHaveBeenCalledOnce();
    expect(vi.mocked(removeGitHubLabel).mock.calls[0]![1]).toBe('old-label');
  });

  it('pushes status and labels together', async () => {
    const issue = makeIssue({
      status: 'closed',
      labels: ['shipped'],
      external_issue_url: 'https://github.com/owner/repo/issues/1',
    });

    vi.mocked(getGitHubIssueState).mockResolvedValue({
      state: 'open',
      state_reason: null,
      labels: [],
    });
    vi.mocked(closeGitHubIssue).mockResolvedValue(undefined);
    vi.mocked(addGitHubLabel).mockResolvedValue(undefined);

    const result = await externalPush([issue], noopLogger);

    expect(result.pushed).toBe(1);
    expect(result.labelsPushed).toBe(1);
    expect(closeGitHubIssue).toHaveBeenCalledOnce();
    expect(addGitHubLabel).toHaveBeenCalledOnce();
  });

  it('does not push labels when they are in sync', async () => {
    const issue = makeIssue({
      status: 'open',
      labels: ['bug', 'p1'],
      external_issue_url: 'https://github.com/owner/repo/issues/1',
    });

    vi.mocked(getGitHubIssueState).mockResolvedValue({
      state: 'open',
      state_reason: null,
      labels: ['bug', 'p1'],
    });

    const result = await externalPush([issue], noopLogger);

    expect(result.pushed).toBe(0);
    expect(result.labelsPushed).toBe(0);
    expect(addGitHubLabel).not.toHaveBeenCalled();
    expect(removeGitHubLabel).not.toHaveBeenCalled();
  });
});
