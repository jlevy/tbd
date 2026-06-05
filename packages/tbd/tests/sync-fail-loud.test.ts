/**
 * Tests for the fail-loud guard: sync must never report success over a bead
 * file that fails to parse (e.g. one left holding git conflict markers).
 *
 * See: issue #155, plan-2026-06-03-tbd-sync-structured-bead-merge.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomBytes } from 'node:crypto';

import { findInvalidBeads } from '../src/cli/commands/sync.js';
import { writeIssue } from '../src/file/storage.js';
import { createTestIssue, testId, TEST_ULIDS } from './test-helpers.js';

describe('findInvalidBeads', () => {
  let dataSyncDir: string;

  beforeEach(async () => {
    dataSyncDir = join(tmpdir(), `tbd-fail-loud-${randomBytes(6).toString('hex')}`);
    await mkdir(join(dataSyncDir, 'issues'), { recursive: true });
  });

  afterEach(async () => {
    await rm(dataSyncDir, { recursive: true, force: true });
  });

  it('returns empty when every bead parses', async () => {
    await writeIssue(dataSyncDir, createTestIssue({ id: testId(TEST_ULIDS.ULID_1), title: 'Ok' }));

    const invalid = await findInvalidBeads(dataSyncDir);

    expect(invalid).toEqual([]);
  });

  it('names a bead left holding git conflict markers', async () => {
    await writeIssue(dataSyncDir, createTestIssue({ id: testId(TEST_ULIDS.ULID_1), title: 'Ok' }));
    // A bead whose YAML was clobbered by git's line-based merge — exactly the
    // #155 corruption. It must be detected, not silently skipped.
    const badId = testId(TEST_ULIDS.ULID_2);
    await writeFile(
      join(dataSyncDir, 'issues', `${badId}.md`),
      [
        '---',
        'type: is',
        `id: ${badId}`,
        '<<<<<<< HEAD',
        'version: 68',
        '=======',
        'version: 75',
        '>>>>>>> origin/tbd-sync',
        '---',
        '',
      ].join('\n'),
    );

    const invalid = await findInvalidBeads(dataSyncDir);

    expect(invalid).toHaveLength(1);
    expect(invalid[0]!.file).toContain(badId);
  });
});
