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

import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';

import { parseFrontmatter } from '../src/utils/markdown-utils.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
// Source files are in dist/docs after build
const docsDir = join(__dirname, '..', 'dist', 'docs');
const installDir = join(docsDir, 'install');
const shortcutsSystemDir = join(docsDir, 'shortcuts', 'system');
const monorepoRoot = join(__dirname, '..', '..', '..');

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

    it('states GitHub authorization in its own section before the closing protocol', async () => {
      const skillPath = join(shortcutsSystemDir, 'skill-baseline.md');
      const raw = await readFile(skillPath, 'utf-8');
      const start = raw.indexOf('\n## GitHub Authorization\n');
      const closing = raw.indexOf('\n## CRITICAL: Session Closing Protocol\n');
      expect(start).toBeGreaterThan(-1);
      expect(closing).toBeGreaterThan(start);
      // Scope the checks to the section, and collapse line wrapping so reformatting the
      // prose does not break them.
      const section = raw.slice(start, raw.indexOf('\n## ', start + 1)).replace(/\s+/gu, ' ');

      // Grant sources and precedence: project block first, user level as a fallback.
      expect(section).toContain('tbd policy show');
      expect(section).toContain('as committed on the default branch, is the primary record');
      expect(section).toContain('shared by every human and agent on the repository');
      expect(section).toContain('apply only to policies the project has not answered');
      expect(section).toContain('The current conversation overrides both for that task.');
      expect(section).toContain('infer a grant from memory of past conversations');
      // Named policies, with the full definitions left to the guideline.
      for (const policy of ['github-editing', 'github-workflows', 'github-merge']) {
        expect(section).toContain(`\`${policy}\``);
      }
      expect(section).toContain('`per-request`');
      expect(section).toContain('tbd guidelines agent-policy-grants');
      expect(section).toContain(
        'A tool-permission allow rule grants only the operations it allows.',
      );
      // Operational rules carried over from #308.
      expect(section).toContain('plain, single-purpose command');
      expect(section).toContain('Capturing one read-only `gh` result in a shell variable');
      expect(section).toContain('ask the user for that specific permission');
      expect(section).toContain('not evidence that `gh` is unauthenticated');
      expect(section).toContain('a working `gh` login is not a grant');
      // The user-level-only rule from #308 is not kept.
      expect(raw.replace(/\s+/gu, ' ')).not.toContain('durable user-level grant');
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

  describe('stacked PR routing', () => {
    it('preserves ordinary and formal stacked PR routing in every skill tier', async () => {
      const skillFiles = [
        join(shortcutsSystemDir, 'skill-baseline.md'),
        join(docsDir, 'skill-brief.md'),
        join(shortcutsSystemDir, 'skill-minimal.md'),
      ];

      for (const skillFile of skillFiles) {
        const content = await readFile(skillFile, 'utf-8');
        expect(content, `${skillFile} must route ordinary PR creation and updates`).toContain(
          'tbd shortcut create-or-update-pr-simple',
        );
        expect(content, `${skillFile} must recognize an explicit stack request`).toMatch(
          /stacked PR|stack dependent PRs/iu,
        );
        expect(content, `${skillFile} must route stack requests`).toContain(
          'tbd shortcut stacked-prs',
        );
        expect(content, `${skillFile} must reject branch-base-only stacks`).toContain(
          'Chained branch bases alone are not a formal GitHub stack',
        );
        expect(content, `${skillFile} must require formal gh stack operations`).toMatch(
          /link and verify the PRs with\s+`gh stack`/u,
        );
        expect(
          content,
          `${skillFile} must load stacked-prs when the branch is based on another feature branch`,
        ).toContain('based on another feature branch');
      }
    });

    it('states reviewable-unit and stack-shape rules', async () => {
      const standardDir = join(docsDir, 'shortcuts', 'standard');
      const stacked = await readFile(join(standardDir, 'stacked-prs.md'), 'utf-8');
      expect(stacked).toContain('## Reviewable Units');
      expect(stacked).toContain('8 PRs or fewer');
      expect(stacked).toContain('one stack per major feature');
      expect(stacked).toContain('Do not hand-roll informal chains');
      expect(stacked).toContain('Review each PR first, then the stack as a whole');
      expect(stacked).toContain('Do not land a stack on trunk unless asked');

      for (const name of [
        'create-or-update-pr-simple.md',
        'create-or-update-pr-with-validation-plan.md',
      ]) {
        const content = await readFile(join(standardDir, name), 'utf-8');
        expect(content, `${name} must apply Reviewable Units before creating`).toContain(
          'Reviewable unit (before `gh pr create`)',
        );
        expect(content, `${name} must stop informal feature-branch bases`).toMatch(
          /stop and run\s+`tbd shortcut stacked-prs`/u,
        );
        expect(
          content.indexOf('Reviewable unit (before `gh pr create`)'),
          `${name} must classify informal chains before updating the branch from trunk`,
        ).toBeLessThan(content.indexOf('Only after this classification, update a branch'));
      }
    });

    it('preserves draft state unless the user explicitly asks to open the stack', async () => {
      const standardDir = join(docsDir, 'shortcuts', 'standard');
      for (const name of [
        'create-or-update-pr-simple.md',
        'create-or-update-pr-with-validation-plan.md',
        'stacked-prs.md',
      ]) {
        const content = await readFile(join(standardDir, name), 'utf-8');
        expect(content, `${name} must use the non-interactive stack submit path`).toContain(
          'gh stack submit --auto',
        );
        expect(content, `${name} must make review-state changes explicit`).toContain(
          'only when the user explicitly asks',
        );
        expect(content, `${name} must not make --open the default submit command`).not.toMatch(
          /(?:run|Run) `gh stack submit --auto --open`/u,
        );
      }
    });

    it('distinguishes local tracking from authoritative formal stack membership', async () => {
      const standardDir = join(docsDir, 'shortcuts', 'standard');
      for (const name of [
        'create-or-update-pr-simple.md',
        'create-or-update-pr-with-validation-plan.md',
      ]) {
        const content = await readFile(join(standardDir, name), 'utf-8');
        expect(content, `${name} must retain the existing PR base`).toContain(
          '--json number,url,baseRefName',
        );
        expect(content, `${name} must inspect local stack tracking safely`).toContain(
          'gh stack view --json',
        );
        expect(content, `${name} must inspect remote formal membership`).toContain(
          'stacks?pull_request=$PR_NUMBER',
        );
        expect(content, `${name} must fail closed when GitHub cannot verify membership`).toContain(
          'If this API call fails, stop',
        );
        expect(content, `${name} must diff an existing stacked PR from its actual base`).toContain(
          '$PR_BASE',
        );
        expect(content, `${name} must preserve remote-only linked stacks`).toContain(
          'Formal remote stack without local tracking',
        );
        expect(content, `${name} must classify stack state before any trunk merge`).toContain(
          'Do not merge the trunk yet',
        );
        expect(content, `${name} must safely adopt a remote-only stack before syncing`).toContain(
          'gh stack checkout "$PR_URL"',
        );
        expect(content, `${name} must avoid interactive checkout conflicts`).toContain(
          'gh stack unstack --local',
        );
        expect(content, `${name} must detect a successful stack-sync abort`).toContain(
          'Sync aborted',
        );
        expect(content, `${name} must route existing PRs through formal linking`).toContain(
          'gh stack link',
        );
        expect(content, `${name} must cover a locally tracked PR before remote linking`).toContain(
          'whether or not an open PR already exists',
        );
        expect(content, `${name} must resolve a fetched remote base revision`).toContain(
          'origin/<candidate>',
        );
        expect(content, `${name} must prefer the remote base for an existing PR`).toContain(
          'Never prefer a same-named local branch over that fetched remote ref',
        );
      }

      const stacked = await readFile(join(standardDir, 'stacked-prs.md'), 'utf-8');
      expect(stacked).toContain('Local tracking and formal GitHub membership are separate states');
      expect(stacked).toContain('stacks?pull_request=$PR_NUMBER');
      expect(stacked).toContain('gh stack link');
      expect(stacked).toMatch(/it is not formal stack\s+membership by itself/u);
      expect(stacked).not.toContain('or set the base to the branch below');
    });

    it('protects remote-only stacks in merge and review follow-up workflows', async () => {
      const standardDir = join(docsDir, 'shortcuts', 'standard');
      for (const name of ['merge-upstream.md', 'address-pr-review.md']) {
        const content = await readFile(join(standardDir, name), 'utf-8');
        expect(content, `${name} must inspect authoritative remote membership`).toContain(
          'stacks?pull_request=$PR_NUMBER',
        );
        expect(content, `${name} must distinguish local tracking from remote membership`).toContain(
          'Exit 2 means only that it is not tracked locally',
        );
        expect(content, `${name} must adopt a remote-only stack before local operations`).toContain(
          'gh stack checkout "$PR_URL"',
        );
        expect(content, `${name} must avoid interactive checkout conflicts`).toContain(
          'gh stack unstack --local',
        );
        expect(
          content,
          `${name} must fail closed when stack adoption cannot be verified`,
        ).toContain('Stop if checkout fails');
        expect(content, `${name} must detect a successful stack-sync abort`).toContain(
          'Sync aborted',
        );
        expect(content, `${name} must not retain the old nonzero-is-flat rule`).not.toMatch(
          /any non-zero exit[\s\S]{0,100}means it is not/iu,
        );
      }

      const merge = await readFile(join(standardDir, 'merge-upstream.md'), 'utf-8');
      expect(merge).toContain(
        'The normal path applies only when local tracking is absent and the current PR, if any,',
      );

      const review = await readFile(join(standardDir, 'address-pr-review.md'), 'utf-8');
      expect(review).toContain(
        'Only when local tracking is absent and `$REMOTE_STACK_NUMBER` is empty',
      );
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

  describe('generated Markdown formatter boundary', () => {
    it('uses Lefthook globs that exclude every generated skill surface', async () => {
      const source = parseYaml(await readFile(join(monorepoRoot, 'lefthook.yml'), 'utf8')) as {
        'pre-commit': { commands: { 'format-md': { exclude: string[] } } };
      };
      const excludes = source['pre-commit'].commands['format-md'].exclude;
      const root = await mkdtemp(join(tmpdir(), 'tbd-lefthook-contract-'));

      try {
        const configPath = join(root, 'lefthook.yml');
        await writeFile(
          configPath,
          stringifyYaml({
            'pre-commit': {
              commands: {
                probe: {
                  exclude: excludes,
                  glob: '*.md',
                  run: 'node -e "process.exit(91)" {staged_files}',
                },
              },
            },
          }),
        );

        const lefthookEntry = join(monorepoRoot, 'node_modules', 'lefthook', 'bin', 'index.js');
        const args = [
          lefthookEntry,
          'run',
          'pre-commit',
          '--command',
          'probe',
          '--no-auto-install',
          '--no-tty',
          ...[
            '.tbd/docs/__contract-probe__.md',
            '.claude/skills/tbd/__contract-probe__.md',
            '.agents/skills/tbd/__contract-probe__.md',
            'skills/tbd/__contract-probe__.md',
            'AGENTS.md',
          ].flatMap((path) => ['--file', path]),
        ];
        const result = spawnSync(process.execPath, args, {
          cwd: monorepoRoot,
          encoding: 'utf8',
          env: { ...process.env, LEFTHOOK_CONFIG: configPath },
        });
        const output = `${result.stdout}${result.stderr}`;

        expect(result.error, output).toBeUndefined();
        expect(result.status, output).toBe(0);
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    });
  });
});
