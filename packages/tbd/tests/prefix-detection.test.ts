/**
 * Tests for prefix validation and beads prefix extraction.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('prefix-detection', () => {
  // We'll import dynamically to mock dependencies
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'tbd-prefix-test-'));
    vi.resetModules();
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  describe('normalizePrefix', () => {
    it('lowercases the prefix', async () => {
      const { normalizePrefix } = await import('../src/cli/lib/prefix-detection.js');
      expect(normalizePrefix('MyApp')).toBe('myapp');
    });

    it('removes invalid characters but keeps dot and underscore', async () => {
      const { normalizePrefix } = await import('../src/cli/lib/prefix-detection.js');
      expect(normalizePrefix('my-app')).toBe('myapp'); // dash removed
      expect(normalizePrefix('my_app')).toBe('my_app'); // underscore kept
      expect(normalizePrefix('my.app')).toBe('my.app'); // dot kept
      expect(normalizePrefix('my app')).toBe('myapp'); // space removed
    });

    it('truncates long prefixes to 20 chars', async () => {
      const { normalizePrefix } = await import('../src/cli/lib/prefix-detection.js');
      const longPrefix = 'averylongprojectnamethatshouldbetruncated';
      const normalized = normalizePrefix(longPrefix);
      expect(normalized.length).toBeLessThanOrEqual(20);
    });

    it('handles empty string', async () => {
      const { normalizePrefix } = await import('../src/cli/lib/prefix-detection.js');
      expect(normalizePrefix('')).toBe('');
    });
  });

  describe('isValidPrefix', () => {
    it('accepts valid prefixes (alphabetic)', async () => {
      const { isValidPrefix } = await import('../src/cli/lib/prefix-detection.js');
      expect(isValidPrefix('proj')).toBe(true);
      expect(isValidPrefix('tbd')).toBe(true);
      expect(isValidPrefix('myapp')).toBe(true);
      expect(isValidPrefix('a')).toBe(true);
    });

    it('accepts prefixes with dots and underscores in middle', async () => {
      const { isValidPrefix } = await import('../src/cli/lib/prefix-detection.js');
      expect(isValidPrefix('my_app')).toBe(true);
      expect(isValidPrefix('my.app')).toBe(true);
      expect(isValidPrefix('my_big_app1')).toBe(true);
      expect(isValidPrefix('proj.v2')).toBe(true);
    });

    it('rejects prefixes ending with dot or underscore', async () => {
      const { isValidPrefix } = await import('../src/cli/lib/prefix-detection.js');
      expect(isValidPrefix('myapp_')).toBe(false);
      expect(isValidPrefix('myapp.')).toBe(false);
    });

    it('rejects invalid prefixes', async () => {
      const { isValidPrefix } = await import('../src/cli/lib/prefix-detection.js');
      expect(isValidPrefix('')).toBe(false);
      expect(isValidPrefix('my-app')).toBe(false); // has hyphen (breaks syntax)
      expect(isValidPrefix('123')).toBe(false); // starts with number
      expect(isValidPrefix('MY APP')).toBe(false); // has space and uppercase
    });

    it('rejects prefixes that are too long (>20 chars)', async () => {
      const { isValidPrefix } = await import('../src/cli/lib/prefix-detection.js');
      expect(isValidPrefix('a'.repeat(21))).toBe(false);
      expect(isValidPrefix('a'.repeat(20))).toBe(true);
    });
  });

  describe('isRecommendedPrefix', () => {
    it('accepts recommended prefixes (2-8 alphabetic)', async () => {
      const { isRecommendedPrefix } = await import('../src/cli/lib/prefix-detection.js');
      expect(isRecommendedPrefix('tbd')).toBe(true);
      expect(isRecommendedPrefix('proj')).toBe(true);
      expect(isRecommendedPrefix('ab')).toBe(true);
      expect(isRecommendedPrefix('abcdef')).toBe(true);
    });

    it('rejects single-character prefixes', async () => {
      const { isRecommendedPrefix } = await import('../src/cli/lib/prefix-detection.js');
      expect(isRecommendedPrefix('a')).toBe(false);
    });

    it('rejects prefixes longer than 8 chars', async () => {
      const { isRecommendedPrefix } = await import('../src/cli/lib/prefix-detection.js');
      expect(isRecommendedPrefix('abcdefghi')).toBe(false); // 9 chars
      expect(isRecommendedPrefix('myprojects')).toBe(false); // 10 chars
      expect(isRecommendedPrefix('abcdefgh')).toBe(true); // 8 chars is OK
    });

    it('rejects prefixes with numbers, dots, or underscores', async () => {
      const { isRecommendedPrefix } = await import('../src/cli/lib/prefix-detection.js');
      expect(isRecommendedPrefix('proj1')).toBe(false);
      expect(isRecommendedPrefix('my_app')).toBe(false);
      expect(isRecommendedPrefix('my.app')).toBe(false);
    });
  });

  describe('getBeadsPrefix', () => {
    it('returns null when no beads config exists', async () => {
      const { getBeadsPrefix } = await import('../src/cli/lib/prefix-detection.js');
      const result = await getBeadsPrefix(tempDir);
      expect(result).toBeNull();
    });

    it('extracts prefix from beads config', async () => {
      // Create .beads/config.yaml with a prefix
      const beadsDir = join(tempDir, '.beads');
      await mkdir(beadsDir, { recursive: true });
      await writeFile(join(beadsDir, 'config.yaml'), 'display:\n  id_prefix: myproj\n');

      const { getBeadsPrefix } = await import('../src/cli/lib/prefix-detection.js');
      const result = await getBeadsPrefix(tempDir);
      expect(result).toBe('myproj');
    });

    it('returns null for invalid beads config', async () => {
      const beadsDir = join(tempDir, '.beads');
      await mkdir(beadsDir, { recursive: true });
      await writeFile(join(beadsDir, 'config.yaml'), 'invalid yaml: [');

      const { getBeadsPrefix } = await import('../src/cli/lib/prefix-detection.js');
      const result = await getBeadsPrefix(tempDir);
      expect(result).toBeNull();
    });
  });
});
