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
      const sourcePath = join(__dirname, '..', 'docs', 'shortcuts', 'system', 'skill-minimal.md');
      const bundledPath = join(shortcutsSystemDir, 'skill-minimal.md');
      const [sourceContent, bundledContent] = await Promise.all([
        readFile(sourcePath, 'utf-8'),
        readFile(bundledPath, 'utf-8'),
      ]);
      const packageJson = JSON.parse(
        await readFile(join(__dirname, '..', 'package.json'), 'utf-8'),
      ) as { engines: { node: string } };
      const minimumNode = packageJson.engines.node.replace(/^>=/u, '');
      const requirement = `Requires Node.js ${minimumNode} or newer and git`;

      expect(sourceContent).toContain(requirement);
      expect(bundledContent).toContain(requirement);
      expect(bundledContent).toBe(sourceContent);
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

  describe('Linear onboarding routing', () => {
    it('activates the installed skill for natural Linear setup requests', async () => {
      const header = await readFile(join(installDir, 'claude-header.md'), 'utf-8');
      const frontmatter = parseFrontmatter(header);

      expect(frontmatter).toContain('Linear');
      expect(frontmatter).toContain('API key');
    });

    it('routes Linear setup through the dedicated shortcut in every skill tier', async () => {
      const skillFiles = [
        join(shortcutsSystemDir, 'skill-baseline.md'),
        join(docsDir, 'skill-brief.md'),
        join(shortcutsSystemDir, 'skill-minimal.md'),
      ];

      for (const skillFile of skillFiles) {
        const content = await readFile(skillFile, 'utf-8');
        expect(content, `${skillFile} must route Linear setup`).toContain(
          'tbd shortcut setup-linear',
        );
        expect(content, `${skillFile} must recognize a personal-key request`).toContain(
          'Linear key',
        );
      }
    });

    it('ships a two-path setup shortcut with the credential safety boundary', async () => {
      const content = await readFile(
        join(docsDir, 'shortcuts', 'standard', 'setup-linear.md'),
        'utf-8',
      );

      expect(content).toContain('First-time setup');
      expect(content).toContain('Joining a configured repo');
      expect(content).toContain('tbd integration status --offline');
      expect(content).toContain('Settings > Account > Security & Access');
      expect(content).toContain('Do not ask the user to paste');
      expect(content).toContain('tbd sync');
      expect(content).toContain('.tbd/config.yml');
      expect(content).toContain('gitignored');
    });

    it('surfaces optional Linear setup in onboarding and the user manual', async () => {
      const welcome = await readFile(
        join(docsDir, 'shortcuts', 'standard', 'welcome-user.md'),
        'utf-8',
      );
      expect(welcome).toContain('tbd integration status --offline');
      expect(welcome).toContain('tbd shortcut setup-linear');
      expect(welcome).toContain('Add my Linear key');

      const manual = await readFile(join(docsDir, 'tbd-docs.md'), 'utf-8');
      expect(manual).toContain('tbd shortcut setup-linear');
      expect(manual).toContain('Joining a repository that already syncs');
      expect(manual).toContain('First-time setup for a repository');

      const readme = await readFile(join(__dirname, '..', '..', '..', 'README.md'), 'utf-8');
      expect(readme).toContain('Optional Linear Setup');
      expect(readme).toContain('tbd shortcut setup-linear');
      expect(readme).toContain('.agents/');
      expect(readme).toContain('.codex/');
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
