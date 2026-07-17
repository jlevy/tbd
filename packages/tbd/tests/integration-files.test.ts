/**
 * Tests for integration file formats (Claude, Codex/AGENTS.md).
 * Ensures source files have proper format and content for dynamic composition.
 *
 * Note: SKILL.md is NOT pre-built in dist/docs.
 * It is dynamically generated at setup/install time by combining:
 * - Header (from dist/docs/install/claude-header.md)
 * - Base skill content (from dist/docs/shortcuts/system/skill-baseline.md)
 * - Shortcut directory (generated from available shortcuts)
 */

import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseFrontmatter } from '../src/utils/markdown-utils.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
// Source files are in dist/docs after build
const docsDir = join(__dirname, '..', 'dist', 'docs');
const installDir = join(docsDir, 'install');
const shortcutsSystemDir = join(docsDir, 'shortcuts', 'system');

describe('integration file formats', () => {
  describe('claude-header.md (source for SKILL.md)', () => {
    it('has valid Claude Code skill frontmatter', async () => {
      const headerPath = join(installDir, 'claude-header.md');
      const content = await readFile(headerPath, 'utf-8');

      const frontmatter = parseFrontmatter(content);
      expect(frontmatter).not.toBeNull();

      // Required Claude Code skill fields
      expect(frontmatter).toContain('name:');
      expect(frontmatter).toContain('description:');
    });

    it('uses the canonical narrow allowed-tools form', async () => {
      const headerPath = join(installDir, 'claude-header.md');
      const content = await readFile(headerPath, 'utf-8');
      const frontmatter = parseFrontmatter(content);

      expect(frontmatter).toContain('allowed-tools: Bash(tbd:*) Read Write');
      expect(frontmatter).not.toMatch(/allowed-tools:[^\n]*,/);
      expect(frontmatter).not.toMatch(/Bash\((?:npx|uvx|pnpm):\*\)/);
    });
  });

  describe('skill-baseline.md (shared skill content)', () => {
    it('contains tbd workflow content', async () => {
      const skillPath = join(shortcutsSystemDir, 'skill-baseline.md');
      const content = await readFile(skillPath, 'utf-8');

      expect(content).toContain('tbd');
      expect(content).toContain('Session Closing Protocol');
      expect(content).toContain('tbd sync');
    });

    it('contains essential command documentation', async () => {
      const skillPath = join(shortcutsSystemDir, 'skill-baseline.md');
      const content = await readFile(skillPath, 'utf-8');

      // Essential commands should be documented
      expect(content).toContain('tbd ready');
      expect(content).toContain('tbd create');
      expect(content).toContain('tbd close');
    });
  });

  describe('skills/tbd/SKILL.md (distribution copy)', () => {
    const monorepoRoot = join(__dirname, '..', '..', '..');
    const distSkillPath = join(monorepoRoot, 'skills', 'tbd', 'SKILL.md');

    it('is committed and free of drift from the composed skill', async () => {
      const committed = await readFile(distSkillPath, 'utf-8');
      const composed = await readFile(join(docsDir, 'SKILL.md'), 'utf-8');
      // The committed distribution copy must match the freshly built skill.
      // If this fails, run `pnpm build` and commit skills/tbd/SKILL.md.
      expect(committed).toBe(composed);
    });

    it('has valid Agent Skills frontmatter', async () => {
      const committed = await readFile(distSkillPath, 'utf-8');
      const frontmatter = parseFrontmatter(committed);
      expect(frontmatter).not.toBeNull();
      expect(frontmatter).toContain('name:');
      expect(frontmatter).toContain('description:');
      expect(frontmatter).toContain('allowed-tools: Bash(tbd:*) Read Write');
    });
  });
});
