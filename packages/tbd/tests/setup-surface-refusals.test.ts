/**
 * A refused target fails one setup surface, not the whole run.
 *
 * Only two conditions stop `tbd setup` outright: a surface stamped by a newer
 * tbd, and a policy block this tbd cannot read (overwriting either would destroy
 * data). Everything else - a symlinked `AGENTS.md`, a symlinked `.claude`, a
 * regular file where a directory belongs - is that surface's failure: the
 * remaining surfaces still install, the summary prints, and the exit code is
 * nonzero. The linked cases also assert that nothing outside the project was
 * written, which is the property the target check exists for.
 */

import { spawnSync } from 'node:child_process';
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { subprocessTestTimeout } from './test-helpers.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TBD_BIN = join(__dirname, '..', 'dist', 'bin.mjs');

/** Every surface, so a refusal in one is visibly not a refusal in the others. */
const ALL_SURFACES = 'portable,agents-md,claude,claude-agents,codex,codex-agents';

describe('setup surface refusals', { timeout: subprocessTestTimeout(60_000) }, () => {
  let projectDir: string;
  let outsideDir: string;

  beforeEach(async () => {
    projectDir = await realpath(await mkdtemp(join(tmpdir(), 'tbd-surface-refusal-')));
    outsideDir = await realpath(await mkdtemp(join(tmpdir(), 'tbd-surface-outside-')));
    run(['git', 'init', '--initial-branch=main']);
    run(['git', 'config', 'user.email', 'test@example.com']);
    run(['git', 'config', 'user.name', 'Test']);
  });

  afterEach(async () => {
    for (const dir of [projectDir, outsideDir]) {
      await rm(dir, { recursive: true, force: true });
    }
  });

  function run(command: [string, ...string[]]): void {
    const result = spawnSync(command[0], command.slice(1), { cwd: projectDir, encoding: 'utf-8' });
    expect(result.status, result.stderr).toBe(0);
  }

  function runTbd(args: string[]): { stdout: string; stderr: string; status: number } {
    const result = spawnSync(process.execPath, [TBD_BIN, ...args], {
      cwd: projectDir,
      encoding: 'utf-8',
      env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' },
    });
    return { stdout: result.stdout || '', stderr: result.stderr || '', status: result.status ?? 1 };
  }

  async function exists(path: string): Promise<boolean> {
    try {
      await access(path);
      return true;
    } catch {
      return false;
    }
  }

  it('fails only the agents-md surface when AGENTS.md is a symbolic link', async () => {
    // `git mv AGENTS.md CLAUDE.md && ln -s CLAUDE.md AGENTS.md` is a common layout,
    // and tbd 0.9.0 wrote through it.
    const target = join(projectDir, 'CLAUDE.md');
    const original = '# Project\n\nProject instructions.\n';
    await writeFile(target, original);
    await symlink('CLAUDE.md', join(projectDir, 'AGENTS.md'), 'file');

    const result = runTbd(['setup', '--auto', '--prefix=test', `--surfaces=${ALL_SURFACES}`]);
    const output = result.stdout + result.stderr;

    expect(result.status).not.toBe(0);
    expect(output).toContain('symbolic link');
    // The summary prints and names exactly one failed surface.
    expect(output).toContain('Setup failed for 1 selected integration surface');
    expect(output).toContain('AGENTS.md');
    // Every other surface still ran.
    expect(await exists(join(projectDir, '.agents/skills/tbd/SKILL.md'))).toBe(true);
    expect(await exists(join(projectDir, '.claude/skills/tbd/SKILL.md'))).toBe(true);
    expect(await exists(join(projectDir, '.claude/agents/tbd-fast.md'))).toBe(true);
    expect(await exists(join(projectDir, '.codex/agents/tbd-fast.toml'))).toBe(true);
    // The link's target is untouched: no block was written through the link.
    expect(await readFile(target, 'utf-8')).toBe(original);
  });

  it('writes nothing outside the project when .claude is a symbolic link', async () => {
    await symlink(outsideDir, join(projectDir, '.claude'), 'junction');

    const result = runTbd(['setup', '--auto', '--prefix=test', '--surfaces=claude']);
    const output = result.stdout + result.stderr;

    expect(result.status).not.toBe(0);
    expect(output).toContain('symbolic link');
    // The five files the Claude surface writes (settings, two scripts, the hook
    // script, the skill) must not appear through the link.
    expect(await readdir(outsideDir)).toEqual([]);
  });

  it('reports a symlinked AGENTS.md as a doctor warning with the repair', async () => {
    const init = runTbd(['init', '--prefix=test']);
    expect(init.status, init.stderr).toBe(0);
    const target = join(projectDir, 'CLAUDE.md');
    await writeFile(target, '# Project\n');
    await symlink('CLAUDE.md', join(projectDir, 'AGENTS.md'), 'file');

    const result = runTbd(['doctor', '--json']);
    const report = JSON.parse(result.stdout) as {
      integrationChecks: { name: string; status: string; message?: string; suggestion?: string }[];
    };
    const agentsMd = report.integrationChecks.filter((check) => check.name === 'AGENTS.md');

    expect(agentsMd).toHaveLength(1);
    expect(agentsMd[0]!.status).toBe('warn');
    expect(agentsMd[0]!.message).toContain('symbolic link');
    expect(agentsMd[0]!.suggestion).toContain('regular file');
  });

  it('preserves unrelated Codex commands and mixed hook entries across refreshes', async () => {
    const dir = join(projectDir, '.codex');
    await mkdir(dir);
    const unrelated = { type: 'command', command: 'bash .codex/custom.sh' };
    const wrapped = { type: 'command', command: 'bash .codex/tbd-session.sh && echo custom' };
    await writeFile(
      join(dir, 'hooks.json'),
      JSON.stringify({
        custom: true,
        hooks: {
          SessionStart: [
            {
              matcher: 'custom',
              extra: true,
              hooks: [{ type: 'command', command: 'bash .codex/tbd-session.sh' }, unrelated],
            },
            { hooks: [wrapped] },
          ],
        },
      }),
    );
    for (let runIndex = 0; runIndex < 2; runIndex++) {
      const result = runTbd([
        'setup',
        '--auto',
        '--prefix=test',
        '--surfaces=codex',
        '--no-gh-cli',
      ]);
      expect(result.status, result.stdout + result.stderr).toBe(0);
      const parsed = JSON.parse(await readFile(join(dir, 'hooks.json'), 'utf-8'));
      expect(parsed.custom).toBe(true);
      expect(parsed.hooks.SessionStart).toEqual([
        { matcher: 'custom', extra: true, hooks: [unrelated] },
        { hooks: [wrapped] },
        { matcher: '', hooks: [{ type: 'command', command: 'bash .codex/tbd-session.sh' }] },
      ]);
    }
  });

  it.each([
    'invalid-json',
    'invalid-shape',
    'directory',
    'linked-file',
    'linked-directory',
    'linked-script',
  ])('refuses unsafe Codex %s before writing scripts or hooks', async (fixture) => {
    const dir = join(projectDir, '.codex');
    const sentinel = 'outside contents\n';
    const outside = join(outsideDir, 'target');
    await writeFile(outside, sentinel);
    if (fixture === 'linked-directory') {
      await symlink(outsideDir, dir, 'junction');
    } else {
      await mkdir(dir);
      const hooks = join(dir, 'hooks.json');
      if (fixture === 'directory') {
        await mkdir(hooks);
      } else if (fixture === 'linked-file') {
        await symlink(outside, hooks, 'file');
      } else if (fixture === 'linked-script') {
        await symlink(outside, join(dir, 'tbd-closing-reminder.sh'), 'file');
      } else {
        await writeFile(
          hooks,
          fixture === 'invalid-json' ? '{broken' : '{"hooks":{"SessionStart":null}}',
        );
      }
    }
    const before = await readdir(dir);
    const result = runTbd(['setup', '--auto', '--prefix=test', '--surfaces=codex', '--no-gh-cli']);
    expect(result.status, result.stdout + result.stderr).not.toBe(0);
    expect(await readdir(dir)).toEqual(before);
    expect(await readFile(outside, 'utf-8')).toBe(sentinel);
    if (fixture === 'invalid-json' || fixture === 'invalid-shape') {
      expect(await readFile(join(dir, 'hooks.json'), 'utf-8')).toBe(
        fixture === 'invalid-json' ? '{broken' : '{"hooks":{"SessionStart":null}}',
      );
    }
  });
});
