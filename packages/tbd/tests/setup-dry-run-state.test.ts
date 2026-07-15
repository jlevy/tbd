/**
 * Whole-state invariants for `tbd setup --auto --dry-run`.
 *
 * The fixture uses a linked worktree so shared Git-common-dir mutations are outside
 * the project tree and cannot hide behind a clean `git status`.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  readlink,
  realpath,
  rm,
  writeFile,
} from 'node:fs/promises';
import { execFileSync, spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TBD_BIN = join(__dirname, '..', 'dist', 'bin.mjs');

interface SnapshotEntry {
  path: string;
  kind: 'directory' | 'file' | 'symlink';
  mode: number;
  content?: string;
  target?: string;
}

interface CommandResult {
  stdout: string;
  stderr: string;
  status: number;
}

async function snapshotTree(root: string): Promise<SnapshotEntry[]> {
  const entries: SnapshotEntry[] = [];

  async function visit(path: string): Promise<void> {
    const metadata = await lstat(path);
    const relativePath = relative(root, path) || '.';
    const mode = metadata.mode & 0o7777;

    if (metadata.isSymbolicLink()) {
      entries.push({ path: relativePath, kind: 'symlink', mode, target: await readlink(path) });
      return;
    }
    if (metadata.isDirectory()) {
      entries.push({ path: relativePath, kind: 'directory', mode });
      const children = await readdir(path);
      for (const child of children.sort()) {
        await visit(join(path, child));
      }
      return;
    }
    entries.push({
      path: relativePath,
      kind: 'file',
      mode,
      content: (await readFile(path)).toString('base64'),
    });
  }

  await visit(root);
  return entries;
}

describe('setup --auto --dry-run whole-state invariant', { timeout: 45_000 }, () => {
  let tempDir: string;
  let repositoryDir: string;
  let projectDir: string;
  let fakeHome: string;
  let sharedTbdDir: string;

  beforeEach(async () => {
    tempDir = await realpath(await mkdtemp(join(tmpdir(), 'tbd-setup-dry-run-')));
    repositoryDir = join(tempDir, 'repository');
    projectDir = join(tempDir, 'project');
    fakeHome = join(tempDir, 'home');
    await mkdir(repositoryDir, { recursive: true });
    await mkdir(fakeHome, { recursive: true });

    git(['init', '--initial-branch=main'], repositoryDir);
    git(['config', 'user.email', 'test@example.com'], repositoryDir);
    git(['config', 'user.name', 'Test'], repositoryDir);
    await writeFile(join(repositoryDir, 'README.md'), '# Fixture\n');
    git(['add', 'README.md'], repositoryDir);
    git(['commit', '-m', 'test: initialize fixture'], repositoryDir);
    git(['worktree', 'add', '-b', 'fixture', projectDir], repositoryDir);

    const commonDir = git(['rev-parse', '--path-format=absolute', '--git-common-dir'], projectDir);
    sharedTbdDir = join(commonDir, 'tbd');
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  function git(args: string[], cwd: string): string {
    return execFileSync('git', args, { cwd, encoding: 'utf-8' }).trim();
  }

  function runTbd(args: string[]): CommandResult {
    const result = spawnSync('node', [TBD_BIN, ...args], {
      cwd: projectDir,
      encoding: 'utf-8',
      env: {
        ...process.env,
        HOME: fakeHome,
        USERPROFILE: fakeHome,
        FORCE_COLOR: '0',
        NO_COLOR: '1',
      },
    });
    return {
      stdout: result.stdout || '',
      stderr: result.stderr || '',
      status: result.status ?? 1,
    };
  }

  async function snapshotAllState(): Promise<{
    project: SnapshotEntry[];
    shared: SnapshotEntry[];
  }> {
    return {
      project: await snapshotTree(projectDir),
      shared: await snapshotTree(sharedTbdDir),
    };
  }

  it('previews a fresh setup without creating project or shared state', async () => {
    await mkdir(sharedTbdDir, { recursive: true });
    await writeFile(join(sharedTbdDir, 'sentinel'), 'preserve shared state\n');
    const before = await snapshotAllState();

    const result = runTbd(['setup', '--auto', '--dry-run', '--prefix=test']);

    expect(result.status).toBe(0);
    expect(result.stdout + result.stderr).toMatch(/\[DRY-RUN\].*[Ww]ould initialize tbd/);
    expect(await snapshotAllState()).toEqual(before);
    expect(git(['status', '--porcelain'], projectDir)).toBe('');
  });

  it('previews migrations, docs, cleanup, and every stale surface without any write', async () => {
    const initial = runTbd(['setup', '--auto', '--prefix=test']);
    expect(initial.status).toBe(0);

    const configPath = join(projectDir, '.tbd', 'config.yml');
    const config = (await readFile(configPath, 'utf-8'))
      .replace('tbd_format: f06', 'tbd_format: f05')
      .replace(/^tbd_version:.*$/m, 'tbd_version: 0.3.0');
    await writeFile(configPath, config);

    const layoutPath = join(sharedTbdDir, 'layout.yml');
    await writeFile(
      layoutPath,
      (await readFile(layoutPath, 'utf-8')).replace('tbd_format: f06', 'tbd_format: f05'),
    );

    await writeFile(join(projectDir, '.tbd', '.gitignore'), '# stale\n');
    await writeFile(join(projectDir, '.tbd', '.gitattributes'), '# stale\n');
    await writeFile(join(projectDir, '.tbd', 'state.yml'), 'last_doc_sync_at: stale\n');
    await writeFile(
      join(projectDir, '.tbd', 'docs', 'guidelines', 'cli-agent-skill-patterns.md'),
      'stale cached guideline\n',
    );

    const legacyScript = join(projectDir, '.claude', 'scripts', 'ensure-tbd-cli.sh');
    await writeFile(legacyScript, '#!/bin/bash\necho legacy\n');
    const claudeSettingsPath = join(projectDir, '.claude', 'settings.json');
    const settings = JSON.parse(await readFile(claudeSettingsPath, 'utf-8')) as {
      hooks: Record<string, unknown[]>;
    };
    (settings.hooks.SessionStart ??= []).push({
      matcher: '',
      hooks: [{ type: 'command', command: 'bash .claude/scripts/ensure-tbd-cli.sh' }],
    });
    await writeFile(claudeSettingsPath, JSON.stringify(settings, null, 2) + '\n');

    for (const path of [
      join(projectDir, '.agents', 'skills', 'tbd', 'SKILL.md'),
      join(projectDir, '.claude', 'skills', 'tbd', 'SKILL.md'),
    ]) {
      await writeFile(
        path,
        "---\nname: tbd\n---\n<!-- DO NOT EDIT: Generated by tbd setup (format=f05).\nRun 'tbd setup' to update.\n-->\nstale generated surface\n",
      );
    }
    await writeFile(join(projectDir, '.codex', 'tbd-session.sh'), 'stale generated surface\n');
    await writeFile(
      join(projectDir, 'AGENTS.md'),
      '# User instructions\n\n<!-- BEGIN TBD INTEGRATION format=f05 -->\nstale\n<!-- END TBD INTEGRATION -->\n',
    );

    git(['add', '-A'], projectDir);
    git(['commit', '-m', 'test: create stale setup fixture'], projectDir);
    expect(git(['status', '--porcelain'], projectDir)).toBe('');

    const before = await snapshotAllState();
    const result = runTbd(['setup', '--auto', '--dry-run']);
    const output = result.stdout + result.stderr;

    expect(result.status).toBe(0);
    expect(output).toContain('Updated tbd_format: f06');
    expect(output).toMatch(/\[DRY-RUN\].*[Ww]ould update .*config/i);
    expect(output).toMatch(/\[DRY-RUN\].*[Ww]ould update \.tbd\/\.gitignore/i);
    expect(output).toMatch(/\[DRY-RUN\].*[Ww]ould update \.tbd\/\.gitattributes/i);
    expect(output).toMatch(/\[DRY-RUN\].*[Ww]ould sync docs/i);
    expect(output).toMatch(/\[DRY-RUN\].*[Ww]ould clean up legacy/i);
    expect(output).toMatch(/\[DRY-RUN\].*[Ww]ould refresh stale portable Agent Skill/i);
    expect(output).toMatch(/\[DRY-RUN\].*[Ww]ould create\/update AGENTS\.md/i);
    expect(output).toMatch(/\[DRY-RUN\].*[Ww]ould install Claude Code hooks and skill file/i);
    expect(output).toMatch(/\[DRY-RUN\].*[Ww]ould refresh stale Codex hooks/i);

    expect(await snapshotAllState()).toEqual(before);
    expect(git(['status', '--porcelain'], projectDir)).toBe('');
  });

  it('validates a newer selected mirror before planning any write', async () => {
    const initial = runTbd(['setup', '--auto', '--prefix=test']);
    expect(initial.status).toBe(0);

    const mirrorPath = join(projectDir, '.claude', 'skills', 'tbd', 'SKILL.md');
    await writeFile(
      mirrorPath,
      (await readFile(mirrorPath, 'utf-8')).replace('format=f06', 'format=f99'),
    );
    const before = await snapshotAllState();

    const result = runTbd(['setup', '--auto', '--dry-run', '--surfaces=claude']);

    expect(result.status).toBe(1);
    expect(result.stdout + result.stderr).toContain('newer tbd');
    expect(await snapshotAllState()).toEqual(before);
  });
});
