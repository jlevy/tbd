/**
 * Setup and doctor treat an equivalent spelling of a generated hook command as tbd's
 * own wiring: a command that runs the same tbd script with the same arguments and only
 * locates the project root differently (`"$CLAUDE_PROJECT_DIR"`, `git rev-parse`).
 * Setup keeps such a command as written, never adds a duplicate beside it, and reports
 * it; doctor reports the surface as current.
 */

import { execSync, spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { subprocessTestTimeout } from './test-helpers.js';

const tbdBin = join(__dirname, '..', 'dist', 'bin.mjs');

const GIT_ROOT = '$(git rev-parse --show-toplevel)';

/** fsqlite's validated Claude wiring: every script resolved through CLAUDE_PROJECT_DIR. */
const CUSTOMIZED_CLAUDE_SETTINGS = {
  hooks: {
    SessionStart: [
      {
        matcher: '',
        hooks: [
          { type: 'command', command: 'bash "$CLAUDE_PROJECT_DIR"/.claude/scripts/tbd-session.sh' },
        ],
      },
      {
        matcher: '',
        hooks: [
          {
            type: 'command',
            command: 'bash "$CLAUDE_PROJECT_DIR"/.claude/scripts/ensure-gh-cli.sh',
            timeout: 120,
          },
        ],
      },
    ],
    PreCompact: [
      {
        matcher: '',
        hooks: [
          {
            type: 'command',
            command: 'bash "$CLAUDE_PROJECT_DIR"/.claude/scripts/tbd-session.sh --brief',
          },
        ],
      },
    ],
    PostToolUse: [
      {
        matcher: 'Bash',
        hooks: [
          {
            type: 'command',
            command: 'bash "$CLAUDE_PROJECT_DIR/.claude/hooks/tbd-closing-reminder.sh"',
          },
        ],
      },
    ],
  },
};

interface HookEntry {
  matcher?: string;
  hooks: { type?: string; command?: string; timeout?: number }[];
}

type HooksFile = { hooks: Record<string, HookEntry[]> } & Record<string, unknown>;

function commands(file: HooksFile, event: string): (string | undefined)[] {
  return (file.hooks[event] ?? []).flatMap((entry) => entry.hooks.map((hook) => hook.command));
}

describe('setup keeps equivalent hook wiring', { timeout: subprocessTestTimeout(60_000) }, () => {
  let projectDir: string;
  let fakeHome: string;

  beforeEach(async () => {
    const root = await realpath(await mkdtemp(join(tmpdir(), 'tbd-hook-wiring-')));
    projectDir = join(root, 'project');
    fakeHome = join(root, 'home');
    await mkdir(projectDir);
    await mkdir(fakeHome);
    execSync('git init --initial-branch=main', { cwd: projectDir, stdio: 'ignore' });
    execSync('git config user.email "test@example.com"', { cwd: projectDir });
    execSync('git config user.name "Test"', { cwd: projectDir });
  });

  afterEach(async () => {
    await rm(join(projectDir, '..'), { recursive: true, force: true });
  });

  function runTbd(args: string[]): { stdout: string; stderr: string; status: number } {
    const result = spawnSync('node', [tbdBin, ...args], {
      cwd: projectDir,
      encoding: 'utf-8',
      env: { ...process.env, HOME: fakeHome, USERPROFILE: fakeHome, FORCE_COLOR: '0' },
    });
    return { stdout: result.stdout ?? '', stderr: result.stderr ?? '', status: result.status ?? 1 };
  }

  async function readJson(rel: string): Promise<HooksFile> {
    return JSON.parse(await readFile(join(projectDir, rel), 'utf-8')) as HooksFile;
  }

  async function writeJson(rel: string, value: unknown): Promise<string> {
    const text = JSON.stringify(value, null, 2) + '\n';
    await mkdir(join(projectDir, rel, '..'), { recursive: true });
    await writeFile(join(projectDir, rel), text);
    return text;
  }

  function codexCheck(): { status: string; message?: string } | undefined {
    const doctor = runTbd(['doctor', '--json']);
    const report = JSON.parse(doctor.stdout) as {
      integrationChecks: { name: string; status: string; message?: string }[];
    };
    return report.integrationChecks.find((check) => check.name === 'Codex hooks');
  }

  it('leaves customized Claude commands byte for byte across repeated setup', async () => {
    const initial = runTbd(['setup', '--auto', '--prefix=test', '--surfaces=claude']);
    expect(initial.status, initial.stderr).toBe(0);
    const customized = await writeJson('.claude/settings.json', CUSTOMIZED_CLAUDE_SETTINGS);

    for (let run = 0; run < 2; run++) {
      const result = runTbd(['setup', '--auto', '--surfaces=claude']);
      expect(result.status, result.stderr).toBe(0);
      const output = result.stdout + result.stderr;
      expect(output).not.toContain('Cleaned up legacy');
      expect(output).toContain('Claude Code (3 customized hook commands kept)');
      expect(await readFile(join(projectDir, '.claude/settings.json'), 'utf-8')).toBe(customized);
    }
  });

  it('removes the duplicate an earlier setup appended beside a customized Claude command', async () => {
    runTbd(['setup', '--auto', '--prefix=test', '--surfaces=claude']);
    const duplicated = structuredClone(CUSTOMIZED_CLAUDE_SETTINGS);
    duplicated.hooks.SessionStart.push({
      matcher: '',
      hooks: [{ type: 'command', command: 'bash .claude/scripts/tbd-session.sh' }],
    });
    duplicated.hooks.PreCompact.push({
      matcher: '',
      hooks: [
        { type: 'command', command: 'bash .claude/scripts/tbd-session.sh --brief' },
        { type: 'command', command: 'echo user-hook' },
      ],
    });
    await writeJson('.claude/settings.json', duplicated);

    const result = runTbd(['setup', '--auto', '--surfaces=claude']);
    expect(result.status, result.stderr).toBe(0);
    const settings = await readJson('.claude/settings.json');
    expect(commands(settings, 'SessionStart')).toEqual([
      'bash "$CLAUDE_PROJECT_DIR"/.claude/scripts/tbd-session.sh',
      'bash "$CLAUDE_PROJECT_DIR"/.claude/scripts/ensure-gh-cli.sh',
    ]);
    // The user's handler in the duplicate's entry survives with that entry.
    expect(commands(settings, 'PreCompact')).toEqual([
      'bash "$CLAUDE_PROJECT_DIR"/.claude/scripts/tbd-session.sh --brief',
      'echo user-hook',
    ]);
  });

  it('still replaces a Claude command that wraps the script in other commands', async () => {
    runTbd(['setup', '--auto', '--prefix=test', '--surfaces=claude']);
    await writeJson('.claude/settings.json', {
      hooks: {
        PostToolUse: [
          {
            matcher: 'Bash',
            hooks: [
              {
                type: 'command',
                command: 'bash .claude/hooks/tbd-closing-reminder.sh && echo wrapped',
              },
            ],
          },
        ],
      },
    });
    expect(runTbd(['setup', '--auto', '--surfaces=claude']).status).toBe(0);
    expect(commands(await readJson('.claude/settings.json'), 'PostToolUse')).toEqual([
      'bash "$CLAUDE_PROJECT_DIR"/.claude/hooks/tbd-closing-reminder.sh',
    ]);
  });

  /** fsqlite's validated Codex wiring: git-root session hooks plus tbd's closing wrapper. */
  async function customizedCodexHooks(): Promise<HooksFile> {
    const generated = await readJson('.codex/hooks.json');
    const wrapper = commands(generated, 'PostToolUse')[0];
    expect(wrapper).toMatch(/^bash -c 'repo_root=\$\(pwd -P\);/u);
    return {
      hooks: {
        SessionStart: [
          {
            matcher: '',
            hooks: [{ type: 'command', command: `bash "${GIT_ROOT}/.codex/tbd-session.sh"` }],
          },
          {
            matcher: '',
            hooks: [
              {
                type: 'command',
                command: `bash "${GIT_ROOT}/.codex/ensure-gh-cli.sh"`,
                timeout: 120,
              },
            ],
          },
        ],
        PreCompact: [
          {
            matcher: '',
            hooks: [
              { type: 'command', command: `bash "${GIT_ROOT}/.codex/tbd-session.sh" --brief` },
            ],
          },
        ],
        PostToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: wrapper }] }],
      },
    };
  }

  it('keeps customized Codex commands without appending duplicates, and doctor calls them current', async () => {
    const initial = runTbd(['setup', '--auto', '--prefix=test', '--surfaces=codex']);
    expect(initial.status, initial.stderr).toBe(0);
    const customized = await writeJson('.codex/hooks.json', await customizedCodexHooks());

    for (let run = 0; run < 2; run++) {
      const result = runTbd(['setup', '--auto', '--surfaces=codex']);
      expect(result.status, result.stderr).toBe(0);
      expect(result.stdout + result.stderr).toContain('3 customized hook commands kept');
      expect(await readFile(join(projectDir, '.codex/hooks.json'), 'utf-8')).toBe(customized);
    }
    expect(codexCheck()).toMatchObject({
      status: 'ok',
      message: 'current (3 customized hook commands kept)',
    });
  });

  it('removes duplicates an earlier setup appended beside customized Codex commands', async () => {
    runTbd(['setup', '--auto', '--prefix=test', '--surfaces=codex']);
    const customized = await customizedCodexHooks();
    const duplicated = structuredClone(customized);
    duplicated.hooks.SessionStart!.push(
      { matcher: '', hooks: [{ type: 'command', command: 'bash .codex/tbd-session.sh' }] },
      {
        matcher: '',
        hooks: [{ type: 'command', command: 'bash .codex/ensure-gh-cli.sh', timeout: 120 }],
      },
    );
    duplicated.hooks.PreCompact!.push({
      matcher: '',
      hooks: [{ type: 'command', command: `bash "${GIT_ROOT}"/.codex/tbd-session.sh --brief` }],
    });
    duplicated.hooks.PostToolUse!.push({
      matcher: 'Bash',
      hooks: [{ type: 'command', command: 'bash .codex/tbd-closing-reminder.sh' }],
    });
    await writeJson('.codex/hooks.json', duplicated);
    expect(codexCheck()?.status).toBe('warn');

    const result = runTbd(['setup', '--auto', '--surfaces=codex']);
    expect(result.status, result.stderr).toBe(0);
    expect(await readJson('.codex/hooks.json')).toEqual(customized);
    expect(codexCheck()?.status).toBe('ok');
  });

  it('upgrades the legacy Codex closing command to the boundary-limited wrapper', async () => {
    runTbd(['setup', '--auto', '--prefix=test', '--surfaces=codex']);
    const generated = await readJson('.codex/hooks.json');
    const legacy = structuredClone(generated);
    legacy.hooks.PostToolUse = [
      {
        matcher: 'Bash',
        hooks: [{ type: 'command', command: 'bash .codex/tbd-closing-reminder.sh' }],
      },
    ];
    await writeJson('.codex/hooks.json', legacy);
    expect(codexCheck()?.status).toBe('warn');

    expect(runTbd(['setup', '--auto', '--surfaces=codex']).status).toBe(0);
    expect(await readJson('.codex/hooks.json')).toEqual(generated);
  });
});
