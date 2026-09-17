/**
 * The `linear: epics` policy grant, pinned to the integration it names.
 *
 * `agent-policy-grants` defines `epics` as an outbound selection of `kinds: [epic]`,
 * `specs: none`, and open statuses, with linked pairs reconciled both ways by
 * `tbd sync` and no beads created from new Linear issues unless the user asks;
 * `setup-linear` ships the exact YAML for it. These tests keep the guideline, the
 * shortcut, and the code in agreement: the shipped YAML resolves to that selection,
 * the selection picks only open epic beads and is a strict subset of `policy: default`,
 * the policy's `field_sync` flows in both directions for the merged fields, and its
 * inbound clause reports rather than imports.
 */

import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';

import { descriptionHash } from '../src/integrations/core/bridge-state.js';
import { presetPolicy, resolvePolicy } from '../src/integrations/core/policy.js';
import { reconcile, type LocalView, type RemoteView } from '../src/integrations/core/reconcile.js';
import { mirrorSet, selectionReason } from '../src/integrations/core/selection.js';
import { IntegrationsConfigSchema, PolicyDefinitionSchema } from '../src/lib/schemas.js';
import type { BridgeBase, Issue, PolicyDefinition } from '../src/lib/types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SETUP_LINEAR = join(__dirname, '..', 'docs', 'shortcuts', 'standard', 'setup-linear.md');

/** The `epics` grant as the guideline states it: an outbound clause and nothing else. */
const EPICS_POLICY: PolicyDefinition = PolicyDefinitionSchema.parse({
  outbound: { kinds: ['epic'], specs: 'none', statuses: ['open', 'in_progress', 'blocked'] },
});

const ACTIVE_SPEC = 'docs/project/specs/active/plan-2026-09-16-x.md';

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
    created_at: '2026-09-16T00:00:00.000Z',
    updated_at: '2026-09-16T00:00:00.000Z',
    ...overrides,
  };
}

/** Every case the selection has to decide, in one store. */
const BEADS: Issue[] = [
  issue({ id: 'is-epic-open', kind: 'epic', status: 'open' }),
  issue({ id: 'is-epic-started', kind: 'epic', status: 'in_progress' }),
  issue({ id: 'is-epic-blocked', kind: 'epic', status: 'blocked' }),
  issue({ id: 'is-epic-specced', kind: 'epic', status: 'open', spec_path: ACTIVE_SPEC }),
  issue({ id: 'is-epic-closed', kind: 'epic', status: 'closed' }),
  issue({ id: 'is-task-open', kind: 'task', status: 'open' }),
  issue({ id: 'is-task-specced', kind: 'task', status: 'open', spec_path: ACTIVE_SPEC }),
  issue({
    id: 'is-feature-specced',
    kind: 'feature',
    status: 'in_progress',
    spec_path: ACTIVE_SPEC,
  }),
];

const OPEN_EPICS = ['is-epic-open', 'is-epic-started', 'is-epic-blocked', 'is-epic-specced'];

function selectedIds(policy: PolicyDefinition, beads: readonly Issue[] = BEADS): string[] {
  return mirrorSet(beads, policy.outbound, 'linear').map((bead) => bead.id);
}

describe('the YAML setup-linear ships for linear: epics', () => {
  it('resolves to the epics outbound clause with the other clauses at their defaults', async () => {
    const doc = await readFile(SETUP_LINEAR, 'utf-8');
    const yamlBlocks = [...doc.matchAll(/```yaml\n([\s\S]*?)```/g)].map((match) => match[1] ?? '');
    const epicsBlock = yamlBlocks.find((block) => block.includes('kinds: [epic]'));
    expect(epicsBlock, 'setup-linear must ship the epics selection as YAML').toBeDefined();

    const parsed = parseYaml(epicsBlock!) as { integrations?: unknown };
    const config = IntegrationsConfigSchema.parse(parsed.integrations);
    expect(config.linear?.enabled).toBe(true);

    expect(resolvePolicy(config.linear!)).toEqual(EPICS_POLICY);
  });
});

describe('the epics selection', () => {
  it('selects epics in an open status and nothing else', () => {
    expect(selectedIds(EPICS_POLICY)).toEqual(OPEN_EPICS);
  });

  it('selects by kind alone: a spec neither qualifies a bead nor explains an epic', () => {
    for (const bead of BEADS) {
      const reason = selectionReason(bead, EPICS_POLICY.outbound, 'linear');
      expect(reason, bead.id).toBe(OPEN_EPICS.includes(bead.id) ? 'kind' : undefined);
    }
  });

  it('keeps a linked epic once it closes, so the close reaches Linear', () => {
    const closedLinked = issue({
      id: 'is-epic-done',
      kind: 'epic',
      status: 'closed',
      extensions: { linear: { id: 'uuid-1', linked_at: '2026-09-16T00:00:00.000Z' } },
    });
    expect(selectedIds(EPICS_POLICY, [...BEADS, closedLinked])).toEqual([
      ...OPEN_EPICS,
      'is-epic-done',
    ]);
    expect(selectionReason(closedLinked, EPICS_POLICY.outbound, 'linear')).toBe('linked');
  });

  it('is a strict subset of policy: default, which adds the active-spec beads', () => {
    const byDefault = selectedIds(presetPolicy('default'));
    const byEpics = selectedIds(EPICS_POLICY);
    expect(byEpics.every((id) => byDefault.includes(id))).toBe(true);
    expect(byDefault.filter((id) => !byEpics.includes(id))).toEqual([
      'is-task-specced',
      'is-feature-specced',
    ]);
  });

  it('differs from policy: default only by the spec clause, which epics + specs names', () => {
    const preset = presetPolicy('default');
    expect(preset.outbound).toEqual({ ...EPICS_POLICY.outbound, specs: 'active' });
    expect(preset.inbound).toEqual(EPICS_POLICY.inbound);
    expect(preset.field_sync).toEqual(EPICS_POLICY.field_sync);
  });
});

describe('reconciliation under the epics policy', () => {
  const rules = EPICS_POLICY.field_sync;

  function local(overrides: Partial<LocalView> = {}): LocalView {
    return {
      title: 'T',
      description: 'Body',
      status: 'open',
      priority: 2,
      labels: [],
      assignee: null,
      updated_at: '2026-09-16T12:00:00.000Z',
      ...overrides,
    };
  }

  function remote(overrides: Partial<RemoteView> = {}): RemoteView {
    return {
      title: 'T',
      description: 'Body',
      status: 'open',
      priority: 2,
      labels: [],
      assignee: null,
      updatedAt: '2026-09-16T12:00:00.000Z',
      ...overrides,
    };
  }

  function base(): BridgeBase {
    return {
      title: 'T',
      status: 'open',
      priority: 2,
      labels: [],
      assignee: null,
      description_hash: descriptionHash('Body'),
    };
  }

  it('merges content and triage fields both ways and keeps labels and assignee bead-owned', () => {
    expect(rules.fields).toEqual({
      title: 'merge',
      description: 'merge',
      status: 'merge',
      priority: 'merge',
      labels: 'local',
      assignee: 'local',
    });
    expect(rules.comments).toBe('two_way');
    expect(rules.tie_break).toBe('newest');
  });

  it('pushes a bead-side edit to Linear', () => {
    const result = reconcile(base(), local({ title: 'Renamed in tbd' }), remote(), rules);
    expect(result.externalPatch).toEqual({ title: 'Renamed in tbd' });
    expect(result.beadPatch).toEqual({});
    expect(result.conflicts).toEqual([]);
  });

  it('pulls a Linear-side edit into the bead', () => {
    const result = reconcile(
      base(),
      local(),
      remote({ status: 'in_progress', priority: 1 }),
      rules,
    );
    expect(result.beadPatch).toEqual({ status: 'in_progress', priority: 1 });
    expect(result.externalPatch).toEqual({});
    expect(result.conflicts).toEqual([]);
  });

  it('overwrites a Linear-side label edit and reports it, because labels are bead-owned', () => {
    const result = reconcile(base(), local(), remote({ labels: ['from-linear'] }), rules);
    expect(result.externalPatch).toEqual({ labels: [] });
    expect(result.beadPatch).toEqual({});
    expect(result.overwrites).toEqual([
      { field: 'labels', direction: 'push', overwrittenValue: ['from-linear'] },
    ]);
  });
});

describe('inbound under the epics policy', () => {
  it('reports unlinked Linear issues and creates no beads from them', () => {
    // `report` lists importable items; only `auto`, or an explicit
    // `tbd integration sync --pull --external <ref>`, runs the import. The engine-level
    // proof is the report-versus-auto case in integrations-sync-engine.test.ts.
    expect(EPICS_POLICY.inbound.mode).toBe('report');
  });

  it('has no kind clause: `kinds: [epic]` constrains the outbound direction only', () => {
    expect(EPICS_POLICY.inbound).toEqual({ mode: 'report', labels: [], as_kind: 'task' });
  });
});
