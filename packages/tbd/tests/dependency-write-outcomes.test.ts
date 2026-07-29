/**
 * Fault-injection tests for multi-file dependency writes (PR #198 review R1):
 * a write failure after an earlier success must be captured per target, never
 * swallowed into a bare error that hides the partially-applied state.
 *
 * Injection works by pre-creating a non-empty directory at the second
 * blocker's issue path: the atomic rename inside `writeIssue` fails there on
 * every platform (and regardless of privilege), while the first blocker's
 * write succeeds — a true partial application using the real write path.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  applyDependencyWrites,
  throwOnDependencyWriteFailures,
  type DependencyWriteOutcome,
} from '../src/cli/lib/bulk.js';
import { readIssue } from '../src/file/storage.js';
import type { Issue } from '../src/lib/types.js';

const TS = '2026-07-29T00:00:00.000Z';

function issueOf(id: string, title: string): Issue {
  return {
    type: 'is',
    id,
    version: 1,
    title,
    kind: 'task',
    status: 'open',
    priority: 2,
    labels: [],
    dependencies: [],
    created_at: TS,
    updated_at: TS,
  };
}

const ID_A = 'is-01hx0000000000000000000aaa';
const ID_B = 'is-01hx0000000000000000000bbb';
const TARGET = 'is-01hx0000000000000000000ttt';

describe('applyDependencyWrites', () => {
  let dataSyncDir: string;

  beforeEach(async () => {
    dataSyncDir = await mkdtemp(join(tmpdir(), 'tbd-dep-writes-'));
    await mkdir(join(dataSyncDir, 'issues'), { recursive: true });
  });

  afterEach(async () => {
    await rm(dataSyncDir, { recursive: true, force: true });
  });

  it('captures a write failure after an earlier success as a per-target outcome', async () => {
    // Make the second blocker's issue path an occupied directory so its
    // atomic rename fails while the first write succeeds.
    await mkdir(join(dataSyncDir, 'issues', `${ID_B}.md`, 'occupied'), { recursive: true });

    const blockers = [
      { internalId: ID_A, issue: issueOf(ID_A, 'Blocker A') },
      { internalId: ID_B, issue: issueOf(ID_B, 'Blocker B') },
    ];
    const outcome = await applyDependencyWrites(
      dataSyncDir,
      blockers,
      (internalId) => internalId,
      (issue) => {
        issue.dependencies.push({ type: 'blocks', target: TARGET });
        return 'changed';
      },
    );

    expect(outcome.changed).toEqual([ID_A]);
    expect(outcome.failed).toHaveLength(1);
    expect(outcome.failed[0]!.id).toBe(ID_B);
    expect(outcome.failed[0]!.message).toBeTruthy();

    // The successful edge is durable — exactly what the error report claims.
    const written = await readIssue(dataSyncDir, ID_A);
    expect(written.dependencies).toEqual([{ type: 'blocks', target: TARGET }]);
  });

  it('counts unchanged targets without writing them', async () => {
    const blockers = [{ internalId: ID_A, issue: issueOf(ID_A, 'Blocker A') }];
    const outcome = await applyDependencyWrites(
      dataSyncDir,
      blockers,
      (internalId) => internalId,
      () => 'unchanged',
    );
    expect(outcome).toEqual({ changed: [], unchanged: [ID_A], failed: [] });
    await expect(readIssue(dataSyncDir, ID_A)).rejects.toThrow();
  });
});

describe('throwOnDependencyWriteFailures', () => {
  it('is silent when nothing failed', () => {
    const outcome: DependencyWriteOutcome = { changed: ['a'], unchanged: [], failed: [] };
    expect(() => {
      throwOnDependencyWriteFailures(outcome, 'tbd dep add x a');
    }).not.toThrow();
  });

  it('names every failed target, keeps applied edges, and gives the remedy', () => {
    const outcome: DependencyWriteOutcome = {
      changed: ['test-aaaa'],
      unchanged: [],
      failed: [{ id: 'test-bbbb', message: 'EACCES: permission denied' }],
    };
    expect(() => {
      throwOnDependencyWriteFailures(outcome, 'tbd dep add test-x test-bbbb');
    }).toThrow(
      /1 of 2 dependency writes failed: test-bbbb \(EACCES: permission denied\)\. Applied edges are kept; run `tbd dep add test-x test-bbbb` to finish\./,
    );
  });
});
