/**
 * Mirror planning and application.
 *
 * Planning is pure, so most of this asserts on the plan rather than on effects.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { LinearAdapter } from '../src/integrations/linear/adapter.js';
import { LinearClient } from '../src/integrations/linear/client.js';
import {
  applyMirror,
  attachmentsFor,
  beadAttachmentUrl,
  linkFor,
  planMirror,
  prefixLabels,
} from '../src/integrations/core/mirror.js';
import { LinearMockServer } from './helpers/linear-mock-server.js';
import type { Issue, LinkedEntryType } from '../src/lib/types.js';

function issue(overrides: Partial<Issue> = {}): Issue {
  return {
    type: 'is',
    id: 'is-01test',
    version: 1,
    title: 'Test',
    kind: 'epic',
    status: 'open',
    priority: 2,
    labels: [],
    dependencies: [],
    created_at: '2026-08-10T00:00:00.000Z',
    updated_at: '2026-08-10T00:00:00.000Z',
    ...overrides,
  } as Issue;
}

const displayId = (id: string): string => id.replace('is-', 'tbd-');

describe('planMirror', () => {
  it('plans a create for a bead with no existing link', () => {
    const bead = issue({ id: 'is-a' });
    const plan = planMirror({
      provider: 'linear',
      allIssues: [bead],
      selected: [bead],
      displayId,
      maxNesting: 2,
    });

    expect(plan.creates).toHaveLength(1);
    expect(plan.updates).toHaveLength(0);
    expect(plan.creates[0]?.patch).toMatchObject({ title: 'Test', status: 'open', priority: 2 });
  });

  it('plans an update for an already-linked bead', () => {
    const bead = issue({
      id: 'is-a',
      extensions: { linear: { id: 'uuid-1', linked_at: '2026-08-10T00:00:00.000Z' } },
    });
    const plan = planMirror({
      provider: 'linear',
      allIssues: [bead],
      selected: [bead],
      displayId,
      maxNesting: 2,
    });

    expect(plan.updates).toHaveLength(1);
    expect(plan.updates[0]?.externalId).toBe('uuid-1');
  });

  it('ignores a link belonging to a different provider', () => {
    const bead = issue({
      id: 'is-a',
      extensions: { github: { id: 'gh-1', linked_at: '2026-08-10T00:00:00.000Z' } },
    });
    const plan = planMirror({
      provider: 'linear',
      allIssues: [bead],
      selected: [bead],
      displayId,
      maxNesting: 2,
    });

    expect(plan.creates).toHaveLength(1);
    expect(linkFor(bead, 'github')?.id).toBe('gh-1');
    expect(linkFor(bead, 'linear')).toBeUndefined();
  });

  it('skips a new bead nested deeper than max_nesting rather than flattening it', () => {
    const root = issue({ id: 'is-root' });
    const mid = issue({ id: 'is-mid', parent_id: 'is-root' });
    const deep = issue({ id: 'is-deep', parent_id: 'is-mid' });

    const plan = planMirror({
      provider: 'linear',
      allIssues: [root, mid, deep],
      selected: [root, mid, deep],
      displayId,
      maxNesting: 2,
    });

    expect(plan.creates.map((a) => a.bead.id)).toEqual(['is-root', 'is-mid']);
    expect(plan.skips).toHaveLength(1);
    expect(plan.skips[0]?.skipReason).toContain('max_nesting');
  });

  it('updates an already-linked bead beyond max_nesting', () => {
    const root = issue({ id: 'is-root' });
    const mid = issue({ id: 'is-mid', parent_id: 'is-root' });
    const deep = issue({
      id: 'is-deep',
      parent_id: 'is-mid',
      extensions: {
        linear: { id: 'linear-deep', linked_at: '2026-08-10T00:00:00.000Z' },
      },
    });

    const plan = planMirror({
      provider: 'linear',
      allIssues: [root, mid, deep],
      selected: [root, mid, deep],
      displayId,
      maxNesting: 2,
    });

    expect(plan.updates.map((action) => action.bead.id)).toContain('is-deep');
    expect(plan.skips.map((action) => action.bead.id)).not.toContain('is-deep');
  });

  it('leaves the provider parent unchanged when a linked deep bead has a skipped parent', () => {
    const root = issue({ id: 'is-root' });
    const mid1 = issue({ id: 'is-mid1', parent_id: root.id });
    const mid2 = issue({ id: 'is-mid2', parent_id: mid1.id });
    const deep = issue({
      id: 'is-deep',
      parent_id: mid2.id,
      extensions: {
        linear: { id: 'linear-deep', linked_at: '2026-08-10T00:00:00.000Z' },
      },
    });

    const plan = planMirror({
      provider: 'linear',
      allIssues: [root, mid1, mid2, deep],
      selected: [root, mid1, mid2, deep],
      displayId,
      maxNesting: 2,
    });

    const deepAction = plan.updates.find((action) => action.bead.id === deep.id);
    expect(plan.skips.map((action) => action.bead.id)).toContain(mid2.id);
    expect(deepAction?.parentBeadId).toBeUndefined();
    expect(deepAction?.patch).not.toHaveProperty('parentId');
  });

  it('treats a bead whose parent is not mirrored as a root', () => {
    const unmirroredParent = issue({ id: 'is-parent' });
    const child = issue({ id: 'is-child', parent_id: 'is-parent' });

    const plan = planMirror({
      provider: 'linear',
      allIssues: [unmirroredParent, child],
      // Only the child is selected, so it has no mirrored ancestor.
      selected: [child],
      displayId,
      maxNesting: 1,
    });

    expect(plan.creates).toHaveLength(1);
    expect(plan.skips).toHaveLength(0);
  });

  it('does not hang on a pre-existing parent cycle', () => {
    const a = issue({ id: 'is-a', parent_id: 'is-b' });
    const b = issue({ id: 'is-b', parent_id: 'is-a' });

    const plan = planMirror({
      provider: 'linear',
      allIssues: [a, b],
      selected: [a, b],
      displayId,
      maxNesting: 5,
    });

    expect(plan.creates.length + plan.skips.length).toBe(2);
  });

  it('counts children and ready children for the summary', () => {
    const epic = issue({ id: 'is-epic' });
    const readyChild = issue({ id: 'is-c1', kind: 'task', parent_id: 'is-epic', status: 'open' });
    const blockedChild = issue({
      id: 'is-c2',
      kind: 'task',
      parent_id: 'is-epic',
      status: 'open',
      assignee: 'someone',
    });

    const plan = planMirror({
      provider: 'linear',
      allIssues: [epic, readyChild, blockedChild],
      selected: [epic],
      displayId,
      maxNesting: 2,
    });

    const block = plan.creates[0]?.managedBlock ?? '';
    // Two children, one of them ready (the other is claimed).
    expect(block).toContain('Children: 2 (1 ready)');
  });
});

describe('label mirroring', () => {
  it('does not push bead labels by default, so a shared team namespace stays clean', () => {
    const bead = issue({ id: 'is-a', labels: ['backend', 'ci', 'docs'] });
    const plan = planMirror({
      provider: 'linear',
      allIssues: [bead],
      selected: [bead],
      displayId,
      maxNesting: 2,
    });

    // `labels` absent entirely, not []: sending an empty array would strip
    // labels a human applied in the tracker.
    expect(plan.creates[0]?.patch.labels).toBeUndefined();
  });

  it('pushes prefixed labels when explicitly enabled', () => {
    const bead = issue({ id: 'is-a', labels: ['backend', 'ci'] });
    const plan = planMirror({
      provider: 'linear',
      allIssues: [bead],
      selected: [bead],
      displayId,
      maxNesting: 2,
      mirrorLabels: 'prefixed',
    });

    expect(plan.creates[0]?.patch.labels).toEqual(['tbd:backend', 'tbd:ci']);
  });

  it('does not double-prefix a label that already carries one', () => {
    expect(prefixLabels(['tbd:blocked', 'ci'])).toEqual(['tbd:blocked', 'tbd:ci']);
  });

  it('still records the labels in attachment metadata regardless', () => {
    const bead = issue({ labels: ['backend'] });
    const [attachment] = attachmentsFor(bead, 'tbd-abcd', {}, { children: 0, ready: 0 });
    expect(attachment?.metadata).toMatchObject({ labels: ['backend'] });
  });
});

describe('attachmentsFor', () => {
  it('keys the bead attachment on a stable tbd url', () => {
    const attachments = attachmentsFor(issue(), 'tbd-abcd', {}, { children: 0, ready: 0 });
    expect(attachments[0]?.url).toBe(beadAttachmentUrl('tbd-abcd'));
    expect(beadAttachmentUrl('tbd-abcd')).toBe('tbd://bead/tbd-abcd');
  });

  it('carries the full canonical field set in metadata, including nested values', () => {
    const bead = issue({
      labels: ['backend'],
      dependencies: [{ type: 'blocks', target: 'is-other' }],
      spec_path: 'docs/x.md',
    });
    const [attachment] = attachmentsFor(bead, 'tbd-abcd', {}, { children: 3, ready: 1 });

    expect(attachment?.metadata).toMatchObject({
      bead_id: 'tbd-abcd',
      labels: ['backend'],
      spec_path: 'docs/x.md',
      children: 3,
      ready_children: 1,
      dependencies: [{ type: 'blocks', target: 'is-other' }],
    });
  });

  it('gives the spec and repo links their own urls so each upserts independently', () => {
    const bead = issue({ spec_path: 'docs/project/specs/active/plan-x.md' });
    const attachments = attachmentsFor(
      bead,
      'tbd-abcd',
      { specUrl: 'https://example.com/spec', repoUrl: 'https://example.com/bead' },
      { children: 0, ready: 0 },
    );

    const urls = attachments.map((a) => a.url);
    expect(new Set(urls).size).toBe(urls.length);
    expect(urls).toContain('https://example.com/spec');
  });

  it('omits the spec attachment when the bead has no spec', () => {
    const attachments = attachmentsFor(
      issue({ spec_path: null }),
      'tbd-abcd',
      { specUrl: 'https://example.com/spec' },
      { children: 0, ready: 0 },
    );
    expect(attachments).toHaveLength(1);
  });
});

describe('applyMirror', () => {
  let server: LinearMockServer;
  let adapter: LinearAdapter;
  let linked: { issue: Issue; entry: LinkedEntryType }[];

  beforeEach(async () => {
    server = new LinearMockServer();
    const endpoint = await server.start();
    adapter = new LinearAdapter({
      client: new LinearClient({ apiKey: 'k', endpoint, sleep: () => Promise.resolve() }),
      teamKey: 'FIN',
    });
    linked = [];
  });

  afterEach(async () => {
    await server.stop();
  });

  const onLinked = async (issue: Issue, entry: LinkedEntryType): Promise<void> => {
    linked.push({ issue, entry });
    return Promise.resolve();
  };

  it('creates an external item, records the link, and writes attachments', async () => {
    const bead = issue({ id: 'is-a', title: 'Mirror me' });
    const plan = planMirror({
      provider: 'linear',
      allIssues: [bead],
      selected: [bead],
      displayId,
      maxNesting: 2,
    });

    const report = await applyMirror({ adapter, plan, displayId, onLinked });

    expect(report.created).toEqual(['tbd-a']);
    expect(report.failures).toEqual([]);
    expect(linked).toHaveLength(1);
    expect(server.attachments.length).toBeGreaterThan(0);
  });

  it('creates selected parents before children and preserves provider hierarchy', async () => {
    const parent = issue({ id: 'is-parent', title: 'Parent' });
    const child = issue({ id: 'is-child', title: 'Child', parent_id: parent.id });
    const plan = planMirror({
      provider: 'linear',
      allIssues: [child, parent],
      selected: [child, parent],
      displayId,
      maxNesting: 2,
    });

    const report = await applyMirror({ adapter, plan, displayId, onLinked });

    const parentRef = linked.find((item) => item.issue.id === parent.id)?.entry;
    const childRef = linked.find((item) => item.issue.id === child.id)?.entry;
    expect(report.created).toEqual(['tbd-parent', 'tbd-child']);
    expect(report.failures).toEqual([]);
    expect(server.issues.get(childRef!.id)?.parent?.id).toBe(parentRef?.id);
  });

  it('is idempotent on a second run: attachments upsert rather than duplicate', async () => {
    const bead = issue({ id: 'is-a' });
    const first = planMirror({
      provider: 'linear',
      allIssues: [bead],
      selected: [bead],
      displayId,
      maxNesting: 2,
    });
    await applyMirror({ adapter, plan: first, displayId, onLinked });

    const externalId = linked[0]?.entry.id ?? '';
    const relinked = issue({
      id: 'is-a',
      extensions: { linear: { id: externalId, linked_at: '2026-08-10T00:00:00.000Z' } },
    });
    const attachmentsAfterFirst = server.attachments.length;

    const second = planMirror({
      provider: 'linear',
      allIssues: [relinked],
      selected: [relinked],
      displayId,
      maxNesting: 2,
    });
    const report = await applyMirror({ adapter, plan: second, displayId, onLinked });

    expect(report.updated).toEqual(['tbd-a']);
    expect(server.attachments.length).toBe(attachmentsAfterFirst);
  });

  it('reports a failing bead and still mirrors the rest', async () => {
    const good = issue({ id: 'is-good' });
    const bad = issue({
      id: 'is-bad',
      // Points at an external item that does not exist, so the update fails.
      extensions: { linear: { id: 'missing-uuid', linked_at: '2026-08-10T00:00:00.000Z' } },
    });

    const plan = planMirror({
      provider: 'linear',
      allIssues: [good, bad],
      selected: [good, bad],
      displayId,
      maxNesting: 2,
    });
    const report = await applyMirror({ adapter, plan, displayId, onLinked });

    expect(report.created).toEqual(['tbd-good']);
    expect(report.failures).toHaveLength(1);
    expect(report.failures[0]?.beadId).toBe('tbd-bad');
  });

  it('reports skipped beads without contacting the API for them', async () => {
    const root = issue({ id: 'is-root' });
    const mid = issue({ id: 'is-mid', parent_id: 'is-root' });
    const deep = issue({ id: 'is-deep', parent_id: 'is-mid' });

    const plan = planMirror({
      provider: 'linear',
      allIssues: [root, mid, deep],
      selected: [root, mid, deep],
      displayId,
      maxNesting: 2,
    });
    const report = await applyMirror({ adapter, plan, displayId, onLinked });

    expect(report.skipped).toHaveLength(1);
    expect(report.skipped[0]?.beadId).toBe('tbd-deep');
  });

  it('updates a linked deep bead when its selected parent is skipped', async () => {
    server.addIssue({ id: 'linear-mid2', identifier: 'FIN-20' });
    server.addIssue({
      id: 'linear-deep',
      identifier: 'FIN-21',
      parent: { id: 'linear-mid2', identifier: 'FIN-20' },
    });
    const root = issue({ id: 'is-root' });
    const mid1 = issue({ id: 'is-mid1', parent_id: root.id });
    const mid2 = issue({ id: 'is-mid2', parent_id: mid1.id });
    const deep = issue({
      id: 'is-deep',
      parent_id: mid2.id,
      extensions: {
        linear: { id: 'linear-deep', linked_at: '2026-08-10T00:00:00.000Z' },
      },
    });
    const plan = planMirror({
      provider: 'linear',
      allIssues: [root, mid1, mid2, deep],
      selected: [root, mid1, mid2, deep],
      displayId,
      maxNesting: 2,
    });

    const report = await applyMirror({ adapter, plan, displayId, onLinked });

    expect(report.failures).toEqual([]);
    expect(report.updated).toContain('tbd-deep');
    expect(server.issues.get('linear-deep')?.parent?.id).toBe('linear-mid2');
  });

  it.each([
    ['renumbered by a team move', 'uuid-moved', 'TBD-4', 'FIN-11'],
    ['unchanged', 'uuid-same', 'FIN-20', 'FIN-20'],
  ])('never rewrites the bead when the identifier is %s', async (_case, id, remoteKey, beadKey) => {
    // Linear identifiers are team-scoped, so a team rename or a cross-team move
    // renumbers issues. Mirroring used to chase that here, refetching each
    // updated issue to refresh the bead's copy. It no longer does: the
    // identifier lives on the bridge record, which the sync engine rewrites
    // from the remote it already holds. Rewriting the bead would churn
    // `version` and `updated_at` on every rename, in a file committed to git.
    server.addIssue({ id, identifier: remoteKey, title: 'Moved' });
    const bead = issue({
      id: 'is-moved',
      extensions: {
        linear: {
          id,
          key: beadKey,
          url: 'old',
          linked_at: '2026-08-10T00:00:00.000Z',
        },
      },
    });

    const plan = planMirror({
      provider: 'linear',
      allIssues: [bead],
      selected: [bead],
      displayId,
      maxNesting: 2,
    });
    await applyMirror({ adapter, plan, displayId, onLinked });

    expect(linked).toHaveLength(0);
  });

  it('writes the managed block into the description', async () => {
    const bead = issue({ id: 'is-a', title: 'Described' });
    const plan = planMirror({
      provider: 'linear',
      allIssues: [bead],
      selected: [bead],
      displayId,
      maxNesting: 2,
    });
    await applyMirror({ adapter, plan, displayId, onLinked });

    const externalId = linked[0]?.entry.id ?? '';
    expect(server.issues.get(externalId)?.description).toContain('tbd-a');
  });
});
