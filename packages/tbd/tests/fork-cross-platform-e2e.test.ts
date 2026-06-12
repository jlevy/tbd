/**
 * Cross-platform e2e for the fork surface, run against the built CLI on every
 * CI OS (unlike the tryscript goldens, which run only where a POSIX shell is
 * available — tryscript executes blocks via the platform shell, cmd on
 * Windows). Pins the Windows-sensitive behaviors: committed manifest paths are
 * POSIX regardless of platform, and fork-dir shadowing serves the forked copy.
 * See tbd-iqm1.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync, spawnSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('fork surface cross-platform e2e', { timeout: 120_000 }, () => {
  let tempDir: string;
  const tbdBin = join(__dirname, '..', 'dist', 'bin.mjs');

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'tbd-fork-xplat-'));
    execSync('git init --initial-branch=main', { cwd: tempDir });
    execSync('git config user.email "test@example.com"', { cwd: tempDir });
    execSync('git config user.name "Test"', { cwd: tempDir });
    execSync('git config commit.gpgsign false', { cwd: tempDir });
    runTbd(['init', '--prefix=fx']);
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  function runTbd(args: string[]): { stdout: string; stderr: string; status: number } {
    const result = spawnSync('node', [tbdBin, ...args], {
      cwd: tempDir,
      encoding: 'utf-8',
      env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' },
      timeout: 60000,
    });
    return {
      stdout: result.stdout || '',
      stderr: result.stderr || '',
      status: result.status ?? 1,
    };
  }

  it('records POSIX manifest paths and serves the forked copy on every platform', async () => {
    const fork = runTbd(['docs', 'fork', 'python-rules']);
    expect(fork.status).toBe(0);
    expect(fork.stdout).toContain('Forked python-rules → docs/tbd/guidelines/python-rules.md');

    // The committed manifest must be platform-independent: forward slashes only.
    const manifest = await readFile(join(tempDir, '.tbd', 'doc-forks', 'forks.yml'), 'utf-8');
    expect(manifest).toContain('path: docs/tbd/guidelines/python-rules.md');
    expect(manifest).not.toContain('\\');

    // Customize the fork; the per-kind reader must serve the forked copy.
    const forkedPath = join(tempDir, 'docs', 'tbd', 'guidelines', 'python-rules.md');
    const content = await readFile(forkedPath, 'utf-8');
    await writeFile(forkedPath, `${content}\nXPLAT-FORK-MARKER\n`);

    const served = runTbd(['guidelines', 'python-rules']);
    expect(served.status).toBe(0);
    expect(served.stdout).toContain('XPLAT-FORK-MARKER');

    const list = runTbd(['docs', 'list', '--kind=guideline']);
    expect(list.status).toBe(0);
    expect(list.stdout).toMatch(/python-rules .*\[forked, customized\]/);
  });

  it('show serves forked copies with a POSIX provenance note; unfork restores upstream', async () => {
    runTbd(['docs', 'fork', 'review-code']);
    const forkedPath = join(tempDir, 'docs', 'tbd', 'shortcuts', 'review-code.md');
    const content = await readFile(forkedPath, 'utf-8');
    await writeFile(forkedPath, `${content}\nXPLAT-SHOW-MARKER\n`);

    const show = runTbd(['docs', 'show', 'review-code']);
    expect(show.status).toBe(0);
    expect(show.stdout).toContain('XPLAT-SHOW-MARKER');
    expect(show.stderr).toContain('(serving forked copy: docs/tbd/shortcuts/review-code.md)');

    const unfork = runTbd(['docs', 'unfork', 'review-code', '--force']);
    expect(unfork.status).toBe(0);

    const after = runTbd(['docs', 'show', 'review-code']);
    expect(after.status).toBe(0);
    expect(after.stdout).not.toContain('XPLAT-SHOW-MARKER');
    expect(after.stderr).not.toContain('serving forked copy');
  });
});
