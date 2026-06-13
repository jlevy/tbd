/**
 * Config file operations.
 *
 * Config is stored at .tbd/config.yml and contains project-level settings.
 *
 * ⚠️ FORMAT VERSIONING: See tbd-format.ts for version history and migration rules.
 *
 * See: tbd-design.md §2.2.2 Config File
 */

import { readFile, mkdir, access } from 'node:fs/promises';
import { join, dirname, parse as parsePath } from 'node:path';
import { writeFile } from 'atomically';
import { parse as parseYaml } from 'yaml';

import { sortKeys, stringifyYaml } from '../utils/yaml-utils.js';
import { now } from '../utils/time-utils.js';
import type { Config, LocalState } from '../lib/types.js';
import {
  ConfigSchema,
  LocalStateSchema,
  CONFIG_FIELD_ORDER,
  LOCAL_STATE_FIELD_ORDER,
} from '../lib/schemas.js';
import { CONFIG_FILE, STATE_FILE, SYNC_BRANCH } from '../lib/paths.js';
import {
  CURRENT_FORMAT,
  formatUpgradeMessage,
  needsMigration,
  migrateToLatest,
  isCompatibleFormat,
  type RawConfig,
} from '../lib/tbd-format.js';

/**
 * Error thrown when the config format version is from a newer tbd version.
 * This prevents older tbd versions from silently stripping new config fields.
 */
export class IncompatibleFormatError extends Error {
  constructor(
    public readonly foundFormat: string,
    public readonly supportedFormat: string,
  ) {
    super(formatUpgradeMessage('Config', foundFormat, supportedFormat));
    this.name = 'IncompatibleFormatError';
  }
}

/**
 * Check if config format is compatible, throw if not.
 * This prevents older tbd versions from silently stripping fields added by newer versions.
 */
function checkFormatCompatibility(data: RawConfig): void {
  const format = data.tbd_format;
  if (format && !isCompatibleFormat(format)) {
    throw new IncompatibleFormatError(format, CURRENT_FORMAT);
  }
}

/**
 * Create default config for a new project.
 * @param prefix - Required: the project prefix for display IDs (e.g., "proj", "myapp")
 */
function createDefaultConfig(version: string, prefix: string): Config {
  return ConfigSchema.parse({
    tbd_format: CURRENT_FORMAT,
    tbd_version: version,
    // Seed the upgrade history with the version that created this repo.
    tbd_upgrades: [{ version, at: now() }],
    sync: {
      branch: SYNC_BRANCH,
      remote: 'origin',
      storage: 'git-common-dir-v1',
    },
    display: {
      id_prefix: prefix,
    },
    settings: {
      auto_sync: false,
      doc_auto_sync_hours: 24,
    },
  });
}

/**
 * Initialize a new config file with default settings.
 * Creates .tbd directory if it doesn't exist.
 * @param prefix - Required: the project prefix for display IDs (e.g., "proj", "myapp")
 */
export async function initConfig(
  baseDir: string,
  version: string,
  prefix: string,
): Promise<Config> {
  const tbdDir = join(baseDir, '.tbd');
  await mkdir(tbdDir, { recursive: true });

  const config = createDefaultConfig(version, prefix);
  await writeConfig(baseDir, config);

  return config;
}

/**
 * Stamp the config with the version that is running `tbd setup`.
 *
 * Sets `tbd_version` to the running version and, when that version differs from the most
 * recent `tbd_upgrades` entry, appends a new `{ version, at }` entry. Deduping by the
 * last entry keeps no-op re-runs and identical dev rebuilds from spamming the history.
 *
 * Pure: returns the SAME object when nothing changed (so callers can skip the write via
 * an identity check), or a new config otherwise. The caller persists the result.
 */
export function stampSetupVersion(config: Config, version: string, at: string = now()): Config {
  const upgrades = config.tbd_upgrades ?? [];
  const last = upgrades[upgrades.length - 1];

  if (last?.version === version) {
    // This version already heads the history; only ensure tbd_version reflects it.
    return config.tbd_version === version ? config : { ...config, tbd_version: version };
  }

  return {
    ...config,
    tbd_version: version,
    tbd_upgrades: [...upgrades, { version, at }],
  };
}

/**
 * Read config from file with automatic migration if needed.
 *
 * ⚠️ FORMAT VERSIONING: See tbd-format.ts for version history and migration rules.
 *
 * @throws {IncompatibleFormatError} If config is from a newer tbd version.
 * @throws If config file doesn't exist or is invalid.
 */
export async function readConfig(baseDir: string): Promise<Config> {
  const configPath = join(baseDir, CONFIG_FILE);
  const content = await readFile(configPath, 'utf-8');
  const data = parseYaml(content) as RawConfig;

  // Check for incompatible (future) format versions first
  checkFormatCompatibility(data);

  // Check if migration is needed (for older formats)
  if (needsMigration(data)) {
    const result = migrateToLatest(data);
    // Note: We don't automatically write the migrated config here.
    // Migration writes should be explicit via writeConfig() after setup.
    return ConfigSchema.parse(result.config);
  }

  return ConfigSchema.parse(data);
}

/**
 * Read config from file, returning migration info if a migration was applied.
 * Use this when you need to know if the config was migrated.
 *
 * @throws {IncompatibleFormatError} If config is from a newer tbd version.
 */
export async function readConfigWithMigration(baseDir: string): Promise<{
  config: Config;
  migrated: boolean;
  changes: string[];
  /**
   * The `tbd_format` value found in the file before migration. Useful for showing
   * the user what was upgraded (e.g., "f03 → f04"). `undefined` for very old
   * configs that have no `tbd_format` field.
   */
  fromFormat: string | undefined;
}> {
  const configPath = join(baseDir, CONFIG_FILE);
  const content = await readFile(configPath, 'utf-8');
  const data = parseYaml(content) as RawConfig;

  // Check for incompatible (future) format versions first
  checkFormatCompatibility(data);

  const fromFormat = data.tbd_format;

  if (needsMigration(data)) {
    const result = migrateToLatest(data);
    return {
      config: ConfigSchema.parse(result.config),
      migrated: result.changed,
      changes: result.changes,
      fromFormat,
    };
  }

  return {
    config: ConfigSchema.parse(data),
    migrated: false,
    changes: [],
    fromFormat,
  };
}

/**
 * Write config to file with explanatory comments.
 */
export async function writeConfig(baseDir: string, config: Config): Promise<void> {
  const configPath = join(baseDir, CONFIG_FILE);

  // Sort keys using canonical field order, then serialize with compact output.
  // sortMapEntries: false preserves our manual ordering.
  const sorted = sortKeys(config as unknown as Record<string, unknown>, CONFIG_FIELD_ORDER);
  const yaml = stringifyYaml(sorted, { lineWidth: 0, sortMapEntries: false });

  // Add explanatory comments by injecting them before each section's key. This is a
  // simple string replace, so the anchor keys (`tbd_upgrades:`, `docs_cache:`) must stay
  // literal. Comments are brief and point to the command that shows full details, since
  // an agent often reads this file directly.
  let content = yaml;

  if (config.tbd_upgrades && config.tbd_upgrades.length > 0) {
    const upgradesComment = `# tbd_upgrades: tbd versions that have run \`tbd setup\` in this repo (oldest first);
# tbd_version above is the most recent. Informational; updated automatically by setup.
`;
    content = content.replace('tbd_upgrades:', upgradesComment + 'tbd_upgrades:');
  }

  if (config.docs_cache && Object.keys(config.docs_cache).length > 0) {
    const docsCacheComment = `# Documentation cache: the docs tbd serves (guidelines, shortcuts, templates), synced
# into the gitignored .tbd/docs/ cache. Managed with \`tbd docs\` (run \`tbd docs --help\`).
# files: destination path (under .tbd/docs/) -> source docref. Common source forms:
#   - internal:<path>                          bundled with tbd (e.g. internal:guidelines/typescript-rules.md)
#   - github:owner/repo@ref//path/to/file.md   a file in a git repo (gitlab: too; @ref optional)
#   - https://host/path/file.md                a plain URL, kept verbatim
#   Full docref grammar: \`tbd docs show docref-format\`.
# lookup_path: doc lookup search order, like shell $PATH (earlier paths win).
# Refresh the cache with \`tbd docs sync\`; it also auto-syncs when stale
# (settings.doc_auto_sync_hours, default 24; 0 disables).
`;
    content = content.replace('docs_cache:', docsCacheComment + 'docs_cache:');
  }

  await writeFile(configPath, content);
}

/**
 * Check if tbd is properly initialized in the given directory.
 * Returns true only if .tbd/config.yml exists (not just a .tbd/ directory).
 *
 * This prevents spurious .tbd/ directories (e.g., containing only state.yml
 * created by a bug) from being mistaken for tbd roots. A valid tbd root
 * always has config.yml created during `tbd init`.
 */
async function hasTbdDir(dir: string): Promise<boolean> {
  const configPath = join(dir, CONFIG_FILE);
  try {
    await access(configPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Find the tbd repository root by walking up the directory tree.
 * Similar to how git finds .git/ directories.
 *
 * @param startDir - Directory to start searching from
 * @returns The tbd root directory path, or null if not found
 */
export async function findTbdRoot(startDir: string): Promise<string | null> {
  let currentDir = startDir;
  const { root } = parsePath(startDir);

  while (currentDir !== root) {
    if (await hasTbdDir(currentDir)) {
      return currentDir;
    }
    currentDir = dirname(currentDir);
  }

  // Check root directory as well
  if (await hasTbdDir(root)) {
    return root;
  }

  return null;
}

/**
 * Check if tbd is initialized in the given directory or any parent directory.
 * Walks up the directory tree looking for .tbd/.
 */
export async function isInitialized(baseDir: string): Promise<boolean> {
  const root = await findTbdRoot(baseDir);
  return root !== null;
}

// =============================================================================
// Local State Operations
// =============================================================================

/**
 * Read local state from .tbd/state.yml
 * Returns empty state if file doesn't exist.
 */
export async function readLocalState(baseDir: string): Promise<LocalState> {
  const statePath = join(baseDir, STATE_FILE);
  try {
    const content = await readFile(statePath, 'utf-8');
    const data: unknown = parseYaml(content);
    return LocalStateSchema.parse(data ?? {});
  } catch {
    // File doesn't exist or is invalid - return empty state
    return {};
  }
}

/**
 * Write local state to .tbd/state.yml
 *
 * Uses `atomically` for safe writes (atomic rename, auto parent-dir creation).
 * However, we intentionally guard against .tbd/ not existing: `atomically`
 * would auto-create it, which is wrong if baseDir is a subdirectory rather
 * than the true tbd root. Only `tbd init` (via initConfig) should create .tbd/.
 */
export async function writeLocalState(baseDir: string, state: LocalState): Promise<void> {
  // Guard: refuse to write if .tbd/ directory doesn't exist.
  // Without this, `atomically` would auto-create .tbd/ in subdirectories,
  // producing spurious directories that confuse findTbdRoot().
  const tbdDir = join(baseDir, '.tbd');
  try {
    await access(tbdDir);
  } catch {
    throw new Error(
      `Cannot write state: .tbd/ directory does not exist at ${baseDir}. ` +
        `Run 'tbd init' first or ensure the correct tbd root is being used.`,
    );
  }

  const statePath = join(baseDir, STATE_FILE);

  // Sort keys using canonical field order, then serialize with compact output.
  // sortMapEntries: false preserves our manual ordering.
  const sorted = sortKeys(state as unknown as Record<string, unknown>, LOCAL_STATE_FIELD_ORDER);
  const yaml = stringifyYaml(sorted, { lineWidth: 0, sortMapEntries: false });

  await writeFile(statePath, yaml);
}

/**
 * Update specific fields in local state (merge with existing).
 */
export async function updateLocalState(
  baseDir: string,
  updates: Partial<LocalState>,
): Promise<LocalState> {
  const current = await readLocalState(baseDir);
  const updated = { ...current, ...updates };
  await writeLocalState(baseDir, updated);
  return updated;
}

// =============================================================================
// Welcome State Operations
// =============================================================================

/**
 * Check if the user has seen the welcome message.
 */
export async function hasSeenWelcome(baseDir: string): Promise<boolean> {
  const state = await readLocalState(baseDir);
  return state.welcome_seen === true;
}

/**
 * Mark the welcome message as seen.
 */
export async function markWelcomeSeen(baseDir: string): Promise<void> {
  await updateLocalState(baseDir, { welcome_seen: true });
}
