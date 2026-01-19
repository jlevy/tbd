/**
 * Tests for subdirectory support in tbd.
 *
 * Verifies that tbd correctly finds the repository root when running from subdirectories,
 * similar to how git finds .git/ directories by walking up the directory tree.
 *
 * @see cli-subdirectory.tryscript.md for golden tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { initConfig, isInitialized, findTbdRoot } from '../src/file/config.js';

describe('subdirectory support', () => {
  let tempDir: string;
  let tbdRootDir: string;

  beforeEach(async () => {
    // Create a temp directory structure:
    // tempDir/
    //   repo/           <- tbd root (has .tbd/)
    //     src/
    //       components/
    //         ui/
    //     docs/
    tempDir = await mkdtemp(join(tmpdir(), 'tbd-subdir-test-'));
    tbdRootDir = join(tempDir, 'repo');

    // Create directory structure
    await mkdir(tbdRootDir, { recursive: true });
    await mkdir(join(tbdRootDir, 'src', 'components', 'ui'), { recursive: true });
    await mkdir(join(tbdRootDir, 'docs'), { recursive: true });

    // Initialize tbd at root
    await initConfig(tbdRootDir, '3.0.0', 'test');
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('isInitialized', () => {
    it('returns true for tbd root directory', async () => {
      const result = await isInitialized(tbdRootDir);
      expect(result).toBe(true);
    });

    it('returns false for parent of tbd root', async () => {
      // tempDir is parent of repo, should not be initialized
      const result = await isInitialized(tempDir);
      expect(result).toBe(false);
    });

    it('returns true for first-level subdirectory', async () => {
      const srcDir = join(tbdRootDir, 'src');
      const result = await isInitialized(srcDir);
      expect(result).toBe(true);
    });

    it('returns true for deeply nested subdirectory', async () => {
      const deepDir = join(tbdRootDir, 'src', 'components', 'ui');
      const result = await isInitialized(deepDir);
      expect(result).toBe(true);
    });

    it('returns true for docs subdirectory', async () => {
      const docsDir = join(tbdRootDir, 'docs');
      const result = await isInitialized(docsDir);
      expect(result).toBe(true);
    });
  });

  describe('findTbdRoot', () => {
    it('returns root when called from root', async () => {
      const root = await findTbdRoot(tbdRootDir);
      expect(root).toBe(tbdRootDir);
    });

    it('returns root when called from first-level subdirectory', async () => {
      const root = await findTbdRoot(join(tbdRootDir, 'src'));
      expect(root).toBe(tbdRootDir);
    });

    it('returns root when called from deeply nested directory', async () => {
      const root = await findTbdRoot(join(tbdRootDir, 'src', 'components', 'ui'));
      expect(root).toBe(tbdRootDir);
    });

    it('returns null when not in a tbd repo', async () => {
      const root = await findTbdRoot(tempDir);
      expect(root).toBeNull();
    });

    it('returns null at filesystem root', async () => {
      const root = await findTbdRoot('/');
      expect(root).toBeNull();
    });

    it('returns root when called from docs subdirectory', async () => {
      const root = await findTbdRoot(join(tbdRootDir, 'docs'));
      expect(root).toBe(tbdRootDir);
    });
  });
});
