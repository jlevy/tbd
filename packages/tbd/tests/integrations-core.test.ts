/**
 * Unit tests for the provider-agnostic integration core and the Linear mapping
 * tables.
 */

import { describe, expect, it } from 'vitest';

import { parseEnvContent } from '../src/lib/env-file.js';
import { maskSecret, CREDENTIAL_ENV_VARS } from '../src/integrations/core/credentials.js';
import {
  BLOCK_BEGIN,
  BLOCK_END,
  renderManagedBlock,
  spliceManagedBlock,
} from '../src/integrations/core/managed-block.js';
import { mirrorSet, isLinkedTo } from '../src/integrations/core/selection.js';
import { blobUrl, parseRepoSlug } from '../src/integrations/core/permalink.js';
import {
  BLOCKED_LABEL,
  DEFERRED_LABEL,
  KNOWN_STATE_TYPES,
  priorityFromLinear,
  priorityToLinear,
  statusFromLinear,
  statusToLinear,
} from '../src/integrations/linear/mapping.js';
import {
  checkParentAssignment,
  findHierarchyProblems,
  MAX_PARENT_DEPTH,
} from '../src/lib/issue-hierarchy.js';
import type { Issue, IntegrationSelect, IssueStatusType, PriorityType } from '../src/lib/types.js';

function issue(overrides: Partial<Issue> = {}): Issue {
  return {
    type: 'is',
    id: 'is-01test',
    version: 1,
    title: 'Test',
    kind: 'task',
    status: 'open',
    priority: 2,
    labels: [],
    dependencies: [],
    created_at: '2026-08-10T00:00:00.000Z',
    updated_at: '2026-08-10T00:00:00.000Z',
    ...overrides,
  } as Issue;
}

const DEFAULT_SELECT: IntegrationSelect = {
  kinds: ['epic'],
  statuses: ['open', 'in_progress', 'blocked'],
  labels: [],
  specs: 'none',
  linked: true,
};

describe('env-file parsing', () => {
  it('parses plain assignments, comments, quotes, and export prefixes', () => {
    const parsed = parseEnvContent(
      ['# a comment', 'LINEAR_API_KEY=lin_api_abc', 'export QUOTED="two words"', ''].join('\n'),
    );
    expect(parsed.get('LINEAR_API_KEY')).toBe('lin_api_abc');
    expect(parsed.get('QUOTED')).toBe('two words');
    expect(parsed.has('# a comment')).toBe(false);
  });

  it('returns an empty map for empty content', () => {
    expect(parseEnvContent('').size).toBe(0);
  });
});

describe('credential masking', () => {
  it('reveals only a short suffix of a long secret', () => {
    const masked = maskSecret('lin_api_0123456789abcdef');
    expect(masked).toBe('********cdef');
    expect(masked).not.toContain('0123456789');
  });

  it('fully masks a short secret rather than revealing most of it', () => {
    expect(maskSecret('abcd1234')).toBe('********');
  });

  it('names the environment variable for each provider', () => {
    expect(CREDENTIAL_ENV_VARS.linear).toBe('LINEAR_API_KEY');
    expect(CREDENTIAL_ENV_VARS.github).toBe('GITHUB_TOKEN');
  });
});

describe('Linear status mapping', () => {
  it('round-trips every tbd status', () => {
    const statuses: IssueStatusType[] = ['open', 'in_progress', 'blocked', 'deferred', 'closed'];
    for (const status of statuses) {
      const target = statusToLinear(status);
      expect(statusFromLinear(target.stateType, target.labels)).toBe(status);
    }
  });

  it('carries blocked and deferred on tbd-owned labels', () => {
    expect(statusToLinear('blocked').labels).toEqual([BLOCKED_LABEL]);
    expect(statusToLinear('deferred').labels).toEqual([DEFERRED_LABEL]);
  });

  it('maps every known state type without throwing', () => {
    for (const stateType of KNOWN_STATE_TYPES) {
      expect(() => statusFromLinear(stateType, [])).not.toThrow();
    }
  });

  it('treats duplicate as closed, not as an unknown state', () => {
    expect(statusFromLinear('duplicate', [])).toBe('closed');
  });

  it('fails soft on an unknown state type rather than aborting a sync', () => {
    expect(statusFromLinear('someFutureState', [])).toBe('open');
  });
});

describe('Linear priority mapping', () => {
  it('maps every tbd priority into Linear range', () => {
    const priorities: PriorityType[] = [0, 1, 2, 3, 4];
    for (const priority of priorities) {
      const mapped = priorityToLinear(priority);
      expect(mapped).toBeGreaterThanOrEqual(0);
      expect(mapped).toBeLessThanOrEqual(4);
    }
  });

  it('maps P0 to Urgent, since Linear 1 is the most urgent and 0 means unset', () => {
    expect(priorityToLinear(0)).toBe(1);
  });

  it('maps unset Linear priority to the tbd default, not to lowest', () => {
    expect(priorityFromLinear(0)).toBe(2);
  });

  it('round-trips P0 through P3 exactly', () => {
    for (const priority of [0, 1, 2, 3] as PriorityType[]) {
      expect(priorityFromLinear(priorityToLinear(priority))).toBe(priority);
    }
  });

  it('collapses P4 onto P3, the documented round-trip loss', () => {
    expect(priorityFromLinear(priorityToLinear(4))).toBe(3);
  });
});

describe('managed block', () => {
  it('appends the block when the description has no markers', () => {
    const block = renderManagedBlock(issue({ kind: 'epic' }), {}, undefined, 'tbd-abcd');
    const spliced = spliceManagedBlock('Human written intro.', block);
    expect('result' in spliced).toBe(true);
    if ('result' in spliced) {
      expect(spliced.result).toContain('Human written intro.');
      expect(spliced.result).toContain('tbd-abcd');
    }
  });

  it('preserves prose on both sides when replacing an existing block', () => {
    const first = renderManagedBlock(issue(), {}, undefined, 'tbd-abcd');
    const description = `Above.\n\n${first}\n\nBelow.`;
    const second = renderManagedBlock(issue({ status: 'closed' }), {}, undefined, 'tbd-abcd');

    const spliced = spliceManagedBlock(description, second);
    expect('result' in spliced).toBe(true);
    if ('result' in spliced) {
      expect(spliced.result).toContain('Above.');
      expect(spliced.result).toContain('Below.');
      expect(spliced.result).toContain('closed');
      // Exactly one managed region survives.
      expect(spliced.result.split(BLOCK_BEGIN).length - 1).toBe(1);
      expect(spliced.result.split(BLOCK_END).length - 1).toBe(1);
    }
  });

  it('refuses to guess when markers are duplicated', () => {
    const description = `${BLOCK_BEGIN}\na\n${BLOCK_END}\n${BLOCK_BEGIN}\nb\n${BLOCK_END}`;
    expect(spliceManagedBlock(description, 'x')).toEqual({ error: 'markers-malformed' });
  });

  it('refuses when the end marker precedes the begin marker', () => {
    const description = `${BLOCK_END}\nstray\n${BLOCK_BEGIN}`;
    expect(spliceManagedBlock(description, 'x')).toEqual({ error: 'markers-malformed' });
  });

  it('handles a null description', () => {
    const spliced = spliceManagedBlock(null, 'block');
    expect(spliced).toEqual({ result: 'block' });
  });

  it('includes spec and PR links when present', () => {
    const block = renderManagedBlock(
      issue({ spec_path: 'docs/project/specs/active/plan-x.md' }),
      { specUrl: 'https://example.com/spec', prUrls: ['https://github.com/o/r/pull/205'] },
      { children: 7, ready: 3 },
      'tbd-abcd',
    );
    expect(block).toContain('plan-x.md');
    expect(block).toContain('#205');
    expect(block).toContain('7 (3 ready)');
  });
});

describe('mirror selection', () => {
  it('selects epics in an active status by default', () => {
    const beads = [
      issue({ id: 'is-a', kind: 'epic', status: 'open' }),
      issue({ id: 'is-b', kind: 'task', status: 'open' }),
      issue({ id: 'is-c', kind: 'epic', status: 'closed' }),
    ];
    expect(mirrorSet(beads, DEFAULT_SELECT, 'linear').map((i) => i.id)).toEqual(['is-a']);
  });

  it('always includes an explicitly linked bead that no longer matches', () => {
    const linked = issue({
      id: 'is-linked',
      kind: 'task',
      status: 'closed',
      extensions: { linear: { id: 'uuid-1', linked_at: '2026-08-10T00:00:00.000Z' } },
    });
    expect(mirrorSet([linked], DEFAULT_SELECT, 'linear').map((i) => i.id)).toEqual(['is-linked']);
    expect(isLinkedTo(linked, 'linear')).toBe(true);
    expect(isLinkedTo(linked, 'github')).toBe(false);
  });

  it('treats an empty label list as no label requirement', () => {
    const bead = issue({ kind: 'epic', status: 'open', labels: [] });
    expect(mirrorSet([bead], DEFAULT_SELECT, 'linear')).toHaveLength(1);
  });

  it('selects a bead by its active spec even when its kind does not qualify', () => {
    const select: IntegrationSelect = { ...DEFAULT_SELECT, specs: 'active' };
    const specced = issue({
      id: 'is-spec',
      kind: 'task',
      status: 'open',
      spec_path: 'docs/project/specs/active/plan-2026-08-10-x.md',
    });
    expect(mirrorSet([specced], select, 'linear').map((i) => i.id)).toEqual(['is-spec']);
  });

  it('excludes a spec that has moved out of active/', () => {
    const select: IntegrationSelect = { ...DEFAULT_SELECT, specs: 'active' };
    const archived = issue({
      id: 'is-old',
      kind: 'task',
      status: 'open',
      spec_path: 'docs/project/specs/archive/plan-2026-01-01-x.md',
    });
    expect(mirrorSet([archived], select, 'linear')).toHaveLength(0);
  });

  it('treats kind and spec as alternatives, not requirements', () => {
    const select: IntegrationSelect = { ...DEFAULT_SELECT, specs: 'active' };
    const epicNoSpec = issue({ id: 'is-epic', kind: 'epic', status: 'open' });
    const taskWithSpec = issue({
      id: 'is-task',
      kind: 'task',
      status: 'open',
      spec_path: 'docs/project/specs/active/plan-x.md',
    });
    const neither = issue({ id: 'is-plain', kind: 'task', status: 'open' });

    expect(
      mirrorSet([epicNoSpec, taskWithSpec, neither], select, 'linear').map((i) => i.id),
    ).toEqual(['is-epic', 'is-task']);
  });

  it('keeps status as a gate over both rules, so closed spec work drops out', () => {
    const select: IntegrationSelect = { ...DEFAULT_SELECT, specs: 'active' };
    const closedWithSpec = issue({
      id: 'is-done',
      kind: 'task',
      status: 'closed',
      spec_path: 'docs/project/specs/active/plan-x.md',
    });
    expect(mirrorSet([closedWithSpec], select, 'linear')).toHaveLength(0);
  });

  it('matches any spec under the `any` rule', () => {
    const select: IntegrationSelect = { ...DEFAULT_SELECT, kinds: [], specs: 'any' };
    const anywhere = issue({ id: 'is-any', kind: 'task', status: 'open', spec_path: 'notes/x.md' });
    expect(mirrorSet([anywhere], select, 'linear')).toHaveLength(1);
  });

  it('normalizes Windows separators when matching active specs', () => {
    const select: IntegrationSelect = { ...DEFAULT_SELECT, specs: 'active' };
    const win = issue({
      id: 'is-win',
      kind: 'task',
      status: 'open',
      spec_path: 'docs\\project\\specs\\active\\plan-x.md',
    });
    expect(mirrorSet([win], select, 'linear')).toHaveLength(1);
  });

  it('requires at least one configured label when labels are set', () => {
    const select: IntegrationSelect = { ...DEFAULT_SELECT, labels: ['mirror'] };
    const without = issue({ kind: 'epic', status: 'open', labels: ['other'] });
    const withLabel = issue({ id: 'is-y', kind: 'epic', status: 'open', labels: ['mirror'] });
    expect(mirrorSet([without, withLabel], select, 'linear').map((i) => i.id)).toEqual(['is-y']);
  });
});

describe('permalinks', () => {
  it('parses SSH and HTTPS GitHub remotes', () => {
    expect(parseRepoSlug('git@github.com:jlevy/tbd.git')).toEqual({ owner: 'jlevy', repo: 'tbd' });
    expect(parseRepoSlug('https://github.com/jlevy/tbd.git')).toEqual({
      owner: 'jlevy',
      repo: 'tbd',
    });
  });

  it('returns undefined for a non-repository URL', () => {
    expect(parseRepoSlug('not a url')).toBeUndefined();
  });

  it('builds a blob URL for a branch ref', () => {
    expect(blobUrl({ owner: 'jlevy', repo: 'tbd' }, 'main', 'docs/x.md')).toBe(
      'https://github.com/jlevy/tbd/blob/main/docs/x.md',
    );
  });
});

describe('parent hierarchy guards', () => {
  const parentsOf = (map: Record<string, string | null>) => (id: string) => map[id] ?? null;

  it('rejects an issue parented to itself', () => {
    expect(checkParentAssignment('a', 'a', parentsOf({}))).toEqual({ kind: 'cycle', path: ['a'] });
  });

  it('rejects an edge that would close a loop', () => {
    // b is already a child of a; making a a child of b closes the cycle.
    const problem = checkParentAssignment('a', 'b', parentsOf({ b: 'a' }));
    expect(problem?.kind).toBe('cycle');
  });

  it('allows an ordinary nesting', () => {
    expect(checkParentAssignment('c', 'b', parentsOf({ b: 'a', a: null }))).toBeUndefined();
  });

  it('rejects an assignment that would exceed the depth limit', () => {
    const chain: Record<string, string | null> = {};
    for (let i = 0; i < MAX_PARENT_DEPTH + 2; i += 1) {
      chain[`n${i}`] = i === 0 ? null : `n${i - 1}`;
    }
    const deepest = `n${MAX_PARENT_DEPTH + 1}`;
    const problem = checkParentAssignment('new', deepest, parentsOf(chain));
    expect(problem?.kind).toBe('too_deep');
  });

  it('finds an existing cycle in stored issues without looping forever', () => {
    const a = issue({ id: 'is-a', parent_id: 'is-b' });
    const b = issue({ id: 'is-b', parent_id: 'is-a' });
    const problems = findHierarchyProblems([a, b]);
    expect(problems.length).toBeGreaterThan(0);
    expect(problems[0]?.problem.kind).toBe('cycle');
  });

  it('reports no problems for a well-formed tree', () => {
    const root = issue({ id: 'is-root' });
    const child = issue({ id: 'is-child', parent_id: 'is-root' });
    expect(findHierarchyProblems([root, child])).toEqual([]);
  });
});
