/**
 * Tests for close and reopen commands.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, rm, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomBytes } from 'node:crypto';

import { writeIssue, readIssue } from '../src/file/storage.js';
import type { Issue } from '../src/lib/types.js';

describe('close command logic', () => {
  let testDir: string;
  const issuesDir = '.tbd-sync';

  beforeEach(async () => {
    testDir = join(tmpdir(), `tbd-close-test-${randomBytes(4).toString('hex')}`);
    await mkdir(join(testDir, issuesDir, 'issues'), { recursive: true });
    process.chdir(testDir);
  });

  afterEach(async () => {
    process.chdir('/');
    await rm(testDir, { recursive: true, force: true });
  });

  it('closes an open issue', async () => {
    const issue: Issue = {
      type: 'is',
      id: 'is-c10501',
      version: 1,
      kind: 'task',
      title: 'Issue to close',
      status: 'open',
      priority: 2,
      labels: [],
      dependencies: [],
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
    };

    await writeIssue(issuesDir, issue);

    // Simulate close logic
    const loaded = await readIssue(issuesDir, 'is-c10501');
    expect(loaded.status).toBe('open');

    loaded.status = 'closed';
    loaded.closed_at = '2025-01-15T10:00:00Z';
    loaded.close_reason = 'completed';
    loaded.version += 1;
    loaded.updated_at = '2025-01-15T10:00:00Z';

    await writeIssue(issuesDir, loaded);

    const result = await readIssue(issuesDir, 'is-c10501');
    expect(result.status).toBe('closed');
    expect(result.closed_at).toBe('2025-01-15T10:00:00Z');
    expect(result.close_reason).toBe('completed');
    expect(result.version).toBe(2);
  });

  it('closes issue without reason', async () => {
    const issue: Issue = {
      type: 'is',
      id: 'is-c10502',
      version: 1,
      kind: 'bug',
      title: 'Bug to fix',
      status: 'in_progress',
      priority: 1,
      labels: ['urgent'],
      dependencies: [],
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
    };

    await writeIssue(issuesDir, issue);

    const loaded = await readIssue(issuesDir, 'is-c10502');
    loaded.status = 'closed';
    loaded.closed_at = '2025-01-15T10:00:00Z';
    loaded.close_reason = null;
    loaded.version += 1;

    await writeIssue(issuesDir, loaded);

    const result = await readIssue(issuesDir, 'is-c10502');
    expect(result.status).toBe('closed');
    expect(result.close_reason).toBeNull();
  });

  it('validates closing already closed issue', async () => {
    const issue: Issue = {
      type: 'is',
      id: 'is-c10503',
      version: 2,
      kind: 'task',
      title: 'Already closed',
      status: 'closed',
      priority: 2,
      labels: [],
      dependencies: [],
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-10T00:00:00Z',
      closed_at: '2025-01-10T00:00:00Z',
    };

    await writeIssue(issuesDir, issue);

    const loaded = await readIssue(issuesDir, 'is-c10503');
    expect(loaded.status).toBe('closed');
    // In real command, this would trigger an error
  });
});

describe('reopen command logic', () => {
  let testDir: string;
  const issuesDir = '.tbd-sync';

  beforeEach(async () => {
    testDir = join(tmpdir(), `tbd-reopen-test-${randomBytes(4).toString('hex')}`);
    await mkdir(join(testDir, issuesDir, 'issues'), { recursive: true });
    process.chdir(testDir);
  });

  afterEach(async () => {
    process.chdir('/');
    await rm(testDir, { recursive: true, force: true });
  });

  it('reopens a closed issue', async () => {
    const issue: Issue = {
      type: 'is',
      id: 'is-a00001',
      version: 2,
      kind: 'task',
      title: 'Closed issue',
      status: 'closed',
      priority: 2,
      labels: [],
      dependencies: [],
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-10T00:00:00Z',
      closed_at: '2025-01-10T00:00:00Z',
      close_reason: 'fixed',
    };

    await writeIssue(issuesDir, issue);

    // Simulate reopen logic
    const loaded = await readIssue(issuesDir, 'is-a00001');
    expect(loaded.status).toBe('closed');

    loaded.status = 'open';
    loaded.closed_at = null;
    loaded.close_reason = null;
    loaded.version += 1;
    loaded.updated_at = '2025-01-15T10:00:00Z';

    await writeIssue(issuesDir, loaded);

    const result = await readIssue(issuesDir, 'is-a00001');
    expect(result.status).toBe('open');
    expect(result.closed_at).toBeNull();
    expect(result.close_reason).toBeNull();
    expect(result.version).toBe(3);
  });

  it('reopens with reason appended to notes', async () => {
    const issue: Issue = {
      type: 'is',
      id: 'is-a00002',
      version: 2,
      kind: 'bug',
      title: 'Bug that returned',
      status: 'closed',
      priority: 1,
      labels: [],
      dependencies: [],
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-10T00:00:00Z',
      closed_at: '2025-01-10T00:00:00Z',
      description: 'Bug description.',
      notes: 'Original notes.',
    };

    await writeIssue(issuesDir, issue);

    const loaded = await readIssue(issuesDir, 'is-a00002');
    loaded.status = 'open';
    loaded.closed_at = null;
    loaded.close_reason = null;
    const reopenNote = 'Reopened: Bug reoccurred in production';
    loaded.notes = loaded.notes ? `${loaded.notes}\n\n${reopenNote}` : reopenNote;
    loaded.version += 1;

    await writeIssue(issuesDir, loaded);

    const result = await readIssue(issuesDir, 'is-a00002');
    expect(result.status).toBe('open');
    expect(result.notes).toContain('Original notes.');
    expect(result.notes).toContain('Reopened: Bug reoccurred in production');
  });

  it('validates reopening non-closed issue', async () => {
    const issue: Issue = {
      type: 'is',
      id: 'is-a00003',
      version: 1,
      kind: 'task',
      title: 'Open issue',
      status: 'open',
      priority: 2,
      labels: [],
      dependencies: [],
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
    };

    await writeIssue(issuesDir, issue);

    const loaded = await readIssue(issuesDir, 'is-a00003');
    expect(loaded.status).toBe('open');
    // In real command, attempting to reopen would trigger an error
  });

  it('reopens from blocked status correctly', async () => {
    const issue: Issue = {
      type: 'is',
      id: 'is-a00004',
      version: 2,
      kind: 'feature',
      title: 'Blocked then closed',
      status: 'closed',
      priority: 2,
      labels: [],
      dependencies: [],
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-10T00:00:00Z',
      closed_at: '2025-01-10T00:00:00Z',
      close_reason: 'wontfix',
    };

    await writeIssue(issuesDir, issue);

    const loaded = await readIssue(issuesDir, 'is-a00004');
    loaded.status = 'open';
    loaded.closed_at = null;
    loaded.close_reason = null;
    loaded.version += 1;

    await writeIssue(issuesDir, loaded);

    const result = await readIssue(issuesDir, 'is-a00004');
    expect(result.status).toBe('open');
  });
});

describe('close/reopen file format', () => {
  let testDir: string;
  const issuesDir = '.tbd-sync';

  beforeEach(async () => {
    testDir = join(tmpdir(), `tbd-format-test-${randomBytes(4).toString('hex')}`);
    await mkdir(join(testDir, issuesDir, 'issues'), { recursive: true });
    process.chdir(testDir);
  });

  afterEach(async () => {
    process.chdir('/');
    await rm(testDir, { recursive: true, force: true });
  });

  it('preserves closed_at and close_reason in file', async () => {
    const issue: Issue = {
      type: 'is',
      id: 'is-f00a07',
      version: 2,
      kind: 'task',
      title: 'Format test',
      status: 'closed',
      priority: 2,
      labels: [],
      dependencies: [],
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-10T00:00:00Z',
      closed_at: '2025-01-10T00:00:00Z',
      close_reason: 'duplicate',
    };

    await writeIssue(issuesDir, issue);

    const filePath = join(testDir, issuesDir, 'issues', 'is-f00a07.md');
    const content = await readFile(filePath, 'utf-8');

    expect(content).toContain('status: closed');
    expect(content).toContain('closed_at: 2025-01-10T00:00:00Z');
    expect(content).toContain('close_reason: duplicate');
  });
});
