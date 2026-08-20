/**
 * Zod schemas for tbd entities.
 *
 * These schemas are the normative specification for the file format.
 * See: tbd-design.md §2.6 Schemas
 */

import { z } from 'zod';

import { DISPLAY_PREFIX_PATTERN_SOURCE, EXTERNAL_SHORT_ID_PATTERN_SOURCE } from './display-id.js';

// =============================================================================
// Common Types (§2.6.1)
// =============================================================================

/**
 * ISO8601 timestamp with Z suffix (UTC).
 */
export const Timestamp = z.string().datetime();

/**
 * Issue ID: prefix + 26 lowercase alphanumeric characters (ULID format).
 * Format: is-{ulid} where ulid is 26 chars (a-z, 0-9).
 * Example: is-01hx5zzkbkactav9wevgemmvrz
 */
export const IssueId = z.string().regex(/^is-[0-9a-z]{26}$/);

/**
 * Short ID: 1+ base36 characters used for external/display IDs.
 * Typically 4 chars for new IDs (e.g., a7k2, b3m9).
 * Imports may preserve longer numeric IDs (e.g., "100" from "tbd-100").
 * Legacy imports may include dots (e.g., "208.1" from hierarchical numbering).
 * Imports may include dashes/underscores (e.g., "stat-in_progress" from JSONL).
 */
export const ShortId = z.string().regex(/^[0-9a-z._-]+$/);

/**
 * ULID: 26 lowercase alphanumeric characters.
 * Used in internal IDs and ID mappings.
 * Example: 01hx5zzkbkactav9wevgemmvrz
 */
export const Ulid = z.string().regex(/^[0-9a-z]{26}$/);

/**
 * External Issue ID input: accepts {prefix}-{short} or just {short}.
 * Examples: bd-a7k2, a7k2, bd-100, 100
 */
export const ExternalIssueIdInput = z
  .string()
  .regex(new RegExp(`^(?:${DISPLAY_PREFIX_PATTERN_SOURCE}-)?${EXTERNAL_SHORT_ID_PATTERN_SOURCE}$`));

/**
 * Edit counter - incremented on every local change.
 * NOTE: Version is NOT used for conflict detection (Git push rejection is used).
 * Content hash is used as tiebreaker during merge resolution.
 * Version is informational only - set to max(local, remote) + 1 after merges.
 */
export const Version = z.number().int().nonnegative();

/**
 * Entity type discriminator.
 */
export const EntityType = z.literal('is');

// =============================================================================
// BaseEntity (§2.6.2)
// =============================================================================

/**
 * All entities share common fields.
 */
export const BaseEntity = z.object({
  type: EntityType,
  id: IssueId,
  version: Version,
  created_at: Timestamp,
  updated_at: Timestamp,

  // Extensibility namespace for third-party data
  extensions: z.record(z.string(), z.unknown()).optional(),
});

// =============================================================================
// Issue Schema (§2.6.3)
// =============================================================================

/**
 * Issue status values matching Beads.
 */
export const IssueStatus = z.enum(['open', 'in_progress', 'blocked', 'deferred', 'closed']);

/**
 * Why closed work ended, on the axis beside {@link IssueStatus} rather than inside it.
 *
 * `status` is a lifecycle *position* and every consumer that asks "is this finished"
 * tests `status === 'closed'`. The reason it finished is a different question, so it
 * gets a different field: encoding `canceled` as a position would turn every terminal
 * test into a set-membership check and buy nothing, since nothing in tbd wants canceled
 * work to sit anywhere else.
 *
 * Absent reads as `completed`, which is what makes this additive: every bead closed
 * before this field existed stays correct with no backfill.
 */
export const IssueResolution = z.enum(['completed', 'canceled', 'duplicate']);

/**
 * Why open work is not moving, on the axis beside {@link IssueStatus}.
 *
 * The mirror image of {@link IssueResolution} at the other end of the lifecycle. A hold
 * is a *modifier* on a position, not a position itself: `deferred` had to overwrite
 * `in_progress` to say "paused", which destroyed the one fact that made it interesting
 * — that the work had started. Position and modifier are independent here, so
 * `in_progress` + `paused` says "begun, then set down" without losing either half.
 *
 * Only valid while the work is not terminal.
 */
export const IssueHold = z.enum(['blocked', 'paused']);

/**
 * Issue kind/type values matching Beads.
 * Note: CLI uses --type flag, which maps to this `kind` field.
 */
export const IssueKind = z.enum(['bug', 'feature', 'task', 'epic', 'chore']);

/**
 * Maximum issue title length before detail belongs in the description body.
 */
export const ISSUE_TITLE_MAX_LENGTH = 500;

/**
 * Maximum issue body section length to keep issue files practical to review and sync.
 */
export const ISSUE_BODY_MAX_LENGTH = 50_000;

/**
 * Issue title text as persisted in issue files.
 */
export const IssueTitle = z.string().min(1).max(ISSUE_TITLE_MAX_LENGTH);

/**
 * Priority: 0 (highest/critical) to 4 (lowest).
 */
export const Priority = z.number().int().min(0).max(4);

/**
 * Dependency types - only "blocks" supported initially.
 */
export const DependencyRelationType = z.enum(['blocks']);

/**
 * A dependency relationship.
 */
export const Dependency = z.object({
  type: DependencyRelationType,
  target: IssueId,
});

/**
 * External tracker providers that a bead can be linked to.
 */
export const ProviderName = z.enum(['linear', 'github']);

/**
 * A link from a bead to an item in an external tracker.
 *
 * Stored under `extensions.<provider>` rather than as a top-level issue field.
 * `extensions` is already part of `BaseEntity` with opaque contents, so a tbd
 * that predates this feature round-trips the link untouched instead of silently
 * stripping it. That keeps the bead side additive, with no format bump.
 * (The config side is the opposite: `integrations` is a new top-level config key,
 * which is why the repository format is gated at f07. See tbd-format.ts.)
 *
 * The namespace key IS the provider, which makes "at most one link per provider"
 * structural rather than a rule the merge code has to enforce.
 *
 * `id` is the provider's stable internal identifier and is the canonical key:
 * human identifiers like Linear's `FIN-123` change when an issue moves between
 * teams, but the UUID does not. `key` and `url` are display conveniences and are
 * refreshed on each sync.
 */
export const LinkedEntry = z.object({
  provider: ProviderName,
  id: z.string().min(1),
  key: z.string().min(1).nullable().optional(),
  url: z.string().min(1).nullable().optional(),
  linked_at: Timestamp,
});

/**
 * A supporting document for a bead (f08+).
 *
 * Deliberately separate from `spec_path`, which stays singular and load-bearing: it is
 * *the doc this work is defined by*, it propagates to descendants, and selection and
 * `list --spec` read it. `docs` is *what else you should read* — plural, local, not
 * inherited.
 *
 * The value is a repo-relative path rather than a URL because the document lives in this
 * repository, where a path is stable and a URL is branch-dependent. `specPermalink`
 * already resolves any path to a branch-correct blob URL for rendering.
 *
 * `role` is an open string with known values, not an enum: an unrecognized role should
 * render generically, never fail a sync.
 */
export const IssueDoc = z.object({
  /** Repo-relative path. The identity of the entry, so adds are idempotent. */
  path: z.string().min(1),
  /** Known values: research, architecture, qa, design. Open by design. */
  role: z.string().min(1).nullable().optional(),
  title: z.string().min(1).nullable().optional(),
});

/**
 * An external reference from a bead (f08+): a GitHub issue, a PR, a dashboard.
 *
 * Distinct from `extensions.<provider>`, which is reserved for *tracker identity* — the
 * one external item a bead **is** — and stays single-valued by design. A bead may
 * reference several GitHub issues that are not its identity; those are refs. Keeping
 * them apart is also why refs do not require a GitHub adapter to be useful.
 *
 * Provider-neutral by construction: a ref is a URL with a kind, and nothing about it
 * knows Linear exists. The same field carries a GitLab MR or a Notion page.
 */
export const IssueRef = z.object({
  /** Known values: pr, issue, design, other. Open for the same reason as `role`. */
  kind: z.string().min(1),
  /** Absolute URL. The identity of the entry, so adds are idempotent. */
  url: z.string().min(1),
  title: z.string().min(1).nullable().optional(),
  at: Timestamp.nullable().optional(),
});

/**
 * Full issue schema.
 *
 * Field order is canonical and mirrored by ISSUE_FIELD_ORDER below:
 * type, id, title, kind, status, priority, version (the "header seven"),
 * then linkages, assignment, hierarchy, scheduling, provenance,
 * timestamps, lifecycle, and extensions.
 *
 * Note: Fields use .nullable() in addition to .optional() because
 * YAML parses `field: null` as JavaScript null, not undefined.
 *
 * Design note: We could add the short ID to this schema. We didn't originally
 * because it's one more field to maintain consistency around across files.
 * Having it here might make recovery of lost ID mappings far easier, but for
 * now we have more reliable management of the mappings file (ids.yml) and
 * consider it authoritative. See IdMappingYamlSchema (§2.6.8).
 */
export const IssueSchema = BaseEntity.extend({
  // Header seven: the fields you always want to see at a glance
  type: z.literal('is'),
  // id, version inherited from BaseEntity
  title: IssueTitle,
  kind: IssueKind.default('task'),
  status: IssueStatus.default('open'),
  priority: Priority.default(2),

  // Body content (serialized outside frontmatter)
  description: z.string().max(ISSUE_BODY_MAX_LENGTH).nullable().optional(),
  notes: z.string().max(ISSUE_BODY_MAX_LENGTH).nullable().optional(),

  // Linkages
  spec_path: z.string().nullable().optional(),
  /**
   * Supporting documents in this repo (f08+). Union-merged on `path`.
   *
   * Optional rather than `.default([])` on purpose: a default would serialize
   * `docs: []` into every one of the repository's beads, adding two lines of noise to
   * ~1,700 files and a large diff the first time each is touched, to say nothing. Absent
   * means absent.
   */
  docs: z.array(IssueDoc).optional(),
  /** External references — PRs, issues, dashboards (f08+). Union-merged on `url`. */
  refs: z.array(IssueRef).optional(),

  // Assignment and categorization
  assignee: z.string().nullable().optional(),
  /**
   * Who is acting on the work, when that differs from who is accountable for it.
   *
   * `assignee` answers "whose plate is this on"; an agent in that slot destroys the
   * answer. Absent reads as "same as assignee". Linear renders this as `delegate`,
   * which is the field its agent platform hangs off.
   */
  delegate: z.string().nullable().optional(),
  labels: z.array(z.string()).default([]),
  dependencies: z.array(Dependency).default([]),

  // Hierarchical issues
  parent_id: IssueId.nullable().optional(),

  // Child ordering hints - soft ordering for children under this parent.
  // Array of internal IssueIds in preferred display order.
  // May contain stale IDs; display logic filters for actual children.
  child_order_hints: z.array(IssueId).nullable().optional(),

  // Scheduling
  due_date: Timestamp.nullable().optional(),
  deferred_until: Timestamp.nullable().optional(),
  /** Why open work is not moving. Only while non-terminal. */
  hold: IssueHold.nullable().optional(),
  /** When a `paused` hold is expected to lift. tbd-native; never a tracker snooze. */
  hold_until: Timestamp.nullable().optional(),

  // Provenance and lifecycle
  created_by: z.string().nullable().optional(),
  /**
   * When the work first entered `in_progress`. Never cleared once set.
   *
   * The record that makes "paused" distinguishable from "never started": both are
   * inactive, and without this they are the same bead. Pausing, resuming, and closing
   * all leave it alone, because it is a fact about history rather than current state.
   */
  started_at: Timestamp.nullable().optional(),
  closed_at: Timestamp.nullable().optional(),
  close_reason: z.string().nullable().optional(),
  /** Why the work ended. Only on `closed`; absent reads as `completed`. */
  resolution: IssueResolution.nullable().optional(),
  /**
   * The bead this one duplicates. Required with `resolution: duplicate`.
   *
   * A scalar rather than a dependency edge: edges mean *blocks* here, and `ready` and
   * the blocked computation read them, so a duplicate relation in that graph would
   * change what those queries see. Providers that model duplicate as a relation get
   * it built from this value in their adapter.
   */
  duplicate_of: IssueId.nullable().optional(),
})
  // Preserve unknown keys (f08+). This is the reason f08 exists.
  //
  // In strip mode a client silently DELETES any bead field it does not know, and
  // `tbd sync` rewrites beads during ordinary merges — so an older client touching a
  // repository would quietly strip newer metadata from every bead it saw, not just from
  // a file someone explicitly edited. That is a data-loss vector, which is why the
  // format bump accompanies this: pre-f08 clients now fail closed instead.
  //
  // Preserving here is only half the job. `mergeIssues` (file/git.ts) must also carry
  // keys outside FIELD_STRATEGIES, or a preserved key is dropped at the next merge.
  .passthrough()
  // The terminal axis is only meaningful at the terminal end, and `duplicate` is only
  // meaningful with a pointer. Both providers that model duplicate (Linear's relation,
  // GitHub's `duplicateIssueId`) reached the same conclusion independently, so a bare
  // `duplicate` cannot be rendered on either and is rejected here rather than at push
  // time, where the write has already happened.
  .superRefine((issue, ctx) => {
    if (issue.resolution != null && issue.status !== 'closed') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['resolution'],
        message: `resolution is only valid on a closed issue (status: ${issue.status})`,
      });
    }
    if (issue.resolution === 'duplicate' && issue.duplicate_of == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['duplicate_of'],
        message: 'duplicate_of is required when resolution is duplicate',
      });
    }
    if (issue.hold != null && issue.status === 'closed') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['hold'],
        message: 'hold is only valid on work that is not closed',
      });
    }
    if (issue.hold_until != null && issue.hold !== 'paused') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['hold_until'],
        message: 'hold_until is only valid with hold: paused',
      });
    }
    if (issue.duplicate_of != null && issue.resolution !== 'duplicate') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['duplicate_of'],
        message: 'duplicate_of is only valid with resolution: duplicate',
      });
    }
  });

/**
 * A recorded answer to "which provider user is this tbd handle?".
 *
 * Keyed on disk by `provider_user_id`, because that is the identity; `display_name` is
 * a label kept only so `tbd doctor` can report when the directory has drifted from it.
 * No email is stored: the sync branch should not become a contact directory.
 */
export const ActorBindingSchema = z.object({
  handle: z.string().min(1),
  provider_user_id: z.string().min(1),
  display_name: z.string(),
  bound_at: Timestamp,
});

// =============================================================================
// Config Schema (§2.6.4)
// =============================================================================

/**
 * Git branch name - restricted to safe characters.
 * Allows: alphanumeric, hyphens, underscores, forward slashes, and dots.
 * Prevents shell injection in git commands.
 */
export const GitBranchName = z
  .string()
  .min(1)
  .max(255)
  .regex(
    /^[a-zA-Z0-9._/-]+$/,
    'Invalid branch name: only alphanumeric, dots, underscores, hyphens, and slashes allowed',
  );

/**
 * Git remote name - restricted to safe characters.
 * Allows: alphanumeric, hyphens, underscores, and dots.
 * Prevents shell injection in git commands.
 */
export const GitRemoteName = z
  .string()
  .min(1)
  .max(255)
  .regex(
    /^[a-zA-Z0-9._-]+$/,
    'Invalid remote name: only alphanumeric, dots, underscores, and hyphens allowed',
  );

/**
 * Canonical local storage backend for issue sync machinery.
 */
export const SyncStorage = z.enum(['git-common-dir-v1']);

/**
 * Doc cache configuration - maps destination paths to source locations.
 *
 * Keys are destination paths relative to .tbd/docs/ (e.g., "shortcuts/standard/code-review-and-commit.md")
 * Values are source docrefs:
 * - internal: bundled docs (e.g., "internal:guidelines/typescript-rules.md")
 * - git: a file in a repo (e.g., "github:owner/repo@main//docs/file.md"; gitlab: too)
 * - url: a plain URL kept verbatim (e.g., "https://example.com/file.md")
 * See `tbd docs show docref-format` for the full grammar.
 *
 * Example:
 * ```yaml
 * doc_cache:
 *   shortcuts/standard/code-review-and-commit.md: internal:shortcuts/standard/code-review-and-commit.md
 *   shortcuts/custom/my-shortcut.md: github:org/repo@main//shortcuts/my-shortcut.md
 * ```
 */
export const DocCacheConfigSchema = z.record(z.string(), z.string());

/**
 * Documentation cache configuration (consolidated structure).
 *
 * Combines file sync mappings and lookup paths into a single config block.
 * See: docs/project/specs/active/plan-2026-01-26-docs-cache-config-restructure.md
 */
export const DocsCacheSchema = z.object({
  /**
   * Files to sync: maps destination paths to source locations.
   * Keys are destination paths relative to .tbd/docs/
   * Values are source docrefs:
   * - internal: bundled docs (e.g., "internal:guidelines/typescript-rules.md")
   * - git: a file in a repo (e.g., "github:owner/repo@main//docs/file.md"; gitlab: too)
   * - url: a plain URL kept verbatim (e.g., "https://example.com/file.md")
   * See `tbd docs show docref-format` for the full grammar.
   */
  files: z.record(z.string(), z.string()).optional(),
  /**
   * Ordered local-path docrefs (./-prefixed) naming additional in-repo doc
   * directories. They slot into the effective lookup order between the fork
   * dir and the cache; docs found there serve with state `local` and are not
   * forkable or updatable (they already live in the repo).
   */
  local_dirs: z.array(z.string()).optional(),
  /**
   * Search paths for doc lookup (like shell $PATH).
   * Earlier paths take precedence when names conflict.
   */
  lookup_path: z
    .array(z.string())
    .default(['.tbd/docs/shortcuts/system', '.tbd/docs/shortcuts/standard']),
});

/**
 * Project configuration stored in .tbd/config.yml
 *
 * ⚠️ FORMAT VERSIONING: See tbd-format.ts for version history and migration rules.
 * The tbd_format field tracks breaking changes to this schema.
 *
 * ⚠️ FORWARD COMPATIBILITY POLICY:
 * This schema uses Zod's default strip() mode, which discards unknown fields.
 * To prevent data loss when users mix tbd versions:
 *
 * 1. **When changing config schema (adding, removing, or modifying fields), ALWAYS
 *    bump the format version** (e.g., f03 → f04)
 * 2. Older tbd versions will error when they see an unknown format version
 * 3. The error message tells users to upgrade tbd
 *
 * This ensures older versions fail fast rather than silently corrupting config.
 * The format version check happens in config.ts via isCompatibleFormat().
 *
 * See tbd-format.ts for format version history and migration rules.
 */
/**
 * One entry in the config upgrade history (`tbd_upgrades`).
 * Records a tbd version that ran `tbd setup` in this repo.
 */
export const UpgradeEntrySchema = z.object({
  /** The tbd version string (e.g. "0.3.0", or a dev build string). */
  version: z.string(),
  /**
   * When this version first ran setup (ISO 8601). Optional: the entry seeded from a
   * pre-f06 config has no timestamp because the original install time is unknown.
   */
  at: Timestamp.optional(),
});

/**
 * Which beads an integration mirrors outward.
 *
 * The default is epics in an active status: the point of the mirror is the
 * filter, so mirroring the whole store would defeat it. Explicitly linked beads
 * are always included regardless of these predicates.
 */
export const SpecSelector = z.enum(['none', 'active', 'any']);

export const IntegrationSelectSchema = z
  .object({
    /** Kinds that qualify on their own, e.g. every open epic. */
    kinds: z.array(IssueKind).default(['epic']),
    /**
     * Statuses a bead must be in to qualify. Acts as a gate over `kinds` and
     * `specs` alike, which is what keeps closed work out of the mirror.
     */
    statuses: z.array(IssueStatus).default(['open', 'in_progress', 'blocked']),
    labels: z.array(z.string()).default([]),
    /**
     * Qualify a bead by its linked plan spec, independently of its kind:
     * `active` matches only specs under a `specs/active/` directory, `any`
     * matches any `spec_path`, and `none` disables the rule. Specs that have been
     * archived out of `active/` stop being mirrored, which is the point.
     */
    specs: SpecSelector.default('none'),
    linked: z.boolean().default(true),
    /**
     * Levels of sub-issue nesting to mirror (f08+; was a flat provider key).
     *
     * It is a selection concern, so it belongs beside the other outbound clauses where
     * a policy preset can carry it. Optional so it is not written into every config
     * that never set it; `resolveProviderSettings` supplies the default.
     */
    max_nesting: z.number().int().min(1).max(5).optional(),
  })
  // Passthrough (f08+). ConfigSchema and the provider blocks preserved unknown keys
  // from f07, but these nested clauses did not — so a selection key added by a newer
  // tbd was stripped the next time an older one rewrote config.yml. That gap is why any
  // new selection clause had to wait for a bump; closing it here means it does not
  // recur.
  .passthrough();

/**
 * One synchronized comment, as persisted in a bead's `extensions.<provider>`
 * namespace. An allow-list, like the link payload: identity, timestamp, an
 * author DISPLAY NAME (never an email), and a capped body. An inbound comment
 * carries the provider's immutable `id`; a locally authored one starts with
 * only `local_id` (a ulid) and gains `id` when pushed.
 */
export const CommentEntry = z
  .object({
    id: z.string().min(1).optional(),
    local_id: z.string().min(1).optional(),
    at: Timestamp,
    author: z.string().nullable().optional(),
    body: z.string(),
  })
  .refine((entry) => entry.id !== undefined || entry.local_id !== undefined, {
    message: 'a comment entry needs an id or a local_id',
  });

/** Stored comment bodies are capped; the full text lives in the tracker. */
export const COMMENT_BODY_CAP = 10_000;
/** Beads keep at most this many full comment entries; older ones stub out. */
export const COMMENTS_PER_BEAD_CAP = 50;

/**
 * Canonical (tbd-space) field values at the last successful reconciliation of
 * a linked pair. Scalars are stored verbatim; the description is stored only
 * as a normalized hash — change detection needs equality, not content, and
 * bridge records are committed to git, where tracker prose does not belong.
 */
export const BridgeBaseSchema = z.object({
  title: z.string(),
  status: IssueStatus,
  /**
   * The board position agreed at the last sync, once a run compares slots.
   *
   * Optional because every base written before slots existed holds only `status`.
   * Absent, it is derived on read rather than backfilled by a migration pass, so
   * upgrading writes nothing until a pair syncs for its own reasons.
   */
  slot: z.string().optional(),
  priority: Priority,
  labels: z.array(z.string()).default([]),
  assignee: z.string().nullable().optional(),
  description_hash: z.string(),
});

/**
 * One link's bridge record: the sync-branch state that makes reconciliation
 * three-way. The bead carries identity (`extensions.<provider>`); this record
 * carries dynamics (base tuple, watermarks), which churn on every sync and
 * belong on the sync branch rather than in bead history.
 *
 * Records merge by newest observation (higher `remote_updated_at`, then
 * `synced_at`): both sides of a merge are observations of the same external
 * truth, so the later observation wins, conflict-free by construction.
 */
export const LinkRecordSchema = z.object({
  type: z.literal('lk'),
  bead_id: IssueId,
  external_id: z.string().min(1),
  /**
   * The tracker's human identifier and URL as of the last sync (`OS-77`).
   *
   * Cache for display, never identity. Both are derived from mutable tracker
   * state: a Linear identifier is `{teamKey}-{number}`, so renaming a team
   * rewrites every identifier in it, and moving an issue between teams
   * renumbers it. `external_id` — an immutable UUID — is why a link still
   * resolves across either change.
   *
   * They live here rather than on the bead precisely because they churn:
   * the bead records identity, this record records dynamics, and a value the
   * tracker can invalidate wholesale belongs on the side that is rewritten
   * every sync. Optional because not every provider has both.
   */
  external_key: z.string().min(1).nullable().optional(),
  external_url: z.string().min(1).nullable().optional(),
  /**
   * The tracker state id for a column tbd has no name of its own for (f08+).
   *
   * A team's own "In QA" is `started` work as far as agreement goes, but writing it
   * back as a generic In Progress would drag the issue out of the column someone put
   * it in. Recording the exact id is what lets an outbound write put it back verbatim.
   *
   * It lives here rather than on the bead for the reason stated above: this is tracker
   * *dynamics*, not identity, and it is rewritten every sync. Measured, too — holding it
   * in `extensions.<provider>` merges the whole namespace last-writer-wins, so a clone
   * recording a refinement while another refreshed `external_key` lost the key outright.
   * Here the refinement and the link it describes travel as one record and cannot
   * disagree.
   */
  refinement_state_id: z.string().min(1).nullable().optional(),
  /**
   * The slot that refinement column resolved to.
   *
   * Stored rather than derived because deriving it needs the column's name, which is
   * exactly what is not in hand when replaying. Replay happens only when a write
   * targets this same slot: the issue is going back to the position it left, so the
   * column it left is still the right one.
   */
  refinement_slot: z.string().min(1).nullable().optional(),
  base: BridgeBaseSchema,
  /** The provider's clock at last sync. A fetch prefilter, never correctness. */
  remote_updated_at: Timestamp,
  synced_at: Timestamp,
  state: z.enum(['linked', 'orphaned']).default('linked'),
});

/**
 * How one field of a linked pair flows between tbd and the tracker.
 *
 * `merge` is full three-way: either side can change it, both-sides changes
 * conflict. `local` means tbd owns the field: it is pushed outward and a
 * tracker-side edit is overwritten on the next sync (reported, never silent).
 * `remote` is the reverse.
 */
export const FieldFlowRule = z.enum(['merge', 'local', 'remote']);

/** Which direction comment sequences flow for linked pairs. */
export const CommentsMode = z.enum(['two_way', 'inbound', 'outbound', 'off']);

/** Fallback when a merge field changed on both sides with different values. */
export const TieBreak = z.enum(['newest', 'local', 'remote']);

/** What happens to unlinked tracker items that match the inbound selector. */
export const InboundMode = z.enum(['off', 'report', 'auto']);

/**
 * The inbound creation clause: when a tracker issue should become a bead.
 *
 * `report` (the default) lists matching items with ready-to-run `import`
 * commands; `auto` imports them during `sync`. `auto` stays opt-in because it
 * lets people outside the repo create work inside it.
 */
export const InboundClauseSchema = z
  .object({
    mode: InboundMode.default('report'),
    /** Only items carrying one of these labels qualify (empty: any item). */
    labels: z.array(z.string()).default([]),
    /** Kind assigned to imported beads. */
    as_kind: IssueKind.default('task'),
  })
  // Passthrough (f08+), same reason as IntegrationSelectSchema.
  .passthrough();

/**
 * The field_sync clause: how a linked pair's fields and comments flow.
 *
 * Defaults: content and triage fields merge (linked pairs converge); `labels`
 * stays local because pulling a team's label taxonomy into beads imports
 * noise; `assignee` stays local because tracker assignees are people
 * (names/emails) and nothing person-identifying lands in beads without an
 * explicit `user_map` and an explicit `assignee: merge`.
 */
export const FieldSyncClauseSchema = z
  .object({
    fields: z
      .object({
        title: FieldFlowRule.default('merge'),
        description: FieldFlowRule.default('merge'),
        status: FieldFlowRule.default('merge'),
        priority: FieldFlowRule.default('merge'),
        labels: FieldFlowRule.default('local'),
        assignee: FieldFlowRule.default('local'),
      })
      .default({}),
    comments: CommentsMode.default('two_way'),
    tie_break: TieBreak.default('newest'),
  })
  // Passthrough (f08+), same reason as IntegrationSelectSchema.
  .passthrough();

/**
 * A linking policy: one structured object answering, per integration, when a
 * bead should create a tracker issue (`outbound`), when a tracker issue should
 * become a bead (`inbound`), and how a linked pair reconciles (`field_sync`).
 *
 * The clause names state their direction deliberately; `sync` is reserved for
 * the full synchronization the `tbd integration sync` command performs.
 */
// Deliberately NOT passthrough, unlike the three clauses it contains. Adding a fourth
// level of passthrough here pushed the inferred ConfigSchema type past what TypeScript
// will serialize for declaration emit (TS7056), and it buys little: the clauses are
// where new keys actually land, and a whole new sibling clause is a big enough change
// to warrant its own format decision anyway.
/**
 * Who owns a mirrored item's archive state.
 *
 * `manual` (the default) means the tracker's archive belongs to the people using it.
 * tbd never archives or unarchives; it treats an archived item as a settled pair and
 * goes quiet, and if a bead reopens under an archived item it reports that plainly
 * rather than reaching into the tracker. Archiving in most trackers is a filing
 * decision — it governs what a human sees in their own views — and a repository's
 * automation is a poor judge of when someone is finished looking at something. The
 * tracker's own retention rules (Linear's team-level auto-archive, for instance) keep
 * working underneath, which is the right place for that policy to live.
 *
 * `on_close` hands the whole lifecycle to tbd: closing a bead archives its item, and
 * reopening one restores it. Coherent because whoever owns the state owns both halves —
 * an integration that archived but never restored would strand reopened work. Suits a
 * tracker used purely as a projection of the repository, where a settled pair has no
 * reason to occupy a human's active view.
 *
 * The enum, rather than a boolean, is the extension point: `on_close_after: <duration>`
 * and similar belong here without another format bump.
 */
export const ArchiveMode = z.enum(['manual', 'on_close']);

export const PolicyDefinitionSchema = z.object({
  outbound: IntegrationSelectSchema.default({}),
  inbound: InboundClauseSchema.default({}),
  field_sync: FieldSyncClauseSchema.default({}),
  /** Optional so it is not written into configs that never set it; resolved to `manual`. */
  archive: ArchiveMode.optional(),
});

/** Named policy presets. Growing this enum is the extension point. */
export const PolicyName = z.enum(['default']);

/**
 * Where mirrored work goes (f08+).
 *
 * Provider-specific inside a provider-neutral group: Linear uses `team_key`/`project`,
 * GitHub would use `repo`. Passthrough so a provider added later can put its own
 * addressing here without another format bump.
 */
export const IntegrationTargetSchema = z
  .object({
    team_key: z.string().min(1).optional(),
    project: z.string().min(1).optional(),
    repo: z.string().min(1).optional(),
  })
  .passthrough();

/**
 * How mirrored work is marked (f08+).
 *
 * `origin` and `repo` are the labels that make a shared Linear surface filterable —
 * they apply in every integration mode by default, because they cost nothing and make a
 * single-repo setup consolidation-ready. `mirror` and `create` are the former
 * `mirror_labels` / `create_labels`.
 */
/**
 * How much of the repository's own bead labels to project.
 *
 * Not a boolean, because "push bead labels" hides a second question that a boolean
 * answers by fiat: under what name. `prefixed` writes `tbd:<label>`, which keeps tbd's
 * labels identifiable and bulk-removable; `verbatim` writes the label as-is, which is
 * what a team wants when their tracker already has a `bug` label and a second `tbd:bug`
 * would be noise.
 */
export const LabelMirrorMode = z.enum(['none', 'prefixed', 'verbatim']);

/**
 * Which missing labels tbd may create on push.
 *
 * Not a boolean, and the reason is concrete rather than speculative. A single flag
 * covered two unrelated categories: tbd's own infrastructure labels (`tbd`,
 * `repo/<name>`, the `tbd:blocked` / `tbd:deferred` status carriers) — a bounded set
 * tbd owns — and mirrored bead labels, which a repository can have hundreds of and which
 * pollute a shared team namespace.
 *
 * Conflating them was a live defect: with creation off, the origin labels were silently
 * dropped on push, so the tracker never received them, so every sync re-asserted them —
 * a permanent write loop in the one code path whose whole purpose is to make a quiet
 * sync free.
 *
 * `tbd` is the default: create what tbd needs to function, never mass-create from bead
 * labels.
 */
export const LabelCreateMode = z.enum(['none', 'tbd', 'all']);

export const IntegrationLabelsSchema = z
  .object({
    /**
     * The marker on every mirrored issue, so a human can filter agent traffic out
     * with `label is not tbd`.
     *
     * `true` uses the default name; a string overrides it, which a workspace already
     * using that name for something else needs. Overriding with a bare name opts out
     * of the collision-proofing the `tbd:` prefix provides — see ORIGIN_LABEL. Symmetric with `repo` below — an earlier
     * draft made this a bare boolean while `repo` took a name, which was an asymmetry
     * with no reason behind it.
     */
    origin: z.union([z.boolean(), z.string().min(1)]).default(true),
    /**
     * Per-repository label in a Linear label group named `repo`.
     * `auto` derives the name from the git origin; a string overrides it; false disables.
     */
    repo: z.union([z.literal('auto'), z.literal(false), z.string().min(1)]).default('auto'),
    /** How to project the repository's own bead labels. Off by default. */
    mirror: LabelMirrorMode.default('none'),
    /** Which missing labels tbd may create on push. */
    create: LabelCreateMode.default('tbd'),
  })
  .passthrough();

/**
 * Who work maps to (f08+).
 */
export const IntegrationIdentitySchema = z
  .object({
    /** Maps a tbd assignee string to a tracker user email or UUID. */
    user_map: z.record(z.string(), z.string()).default({}),
    /**
     * Workflow state name to use for a Linear state type, e.g. `started: Doing`.
     *
     * Only needed when a team has several states of one type and none carries the
     * conventional name. Deliberately not `.default({})`: a defaulted key is
     * re-materialized on every parse and written straight back by `writeConfig`, which
     * is how a migration stops sticking.
     */
    state_map: z.record(z.string(), z.string()).optional(),
    /**
     * Agent name to Linear app-user id, for delegates that may be published.
     *
     * The only identity mapping this design still needs in config, and deliberately so:
     * an agent reaching a shared workspace is a decision, not a discovery. Ordinary
     * session agents are absent from here and therefore stay local by construction.
     */
    agent_map: z.record(z.string(), z.string()).optional(),
  })
  .passthrough();

/**
 * Settings shared by every provider.
 */
const IntegrationProviderBase = {
  /** WHERE mirrored work goes (f08+). Absorbs the legacy team_key/project/repo. */
  target: IntegrationTargetSchema.optional(),
  /** HOW mirrored work is marked (f08+). Absorbs mirror_labels/create_labels. */
  labels: IntegrationLabelsSchema.optional(),
  /** WHO work maps to (f08+). Absorbs user_map. */
  identity: IntegrationIdentitySchema.optional(),

  enabled: z.boolean().default(false),
  /**
   * Deprecated spelling of `policy.outbound`. Retired by the f08 migration, which
   * folds it into `policy.outbound`; still parsed so a config written before that
   * migration runs is read correctly, and `resolvePolicy` still honours it when
   * `policy` is absent (see integrations/core/policy.ts).
   *
   * Optional rather than `.default({})` on purpose. With a default, Zod
   * re-materializes the key on every parse, so `writeConfig` puts it straight back
   * into the file after the migration removed it — the alias would never actually
   * retire, and every config would carry both spellings forever.
   */
  select: IntegrationSelectSchema.optional(),
  /**
   * The linking policy: a preset name or an inline definition. Absent means
   * "legacy": `select` becomes the outbound clause and everything else takes
   * defaults, which preserves Phase 1 behavior exactly.
   */
  policy: z.union([PolicyName, PolicyDefinitionSchema]).optional(),
  /**
   * Levels of sub-issue nesting to mirror. Linear's data model nests without
   * limit, but its views flatten past roughly two levels, so deeper structure
   * stays in beads where `tbd dep` can render it.
   *
   * Legacy position (pre-f08); the f08 migration moves it to `policy.outbound`.
   * Optional so the move sticks — see the note on `select`. Read through
   * `resolveProviderSettings`, never directly.
   */
  max_nesting: z.number().int().min(1).max(5).optional(),
};

export const LinearIntegrationSchema = z
  .object({
    ...IntegrationProviderBase,
    /** Legacy spelling of `target.team_key` (pre-f08). */
    team_key: z.string().min(1).optional(),
    /** Legacy spelling of `target.project` (pre-f08). */
    project: z.string().min(1).optional(),
    /**
     * Push bead labels as Linear labels.
     *
     * Off by default, and deliberately so. A repository can carry a hundred-plus
     * distinct bead labels, and creating one Linear label each pollutes a shared
     * team namespace that other people and projects also use. The labels are
     * already mirrored as structured data in the bead attachment, so turning this
     * on only buys the ability to filter by them inside Linear.
     *
     * When enabled, mirrored labels are prefixed so they are identifiable and
     * removable in bulk. tbd's own status carriers (`tbd:blocked`,
     * `tbd:deferred`) are pushed regardless, because they encode status Linear
     * has no state for.
     */
    mirror_labels: z.boolean().optional(),
    /** Legacy spelling of `labels.create` (pre-f08). */
    create_labels: z.boolean().optional(),
    /** Legacy spelling of `identity.user_map` (pre-f08). */
    user_map: z.record(z.string(), z.string()).optional(),
  })
  // Passthrough for the same reason as the block above: a per-provider setting added
  // by a newer tbd must survive this version rewriting config.yml.
  .passthrough();

export const GithubIntegrationSchema = z
  .object({
    ...IntegrationProviderBase,
    /** Legacy spelling of `target.repo` (pre-f08). */
    repo: z.string().min(1).optional(),
  })
  .passthrough();

/**
 * What plain `tbd sync` does with enabled providers (f08+).
 *
 * This was a boolean (`sync_on_tbd_sync`), which welded two independent
 * decisions together: whether the fold happens at all, and whether the bulk
 * guard is in force when it does. The folded run passes `assumeYes` — so
 * `true` silently waived the 20-create/40-update threshold that exists
 * precisely because a mis-set selector turns "a couple of epics" into "every
 * bead in the repo". There was no way to ask for the fold and keep the guard.
 *
 * - `auto` — fold in and affirm the bulk thresholds. The old `true`, and still
 *   the default: a settled mirror runs small, and prompting a non-interactive
 *   run is not an option anyway.
 * - `guarded` — fold in, but let the bulk guard refuse an oversized run and
 *   report it. The run is non-interactive, so the guard refuses rather than
 *   prompting, leaving `tbd integration sync` for the reviewed pass.
 * - `report` — plan and print, write nothing. What a pilot actually wants, and
 *   what a repo that set `false` for cost reasons was approximating badly.
 * - `off` — providers stay configured but out of `tbd sync`. The old `false`.
 */
export const SyncFoldMode = z.enum(['auto', 'guarded', 'report', 'off']);

export const IntegrationsConfigSchema = z
  .object({
    /**
     * How enabled integrations participate in plain `tbd sync` (f08+).
     *
     * Enabling an integration IS the opt-in, so this resolves to `auto` rather
     * than to a second off-switch that would let a configured tracker silently
     * drift — but the default lives in `resolveSyncFoldMode`, NOT here.
     *
     * With `.default('auto')` on the schema, Zod materializes this key on every
     * read, so it is never `undefined` and the legacy `sync_on_tbd_sync` branch
     * below becomes unreachable. A repository that had set the old boolean to
     * `false` would silently start syncing to its tracker on upgrade. Same trap
     * the flat label keys hit, same fix: optional here, default in the resolver.
     */
    on_tbd_sync: SyncFoldMode.optional(),
    /**
     * Legacy boolean spelling of `on_tbd_sync` (pre-f08). Retired by the f08
     * migration, which translates `true`/`false` into `auto`/`off`; still parsed
     * so a config written before that migration runs is read correctly.
     *
     * Optional rather than `.default(true)`: with a default, Zod re-materializes
     * the key on every read and `writeConfig` writes it back beside the group the
     * migration just created. `resolveSyncFoldMode` supplies the fallback.
     */
    sync_on_tbd_sync: z.boolean().optional(),
    linear: LinearIntegrationSchema.optional(),
    github: GithubIntegrationSchema.optional(),
  })
  // Passthrough so a provider this version does not know (a newer tbd's tracker)
  // survives a read/write round trip instead of being silently dropped.
  .passthrough();

export const ConfigSchema = z
  .object({
    /**
     * Format version for the .tbd/ directory structure.
     * See tbd-format.ts for version history and migration rules.
     * Only bumped for breaking changes that require migration.
     */
    tbd_format: z.string().default('f01'),

    /**
     * The tbd version that last ran `tbd setup` in this repo. Updated on every setup.
     * Informational only; functional version gating is via `tbd_format`. See
     * `tbd_upgrades` for the full history. (As of format f06; before f06 this was the
     * install-time version and never changed.)
     */
    tbd_version: z.string(),
    /**
     * Exact published package version used by generated launchers only when the locally
     * installed CLI cannot read this repository's `tbd_format`. Kept in one central
     * config field so compatible patch releases do not rewrite every launcher script.
     * Optional for repositories created before this field was introduced; `tbd setup`
     * fills it in before installing or refreshing launchers. Parsing stays lenient so
     * setup can repair a malformed value; each launcher validates the exact package
     * grammar before passing it to a runner.
     */
    tbd_fallback_version: z.string().optional(),
    /**
     * Ordered history (oldest first) of tbd versions that have run setup here. Appended
     * on each setup when the version changes; informational. Seeded on the f06 migration
     * from the prior `tbd_version` (without a timestamp). See tbd-format.ts.
     */
    tbd_upgrades: z.array(UpgradeEntrySchema).default([]),
    sync: z
      .object({
        branch: GitBranchName.default('tbd-sync'),
        remote: GitRemoteName.default('origin'),
        storage: SyncStorage.default('git-common-dir-v1'),
      })
      .default({}),
    display: z.object({
      id_prefix: z.string().min(1).max(20), // Required: set during init --prefix or import
    }),
    settings: z
      .object({
        auto_sync: z.boolean().default(false),
        /**
         * How often to automatically sync documentation cache (in hours).
         * - Default: 24 (sync once per day when actively using tbd)
         * - Set to 0 to disable auto-sync
         * - Only triggers when accessing docs (shortcut, guidelines, template commands)
         */
        doc_auto_sync_hours: z.number().default(24),
        /**
         * Whether to install the ensure-gh-cli.sh hook script during setup.
         * When true (default), `tbd setup` installs a SessionStart hook that
         * ensures the GitHub CLI is available in agent sessions.
         * Set to false or use `tbd setup --no-gh-cli` to disable.
         */
        use_gh_cli: z.boolean().default(true),
      })
      .default({}),
    /**
     * Documentation cache configuration (consolidated).
     * Contains files to sync and lookup paths.
     * See DocsCacheSchema for structure details.
     */
    docs_cache: DocsCacheSchema.optional(),
    /**
     * External tracker integrations. Absent means no integration is configured and
     * every integration command and check is inert.
     */
    integrations: IntegrationsConfigSchema.optional(),
  })
  // Preserve unknown top-level keys (f07+). A tbd that strips them silently discards
  // a newer version's configuration the first time it rewrites config.yml — which is
  // how the integrations block was lost three times during the Linear pilot. Keeping
  // them means a future additive block needs no format bump. See tbd-format.ts.
  .passthrough();

// =============================================================================
// Common-Dir Layout Schema
// =============================================================================

/**
 * Local layout metadata stored in $GIT_COMMON_DIR/tbd/layout.yml.
 *
 * This uses the same tbd_format IDs as .tbd/config.yml so local checkout config
 * and Git common-dir machinery advance together during layout migrations.
 */
export const CommonDirLayoutSchema = z.object({
  tbd_format: z.string(),
  sync_storage: SyncStorage.default('git-common-dir-v1'),
  data_sync_worktree: z.literal('data-sync-worktree').default('data-sync-worktree'),
  lock_profile: z.literal('data-sync-v1').default('data-sync-v1'),
  created_at: Timestamp,
  updated_at: Timestamp,
});

// =============================================================================
// Meta Schema (§2.6.5)
// =============================================================================

/**
 * Current schema version for synced payloads on the tbd-sync branch.
 *
 * This is intentionally separate from tbd_format, which tracks local checkout
 * and Git common-dir layout compatibility.
 */
export const DATA_SYNC_SCHEMA_VERSION = 1;

/**
 * Shared metadata stored in .tbd/data-sync/meta.yml
 */
export const MetaSchema = z.object({
  schema_version: z.number().int(),
  created_at: Timestamp,
});

// =============================================================================
// Local State Schema (§2.6.6)
// =============================================================================

/**
 * Per-node state stored in .tbd/state.yml (gitignored).
 * Tracks local timing information that shouldn't be shared across nodes.
 */
export const LocalStateSchema = z.object({
  /** When this node last synced issues successfully */
  last_sync_at: Timestamp.optional(),
  /** When this node last synced the doc cache successfully */
  last_doc_sync_at: Timestamp.optional(),
  /** Whether the user has seen the welcome message */
  welcome_seen: z.boolean().optional(),
  /**
   * This session's agent id (`agid-{ulid}`), minted at session start.
   *
   * Machine-local, never committed: it identifies a transient session in this working
   * directory, and a committed value would be wrong for every other checkout.
   */
  agent_id: z.string().optional(),
  /** Friendly name joined onto `agent_id`. Mutable; identity stays with the id. */
  agent_name: z.string().optional(),
});

// =============================================================================
// Attic Entry Schema (§2.6.7)
// =============================================================================

/**
 * Preserved conflict losers.
 */
export const AtticEntrySchema = z.object({
  entity_id: IssueId,
  timestamp: Timestamp,
  field: z.string(),
  lost_value: z.string(),
  winner_source: z.enum(['local', 'remote']),
  loser_source: z.enum(['local', 'remote']),
  context: z.object({
    local_version: Version,
    remote_version: Version,
    local_updated_at: Timestamp,
    remote_updated_at: Timestamp,
  }),
});

// =============================================================================
// ID Mapping Schema (§2.6.8)
// =============================================================================

/**
 * ID mapping YAML file schema for ids.yml.
 * Maps short IDs to ULIDs.
 * Format: { "a7k2": "01hx5zzkbkactav9wevgemmvrz", ... }
 */
export const IdMappingYamlSchema = z.record(ShortId, Ulid);

// =============================================================================
// Field Order Constants for YAML Serialization
// =============================================================================
//
// Each array defines the canonical field order for YAML output.
// Order mirrors the Zod schema definition above: identity first,
// human-relevant fields next, bookkeeping last.
//
// Used with sortKeys() from yaml-utils.ts and ordering.manual()
// from comparison-chain.ts. Fields not listed sort to the end.

/**
 * Canonical field order for issue YAML frontmatter.
 * (description and notes are body content, not frontmatter)
 */
export const ISSUE_FIELD_ORDER = [
  // Header seven: the fields you always want to see at a glance
  'type',
  'id',
  'title',
  'kind',
  'status',
  'priority',
  'version',

  // Linkages
  'spec_path',
  'docs',
  'refs',

  // Assignment and categorization
  'assignee',
  'delegate',
  'labels',
  'dependencies',

  // Hierarchy
  'parent_id',
  'child_order_hints',

  // Scheduling
  'due_date',
  'deferred_until',
  'hold',
  'hold_until',

  // Provenance
  'created_by',

  // Timestamps
  'created_at',
  'updated_at',
  'started_at',

  // Lifecycle (closure)
  'closed_at',
  'close_reason',
  'resolution',
  'duplicate_of',

  // Extensibility
  'extensions',
] as const;

/**
 * Canonical field order for config YAML.
 */
export const CONFIG_FIELD_ORDER = [
  'tbd_format',
  'tbd_version',
  'tbd_fallback_version',
  'tbd_upgrades',
  'display',
  'sync',
  'settings',
  'docs_cache',
  'integrations',
] as const;

/**
 * Canonical field order for $GIT_COMMON_DIR/tbd/layout.yml.
 */
export const COMMON_DIR_LAYOUT_FIELD_ORDER = [
  'tbd_format',
  'sync_storage',
  'data_sync_worktree',
  'lock_profile',
  'created_at',
  'updated_at',
] as const;

/**
 * Canonical field order for attic entry YAML.
 */
export const ATTIC_ENTRY_FIELD_ORDER = [
  'entity_id',
  'timestamp',
  'field',
  'lost_value',
  'winner_source',
  'loser_source',
  'context',
] as const;

/**
 * Canonical field order for meta YAML.
 */
export const META_FIELD_ORDER = ['schema_version', 'created_at'] as const;

/**
 * Canonical field order for local state YAML.
 */
export const LOCAL_STATE_FIELD_ORDER = [
  'last_sync_at',
  'last_doc_sync_at',
  'welcome_seen',
  'agent_id',
  'agent_name',
] as const;
