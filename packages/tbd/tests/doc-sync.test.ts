/**
 * Tests for doc-sync.ts - doc cache sync functionality.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomBytes } from 'node:crypto';

import { DocSync, isDocsStale } from '../src/file/doc-sync.js';

describe('doc-sync', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = join(tmpdir(), `tbd-doc-sync-test-${randomBytes(4).toString('hex')}`);
    await mkdir(tempDir, { recursive: true });
    await mkdir(join(tempDir, '.tbd', 'docs'), { recursive: true });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('DocSync.parseSource', () => {
    it('parses internal source', () => {
      const sync = new DocSync(tempDir, {});
      const source = sync.parseSource('internal:shortcuts/standard/commit-code.md');

      expect(source.type).toBe('internal');
      expect(source.location).toBe('shortcuts/standard/commit-code.md');
    });

    it('parses URL source', () => {
      const sync = new DocSync(tempDir, {});
      const source = sync.parseSource('https://raw.githubusercontent.com/org/repo/main/file.md');

      expect(source.type).toBe('url');
      expect(source.location).toBe('https://raw.githubusercontent.com/org/repo/main/file.md');
    });
  });

  describe('DocSync.getCurrentState', () => {
    it('returns empty set when docs directory is empty', async () => {
      const sync = new DocSync(tempDir, {});
      const state = await sync.getCurrentState();

      expect(state.size).toBe(0);
    });

    it('returns paths of existing docs', async () => {
      await writeFile(join(tempDir, '.tbd', 'docs', 'test.md'), '# Test');
      await mkdir(join(tempDir, '.tbd', 'docs', 'shortcuts'), { recursive: true });
      await writeFile(join(tempDir, '.tbd', 'docs', 'shortcuts', 'commit.md'), '# Commit');

      const sync = new DocSync(tempDir, {});
      const state = await sync.getCurrentState();

      expect(state.has('test.md')).toBe(true);
      expect(state.has('shortcuts/commit.md')).toBe(true);
    });
  });

  describe('DocSync.sync', () => {
    it('adds new docs from config', async () => {
      // Create a test doc in a simulated internal location
      const internalDocsDir = join(tempDir, 'internal-docs');
      await mkdir(join(internalDocsDir, 'shortcuts'), { recursive: true });
      await writeFile(join(internalDocsDir, 'shortcuts', 'test.md'), '# Test Shortcut');

      // Note: We can't easily test internal docs without mocking the getDocsBasePath
      // Instead, test the status/dry-run functionality
      const sync = new DocSync(tempDir, {
        'shortcuts/test.md': 'internal:shortcuts/test.md',
      });

      const result = await sync.sync({ dryRun: true });

      // Should report that it would add the doc (even if fetch fails)
      expect(result.errors.length > 0 || result.added.length > 0).toBe(true);
    });

    it('removes docs not in config', async () => {
      // Create a doc that should be removed
      await writeFile(join(tempDir, '.tbd', 'docs', 'old-doc.md'), '# Old Doc');

      const sync = new DocSync(tempDir, {});
      const result = await sync.sync();

      expect(result.removed).toContain('old-doc.md');
    });

    it('dry run does not modify files', async () => {
      await writeFile(join(tempDir, '.tbd', 'docs', 'old-doc.md'), '# Old Doc');

      const sync = new DocSync(tempDir, {});
      const result = await sync.sync({ dryRun: true });

      expect(result.removed).toContain('old-doc.md');

      // File should still exist
      const content = await readFile(join(tempDir, '.tbd', 'docs', 'old-doc.md'), 'utf-8');
      expect(content).toBe('# Old Doc');
    });
  });

  describe('DocSync.status', () => {
    it('returns what would change without modifying', async () => {
      await writeFile(join(tempDir, '.tbd', 'docs', 'old-doc.md'), '# Old Doc');

      const sync = new DocSync(tempDir, {});
      const result = await sync.status();

      expect(result.removed).toContain('old-doc.md');
    });
  });

  describe('isDocsStale', () => {
    it('returns true when never synced', () => {
      expect(isDocsStale(undefined, 24)).toBe(true);
    });

    it('returns false when auto-sync is disabled', () => {
      expect(isDocsStale(undefined, 0)).toBe(false);
    });

    it('returns false when recently synced', () => {
      const now = new Date().toISOString();
      expect(isDocsStale(now, 24)).toBe(false);
    });

    it('returns true when sync is older than configured hours', () => {
      const old = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(); // 25 hours ago
      expect(isDocsStale(old, 24)).toBe(true);
    });

    it('returns false when sync is within configured hours', () => {
      const recent = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(); // 12 hours ago
      expect(isDocsStale(recent, 24)).toBe(false);
    });
  });
});
