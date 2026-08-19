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
  resolutionFromLinear,
  holdFromLinear,
  resolveStateId,
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
  ISSUE_ARCHIVE_MUTATION,
  ISSUE_UNARCHIVE_MUTATION,
  ISSUE_UPDATE_MUTATION,
  LABEL_CREATE_MUTATION,
  PROJECT_CREATE_MUTATION,
  PROJECT_QUERY,
  TEAM_META_QUERY,
  WORKSPACE_USERS_QUERY,
  TEAM_LABELS_QUERY,
  USERS_BY_EMAIL_QUERY,
} from './queries.js';
import { spliceManagedBlock } from '../core/managed-block.js';
import { isTbdOwnedLabel, labelColorFor } from '../core/origin-labels.js';
import {
  indexLabels,
  qualifiedIssueLabels,
  splitQualifiedName,
  type QualifiedLabel,
  type RawLabelNode,
} from './label-groups.js';
import type { LabelCreateModeType } from '../core/provider-settings.js';
import { resolveActor, bindingFor } from '../core/actor-binding.js';
import type { ProviderMember, ActorBinding } from '../core/actor-binding.js';
import { CONFLICT_COMMENT_MARKER } from '../core/types.js';
import type { ProvisionItem, ProvisionOptions, ProvisionReport } from '../core/types.js';

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
    nodes: RawLabelNode[];
  };
  parent: { id: string; identifier: string } | null;
  archivedAt: string | null;
  trashed: boolean | null;
}

export interface LinearAdapterOptions {
  client: LinearClient;
  teamKey: string;
  /** Create labels that do not exist yet rather than dropping them. */
  createLabels?: LabelCreateModeType;
  /** Project to file mirrored issues under, by name or slug id. */
  project?: string;
  /** Maps canonical tbd assignee aliases to a Linear user UUID or email. */
  userMap?: Record<string, string>;
  /**
   * Workflow state name to use for a state type, overriding the conventional name.
   *
   * Only consulted when a team has several states of one type; a team whose board
   * matches Linear's stock names never needs it.
   */
  stateMap?: Record<string, string>;
}

/** Recognizes a Linear issue URL and extracts the identifier. */
const LINEAR_URL_RE = /linear\.app\/[^/]+\/issue\/([A-Za-z0-9]+-\d+)/;
/** Recognizes a bare human identifier such as `FIN-123`. */
const IDENTIFIER_RE = /^[A-Za-z][A-Za-z0-9]*-\d+$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^@\s]+@[^@\s]+$/;

/**
 * The bead's real timestamps, shaped into what `IssueCreateInput` will accept.
 *
 * Linear enforces three rules, and violating any of them fails the whole create — so a
 * date good enough to be worth sending is clamped rather than trusted, and one that
 * cannot be made legal is dropped. A mirrored issue with a slightly-adjusted date is
 * strictly better than a bead that will not mirror at all.
 *
 * 1. Both must be in the past. Clock skew between the machine writing beads and
 *    Linear's servers is enough to make "now" land in the future, so anything at or
 *    after now is dropped rather than sent.
 * 2. `completedAt` must be after `createdAt`. A bead created and closed inside the same
 *    second — routine for scripted work — otherwise fails, so it is nudged forward by a
 *    millisecond instead.
 * 3. `completedAt` requires a completed-type workflow state. Only tbd's `closed` maps to
 *    one, so any other status omits it even when the bead carries a `closed_at`.
 */
export function importTimestamps(patch: CanonicalPatch): {
  createdAt?: string;
  completedAt?: string;
} {
  const now = Date.now();
  const out: { createdAt?: string; completedAt?: string } = {};

  const created = patch.sourceCreatedAt ? Date.parse(patch.sourceCreatedAt) : Number.NaN;
  const createdOk = Number.isFinite(created) && created < now;
  if (createdOk) {
    out.createdAt = new Date(created).toISOString();
  }

  // Only a `completed` resolution reaches a completed-type state; Linear rejects
  // completedAt against Canceled or Duplicate outright, and stamping one on abandoned
  // work was wrong data rather than a wrong label — Linear reports on completedAt and
  // canceledAt separately. Absent resolution reads as completed, as everywhere else.
  const terminallyCompleted =
    patch.status === 'closed' && (patch.resolution ?? 'completed') === 'completed';
  if (!terminallyCompleted || !patch.sourceCompletedAt) {
    return out;
  }
  const completed = Date.parse(patch.sourceCompletedAt);
  if (!Number.isFinite(completed) || completed >= now) {
    return out;
  }
  // Ordering only has to hold when a createdAt is actually being sent; without one
  // Linear stamps creation at now, and any past completedAt precedes it — which it
  // rejects. So a completedAt is only safe alongside a createdAt.
  if (!createdOk) {
    return out;
  }
  out.completedAt = new Date(Math.max(completed, created + 1)).toISOString();
  return out;
}

export class LinearAdapter implements TrackerAdapter {
  readonly provider: ProviderNameType = 'linear';

  private readonly client: LinearClient;
  private readonly teamKey: string;
  private readonly createLabels: LabelCreateModeType;
  private readonly userMap: ReadonlyMap<string, string>;
  private readonly assigneeByExternalIdentity: ReadonlyMap<string, string>;
  private readonly resolvedUserIds = new Map<string, string>();

  private teamId?: string;
  private meta?: ProviderMeta;
  /** Team labels by qualified name, including groups. Populated by `ensureMeta`. */
  private labelIndex?: Map<string, QualifiedLabel>;
  private readonly project?: string;
  private projectId?: string | null;
  private readonly stateMap?: Record<string, string>;
  private members?: ProviderMember[];
  private actorBindings: ActorBinding[] = [];
  /** handle -> provider user id, filled by {@link primeActors}. */
  private readonly resolvedActors = new Map<string, string>();
  /** Handles the directory could not answer, reported rather than guessed at. */
  private readonly unresolvedActors = new Map<string, string>();

  constructor(options: LinearAdapterOptions) {
    this.client = options.client;
    this.teamKey = options.teamKey;
    this.createLabels = options.createLabels ?? 'tbd';
    this.project = options.project;
    this.stateMap = options.stateMap;
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

  /**
   * Resolve the handles this run will need, once, against the workspace directory.
   *
   * Called before reconciliation so {@link canPushAssignee} can stay synchronous — it
   * is consulted per bead, and a directory round trip per bead would be absurd.
   *
   * The directory is fetched only when `user_map` cannot already answer, so a
   * repository that configured its people explicitly pays nothing, and a workspace
   * whose token cannot list users degrades to exactly today's behavior instead of
   * failing the sync.
   */
  async primeActors(handles: readonly string[], bindings: readonly ActorBinding[]): Promise<void> {
    this.actorBindings = [...bindings];
    const needed = [...new Set(handles.filter((handle) => handle && !this.userMap.has(handle)))];
    if (needed.length === 0) {
      return;
    }
    let members: ProviderMember[];
    try {
      members = await this.listMembers();
    } catch {
      return;
    }
    for (const handle of needed) {
      const resolution = resolveActor(handle, members, this.actorBindings);
      if (resolution.member) {
        this.resolvedActors.set(handle, resolution.member.id);
      } else if (resolution.ambiguous) {
        this.unresolvedActors.set(
          handle,
          `matches ${resolution.ambiguous.length} workspace members (${resolution.ambiguous
            .map((member) => member.displayName)
            .join(', ')})`,
        );
      } else {
        this.unresolvedActors.set(handle, 'no workspace member matches this handle');
      }
    }
  }

  /** Why a handle could not be published, for the field-level skip report. */
  assigneeSkipReason(assignee: string): string | undefined {
    return this.unresolvedActors.get(assignee);
  }

  /** Bindings worth persisting after a run: handles resolved from the directory. */
  newActorBindings(now: string): ActorBinding[] {
    const known = new Set(this.actorBindings.map((binding) => binding.handle.toLowerCase()));
    const fresh: ActorBinding[] = [];
    for (const [handle, id] of this.resolvedActors) {
      if (known.has(handle.toLowerCase())) {
        continue;
      }
      const member = this.members?.find((candidate) => candidate.id === id);
      if (member) {
        fresh.push(bindingFor(handle, member, now));
      }
    }
    return fresh;
  }

  /**
   * Whether this actor can be published — never true for an absent one.
   *
   * A null local assignee is *no opinion*, not an instruction to unassign. Treating it
   * as a value meant a bead that had simply never recorded an assignee would clear
   * whoever a human had assigned in the tracker, on every sync, for as long as the two
   * stayed linked (OS-351). The blast radius was every bead predating assignee
   * tracking, which is most of them in any repository that adopted the integration
   * later.
   *
   * The tracker is where a person assigned the work. Publishing an assignee therefore
   * requires an identity to publish; deliberate unassignment, if it is ever wanted,
   * needs to be its own explicit action rather than the default reading of an empty
   * field.
   */
  canPushAssignee(assignee: string | null): boolean {
    if (assignee === null) {
      return false;
    }
    return this.userMap.has(assignee) || this.resolvedActors.has(assignee);
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

    const { match, available } = await this.findProject();
    if (!match) {
      throw new Error(
        `Linear project not found: ${this.project}. Available: ${available || 'none'}. ` +
          `Run \`tbd integration setup\` to create it.`,
      );
    }
    this.projectId = match.id;
    return match.id;
  }

  /**
   * Look the configured project up without deciding what absence means.
   *
   * Split from {@link resolveProjectId} because the two callers disagree about
   * a missing project: the sync path treats it as an error (filing issues into
   * "no project" because of a typo is the failure the throw prevents), while
   * `provision` treats it as work to do.
   */
  private async findProject(): Promise<{
    match?: { id: string; name: string; slugId: string };
    available: string;
  }> {
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

    const wanted = (this.project ?? '').toLowerCase();
    return {
      match: projects.find(
        (node) => node.slugId.toLowerCase() === wanted || node.name.toLowerCase() === wanted,
      ),
      available: projects.map((node) => `${node.name} (${node.slugId})`).join(', '),
    };
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
    Object.assign(input, importTimestamps(patch));
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
    // Read the current labels whenever this write will set labelIds but does not carry a
    // full replacement set. Both triggers need it for the same reason — Linear replaces
    // the whole list — and missing either one silently strips every human-applied label
    // from the issue.
    const assertsLabels = (patch.ensureLabels?.length ?? 0) > 0;
    if ((patch.status !== undefined || assertsLabels) && patch.labels === undefined) {
      const [current] = await this.fetchIssues([id]);
      preservedLabels = current?.labels.filter(
        (label) => label !== BLOCKED_LABEL && label !== DEFERRED_LABEL,
      );
    }
    const input = await this.toInput(patch, meta, preservedLabels);
    const data = await this.client.request<{
      issueUpdate: {
        success: boolean;
        issue: { updatedAt: string; identifier?: string; url?: string } | null;
      };
    }>(ISSUE_UPDATE_MUTATION, { id, input });

    const issue = data.issueUpdate.issue;
    if (!data.issueUpdate.success || !issue) {
      throw new Error(`Linear rejected the update to ${id}`);
    }
    // The post-write timestamp is what suppresses the echo on the next pull.
    // The identifier and URL ride along because the mutation already selects
    // them: returning them costs nothing and saves the caller a second read
    // just to notice a team rename.
    return {
      updatedAt: issue.updatedAt,
      ...(issue.identifier != null ? { key: issue.identifier } : {}),
      ...(issue.url != null ? { url: issue.url } : {}),
    };
  }

  async archiveIssue(id: string): Promise<void> {
    const data = await this.client.request<{ issueArchive: { success: boolean } }>(
      ISSUE_ARCHIVE_MUTATION,
      { id },
    );
    if (!data.issueArchive.success) {
      throw new Error(`Linear declined to archive ${id}`);
    }
  }

  async unarchiveIssue(id: string): Promise<void> {
    const data = await this.client.request<{ issueUnarchive: { success: boolean } }>(
      ISSUE_UNARCHIVE_MUTATION,
      { id },
    );
    if (!data.issueUnarchive.success) {
      throw new Error(`Linear declined to unarchive ${id}`);
    }
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
            nodes: RawLabelNode[];
          };
        }[];
      };
    }>(TEAM_META_QUERY, { key: this.teamKey });

    const team = data.teams.nodes[0];
    if (!team) {
      throw new Error(`Linear team not found: ${this.teamKey}`);
    }
    this.teamId = team.id;

    // Resolve by name, never by board position. The previous rule kept the
    // lowest-position state of each type, which is stable only in the sense that it is
    // reproducible: dragging a row in the workflow editor is invisible and silently
    // moved where work landed. A type whose candidates cannot be told apart is left
    // unresolved and reported, rather than guessed at.
    const states = team.states.nodes.map((s) => ({
      id: s.id,
      name: s.name,
      type: s.type,
      position: s.position,
    }));
    const stateIdsByType: Record<string, string> = {};
    const ambiguousStateTypes: Record<string, string[]> = {};
    for (const stateType of new Set(states.map((s) => s.type))) {
      const resolved = resolveStateId(states, stateType, this.stateMap?.[stateType]);
      if (resolved.state) {
        stateIdsByType[stateType] = resolved.state.id;
      } else if (resolved.ambiguous) {
        ambiguousStateTypes[stateType] = resolved.ambiguous.map((s) => s.name);
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
            nodes: RawLabelNode[];
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

    // Keyed by QUALIFIED name (`repo/tbd`), not the bare leaf Linear stores. See
    // label-groups.ts: bare keys collide between a root label and a grouped leaf of the
    // same name, and never match the `group/leaf` names tbd asks for.
    const index = indexLabels(labels);
    this.labelIndex = index;
    this.meta = {
      stateIdsByType,
      states,
      ...(Object.keys(ambiguousStateTypes).length > 0 ? { ambiguousStateTypes } : {}),
      labelIdsByName: Object.fromEntries(
        [...index.values()]
          .filter((label) => !label.isGroup)
          .map((label) => [label.qualifiedName, label.id]),
      ),
      fetchedAt: new Date().toISOString(),
    };
    return this.meta;
  }

  /**
   * Everyone in the workspace, paged.
   *
   * Cached for the life of the adapter: a directory changes on the order of people
   * joining a company, and re-fetching it per bead would add a round trip to every
   * actor resolution in a sync.
   */
  async listMembers(): Promise<ProviderMember[]> {
    if (this.members) {
      return this.members;
    }
    const collected: ProviderMember[] = [];
    let after: string | undefined;
    do {
      const page = await this.client.request<{
        users: {
          pageInfo: { hasNextPage: boolean; endCursor: string | null };
          nodes: {
            id: string;
            name: string | null;
            displayName: string | null;
            email: string | null;
            active: boolean;
          }[];
        };
      }>(WORKSPACE_USERS_QUERY, { first: MAX_PAGE_SIZE, after });
      for (const node of page.users.nodes) {
        collected.push({
          id: node.id,
          displayName: node.displayName ?? node.name ?? node.id,
          ...(node.email ? { email: node.email } : {}),
          active: node.active,
        });
      }
      after = page.users.pageInfo.hasNextPage
        ? (page.users.pageInfo.endCursor ?? undefined)
        : undefined;
    } while (after);
    this.members = collected;
    return collected;
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
    const labels = qualifiedIssueLabels(raw.labels.nodes);
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
      resolution: resolutionFromLinear(stateType),
      hold: holdFromLinear(raw.state?.name, labels),
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
            nodes: RawLabelNode[];
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
      const target = statusToLinear(patch.status, patch.resolution, patch.hold);
      // A named state is preferred when the team actually has one, because a real
      // column is visible to a person planning the week while a label is not. When it
      // is absent the carrier label rides the type's default instead, which is the
      // degradation `blocked` and `deferred` already rely on.
      const named = target.stateName
        ? (meta.states ?? []).find(
            (state) =>
              state.type === target.stateType &&
              state.name.toLowerCase() === target.stateName!.toLowerCase(),
          )
        : undefined;
      const stateId = named?.id ?? meta.stateIdsByType[target.stateType];
      if (stateId) {
        input.stateId = stateId;
      }
      statusLabels = named ? [] : target.labels;
    }

    // `ensureLabels` is additive: it joins whatever label set is already being written
    // rather than defining it. Linear's update replaces labelIds wholesale, so the only
    // safe way to assert a label is to send it alongside the ones already there — which
    // is why applyChanges reads current labels when it has none in hand.
    const ensure = patch.ensureLabels ?? [];
    const baseLabels = patch.labels ?? preservedLabels;
    if (baseLabels !== undefined || statusLabels.length > 0 || ensure.length > 0) {
      const names = [...new Set([...(baseLabels ?? []), ...statusLabels, ...ensure])];
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
      if (!this.mayCreateLabel(name)) {
        continue;
      }
      const created = await this.ensureLabel(name);
      if (created) {
        meta.labelIdsByName[name] = created.id;
        ids.push(created.id);
      }
    }
    return ids;
  }

  /**
   * Find or create one label by qualified name, creating its group first when needed.
   *
   * A qualified name is two creates, not one: `repo/tbd` needs the group `repo` to exist
   * before a child can point at it. Creating the leaf without the group would produce a
   * flat label literally named `repo/tbd`, which looks right in a list and silently
   * loses the one-per-issue guarantee the group exists to provide.
   *
   * Returns undefined rather than throwing when Linear declines the create: losing one
   * label is better than losing the status change it was travelling with.
   */
  private async ensureLabel(qualifiedName: string): Promise<QualifiedLabel | undefined> {
    const index = await this.ensureLabelIndex();
    const found = index.get(qualifiedName);
    if (found && !found.isGroup) {
      return found;
    }

    const { group, leaf } = splitQualifiedName(qualifiedName);
    let parentId: string | undefined;
    if (group) {
      const existingGroup = index.get(group);
      if (existingGroup?.isGroup) {
        parentId = existingGroup.id;
      } else if (existingGroup) {
        // A plain label already holds the group's name. Promoting it would rewrite data
        // tbd does not own, so the label is skipped and the caller carries on without it.
        return undefined;
      } else {
        const createdGroup = await this.createLabel({ name: group, isGroup: true });
        if (!createdGroup) {
          return undefined;
        }
        parentId = createdGroup.id;
      }
    }

    return await this.createLabel({ name: leaf, parentId, qualifiedName });
  }

  /** Create one label and record it in the index. */
  private async createLabel(options: {
    name: string;
    isGroup?: boolean;
    parentId?: string;
    qualifiedName?: string;
  }): Promise<QualifiedLabel | undefined> {
    const input: Record<string, unknown> = {
      name: options.name,
      teamId: await this.resolveTeamId(),
    };
    // Only on create. Recoloring an existing label on every sync would overwrite a
    // choice the workspace made; see labelColorFor.
    const color = labelColorFor(options.qualifiedName ?? options.name);
    if (color) {
      input.color = color;
    }
    if (options.isGroup) {
      input.isGroup = true;
    }
    if (options.parentId) {
      input.parentId = options.parentId;
    }
    const created = await this.client.request<{
      issueLabelCreate: {
        success: boolean;
        issueLabel: { id: string; name: string } | null;
      };
    }>(LABEL_CREATE_MUTATION, { input });
    const label = created.issueLabelCreate.issueLabel;
    if (!label) {
      return undefined;
    }
    const qualifiedName = options.qualifiedName ?? label.name;
    const record: QualifiedLabel = {
      id: label.id,
      qualifiedName,
      leafName: label.name,
      groupName: splitQualifiedName(qualifiedName).group,
      isGroup: options.isGroup === true,
    };
    (await this.ensureLabelIndex()).set(record.qualifiedName, record);
    return record;
  }

  /**
   * Inspect, and optionally create, the tracker scaffolding this mirror needs.
   *
   * Idempotent by construction: everything is find-or-create against the qualified-name
   * index, so running it twice creates nothing the second time. The group is reported as
   * its own item because it is a distinct object in Linear with its own failure mode —
   * a plain label already sitting on the group's name blocks the child, and an operator
   * needs to be told that rather than watching the label quietly not appear.
   *
   * The configured project is scaffolding too: `resolveProjectId` fails a sync outright
   * when `target.project` names nothing, so a setup that provisioned only labels walked
   * the operator into a guaranteed first-sync error. Found live wiring the second
   * repository of a multi-repo team, where per-repo projects are the intended shape.
   */
  async provision(options: ProvisionOptions): Promise<ProvisionReport> {
    const index = await this.ensureLabelIndex();
    const items: ProvisionItem[] = [];

    if (this.project) {
      const { match } = await this.findProject();
      if (match) {
        items.push({ kind: 'project', name: this.project, state: 'present' });
      } else if (!options.apply) {
        items.push({ kind: 'project', name: this.project, state: 'missing' });
      } else {
        try {
          const data = await this.client.request<{
            projectCreate: {
              success: boolean;
              project: { id: string; name: string; slugId: string } | null;
            };
          }>(PROJECT_CREATE_MUTATION, {
            input: { name: this.project, teamIds: [await this.resolveTeamId()] },
          });
          const created = data.projectCreate.project;
          if (!data.projectCreate.success || !created) {
            items.push({
              kind: 'project',
              name: this.project,
              state: 'blocked',
              reason: 'Linear declined to create the project',
            });
          } else {
            // Cache the id so the sync that typically follows setup does not
            // re-list every project just to find the one this run created.
            this.projectId = created.id;
            items.push({ kind: 'project', name: this.project, state: 'created' });
          }
        } catch (error) {
          items.push({
            kind: 'project',
            name: this.project,
            state: 'blocked',
            reason: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }

    /**
     * Where each leaf name is already taken, keyed by the bare leaf.
     *
     * Linear enforces label-name uniqueness across the whole team and a group does not
     * scope it: it stores only the leaf in `name`. So creating `repo/tbd` while a root
     * `tbd` exists is rejected with `duplicate label name`, and the qualified-name index
     * cannot see that coming — `tbd` and `repo/tbd` are different keys there. Without
     * this check the dry run promises a create that Linear will refuse.
     */
    const holderByLeaf = new Map<string, QualifiedLabel>();
    for (const label of index.values()) {
      if (!holderByLeaf.has(label.leafName)) {
        holderByLeaf.set(label.leafName, label);
      }
    }

    // Several origin labels can share one group, so each group is resolved once and its
    // outcome remembered — both to avoid duplicate report lines and to avoid racing two
    // creates for the same group.
    const groups = new Map<string, 'ready' | 'unavailable'>();

    const ensureGroup = async (group: string): Promise<'ready' | 'unavailable'> => {
      const already = groups.get(group);
      if (already) {
        return already;
      }
      const existing = index.get(group);
      let outcome: 'ready' | 'unavailable';
      if (existing?.isGroup) {
        items.push({ kind: 'label group', name: group, state: 'present' });
        outcome = 'ready';
      } else if (existing) {
        items.push({
          kind: 'label group',
          name: group,
          state: 'blocked',
          reason:
            `a plain label named "${group}" already exists in this team; ` +
            `rename it, or point labels.repo at a different name`,
        });
        outcome = 'unavailable';
      } else if (!options.apply) {
        items.push({ kind: 'label group', name: group, state: 'missing' });
        outcome = 'unavailable';
      } else {
        try {
          const created = await this.createLabel({ name: group, isGroup: true });
          items.push({
            kind: 'label group',
            name: group,
            state: created ? 'created' : 'blocked',
            ...(created ? {} : { reason: 'Linear declined to create the label group' }),
          });
          outcome = created ? 'ready' : 'unavailable';
        } catch (error) {
          items.push({
            kind: 'label group',
            name: group,
            state: 'blocked',
            reason: error instanceof Error ? error.message : String(error),
          });
          outcome = 'unavailable';
        }
      }
      groups.set(group, outcome);
      return outcome;
    };

    for (const qualifiedName of options.originLabels) {
      const { group, leaf } = splitQualifiedName(qualifiedName);

      const existing = index.get(qualifiedName);
      if (existing && !existing.isGroup) {
        // Present already implies its group is present, so the group is reported only
        // when something else in this run needs to look at it.
        if (group) {
          await ensureGroup(group);
        }
        items.push({ kind: 'label', name: qualifiedName, state: 'present' });
        continue;
      }

      if (group && (await ensureGroup(group)) === 'unavailable') {
        // A report-only run calls this "missing" (nothing was attempted); an applying
        // run calls it "blocked" (something was attempted and could not proceed).
        items.push({
          kind: 'label',
          name: qualifiedName,
          state: options.apply ? 'blocked' : 'missing',
          ...(options.apply ? { reason: `needs the "${group}" label group` } : {}),
        });
        continue;
      }

      // The leaf is spoken for elsewhere in the team, so Linear will refuse. Report it
      // the same way in a dry run and a real one: a preview whose only difference from
      // the real run is that the failure arrives later is not a preview.
      const holder = holderByLeaf.get(leaf);
      if (holder) {
        // Name the holder the way the operator will find it in Linear: a root label is
        // just its name, whereas a grouped one is only recognizable qualified.
        const held = holder.groupName
          ? `the label "${holder.qualifiedName}"`
          : `a root label named "${leaf}"`;
        items.push({
          kind: 'label',
          name: qualifiedName,
          state: 'blocked',
          reason:
            `${held} already exists in this team, and Linear requires label names to be ` +
            `unique across the whole team even inside a group; rename or delete it, or ` +
            `set labels.repo to a different name`,
        });
        continue;
      }

      if (!options.apply) {
        items.push({ kind: 'label', name: qualifiedName, state: 'missing' });
        continue;
      }

      // A rejection must not abort the run: earlier iterations may already have created
      // labels, and throwing here would discard the report of them — leaving a shared
      // workspace half-provisioned with nothing on screen saying so.
      try {
        const created = await this.createLabel({
          name: leaf,
          parentId: group ? index.get(group)?.id : undefined,
          qualifiedName,
        });
        items.push({
          kind: 'label',
          name: qualifiedName,
          state: created ? 'created' : 'blocked',
          ...(created ? {} : { reason: 'Linear declined to create the label' }),
        });
      } catch (error) {
        items.push({
          kind: 'label',
          name: qualifiedName,
          state: 'blocked',
          reason: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return { provider: 'linear', scope: `team ${this.teamKey}`, items };
  }

  /** The team's labels indexed by qualified name, fetched once per adapter. */
  private async ensureLabelIndex(): Promise<Map<string, QualifiedLabel>> {
    if (!this.labelIndex) {
      await this.ensureMeta();
    }
    if (!this.labelIndex) {
      throw new Error(`Linear labels unavailable for team ${this.teamKey}`);
    }
    return this.labelIndex;
  }

  /**
   * Whether a label tbd needs may be created when the team does not have it.
   *
   * The distinction matters because the two categories have opposite risk profiles.
   * tbd's own labels are a small bounded set the tool cannot work without — dropping
   * `tbd` or `repo/<name>` leaves the item unlabelled, which the engine then notices and
   * re-asserts on every sync, forever. Mirrored bead labels are unbounded and land in a
   * team namespace other people share, which is why mass-creating them is opt-in.
   */
  private mayCreateLabel(name: string): boolean {
    if (this.createLabels === 'all') {
      return true;
    }
    if (this.createLabels === 'none') {
      return false;
    }
    return isTbdOwnedLabel(name);
  }

  private async resolveUserId(assignee: string): Promise<string> {
    // A directory resolution wins nothing over an explicit override: `user_map` is
    // consulted first so a repository that pinned an identity keeps it.
    const identity = this.userMap.get(assignee) ?? this.resolvedActors.get(assignee);
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
