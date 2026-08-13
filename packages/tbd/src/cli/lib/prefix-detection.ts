/**
 * Prefix validation and beads prefix extraction module.
 *
 * Provides functions to validate prefixes and extract prefix from beads config.
 * Used by setup commands to validate user-provided prefixes and migrate from beads.
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';

import { isValidDisplayPrefix } from '../../lib/display-id.js';

/** Maximum length for a valid prefix */
const MAX_PREFIX_LENGTH = 20;

/** Recommended minimum length */
const RECOMMENDED_MIN_LENGTH = 2;

/** Recommended maximum length */
const RECOMMENDED_MAX_LENGTH = 8;

/**
 * Normalize a prefix string.
 * - Lowercases
 * - Removes invalid characters (keeps alphanumeric, dot, underscore)
 * - Truncates to max length
 */
export function normalizePrefix(s: string): string {
  if (!s) {
    return '';
  }

  // Lowercase and remove invalid characters (keep alphanumeric, dot, underscore)
  const normalized = s.toLowerCase().replace(/[^a-z0-9._]/g, '');

  // Truncate to max length
  return normalized.slice(0, MAX_PREFIX_LENGTH);
}

/**
 * Check if a prefix is valid (hard rules, always enforced).
 * - Must be 1-20 characters
 * - Must start with a letter (a-z)
 * - Must end with alphanumeric (a-z0-9)
 * - Middle characters can be alphanumeric, dot, or underscore
 * - No dashes allowed (breaks ID syntax)
 */
export function isValidPrefix(s: string): boolean {
  return isValidDisplayPrefix(s);
}

/**
 * Check if a prefix follows recommended format (soft rules).
 * - Must be 2-8 characters
 * - Must be alphabetic only (a-z)
 *
 * Prefixes that don't match this can still be used with --force.
 */
export function isRecommendedPrefix(s: string): boolean {
  if (!s) {
    return false;
  }
  if (s.length < RECOMMENDED_MIN_LENGTH || s.length > RECOMMENDED_MAX_LENGTH) {
    return false;
  }
  return /^[a-z]+$/.test(s);
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
