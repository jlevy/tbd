/**
 * Regression coverage for directed blocker cycles reported by `tbd doctor`.
 */

import { describe, expect, it } from 'vitest';

import { dependencyFinding } from '../src/cli/commands/doctor.js';
import { findDependencyCycles } from '../src/lib/issue-dependency-graph.js';
import { createTestIssue, testId, TEST_ULIDS } from './test-helpers.js';

describe('findDependencyCycles', () => {
  it('reports a multi-node directed cycle in depends-on order', () => {
    const issueA = testId(TEST_ULIDS.DOCTOR_1);
    const issueB = testId(TEST_ULIDS.DOCTOR_2);
    const issueC = testId(TEST_ULIDS.DOCTOR_3);

    const issues = [
      createTestIssue({
        id: issueA,
        title: 'A',
        dependencies: [{ type: 'blocks', target: issueC }],
      }),
      createTestIssue({
        id: issueB,
        title: 'B',
        dependencies: [{ type: 'blocks', target: issueA }],
      }),
      createTestIssue({
        id: issueC,
        title: 'C',
        dependencies: [{ type: 'blocks', target: issueB }],
      }),
    ];

    const expectedCycle = [issueA, issueB, issueC, issueA];
    const displayIds = new Map<string, string>([
      [issueA, 'test-a'],
      [issueB, 'test-b'],
      [issueC, 'test-c'],
    ]);
    expect(findDependencyCycles(issues)).toEqual([expectedCycle]);
    expect(dependencyFinding(issues, (issueId) => displayIds.get(issueId)!)).toEqual({
      name: 'Dependencies',
      status: 'error',
      message: '1 directed cycle(s)',
      details: ['depends-on cycle: test-a -> test-b -> test-c -> test-a'],
      suggestion: 'Break each cycle with: tbd dep remove <issue> <depends-on>.',
    });
  });

  it('keeps an acyclic dependency graph clean', () => {
    const issueA = testId(TEST_ULIDS.DOCTOR_1);
    const issueB = testId(TEST_ULIDS.DOCTOR_2);
    const issueC = testId(TEST_ULIDS.DOCTOR_3);

    const issues = [
      createTestIssue({ id: issueA, title: 'A' }),
      createTestIssue({
        id: issueB,
        title: 'B',
        dependencies: [{ type: 'blocks', target: issueA }],
      }),
      createTestIssue({
        id: issueC,
        title: 'C',
        dependencies: [{ type: 'blocks', target: issueB }],
      }),
    ];

    expect(findDependencyCycles(issues)).toEqual([]);
    expect(dependencyFinding(issues)).toEqual({ name: 'Dependencies', status: 'ok' });
  });
});
