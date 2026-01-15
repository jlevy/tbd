/**
 * ID generation and validation utilities.
 *
 * The system uses dual IDs for usability:
 * - Internal ID: is-[6 hex chars] - stored in files, globally unique
 * - Short ID: [4 base36 chars] - human-friendly for CLI display/input
 *
 * For Beads compatibility, bd- prefix is accepted on input and converted to is-.
 *
 * See: tbd-design-v3.md §4.2 Dual ID System
 */

import { randomBytes } from 'node:crypto';

/**
 * Generate a unique internal ID.
 * Format: is-[6 hex chars] (24 bits of entropy)
 */
export function generateInternalId(): string {
  const bytes = randomBytes(3); // 3 bytes = 24 bits = 6 hex chars
  return `is-${bytes.toString('hex')}`;
}

/**
 * Generate a short ID for display.
 * Format: [4 base36 chars] (about 21 bits of entropy)
 */
export function generateShortId(): string {
  // Generate 4 random base36 characters
  const chars = '0123456789abcdefghijklmnopqrstuvwxyz';
  let result = '';
  const bytes = randomBytes(4);
  for (let i = 0; i < 4; i++) {
    result += chars[bytes[i]! % 36];
  }
  return result;
}

/**
 * Validate an issue ID matches the canonical format.
 */
export function validateIssueId(id: string): boolean {
  return /^is-[a-f0-9]{6}$/.test(id);
}

/**
 * Normalize an issue ID to canonical format.
 *
 * Handles:
 * - Missing prefix (adds is-)
 * - bd- prefix (converts to is-)
 * - Uppercase (converts to lowercase)
 * - Short IDs (pads with zeros)
 */
export function normalizeIssueId(input: string): string {
  let id = input.toLowerCase();

  // Remove prefix if present
  if (id.startsWith('is-') || id.startsWith('bd-')) {
    id = id.slice(3);
  }

  // Pad to 6 characters if needed
  if (id.length < 6) {
    id = id.padStart(6, '0');
  }

  return `is-${id}`;
}
