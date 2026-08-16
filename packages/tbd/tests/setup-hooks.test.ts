/**
 * Tests for tbd setup hooks installation.
 *
 * These tests verify that `tbd setup --auto` correctly installs:
 * 1. .claude/scripts/tbd-session.sh (the install + prime script)
 * 2. Hooks in project .claude/settings.json (SessionStart, PreCompact, PostToolUse)
 * 3. .claude/ directory is created automatically if it doesn't exist
 *
 * All hooks are always project-local — no global ~/.claude/ installation.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  mkdtemp,
  rm,
  mkdir,
  writeFile,
  readFile,
  access,
  realpath,
  stat,
  chmod,
} from 'node:fs/promises';
import { tmpdir, platform } from 'node:os';
import { delimiter, join } from 'node:path';
import { execSync, spawnSync } from 'node:child_process';

// Shell script hooks are Unix-only; skip entire suite on Windows
const describeUnix = platform() === 'win32' ? describe.skip : describe;

describeUnix('setup hooks (project-local)', { timeout: 15000 }, () => {
  let tempDir: string;
  let fakeHome: string;
  let originalHome: string | undefined;
  const tbdBin = join(__dirname, '..', 'dist', 'bin.mjs');

  beforeEach(async () => {
    // Create temp directories for both project and fake HOME
    const rawTempDir = await mkdtemp(join(tmpdir(), 'tbd-hooks-test-'));
    tempDir = await realpath(rawTempDir);

    // Create a fake HOME directory to isolate from real user settings
    fakeHome = join(tempDir, 'fake-home');
    await mkdir(fakeHome, { recursive: true });

    // Create ~/.claude directory to simulate Claude Code being installed
    await mkdir(join(fakeHome, '.claude'), { recursive: true });

    // Save original HOME and set fake HOME
    originalHome = process.env.HOME;
  });

  afterEach(async () => {
    // Restore original HOME
    if (originalHome !== undefined) {
      process.env.HOME = originalHome;
    }
    await rm(tempDir, { recursive: true, force: true });
  });

  /**
   * Helper to run tbd command with mocked HOME.
   */
  function runTbd(args: string[], cwd: string): { stdout: string; stderr: string; status: number } {
    const result = spawnSync('node', [tbdBin, ...args], {
      cwd,
      encoding: 'utf-8',
      env: {
        ...process.env,
        HOME: fakeHome,
        USERPROFILE: fakeHome, // Windows equivalent of HOME
        FORCE_COLOR: '0',
      },
    });
    return {
      stdout: result.stdout || '',
      stderr: result.stderr || '',
      status: result.status ?? 1,
    };
  }

  /**
   * Initialize git repo in a directory.
   */
  function initGitRepo(dir: string): void {
    execSync('git init --initial-branch=main', { cwd: dir });
    execSync('git config user.email "test@example.com"', { cwd: dir });
    execSync('git config user.name "Test"', { cwd: dir });
  }

  describe('tbd-session.sh script installation', () => {
    it('creates .claude/scripts/tbd-session.sh in project', async () => {
      const projectDir = join(tempDir, 'project');
      await mkdir(projectDir, { recursive: true });
      initGitRepo(projectDir);

      const result = runTbd(['setup', '--auto', '--prefix=test'], projectDir);

      expect(result.status).toBe(0);

      // Verify the script was created in the project
      const scriptPath = join(projectDir, '.claude', 'scripts', 'tbd-session.sh');
      await expect(access(scriptPath)).resolves.not.toThrow();
    });

    it('makes tbd-session.sh executable', async () => {
      const projectDir = join(tempDir, 'project');
      await mkdir(projectDir, { recursive: true });
      initGitRepo(projectDir);

      runTbd(['setup', '--auto', '--prefix=test'], projectDir);

      const scriptPath = join(projectDir, '.claude', 'scripts', 'tbd-session.sh');
      const stats = await stat(scriptPath);

      // Check executable bit (0o755 = rwxr-xr-x)
      expect(stats.mode & 0o111).toBeGreaterThan(0);
    });

    it('tbd-session.sh contains tbd install logic', async () => {
      const projectDir = join(tempDir, 'project');
      await mkdir(projectDir, { recursive: true });
      initGitRepo(projectDir);

      runTbd(['setup', '--auto', '--prefix=test'], projectDir);

      const scriptPath = join(projectDir, '.claude', 'scripts', 'tbd-session.sh');
      const content = await readFile(scriptPath, 'utf-8');

      // Verify key parts of the script: format-compatible local-first, then an exact
      // npx fallback read from repository config. Release numbers must not be copied
      // into every generated script on routine patch upgrades.
      expect(content).toContain('#!/bin/bash');
      expect(content).toContain('command -v tbd');
      expect(content).toContain('tbd config get tbd_format');
      expect(content).toContain('tbd_configured_fallback_version');
      expect(content).toContain('npx --yes "get-tbd@$configured_fallback_version"');
      expect(content).toContain('tbd prime');
      expect(content).not.toMatch(/get-tbd@\d+\.\d+\.\d+/u);
      // Must not use an unpinned runner.
      expect(content).not.toContain('npx get-tbd prime');
    });

    it('uses the configured fallback only when the local CLI cannot read the format', async () => {
      const projectDir = join(tempDir, 'project');
      await mkdir(projectDir, { recursive: true });
      initGitRepo(projectDir);
      expect(runTbd(['setup', '--auto', '--prefix=test'], projectDir).status).toBe(0);

      const scriptPath = join(projectDir, '.claude', 'scripts', 'tbd-session.sh');
      const scriptBeforePinChange = await readFile(scriptPath, 'utf-8');
      const configPath = join(projectDir, '.tbd', 'config.yml');
      const config = (await readFile(configPath, 'utf-8')).replace(
        /^tbd_fallback_version:.*$/mu,
        'tbd_fallback_version: 9.8.7-beta.2',
      );
      await writeFile(configPath, config);
      expect(await readFile(scriptPath, 'utf-8')).toBe(scriptBeforePinChange);
      const configuredVersion = /^tbd_fallback_version:\s*(\S+)$/mu.exec(config)?.[1];
      expect(configuredVersion).toBeDefined();

      // The generated hook deliberately prepends common user-local bin directories.
      // Put the fakes in the first such directory so a runner-level /usr/local/bin/npx
      // cannot shadow them on Linux.
      const fakeBin = join(fakeHome, '.local', 'bin');
      const runnerLog = join(tempDir, 'runner.log');
      await mkdir(fakeBin, { recursive: true });
      await writeFile(
        join(fakeBin, 'tbd'),
        '#!/bin/bash\n' +
          'if [ "$1 $2 $3" = "config get tbd_format" ]; then\n' +
          '  if [ "$FAKE_TBD_CAN_READ" = "true" ]; then printf "f07\\n"; exit 0; fi\n' +
          '  exit 1\n' +
          'fi\n' +
          'printf "tbd %s\\n" "$*" >> "$TBD_RUNNER_LOG"\n',
      );
      await writeFile(
        join(fakeBin, 'npx'),
        '#!/bin/bash\nprintf "npx %s\\n" "$*" >> "$TBD_RUNNER_LOG"\n',
      );
      await chmod(join(fakeBin, 'tbd'), 0o755);
      await chmod(join(fakeBin, 'npx'), 0o755);

      const cases = [
        {
          name: 'format-compatible local CLI',
          // Two local invocations: the agent-id mint, then the briefing. The mint runs
          // first so `tbd start` has an identity to claim under, and is idempotent
          // because SessionStart fires again on resume, clear, and compact.
          canRead: true,
          expected: 'tbd whoami --ensure-id --quiet\ntbd prime --brief',
          fallback: false,
        },
        {
          name: 'format-incompatible local CLI',
          // No mint here: the local CLI cannot read this repository at all, so the only
          // thing that runs is the pinned fallback.
          canRead: false,
          expected: `npx --yes get-tbd@${configuredVersion} prime --brief`,
          fallback: true,
        },
      ];

      for (const testCase of cases) {
        await writeFile(runnerLog, '');
        const result = spawnSync('bash', [scriptPath, '--brief'], {
          cwd: projectDir,
          encoding: 'utf-8',
          env: {
            ...process.env,
            HOME: fakeHome,
            PATH: `${fakeBin}${delimiter}${process.env.PATH ?? ''}`,
            FAKE_TBD_CAN_READ: String(testCase.canRead),
            TBD_RUNNER_LOG: runnerLog,
          },
        });

        expect(result.status, `${testCase.name}: ${result.stderr}`).toBe(0);
        expect((await readFile(runnerLog, 'utf-8')).trim()).toBe(testCase.expected);
        if (testCase.fallback) {
          expect(result.stderr).toContain('cannot read this repository format');
        } else {
          expect(result.stderr).not.toContain('cannot read this repository format');
        }
      }
    });

    it('rejects an invalid configured fallback without invoking npx', async () => {
      const projectDir = join(tempDir, 'project');
      await mkdir(projectDir, { recursive: true });
      initGitRepo(projectDir);
      expect(runTbd(['setup', '--auto', '--prefix=test'], projectDir).status).toBe(0);

      const configPath = join(projectDir, '.tbd', 'config.yml');
      await writeFile(
        configPath,
        (await readFile(configPath, 'utf-8')).replace(
          /^tbd_fallback_version:.*$/mu,
          'tbd_fallback_version: 0.6.3; touch SHOULD_NOT_RUN',
        ),
      );

      const fakeBin = join(fakeHome, '.local', 'bin');
      const runnerLog = join(tempDir, 'invalid-pin-runner.log');
      await mkdir(fakeBin, { recursive: true });
      await writeFile(
        join(fakeBin, 'tbd'),
        '#!/bin/bash\nif [ "$1 $2 $3" = "config get tbd_format" ]; then exit 1; fi\n',
      );
      await writeFile(
        join(fakeBin, 'npx'),
        '#!/bin/bash\nprintf "npx %s\\n" "$*" >> "$TBD_RUNNER_LOG"\n',
      );
      await chmod(join(fakeBin, 'tbd'), 0o755);
      await chmod(join(fakeBin, 'npx'), 0o755);

      const result = spawnSync('bash', [join(projectDir, '.claude', 'scripts', 'tbd-session.sh')], {
        cwd: projectDir,
        encoding: 'utf-8',
        env: {
          ...process.env,
          HOME: fakeHome,
          PATH: `${fakeBin}${delimiter}${process.env.PATH ?? ''}`,
          TBD_RUNNER_LOG: runnerLog,
        },
      });

      expect(result.status).toBe(1);
      expect(result.stderr).toContain('valid exact tbd_fallback_version');
      await expect(access(runnerLog)).rejects.toThrow();
      await expect(access(join(projectDir, 'SHOULD_NOT_RUN'))).rejects.toThrow();

      // The recovery instruction must be truthful: setup reads the inert string,
      // replaces it with its own package pin, and never evaluates the payload.
      const repair = runTbd(['setup', '--auto'], projectDir);
      expect(repair.status, repair.stderr).toBe(0);
      expect(await readFile(configPath, 'utf-8')).toMatch(
        /^tbd_fallback_version:\s*\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/mu,
      );
      await expect(access(join(projectDir, 'SHOULD_NOT_RUN'))).rejects.toThrow();
    });
  });

  describe('project .claude/settings.json hooks', () => {
    it('adds SessionStart hook with project-relative path', async () => {
      const projectDir = join(tempDir, 'project');
      await mkdir(projectDir, { recursive: true });
      initGitRepo(projectDir);

      const result = runTbd(['setup', '--auto', '--prefix=test'], projectDir);

      expect(result.status).toBe(0);

      // Verify project settings has SessionStart hook
      const settingsPath = join(projectDir, '.claude', 'settings.json');
      const content = await readFile(settingsPath, 'utf-8');
      const settings = JSON.parse(content);

      expect(settings.hooks).toBeDefined();
      expect(settings.hooks.SessionStart).toBeDefined();
      expect(settings.hooks.SessionStart).toBeInstanceOf(Array);

      // Should have tbd-session.sh in SessionStart with project-relative path
      const sessionHook = settings.hooks.SessionStart.find(
        (entry: { hooks?: { command?: string }[] }) =>
          entry.hooks?.some((h) => h.command?.includes('tbd-session.sh')),
      );
      expect(sessionHook).toBeDefined();
      expect(sessionHook.hooks[0].command).toBe('bash .claude/scripts/tbd-session.sh');
      expect(sessionHook.hooks[0].command).not.toContain('$HOME');
    });

    it('adds PreCompact hook with project-relative path', async () => {
      const projectDir = join(tempDir, 'project');
      await mkdir(projectDir, { recursive: true });
      initGitRepo(projectDir);

      runTbd(['setup', '--auto', '--prefix=test'], projectDir);

      const settingsPath = join(projectDir, '.claude', 'settings.json');
      const content = await readFile(settingsPath, 'utf-8');
      const settings = JSON.parse(content);

      expect(settings.hooks.PreCompact).toBeDefined();
      expect(settings.hooks.PreCompact).toBeInstanceOf(Array);

      // Should have tbd-session.sh --brief with project-relative path
      const preCompactHook = settings.hooks.PreCompact.find(
        (entry: { hooks?: { command?: string }[] }) =>
          entry.hooks?.some((h) => h.command?.includes('tbd-session.sh')),
      );
      expect(preCompactHook).toBeDefined();
      expect(preCompactHook.hooks[0].command).toBe('bash .claude/scripts/tbd-session.sh --brief');
      expect(preCompactHook.hooks[0].command).not.toContain('$HOME');
    });

    it('merges with existing project hooks without overwriting', async () => {
      const projectDir = join(tempDir, 'project');
      await mkdir(projectDir, { recursive: true });
      initGitRepo(projectDir);

      // Pre-populate project settings with existing hooks
      await mkdir(join(projectDir, '.claude'), { recursive: true });
      const settingsPath = join(projectDir, '.claude', 'settings.json');
      await writeFile(
        settingsPath,
        JSON.stringify(
          {
            hooks: {
              SessionStart: [
                {
                  matcher: '',
                  hooks: [{ type: 'command', command: 'echo "existing hook"' }],
                },
              ],
              Stop: [
                {
                  matcher: '',
                  hooks: [{ type: 'command', command: 'echo "stop hook"' }],
                },
              ],
            },
            permissions: { allow: ['Skill'] },
          },
          null,
          2,
        ),
      );

      runTbd(['setup', '--auto', '--prefix=test'], projectDir);

      const content = await readFile(settingsPath, 'utf-8');
      const settings = JSON.parse(content);

      // Existing Stop hook should still be there
      expect(settings.hooks.Stop).toBeDefined();
      expect(settings.hooks.Stop[0].hooks[0].command).toContain('stop hook');

      // Existing permissions should still be there
      expect(settings.permissions).toBeDefined();
      expect(settings.permissions.allow).toContain('Skill');

      // Existing non-tbd SessionStart hook should still be there
      const existingHook = settings.hooks.SessionStart.find(
        (entry: { hooks?: { command?: string }[] }) =>
          entry.hooks?.some((h) => h.command?.includes('existing hook')),
      );
      expect(existingHook).toBeDefined();

      // New tbd hooks should be added
      const hasNewSessionHook = settings.hooks.SessionStart.some(
        (entry: { hooks?: { command?: string }[] }) =>
          entry.hooks?.some((h) => h.command?.includes('tbd-session.sh')),
      );
      expect(hasNewSessionHook).toBe(true);
    });

    it('does not install hooks to global ~/.claude/settings.json', async () => {
      const projectDir = join(tempDir, 'project');
      await mkdir(projectDir, { recursive: true });
      initGitRepo(projectDir);

      runTbd(['setup', '--auto', '--prefix=test'], projectDir);

      // Global settings should NOT have tbd hooks
      const globalSettingsPath = join(fakeHome, '.claude', 'settings.json');
      try {
        const content = await readFile(globalSettingsPath, 'utf-8');
        const settings = JSON.parse(content);
        // If the file exists, it should not have tbd session hooks
        const hasTbdHook = settings.hooks?.SessionStart?.some(
          (entry: { hooks?: { command?: string }[] }) =>
            entry.hooks?.some((h) => h.command?.includes('tbd-session.sh')),
        );
        expect(hasTbdHook).toBeFalsy();
      } catch {
        // File doesn't exist — that's fine, no global hooks installed
      }
    });
  });

  describe('.claude/ directory auto-creation', () => {
    it('creates .claude/ directory if it does not exist', async () => {
      const projectDir = join(tempDir, 'project');
      await mkdir(projectDir, { recursive: true });
      initGitRepo(projectDir);

      // Do NOT pre-create .claude/ — setup should create it
      const result = runTbd(['setup', '--auto', '--prefix=test'], projectDir);

      expect(result.status).toBe(0);

      // .claude/ directory should have been created
      await expect(access(join(projectDir, '.claude'))).resolves.not.toThrow();

      // Hooks should be in project .claude/settings.json
      const settingsPath = join(projectDir, '.claude', 'settings.json');
      const content = await readFile(settingsPath, 'utf-8');
      const settings = JSON.parse(content);

      const hasSessionHook = settings.hooks?.SessionStart?.some(
        (entry: { hooks?: { command?: string }[] }) =>
          entry.hooks?.some((h) => h.command?.includes('tbd-session.sh')),
      );
      expect(hasSessionHook).toBe(true);

      // Script should also be in project
      const scriptPath = join(projectDir, '.claude', 'scripts', 'tbd-session.sh');
      await expect(access(scriptPath)).resolves.not.toThrow();
    });
  });

  describe('subdirectory handling (git root resolution)', () => {
    it('creates .claude/ at git root when run from a subdirectory', async () => {
      const projectDir = join(tempDir, 'project');
      await mkdir(projectDir, { recursive: true });
      initGitRepo(projectDir);

      // Create a subdirectory to run setup from
      const subDir = join(projectDir, 'src', 'deep');
      await mkdir(subDir, { recursive: true });

      const result = runTbd(['setup', '--auto', '--prefix=test'], subDir);

      expect(result.status).toBe(0);

      // .claude/ should be at the git root, NOT in the subdirectory
      const rootSettingsPath = join(projectDir, '.claude', 'settings.json');
      await expect(access(rootSettingsPath)).resolves.not.toThrow();

      const content = await readFile(rootSettingsPath, 'utf-8');
      const settings = JSON.parse(content);
      const hasSessionHook = settings.hooks?.SessionStart?.some(
        (entry: { hooks?: { command?: string }[] }) =>
          entry.hooks?.some((h) => h.command?.includes('tbd-session.sh')),
      );
      expect(hasSessionHook).toBe(true);

      // Script should be at git root too
      const scriptPath = join(projectDir, '.claude', 'scripts', 'tbd-session.sh');
      await expect(access(scriptPath)).resolves.not.toThrow();

      // .claude/ should NOT exist in the subdirectory
      try {
        await access(join(subDir, '.claude'));
        // If we get here, .claude/ exists in subdirectory — that's a bug
        expect.fail('.claude/ should not exist in subdirectory');
      } catch {
        // Expected: .claude/ does not exist in subdirectory
      }
    });

    it('creates .tbd/ at git root when run from a subdirectory', async () => {
      const projectDir = join(tempDir, 'project');
      await mkdir(projectDir, { recursive: true });
      initGitRepo(projectDir);

      const subDir = join(projectDir, 'packages', 'lib');
      await mkdir(subDir, { recursive: true });

      const result = runTbd(['setup', '--auto', '--prefix=test'], subDir);

      expect(result.status).toBe(0);

      // .tbd/ should be at the git root
      await expect(access(join(projectDir, '.tbd'))).resolves.not.toThrow();

      // .tbd/ should NOT be in the subdirectory
      try {
        await access(join(subDir, '.tbd'));
        expect.fail('.tbd/ should not exist in subdirectory');
      } catch {
        // Expected
      }
    });
  });

  describe('idempotency', () => {
    it('running setup twice does not duplicate hooks', async () => {
      const projectDir = join(tempDir, 'project');
      await mkdir(projectDir, { recursive: true });
      initGitRepo(projectDir);

      // Run setup twice
      const first = runTbd(['setup', '--auto', '--prefix=test'], projectDir);
      const second = runTbd(['setup', '--auto'], projectDir);

      expect(first.status).toBe(0);
      expect(second.status).toBe(0);
      expect(second.stdout + second.stderr).not.toContain('Cleaned up legacy');

      const settingsPath = join(projectDir, '.claude', 'settings.json');
      const content = await readFile(settingsPath, 'utf-8');
      const settings = JSON.parse(content);

      // Count tbd-session.sh hooks in SessionStart
      const tbdHookCount = settings.hooks.SessionStart.filter(
        (entry: { hooks?: { command?: string }[] }) =>
          entry.hooks?.some((h) => h.command?.includes('tbd-session.sh')),
      ).length;

      expect(tbdHookCount).toBe(1);
    });
  });

  describe('dry-run does not mutate state (issue #126)', () => {
    it('setup --auto --dry-run leaves .claude/settings.json byte-for-byte unchanged', async () => {
      const projectDir = join(tempDir, 'project');
      await mkdir(projectDir, { recursive: true });
      initGitRepo(projectDir);

      // First do a real setup so there are installed tbd hooks present. The
      // legacy-cleanup path historically rewrote settings.json even under
      // --dry-run, which is exactly the regression this guards.
      const first = runTbd(['setup', '--auto', '--prefix=test'], projectDir);
      expect(first.status).toBe(0);

      const settingsPath = join(projectDir, '.claude', 'settings.json');
      const before = await readFile(settingsPath, 'utf-8');

      // Now a dry-run. It must not touch the file at all.
      const dry = runTbd(['setup', '--auto', '--dry-run'], projectDir);
      expect(dry.status).toBe(0);

      const after = await readFile(settingsPath, 'utf-8');
      expect(after).toBe(before);
    });

    it('setup --auto --dry-run does not remove legacy scripts/hooks from disk', async () => {
      const projectDir = join(tempDir, 'project');
      await mkdir(projectDir, { recursive: true });
      initGitRepo(projectDir);

      // Plant a legacy script and a legacy-pattern hook that real setup would clean up.
      const scriptsDir = join(projectDir, '.claude', 'scripts');
      await mkdir(scriptsDir, { recursive: true });
      const legacyScriptPath = join(scriptsDir, 'ensure-tbd-cli.sh');
      await writeFile(legacyScriptPath, '#!/bin/bash\necho legacy\n');

      const settingsPath = join(projectDir, '.claude', 'settings.json');
      await writeFile(
        settingsPath,
        JSON.stringify(
          {
            hooks: {
              SessionStart: [
                {
                  matcher: '',
                  hooks: [{ type: 'command', command: 'bash .claude/scripts/ensure-tbd-cli.sh' }],
                },
              ],
            },
          },
          null,
          2,
        ) + '\n',
      );

      const settingsBefore = await readFile(settingsPath, 'utf-8');

      const dry = runTbd(['setup', '--auto', '--dry-run', '--prefix=test'], projectDir);
      expect(dry.status).toBe(0);

      // The legacy script must still exist and settings must be unchanged.
      await expect(access(legacyScriptPath)).resolves.not.toThrow();
      const settingsAfter = await readFile(settingsPath, 'utf-8');
      expect(settingsAfter).toBe(settingsBefore);

      // And the output should phrase the cleanup as hypothetical, not done.
      const out = dry.stdout + dry.stderr;
      expect(out).not.toContain('Cleaned up legacy');
      expect(out).toMatch(/\[DRY-RUN\].*[Ww]ould clean up legacy/);
    });
  });

  describe('script refresh on setup', () => {
    it('tbd setup --auto refreshes tbd-session.sh with latest content', async () => {
      const projectDir = join(tempDir, 'project');
      await mkdir(projectDir, { recursive: true });
      initGitRepo(projectDir);

      // Initial setup
      runTbd(['setup', '--auto', '--prefix=test'], projectDir);

      const scriptPath = join(projectDir, '.claude', 'scripts', 'tbd-session.sh');

      // Manually modify the script to simulate an outdated version
      const outdatedContent = `#!/bin/bash
# Old/stale version of the script
echo "This is outdated"
`;
      await writeFile(scriptPath, outdatedContent);

      // Verify the modification took effect
      const staleContent = await readFile(scriptPath, 'utf-8');
      expect(staleContent).toContain('This is outdated');

      // Run setup again - should refresh the script
      const result = runTbd(['setup', '--auto'], projectDir);
      expect(result.status).toBe(0);

      // Script should be refreshed with latest content
      const refreshedContent = await readFile(scriptPath, 'utf-8');
      expect(refreshedContent).not.toContain('This is outdated');
      expect(refreshedContent).toContain('command -v tbd');
      expect(refreshedContent).toContain('npx --yes "get-tbd@$configured_fallback_version"');
      expect(refreshedContent).toContain('tbd prime');
    });

    it('reads the exact npx fallback from config without embedding a release', async () => {
      const projectDir = join(tempDir, 'project');
      await mkdir(projectDir, { recursive: true });
      initGitRepo(projectDir);

      runTbd(['setup', '--auto', '--prefix=test'], projectDir);

      const scriptPath = join(projectDir, '.claude', 'scripts', 'tbd-session.sh');
      const content = await readFile(scriptPath, 'utf-8');

      expect(content).toContain('tbd_configured_fallback_version');
      expect(content).toContain('npx --yes "get-tbd@$configured_fallback_version"');
      expect(content).not.toMatch(/get-tbd@\d+\.\d+\.\d+/u);
    });

    it('refreshed script preserves executable permissions', async () => {
      const projectDir = join(tempDir, 'project');
      await mkdir(projectDir, { recursive: true });
      initGitRepo(projectDir);

      // Initial setup
      runTbd(['setup', '--auto', '--prefix=test'], projectDir);

      const scriptPath = join(projectDir, '.claude', 'scripts', 'tbd-session.sh');

      // Remove executable permissions to simulate corruption
      const { chmod: chmodSync } = await import('node:fs/promises');
      await chmodSync(scriptPath, 0o644);

      // Verify permissions were removed
      let stats = await stat(scriptPath);
      expect(stats.mode & 0o111).toBe(0);

      // Re-run setup
      runTbd(['setup', '--auto'], projectDir);

      // Permissions should be restored
      stats = await stat(scriptPath);
      expect(stats.mode & 0o111).toBeGreaterThan(0);
    });
  });
});
