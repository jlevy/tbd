/**
 * Regression coverage for directed blocker cycles reported by `tbd doctor`.
 */

import { describe, expect, it } from 'vitest';

import { dependencyFinding, dependencyIdFormatter } from '../src/cli/commands/doctor.js';
import type { IdMapping } from '../src/file/id-mapping.js';
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

type Letter = 'a' | 'b' | 'c' | 'd';

const LETTER_IDS: Record<Letter, string> = {
  a: testId(TEST_ULIDS.DOCTOR_1),
  b: testId(TEST_ULIDS.DOCTOR_2),
  c: testId(TEST_ULIDS.DOCTOR_3),
  d: testId(TEST_ULIDS.DOCTOR_4),
};
const MISSING_ID = testId(TEST_ULIDS.DOCTOR_999);

/**
 * Build issues a-d from depends-on edges (`[dependent, dependsOn]`, as `tbd dep add`
 * takes them). Each orphan holder also stores an edge to an issue that does not exist.
 */
function dependencyGraph(dependsOn: [Letter, Letter][], orphanHolders: Letter[] = []) {
  return (Object.keys(LETTER_IDS) as Letter[]).map((letter) =>
    createTestIssue({
      id: LETTER_IDS[letter],
      title: letter,
      dependencies: [
        ...dependsOn
          .filter(([, blocker]) => blocker === letter)
          .map(([dependent]) => ({ type: 'blocks' as const, target: LETTER_IDS[dependent] })),
        ...(orphanHolders.includes(letter)
          ? [{ type: 'blocks' as const, target: MISSING_ID }]
          : []),
      ],
    }),
  );
}

const letterName = (issueId: string): string =>
  Object.entries(LETTER_IDS).find(([, id]) => id === issueId)?.[0] ?? 'missing';

const CYCLE_SUGGESTION = 'Break each cycle with: tbd dep remove <issue> <depends-on>.';

describe('dependencyFinding', () => {
  it.each([
    {
      name: 'reports a self-loop as a one-node cycle',
      dependsOn: [['a', 'a']] as [Letter, Letter][],
      orphanHolders: [] as Letter[],
      expected: {
        status: 'error',
        message: '1 directed cycle(s)',
        details: ['depends-on cycle: a -> a'],
        suggestion: CYCLE_SUGGESTION,
      },
    },
    {
      name: 'reports one path per cyclic component, sorted by first ID',
      dependsOn: [
        ['c', 'd'],
        ['d', 'c'],
        ['b', 'a'],
        ['a', 'b'],
      ] as [Letter, Letter][],
      orphanHolders: [] as Letter[],
      expected: {
        status: 'error',
        message: '2 directed cycle(s)',
        details: ['depends-on cycle: a -> b -> a', 'depends-on cycle: c -> d -> c'],
        suggestion: CYCLE_SUGGESTION,
      },
    },
    {
      name: 'keeps orphan-only references a fixable warning',
      dependsOn: [] as [Letter, Letter][],
      orphanHolders: ['a'] as Letter[],
      expected: {
        status: 'warn',
        message: '1 orphaned reference(s)',
        details: ['a -> missing (missing)'],
        fixable: true,
        suggestion: 'Run: tbd doctor --fix',
      },
    },
    {
      name: 'keeps orphan repair guidance when a cycle is also present',
      dependsOn: [
        ['a', 'b'],
        ['b', 'a'],
      ] as [Letter, Letter][],
      orphanHolders: ['c'] as Letter[],
      expected: {
        status: 'error',
        message: '1 directed cycle(s) and 1 orphaned reference(s)',
        details: ['depends-on cycle: a -> b -> a', 'c -> missing (missing)'],
        fixable: true,
        suggestion: `${CYCLE_SUGGESTION} Run: tbd doctor --fix to repair the orphaned reference(s).`,
      },
    },
  ])('$name', ({ dependsOn, orphanHolders, expected }) => {
    expect(dependencyFinding(dependencyGraph(dependsOn, orphanHolders), letterName)).toEqual({
      name: 'Dependencies',
      ...expected,
    });
  });

  it('names beads without a short ID, or with no usable mapping, by internal ID', () => {
    const issues = dependencyGraph([
      ['a', 'b'],
      ['b', 'a'],
    ]);
    const partialMapping: IdMapping = {
      shortToUlid: new Map([['aaaa', TEST_ULIDS.DOCTOR_1]]),
      ulidToShort: new Map([[TEST_ULIDS.DOCTOR_1, 'aaaa']]),
    };

    expect(
      dependencyFinding(issues, dependencyIdFormatter(partialMapping, 'test')).details,
    ).toEqual([`depends-on cycle: test-aaaa -> ${LETTER_IDS.b} -> test-aaaa`]);
    expect(dependencyFinding(issues, dependencyIdFormatter(null, 'test')).details).toEqual([
      `depends-on cycle: ${LETTER_IDS.a} -> ${LETTER_IDS.b} -> ${LETTER_IDS.a}`,
    ]);
  });
});
