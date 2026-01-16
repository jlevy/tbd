/**
 * ID generation and validation utilities.
 *
 * The system uses dual IDs for usability:
 * - Internal ID: is-{ulid} - ULID-based (26 lowercase chars), stored in files
 * - External ID: {prefix}-{short} - 4-5 base36 chars for CLI display/input
 *
 * For Beads compatibility, bd- prefix is accepted on input for external IDs.
 *
 * See: tbd-design-v3.md §2.5 ID Generation
 */

import { ulid } from 'ulid';
import { randomBytes } from 'node:crypto';

/**
 * Generate a unique internal ID using ULID.
 * Format: is-{ulid} (26 lowercase alphanumeric chars)
 * Example: is-01hx5zzkbkactav9wevgemmvrz
 *
 * ULID provides:
 * - Time-ordered sorting (48-bit timestamp)
 * - 80-bit randomness (no collisions)
 * - Lexicographic sort = chronological order
 */
export function generateInternalId(): string {
  return `is-${ulid().toLowerCase()}`;
}

/**
 * Generate a short ID for external display.
 * Format: 4 base36 characters (a-z, 0-9)
 * Example: a7k2
 *
 * This provides ~1.7 million possibilities, sufficient for most projects.
 */
export function generateShortId(): string {
  const chars = '0123456789abcdefghijklmnopqrstuvwxyz';
  let result = '';
  const bytes = randomBytes(4);
  for (let i = 0; i < 4; i++) {
    result += chars[bytes[i]! % 36];
  }
  return result;
}

/**
 * Validate an internal issue ID matches the ULID format.
 * Format: is-{26 lowercase alphanumeric chars}
 */
export function validateIssueId(id: string): boolean {
  return /^is-[0-9a-z]{26}$/.test(id);
}

/**
 * Validate a short/external ID format.
 * Format: 4-5 base36 characters
 */
export function validateShortId(id: string): boolean {
  return /^[0-9a-z]{4,5}$/.test(id);
}

/**
 * Check if an input looks like an internal ID (ULID-based).
 */
export function isInternalId(input: string): boolean {
  const lower = input.toLowerCase();
  // Check if it starts with is- and has 26+ chars after
  if (lower.startsWith('is-') && lower.length === 29) {
    return /^is-[0-9a-z]{26}$/.test(lower);
  }
  return false;
}

/**
 * Check if an input looks like a short/external ID.
 */
export function isShortId(input: string): boolean {
  const lower = input.toLowerCase();
  // Strip prefix if present
  const stripped = lower.replace(/^[a-z]+-/, '');
  return /^[0-9a-z]{4,5}$/.test(stripped);
}

/**
 * Normalize an internal issue ID.
 *
 * This function expects a full internal ID (is-{ulid}).
 * If given a short ID, it won't be able to resolve it without
 * access to the ID mapping.
 *
 * Handles:
 * - Uppercase (converts to lowercase)
 * - Ensures is- prefix
 */
export function normalizeIssueId(input: string): string {
  const lower = input.toLowerCase();

  // If already a valid internal ID, return as-is
  if (validateIssueId(lower)) {
    return lower;
  }

  // If it starts with is- but wrong length, might be corrupted
  if (lower.startsWith('is-')) {
    return lower; // Return as-is, let validation fail later
  }

  // If it starts with bd- (Beads compat), convert prefix
  if (lower.startsWith('bd-')) {
    const rest = lower.slice(3);
    if (rest.length === 26) {
      return `is-${rest}`;
    }
    // Short ID - can't resolve without mapping
    return lower;
  }

  // Bare ID without prefix
  if (lower.length === 26 && /^[0-9a-z]{26}$/.test(lower)) {
    return `is-${lower}`;
  }

  // Can't normalize - return as-is
  return lower;
}

/**
 * Format an internal ID for display with the configured prefix.
 * Note: This requires access to the short ID mapping.
 * For now, returns the internal ID with bd- prefix for compatibility.
 */
export function formatDisplayId(internalId: string, prefix = 'bd'): string {
  // Extract the ULID portion
  const ulidPart = internalId.replace(/^is-/, '');
  // For display, we'd normally use the short ID mapping
  // For now, truncate to show a readable portion
  return `${prefix}-${ulidPart.slice(0, 6)}`;
}
