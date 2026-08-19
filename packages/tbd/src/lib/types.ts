/**
 * TypeScript types derived from Zod schemas.
 *
 * These types are the canonical TypeScript interface for tbd entities.
 */

import type { z } from 'zod';

import type {
  IssueSchema,
  IssueDoc,
  IssueRef,
  IssueStatus,
  IssueResolution,
  IssueKind,
  Priority,
  Dependency,
  LinkedEntry,
  ProviderName,
  ConfigSchema,
  IntegrationsConfigSchema,
  IntegrationSelectSchema,
  InboundClauseSchema,
  FieldSyncClauseSchema,
  PolicyDefinitionSchema,
  PolicyName,
  BridgeBaseSchema,
  LinkRecordSchema,
  LinearIntegrationSchema,
  GithubIntegrationSchema,
  CommonDirLayoutSchema,
  MetaSchema,
  LocalStateSchema,
  AtticEntrySchema,
} from './schemas.js';

// =============================================================================
// Entity Types
// =============================================================================

/**
 * A tbd issue entity.
 */
export type Issue = z.infer<typeof IssueSchema>;

/**
 * A supporting document attached to a bead (f08+).
 */
export type IssueDocEntry = z.infer<typeof IssueDoc>;

/**
 * An external reference attached to a bead (f08+).
 */
export type IssueRefEntry = z.infer<typeof IssueRef>;

/**
 * Issue status enum values.
 */
export type IssueStatusType = z.infer<typeof IssueStatus>;

/**
 * Terminal resolution values: why closed work ended.
 */
export type IssueResolutionType = z.infer<typeof IssueResolution>;

/**
 * Issue kind enum values.
 */
export type IssueKindType = z.infer<typeof IssueKind>;

/**
 * Priority level (0-4).
 */
export type PriorityType = z.infer<typeof Priority>;

/**
 * A dependency relationship.
 */
export type DependencyType = z.infer<typeof Dependency>;

/**
 * A link from a bead to an item in an external tracker.
 */
export type LinkedEntryType = z.infer<typeof LinkedEntry>;

/**
 * External tracker provider name.
 */
export type ProviderNameType = z.infer<typeof ProviderName>;

// =============================================================================
// Configuration Types
// =============================================================================

/**
 * Project configuration.
 */
export type Config = z.infer<typeof ConfigSchema>;

/**
 * External tracker integration configuration.
 */
export type IntegrationsConfig = z.infer<typeof IntegrationsConfigSchema>;

/**
 * Which beads an integration mirrors outward.
 */
export type IntegrationSelect = z.infer<typeof IntegrationSelectSchema>;

/** The inbound creation clause of a linking policy. */
export type InboundClause = z.infer<typeof InboundClauseSchema>;

/** The field_sync clause of a linking policy. */
export type FieldSyncClause = z.infer<typeof FieldSyncClauseSchema>;

/** A fully resolved linking policy. */
export type PolicyDefinition = z.infer<typeof PolicyDefinitionSchema>;

/** Named policy presets. */
export type PolicyNameType = z.infer<typeof PolicyName>;

/** Canonical field values at a link's last reconciliation. */
export type BridgeBase = z.infer<typeof BridgeBaseSchema>;

/** One link's bridge record on the sync branch. */
export type LinkRecord = z.infer<typeof LinkRecordSchema>;

/**
 * Linear-specific integration configuration.
 */
export type LinearIntegrationConfig = z.infer<typeof LinearIntegrationSchema>;

/**
 * GitHub-specific integration configuration.
 */
export type GithubIntegrationConfig = z.infer<typeof GithubIntegrationSchema>;

/**
 * Git common-dir local layout metadata.
 */
export type CommonDirLayout = z.infer<typeof CommonDirLayoutSchema>;

/**
 * Shared metadata.
 */
export type Meta = z.infer<typeof MetaSchema>;

/**
 * Per-node local state.
 */
export type LocalState = z.infer<typeof LocalStateSchema>;

/**
 * Attic entry for conflict losers.
 */
export type AtticEntry = z.infer<typeof AtticEntrySchema>;

// =============================================================================
// Input Types for Commands
// =============================================================================

/**
 * Options for creating an issue.
 */
export interface CreateIssueOptions {
  title: string;
  description?: string;
  kind?: IssueKindType;
  priority?: PriorityType;
  assignee?: string;
  labels?: string[];
  parent_id?: string;
  due_date?: string;
  deferred_until?: string;
}

/**
 * Options for updating an issue.
 */
export interface UpdateIssueOptions {
  title?: string;
  description?: string;
  notes?: string;
  kind?: IssueKindType;
  status?: IssueStatusType;
  priority?: PriorityType;
  assignee?: string | null;
  addLabels?: string[];
  removeLabels?: string[];
  parent_id?: string | null;
  due_date?: string | null;
  deferred_until?: string | null;
}

/**
 * Options for listing issues.
 */
export interface ListIssuesOptions {
  status?: IssueStatusType | IssueStatusType[];
  kind?: IssueKindType | IssueKindType[];
  priority?: PriorityType;
  assignee?: string;
  labels?: string[];
  parent?: string;
  all?: boolean;
  sort?: 'priority' | 'created' | 'updated';
  limit?: number;
}

/**
 * Options for searching issues.
 */
export interface SearchIssuesOptions {
  query: string;
  status?: IssueStatusType | IssueStatusType[];
  limit?: number;
}

// =============================================================================
// CLI Utility Types
// =============================================================================

/**
 * A documentation section with title and slug.
 * Used by docs and design commands.
 */
export interface DocSection {
  title: string;
  slug: string;
}

/**
 * Logger interface for long-running operations in non-CLI layers.
 *
 * Allows core logic (file/, lib/) to report progress without depending on
 * the CLI output layer. CLI commands create an OperationLogger via
 * `OutputManager.logger(spinner)` and pass it to core functions.
 *
 * All methods are required. Use `noopLogger` when no logging is needed.
 */
export interface OperationLogger {
  /** Key milestones; drives the spinner in CLI context */
  progress: (message: string) => void;
  /** Operational detail (shown with --verbose or --debug) */
  info: (message: string) => void;
  /** Non-fatal warnings */
  warn: (message: string) => void;
  /** Internal state for troubleshooting (shown with --debug only) */
  debug: (message: string) => void;
}

/**
 * No-op logger for when no logging is needed.
 * Analogous to noopSpinner in the CLI layer.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-function
const noop = () => {};
export const noopLogger: OperationLogger = {
  progress: noop,
  info: noop,
  warn: noop,
  debug: noop,
};
