/**
 * E2e tests for the `tbd doctor` "Forked docs" check group (forkable-docs spec
 * Phase 2, tbd-5xt0), run against the built CLI in a temp repo. Pins the
 * contract lines from plan-2026-06-11-forkable-docs.md §`tbd doctor`: the
 * healthy ✓ headline, the missing-file ⚠ + `--fix` finalize-unfork flow,
 * conflict-marker detection, reserved `tbd-` names, base snapshot integrity,
 * the gitignored fork dir, corrupt-manifest reporting — and zero-fork silence
 * (doctor output for non-fork users must not grow).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile, writeFile, appendFile, mkdir, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync, spawnSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('doctor fork checks e2e', { timeout: 120_000 }, () => {
  let tempDir: string;
  const tbdBin = join(__dirname, '..', 'dist', 'bin.mjs');

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'tbd-doctor-fork-'));
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

  async function exists(path: string): Promise<boolean> {
    try {
      await stat(path);
      return true;
    } catch {
      return false;
    }
  }

  it('zero forks: doctor prints no fork lines at all', () => {
    const doctor = runTbd(['doctor']);
    expect(doctor.status).toBe(0);
    expect(doctor.stdout).not.toContain('Forked docs');
    expect(doctor.stdout).not.toContain('Fork dir');
    expect(doctor.stdout).not.toContain('Reserved tbd- names');
  });

  it('healthy forks: exactly one ✓ headline plus the fork-dir ✓ line', () => {
    expect(runTbd(['docs', 'fork', 'python-rules', 'review-code']).status).toBe(0);

    const doctor = runTbd(['doctor']);
    expect(doctor.status).toBe(0);
    expect(doctor.stdout).toContain('✓ Forked docs - 2 forked, base snapshots intact');
    expect(doctor.stdout).toContain('✓ Fork dir - docs/tbd/ tracked in git (not gitignored)');
    expect(doctor.stdout.match(/Forked docs/g)).toHaveLength(1);
    expect(doctor.stdout).not.toContain('Reserved tbd- names');
  });

  it('deleted forked file: ⚠ then --fix finalizes the unfork', async () => {
    expect(runTbd(['docs', 'fork', 'review-code']).status).toBe(0);
    await rm(join(tempDir, 'docs', 'tbd', 'shortcuts', 'review-code.md'));

    const doctor = runTbd(['doctor']);
    expect(doctor.status).toBe(0);
    expect(doctor.stdout).toContain(
      '⚠ Forked docs - 1 missing (review-code: forked file deleted) [fixable]',
    );
    expect(doctor.stdout).toContain(
      'Run: tbd doctor --fix to finalize the unfork, or tbd docs fork <name> --force to restore',
    );

    const fixed = runTbd(['doctor', '--fix']);
    expect(fixed.status).toBe(0);
    expect(fixed.stdout).toContain('⚠ Forked docs - 1 missing (review-code: forked file deleted)');
    expect(fixed.stdout).toContain(
      'Fixed: finalized unfork (removed manifest entry + base); now served from upstream',
    );

    // Manifest entry and base snapshot are gone.
    const manifest = await readFile(join(tempDir, '.tbd', 'doc-forks', 'forks.yml'), 'utf-8');
    expect(manifest).not.toContain('review-code');
    expect(
      await exists(join(tempDir, '.tbd', 'doc-forks', 'base', 'shortcut', 'review-code.md')),
    ).toBe(false);

    // Doc is served from upstream again (no provenance note on stderr).
    const show = runTbd(['docs', 'show', 'review-code']);
    expect(show.status).toBe(0);
    expect(show.stdout.length).toBeGreaterThan(0);
    expect(show.stderr).not.toContain('serving forked copy');

    // With the last fork finalized the fork dir is pruned — doctor goes silent.
    const after = runTbd(['doctor']);
    expect(after.status).toBe(0);
    expect(after.stdout).not.toContain('Forked docs');
  });

  it('orphaned entry (upstream doc gone): ⚠ then --fix removes the entry, keeps the file', async () => {
    expect(runTbd(['docs', 'fork', 'python-rules']).status).toBe(0);
    await rm(join(tempDir, '.tbd', 'docs', 'guidelines', 'python-rules.md'));

    const doctor = runTbd(['doctor']);
    expect(doctor.status).toBe(0);
    expect(doctor.stdout).toContain(
      '⚠ Forked docs - 1 orphaned (python-rules: upstream doc no longer exists) [fixable]',
    );

    const fixed = runTbd(['doctor', '--fix']);
    expect(fixed.status).toBe(0);
    expect(fixed.stdout).toContain(
      'Fixed: removed orphaned manifest entry + base; file kept as a local doc',
    );
    const manifest = await readFile(join(tempDir, '.tbd', 'doc-forks', 'forks.yml'), 'utf-8');
    expect(manifest).not.toContain('python-rules');
    expect(await exists(join(tempDir, 'docs', 'tbd', 'guidelines', 'python-rules.md'))).toBe(true);
  });

  it('unresolved conflict markers in a forked file: ⚠ with the update remediation', async () => {
    expect(runTbd(['docs', 'fork', 'python-rules']).status).toBe(0);
    const forkedPath = join(tempDir, 'docs', 'tbd', 'guidelines', 'python-rules.md');
    const content = await readFile(forkedPath, 'utf-8');
    // tbd's own merge-conflict labels — detection keys off these, not generic markers.
    await writeFile(
      forkedPath,
      `${content}\n<<<<<<< ours (your fork)\nmine\n=======\ntheirs\n>>>>>>> theirs (upstream)\n`,
    );

    const doctor = runTbd(['doctor']);
    expect(doctor.status).toBe(0);
    expect(doctor.stdout).toContain('⚠ Forked docs - 1 unresolved merge conflict (python-rules)');
    expect(doctor.stdout).toContain(
      'Run: resolve the conflict markers, then re-run tbd docs update',
    );
  });

  it('reserved tbd-* stray file warns, even with zero forks', async () => {
    await mkdir(join(tempDir, 'docs', 'tbd', 'references'), { recursive: true });
    await writeFile(
      join(tempDir, 'docs', 'tbd', 'references', 'tbd-myhack.md'),
      '# Hand-authored, claims the reserved prefix\n',
    );

    const doctor = runTbd(['doctor']);
    expect(doctor.status).toBe(0);
    expect(doctor.stdout).toContain(
      '⚠ Reserved tbd- names - 1 user doc claims the reserved tbd- prefix',
    );
    expect(doctor.stdout).toContain('docs/tbd/references/tbd-myhack.md');
    // No manifest entries, so no Forked docs headline and no fork-dir line.
    expect(doctor.stdout).not.toContain('Forked docs');
    expect(doctor.stdout).not.toContain('Fork dir');
  });

  it('base snapshot hash mismatch: ⚠ with re-fork/unfork remediation (no auto-fix)', async () => {
    expect(runTbd(['docs', 'fork', 'python-rules']).status).toBe(0);
    await appendFile(
      join(tempDir, '.tbd', 'doc-forks', 'base', 'guideline', 'python-rules.md'),
      '\ntampered\n',
    );

    const doctor = runTbd(['doctor']);
    expect(doctor.status).toBe(0);
    expect(doctor.stdout).toContain(
      '⚠ Forked docs - 1 base snapshot problem (python-rules: hash mismatch)',
    );
    expect(doctor.stdout).toContain(
      'Run: tbd docs fork <name> --force to re-fork, or tbd docs unfork <name>',
    );

    // --fix must not touch it (re-fork vs unfork is the user's call).
    const fixed = runTbd(['doctor', '--fix']);
    expect(fixed.stdout).toContain('1 base snapshot problem (python-rules: hash mismatch)');
  });

  it('gitignored fork dir warns when forks exist', async () => {
    expect(runTbd(['docs', 'fork', 'python-rules']).status).toBe(0);
    await writeFile(join(tempDir, '.gitignore'), 'docs/tbd/\n');

    const doctor = runTbd(['doctor']);
    expect(doctor.status).toBe(0);
    expect(doctor.stdout).toContain(
      '⚠ Fork dir - docs/tbd/ is gitignored — forked docs will not be committed',
    );
    expect(doctor.stdout).not.toContain('tracked in git (not gitignored)');
  });

  it('totally unparseable forks.yml is reported, not crashed on', async () => {
    expect(runTbd(['docs', 'fork', 'python-rules']).status).toBe(0);
    await writeFile(join(tempDir, '.tbd', 'doc-forks', 'forks.yml'), '{{{{not yaml: [\n');

    const doctor = runTbd(['doctor']);
    expect(doctor.status).toBe(0);
    expect(doctor.stdout).toContain('⚠ Forked docs - fork manifest unreadable:');
    expect(doctor.stdout).toContain('(.tbd/doc-forks/forks.yml)');
    expect(doctor.stdout).toContain(
      'Fix or delete .tbd/doc-forks/forks.yml (forked files stay in place), then re-run tbd doctor',
    );
  });
});
