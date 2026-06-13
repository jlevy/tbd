/**
 * Integration tests for tbd setup flows.
 * Tests fresh setup, beads migration, already initialized, and outside git repo scenarios.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir, writeFile, readFile, access, realpath } from 'node:fs/promises';
import { tmpdir, platform } from 'node:os';
import { join } from 'node:path';
import { execSync, spawnSync } from 'node:child_process';

// Windows process spawning is significantly slower on CI
const isWindows = platform() === 'win32';
const setupFlowTestTimeout = isWindows ? 60000 : 15000;

describe('setup flows', { timeout: setupFlowTestTimeout }, () => {
  let tempDir: string;
  const tbdBin = join(__dirname, '..', 'dist', 'bin.mjs');

  beforeEach(async () => {
    // Use realpath to resolve any symlinks (important for macOS where /tmp is symlinked)
    const rawTempDir = await mkdtemp(join(tmpdir(), 'tbd-setup-test-'));
    tempDir = await realpath(rawTempDir);
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  /**
   * Helper to run tbd command in temp directory.
   */
  function runTbd(
    args: string[],
    cwd = tempDir,
    extraEnv: Record<string, string> = {},
  ): { stdout: string; stderr: string; status: number } {
    const result = spawnSync('node', [tbdBin, ...args], {
      cwd,
      encoding: 'utf-8',
      env: { ...process.env, FORCE_COLOR: '0', CLAUDE_CODE: '1', ...extraEnv },
    });
    return {
      stdout: result.stdout || '',
      stderr: result.stderr || '',
      status: result.status ?? 1,
    };
  }

  /**
   * Initialize git repo in temp directory.
   */
  function initGitRepo(): void {
    execSync('git init --initial-branch=main', { cwd: tempDir });
    execSync('git config user.email "test@example.com"', { cwd: tempDir });
    execSync('git config user.name "Test"', { cwd: tempDir });
  }

  describe('tbd setup without flags', () => {
    it('shows help message with mode requirement', () => {
      initGitRepo();
      const result = runTbd(['setup']);

      expect(result.stdout).toContain('--auto');
      expect(result.stdout).toContain('--from-beads');
      // The --interactive flag was removed (never had prompts; agents are the operators).
      expect(result.stdout).not.toContain('--interactive');
    });

    it('rejects the removed --interactive flag', () => {
      initGitRepo();
      const result = runTbd(['setup', '--interactive']);

      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain("unknown option '--interactive'");
    });
  });

  describe('fresh repo setup', () => {
    it('tbd setup --auto requires --prefix flag', () => {
      initGitRepo();

      // No --prefix provided, no beads to migrate from
      const result = runTbd(['setup', '--auto']);

      // Should fail with helpful error message
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain('--prefix');
      expect(result.stderr).toContain('required');
    });

    it('tbd setup --auto --prefix=custom uses provided prefix', async () => {
      initGitRepo();

      const result = runTbd(['setup', '--auto', '--prefix=custom']);

      expect(result.status).toBe(0);
      expect(result.stdout).toContain('custom');

      // Verify prefix in config
      const { readConfig } = await import('../src/file/config.js');
      const config = await readConfig(tempDir);
      expect(config.display.id_prefix).toBe('custom');
    });

    it("shows What's Next section after setup", () => {
      initGitRepo();

      const result = runTbd(['setup', '--auto', '--prefix=test']);

      expect(result.status).toBe(0);
      // Should show What's Next guidance with natural language framing
      expect(result.stdout).toContain("WHAT'S NEXT");
      expect(result.stdout).toContain('Try saying things like:');
      expect(result.stdout).toContain("There's a bug where");
      expect(result.stdout).toContain("Let's plan a new feature");
      expect(result.stdout).toContain('Commit this code');
    });

    it('installs the portable Agent Skill identical to the Claude mirror', async () => {
      initGitRepo();

      const result = runTbd(['setup', '--auto', '--prefix=test']);
      expect(result.status).toBe(0);

      const portablePath = join(tempDir, '.agents/skills/tbd/SKILL.md');
      const mirrorPath = join(tempDir, '.claude/skills/tbd/SKILL.md');

      const portable = await readFile(portablePath, 'utf-8');
      expect(portable).toContain('name:');
      expect(portable).toContain('DO NOT EDIT');

      // The portable skill and the Claude mirror must carry the same payload.
      const mirror = await readFile(mirrorPath, 'utf-8');
      expect(portable).toBe(mirror);
    });

    it('refuses to overwrite a generated skill written by a newer tbd', async () => {
      initGitRepo();

      // Plant a skill stamped with a future integration format.
      const portablePath = join(tempDir, '.agents/skills/tbd/SKILL.md');
      await mkdir(join(tempDir, '.agents/skills/tbd'), { recursive: true });
      await writeFile(
        portablePath,
        '---\nname: tbd\n---\n' +
          "<!-- DO NOT EDIT: Generated by tbd setup (format=f99).\nRun 'tbd setup' to update.\n-->\n\nFuture skill.\n",
      );

      const result = runTbd(['setup', '--auto', '--prefix=test']);

      // Hard stop with an actionable upgrade message; the newer skill is preserved.
      expect(result.status).not.toBe(0);
      expect(result.stderr + result.stdout).toContain('newer tbd');
      expect(result.stderr + result.stdout).toContain('get-tbd@latest');

      const preserved = await readFile(portablePath, 'utf-8');
      expect(preserved).toContain('format=f99');
      expect(preserved).toContain('Future skill.');
    });
  });

  describe('AGENTS.md compact managed block', () => {
    it('writes a compact, format-stamped block instead of the full skill', async () => {
      initGitRepo();

      // CODEX_* env makes setup write the AGENTS.md managed block.
      const result = runTbd(['setup', '--auto', '--prefix=test'], tempDir, {
        CODEX_HOME: tempDir,
      });
      expect(result.status).toBe(0);

      const agents = await readFile(join(tempDir, 'AGENTS.md'), 'utf-8');
      expect(agents).toContain('<!-- BEGIN TBD INTEGRATION format=f06 surface=agents-md -->');
      expect(agents).toContain('tbd prime');

      const block = agents.slice(
        agents.indexOf('<!-- BEGIN TBD INTEGRATION'),
        agents.indexOf('<!-- END TBD INTEGRATION -->'),
      );
      // The compact block must NOT embed the full skill body (which the old
      // pre-versioning block did — e.g. the Session Closing Protocol section).
      expect(block).not.toContain('Session Closing Protocol');
      // Compact: the managed block stays well under the AGENTS.md budget.
      expect(block.split('\n').length).toBeLessThan(80);
    });
  });

  describe('Codex hooks install', () => {
    it('installs .codex/hooks.json and scripts that never reference .claude', async () => {
      initGitRepo();

      const result = runTbd(['setup', '--auto', '--prefix=test'], tempDir, {
        CODEX_HOME: tempDir,
      });
      expect(result.status).toBe(0);

      const hooksRaw = await readFile(join(tempDir, '.codex/hooks.json'), 'utf-8');
      const hooks = JSON.parse(hooksRaw) as {
        hooks: Record<string, { hooks: { command: string }[] }[]>;
      };

      const allCommands = Object.values(hooks.hooks)
        .flat()
        .flatMap((entry) => entry.hooks.map((h) => h.command));

      // SessionStart runs the session script; PreCompact passes --brief.
      expect(allCommands.some((c) => c.includes('.codex/tbd-session.sh'))).toBe(true);
      expect(allCommands.some((c) => c.includes('--brief'))).toBe(true);
      expect(allCommands.some((c) => c.includes('tbd-closing-reminder.sh'))).toBe(true);

      // Codex hooks must never reach into the Claude install.
      for (const command of allCommands) {
        expect(command).not.toContain('.claude/');
      }

      // The referenced scripts exist.
      await access(join(tempDir, '.codex/tbd-session.sh'));
      await access(join(tempDir, '.codex/tbd-closing-reminder.sh'));
    });

    it('does not duplicate Codex hook entries on repeated setup', async () => {
      initGitRepo();
      runTbd(['setup', '--auto', '--prefix=test'], tempDir, { CODEX_HOME: tempDir });
      runTbd(['setup', '--auto'], tempDir, { CODEX_HOME: tempDir });

      const hooks = JSON.parse(await readFile(join(tempDir, '.codex/hooks.json'), 'utf-8')) as {
        hooks: Record<string, { hooks: { command: string }[] }[]>;
      };
      const sessionTbdEntries = (hooks.hooks.SessionStart ?? []).filter((entry) =>
        entry.hooks.some((h) => h.command.includes('tbd-session.sh')),
      );
      expect(sessionTbdEntries.length).toBe(1);
    });
  });

  describe('upgrade of an older .claude-only install', () => {
    it('adds the portable skill while preserving the Claude mirror', async () => {
      initGitRepo();
      runTbd(['setup', '--auto', '--prefix=test']);

      // Simulate an old install that only has the Claude surface by removing the
      // portable skill, then re-running setup.
      await rm(join(tempDir, '.agents'), { recursive: true, force: true });
      await access(join(tempDir, '.claude/skills/tbd/SKILL.md'));

      const result = runTbd(['setup', '--auto']);
      expect(result.status).toBe(0);

      // Portable skill is restored and the Claude mirror is still present.
      await access(join(tempDir, '.agents/skills/tbd/SKILL.md'));
      await access(join(tempDir, '.claude/skills/tbd/SKILL.md'));
    });
  });

  describe('integration format guard (self-upgrade safety)', () => {
    it('self-upgrades a legacy unversioned AGENTS.md block in place', async () => {
      initGitRepo();
      // Simulate an old generated block with no integration-format metadata.
      await writeFile(
        join(tempDir, 'AGENTS.md'),
        '# Project Instructions for AI Agents\n\n' +
          '<!-- BEGIN TBD INTEGRATION -->\n## tbd\n\nOld full block content here.\n' +
          '<!-- END TBD INTEGRATION -->\n\n## My Notes\n\nKeep me.\n',
      );

      const result = runTbd(['setup', '--auto', '--prefix=test']);
      expect(result.status).toBe(0);

      const agents = await readFile(join(tempDir, 'AGENTS.md'), 'utf-8');
      // Upgraded to the versioned compact block...
      expect(agents).toContain('format=f06');
      // ...while preserving user content outside the managed region.
      expect(agents).toContain('## My Notes');
      expect(agents).toContain('Keep me.');
    });

    it('refuses to overwrite an AGENTS.md written by a newer tbd', async () => {
      initGitRepo();
      await writeFile(
        join(tempDir, 'AGENTS.md'),
        '# Project Instructions for AI Agents\n\n' +
          '<!-- BEGIN TBD INTEGRATION format=f99 surface=agents-md -->\n' +
          '## tbd\n\nFuture block.\n' +
          '<!-- END TBD INTEGRATION -->\n',
      );

      const result = runTbd(['setup', '--auto', '--prefix=test']);

      // Hard stop with an actionable upgrade message; the newer block is preserved.
      expect(result.status).not.toBe(0);
      expect(result.stderr + result.stdout).toContain('newer tbd');
      expect(result.stderr + result.stdout).toContain('get-tbd@latest');

      const agents = await readFile(join(tempDir, 'AGENTS.md'), 'utf-8');
      expect(agents).toContain('format=f99');
      expect(agents).toContain('Future block.');
    });
  });

  describe('--surfaces selector', () => {
    it('default (no --surfaces) installs all four surfaces', async () => {
      initGitRepo();

      const result = runTbd(['setup', '--auto', '--prefix=test']);
      expect(result.status).toBe(0);

      await access(join(tempDir, '.agents/skills/tbd/SKILL.md'));
      await access(join(tempDir, 'AGENTS.md'));
      await access(join(tempDir, '.claude/settings.json'));
      await access(join(tempDir, '.codex/hooks.json'));
    });

    it('--surfaces=codex installs only the Codex hooks surface', async () => {
      initGitRepo();

      const result = runTbd(['setup', '--auto', '--prefix=test', '--surfaces=codex']);
      expect(result.status).toBe(0);

      // Codex hooks present; every other surface suppressed.
      await access(join(tempDir, '.codex/hooks.json'));
      await expect(access(join(tempDir, 'AGENTS.md'))).rejects.toThrow();
      await expect(access(join(tempDir, '.claude/settings.json'))).rejects.toThrow();
      await expect(access(join(tempDir, '.agents/skills/tbd/SKILL.md'))).rejects.toThrow();
    });

    it('--surfaces=agents-md,portable installs only those two (codex hooks split off)', async () => {
      initGitRepo();

      const result = runTbd(['setup', '--auto', '--prefix=test', '--surfaces=agents-md,portable']);
      expect(result.status).toBe(0);

      await access(join(tempDir, 'AGENTS.md'));
      await access(join(tempDir, '.agents/skills/tbd/SKILL.md'));
      // agents-md is independent of the codex hooks surface.
      await expect(access(join(tempDir, '.codex/hooks.json'))).rejects.toThrow();
      await expect(access(join(tempDir, '.claude/settings.json'))).rejects.toThrow();
    });

    it('rejects an unknown surface id', () => {
      initGitRepo();

      const result = runTbd(['setup', '--auto', '--prefix=test', '--surfaces=bogus']);
      expect(result.status).not.toBe(0);
      expect(result.stderr + result.stdout).toContain('Unknown surface');
    });
  });

  describe('already initialized repo', () => {
    it('reports existing initialization status', () => {
      initGitRepo();

      // First initialize
      runTbd(['setup', '--auto', '--prefix=test']);

      // Try to setup again
      const result = runTbd(['setup', '--auto']);

      expect(result.status).toBe(0);
      expect(result.stdout).toContain('tbd initialized');
    });
  });

  describe('docs summary', () => {
    // The zero-fork menu, verbatim. Wording is shared with the bare `tbd docs`
    // overview (src/cli/lib/docs-menu.ts); the count is masked because the
    // bundled-doc inventory grows over time.
    const zeroForkMenu = [
      'Docs: [N] docs available in the cache (.tbd/docs/, gitignored); none forked into the repo.',
      '  Guidelines are active from the cache. Three postures, all serving the same docs:',
      '  Hidden (default):  keep the cache as-is; zero repo footprint',
      '  Curated:           tbd docs fork <name> [...]  fork chosen docs into docs/tbd/',
      '                     tbd docs fork --category=<name>  (general, typescript, python, convex, electron)',
      '  Everything:        tbd docs fork --all         all docs, visible and editable',
      '  Browse / read: tbd docs list / tbd docs show <name>',
    ].join('\n');

    it('shows the three-posture menu when nothing is forked', () => {
      initGitRepo();

      const result = runTbd(['setup', '--auto', '--prefix=test']);
      expect(result.status).toBe(0);

      const masked = result.stdout.replace(/Docs: \d+ docs available/, 'Docs: [N] docs available');
      expect(masked).toContain(zeroForkMenu);
    });

    it('reports fork count and pending updates instead of the menu', async () => {
      initGitRepo();
      runTbd(['setup', '--auto', '--prefix=test']);

      const forkResult = runTbd(['docs', 'fork', 'python-rules']);
      expect(forkResult.status).toBe(0);

      // Forks current: one line, no update nudge, no posture menu.
      const current = runTbd(['setup', '--auto']);
      expect(current.status).toBe(0);
      expect(current.stdout).toContain('Docs: 1 forked into docs/tbd/.');
      expect(current.stdout).not.toContain('upstream updates');
      expect(current.stdout).not.toContain('Three postures');

      // Mark the fork stale (as after a tbd upgrade): its recorded base no
      // longer matches the cache content.
      const manifestPath = join(tempDir, '.tbd', 'doc-forks', 'forks.yml');
      const manifest = await readFile(manifestPath, 'utf-8');
      await writeFile(
        manifestPath,
        manifest.replace(/base_hash: sha256:[0-9a-f]+/, `base_hash: sha256:${'0'.repeat(64)}`),
      );

      const stale = runTbd(['setup', '--auto']);
      expect(stale.status).toBe(0);
      expect(stale.stdout).toContain(
        "Docs: 1 forked into docs/tbd/. 1 have upstream updates; run 'tbd docs update'.",
      );

      // Reporting only: setup must never write the fork dir or its manifest.
      expect(await readFile(manifestPath, 'utf-8')).toContain(`sha256:${'0'.repeat(64)}`);
    });
  });

  describe('beads migration', { timeout: isWindows ? 60000 : 15000 }, () => {
    it('detects beads and offers migration', async () => {
      initGitRepo();

      // Create mock beads structure
      const beadsDir = join(tempDir, '.beads');
      await mkdir(beadsDir, { recursive: true });
      await writeFile(join(beadsDir, 'config.yaml'), 'display:\n  id_prefix: oldproj\n');
      await writeFile(join(beadsDir, 'issues.jsonl'), '');

      const result = runTbd(['setup', '--auto']);

      expect(result.status).toBe(0);
      // Should detect and migrate from beads
      expect(result.stdout).toContain('Beads detected');
    });

    it('uses beads prefix during migration', async () => {
      initGitRepo();

      // Create mock beads structure with prefix
      const beadsDir = join(tempDir, '.beads');
      await mkdir(beadsDir, { recursive: true });
      await writeFile(join(beadsDir, 'config.yaml'), 'display:\n  id_prefix: mylegacy\n');
      await writeFile(join(beadsDir, 'issues.jsonl'), '');

      const result = runTbd(['setup', '--auto']);

      expect(result.status).toBe(0);

      // Verify prefix from beads was used
      const { readConfig } = await import('../src/file/config.js');
      const config = await readConfig(tempDir);
      expect(config.display.id_prefix).toBe('mylegacy');
    });
  });

  describe('outside git repo', () => {
    it('fails with helpful error when not in git repo', () => {
      // Don't initialize git
      const result = runTbd(['setup', '--auto', '--prefix=test']);

      expect(result.status).not.toBe(0);
      // Should show error about git
    });
  });

  describe('surgical init', () => {
    it('tbd init creates only .tbd directory', async () => {
      initGitRepo();

      const result = runTbd(['init', '--prefix=surgical']);

      expect(result.status).toBe(0);

      // Should have created .tbd directory
      await expect(access(join(tempDir, '.tbd'))).resolves.not.toThrow();
    });

    it('tbd init requires --prefix', () => {
      initGitRepo();

      const result = runTbd(['init']);

      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain('--prefix');
    });

    it('tbd init from subdirectory creates .tbd at git root', async () => {
      initGitRepo();

      // Create a nested subdirectory
      const subdir = join(tempDir, 'src', 'components');
      await mkdir(subdir, { recursive: true });

      // Run tbd init from subdirectory
      const result = runTbd(['init', '--prefix=subtest'], subdir);

      expect(result.status).toBe(0);

      // .tbd should be at git root, NOT in subdirectory
      await expect(access(join(tempDir, '.tbd'))).resolves.not.toThrow();

      // Verify .tbd is NOT in subdirectory
      await expect(access(join(subdir, '.tbd'))).rejects.toThrow();
    });

    it('tbd init fails outside git repository', () => {
      // Don't init git repo - just use bare temp dir
      const result = runTbd(['init', '--prefix=nogit']);

      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain('Not a git repository');
    });
  });

  describe('legacy cleanup', { timeout: 30000 }, () => {
    it('removes legacy tbd scripts from .claude/scripts/', async () => {
      initGitRepo();

      // Create legacy script structure
      const scriptsDir = join(tempDir, '.claude', 'scripts');
      await mkdir(scriptsDir, { recursive: true });
      await writeFile(join(scriptsDir, 'setup-tbd.sh'), '#!/bin/bash\necho "legacy"');
      await writeFile(join(scriptsDir, 'ensure-tbd-cli.sh'), '#!/bin/bash\necho "legacy"');
      await writeFile(join(scriptsDir, 'other-script.sh'), '#!/bin/bash\necho "keep"');

      // Initialize first (needed for setup to work)
      runTbd(['init', '--prefix=test']);

      // Run setup which should clean up legacy scripts
      const result = runTbd(['setup', '--auto']);

      expect(result.status).toBe(0);

      // Legacy scripts should be removed
      await expect(access(join(scriptsDir, 'setup-tbd.sh'))).rejects.toThrow();
      await expect(access(join(scriptsDir, 'ensure-tbd-cli.sh'))).rejects.toThrow();

      // Non-tbd scripts should remain
      await expect(access(join(scriptsDir, 'other-script.sh'))).resolves.not.toThrow();
    });

    it('removes legacy hook entries from project settings.json', async () => {
      const { readFile } = await import('node:fs/promises');
      initGitRepo();

      // Create legacy project settings with old hook entries
      const settingsDir = join(tempDir, '.claude');
      await mkdir(settingsDir, { recursive: true });
      await writeFile(
        join(settingsDir, 'settings.json'),
        JSON.stringify(
          {
            hooks: {
              SessionStart: [
                {
                  matcher: '',
                  hooks: [
                    {
                      type: 'command',
                      command: 'bash .claude/scripts/ensure-tbd-cli.sh',
                    },
                  ],
                },
                {
                  matcher: '',
                  hooks: [
                    {
                      type: 'command',
                      command: 'bash .claude/scripts/ensure-gh-cli.sh',
                    },
                  ],
                },
              ],
            },
          },
          null,
          2,
        ),
      );

      // Initialize first
      runTbd(['init', '--prefix=test']);

      // Run setup which should clean up legacy hooks
      const result = runTbd(['setup', '--auto']);

      expect(result.status).toBe(0);

      // Check settings.json was cleaned up
      const settingsContent = await readFile(join(settingsDir, 'settings.json'), 'utf-8');
      const settings = JSON.parse(settingsContent);

      // Legacy tbd hooks should be removed but gh-cli hook should remain
      const sessionStartHooks = settings.hooks?.SessionStart ?? [];
      const hasLegacyTbdHook = sessionStartHooks.some((h: { hooks?: { command?: string }[] }) =>
        h.hooks?.some((hook) => hook.command?.includes('ensure-tbd')),
      );
      expect(hasLegacyTbdHook).toBe(false);

      // gh-cli hook should still be there
      const hasGhCliHook = sessionStartHooks.some((h: { hooks?: { command?: string }[] }) =>
        h.hooks?.some((hook) => hook.command?.includes('ensure-gh-cli')),
      );
      expect(hasGhCliHook).toBe(true);
    });

    it('cleans up legacy scripts during fresh setup', async () => {
      initGitRepo();

      // Create legacy script
      const scriptsDir = join(tempDir, '.claude', 'scripts');
      await mkdir(scriptsDir, { recursive: true });
      await writeFile(join(scriptsDir, 'setup-tbd.sh'), '#!/bin/bash\necho "legacy"');

      // Verify script exists before setup
      await expect(access(join(scriptsDir, 'setup-tbd.sh'))).resolves.not.toThrow();

      // Run fresh setup (not already initialized) to trigger cleanup
      const result = runTbd(['setup', '--auto', '--prefix=test']);

      expect(result.status).toBe(0);

      // Verify script was removed during setup
      await expect(access(join(scriptsDir, 'setup-tbd.sh'))).rejects.toThrow();
    });
  });

  describe('gh CLI setup', () => {
    it('installs ensure-gh-cli.sh script and SessionStart hook by default', async () => {
      initGitRepo();
      const result = runTbd(['setup', '--auto', '--prefix=test']);
      expect(result.status).toBe(0);

      // Script file should exist
      const scriptPath = join(tempDir, '.claude', 'scripts', 'ensure-gh-cli.sh');
      await expect(access(scriptPath)).resolves.not.toThrow();
      const scriptContent = await readFile(scriptPath, 'utf-8');
      expect(scriptContent).toContain('#!/bin/bash');
      expect(scriptContent).toContain('gh');

      // Project settings.json should have SessionStart hook for gh CLI
      const settingsPath = join(tempDir, '.claude', 'settings.json');
      const settings = JSON.parse(await readFile(settingsPath, 'utf-8'));
      const sessionStart = settings.hooks?.SessionStart ?? [];
      const hasGhHook = sessionStart.some((h: { hooks?: { command?: string }[] }) =>
        h.hooks?.some((hook) => hook.command?.includes('ensure-gh-cli')),
      );
      expect(hasGhHook).toBe(true);
    });

    it('does not duplicate SessionStart hook on repeated setup', async () => {
      initGitRepo();
      runTbd(['setup', '--auto', '--prefix=test']);
      runTbd(['setup', '--auto']); // second run

      const settingsPath = join(tempDir, '.claude', 'settings.json');
      const settings = JSON.parse(await readFile(settingsPath, 'utf-8'));
      const sessionStart = settings.hooks?.SessionStart ?? [];
      const ghHookCount = sessionStart.filter((h: { hooks?: { command?: string }[] }) =>
        h.hooks?.some((hook) => hook.command?.includes('ensure-gh-cli')),
      ).length;
      expect(ghHookCount).toBe(1);
    });

    it('--no-gh-cli removes ensure-gh-cli.sh and SessionStart hook', async () => {
      initGitRepo();

      // First setup with gh CLI enabled (default)
      runTbd(['setup', '--auto', '--prefix=test']);
      const scriptPath = join(tempDir, '.claude', 'scripts', 'ensure-gh-cli.sh');
      await expect(access(scriptPath)).resolves.not.toThrow();

      // Now disable
      const result = runTbd(['setup', '--auto', '--no-gh-cli']);
      expect(result.status).toBe(0);

      // Script should be removed
      await expect(access(scriptPath)).rejects.toThrow();

      // Hook should be removed from settings.json
      const settingsPath = join(tempDir, '.claude', 'settings.json');
      const settings = JSON.parse(await readFile(settingsPath, 'utf-8'));
      const sessionStart = settings.hooks?.SessionStart ?? [];
      const hasGhHook = sessionStart.some((h: { hooks?: { command?: string }[] }) =>
        h.hooks?.some((hook) => hook.command?.includes('ensure-gh-cli')),
      );
      expect(hasGhHook).toBe(false);
    });

    it('respects use_gh_cli: false in config', async () => {
      initGitRepo();
      runTbd(['init', '--prefix=test']);

      // Manually set use_gh_cli: false in config
      const configPath = join(tempDir, '.tbd', 'config.yml');
      let configContent = await readFile(configPath, 'utf-8');
      configContent = configContent.replace(/settings:/, 'settings:\n  use_gh_cli: false');
      await writeFile(configPath, configContent);

      // Run setup — should NOT install gh CLI script
      runTbd(['setup', '--auto']);

      const scriptPath = join(tempDir, '.claude', 'scripts', 'ensure-gh-cli.sh');
      await expect(access(scriptPath)).rejects.toThrow();
    });

    it('preserves use_gh_cli: false across setup runs', async () => {
      initGitRepo();

      // Setup with --no-gh-cli
      runTbd(['setup', '--auto', '--prefix=test', '--no-gh-cli']);

      // Verify config has use_gh_cli: false
      const configPath = join(tempDir, '.tbd', 'config.yml');
      const configContent = await readFile(configPath, 'utf-8');
      expect(configContent).toContain('use_gh_cli: false');

      // Run setup again without --no-gh-cli — should preserve false
      runTbd(['setup', '--auto']);

      const configContent2 = await readFile(configPath, 'utf-8');
      expect(configContent2).toContain('use_gh_cli: false');

      // Script should still not exist
      const scriptPath = join(tempDir, '.claude', 'scripts', 'ensure-gh-cli.sh');
      await expect(access(scriptPath)).rejects.toThrow();
    });

    // Longer timeout for Windows where spawning processes is slower
    it('preserves non-gh SessionStart hooks when adding/removing gh hook', async () => {
      initGitRepo();

      // Pre-create settings with a custom SessionStart hook
      const settingsDir = join(tempDir, '.claude');
      await mkdir(settingsDir, { recursive: true });
      await writeFile(
        join(settingsDir, 'settings.json'),
        JSON.stringify(
          {
            hooks: {
              SessionStart: [
                {
                  matcher: '',
                  hooks: [{ type: 'command', command: 'echo custom-hook' }],
                },
              ],
            },
          },
          null,
          2,
        ),
      );

      // Setup should add gh hook alongside custom hook
      runTbd(['init', '--prefix=test']);
      runTbd(['setup', '--auto']);

      const settings1 = JSON.parse(await readFile(join(settingsDir, 'settings.json'), 'utf-8'));
      const sessionStart1 = settings1.hooks?.SessionStart ?? [];
      expect(
        sessionStart1.some((h: { hooks?: { command?: string }[] }) =>
          h.hooks?.some((hook) => hook.command === 'echo custom-hook'),
        ),
      ).toBe(true);
      expect(
        sessionStart1.some((h: { hooks?: { command?: string }[] }) =>
          h.hooks?.some((hook) => hook.command?.includes('ensure-gh-cli')),
        ),
      ).toBe(true);

      // Disable gh CLI — custom hook should remain
      runTbd(['setup', '--auto', '--no-gh-cli']);

      const settings2 = JSON.parse(await readFile(join(settingsDir, 'settings.json'), 'utf-8'));
      const sessionStart2 = settings2.hooks?.SessionStart ?? [];
      expect(
        sessionStart2.some((h: { hooks?: { command?: string }[] }) =>
          h.hooks?.some((hook) => hook.command === 'echo custom-hook'),
        ),
      ).toBe(true);
      expect(
        sessionStart2.some((h: { hooks?: { command?: string }[] }) =>
          h.hooks?.some((hook) => hook.command?.includes('ensure-gh-cli')),
        ),
      ).toBe(false);
    });

    it('installed script matches bundled ensure-gh-cli.sh', async () => {
      initGitRepo();
      runTbd(['setup', '--auto', '--prefix=test']);

      // Read installed script
      const scriptPath = join(tempDir, '.claude', 'scripts', 'ensure-gh-cli.sh');
      const installed = await readFile(scriptPath, 'utf-8');

      // Read bundled source (dev path)
      const bundledPath = join(__dirname, '..', 'docs', 'install', 'ensure-gh-cli.sh');
      const bundled = await readFile(bundledPath, 'utf-8');

      expect(installed).toBe(bundled);
    });
  });
});
