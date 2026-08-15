/**
 * The one-way mirror: bead state projected outward to an external tracker.
 *
 * Planning is pure and performs no writes, so `--dry-run` and a real run share
 * one code path and the plan a user reviews is exactly the plan that executes.
 *
 * Nothing is ever imported here. That is what makes the mirror safe to run from
 * any agent at any time: there is no merge, no base, and no conflict.
 */

import type { Issue, LinkedEntryType, ProviderNameType } from '../../lib/types.js';
import { readyIssueIds } from '../../lib/issue-selection.js';
import { readLink } from './link-store.js';
import { renderManagedBlock, type MirrorLinks } from './managed-block.js';
import type {
  AttachmentSpec,
  CanonicalPatch,
  MirrorAction,
  MirrorPlan,
  MirrorReport,
  TrackerAdapter,
} from './types.js';

/**
 * Prefix mirrored bead labels so they are identifiable as tbd's and can be
 * removed in bulk if someone turns the option off again.
 */
export function prefixLabels(labels: readonly string[]): string[] {
  return labels.map((label) => (label.startsWith('tbd:') ? label : `tbd:${label}`));
}

/** Attachment url scheme identifying a bead. Also the upsert idempotency key. */
export function beadAttachmentUrl(displayId: string): string {
  return `tbd://bead/${displayId}`;
}

export interface MirrorContext {
  provider: ProviderNameType;
  /** Every bead, needed for child counts and readiness. */
  allIssues: readonly Issue[];
  /** The beads to mirror. */
  selected: readonly Issue[];
  /** Renders an internal id the way a user sees it. */
  displayId: (id: string) => string;
  /** Permalink for a bead's spec, when one is resolvable. */
  specUrl?: (issue: Issue) => string | undefined;
  /** Permalink for the bead file itself. */
  repoUrl?: (issue: Issue) => string | undefined;
  /** Levels of nesting to create. Already-linked beads remain synchronizable. */
  maxNesting: number;
  /**
   * Push bead labels as tracker labels. Off by default: a repo can carry a
   * hundred-plus distinct labels, and creating one per label pollutes a shared
   * team namespace. They are mirrored as attachment metadata regardless.
   */
  mirrorLabels?: boolean;
  /**
   * Labels every mirrored item must carry: the plain `tbd` marker and the
   * `repo/<name>` group label. Applied additively (see `ensureLabels`), so asserting
   * them never removes a label a person applied in the tracker.
   *
   * These apply regardless of `mirrorLabels`, which governs a different question — that
   * one is about projecting the repository's own bead labels, this one is about making
   * agent traffic identifiable at all.
   */
  originLabels?: readonly string[];
  /** Provider/config capability for projecting a canonical assignee. */
  canPushAssignee?: (assignee: string | null) => boolean;
}

/**
 * Depth of a bead below the shallowest mirrored ancestor.
 *
 * Depth is measured within the selected set: a bead whose parent is not mirrored
 * is itself a root, since mirroring it under an absent parent is meaningless.
 */
export function depthWithinSelection(
  issue: Issue,
  selectedIds: ReadonlySet<string>,
  byId: Map<string, Issue>,
): number {
  let depth = 1;
  let current = issue.parent_id;
  const seen = new Set<string>([issue.id]);

  while (current && selectedIds.has(current)) {
    // Defensive: a cycle is rejected on the write path, but a store written by
    // an older CLI could still contain one, and this must not hang.
    if (seen.has(current)) {
      break;
    }
    seen.add(current);
    depth += 1;
    current = byId.get(current)?.parent_id ?? null;
  }
  return depth;
}

/** Stable parent-before-child order within the selected projection. */
function orderSelectedParentFirst(selected: readonly Issue[]): Issue[] {
  const byId = new Map(selected.map((issue) => [issue.id, issue]));
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const ordered: Issue[] = [];

  const visit = (issue: Issue): void => {
    if (visited.has(issue.id) || visiting.has(issue.id)) {
      return;
    }
    visiting.add(issue.id);
    const parent = issue.parent_id ? byId.get(issue.parent_id) : undefined;
    if (parent) {
      visit(parent);
    }
    visiting.delete(issue.id);
    visited.add(issue.id);
    ordered.push(issue);
  };
  for (const issue of selected) {
    visit(issue);
  }
  return ordered;
}

/** Existing link for a provider, if any. */
export function linkFor(issue: Issue, provider: ProviderNameType): LinkedEntryType | undefined {
  return readLink(issue, provider);
}

/**
 * Build the attachments for a bead.
 *
 * Each carries its own stable url, so each upserts independently and a changed
 * spec link does not disturb the bead metadata attachment.
 */
export function attachmentsFor(
  issue: Issue,
  displayId: string,
  links: MirrorLinks,
  counts: { children: number; ready: number },
): AttachmentSpec[] {
  const attachments: AttachmentSpec[] = [
    {
      url: beadAttachmentUrl(displayId),
      title: `${displayId} · ${issue.kind}`,
      subtitle: `${issue.status} · P${issue.priority}`,
      // Linear has no custom fields, so the full canonical field set rides here.
      // Nested values are accepted despite the docs describing string and number
      // values only.
      metadata: {
        bead_id: displayId,
        internal_id: issue.id,
        kind: issue.kind,
        status: issue.status,
        priority: issue.priority,
        labels: issue.labels ?? [],
        assignee: issue.assignee ?? null,
        spec_path: issue.spec_path ?? null,
        parent_id: issue.parent_id ?? null,
        children: counts.children,
        ready_children: counts.ready,
        created_at: issue.created_at,
        updated_at: issue.updated_at,
        dependencies: (issue.dependencies ?? []).map((d) => ({
          type: d.type,
          target: d.target,
        })),
      },
    },
  ];

  if (links.specUrl && issue.spec_path) {
    attachments.push({
      url: links.specUrl,
      title: issue.spec_path.split('/').pop() ?? 'spec',
      subtitle: 'plan spec',
    });
  }
  if (links.repoUrl) {
    attachments.push({
      url: links.repoUrl,
      title: `${displayId}.md`,
      subtitle: 'bead source',
    });
  }
  return attachments;
}

/**
 * Compute what a mirror run would do. Pure.
 */
export function planMirror(context: MirrorContext): MirrorPlan {
  const byId = new Map(context.allIssues.map((issue) => [issue.id, issue]));
  const selectedIds = new Set(context.selected.map((issue) => issue.id));
  const readyIds = readyIssueIds(context.allIssues);

  const childrenOf = new Map<string, Issue[]>();
  for (const issue of context.allIssues) {
    if (issue.parent_id) {
      const siblings = childrenOf.get(issue.parent_id) ?? [];
      siblings.push(issue);
      childrenOf.set(issue.parent_id, siblings);
    }
  }

  const plan: MirrorPlan = { provider: context.provider, creates: [], updates: [], skips: [] };

  for (const issue of orderSelectedParentFirst(context.selected)) {
    const displayId = context.displayId(issue.id);
    const depth = depthWithinSelection(issue, selectedIds, byId);
    const existingLink = linkFor(issue, context.provider);

    if (depth > context.maxNesting && !existingLink) {
      plan.skips.push({
        bead: issue,
        patch: {},
        attachments: [],
        managedBlock: null,
        skipReason: `nested ${depth} levels, past max_nesting ${context.maxNesting}`,
      });
      continue;
    }
    const linkedBeyondMaxNesting = depth > context.maxNesting;

    const children = childrenOf.get(issue.id) ?? [];
    const counts = {
      children: children.length,
      ready: children.filter((child) => readyIds.has(child.id)).length,
    };

    const links: MirrorLinks = {
      specUrl: context.specUrl?.(issue),
      repoUrl: context.repoUrl?.(issue),
    };

    // A deep linked bead is synchronized only by exemption from the creation
    // limit. Its selected parent may itself be skipped, so leave the provider
    // hierarchy untouched instead of requiring that parent to be mirrored.
    const parentBeadId =
      !linkedBeyondMaxNesting && issue.parent_id && selectedIds.has(issue.parent_id)
        ? issue.parent_id
        : undefined;
    const parentLink = parentBeadId
      ? linkFor(byId.get(parentBeadId)!, context.provider)
      : undefined;
    const patch: CanonicalPatch = {
      title: issue.title,
      status: issue.status,
      priority: issue.priority,
      ...(!linkedBeyondMaxNesting ? { parentId: parentLink?.id ?? null } : {}),
      // Omitting `labels` entirely leaves the tracker's labels alone except for
      // the status carriers the adapter adds. Sending [] would strip labels a
      // human applied in the tracker, which is not ours to remove.
      ...(context.mirrorLabels ? { labels: prefixLabels(issue.labels ?? []) } : {}),
      ...(context.originLabels && context.originLabels.length > 0
        ? { ensureLabels: [...context.originLabels] }
        : {}),
      ...(context.canPushAssignee?.(issue.assignee ?? null)
        ? { assignee: issue.assignee ?? null }
        : {}),
    };

    const action: MirrorAction = {
      bead: issue,
      ...(parentBeadId ? { parentBeadId } : {}),
      externalId: existingLink?.id,
      patch,
      attachments: attachmentsFor(issue, displayId, links, counts),
      managedBlock: renderManagedBlock(issue, links, counts, displayId),
    };

    if (action.externalId) {
      plan.updates.push(action);
    } else {
      plan.creates.push(action);
    }
  }

  return plan;
}

export interface ApplyOptions {
  adapter: TrackerAdapter;
  plan: MirrorPlan;
  displayId: (id: string) => string;
  /**
   * Record a new link on a bead. Called only after the external item exists, so
   * a crash mid-run leaves an unlinked external item rather than a link to
   * something that was never created.
   */
  onLinked: (issue: Issue, entry: LinkedEntryType) => Promise<void>;
  now?: () => string;
}

/**
 * Execute a mirror plan.
 *
 * One bead's failure is contained: it is reported and the run continues, because
 * a single unreachable item should not block the rest of the mirror.
 */
export async function applyMirror(options: ApplyOptions): Promise<MirrorReport> {
  const { adapter, plan } = options;
  const now = options.now ?? (() => new Date().toISOString());

  const report: MirrorReport = {
    provider: plan.provider,
    created: [],
    updated: [],
    skipped: plan.skips.map((action) => ({
      beadId: options.displayId(action.bead.id),
      reason: action.skipReason ?? 'skipped',
    })),
    failures: [],
  };
  const createdExternalIds = new Map<string, string>();

  for (const action of plan.creates) {
    const displayId = options.displayId(action.bead.id);
    try {
      const parentId = action.parentBeadId
        ? (action.patch.parentId ?? createdExternalIds.get(action.parentBeadId))
        : action.patch.parentId;
      if (action.parentBeadId && !parentId) {
        throw new Error(`parent ${options.displayId(action.parentBeadId)} was not mirrored`);
      }
      const ref = await adapter.createIssue({ ...action.patch, parentId });
      createdExternalIds.set(action.bead.id, ref.id);
      await options.onLinked(action.bead, {
        provider: plan.provider,
        id: ref.id,
        key: ref.key ?? null,
        url: ref.url ?? null,
        linked_at: now(),
      });
      await adapter.upsertAttachments(ref.id, action.attachments);
      if (action.managedBlock) {
        await adapter.spliceDescription(ref.id, action.managedBlock);
      }
      report.created.push(displayId);
    } catch (error) {
      report.failures.push({ beadId: displayId, error: describeError(error) });
    }
  }

  for (const action of plan.updates) {
    const displayId = options.displayId(action.bead.id);
    if (!action.externalId) {
      continue;
    }
    try {
      const parentId = action.parentBeadId
        ? (action.patch.parentId ?? createdExternalIds.get(action.parentBeadId))
        : action.patch.parentId;
      if (action.parentBeadId && !parentId) {
        throw new Error(`parent ${options.displayId(action.parentBeadId)} was not mirrored`);
      }
      await adapter.applyChanges(action.externalId, { ...action.patch, parentId });
      await adapter.upsertAttachments(action.externalId, action.attachments);
      if (action.managedBlock) {
        await adapter.spliceDescription(action.externalId, action.managedBlock);
      }

      // Refresh the stored human identifier and URL. Both are display-only and
      // both change when an issue moves between teams (Linear identifiers are
      // team-scoped: FIN-11 becomes TBD-4). The UUID is why the link still
      // resolves at all; without this the bead would keep showing the old key.
      const existing = linkFor(action.bead, plan.provider);
      const [current] = await adapter.fetchIssues([action.externalId]);
      if (existing && current && (existing.key !== current.key || existing.url !== current.url)) {
        await options.onLinked(action.bead, {
          ...existing,
          key: current.key ?? null,
          url: current.url ?? null,
        });
      }

      report.updated.push(displayId);
    } catch (error) {
      report.failures.push({ beadId: displayId, error: describeError(error) });
    }
  }

  return report;
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
