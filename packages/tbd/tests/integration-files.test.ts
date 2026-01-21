/**
 * Tests for integration file formats (Cursor, Claude, Codex).
 * Ensures all integration files have proper format and content.
 */

import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const docsDir = join(__dirname, '..', 'src', 'docs');

describe('integration file formats', () => {
  describe('CURSOR.mdc', () => {
    it('has valid MDC frontmatter with required fields', async () => {
      const cursorPath = join(docsDir, 'CURSOR.mdc');
      const content = await readFile(cursorPath, 'utf-8');

      // MDC files must start with YAML frontmatter
      expect(content.startsWith('---\n')).toBe(true);

      // Extract frontmatter
      const endOfFrontmatter = content.indexOf('\n---\n', 4);
      expect(endOfFrontmatter).toBeGreaterThan(0);

      const frontmatter = content.slice(4, endOfFrontmatter);

      // Required MDC fields
      expect(frontmatter).toContain('description:');
      expect(frontmatter).toContain('alwaysApply:');
    });

    it('contains tbd workflow content', async () => {
      const cursorPath = join(docsDir, 'CURSOR.mdc');
      const content = await readFile(cursorPath, 'utf-8');

      // Should contain key workflow sections
      expect(content).toContain('tbd');
      expect(content).toContain('SESSION CLOSING PROTOCOL');
      expect(content).toContain('tbd sync');
    });
  });

  describe('SKILL.md', () => {
    it('has valid Claude Code skill frontmatter', async () => {
      const skillPath = join(docsDir, 'SKILL.md');
      const content = await readFile(skillPath, 'utf-8');

      // Skill files must start with YAML frontmatter
      expect(content.startsWith('---\n')).toBe(true);

      // Extract frontmatter
      const endOfFrontmatter = content.indexOf('\n---\n', 4);
      expect(endOfFrontmatter).toBeGreaterThan(0);

      const frontmatter = content.slice(4, endOfFrontmatter);

      // Required Claude Code skill fields
      expect(frontmatter).toContain('name:');
      expect(frontmatter).toContain('description:');
    });

    it('contains tbd workflow content', async () => {
      const skillPath = join(docsDir, 'SKILL.md');
      const content = await readFile(skillPath, 'utf-8');

      expect(content).toContain('tbd');
      expect(content).toContain('SESSION CLOSING PROTOCOL');
    });
  });
});
