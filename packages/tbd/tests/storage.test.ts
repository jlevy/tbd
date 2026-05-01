/**
 * Tests for storage layer - issue file operations.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtemp, rm, readFile, writeFile as fsWriteFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeFile } from 'atomically';
import { readIssue, writeIssue, listIssues, deleteIssue } from '../src/file/storage.js';
import { ISSUE_TITLE_MAX_LENGTH } from '../src/lib/schemas.js';
import type { Issue } from '../src/lib/types.js';
import { TEST_ULIDS, testId } from './test-helpers.js';

const makeIssue = (overrides: Partial<Issue> = {}): Issue => ({
  type: 'is',
  id: testId(TEST_ULIDS.STORAGE_1),
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

describe('atomically writeFile', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'tbd-test-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('writes file atomically', async () => {
    const filePath = join(tempDir, 'test.txt');
    const content = 'Hello, World!';

    await writeFile(filePath, content);

    const read = await readFile(filePath, 'utf-8');
    expect(read).toBe(content);
  });

  it('overwrites existing file', async () => {
    const filePath = join(tempDir, 'test.txt');

    await writeFile(filePath, 'original');
    await writeFile(filePath, 'updated');

    const read = await readFile(filePath, 'utf-8');
    expect(read).toBe('updated');
  });

  it('creates parent directories', async () => {
    const filePath = join(tempDir, 'nested', 'dir', 'test.txt');

    await writeFile(filePath, 'content');

    const read = await readFile(filePath, 'utf-8');
    expect(read).toBe('content');
  });

  it('cleans up temp file on success', async () => {
    const filePath = join(tempDir, 'test.txt');

    await writeFile(filePath, 'content');

    // Should not have any .tmp files
    const { readdir } = await import('node:fs/promises');
    const files = await readdir(tempDir);
    expect(files.filter((f) => f.includes('.tmp'))).toEqual([]);
  });
});

describe('writeIssue and readIssue', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'tbd-test-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('writes and reads an issue', async () => {
    const issueId = testId(TEST_ULIDS.ULID_1);
    const issue = makeIssue({ title: 'Write/read test', id: issueId });

    await writeIssue(tempDir, issue);
    const read = await readIssue(tempDir, issueId);

    expect(read.id).toBe(issue.id);
    expect(read.title).toBe(issue.title);
    expect(read.status).toBe(issue.status);
  });

  it('writes to correct file path', async () => {
    const issueId = testId(TEST_ULIDS.ULID_2);
    const issue = makeIssue({ id: issueId });

    await writeIssue(tempDir, issue);

    const filePath = join(tempDir, 'issues', `${issueId}.md`);
    const content = await readFile(filePath, 'utf-8');
    expect(content).toContain(`id: ${issueId}`);
  });

  it('preserves all issue fields', async () => {
    const issueId = testId(TEST_ULIDS.STORAGE_2);
    const targetId = testId(TEST_ULIDS.STORAGE_3);
    const issue = makeIssue({
      id: issueId,
      title: 'Full field test',
      description: 'Test description',
      notes: 'Test notes',
      kind: 'bug',
      status: 'in_progress',
      priority: 1,
      assignee: 'alice',
      labels: ['urgent', 'backend'],
      dependencies: [{ type: 'blocks', target: targetId }],
    });

    await writeIssue(tempDir, issue);
    const read = await readIssue(tempDir, issueId);

    expect(read.description).toBe(issue.description);
    expect(read.notes).toBe(issue.notes);
    expect(read.kind).toBe(issue.kind);
    expect(read.status).toBe(issue.status);
    expect(read.priority).toBe(issue.priority);
    expect(read.assignee).toBe(issue.assignee);
    expect(read.labels).toEqual(issue.labels);
    expect(read.dependencies).toEqual(issue.dependencies);
  });

  it('throws on non-existent issue', async () => {
    await expect(readIssue(tempDir, testId(TEST_ULIDS.ULID_9))).rejects.toThrow();
  });

  it('rejects invalid issues before writing', async () => {
    const issueId = testId(TEST_ULIDS.ULID_3);
    const issue = makeIssue({
      id: issueId,
      title: 'x'.repeat(ISSUE_TITLE_MAX_LENGTH + 1),
    });

    await expect(writeIssue(tempDir, issue)).rejects.toThrow(/title/);
    await expect(readFile(join(tempDir, 'issues', `${issueId}.md`), 'utf-8')).rejects.toThrow();
  });
});

describe('listIssues', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'tbd-test-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('lists all issues in directory', async () => {
    const id1 = testId(TEST_ULIDS.ULID_1);
    const id2 = testId(TEST_ULIDS.ULID_2);
    const id3 = testId(TEST_ULIDS.ULID_3);
    await writeIssue(tempDir, makeIssue({ id: id1, title: 'Issue 1' }));
    await writeIssue(tempDir, makeIssue({ id: id2, title: 'Issue 2' }));
    await writeIssue(tempDir, makeIssue({ id: id3, title: 'Issue 3' }));

    const issues = await listIssues(tempDir);

    expect(issues).toHaveLength(3);
    expect(issues.map((i) => i.id).sort()).toEqual([id1, id2, id3].sort());
  });

  it('returns empty array for empty directory', async () => {
    const issues = await listIssues(tempDir);
    expect(issues).toEqual([]);
  });

  it('ignores non-.md files', async () => {
    const id1 = testId(TEST_ULIDS.ULID_4);
    await writeIssue(tempDir, makeIssue({ id: id1 }));

    // Create a non-.md file
    const issuesDir = join(tempDir, 'issues');
    await fsWriteFile(join(issuesDir, 'README.txt'), 'Not an issue');

    const issues = await listIssues(tempDir);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.id).toBe(id1);
  });

  it('skips invalid issue files with a safe warning', async () => {
    const validId = testId(TEST_ULIDS.STORAGE_2);
    const invalidId = testId(TEST_ULIDS.STORAGE_3);
    await writeIssue(tempDir, makeIssue({ id: validId, title: 'Valid issue' }));

    const issuesDir = join(tempDir, 'issues');
    await mkdir(issuesDir, { recursive: true });
    await fsWriteFile(
      join(issuesDir, `${invalidId}.md`),
      `---
type: is
id: ${invalidId}
title: ${'x'.repeat(ISSUE_TITLE_MAX_LENGTH + 1)}
kind: task
status: open
priority: 2
version: 1
created_at: 2025-01-01T00:00:00Z
updated_at: 2025-01-01T00:00:00Z
labels: []
dependencies: []
---
`,
    );

    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      const issues = await listIssues(tempDir);

      expect(issues).toHaveLength(1);
      expect(issues[0]!.id).toBe(validId);
      expect(consoleWarn).toHaveBeenCalledTimes(1);
      expect(consoleWarn.mock.calls[0]).toEqual([
        expect.stringContaining(`Skipping invalid issue file: ${invalidId}.md: title:`),
      ]);
    } finally {
      consoleWarn.mockRestore();
    }
  });
});

describe('deleteIssue', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'tbd-test-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('deletes an issue', async () => {
    const issueId = testId(TEST_ULIDS.STORAGE_DEL);
    const issue = makeIssue({ id: issueId });
    await writeIssue(tempDir, issue);

    // Verify it exists
    const before = await listIssues(tempDir);
    expect(before).toHaveLength(1);

    await deleteIssue(tempDir, issueId);

    const after = await listIssues(tempDir);
    expect(after).toHaveLength(0);
  });

  it('succeeds when issue does not exist', async () => {
    // Should not throw (valid ID format but doesn't exist)
    await expect(deleteIssue(tempDir, testId(TEST_ULIDS.ULID_9))).resolves.toBeUndefined();
  });
});
