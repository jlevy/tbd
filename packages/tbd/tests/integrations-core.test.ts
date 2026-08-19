/**
 * Unit tests for the provider-agnostic integration core and the Linear mapping
 * tables.
 */

import { describe, expect, it } from 'vitest';

import { parseEnvContent } from '../src/lib/env-file.js';
import { maskSecret, CREDENTIAL_ENV_VARS } from '../src/integrations/core/credentials.js';
import {
  MANAGED_BLOCK_MARKERS,
  renderManagedBlock,
  spliceManagedBlock,
  stripManagedBlock,
} from '../src/integrations/core/managed-block.js';
import {
  mirrorSet,
  isLinkedTo,
  selectionReason,
  selectionBreakdown,
} from '../src/integrations/core/selection.js';
import { blobUrl, parseRepoSlug } from '../src/integrations/core/permalink.js';
import {
  BLOCKED_LABEL,
  DEFERRED_LABEL,
  KNOWN_STATE_TYPES,
  priorityFromLinear,
  priorityToLinear,
  statusFromLinear,
  resolutionFromLinear,
  statusToLinear,
} from '../src/integrations/linear/mapping.js';
import {
  checkParentAssignment,
  findHierarchyProblems,
  MAX_PARENT_DEPTH,
} from '../src/lib/issue-hierarchy.js';
import { IntegrationsConfigSchema, LinearIntegrationSchema } from '../src/lib/schemas.js';
import { resolvePolicy } from '../src/integrations/core/policy.js';
import {
  resolveProviderSettings,
  resolveSyncFoldMode,
  syncFoldPosture,
} from '../src/integrations/core/provider-settings.js';
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

describe('Linear terminal resolution mapping', () => {
  it('sends each resolution to its own Linear state type', () => {
    expect(statusToLinear('closed', 'completed').stateType).toBe('completed');
    expect(statusToLinear('closed', 'canceled').stateType).toBe('canceled');
    expect(statusToLinear('closed', 'duplicate').stateType).toBe('duplicate');
  });

  it('treats an absent resolution as completed, so old beads keep their meaning', () => {
    expect(statusToLinear('closed').stateType).toBe('completed');
    expect(statusToLinear('closed', null).stateType).toBe('completed');
  });

  it('ignores a resolution on non-terminal work rather than misfiling it', () => {
    // The schema forbids this pairing, but the mapping is pure and is reached from
    // paths that have not validated; position must win over a stray reason.
    expect(statusToLinear('open', 'canceled').stateType).toBe('unstarted');
  });

  it('recovers the resolution inbound instead of collapsing all three', () => {
    expect(resolutionFromLinear('completed')).toBe('completed');
    expect(resolutionFromLinear('canceled')).toBe('canceled');
    expect(resolutionFromLinear('duplicate')).toBe('duplicate');
  });

  it('reports no resolution for a non-terminal state', () => {
    for (const stateType of ['backlog', 'unstarted', 'started', 'triage', 'whatever']) {
      expect(resolutionFromLinear(stateType)).toBeNull();
    }
  });

  it('round-trips every terminal resolution losslessly', () => {
    for (const resolution of ['completed', 'canceled', 'duplicate'] as const) {
      const target = statusToLinear('closed', resolution);
      expect(statusFromLinear(target.stateType, target.labels)).toBe('closed');
      expect(resolutionFromLinear(target.stateType)).toBe(resolution);
    }
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
  const legacyMarkers = {
    begin: '<!-- tbd:begin -->',
    end: '<!-- tbd:end -->',
  } as const;

  it('renders plain-text delimiters with no Markdown or HTML semantics', () => {
    expect(MANAGED_BLOCK_MARKERS).toEqual({
      begin: '⟦tbd⟧',
      end: '⟦/tbd⟧',
    });

    const block = renderManagedBlock(issue(), {}, undefined, 'tbd-abcd');

    expect(block.startsWith(`${MANAGED_BLOCK_MARKERS.begin}\n`)).toBe(true);
    expect(block.endsWith(`\n${MANAGED_BLOCK_MARKERS.end}`)).toBe(true);
    expect(block).not.toContain('<!--');
  });

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
      expect(spliced.result.split(MANAGED_BLOCK_MARKERS.begin).length - 1).toBe(1);
      expect(spliced.result.split(MANAGED_BLOCK_MARKERS.end).length - 1).toBe(1);
    }
  });

  it('migrates a legacy block while preserving prose on both sides', () => {
    const description = `Above.\n\n${legacyMarkers.begin}\nold\n${legacyMarkers.end}\n\nBelow.`;
    const block = renderManagedBlock(issue({ status: 'closed' }), {}, undefined, 'tbd-abcd');

    expect(stripManagedBlock(description)).toBe('Above.\n\nBelow.');
    expect(spliceManagedBlock(description, block)).toEqual({
      result: `Above.\n\n${block}\n\nBelow.`,
    });
  });

  it('refuses mixed current and legacy marker pairs', () => {
    const description = `${legacyMarkers.begin}\nold\n${MANAGED_BLOCK_MARKERS.end}`;

    expect(stripManagedBlock(description)).toBe(description);
    expect(spliceManagedBlock(description, 'x')).toEqual({ error: 'markers-malformed' });
  });

  it('refuses to guess when markers are duplicated', () => {
    const { begin, end } = MANAGED_BLOCK_MARKERS;
    const description = `${begin}\na\n${end}\n${begin}\nb\n${end}`;
    expect(spliceManagedBlock(description, 'x')).toEqual({ error: 'markers-malformed' });
  });

  it('refuses when the end marker precedes the begin marker', () => {
    const { begin, end } = MANAGED_BLOCK_MARKERS;
    const description = `${end}\nstray\n${begin}`;
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

describe('label-pollution guards', () => {
  // A mirror run once created 40 Linear labels in a shared team, one per bead
  // label. These pin the defaults that prevent it, so flipping either becomes a
  // deliberate, visible change rather than a silent regression.
  it('defaults label mirroring to off', () => {
    // Asserted through resolveProviderSettings, not the raw key: as of f08 the flat
    // spelling is optional (the migration moves it to `labels.mirror`), so the default
    // lives in settings resolution — which is where every consumer reads it.
    const parsed = LinearIntegrationSchema.parse({});
    expect(resolveProviderSettings(parsed).mirrorLabels).toBe('none');
  });

  it('reads the pre-f08 flat spelling when a committed config still carries it', () => {
    // A teammate's branch can hold the old shape while this build writes the new one.
    const legacy = LinearIntegrationSchema.parse({ mirror_labels: true, team_key: 'FIN' });
    const settings = resolveProviderSettings(legacy);
    // The legacy boolean maps onto the mode that preserves its exact behavior: it
    // always meant prefixed, never verbatim.
    expect(settings.mirrorLabels).toBe('prefixed');
    expect(settings.teamKey).toBe('FIN');
  });

  it('prefers the f08 group when a config carries both spellings', () => {
    const both = LinearIntegrationSchema.parse({
      team_key: 'OLD',
      target: { team_key: 'NEW' },
    });
    expect(resolveProviderSettings(both).teamKey).toBe('NEW');
  });

  it('defaults an unconfigured integration to disabled', () => {
    expect(LinearIntegrationSchema.parse({}).enabled).toBe(false);
  });

  it('defaults selection to epics only, not every bead', () => {
    // Asserted through the resolved policy rather than the raw `select` key: as of f08
    // `select` is optional (the migration folds it into policy.outbound), so the
    // defaults live in the policy resolution, which is what selection actually reads.
    const parsed = LinearIntegrationSchema.parse({});
    const outbound = resolvePolicy(parsed).outbound;
    expect(outbound.kinds).toEqual(['epic']);
    expect(outbound.statuses).not.toContain('closed');
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

  describe('label modes (f08)', () => {
    it('defaults creation to tbd-owned labels only', () => {
      // A boolean lumped two categories together: tbd's own bounded infrastructure labels
      // and the unbounded set mirrored from beads. Creation off then silently dropped the
      // origin labels, so the engine re-asserted them on every sync forever.
      expect(resolveProviderSettings(LinearIntegrationSchema.parse({})).createLabels).toBe('tbd');
    });

    it('maps the legacy create_labels booleans onto the modes that preserve their meaning', () => {
      expect(
        resolveProviderSettings(LinearIntegrationSchema.parse({ create_labels: true }))
          .createLabels,
      ).toBe('all');
      expect(
        resolveProviderSettings(LinearIntegrationSchema.parse({ create_labels: false }))
          .createLabels,
      ).toBe('none');
    });

    it('maps the legacy mirror_labels booleans the same way', () => {
      expect(
        resolveProviderSettings(LinearIntegrationSchema.parse({ mirror_labels: true }))
          .mirrorLabels,
      ).toBe('prefixed');
      expect(
        resolveProviderSettings(LinearIntegrationSchema.parse({ mirror_labels: false }))
          .mirrorLabels,
      ).toBe('none');
    });

    it('accepts a custom origin label name, symmetric with repo', () => {
      // A workspace already using `tbd` for something else needs to pick another name.
      const parsed = LinearIntegrationSchema.parse({ labels: { origin: 'agents' } });
      expect(resolveProviderSettings(parsed).originLabel).toBe('agents');
    });

    it('rejects a mode value outside the enum instead of coercing it', () => {
      expect(() => LinearIntegrationSchema.parse({ labels: { create: 'sometimes' } })).toThrow();
      expect(() => LinearIntegrationSchema.parse({ labels: { mirror: true } })).toThrow();
    });
  });
});

describe('sync fold mode (f08)', () => {
  it('defaults to guarded when nothing is configured', () => {
    // Enabling an integration opts into folding it into `tbd sync`; it does not opt
    // into a write of unbounded size. `guarded` differs from `auto` only above the
    // bulk thresholds, so routine syncs are unaffected and a first sync that would
    // create hundreds of issues stops instead.
    expect(resolveSyncFoldMode(undefined)).toBe('guarded');
    expect(resolveSyncFoldMode({})).toBe('guarded');
  });

  it('maps the legacy boolean gate onto the modes that preserve its behavior', () => {
    expect(resolveSyncFoldMode({ sync_on_tbd_sync: true })).toBe('auto');
    expect(resolveSyncFoldMode({ sync_on_tbd_sync: false })).toBe('off');
  });

  it('honours the legacy boolean AFTER the schema has parsed the config', () => {
    // The resolver is not enough on its own. With `.default('auto')` on the new key,
    // Zod materializes it on every read, the legacy branch becomes unreachable, and a
    // repository that had turned the fold off silently starts syncing on upgrade.
    // Testing the resolver with a hand-built object misses that entirely, so this goes
    // through the schema the way real config does.
    const parsed = IntegrationsConfigSchema.parse({
      sync_on_tbd_sync: false,
      linear: { enabled: true, team_key: 'TEST' },
    });
    expect(resolveSyncFoldMode(parsed)).toBe('off');
    expect(syncFoldPosture(resolveSyncFoldMode(parsed)).runs).toBe(false);
  });

  it('still defaults to guarded through the schema when nothing is set', () => {
    // Same trap as the legacy-boolean case above: a `.default()` on the schema key
    // would materialize it on every read and pin the default in the wrong layer.
    const parsed = IntegrationsConfigSchema.parse({ linear: { enabled: true } });
    expect(resolveSyncFoldMode(parsed)).toBe('guarded');
    // The guard is the whole point of the default, so assert the posture too.
    expect(syncFoldPosture(resolveSyncFoldMode(parsed))).toEqual({
      runs: true,
      dryRun: false,
      assumeYes: false,
    });
  });

  it('prefers the new spelling when a config carries both', () => {
    expect(resolveSyncFoldMode({ on_tbd_sync: 'report', sync_on_tbd_sync: true })).toBe('report');
  });

  it('separates the two decisions the boolean welded together', () => {
    // This is the whole point of the enum. The old `true` folded in AND waived the bulk
    // guard, with no way to ask for the fold and keep the guard; `guarded` is that
    // previously unreachable combination.
    expect(syncFoldPosture('auto')).toEqual({ runs: true, dryRun: false, assumeYes: true });
    expect(syncFoldPosture('guarded')).toEqual({ runs: true, dryRun: false, assumeYes: false });
  });

  it('makes report a run that writes nothing', () => {
    const posture = syncFoldPosture('report');
    expect(posture.runs).toBe(true);
    expect(posture.dryRun).toBe(true);
  });

  it('makes off skip the fold entirely', () => {
    expect(syncFoldPosture('off').runs).toBe(false);
  });
});

describe('selection breakdown', () => {
  it('splits a set into the reasons that chose it', () => {
    // The shape that made a 799-bead mirror look reasonable as a single total:
    // one epic qualifies on kind, and its descendants inherit its spec_path and
    // qualify on the spec clause. The split is what makes that legible.
    const select: IntegrationSelect = { ...DEFAULT_SELECT, specs: 'active' };
    const spec = 'docs/project/specs/active/plan-2026-08-10-x.md';
    const beads = [
      issue({ id: 'is-epic', kind: 'epic', status: 'open', spec_path: spec }),
      issue({ id: 'is-kid-1', kind: 'task', status: 'open', spec_path: spec }),
      issue({ id: 'is-kid-2', kind: 'task', status: 'open', spec_path: spec }),
      issue({ id: 'is-kid-3', kind: 'task', status: 'open', spec_path: spec }),
      issue({ id: 'is-unrelated', kind: 'task', status: 'open' }),
    ];

    const selected = mirrorSet(beads, select, 'linear');
    expect(selected).toHaveLength(4);
    expect(selectionBreakdown(selected, select, 'linear')).toEqual({
      linked: 0,
      kind: 1,
      spec: 3,
      gates: 0,
    });
  });

  it('attributes a bead that matches both rules to its kind', () => {
    // Otherwise an epic carrying a live spec inflates the spec count, which is
    // the number the operator is trying to judge.
    const select: IntegrationSelect = { ...DEFAULT_SELECT, specs: 'active' };
    const both = issue({
      kind: 'epic',
      status: 'open',
      spec_path: 'docs/project/specs/active/plan-2026-08-10-x.md',
    });
    expect(selectionReason(both, select, 'linear')).toBe('kind');
  });

  it('reports no reason for a bead the rules exclude', () => {
    expect(selectionReason(issue({ kind: 'task', status: 'open' }), DEFAULT_SELECT, 'linear')).toBe(
      undefined,
    );
    expect(
      selectionReason(issue({ kind: 'epic', status: 'closed' }), DEFAULT_SELECT, 'linear'),
    ).toBe(undefined);
  });

  it('counts a linked bead as linked even when it no longer matches', () => {
    const linked = issue({
      kind: 'task',
      status: 'closed',
      extensions: { linear: { id: 'uuid-1', linked_at: '2026-08-10T00:00:00.000Z' } },
    });
    expect(selectionReason(linked, DEFAULT_SELECT, 'linear')).toBe('linked');
  });

  it('agrees with mirrorSet on which beads qualify', () => {
    // The breakdown is only trustworthy if it explains the same decision the
    // mirror actually made, so tie the two together rather than asserting counts
    // that could drift apart.
    const select: IntegrationSelect = { ...DEFAULT_SELECT, specs: 'active' };
    const beads = [
      issue({ id: 'is-1', kind: 'epic', status: 'open' }),
      issue({ id: 'is-2', kind: 'task', status: 'open' }),
      issue({ id: 'is-3', kind: 'epic', status: 'closed' }),
      issue({
        id: 'is-4',
        kind: 'task',
        status: 'open',
        spec_path: 'docs/project/specs/active/plan.md',
      }),
    ];
    const withReason = beads.filter((b) => selectionReason(b, select, 'linear') !== undefined);
    expect(withReason.map((b) => b.id)).toEqual(
      mirrorSet(beads, select, 'linear').map((b) => b.id),
    );
  });
});
