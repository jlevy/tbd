/**
 * The provider seam for external tracker integrations.
 *
 * Everything above this interface (selection, mirroring, the CLI) is
 * provider-agnostic. Everything below it (GraphQL/REST, state mapping tables) is
 * provider-specific. Adding a provider means writing one adapter, not touching
 * the mirror, the command group, or the config shape.
 *
 * Values crossing this boundary are tbd-canonical (tbd status enum, P0-P4), so
 * each provider owns exactly one mapping table.
 */

import type { Issue, IssueStatusType, PriorityType, ProviderNameType } from '../../lib/types.js';

/**
 * A resolved pointer to an item in an external tracker.
 */
export interface ExternalRef {
  provider: ProviderNameType;
  /** Provider-internal stable id (a UUID for Linear). The canonical key. */
  id: string;
  /** Human identifier, e.g. `FIN-123`. Display only: it can change. */
  key?: string;
  url?: string;
}

/**
 * An external item mapped into tbd-canonical values.
 */
export interface ExternalIssue extends ExternalRef {
  title: string;
  description: string | null;
  status: IssueStatusType;
  priority: PriorityType;
  labels: string[];
  assignee: string | null;
  /** False when a provider assignee exists but has no safe canonical mapping. */
  assigneeSyncable?: boolean;
  /** Safe, provider-authored mapping diagnostics to surface in the sync report. */
  mappingWarnings?: string[];
  /** Provider parent identity. Missing or null means this item is a root. */
  parent?: Pick<ExternalRef, 'id' | 'key'> | null;
  /** The provider's own last-modified timestamp, used for echo suppression. */
  updatedAt: string;
  /** Set when the item was archived; a linked bead becomes orphaned, never deleted. */
  archivedAt: string | null;
  /** True when the item is in the provider's trash. Same orphan treatment. */
  trashed: boolean;
}

/**
 * One comment on an external item, canonicalized. `author` is a display name
 * only — never an email — because comment entries are persisted into beads.
 */
export interface ExternalComment {
  id: string;
  body: string;
  author: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

/**
 * A change to push to an external item. Absent fields are left untouched.
 */
export interface CanonicalPatch {
  title?: string;
  description?: string | null;
  status?: IssueStatusType;
  priority?: PriorityType;
  labels?: string[];
  assignee?: string | null;
  parentId?: string | null;
}

/**
 * An attachment to upsert on an external item.
 *
 * `url` is the idempotency key: writing the same url twice updates in place
 * rather than creating a duplicate.
 */
export interface AttachmentSpec {
  url: string;
  title: string;
  subtitle?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Provider metadata that must be resolved before pushing.
 *
 * For Linear this is the per-team workflow state UUIDs (mutations need a
 * `stateId`, and state names are user-editable so they cannot be the key) and
 * the label name-to-id map.
 */
export interface ProviderMeta {
  /** Workflow state id by state `type`, e.g. `started` -> uuid. */
  stateIdsByType: Record<string, string>;
  /** Label id by exact label name. */
  labelIdsByName: Record<string, string>;
  /** When this metadata was fetched (ISO 8601). */
  fetchedAt: string;
}

/**
 * First line of every conflict-report comment tbd posts. The comment-pull
 * path skips bodies starting with it: conflict reports are sync artifacts
 * tracked in the bridge, not content to fold back into beads.
 */
export const CONFLICT_COMMENT_MARKER = '**tbd sync conflict**';

/**
 * A report that a field diverged and one value was discarded.
 */
export interface ConflictReport {
  beadId: string;
  field: string;
  keptValue: unknown;
  discardedValue: unknown;
  /** Where the discarded value was archived, relative to the repo root. */
  atticPath: string;
}

/**
 * One planned mirror operation for a single bead.
 */
export interface MirrorAction {
  bead: Issue;
  /** Selected local parent whose provider identity must exist before this action. */
  parentBeadId?: string;
  /** Absent when the bead has no external item yet and one must be created. */
  externalId?: string;
  patch: CanonicalPatch;
  attachments: AttachmentSpec[];
  /** Managed description block, or null to leave the description alone. */
  managedBlock: string | null;
  /** Set when the action cannot proceed; the bead is reported and skipped. */
  skipReason?: string;
}

/**
 * A complete mirror plan. Pure: computing it performs no writes, so `--dry-run`
 * and a real run share one code path.
 */
export interface MirrorPlan {
  provider: ProviderNameType;
  creates: MirrorAction[];
  updates: MirrorAction[];
  skips: MirrorAction[];
}

/**
 * The outcome of applying a mirror plan.
 */
export interface MirrorReport {
  provider: ProviderNameType;
  created: string[];
  updated: string[];
  skipped: { beadId: string; reason: string }[];
  /** Non-fatal failures: the run is degraded but git state is untouched. */
  failures: { beadId: string; error: string }[];
}

/**
 * The interface every provider implements.
 */
export interface TrackerAdapter {
  readonly provider: ProviderNameType;

  /** Whether this canonical assignee has an explicit, safe provider mapping. */
  canPushAssignee(assignee: string | null): boolean;

  /** Parse `FIN-123`, a provider URL, or `owner/repo#12` into a ref. */
  resolveRef(ref: string): Promise<ExternalRef>;

  /** Fetch external items by id, batched, mapped to canonical values. */
  fetchIssues(ids: string[]): Promise<ExternalIssue[]>;

  /** Create an external item and return its ref. */
  createIssue(patch: CanonicalPatch, clientId?: string): Promise<ExternalRef>;

  /** Apply a patch, returning the provider's new updatedAt for echo suppression. */
  applyChanges(id: string, patch: CanonicalPatch): Promise<{ updatedAt: string }>;

  /** Upsert attachments, keyed by url. Idempotent. */
  upsertAttachments(id: string, attachments: AttachmentSpec[]): Promise<void>;

  /** Attachment URLs currently on an item, used for the cross-repo link guard. */
  listAttachmentUrls(id: string): Promise<string[]>;

  /** Replace only the managed region and return the provider write timestamp, if changed. */
  spliceDescription(id: string, block: string): Promise<{ updatedAt: string } | null>;

  /**
   * Post a conflict report where a human will see it. `clientId` makes replay
   * exactly-once: the provider honors client-generated comment ids and rejects
   * duplicates (verified live), which the adapter converts to success.
   */
  postConflict(
    id: string,
    report: ConflictReport,
    clientId?: string,
  ): Promise<{ commentId: string }>;

  /** Create a plain comment. Duplicate client ids are treated as success. */
  createComment(id: string, body: string, clientId?: string): Promise<{ commentId: string }>;

  /** Mark a comment resolved (the conflict-report lifecycle). */
  resolveComment(commentId: string): Promise<void>;

  /** All comments on an item, oldest first, canonicalized. */
  listComments(id: string): Promise<ExternalComment[]>;

  /**
   * Every item in the configured scope touched after `since`. The delta
   * primitive for pull: an efficiency prefilter, never a correctness input.
   */
  fetchUpdatedSince(since: string): Promise<ExternalIssue[]>;

  /** Resolve, and cache, the provider metadata needed to push. */
  ensureMeta(force?: boolean): Promise<ProviderMeta>;
}
