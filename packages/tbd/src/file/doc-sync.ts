/**
 * DocSync - Sync documentation files from configured sources.
 *
 * Syncs docs from internal bundled sources and external URLs to .tbd/docs/.
 *
 * See: docs/project/specs/active/plan-2026-01-26-configurable-doc-cache-sync.md
 */

import { readdir, readFile, rm, mkdir, access } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { writeFile } from 'atomically';
import { fileURLToPath } from 'node:url';

import { TBD_DOCS_DIR } from '../lib/paths.js';
import { fetchWithGhFallback, gitDocRefToRawUrl } from './github-fetch.js';
import { tryParseDocRef } from '../docref/index.js';
import { readConfig, writeConfig, updateLocalState } from './config.js';

// =============================================================================
// Types
// =============================================================================

/**
 * A parsed document source.
 */
export interface DocSource {
  /** Source type: internal bundled, in-repo local file, or external URL */
  type: 'internal' | 'local' | 'url';
  /** The source location - a relative path or full URL */
  location: string;
}

/** One group of config entries sharing a source root (git repo+ref, etc.). */
export interface SourceGroup {
  /** Group key: 'internal', 'local', a git 'host:owner/repo@ref', or a URL origin. */
  key: string;
  /** Parsed git source shared by the group, when it is a git group. */
  gitSource?: { host: 'github' | 'gitlab'; owner: string; repo: string; ref?: string };
  /** [destPath, sourceStr] config entries in the group. */
  entries: [string, string][];
}

/**
 * Group docs_cache.files entries by source root: one group per git repo+ref
 * (so failures isolate per source and revisions are captured once), with
 * internal, local, and ad-hoc URL entries in origin-keyed groups.
 */
export function groupSourceEntries(config: Record<string, string>): SourceGroup[] {
  const groups = new Map<string, SourceGroup>();
  for (const [destPath, sourceStr] of Object.entries(config)) {
    let key = 'url';
    let gitSource: SourceGroup['gitSource'];
    if (sourceStr.startsWith('internal:')) {
      key = 'internal';
    } else {
      const parsed = tryParseDocRef(sourceStr);
      if (parsed?.kind === 'git') {
        key = `${parsed.host}:${parsed.owner}/${parsed.repo}@${parsed.ref ?? 'main'}`;
        gitSource = {
          host: parsed.host,
          owner: parsed.owner,
          repo: parsed.repo,
          ref: parsed.ref,
        };
      } else if (parsed?.kind === 'local') {
        key = 'local';
      } else {
        try {
          key = new URL(sourceStr).origin;
        } catch {
          key = 'url';
        }
      }
    }
    let group = groups.get(key);
    if (!group) {
      group = { key, gitSource, entries: [] };
      groups.set(key, group);
    }
    group.entries.push([destPath, sourceStr]);
  }
  return [...groups.values()];
}

/**
 * Capture the current revision of a git source's ref (one ls-remote per
 * group), for provenance. Best-effort: offline or missing git returns null.
 */
async function captureGitRevision(
  src: NonNullable<SourceGroup['gitSource']>,
): Promise<string | null> {
  const repoUrl =
    src.host === 'gitlab'
      ? `https://gitlab.com/${src.owner}/${src.repo}.git`
      : `https://github.com/${src.owner}/${src.repo}.git`;
  try {
    const { execFile } = await import('node:child_process');
    const { promisify } = await import('node:util');
    const out = await promisify(execFile)('git', ['ls-remote', repoUrl, src.ref ?? 'HEAD'], {
      timeout: 10_000,
    });
    const sha = out.stdout.split('\t')[0]?.trim();
    return sha && /^[0-9a-f]{40}$/.test(sha) ? sha : null;
  } catch {
    return null;
  }
}

/**
 * Result of a sync operation.
 */
export interface SyncResult {
  /** Captured git revisions per source group key (provenance; best-effort). */
  sourceRevisions: Record<string, string>;
  /** Paths of newly downloaded/copied docs */
  added: string[];
  /** Paths of updated docs (content changed) */
  updated: string[];
  /** Paths of removed docs (no longer in config) */
  removed: string[];
  /** Errors encountered during sync */
  errors: { path: string; error: string }[];
  /** Whether the sync was successful overall */
  success: boolean;
}

/**
 * Options for doc sync operations.
 */
export interface DocSyncOptions {
  /** If true, don't actually write/delete files (dry run) */
  dryRun?: boolean;
  /** If true, suppress normal output (only report errors) */
  silent?: boolean;
}

// =============================================================================
// Constants
// =============================================================================

/** Prefix for internal bundled doc sources */
const INTERNAL_SOURCE_PREFIX = 'internal:';

// =============================================================================
// DocSync Class
// =============================================================================

/**
 * Syncs documentation files from configured sources.
 *
 * Supports:
 * - Internal bundled docs (using internal: prefix)
 * - External URLs (raw.githubusercontent.com, etc.)
 */
export class DocSync {
  private readonly docsDir: string;

  /**
   * Create a new DocSync instance.
   *
   * @param tbdRoot - The tbd project root directory (parent of .tbd/)
   * @param config - The doc_cache configuration mapping dest paths to sources
   */
  constructor(
    private readonly tbdRoot: string,
    private readonly config: Record<string, string>,
  ) {
    this.docsDir = join(tbdRoot, TBD_DOCS_DIR);
  }

  /**
   * Parse a source string into a DocSource.
   *
   * @example
   * parseSource('internal:shortcuts/standard/code-review-and-commit.md')
   * // => { type: 'internal', location: 'shortcuts/standard/code-review-and-commit.md' }
   *
   * @example
   * parseSource('https://raw.githubusercontent.com/org/repo/main/file.md')
   * // => { type: 'url', location: 'https://...' }
   */
  parseSource(source: string): DocSource {
    if (source.startsWith(INTERNAL_SOURCE_PREFIX)) {
      return {
        type: 'internal',
        location: source.slice(INTERNAL_SOURCE_PREFIX.length),
      };
    }

    // Git docrefs (github:o/r@ref//path, gitlab:...) fetch via the host's
    // raw-content endpoint; the canonical docref is what config stores.
    const parsed = tryParseDocRef(source);
    if (parsed?.kind === 'git') {
      return { type: 'url', location: gitDocRefToRawUrl(parsed) };
    }
    if (parsed?.kind === 'local') {
      return { type: 'local', location: parsed.path };
    }

    // Anything else is treated as a URL
    return {
      type: 'url',
      location: source,
    };
  }

  /**
   * Fetch content from a source.
   *
   * @throws If the source cannot be fetched
   */
  async fetchContent(source: DocSource): Promise<string> {
    if (source.type === 'internal') {
      return this.fetchInternalContent(source.location);
    }
    if (source.type === 'local') {
      // Local docref: read from the repo, relative to the tbd root.
      return await readFile(join(this.tbdRoot, source.location), 'utf-8');
    }
    return this.fetchUrlContent(source.location);
  }

  /**
   * Fetch content from an internal bundled doc.
   */
  private async fetchInternalContent(location: string): Promise<string> {
    const basePaths = getDocsBasePath();

    for (const basePath of basePaths) {
      const fullPath = join(basePath, location);
      try {
        await access(fullPath);
        return await readFile(fullPath, 'utf-8');
      } catch {
        // Try next path
      }
    }

    throw new Error(`Internal doc not found: ${location}`);
  }

  /**
   * Fetch content from a URL (with gh CLI fallback on 403).
   */
  private async fetchUrlContent(url: string): Promise<string> {
    const { content } = await fetchWithGhFallback(url);
    return content;
  }

  /**
   * Get the current state of the docs directory.
   * Returns a set of relative paths that exist in .tbd/docs/.
   */
  async getCurrentState(): Promise<Set<string>> {
    const paths = new Set<string>();

    try {
      await access(this.docsDir);
    } catch {
      // Directory doesn't exist yet
      return paths;
    }

    await this.scanDirectory(this.docsDir, '', paths);
    return paths;
  }

  /**
   * Recursively scan a directory and add all .md file paths to the set.
   */
  private async scanDirectory(baseDir: string, prefix: string, paths: Set<string>): Promise<void> {
    try {
      const dirEntries = await readdir(baseDir, { withFileTypes: true });

      for (const entry of dirEntries) {
        const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;

        if (entry.isDirectory()) {
          await this.scanDirectory(join(baseDir, entry.name), relativePath, paths);
        } else if (entry.isFile() && entry.name.endsWith('.md')) {
          paths.add(relativePath);
        }
      }
    } catch {
      // Directory doesn't exist or not readable
    }
  }

  /**
   * Sync all docs from config to .tbd/docs/.
   *
   * - Downloads/copies new docs
   * - Updates docs whose source has changed
   * - Removes docs no longer in config
   *
   * @param options - Sync options (dryRun, silent)
   */
  async sync(options: DocSyncOptions = {}): Promise<SyncResult> {
    const result: SyncResult = {
      sourceRevisions: {},
      added: [],
      updated: [],
      removed: [],
      errors: [],
      success: true,
    };

    // Get current state
    const currentPaths = await this.getCurrentState();
    const configPaths = new Set(Object.keys(this.config));

    // Group entries by source root (one group per git repo+ref; internal,
    // local, and ad-hoc URLs each form their own group). Grouping gives
    // per-source failure isolation — one unreachable repo skips only its own
    // entries instead of timing out on each — and one revision capture per
    // git source for provenance.
    const groups = groupSourceEntries(this.config);
    const failedGroups = new Set<string>();
    for (const group of groups) {
      if (group.gitSource) {
        const revision = await captureGitRevision(group.gitSource);
        if (revision) {
          result.sourceRevisions[group.key] = revision;
        }
      }
    }

    // Process each doc in config (group order; failed groups short-circuit)
    for (const group of groups) {
      for (const [destPath, sourceStr] of group.entries) {
        if (failedGroups.has(group.key)) {
          result.errors.push({
            path: destPath,
            error: `skipped: source group ${group.key} unreachable`,
          });
          result.success = false;
          continue;
        }
        try {
          const source = this.parseSource(sourceStr);
          const content = await this.fetchContent(source);
          const fullPath = join(this.docsDir, destPath);

          // Check if file exists and compare content
          let exists = false;
          let existingContent = '';

          try {
            existingContent = await readFile(fullPath, 'utf-8');
            exists = true;
          } catch {
            // File doesn't exist
          }

          if (!exists) {
            // New file
            if (!options.dryRun) {
              await mkdir(dirname(fullPath), { recursive: true });
              await writeFile(fullPath, content);
            }
            result.added.push(destPath);
          } else if (existingContent !== content) {
            // Content changed
            if (!options.dryRun) {
              await writeFile(fullPath, content);
            }
            result.updated.push(destPath);
          }
          // else: unchanged, do nothing
        } catch (err) {
          const message = (err as Error).message;
          result.errors.push({ path: destPath, error: message });
          result.success = false;
          // Network-shaped failures poison the whole group: skip its remaining
          // entries rather than re-timing-out per file. Cached copies are never
          // pruned on fetch failure (removal below only applies to paths that
          // left the config).
          if (
            group.gitSource &&
            /fetch|network|ENOTFOUND|ETIMEDOUT|ECONNREFUSED|HTTP/i.test(message)
          ) {
            failedGroups.add(group.key);
          }
        }
      }
    }

    // Remove docs not in config
    for (const existingPath of currentPaths) {
      if (!configPaths.has(existingPath)) {
        try {
          if (!options.dryRun) {
            await rm(join(this.docsDir, existingPath));
          }
          result.removed.push(existingPath);
        } catch (err) {
          result.errors.push({
            path: existingPath,
            error: `Failed to remove: ${(err as Error).message}`,
          });
        }
      }
    }

    return result;
  }

  /**
   * Get a status of what would change without actually making changes.
   */
  async status(): Promise<SyncResult> {
    return this.sync({ dryRun: true });
  }
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get base docs paths (with fallbacks for development).
 * Matches the logic in setup.ts.
 */
function getDocsBasePath(): string[] {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  return [
    // Bundled location (dist/docs/)
    join(__dirname, 'docs'),
    // Development: packages/tbd/docs/
    join(__dirname, '..', '..', 'docs'),
  ];
}

/**
 * Generate default doc_cache config by scanning bundled docs.
 *
 * This creates a config entry for each .md file found in the bundled
 * docs directories (shortcuts, guidelines, templates).
 *
 * @returns A doc_cache config mapping destination paths to internal: sources
 */
export async function generateDefaultDocCacheConfig(): Promise<Record<string, string>> {
  const config: Record<string, string> = {};
  const basePaths = getDocsBasePath();

  // Find the first valid base path
  let docsDir: string | null = null;
  for (const path of basePaths) {
    try {
      await access(path);
      docsDir = path;
      break;
    } catch {
      // Try next path
    }
  }

  if (!docsDir) {
    return config;
  }

  // Directories to scan
  const scanDirs = [
    { subdir: 'shortcuts/system', prefix: 'shortcuts/system' },
    { subdir: 'shortcuts/standard', prefix: 'shortcuts/standard' },
    { subdir: 'guidelines', prefix: 'guidelines' },
    { subdir: 'templates', prefix: 'templates' },
    { subdir: 'references', prefix: 'references' },
  ];

  // Self-docs: bundled at the docs root, served as `reference` kind under
  // their existing tbd- names (the manual stays a real, forkable doc).
  config[`references/tbd-docs.md`] = `${INTERNAL_SOURCE_PREFIX}tbd-docs.md`;
  config[`references/tbd-design.md`] = `${INTERNAL_SOURCE_PREFIX}tbd-design.md`;

  for (const { subdir, prefix } of scanDirs) {
    const fullDir = join(docsDir, subdir);
    try {
      const entries = await readdir(fullDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isFile() && entry.name.endsWith('.md')) {
          const relativePath = `${prefix}/${entry.name}`;
          config[relativePath] = `${INTERNAL_SOURCE_PREFIX}${relativePath}`;
        }
      }
    } catch {
      // Directory doesn't exist, skip
    }
  }

  return config;
}

/**
 * Merge user's doc_cache config with default bundled docs.
 *
 * This ensures:
 * - New bundled docs from tbd updates are added to existing configs
 * - User's custom sources (URLs, etc.) are preserved
 * - User's overrides of bundled docs are respected
 *
 * @param userConfig - The user's existing doc_cache config (may be undefined/empty)
 * @param defaults - The default config from generateDefaultDocCacheConfig()
 * @returns Merged config with defaults as base, user config overlaid
 */
export function mergeDocCacheConfig(
  userConfig: Record<string, string> | undefined,
  defaults: Record<string, string>,
): Record<string, string> {
  // Start with defaults, overlay user config (user takes precedence)
  return {
    ...defaults,
    ...userConfig,
  };
}

/**
 * Check if docs are stale based on last sync time and configured hours.
 *
 * @param lastSyncAt - ISO timestamp of last sync (or undefined if never synced)
 * @param autoSyncHours - Hours between auto-syncs (0 = disabled)
 * @returns true if docs should be synced
 */
export function isDocsStale(lastSyncAt: string | undefined, autoSyncHours: number): boolean {
  // Auto-sync disabled
  if (autoSyncHours <= 0) {
    return false;
  }

  // Never synced
  if (!lastSyncAt) {
    return true;
  }

  const lastSync = new Date(lastSyncAt).getTime();
  const now = Date.now();
  const hoursSinceSync = (now - lastSync) / (1000 * 60 * 60);

  return hoursSinceSync >= autoSyncHours;
}

// =============================================================================
// Unified Doc Sync with Defaults
// =============================================================================

/**
 * Options for syncDocsWithDefaults.
 */
export interface SyncDocsOptions {
  /** If true, suppress output (for auto-sync) */
  quiet?: boolean;
  /** If true, don't write files or config (dry run for --status) */
  dryRun?: boolean;
}

/**
 * Result of syncDocsWithDefaults.
 */
export interface SyncDocsResult {
  /** Paths of newly downloaded/copied docs */
  added: string[];
  /** Paths of updated docs (content changed) */
  updated: string[];
  /** Paths of removed docs (no longer in config) */
  removed: string[];
  /** Entries removed due to missing internal sources */
  pruned: string[];
  /** Whether the config was modified (new defaults merged or stale pruned) */
  configChanged: boolean;
  /** Errors encountered during sync */
  errors: { path: string; error: string }[];
  /** Whether the sync was successful overall */
  success: boolean;
}

/**
 * Check if an internal bundled doc exists.
 *
 * @param location - The internal doc path (without 'internal:' prefix)
 * @returns true if the doc exists in any of the bundled doc paths
 */
export async function internalDocExists(location: string): Promise<boolean> {
  const basePaths = getDocsBasePath();

  for (const basePath of basePaths) {
    const fullPath = join(basePath, location);
    try {
      await access(fullPath);
      return true;
    } catch {
      // Try next path
    }
  }

  return false;
}

/**
 * Prune entries from config that point to non-existent internal sources.
 *
 * This handles the case where a bundled doc is removed in a tbd update -
 * the stale config entry is automatically cleaned up.
 *
 * @param config - The doc_cache config to prune
 * @returns Object with pruned config and list of removed entries
 */
export async function pruneStaleInternals(
  config: Record<string, string>,
): Promise<{ config: Record<string, string>; pruned: string[] }> {
  const result: Record<string, string> = {};
  const pruned: string[] = [];

  for (const [dest, source] of Object.entries(config)) {
    if (source.startsWith(INTERNAL_SOURCE_PREFIX)) {
      const location = source.slice(INTERNAL_SOURCE_PREFIX.length);
      const exists = await internalDocExists(location);
      if (!exists) {
        pruned.push(dest);
        continue; // Don't include in result
      }
    }
    result[dest] = source;
  }

  return { config: result, pruned };
}

/**
 * Deep equality check for config objects.
 */
function configsEqual(a: Record<string, string>, b: Record<string, string>): boolean {
  const keysA = Object.keys(a).sort();
  const keysB = Object.keys(b).sort();

  if (keysA.length !== keysB.length) {
    return false;
  }

  for (const key of keysA) {
    if (!Object.hasOwn(b, key) || a[key] !== b[key]) {
      return false;
    }
  }

  return true;
}

/**
 * Sync docs with merged defaults and auto-pruning.
 *
 * This is the single entry point for all doc sync operations that need
 * to pick up new bundled docs from tbd upgrades.
 *
 * Steps:
 * 1. Read current config
 * 2. Generate defaults from bundled docs
 * 3. Merge: defaults as base, user config overlays
 * 4. Prune entries with missing internal sources
 * 5. Sync files to .tbd/docs/
 * 6. Write config if changed
 * 7. Update last_doc_sync_at in state
 *
 * @param tbdRoot - The tbd project root directory
 * @param options - Sync options (quiet, dryRun)
 * @returns Sync result with added/updated/removed/pruned counts
 */
export async function syncDocsWithDefaults(
  tbdRoot: string,
  options: SyncDocsOptions = {},
): Promise<SyncDocsResult> {
  // 1. Read current config
  const config = await readConfig(tbdRoot);
  const originalFiles = config.docs_cache?.files ?? {};

  // 2. Generate defaults from bundled docs
  const defaults = await generateDefaultDocCacheConfig();

  // 3. Merge: defaults as base, user config overlays
  const merged = mergeDocCacheConfig(originalFiles, defaults);

  // 4. Prune entries with missing internal sources
  const { config: prunedConfig, pruned } = await pruneStaleInternals(merged);

  // 5. Sync files to .tbd/docs/
  const docSync = new DocSync(tbdRoot, prunedConfig);
  const syncResult = await docSync.sync({ dryRun: options.dryRun });

  // 6. Check if config changed
  const configChanged = !configsEqual(prunedConfig, originalFiles);

  // 7. Write config if changed (and not dry run)
  if (configChanged && !options.dryRun) {
    // Preserve existing lookup_path or use default
    const lookupPath = config.docs_cache?.lookup_path ?? [
      '.tbd/docs/shortcuts/system',
      '.tbd/docs/shortcuts/standard',
    ];
    config.docs_cache = {
      // Preserve sibling keys (local_dirs etc.) — the cache refresh owns only
      // files and lookup_path, never the rest of the docs_cache section.
      ...config.docs_cache,
      lookup_path: lookupPath,
      files: prunedConfig,
    };
    await writeConfig(tbdRoot, config);
  }

  // 8. Update state (and not dry run)
  if (!options.dryRun) {
    await updateLocalState(tbdRoot, {
      last_doc_sync_at: new Date().toISOString(),
    });
  }

  return {
    added: syncResult.added,
    updated: syncResult.updated,
    removed: syncResult.removed,
    pruned,
    configChanged,
    errors: syncResult.errors,
    success: syncResult.success,
  };
}
