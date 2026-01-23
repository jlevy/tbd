/**
 * Prefix auto-detection module.
 *
 * Provides functions to auto-detect a suitable project prefix for tbd
 * from various sources: beads config, git remote URL, or directory name.
 *
 * See: tbd-design.md and plan-2026-01-20-streamlined-init-setup-design.md
 */

import { readFile } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { parse as parseYaml } from 'yaml';

/** Maximum length for a valid prefix */
const MAX_PREFIX_LENGTH = 10;

/** Minimum length for a valid prefix */
const MIN_PREFIX_LENGTH = 1;

/**
 * Normalize a prefix string.
 * - Lowercases
 * - Removes invalid characters (keeps only alphanumeric)
 * - Truncates to max length
 */
export function normalizePrefix(s: string): string {
  if (!s) return '';

  // Lowercase and remove non-alphanumeric characters
  const normalized = s.toLowerCase().replace(/[^a-z0-9]/g, '');

  // Truncate to max length
  return normalized.slice(0, MAX_PREFIX_LENGTH);
}

/**
 * Check if a prefix is valid.
 * - Must be 1-10 characters
 * - Must start with a letter
 * - Must be alphanumeric only (lowercase)
 */
export function isValidPrefix(s: string): boolean {
  if (!s) return false;
  if (s.length < MIN_PREFIX_LENGTH || s.length > MAX_PREFIX_LENGTH) return false;

  // Must match: starts with letter, followed by alphanumeric (lowercase)
  return /^[a-z][a-z0-9]*$/.test(s);
}

/**
 * Extract repository name from a git remote URL.
 * Handles HTTPS, SSH, and various git hosting formats.
 *
 * Examples:
 * - https://github.com/jlevy/tbd.git → "tbd"
 * - git@github.com:jlevy/my-app.git → "myapp"
 * - https://gitlab.com/user/project.git → "project"
 *
 * @returns Normalized repository name, or null if extraction fails
 */
export function extractRepoNameFromRemote(url: string): string | null {
  if (!url) return null;

  try {
    let repoName: string | null = null;

    // Handle SSH format: git@host:path/repo.git
    if (url.includes('@') && url.includes(':') && !url.includes('://')) {
      const colonIndex = url.indexOf(':');
      const path = url.slice(colonIndex + 1);
      repoName = extractRepoNameFromPath(path);
    } else {
      // Handle HTTPS format: https://host/path/repo.git
      try {
        const parsed = new URL(url);
        repoName = extractRepoNameFromPath(parsed.pathname);
      } catch {
        // Not a valid URL
        return null;
      }
    }

    if (!repoName) return null;

    // Normalize the repo name
    const normalized = normalizePrefix(repoName);
    return normalized || null;
  } catch {
    return null;
  }
}

/**
 * Extract repo name from a path like "jlevy/tbd.git" or "org/mono/packages/app.git"
 */
function extractRepoNameFromPath(path: string): string | null {
  if (!path) return null;

  // Remove leading slash and .git suffix
  const cleaned = path.replace(/^\//, '').replace(/\.git$/, '');

  // Get the last path component (handles monorepos with nested paths)
  const parts = cleaned.split('/').filter(Boolean);
  if (parts.length === 0) return null;

  return parts[parts.length - 1] ?? null;
}

/**
 * Get prefix from existing beads config.
 *
 * Looks for .beads/config.yaml and extracts display.id_prefix
 *
 * @param cwd Current working directory
 * @returns The beads prefix, or null if not found
 */
export async function getBeadsPrefix(cwd: string): Promise<string | null> {
  try {
    const configPath = join(cwd, '.beads', 'config.yaml');
    const content = await readFile(configPath, 'utf-8');
    const config = parseYaml(content) as Record<string, unknown>;

    const display = config?.display as Record<string, unknown> | undefined;
    const prefix = display?.id_prefix;

    if (typeof prefix === 'string' && isValidPrefix(prefix)) {
      return prefix;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Get git remote URL from the repository.
 *
 * @param cwd Current working directory
 * @returns The remote URL, or null if not found
 */
export async function getGitRemoteUrl(cwd: string): Promise<string | null> {
  try {
    const { execSync } = await import('node:child_process');
    const result = execSync('git remote get-url origin', {
      cwd,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    return result || null;
  } catch {
    return null;
  }
}

/**
 * Auto-detect the best prefix for this project.
 *
 * Priority order:
 * 1. Existing beads config (if migrating)
 * 2. Git remote URL (extract repo name)
 * 3. Directory name (fallback)
 *
 * @param cwd Current working directory
 * @returns The detected prefix (normalized)
 */
export async function autoDetectPrefix(cwd: string): Promise<string> {
  // 1. Try beads prefix first
  const beadsPrefix = await getBeadsPrefix(cwd);
  if (beadsPrefix) {
    return beadsPrefix;
  }

  // 2. Try git remote URL
  const remoteUrl = await getGitRemoteUrl(cwd);
  if (remoteUrl) {
    const repoName = extractRepoNameFromRemote(remoteUrl);
    if (repoName && isValidPrefix(repoName)) {
      return repoName;
    }
  }

  // 3. Fall back to directory name
  const dirName = basename(cwd);
  const normalized = normalizePrefix(dirName);

  // Ensure we have a valid prefix
  if (normalized && isValidPrefix(normalized)) {
    return normalized;
  }

  // Last resort: if directory name is invalid, use a default
  // This handles edge cases like "/" or numeric-only directory names
  if (normalized) {
    // Try to make it valid by prepending 'p' if it starts with a number
    if (/^[0-9]/.test(normalized)) {
      const withP = 'p' + normalized.slice(0, MAX_PREFIX_LENGTH - 1);
      if (isValidPrefix(withP)) {
        return withP;
      }
    }
  }

  // Absolute fallback
  return 'proj';
}
