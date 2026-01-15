/**
 * Tests for ID generation.
 *
 * The system uses dual IDs:
 * - Internal ID: ULID-based, globally unique (is-01hx5zzk...)
 * - Short ID: Base36, human-friendly for CLI (a7k2)
 */

import { describe, it, expect } from 'vitest';
import {
  generateInternalId,
  generateShortId,
  validateIssueId,
  normalizeIssueId,
} from '../src/lib/ids.js';
import { IssueId } from '../src/lib/schemas.js';

describe('generateInternalId', () => {
  it('generates valid issue ID format', () => {
    const id = generateInternalId();
    expect(id).toMatch(/^is-[a-f0-9]{6}$/);
    expect(IssueId.safeParse(id).success).toBe(true);
  });

  it('generates unique IDs', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      ids.add(generateInternalId());
    }
    expect(ids.size).toBe(100);
  });
});

describe('generateShortId', () => {
  it('generates base36 short ID', () => {
    const id = generateShortId();
    expect(id).toMatch(/^[a-z0-9]{4}$/);
  });

  it('generates unique IDs', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      ids.add(generateShortId());
    }
    // High probability of uniqueness (36^4 = 1.6M possibilities)
    expect(ids.size).toBe(100);
  });
});

describe('validateIssueId', () => {
  it('accepts valid full IDs', () => {
    expect(validateIssueId('is-a1b2c3')).toBe(true);
    expect(validateIssueId('is-000000')).toBe(true);
    expect(validateIssueId('is-ffffff')).toBe(true);
  });

  it('rejects invalid IDs', () => {
    expect(validateIssueId('is-abc')).toBe(false); // too short
    expect(validateIssueId('is-abcdefg')).toBe(false); // too long
    expect(validateIssueId('bd-a1b2c3')).toBe(false); // wrong prefix
    expect(validateIssueId('is-ABCDEF')).toBe(false); // uppercase
  });
});

describe('normalizeIssueId', () => {
  it('normalizes full ID to lowercase', () => {
    expect(normalizeIssueId('is-A1B2C3')).toBe('is-a1b2c3');
  });

  it('adds prefix if missing', () => {
    expect(normalizeIssueId('a1b2c3')).toBe('is-a1b2c3');
  });

  it('converts bd- prefix to is-', () => {
    expect(normalizeIssueId('bd-a1b2c3')).toBe('is-a1b2c3');
  });

  it('pads short IDs with zeros', () => {
    expect(normalizeIssueId('a1b2')).toBe('is-00a1b2');
    expect(normalizeIssueId('abc')).toBe('is-000abc');
  });

  it('handles mixed case input', () => {
    expect(normalizeIssueId('BD-A1B2C3')).toBe('is-a1b2c3');
    expect(normalizeIssueId('IS-A1B2C3')).toBe('is-a1b2c3');
  });
});
