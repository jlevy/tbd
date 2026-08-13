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
  BLOCKED_LABEL,
  DEFERRED_LABEL,
  KNOWN_STATE_TYPES,
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
  ISSUES_UPDATED_SINCE_IN_PROJECT_QUERY,
  ISSUE_BY_IDENTIFIER_QUERY,
  ISSUE_COMMENTS_QUERY,
  ISSUE_ATTACHMENTS_QUERY,
  ISSUE_CREATE_MUTATION,
  ISSUE_LABELS_QUERY,
  ISSUE_UPDATE_MUTATION,
  LABEL_CREATE_MUTATION,
  PROJECT_QUERY,
  TEAM_META_QUERY,
  TEAM_LABELS_QUERY,
  USERS_BY_EMAIL_QUERY,
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
  assignee: { id: string; name: string; displayName: string; email?: string } | null;
  labels: {
    pageInfo?: { hasNextPage: boolean; endCursor: string | null };
    nodes: { id: string; name: string }[];
  };
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
  /** Maps canonical tbd assignee aliases to a Linear user UUID or email. */
  userMap?: Record<string, string>;
}

/** Recognizes a Linear issue URL and extracts the identifier. */
const LINEAR_URL_RE = /linear\.app\/[^/]+\/issue\/([A-Za-z0-9]+-\d+)/;
/** Recognizes a bare human identifier such as `FIN-123`. */
const IDENTIFIER_RE = /^[A-Za-z][A-Za-z0-9]*-\d+$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^@\s]+@[^@\s]+$/;

export class LinearAdapter implements TrackerAdapter {
  readonly provider: ProviderNameType = 'linear';

  private readonly client: LinearClient;
  private readonly teamKey: string;
  private readonly createLabels: boolean;
  private readonly userMap: ReadonlyMap<string, string>;
  private readonly assigneeByExternalIdentity: ReadonlyMap<string, string>;
  private readonly resolvedUserIds = new Map<string, string>();

  private teamId?: string;
  private meta?: ProviderMeta;
  private readonly project?: string;
  private projectId?: string | null;

  constructor(options: LinearAdapterOptions) {
    this.client = options.client;
    this.teamKey = options.teamKey;
    this.createLabels = options.createLabels ?? true;
    this.project = options.project;
    const configuredUsers = Object.entries(options.userMap ?? {});
    const reverse = new Map<string, string>();
    for (const [assignee, identity] of configuredUsers) {
      if (!assignee.trim()) {
        throw new Error('integrations.linear.user_map contains an empty tbd assignee.');
      }
      if (!UUID_RE.test(identity) && !EMAIL_RE.test(identity)) {
        throw new Error(
          `integrations.linear.user_map.${assignee} must be a Linear user UUID or email.`,
        );
      }
      const normalized = identity.toLowerCase();
      const existing = reverse.get(normalized);
      if (existing) {
        throw new Error(
          `integrations.linear.user_map maps both ${existing} and ${assignee} to the same Linear user.`,
        );
      }
      reverse.set(normalized, assignee);
    }
    this.userMap = new Map(configuredUsers);
    this.assigneeByExternalIdentity = reverse;
  }

  canPushAssignee(assignee: string | null): boolean {
    return this.userMap.size > 0 && (assignee === null || this.userMap.has(assignee));
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

    const projects: { id: string; name: string; slugId: string }[] = [];
    let after: string | undefined;
    do {
      const data = await this.client.request<{
        projects: {
          pageInfo: { hasNextPage: boolean; endCursor: string | null };
          nodes: { id: string; name: string; slugId: string }[];
        };
      }>(PROJECT_QUERY, { first: MAX_PAGE_SIZE, after });
      projects.push(...data.projects.nodes);
      after = data.projects.pageInfo.hasNextPage
        ? (data.projects.pageInfo.endCursor ?? undefined)
        : undefined;
    } while (after);

    const wanted = this.project.toLowerCase();
    const match = projects.find(
      (node) => node.slugId.toLowerCase() === wanted || node.name.toLowerCase() === wanted,
    );
    if (!match) {
      const available = projects.map((node) => `${node.name} (${node.slugId})`).join(', ');
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

      const page = await Promise.all(
        data.issues.nodes.map(async (node) =>
          this.toCanonical(await this.withAllIssueLabels(node)),
        ),
      );
      results.push(...page);
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
    let preservedLabels: string[] | undefined;
    if (patch.status !== undefined && patch.labels === undefined) {
      const [current] = await this.fetchIssues([id]);
      preservedLabels = current?.labels.filter(
        (label) => label !== BLOCKED_LABEL && label !== DEFERRED_LABEL,
      );
    }
    const input = await this.toInput(patch, meta, preservedLabels);
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

  async listAttachmentUrls(id: string): Promise<string[]> {
    const urls: string[] = [];
    let after: string | undefined;
    do {
      const data = await this.client.request<{
        issue: {
          attachments: {
            pageInfo: { hasNextPage: boolean; endCursor: string | null };
            nodes: { url: string }[];
          };
        } | null;
      }>(ISSUE_ATTACHMENTS_QUERY, { id, first: MAX_PAGE_SIZE, after });
      const attachments = data.issue?.attachments;
      if (!attachments) {
        break;
      }
      urls.push(...attachments.nodes.map((attachment) => attachment.url));
      after = attachments.pageInfo.hasNextPage
        ? (attachments.pageInfo.endCursor ?? undefined)
        : undefined;
    } while (after);
    return urls;
  }

  /**
   * Replace only the managed region of the description, leaving human prose
   * intact. Refuses rather than guessing when the markers are malformed.
   */
  async spliceDescription(id: string, block: string): Promise<{ updatedAt: string } | null> {
    const current = await this.fetchIssues([id]);
    const existing = current[0]?.description ?? null;

    const spliced = spliceManagedBlock(existing, block);
    if ('error' in spliced) {
      throw new Error(
        `Managed block markers in ${id} are malformed; not rewriting the description.`,
      );
    }
    if (spliced.result === existing) {
      return null;
    }
    return this.applyChanges(id, { description: spliced.result });
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
    interface RawComment {
      id: string;
      body: string;
      createdAt: string;
      resolvedAt: string | null;
      user: { name: string; displayName: string } | null;
    }
    const nodes: RawComment[] = [];
    let after: string | undefined;
    do {
      const data = await this.client.request<{
        issue: {
          comments: {
            pageInfo: { hasNextPage: boolean; endCursor: string | null };
            nodes: RawComment[];
          };
        } | null;
      }>(ISSUE_COMMENTS_QUERY, { id, first: MAX_PAGE_SIZE, after });

      const comments = data.issue?.comments;
      if (!comments) {
        break;
      }
      nodes.push(...comments.nodes);
      after = comments.pageInfo.hasNextPage
        ? (comments.pageInfo.endCursor ?? undefined)
        : undefined;
    } while (after);

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
    const projectId = await this.resolveProjectId();
    const results: ExternalIssue[] = [];
    let after: string | undefined;
    do {
      const data = await this.client.request<{
        issues: { pageInfo: { hasNextPage: boolean; endCursor: string | null }; nodes: RawIssue[] };
      }>(projectId ? ISSUES_UPDATED_SINCE_IN_PROJECT_QUERY : ISSUES_UPDATED_SINCE_QUERY, {
        teamId,
        ...(projectId ? { projectId } : {}),
        since,
        first: MAX_PAGE_SIZE,
        after,
      });
      const page = await Promise.all(
        data.issues.nodes.map(async (node) =>
          this.toCanonical(await this.withAllIssueLabels(node)),
        ),
      );
      results.push(...page);
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
          labels: {
            pageInfo: { hasNextPage: boolean; endCursor: string | null };
            nodes: { id: string; name: string }[];
          };
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

    const labels = [...team.labels.nodes];
    let labelsAfter = team.labels.pageInfo.hasNextPage
      ? (team.labels.pageInfo.endCursor ?? undefined)
      : undefined;
    while (labelsAfter) {
      const page = await this.client.request<{
        team: {
          labels: {
            pageInfo: { hasNextPage: boolean; endCursor: string | null };
            nodes: { id: string; name: string }[];
          };
        } | null;
      }>(TEAM_LABELS_QUERY, { id: team.id, first: MAX_PAGE_SIZE, after: labelsAfter });
      if (!page.team) {
        throw new Error(`Linear team disappeared while reading labels: ${this.teamKey}`);
      }
      labels.push(...page.team.labels.nodes);
      labelsAfter = page.team.labels.pageInfo.hasNextPage
        ? (page.team.labels.pageInfo.endCursor ?? undefined)
        : undefined;
    }

    this.meta = {
      stateIdsByType: Object.fromEntries([...byType].map(([type, v]) => [type, v.id])),
      labelIdsByName: Object.fromEntries(labels.map((label) => [label.name, label.id])),
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
    const stateType = raw.state?.type ?? 'unstarted';
    const mappedAssignee = raw.assignee
      ? (this.assigneeByExternalIdentity.get(raw.assignee.id.toLowerCase()) ??
        (raw.assignee.email
          ? this.assigneeByExternalIdentity.get(raw.assignee.email.toLowerCase())
          : undefined))
      : undefined;
    const assigneeSyncable = raw.assignee === null || mappedAssignee !== undefined;
    const mappingWarnings: string[] = [];
    if (!KNOWN_STATE_TYPES.includes(stateType as (typeof KNOWN_STATE_TYPES)[number])) {
      mappingWarnings.push(`Unknown Linear workflow state type "${stateType}"; mapped to open.`);
    }
    if (!assigneeSyncable) {
      mappingWarnings.push(
        'Linear assignee is not present in user_map; assignee synchronization skipped.',
      );
    }
    return {
      provider: 'linear',
      id: raw.id,
      key: raw.identifier,
      url: raw.url,
      title: raw.title,
      description: raw.description,
      status: statusFromLinear(stateType, labels),
      priority: priorityFromLinear(raw.priority),
      labels,
      assignee: mappedAssignee ?? null,
      assigneeSyncable,
      parent: raw.parent ? { id: raw.parent.id, key: raw.parent.identifier } : null,
      updatedAt: raw.updatedAt,
      archivedAt: raw.archivedAt ?? null,
      trashed: raw.trashed ?? false,
      ...(mappingWarnings.length > 0 ? { mappingWarnings } : {}),
    };
  }

  private async withAllIssueLabels(raw: RawIssue): Promise<RawIssue> {
    let after = raw.labels.pageInfo?.hasNextPage
      ? (raw.labels.pageInfo.endCursor ?? undefined)
      : undefined;
    if (!after) {
      return raw;
    }
    const nodes = [...raw.labels.nodes];
    while (after) {
      const response: {
        issue: {
          labels: {
            pageInfo: { hasNextPage: boolean; endCursor: string | null };
            nodes: { id: string; name: string }[];
          };
        } | null;
      } = await this.client.request(ISSUE_LABELS_QUERY, {
        id: raw.id,
        first: MAX_PAGE_SIZE,
        after,
      });
      if (!response.issue) {
        throw new Error(`Linear issue disappeared while reading labels: ${raw.id}`);
      }
      nodes.push(...response.issue.labels.nodes);
      after = response.issue.labels.pageInfo.hasNextPage
        ? (response.issue.labels.pageInfo.endCursor ?? undefined)
        : undefined;
    }
    return { ...raw, labels: { nodes } };
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
    preservedLabels?: string[],
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
    if (patch.assignee !== undefined) {
      input.assigneeId = patch.assignee === null ? null : await this.resolveUserId(patch.assignee);
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

    const baseLabels = patch.labels ?? preservedLabels;
    if (baseLabels !== undefined || statusLabels.length > 0) {
      const names = [...new Set([...(baseLabels ?? []), ...statusLabels])];
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

  private async resolveUserId(assignee: string): Promise<string> {
    const identity = this.userMap.get(assignee);
    if (!identity) {
      throw new Error(`No Linear user mapping is configured for tbd assignee ${assignee}.`);
    }
    if (UUID_RE.test(identity)) {
      return identity;
    }
    const cached = this.resolvedUserIds.get(identity.toLowerCase());
    if (cached) {
      return cached;
    }
    const data = await this.client.request<{
      users: { nodes: { id: string; email: string }[] };
    }>(USERS_BY_EMAIL_QUERY, { email: identity });
    if (data.users.nodes.length !== 1) {
      throw new Error(`Linear user mapping for ${assignee} did not resolve exactly one user.`);
    }
    const id = data.users.nodes[0]!.id;
    this.resolvedUserIds.set(identity.toLowerCase(), id);
    return id;
  }
}
