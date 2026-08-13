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

    it('activates for natural requests to view beads in a browser', async () => {
      const headerPath = join(installDir, 'claude-header.md');
      const content = await readFile(headerPath, 'utf-8');
      const frontmatter = parseFrontmatter(content);

      expect(frontmatter).toContain('viewing beads in a live browser');
      expect(frontmatter).toContain('web, browser,');
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

  describe('live web viewer routing', () => {
    it('teaches the full installed skill to open and operate the viewer for the user', async () => {
      const skillPath = join(shortcutsSystemDir, 'skill-baseline.md');
      const content = await readFile(skillPath, 'utf-8');

      expect(content).toContain('Show my beads in a browser');
      expect(content).toContain('tbd web --open');
      expect(content).toContain('tbd web <path> --open');
      expect(content).toContain('viewer, not an editor');
      expect(content).toMatch(/ordinary `tbd`\s+commands/u);
    });

    it('keeps the browser route and ownership boundary in both compact skill tiers', async () => {
      for (const name of ['skill-brief.md', 'shortcuts/system/skill-minimal.md']) {
        const content = await readFile(join(docsDir, name), 'utf-8');
        expect(content, `${name} must route browser requests`).toContain('tbd web --open');
        expect(content, `${name} must support another working directory`).toContain(
          'tbd web <path> --open',
        );
        expect(content, `${name} must identify a viewer rather than an editor`).toContain(
          'viewer, not an editor',
        );
        expect(content, `${name} must preserve agent-owned mutation`).toMatch(
          /ordinary `tbd`\s+commands/u,
        );
      }
    });

    it('keeps the minimal skill runtime requirement aligned with the package', async () => {
      const content = await readFile(join(shortcutsSystemDir, 'skill-minimal.md'), 'utf-8');
      const packageJson = JSON.parse(
        await readFile(join(__dirname, '..', 'package.json'), 'utf-8'),
      ) as { engines: { node: string } };
      const minimumNode = packageJson.engines.node.replace(/^>=/u, '');

      expect(content).toContain(`Requires Node.js ${minimumNode}+ and git`);
    });

    it('includes the natural-language browser request in installed onboarding', async () => {
      const content = await readFile(
        join(docsDir, 'shortcuts', 'standard', 'welcome-user.md'),
        'utf-8',
      );
      expect(content).toContain('Show my beads in a browser');
      expect(content).toContain('tbd web --open');
      expect(content).toContain('not an editor');
    });
  });

  describe('typescript-lint-format-rules routing', () => {
    const combinedRoute = 'tbd guidelines typescript-rules typescript-lint-format-rules';

    it('skill baseline routes TypeScript work through the lint/format floor', async () => {
      const skillPath = join(shortcutsSystemDir, 'skill-baseline.md');
      const content = await readFile(skillPath, 'utf-8');

      expect(content).toContain(combinedRoute);
      expect(content).toContain('tbd guidelines typescript-lint-format-rules');
    });

    it('review shortcuts load the lint/format floor for TS/JS changes', async () => {
      const standardDir = join(docsDir, 'shortcuts', 'standard');
      for (const name of ['review-code.md', 'review-code-typescript.md']) {
        const content = await readFile(join(standardDir, name), 'utf-8');
        expect(content, `${name} must load the TS/JS lint-format floor`).toContain(combinedRoute);
      }
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
