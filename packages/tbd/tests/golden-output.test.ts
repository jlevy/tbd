/**
 * Golden tests for CLI output formats.
 * These tests verify the exact output format of key CLI commands.
 * Run `pnpm test -- -u` to update snapshots after intentional changes.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir, platform } from 'node:os';
import { join } from 'node:path';
import { execSync, spawnSync } from 'node:child_process';

// Windows process spawning is significantly slower on CI
const isWindows = platform() === 'win32';

describe('golden output tests', { timeout: isWindows ? 60000 : 15000 }, () => {
  let tempDir: string;
  const tbdBin = join(__dirname, '..', 'dist', 'bin.mjs');

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'tbd-golden-test-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  /**
   * Helper to run tbd command.
   */
  function runTbd(
    args: string[],
    cwd = tempDir,
  ): { stdout: string; stderr: string; status: number } {
    const result = spawnSync('node', [tbdBin, ...args], {
      cwd,
      encoding: 'utf-8',
      env: { ...process.env, FORCE_COLOR: '0' },
    });
    return {
      stdout: result.stdout || '',
      stderr: result.stderr || '',
      status: result.status ?? 1,
    };
  }

  /**
   * Initialize git repo and tbd in temp directory.
   */
  function initGitAndTbd(): void {
    execSync('git init --initial-branch=main', { cwd: tempDir });
    execSync('git config user.email "test@example.com"', { cwd: tempDir });
    execSync('git config user.name "Test"', { cwd: tempDir });
    runTbd(['init', '--prefix=test']);
  }

  describe('tbd docs (bare overview)', () => {
    it('shows the managed-docs overview with the three postures', () => {
      initGitAndTbd();
      const result = runTbd(['docs']);

      expect(result.status).toBe(0);
      // The bundled-doc count grows over time; mask it so the golden pins
      // the format, not the inventory size.
      const stdout = result.stdout.replace(/\d+ docs available/, '[N] docs available');
      expect(stdout).toMatchInlineSnapshot(`
        "tbd docs — managed documentation

          [N] docs available in the cache (.tbd/docs/, gitignored); none forked into the repo.
          Guidelines are active from the cache. Three postures, all serving the same docs:

          Hidden (default):  keep the cache as-is — zero repo footprint
          Curated:           tbd docs fork <name> [...]  fork chosen docs into docs/tbd/
          Everything:        tbd docs fork --all         all docs, visible and editable

          Browse / read: tbd docs list / tbd docs show <name>
          Learn more:    tbd docs show tbd-docs   (the manual; alias: tbd docs manual)
        "
      `);
    });
  });

  describe("post-setup What's Next section", () => {
    it("shows What's Next section after fresh setup", () => {
      execSync('git init --initial-branch=main', { cwd: tempDir });
      execSync('git config user.email "test@example.com"', { cwd: tempDir });
      execSync('git config user.name "Test"', { cwd: tempDir });

      const result = runTbd(['setup', '--auto', '--prefix=test']);

      expect(result.status).toBe(0);

      // Verify What's Next section uses "what you can say" framing
      expect(result.stdout).toContain("WHAT'S NEXT");
      expect(result.stdout).toContain('Try saying things like:');
      expect(result.stdout).toContain("There's a bug where");
      expect(result.stdout).toContain("Let's plan a new feature");
      expect(result.stdout).toContain("Let's work on current issues");
      expect(result.stdout).toContain('Commit this code');
      expect(result.stdout).toContain('Review for best practices');
    });
  });

  describe('prime output for uninitialized repo', () => {
    it('shows value proposition and setup instructions', () => {
      // Only init git, not tbd
      execSync('git init --initial-branch=main', { cwd: tempDir });
      execSync('git config user.email "test@example.com"', { cwd: tempDir });
      execSync('git config user.name "Test"', { cwd: tempDir });

      const result = runTbd(['prime']);

      expect(result.status).toBe(0);

      const output = result.stdout;

      // Check for required sections
      expect(output).toContain('NOT INITIALIZED');
      expect(output).toContain('WHAT tbd IS');
      expect(output).toContain('tbd setup --auto --prefix=');

      // Verify the value proposition content is present
      expect(output).toContain('Issue Tracking - Track tasks, bugs, features');
      expect(output).toContain('Coding Guidelines - Best practices');
      expect(output).toContain('Spec-Driven Workflows');
      expect(output).toContain('Convenience Shortcuts');

      // Verify setup instructions
      expect(output).toContain('SETUP');
      expect(output).toContain('tbd setup --auto --prefix=');
      expect(output).toContain('Never guess a prefix');
    });
  });

  describe('generated file markers', () => {
    it('skill file has DO NOT EDIT comment marker', async () => {
      execSync('git init --initial-branch=main', { cwd: tempDir });
      execSync('git config user.email "test@example.com"', { cwd: tempDir });
      execSync('git config user.name "Test"', { cwd: tempDir });

      // Set CLAUDE_CODE env var to trigger Claude detection on CI
      const result = spawnSync('node', [tbdBin, 'setup', '--auto', '--prefix=test'], {
        cwd: tempDir,
        encoding: 'utf-8',
        env: { ...process.env, FORCE_COLOR: '0', CLAUDE_CODE: '1' },
      });
      expect(result.status).toBe(0);

      // Read the installed skill file
      const skillPath = join(tempDir, '.claude', 'skills', 'tbd', 'SKILL.md');
      const skillContent = await readFile(skillPath, 'utf-8');

      // Should have DO NOT EDIT marker at the top
      expect(skillContent).toContain('<!-- DO NOT EDIT');
      expect(skillContent).toContain('Generated by tbd setup');
      expect(skillContent).toContain("Run 'tbd setup' to update");
    });
  });

  describe('tbd shortcut --category', () => {
    it('filters shortcuts by category', () => {
      // Need full setup to install shortcuts
      execSync('git init --initial-branch=main', { cwd: tempDir });
      execSync('git config user.email "test@example.com"', { cwd: tempDir });
      execSync('git config user.name "Test"', { cwd: tempDir });
      runTbd(['setup', '--auto', '--prefix=test']);

      // Planning category should include new-plan-spec
      const planningResult = runTbd(['shortcut', '--list', '--category', 'planning']);
      expect(planningResult.status).toBe(0);
      expect(planningResult.stdout).toContain('new-plan-spec');
      expect(planningResult.stdout).not.toContain('code-review-and-commit');

      // Git category should include code-review-and-commit
      const gitResult = runTbd(['shortcut', '--list', '--category', 'git']);
      expect(gitResult.status).toBe(0);
      expect(gitResult.stdout).toContain('code-review-and-commit');
      expect(gitResult.stdout).not.toContain('new-plan-spec');
    });
  });

  describe('tbd guidelines --category', () => {
    it('filters guidelines by category', () => {
      // Need full setup to install guidelines
      execSync('git init --initial-branch=main', { cwd: tempDir });
      execSync('git config user.email "test@example.com"', { cwd: tempDir });
      execSync('git config user.name "Test"', { cwd: tempDir });
      runTbd(['setup', '--auto', '--prefix=test']);

      // TypeScript category should include typescript-rules
      const tsResult = runTbd(['guidelines', '--list', '--category', 'typescript']);
      expect(tsResult.status).toBe(0);
      expect(tsResult.stdout).toContain('typescript-rules');
      expect(tsResult.stdout).not.toContain('python-rules');

      // Testing category should include tdd guidelines
      const testingResult = runTbd(['guidelines', '--list', '--category', 'testing']);
      expect(testingResult.status).toBe(0);
      expect(testingResult.stdout).toContain('general-tdd-guidelines');
      expect(testingResult.stdout).not.toContain('typescript-rules');
    });
  });

  describe('fresh clone with remote tbd-sync data (tbd-n6ra)', { timeout: 30000 }, () => {
    let bareRepo: string;
    let cloneDir: string;

    beforeEach(async () => {
      // Create a bare repo to act as "remote"
      bareRepo = await mkdtemp(join(tmpdir(), 'tbd-bare-'));
      cloneDir = await mkdtemp(join(tmpdir(), 'tbd-clone-'));
    });

    afterEach(async () => {
      await rm(bareRepo, { recursive: true, force: true });
      await rm(cloneDir, { recursive: true, force: true });
    });

    it('doctor shows remote issue count when local is empty', () => {
      // Step 1: Create bare repo as "remote" with HEAD pointing to main
      execSync('git init --bare', { cwd: bareRepo });
      // Set HEAD to main so clone works (default is master which we don't push)
      execSync('git symbolic-ref HEAD refs/heads/main', { cwd: bareRepo });

      // Step 2: Create origin repo with tbd and issues
      execSync('git init --initial-branch=main', { cwd: tempDir });
      execSync('git config user.email "test@example.com"', { cwd: tempDir });
      execSync('git config user.name "Test"', { cwd: tempDir });
      // Disable GPG signing for tests
      execSync('git config commit.gpgsign false', { cwd: tempDir });
      execSync(`git remote add origin ${bareRepo}`, { cwd: tempDir });

      // Init tbd
      runTbd(['init', '--prefix=test']);

      // Create some test issues
      runTbd(['create', 'Test issue 1', '--type=task']);
      runTbd(['create', 'Test issue 2', '--type=bug']);
      runTbd(['create', 'Test issue 3', '--type=feature']);

      // Commit tbd config files (must track .tbd/config.yml for tbd to work in clone)
      execSync('git add -f .tbd/config.yml .tbd/.gitignore', { cwd: tempDir });
      execSync('git add -A && git commit --no-verify -m "Initial commit"', { cwd: tempDir });
      execSync('git push -u origin main', { cwd: tempDir });

      // Sync tbd to push tbd-sync branch
      const syncResult = runTbd(['sync']);
      expect(syncResult.status).toBe(0);

      // Step 3: Clone to new directory (simulates fresh clone)
      execSync(`git clone ${bareRepo} .`, { cwd: cloneDir });
      execSync('git config user.email "test@example.com"', { cwd: cloneDir });
      execSync('git config user.name "Test"', { cwd: cloneDir });
      // Disable GPG signing in clone
      execSync('git config commit.gpgsign false', { cwd: cloneDir });

      // Step 4: Run doctor WITHOUT sync - should show remote count
      const doctorResult = runTbd(['doctor'], cloneDir);

      // Debug: Print output if test fails
      if (doctorResult.status !== 0) {
        console.log('Doctor stdout:', doctorResult.stdout);
        console.log('Doctor stderr:', doctorResult.stderr);
      }
      expect(doctorResult.status).toBe(0);

      // KEY ASSERTION: Should show remote issue count
      // Before fix: "Total:       0" with no mention of remote
      // After fix: "Total:       0 (3 on remote - run 'tbd sync')"
      expect(doctorResult.stdout).toContain('on remote');
      expect(doctorResult.stdout).toContain("run 'tbd sync'");

      // Step 5: After sync, should show actual count
      const postSyncResult = runTbd(['sync'], cloneDir);
      expect(postSyncResult.status).toBe(0);

      const doctorAfterSync = runTbd(['doctor'], cloneDir);
      expect(doctorAfterSync.status).toBe(0);
      expect(doctorAfterSync.stdout).toContain('Total:       3');
      // Should NOT show "on remote" hint when we have local data
      expect(doctorAfterSync.stdout).not.toContain('on remote');
    });
  });
});
