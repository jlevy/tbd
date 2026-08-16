/**
 * tbd Directory Format Versioning
 * ================================
 *
 * This file is the SINGLE SOURCE OF TRUTH for .tbd/ directory format versions.
 *
 * WHEN TO BUMP THE FORMAT VERSION:
 * - Bump when changes REQUIRE migration (deleting files, changing formats, moving files)
 * - Bump for config removals, renames, semantic changes, or additions inside a nested
 *   schema that does not preserve unknown keys when an older client could lose data.
 * - Bump when the shape of a format-stamped agent-integration surface changes
 *   incompatibly (e.g. the managed AGENTS.md block). The same format is stamped there
 *   via AGENT_INTEGRATION_FORMAT (integration-paths.ts).
 * - Do NOT bump merely because the implementation of a content-managed launcher script
 *   changes compatibly. Those scripts are refreshed by content comparison and select a
 *   CLI by probing this repository format at runtime.
 * - Do NOT bump for a purely additive top-level config block, or a key inside an
 *   explicitly passthrough schema, once the repository is on f07.
 * - Do NOT bump for additive changes that don't affect config.yml (new directories, etc.)
 *
 * HOW TO ADD A NEW FORMAT VERSION:
 * 1. Add entry to FORMAT_HISTORY with detailed description
 * 2. Implement migrate_fXX_to_fYY() function
 * 3. Add case to migrateToLatest()
 * 4. Update CURRENT_FORMAT
 * 5. Add tests for the migration path
 *
 * FORWARD COMPATIBILITY POLICY:
 * As of f07 ConfigSchema preserves unknown top-level keys, so a config block added by
 * a newer tbd survives a round trip through an older one. That protects future
 * additions; it cannot protect against clients already published, which parse config
 * in strip mode and silently drop what they do not know. The format gate covers them:
 *
 * 1. When making a destructive, semantic, or non-passthrough config change, bump the
 *    format version (e.g., f07 → f08)
 * 2. config.ts checks format compatibility via isCompatibleFormat()
 * 3. Older tbd versions will error with "format 'fXX' is from a newer tbd version"
 * 4. The error tells users to upgrade: npm install -g get-tbd@latest
 *
 * This ensures older versions fail fast rather than silently corrupting config.
 * A purely additive config key no longer needs a bump once every client in use is
 * f07 or later; bump when the meaning of existing fields changes, or when losing the
 * new key to a pre-f07 client would be damaging.
 * See ConfigSchema in schemas.ts and checkFormatCompatibility() in config.ts.
 */

// =============================================================================
// Format Constants
// =============================================================================

/**
 * Current format version.
 * Bump this ONLY for breaking changes that require migration.
 */
export const CURRENT_FORMAT = 'f08';

/**
 * Initial format version for configs that don't have tbd_format field.
 */
export const INITIAL_FORMAT = 'f01';

// =============================================================================
// Format History
// =============================================================================

/**
 * Complete history of format versions with their changes.
 * This serves as documentation and enables version detection.
 */
export const FORMAT_HISTORY = {
  f01: {
    introduced: '0.1.0',
    description: 'Initial format',
    structure: {
      'config.yml': 'Project configuration',
      'state.yml': 'Local state (gitignored)',
      'docs/': 'Documentation cache (gitignored)',
      'issues/': 'Issue YAML files',
    },
  },
  f02: {
    introduced: '0.1.5',
    description: 'Adds configurable doc_cache',
    changes: [
      'Added doc_cache: key to config.yml for configurable doc sources',
      'Added settings.doc_auto_sync_hours for automatic doc refresh',
      'Added last_doc_sync_at to state.yml for tracking sync time',
    ],
    migration: 'Populates default doc_cache config from bundled docs',
  },
  f03: {
    introduced: '0.1.6',
    description: 'Consolidates docs_cache config structure',
    changes: [
      'Consolidated doc_cache: and docs: into single docs_cache: key',
      'Moved doc_cache: -> docs_cache.files:',
      'Moved docs.paths: -> docs_cache.lookup_path:',
      'Removed separate docs: key',
    ],
    migration: 'Migrates old config keys to new docs_cache structure',
  },
  f04: {
    introduced: '0.2.0',
    description: 'Moves local issue sync worktree into the Git common directory',
    changes: [
      'Added sync.storage: git-common-dir-v1 to config.yml',
      'Moved local data-sync worktree machinery to $GIT_COMMON_DIR/tbd/',
      'Added $GIT_COMMON_DIR/tbd/layout.yml using the same tbd_format ID',
    ],
    migration:
      'Initializes shared common-dir sync layout before writing config.yml with tbd_format f04',
  },
  f05: {
    introduced: '0.3.0',
    description: 'Adds the forkable-docs layout (committed fork manifest + visible fork dir)',
    changes: [
      'Added committed fork state under .tbd/doc-forks/ (forks.yml manifest + base/ snapshots)',
      'Added the visible fork dir (docs/tbd/) which shadows the doc cache in lookups',
      'Doc commands (tbd docs fork/unfork/status/update/diff/list) manage that state',
    ],
    migration:
      'Metadata-only: stamps tbd_format f05 (fork artifacts appear only when fork is first ' +
      'used). The shared common-dir layout.yml is re-stamped in place on the next data ' +
      'command. Revert: restore .tbd/config.yml (git checkout) and delete ' +
      '$GIT_COMMON_DIR/tbd/layout.yml; it regenerates from the config.',
  },
  f06: {
    introduced: '0.3.0',
    description: 'Adds the config upgrade history (tbd_upgrades) and redefines tbd_version',
    changes: [
      'Redefined tbd_version: now the version that last ran `tbd setup` (was install-time)',
      'Added tbd_upgrades: ordered history of tbd versions that have run setup here',
    ],
    migration:
      'Seeds tbd_upgrades from the existing tbd_version (no timestamp; the original ' +
      'install time is unknown). Setup then stamps the running version and appends it ' +
      'when changed. Revert: restore .tbd/config.yml (git checkout) and delete ' +
      '$GIT_COMMON_DIR/tbd/layout.yml; it regenerates from the config.',
  },
  f07: {
    introduced: '0.6.0',
    description: 'Adds the external tracker integrations config block and preserves unknown keys',
    changes: [
      'Added the optional integrations: block to config.yml (tracker config and policy)',
      'ConfigSchema now preserves unknown top-level keys instead of stripping them',
      'The integrations block and its provider entries preserve unknown keys too',
    ],
    migration:
      'Metadata-only: stamps tbd_format f07 (the integrations block appears only when a ' +
      'tracker is configured). The bump is what closes the door on pre-0.6.0 clients, ' +
      'which parse config in strip mode and silently drop an integrations block when ' +
      'they rewrite config.yml. From f07 onward unknown keys survive that round trip, so ' +
      'additive config blocks no longer need a format bump. Revert: restore ' +
      '.tbd/config.yml (git checkout) and delete $GIT_COMMON_DIR/tbd/layout.yml; it ' +
      'regenerates from the config.',
  },
  f08: {
    introduced: '0.7.0',
    description: 'Beads preserve unknown keys and gain docs/refs; the integrations config regroups',
    changes: [
      'IssueSchema now preserves unknown keys instead of stripping them',
      'mergeIssues carries keys outside FIELD_STRATEGIES through a three-way merge',
      'Added issue docs: supporting documents, repo-relative paths, union-merged on path',
      'Added issue refs: external references (PRs, issues, dashboards), union-merged on url',
      'The nested integration clauses preserve unknown keys too (select, inbound, fields)',
      'Regrouped the integration provider block into target/policy/labels/identity',
    ],
    migration:
      'Metadata-only for beads: no issue file is rewritten, because the bump exists to ' +
      'stop pre-f08 clients from touching them at all. Those clients parse beads in ' +
      'strip mode, so they delete any field they do not know — and tbd sync rewrites ' +
      'beads during ordinary merges, which makes that a data-loss path across every bead ' +
      'an old client sees, not a single-file inconvenience. The integrations block is ' +
      'regrouped in place (team_key/project into target, max_nesting into ' +
      'policy.outbound, mirror_labels/create_labels into labels, user_map into identity); ' +
      'the transform is mechanical and lossless, and the legacy select alias retires. ' +
      'Revert: restore .tbd/config.yml (git checkout) and delete ' +
      '$GIT_COMMON_DIR/tbd/layout.yml; it regenerates from the config.',
  },
} as const;

export type FormatVersion = keyof typeof FORMAT_HISTORY;

// =============================================================================
// Migration Types
// =============================================================================

/**
 * Raw config data before parsing/validation.
 * Used during migration when we need to work with potentially old formats.
 */
export interface RawConfig {
  tbd_format?: string;
  tbd_version?: string;
  /** Exact published version for generated launchers' incompatible-format fallback. */
  tbd_fallback_version?: string;
  /** Upgrade history (f06+). Seeded on migration; appended by setup. */
  tbd_upgrades?: { version: string; at?: string }[];
  sync?: {
    branch?: string;
    remote?: string;
    storage?: 'git-common-dir-v1';
  };
  display?: {
    id_prefix?: string;
  };
  settings?: {
    auto_sync?: boolean;
    doc_auto_sync_hours?: number;
  };
  // Old format (f02 and earlier)
  docs?: {
    paths?: string[];
  };
  doc_cache?: Record<string, string>;
  // New format (f03+)
  docs_cache?: {
    files?: Record<string, string>;
    lookup_path?: string[];
  };
  /** External tracker integrations (f07+). Opaque here; ConfigSchema owns its shape. */
  integrations?: Record<string, unknown>;
  /** Unknown keys are carried through migration rather than dropped (f07+). */
  [key: string]: unknown;
}

/**
 * Result of a migration operation.
 */
export interface MigrationResult {
  /** The migrated config */
  config: RawConfig;
  /** Format version before migration */
  fromFormat: FormatVersion;
  /** Format version after migration */
  toFormat: FormatVersion;
  /** Whether any changes were made */
  changed: boolean;
  /** Description of changes made */
  changes: string[];
}

// =============================================================================
// Migration Functions
// =============================================================================

/**
 * Migrate from f01 to f02.
 * - Adds tbd_format field
 * - Adds doc_auto_sync_hours setting (default: 24)
 * - doc_cache will be populated separately during setup (requires file system access)
 */
function migrate_f01_to_f02(config: RawConfig): MigrationResult {
  const changes: string[] = [];
  const migrated = { ...config };

  // Add format version
  migrated.tbd_format = 'f02';
  changes.push('Added tbd_format: f02');

  // Ensure settings exists and add doc_auto_sync_hours
  migrated.settings ??= {};
  if (migrated.settings.doc_auto_sync_hours === undefined) {
    migrated.settings.doc_auto_sync_hours = 24;
    changes.push('Added settings.doc_auto_sync_hours: 24');
  }

  // Note: doc_cache is intentionally NOT added here.
  // It will be populated during setup when we have access to the file system
  // and can enumerate the bundled docs.

  return {
    config: migrated,
    fromFormat: 'f01',
    toFormat: 'f02',
    changed: changes.length > 0,
    changes,
  };
}

/**
 * Migrate from f02 to f03.
 * - Consolidates doc_cache: and docs: into docs_cache:
 * - Moves doc_cache: -> docs_cache.files:
 * - Moves docs.paths: -> docs_cache.lookup_path:
 * - Removes separate docs: and doc_cache: keys
 */
function migrate_f02_to_f03(config: RawConfig): MigrationResult {
  const changes: string[] = [];
  const migrated = { ...config };

  // Update format version
  migrated.tbd_format = 'f03';
  changes.push('Updated tbd_format: f03');

  // Initialize docs_cache if it doesn't exist
  migrated.docs_cache ??= {};

  // Migrate doc_cache -> docs_cache.files
  if (migrated.doc_cache && Object.keys(migrated.doc_cache).length > 0) {
    migrated.docs_cache.files = { ...migrated.doc_cache };
    changes.push('Moved doc_cache: -> docs_cache.files:');
    delete migrated.doc_cache;
  }

  // Migrate docs.paths -> docs_cache.lookup_path
  if (migrated.docs?.paths && migrated.docs.paths.length > 0) {
    migrated.docs_cache.lookup_path = [...migrated.docs.paths];
    changes.push('Moved docs.paths: -> docs_cache.lookup_path:');
  }

  // Remove old docs: key
  if (migrated.docs) {
    delete migrated.docs;
    changes.push('Removed docs: key');
  }

  return {
    config: migrated,
    fromFormat: 'f02',
    toFormat: 'f03',
    changed: changes.length > 0,
    changes,
  };
}

/**
 * Migrate from f03 to f04.
 * - Adds sync.storage marker for the Git common-dir shared worktree layout
 * - Bumps tbd_format so old clients fail before writing legacy worktrees
 */
function migrate_f03_to_f04(config: RawConfig): MigrationResult {
  const changes: string[] = [];
  const migrated = { ...config };

  migrated.tbd_format = 'f04';
  changes.push('Updated tbd_format: f04');

  migrated.sync = { ...migrated.sync, storage: 'git-common-dir-v1' };
  changes.push('Added sync.storage: git-common-dir-v1');

  return {
    config: migrated,
    fromFormat: 'f03',
    toFormat: 'f04',
    changed: changes.length > 0,
    changes,
  };
}

/**
 * Migrate from f04 to f05.
 * - Metadata-only stamp: the forkable-docs artifacts (.tbd/doc-forks/, docs/tbd/)
 *   are created lazily by `tbd docs fork`, not by migration.
 * - The bump gates older clients: they must not serve upstream copies of docs that
 *   this repo has forked and customized.
 */
function migrate_f04_to_f05(config: RawConfig): MigrationResult {
  const changes: string[] = [];
  const migrated = { ...config };

  migrated.tbd_format = 'f05';
  changes.push('Updated tbd_format: f05');

  return {
    config: migrated,
    fromFormat: 'f04',
    toFormat: 'f05',
    changed: changes.length > 0,
    changes,
  };
}

/**
 * Migrate from f05 to f06.
 * - Adds the config upgrade history (`tbd_upgrades`) and redefines `tbd_version` to mean
 *   "the version that last ran setup" (the value itself is advanced by the setup-time
 *   stamp, which knows the running version; this pure migration does not).
 * - Seeds the first history entry from the existing `tbd_version` (the install-time
 *   stamp), without a timestamp because the original install time is unknown. If the
 *   config has no `tbd_version`, the history starts empty and setup fills it in.
 */
function migrate_f05_to_f06(config: RawConfig): MigrationResult {
  const changes: string[] = [];
  const migrated = { ...config };

  migrated.tbd_format = 'f06';
  changes.push('Updated tbd_format: f06');

  if (migrated.tbd_upgrades === undefined) {
    migrated.tbd_upgrades = migrated.tbd_version ? [{ version: migrated.tbd_version }] : [];
    changes.push('Seeded tbd_upgrades history from tbd_version');
  }

  return {
    config: migrated,
    fromFormat: 'f05',
    toFormat: 'f06',
    changed: changes.length > 0,
    changes,
  };
}

/**
 * Migrate from f06 to f07.
 * - Metadata-only stamp: the `integrations` block is written by `tbd integration`
 *   setup, not by migration, so a repository with no tracker gains nothing but the
 *   new format ID.
 * - The bump is the point. `ConfigSchema` parses in Zod strip mode in every released
 *   client before 0.6.0, so such a client silently drops an `integrations` block the
 *   first time it rewrites config.yml (via `setup`, `config set`, or `import`). Those
 *   clients cannot be fixed retroactively; stamping f07 makes them fail closed with
 *   the upgrade message instead of quietly discarding tracker configuration.
 * - f07 clients preserve unknown top-level keys, so a later additive config block does
 *   not need its own bump.
 */
function migrate_f06_to_f07(config: RawConfig): MigrationResult {
  const changes: string[] = [];
  const migrated = { ...config };

  migrated.tbd_format = 'f07';
  changes.push('Updated tbd_format: f07');

  return {
    config: migrated,
    fromFormat: 'f06',
    toFormat: 'f07',
    changed: changes.length > 0,
    changes,
  };
}

/** Provider keys that move into a group by f08. Everything else is left untouched. */
const F08_PROVIDER_MOVES = {
  target: ['team_key', 'project', 'repo'],
  labels: { mirror_labels: 'mirror', create_labels: 'create' },
  identity: ['user_map'],
} as const;

/**
 * Value translations for keys whose type changed in f08.
 *
 * `mirror_labels` and `create_labels` were booleans; their replacements are enums, and
 * each boolean maps onto the mode that preserves its exact prior behavior. `true` for
 * mirroring always meant the `tbd:`-prefixed form, and `true` for creation always meant
 * "create whatever is asked for".
 */
const F08_LABEL_VALUE_TRANSLATIONS: Record<string, (value: unknown) => unknown> = {
  mirror: (value) => (typeof value === 'boolean' ? (value ? 'prefixed' : 'none') : value),
  create: (value) => (typeof value === 'boolean' ? (value ? 'all' : 'none') : value),
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Regroup one provider block from flat keys into concern groups.
 *
 * The block grew one flat key at a time and ended up mixing five concerns as siblings —
 * where the work goes, what is selected, how it is marked, who it maps to, and how the
 * operation runs. Grouping them means a future decision is a value inside an existing
 * group rather than another flat sibling, which is the thing that made this sprawl.
 *
 * Lossless and idempotent: a key already in its group is left alone, a key absent stays
 * absent (so defaults still come from the schema rather than being frozen into the file),
 * and any key this function does not know is carried through untouched.
 */
function regroupProviderBlock(
  provider: Record<string, unknown>,
  providerName: string,
  changes: string[],
): Record<string, unknown> {
  // Keys consumed by a move. Collected rather than deleted as we go, so the result is
  // built by filtering at the end — one pass, no mutation of the input, and no dynamic
  // delete.
  const consumed = new Set<string>();
  const added: Record<string, unknown> = {};

  const group = (
    groupKey: 'target' | 'identity',
    keys: readonly string[],
  ): Record<string, unknown> | undefined => {
    const existing = isPlainObject(provider[groupKey]) ? { ...provider[groupKey] } : {};
    for (const key of keys) {
      if (key in provider && !(key in existing)) {
        existing[key] = provider[key];
        consumed.add(key);
        changes.push(`Moved ${providerName}.${key} into ${providerName}.${groupKey}`);
      }
    }
    return Object.keys(existing).length > 0 ? existing : undefined;
  };

  const target = group('target', F08_PROVIDER_MOVES.target);
  if (target) {
    added.target = target;
  }

  const labels = isPlainObject(provider.labels) ? { ...provider.labels } : {};
  for (const [from, to] of Object.entries(F08_PROVIDER_MOVES.labels)) {
    if (from in provider && !(to in labels)) {
      // Translate the value, do not just move it. Both keys became enums in f08, so
      // copying the boolean across would produce a config that no longer parses — the
      // migration would appear to succeed and leave the repository broken.
      labels[to] = F08_LABEL_VALUE_TRANSLATIONS[to]?.(provider[from]) ?? provider[from];
      consumed.add(from);
      changes.push(`Moved ${providerName}.${from} into ${providerName}.labels.${to}`);
    }
  }
  if (Object.keys(labels).length > 0) {
    added.labels = labels;
  }

  const identity = group('identity', F08_PROVIDER_MOVES.identity);
  if (identity) {
    added.identity = identity;
  }

  // The `select` alias retires into `policy.outbound`, which is what the runtime
  // resolver already does with it. Only safe when there is no explicit policy to
  // contradict; otherwise leaving it is the honest move and resolution is unchanged.
  //
  // Resolved BEFORE max_nesting so that a config carrying `select` but no `policy` ends
  // up with both in the same place. The other order left max_nesting stranded at the top
  // level beside a policy that had just been created for it.
  let policy = provider.policy;
  if (isPlainObject(provider.select) && policy === undefined) {
    policy = { outbound: { ...provider.select } };
    consumed.add('select');
    changes.push(`Folded ${providerName}.select into ${providerName}.policy.outbound`);
  }

  // `max_nesting` is a selection concern, so it belongs beside the other outbound
  // selection settings where policy presets can carry it. With a preset name
  // (`policy: default`) or no policy at all it stays put: folding it into a preset would
  // silently redefine that preset for this repository, and the schema still reads the
  // flat key.
  if ('max_nesting' in provider && isPlainObject(policy)) {
    const outbound = isPlainObject(policy.outbound) ? { ...policy.outbound } : {};
    if (!('max_nesting' in outbound)) {
      outbound.max_nesting = provider.max_nesting;
      policy = { ...policy, outbound };
      consumed.add('max_nesting');
      changes.push(`Moved ${providerName}.max_nesting into ${providerName}.policy.outbound`);
    }
  }
  if (policy !== undefined) {
    added.policy = policy;
  }

  return {
    ...Object.fromEntries(Object.entries(provider).filter(([key]) => !consumed.has(key))),
    ...added,
  };
}

/**
 * Regroup every provider block in the integrations config. Returns undefined when
 * there is nothing to do, so the caller can leave the key absent entirely.
 */
function regroupIntegrationsBlock(
  integrations: unknown,
): { integrations: Record<string, unknown>; changes: string[] } | undefined {
  if (!isPlainObject(integrations)) {
    return undefined;
  }
  const changes: string[] = [];
  const next: Record<string, unknown> = { ...integrations };

  // The fold gate became an enum in f08. Translate the value, do not just rename the
  // key: carrying `false` into an enum field would write a config the next release
  // cannot parse. `true`/`false` map onto the two modes that preserve their behavior
  // exactly; the two new modes were unreachable before, so nothing legacy produces them.
  if (typeof next.sync_on_tbd_sync === 'boolean' && next.on_tbd_sync === undefined) {
    const mode = next.sync_on_tbd_sync ? 'auto' : 'off';
    delete next.sync_on_tbd_sync;
    next.on_tbd_sync = mode;
    changes.push(`integrations: sync_on_tbd_sync → on_tbd_sync: ${mode}`);
  }

  for (const [name, block] of Object.entries(next)) {
    if (!isPlainObject(block)) {
      continue; // on_tbd_sync and any other scalar gate stays put.
    }
    next[name] = regroupProviderBlock(block, name, changes);
  }
  return changes.length > 0 ? { integrations: next, changes } : undefined;
}

/**
 * Migrate from f07 to f08.
 *
 * - Metadata-only for beads. No issue file is rewritten, because the bump exists
 *   precisely to stop pre-f08 clients from touching them: those clients parse beads in
 *   Zod strip mode and delete any field they do not know. `tbd sync` rewrites beads
 *   during ordinary merges, so that is a data-loss path across every bead an old client
 *   sees — a wider blast radius than the f07 config case, where one file lost one block
 *   on an explicit command.
 * - The integrations block regroups in place. See {@link regroupIntegrationsBlock}; the
 *   transform is mechanical and lossless, and it rides this bump rather than earning its
 *   own because a repository should pay the format ceremony once.
 * - After f08 both the bead schema and the config preserve unknown keys, so a future
 *   additive field is either a value in an existing group or a new optional one, and
 *   neither needs a bump.
 */
function migrate_f07_to_f08(config: RawConfig): MigrationResult {
  const changes: string[] = [];
  const migrated = { ...config };

  const regrouped = regroupIntegrationsBlock(migrated.integrations);
  if (regrouped) {
    migrated.integrations = regrouped.integrations;
    changes.push(...regrouped.changes);
  }

  migrated.tbd_format = 'f08';
  changes.push('Updated tbd_format: f08');

  return {
    config: migrated,
    fromFormat: 'f07',
    toFormat: 'f08',
    changed: changes.length > 0,
    changes,
  };
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Compare two dotted numeric versions. Prerelease suffixes are ignored: a `-dev` build
 * of a version supports what that version supports.
 */
function compareVersions(a: string, b: string): number {
  const parts = (v: string) =>
    v
      .split('-')[0]!
      .split('.')
      .map((n) => Number.parseInt(n, 10) || 0);
  const [pa, pb] = [parts(a), parts(b)];
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) {
      return diff;
    }
  }
  return 0;
}

/**
 * The newest format a published tbd version can read, derived from the `introduced`
 * stamps in {@link FORMAT_HISTORY}.
 *
 * Used to check the launcher's registry fallback pin: an exact version that predates the
 * repository's format would install a CLI that refuses the repository. Returns undefined
 * for an unparseable version, so callers can skip the check rather than guess.
 */
export function supportedFormatForVersion(version: string): FormatVersion | undefined {
  if (!/^\d+\.\d+\.\d+/.test(version)) {
    return undefined;
  }
  let best: FormatVersion | undefined;
  for (const [format, entry] of Object.entries(FORMAT_HISTORY)) {
    if (compareVersions(version, entry.introduced) >= 0) {
      if (!best || format > best) {
        best = format as FormatVersion;
      }
    }
  }
  return best;
}

/**
 * Detect the format version of a config.
 * Returns INITIAL_FORMAT ('f01') if no tbd_format field is present.
 */
export function detectFormat(config: RawConfig): FormatVersion {
  const format = config.tbd_format;
  if (!format) {
    return INITIAL_FORMAT;
  }
  if (format in FORMAT_HISTORY) {
    return format as FormatVersion;
  }
  // Unknown format - treat as latest (will fail validation if incompatible)
  return CURRENT_FORMAT;
}

/**
 * Check if a config needs migration.
 */
export function needsMigration(config: RawConfig): boolean {
  const currentFormat = detectFormat(config);
  return currentFormat !== CURRENT_FORMAT;
}

/**
 * Migrate a config to the latest format version.
 *
 * This function applies all necessary migrations in sequence.
 * It does NOT populate doc_cache - that requires file system access
 * and should be done separately during setup.
 *
 * @param config - The raw config to migrate
 * @returns Migration result with the migrated config and change log
 */
export function migrateToLatest(config: RawConfig): MigrationResult {
  const fromFormat = detectFormat(config);

  if (fromFormat === CURRENT_FORMAT) {
    return {
      config,
      fromFormat,
      toFormat: CURRENT_FORMAT,
      changed: false,
      changes: [],
    };
  }

  let current = config;
  let currentFormat: FormatVersion = fromFormat;
  const allChanges: string[] = [];

  // Apply migrations in sequence
  if (currentFormat === 'f01') {
    const result = migrate_f01_to_f02(current);
    current = result.config;
    currentFormat = 'f02' as FormatVersion;
    allChanges.push(...result.changes);
  }

  if (currentFormat === 'f02') {
    const result = migrate_f02_to_f03(current);
    current = result.config;
    currentFormat = 'f03' as FormatVersion;
    allChanges.push(...result.changes);
  }

  if (currentFormat === 'f03') {
    const result = migrate_f03_to_f04(current);
    current = result.config;
    currentFormat = 'f04' as FormatVersion;
    allChanges.push(...result.changes);
  }

  if (currentFormat === 'f04') {
    const result = migrate_f04_to_f05(current);
    current = result.config;
    currentFormat = 'f05' as FormatVersion;
    allChanges.push(...result.changes);
  }

  if (currentFormat === 'f05') {
    const result = migrate_f05_to_f06(current);
    current = result.config;
    currentFormat = 'f06' as FormatVersion;
    allChanges.push(...result.changes);
  }

  if (currentFormat === 'f06') {
    const result = migrate_f06_to_f07(current);
    current = result.config;
    currentFormat = 'f07' as FormatVersion;
    allChanges.push(...result.changes);
  }

  if (currentFormat === 'f07') {
    const result = migrate_f07_to_f08(current);
    current = result.config;
    currentFormat = 'f08' as FormatVersion;
    allChanges.push(...result.changes);
  }

  return {
    config: current,
    fromFormat,
    toFormat: currentFormat,
    changed: allChanges.length > 0,
    changes: allChanges,
  };
}

/**
 * Check if a format version is compatible with the current tbd version.
 * Future format versions are considered incompatible (would need tbd upgrade).
 */
export function isCompatibleFormat(format: string): boolean {
  return isFormatCompatibleWithSupported(format, CURRENT_FORMAT);
}

/**
 * Check whether a format version is compatible with a tbd client that supports
 * versions up to supportedFormat. This makes the old-client contract testable:
 * an f03 client must reject an f04 repository instead of writing legacy data.
 */
export function isFormatCompatibleWithSupported(
  format: string,
  supportedFormat: FormatVersion,
): boolean {
  const formatVersions = Object.keys(FORMAT_HISTORY);
  const currentIndex = formatVersions.indexOf(supportedFormat);
  const checkIndex = formatVersions.indexOf(format);

  if (checkIndex === -1) {
    // Unknown format - might be from a newer tbd version
    return false;
  }

  // Compatible if same or older format (we can migrate up)
  return checkIndex <= currentIndex;
}

/**
 * Build the standard message shown when a repository has a format newer than
 * this tbd client supports.
 */
export function formatUpgradeMessage(
  subject: string,
  foundFormat: string,
  supportedFormat: string,
): string {
  return (
    `This repository requires a newer version of tbd.\n` +
    `${subject} format '${foundFormat}' is from a newer tbd version.\n` +
    `This tbd version supports up to format '${supportedFormat}'.\n` +
    `Upgrade tbd: npm install -g get-tbd@latest`
  );
}

/**
 * Get a human-readable description of what migrations will be applied.
 */
export function describeMigration(fromFormat: FormatVersion): string[] {
  const descriptions: string[] = [];
  let current = fromFormat;

  if (current === 'f01') {
    descriptions.push('f01 → f02: Add doc_cache configuration support');
    current = 'f02';
  }

  if (current === 'f02') {
    descriptions.push('f02 → f03: Consolidate doc_cache and docs into docs_cache');
    current = 'f03';
  }

  if (current === 'f03') {
    descriptions.push('f03 → f04: Move local sync worktree to Git common directory');
    current = 'f04';
  }

  if (current === 'f04') {
    descriptions.push('f04 → f05: Add forkable-docs layout (stamp only)');
    current = 'f05';
  }

  if (current === 'f05') {
    descriptions.push('f05 → f06: Add config upgrade history (tbd_upgrades)');
    current = 'f06';
  }

  if (current === 'f06') {
    descriptions.push('f06 → f07: Add external tracker integrations config (stamp only)');
    current = 'f07';
  }

  if (current === 'f07') {
    descriptions.push(
      'f07 → f08: Preserve unknown bead keys; add docs/refs; regroup the integrations config',
    );
    current = 'f08';
  }

  return descriptions;
}
