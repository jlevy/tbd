/**
 * The Linear implementation of `TrackerAdapter`.
 *
 * Everything Linear-specific lives here or in `mapping.ts`; callers above this
 * layer see only tbd-canonical values.
 */

import type {
  AttachmentSpec,
  CanonicalPatch,
  ConflictReport,
  ExternalComment,
  ExternalIssue,
  ExternalRef,
  ProviderMeta,
  TrackerAdapter,
} from '../core/types.js';
import type { ProviderNameType } from '../../lib/types.js';
import type { LinearClient } from './client.js';
import { LinearDuplicateIdError, MAX_PAGE_SIZE } from './client.js';
import {
  priorityFromLinear,
  priorityToLinear,
  statusFromLinear,
  statusToLinear,
} from './mapping.js';
import {
  ATTACHMENT_UPSERT_MUTATION,
  COMMENT_CREATE_MUTATION,
  COMMENT_RESOLVE_MUTATION,
  ISSUES_BY_ID_QUERY,
  ISSUES_UPDATED_SINCE_QUERY,
  ISSUE_BY_IDENTIFIER_QUERY,
  ISSUE_COMMENTS_QUERY,
  ISSUE_CREATE_MUTATION,
  ISSUE_UPDATE_MUTATION,
  LABEL_CREATE_MUTATION,
  PROJECT_QUERY,
  TEAM_META_QUERY,
} from './queries.js';
import { spliceManagedBlock } from '../core/managed-block.js';
import { CONFLICT_COMMENT_MARKER } from '../core/types.js';

interface RawIssue {
  id: string;
  identifier: string;
  url: string;
  title: string;
  description: string | null;
  priority: number;
  updatedAt: string;
  state: { id: string; name: string; type: string } | null;
  assignee: { id: string; name: string; displayName: string } | null;
  labels: { nodes: { id: string; name: string }[] };
  parent: { id: string; identifier: string } | null;
  archivedAt: string | null;
  trashed: boolean | null;
}

export interface LinearAdapterOptions {
  client: LinearClient;
  teamKey: string;
  /** Create labels that do not exist yet rather than dropping them. */
  createLabels?: boolean;
  /** Project to file mirrored issues under, by name or slug id. */
  project?: string;
}

/** Recognizes a Linear issue URL and extracts the identifier. */
const LINEAR_URL_RE = /linear\.app\/[^/]+\/issue\/([A-Za-z0-9]+-\d+)/;
/** Recognizes a bare human identifier such as `FIN-123`. */
const IDENTIFIER_RE = /^[A-Za-z][A-Za-z0-9]*-\d+$/;

export class LinearAdapter implements TrackerAdapter {
  readonly provider: ProviderNameType = 'linear';

  private readonly client: LinearClient;
  private readonly teamKey: string;
  private readonly createLabels: boolean;

  private teamId?: string;
  private meta?: ProviderMeta;
  private readonly project?: string;
  private projectId?: string | null;

  constructor(options: LinearAdapterOptions) {
    this.client = options.client;
    this.teamKey = options.teamKey;
    this.createLabels = options.createLabels ?? true;
    this.project = options.project;
  }

  /**
   * Resolve the configured project to its UUID, by slug id or name.
   *
   * Cached as null when no project is configured, so the lookup runs at most
   * once per adapter. A configured project that does not exist is an error
   * rather than a silent fallback to "no project": filing two dozen issues
   * loose in a team is exactly the surprise this avoids.
   */
  private async resolveProjectId(): Promise<string | undefined> {
    if (!this.project) {
      return undefined;
    }
    if (this.projectId !== undefined) {
      return this.projectId ?? undefined;
    }

    const data = await this.client.request<{
      projects: { nodes: { id: string; name: string; slugId: string }[] };
    }>(PROJECT_QUERY, { first: 250 });

    const wanted = this.project.toLowerCase();
    const match = data.projects.nodes.find(
      (node) => node.slugId.toLowerCase() === wanted || node.name.toLowerCase() === wanted,
    );
    if (!match) {
      const available = data.projects.nodes.map((n) => `${n.name} (${n.slugId})`).join(', ');
      throw new Error(
        `Linear project not found: ${this.project}. Available: ${available || 'none'}`,
      );
    }
    this.projectId = match.id;
    return match.id;
  }

  /**
   * Parse a `linear:FIN-123`, bare `FIN-123`, or Linear URL reference.
   *
   * Resolution goes through the API because the canonical key is the UUID, not
   * the human identifier, which can change when an issue moves team.
   */
  async resolveRef(ref: string): Promise<ExternalRef> {
    const trimmed = ref.trim().replace(/^linear:/i, '');
    const identifier = LINEAR_URL_RE.exec(trimmed)?.[1] ?? trimmed;

    if (!IDENTIFIER_RE.test(identifier)) {
      throw new Error(
        `Not a Linear reference: ${ref}. Expected FIN-123, linear:FIN-123, or a Linear issue URL.`,
      );
    }

    const data = await this.client.request<{ issue: RawIssue | null }>(ISSUE_BY_IDENTIFIER_QUERY, {
      id: identifier,
    });
    if (!data.issue) {
      throw new Error(`Linear issue not found: ${identifier}`);
    }
    return {
      provider: 'linear',
      id: data.issue.id,
      key: data.issue.identifier,
      url: data.issue.url,
    };
  }

  async fetchIssues(ids: string[]): Promise<ExternalIssue[]> {
    if (ids.length === 0) {
      return [];
    }

    const results: ExternalIssue[] = [];
    let after: string | undefined;
    do {
      const data = await this.client.request<{
        issues: { pageInfo: { hasNextPage: boolean; endCursor: string | null }; nodes: RawIssue[] };
      }>(ISSUES_BY_ID_QUERY, { ids, first: MAX_PAGE_SIZE, after });

      results.push(...data.issues.nodes.map((node) => this.toCanonical(node)));
      after = data.issues.pageInfo.hasNextPage
        ? (data.issues.pageInfo.endCursor ?? undefined)
        : undefined;
    } while (after);

    return results;
  }

  async createIssue(patch: CanonicalPatch, clientId?: string): Promise<ExternalRef> {
    const meta = await this.ensureMeta();
    const input = await this.toInput(patch, meta);
    let data: { issueCreate: { success: boolean; issue: RawIssue | null } };
    try {
      data = await this.client.request<{
        issueCreate: { success: boolean; issue: RawIssue | null };
      }>(ISSUE_CREATE_MUTATION, {
        input: {
          ...input,
          teamId: await this.resolveTeamId(),
          ...((await this.resolveProjectId()) ? { projectId: await this.resolveProjectId() } : {}),
          ...(clientId ? { id: clientId } : {}),
        },
      });
    } catch (error) {
      // A duplicate client id means a previous attempt already created this
      // item (the mutation is not idempotent; the id IS). Recover the ref so
      // an intent replay converges instead of failing.
      if (clientId && error instanceof LinearDuplicateIdError) {
        const [existing] = await this.fetchIssues([clientId]);
        if (existing) {
          return { provider: 'linear', id: existing.id, key: existing.key, url: existing.url };
        }
      }
      throw error;
    }

    const issue = data.issueCreate.issue;
    if (!data.issueCreate.success || !issue) {
      throw new Error('Linear rejected the issue create');
    }
    return { provider: 'linear', id: issue.id, key: issue.identifier, url: issue.url };
  }

  async applyChanges(id: string, patch: CanonicalPatch): Promise<{ updatedAt: string }> {
    const meta = await this.ensureMeta();
    const input = await this.toInput(patch, meta);
    const data = await this.client.request<{
      issueUpdate: { success: boolean; issue: { updatedAt: string } | null };
    }>(ISSUE_UPDATE_MUTATION, { id, input });

    const issue = data.issueUpdate.issue;
    if (!data.issueUpdate.success || !issue) {
      throw new Error(`Linear rejected the update to ${id}`);
    }
    // The post-write timestamp is what suppresses the echo on the next pull.
    return { updatedAt: issue.updatedAt };
  }

  /**
   * Upsert attachments. Keyed on `url`, so this is idempotent and safe to retry.
   */
  async upsertAttachments(id: string, attachments: AttachmentSpec[]): Promise<void> {
    for (const attachment of attachments) {
      await this.client.request(ATTACHMENT_UPSERT_MUTATION, {
        input: {
          issueId: id,
          url: attachment.url,
          title: attachment.title,
          ...(attachment.subtitle ? { subtitle: attachment.subtitle } : {}),
          ...(attachment.metadata ? { metadata: attachment.metadata } : {}),
        },
      });
    }
  }

  /**
   * Replace only the managed region of the description, leaving human prose
   * intact. Refuses rather than guessing when the markers are malformed.
   */
  async spliceDescription(id: string, block: string): Promise<void> {
    const current = await this.fetchIssues([id]);
    const existing = current[0]?.description ?? null;

    const spliced = spliceManagedBlock(existing, block);
    if ('error' in spliced) {
      throw new Error(
        `Managed block markers in ${id} are malformed; not rewriting the description.`,
      );
    }
    if (spliced.result === existing) {
      return;
    }
    await this.applyChanges(id, { description: spliced.result });
  }

  async postConflict(
    id: string,
    report: ConflictReport,
    clientId?: string,
  ): Promise<{ commentId: string }> {
    const body = [
      CONFLICT_COMMENT_MARKER,
      '',
      `Field \`${report.field}\` on \`${report.beadId}\` diverged and one value was discarded.`,
      '',
      `- Kept: \`${JSON.stringify(report.keptValue)}\``,
      `- Discarded: \`${JSON.stringify(report.discardedValue)}\``,
      '',
      `The discarded value is archived at \`${report.atticPath}\`.`,
      'Resolve this comment once the divergence has been reconciled.',
    ].join('\n');

    return this.createComment(id, body, clientId);
  }

  /**
   * Create a comment. The provider honors client-generated comment UUIDs and
   * rejects duplicates (verified live 2026-08-10: the duplicate arrives as an
   * INPUT_ERROR on HTTP 200, unlike issueCreate's 400), so replay with a
   * client id is exactly-once: the duplicate converts to success here.
   */
  async createComment(id: string, body: string, clientId?: string): Promise<{ commentId: string }> {
    let data: { commentCreate: { success: boolean; comment: { id: string } | null } };
    try {
      data = await this.client.request<{
        commentCreate: { success: boolean; comment: { id: string } | null };
      }>(COMMENT_CREATE_MUTATION, {
        input: { issueId: id, body, ...(clientId ? { id: clientId } : {}) },
      });
    } catch (error) {
      if (clientId && error instanceof LinearDuplicateIdError) {
        return { commentId: clientId };
      }
      throw error;
    }

    const comment = data.commentCreate.comment;
    if (!data.commentCreate.success || !comment) {
      throw new Error(`Failed to post a comment on ${id}`);
    }
    return { commentId: comment.id };
  }

  async resolveComment(commentId: string): Promise<void> {
    const data = await this.client.request<{ commentResolve: { success: boolean } }>(
      COMMENT_RESOLVE_MUTATION,
      { id: commentId },
    );
    if (!data.commentResolve.success) {
      throw new Error(`Failed to resolve comment ${commentId}`);
    }
  }

  async listComments(id: string): Promise<ExternalComment[]> {
    const data = await this.client.request<{
      issue: {
        comments: {
          nodes: {
            id: string;
            body: string;
            createdAt: string;
            resolvedAt: string | null;
            user: { name: string; displayName: string } | null;
          }[];
        };
      } | null;
    }>(ISSUE_COMMENTS_QUERY, { id, first: MAX_PAGE_SIZE });

    const nodes = data.issue?.comments.nodes ?? [];
    return nodes
      .map((node) => ({
        id: node.id,
        body: node.body,
        author: node.user?.displayName ?? node.user?.name ?? null,
        createdAt: node.createdAt,
        resolvedAt: node.resolvedAt ?? null,
      }))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  /**
   * Every issue in the team touched after `since`, oldest first. Over-fetching
   * is harmless (base comparison discards no-ops), so callers pass a generous
   * overlap rather than an exact watermark.
   */
  async fetchUpdatedSince(since: string): Promise<ExternalIssue[]> {
    const teamId = await this.resolveTeamId();
    const results: ExternalIssue[] = [];
    let after: string | undefined;
    do {
      const data = await this.client.request<{
        issues: { pageInfo: { hasNextPage: boolean; endCursor: string | null }; nodes: RawIssue[] };
      }>(ISSUES_UPDATED_SINCE_QUERY, { teamId, since, first: MAX_PAGE_SIZE, after });
      results.push(...data.issues.nodes.map((node) => this.toCanonical(node)));
      after = data.issues.pageInfo.hasNextPage
        ? (data.issues.pageInfo.endCursor ?? undefined)
        : undefined;
    } while (after);
    return results;
  }

  async ensureMeta(force = false): Promise<ProviderMeta> {
    if (this.meta && !force) {
      return this.meta;
    }

    const data = await this.client.request<{
      teams: {
        nodes: {
          id: string;
          key: string;
          states: { nodes: { id: string; name: string; type: string; position: number }[] };
          labels: { nodes: { id: string; name: string }[] };
        }[];
      };
    }>(TEAM_META_QUERY, { key: this.teamKey });

    const team = data.teams.nodes[0];
    if (!team) {
      throw new Error(`Linear team not found: ${this.teamKey}`);
    }
    this.teamId = team.id;

    // Map by `type`, never by `name`: names are user-editable, types are not.
    // Where a team has several states of one type, the lowest position wins so
    // the choice is stable rather than dependent on response order.
    const byType = new Map<string, { id: string; position: number }>();
    for (const state of team.states.nodes) {
      const existing = byType.get(state.type);
      if (!existing || state.position < existing.position) {
        byType.set(state.type, { id: state.id, position: state.position });
      }
    }

    this.meta = {
      stateIdsByType: Object.fromEntries([...byType].map(([type, v]) => [type, v.id])),
      labelIdsByName: Object.fromEntries(team.labels.nodes.map((l) => [l.name, l.id])),
      fetchedAt: new Date().toISOString(),
    };
    return this.meta;
  }

  private async resolveTeamId(): Promise<string> {
    if (!this.teamId) {
      await this.ensureMeta();
    }
    if (!this.teamId) {
      throw new Error(`Linear team not found: ${this.teamKey}`);
    }
    return this.teamId;
  }

  private toCanonical(raw: RawIssue): ExternalIssue {
    const labels = raw.labels.nodes.map((l) => l.name);
    return {
      provider: 'linear',
      id: raw.id,
      key: raw.identifier,
      url: raw.url,
      title: raw.title,
      description: raw.description,
      status: statusFromLinear(raw.state?.type ?? 'unstarted', labels),
      priority: priorityFromLinear(raw.priority),
      labels,
      assignee: raw.assignee?.displayName ?? raw.assignee?.name ?? null,
      updatedAt: raw.updatedAt,
      archivedAt: raw.archivedAt ?? null,
      trashed: raw.trashed ?? false,
    };
  }

  /**
   * Translate a canonical patch into Linear mutation input.
   *
   * Status carries two things: the workflow state and, for `blocked` and
   * `deferred`, a tbd-owned label, because Linear has no state for either.
   */
  private async toInput(
    patch: CanonicalPatch,
    meta: ProviderMeta,
  ): Promise<Record<string, unknown>> {
    const input: Record<string, unknown> = {};

    if (patch.title !== undefined) {
      input.title = patch.title;
    }
    if (patch.description !== undefined) {
      input.description = patch.description;
    }
    if (patch.priority !== undefined) {
      input.priority = priorityToLinear(patch.priority);
    }
    if (patch.parentId !== undefined) {
      input.parentId = patch.parentId;
    }

    let statusLabels: string[] = [];
    if (patch.status !== undefined) {
      const target = statusToLinear(patch.status);
      const stateId = meta.stateIdsByType[target.stateType];
      if (stateId) {
        input.stateId = stateId;
      }
      statusLabels = target.labels;
    }

    if (patch.labels !== undefined || statusLabels.length > 0) {
      const names = [...new Set([...(patch.labels ?? []), ...statusLabels])];
      input.labelIds = await this.resolveLabelIds(names, meta);
    }

    return input;
  }

  /**
   * Map label names to ids, creating any that are missing when configured to.
   *
   * A name with no id and no creation is dropped rather than failing the whole
   * push: losing one label is better than losing the status change with it.
   */
  private async resolveLabelIds(names: string[], meta: ProviderMeta): Promise<string[]> {
    const ids: string[] = [];
    for (const name of names) {
      const existing = meta.labelIdsByName[name];
      if (existing) {
        ids.push(existing);
        continue;
      }
      if (!this.createLabels) {
        continue;
      }
      const created = await this.client.request<{
        issueLabelCreate: { success: boolean; issueLabel: { id: string; name: string } | null };
      }>(LABEL_CREATE_MUTATION, {
        input: { name, teamId: await this.resolveTeamId() },
      });
      const label = created.issueLabelCreate.issueLabel;
      if (label) {
        meta.labelIdsByName[label.name] = label.id;
        ids.push(label.id);
      }
    }
    return ids;
  }
}
