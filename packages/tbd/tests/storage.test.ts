/**
 * Tests for storage layer - issue file operations.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtemp, mkdir, rm, readFile, writeFile as fsWriteFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeFile } from 'atomically';
import {
  readIssue,
  writeIssue,
  listIssues,
  listIssuesDetailed,
  deleteIssue,
  formatIssueParseError,
} from '../src/file/storage.js';
import type { Issue } from '../src/lib/types.js';
import { TEST_ULIDS, testId } from './test-helpers.js';
import { z } from 'zod';

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
});

describe('writeIssue validation (issue #115)', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'tbd-test-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('rejects an issue with an oversize title', async () => {
    const issue = makeIssue({
      id: testId(TEST_ULIDS.STORAGE_1),
      title: 'x'.repeat(600),
    });

    await expect(writeIssue(tempDir, issue)).rejects.toBeInstanceOf(z.ZodError);

    // Nothing should have been written
    const issues = await listIssues(tempDir);
    expect(issues).toHaveLength(0);
  });

  it('rejects an issue with an empty title', async () => {
    const issue = makeIssue({ id: testId(TEST_ULIDS.STORAGE_2), title: '' });
    await expect(writeIssue(tempDir, issue)).rejects.toBeInstanceOf(z.ZodError);
  });

  it('accepts a title at the maximum length (500)', async () => {
    const issue = makeIssue({
      id: testId(TEST_ULIDS.STORAGE_3),
      title: 'x'.repeat(500),
    });
    await expect(writeIssue(tempDir, issue)).resolves.toBeUndefined();
  });
});

describe('listIssues skip behavior (issue #115)', () => {
  let tempDir: string;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'tbd-test-'));
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {
      // swallow warnings during tests
    });
  });

  afterEach(async () => {
    warnSpy.mockRestore();
    await rm(tempDir, { recursive: true, force: true });
  });

  it('skips invalid files without throwing', async () => {
    // Write one valid issue, then an invalid raw file with the .md extension
    const goodId = testId(TEST_ULIDS.STORAGE_1);
    await writeIssue(tempDir, makeIssue({ id: goodId, title: 'good' }));

    const issuesDir = join(tempDir, 'issues');
    await fsWriteFile(join(issuesDir, 'is-broken.md'), 'this is not a valid issue\n');

    const issues = await listIssues(tempDir);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.id).toBe(goodId);
    expect(warnSpy).toHaveBeenCalled();
  });

  it('formats warnings as strings (never raw error objects, issue #115)', async () => {
    const issuesDir = join(tempDir, 'issues');
    await mkdir(issuesDir, { recursive: true });
    await fsWriteFile(join(issuesDir, 'is-broken.md'), '---\ntype: is\n---\n');

    await listIssues(tempDir);

    // Every console.warn argument must be a string — never an Error object,
    // because util.inspect on certain ZodErrors crashes Node v24.
    for (const call of warnSpy.mock.calls) {
      for (const arg of call) {
        expect(typeof arg).toBe('string');
      }
    }
  });

  it('listIssuesDetailed returns the list of skipped files', async () => {
    const goodId = testId(TEST_ULIDS.STORAGE_2);
    await writeIssue(tempDir, makeIssue({ id: goodId, title: 'good' }));

    const issuesDir = join(tempDir, 'issues');
    await fsWriteFile(join(issuesDir, 'is-broken.md'), 'not valid\n');

    const { issues, skipped } = await listIssuesDetailed(tempDir);
    expect(issues).toHaveLength(1);
    expect(skipped).toHaveLength(1);
    expect(skipped[0]!.file).toBe('is-broken.md');
    expect(skipped[0]!.reason).toBeTypeOf('string');
    expect(skipped[0]!.reason.length).toBeGreaterThan(0);
  });
});

describe('formatIssueParseError (issue #115)', () => {
  it('formats a ZodError as a string without invoking util.inspect', () => {
    const schema = z.object({ title: z.string().max(5) });
    const result = schema.safeParse({ title: 'too long' });
    expect(result.success).toBe(false);
    if (!result.success) {
      const formatted = formatIssueParseError(result.error);
      expect(typeof formatted).toBe('string');
      expect(formatted).toContain('title');
    }
  });

  it('formats a plain Error', () => {
    expect(formatIssueParseError(new Error('boom'))).toBe('boom');
  });

  it('stringifies unknown values', () => {
    expect(formatIssueParseError('plain string')).toBe('plain string');
    expect(formatIssueParseError(42)).toBe('42');
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
