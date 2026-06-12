/**
 * E2E for spec Phase 2 item 10 (tbd-ohkj): `tbd docs add <docref>` with
 * canonical-docref config recording, `docs_cache.local_dirs` serving with
 * state `local`, and source grouping for sync. Network-free: uses local
 * docrefs and the bundled cache only.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync, spawnSync } from 'node:child_process';

import { groupSourceEntries } from '../src/file/doc-sync.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('docs add + local_dirs e2e', { timeout: 120_000 }, () => {
  let tempDir: string;
  const tbdBin = join(__dirname, '..', 'dist', 'bin.mjs');

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'tbd-add-local-'));
    execSync('git init --initial-branch=main', { cwd: tempDir });
    execSync('git config user.email "t@t.t"', { cwd: tempDir });
    execSync('git config user.name "T"', { cwd: tempDir });
    execSync('git config commit.gpgsign false', { cwd: tempDir });
    runTbd(['init', '--prefix=al']);
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

  it('adds a local docref, records the canonical docref, and resyncs from it', async () => {
    await mkdir(join(tempDir, 'team'), { recursive: true });
    const src = join(tempDir, 'team', 'team-rules.md');
    await writeFile(src, '---\ntitle: Team Rules\ndescription: Ours\n---\n# Team Rules\nv1\n');

    const add = runTbd(['docs', 'add', './team/team-rules.md', '--kind=guideline']);
    expect(add.status).toBe(0);
    expect(add.stdout).toContain('Adding guideline: team-rules');
    expect(add.stdout).toContain('Config updated (docs_cache.files): ./team/team-rules.md');

    const config = await readFile(join(tempDir, '.tbd', 'config.yml'), 'utf-8');
    expect(config).toContain('guidelines/team-rules.md: ./team/team-rules.md');

    // Source changes propagate on docs sync (local sources fetch from the repo).
    await writeFile(src, '---\ntitle: Team Rules\ndescription: Ours\n---\n# Team Rules\nv2\n');
    const sync = runTbd(['docs', 'sync']);
    expect(sync.status).toBe(0);
    const served = runTbd(['guidelines', 'team-rules']);
    expect(served.stdout).toContain('v2');
  });

  it('rejects git docrefs without an explicit ref, and internal sources', () => {
    const noRef = runTbd(['docs', 'add', 'github:o/r//docs/f.md', '--kind=guideline', '--name=x']);
    expect(noRef.status).not.toBe(0);
    expect(noRef.stderr + noRef.stdout).toContain('explicit ref');

    const internal = runTbd([
      'docs',
      'add',
      'internal:guidelines/python-rules.md',
      '--kind=guideline',
      '--name=x',
    ]);
    expect(internal.status).not.toBe(0);
  });

  it('serves local_dirs docs with state local across read surfaces, listed once', async () => {
    await mkdir(join(tempDir, 'docs', 'eng'), { recursive: true });
    await writeFile(
      join(tempDir, 'docs', 'eng', 'eng-notes.md'),
      '---\ntitle: Eng Notes\ndescription: In-repo\n---\n# Eng Notes\nENGMARK\n',
    );
    const configPath = join(tempDir, '.tbd', 'config.yml');
    const config = await readFile(configPath, 'utf-8');
    const localDirsBlock = 'docs_cache:\n  local_dirs:\n    - ./docs/eng/';
    await writeFile(
      configPath,
      config.includes('docs_cache:')
        ? config.replace('docs_cache:', localDirsBlock)
        : `${config}\n${localDirsBlock}\n`,
    );

    const list = runTbd(['docs', 'list', '--json']);
    expect(list.status).toBe(0);
    const map = JSON.parse(list.stdout) as {
      documents: { name: string; state?: string; path?: string }[];
    };
    const locals = map.documents.filter((d) => d.name === 'eng-notes');
    expect(locals).toHaveLength(1);
    expect(locals[0]!.state).toBe('local');
    expect(locals[0]!.path).toBe('docs/eng/eng-notes.md');

    const served = runTbd(['guidelines', 'eng-notes']);
    expect(served.status).toBe(0);
    expect(served.stdout).toContain('ENGMARK');
    expect(served.stderr).toContain('(serving local doc: docs/eng/eng-notes.md)');

    const show = runTbd(['docs', 'show', 'eng-notes']);
    expect(show.status).toBe(0);
    expect(show.stdout).toContain('ENGMARK');

    // Not forkable: there is no upstream.
    const fork = runTbd(['docs', 'fork', 'eng-notes']);
    expect(fork.status).not.toBe(0);
  });
});

describe('groupSourceEntries', () => {
  it('groups by git repo+ref with internal/local/url buckets', () => {
    const groups = groupSourceEntries({
      'guidelines/a.md': 'internal:guidelines/a.md',
      'guidelines/b.md': 'github:acme/docs@main//b.md',
      'guidelines/c.md': 'github:acme/docs@main//c.md',
      'guidelines/d.md': 'github:acme/docs@v2//d.md',
      'guidelines/e.md': './team/e.md',
      'guidelines/f.md': 'https://example.com/f.md',
    });
    const byKey = Object.fromEntries(groups.map((g) => [g.key, g.entries.length]));
    expect(byKey).toEqual({
      internal: 1,
      'github:acme/docs@main': 2,
      'github:acme/docs@v2': 1,
      local: 1,
      'https://example.com': 1,
    });
    const mainGroup = groups.find((g) => g.key === 'github:acme/docs@main')!;
    expect(mainGroup.gitSource).toEqual({
      host: 'github',
      owner: 'acme',
      repo: 'docs',
      ref: 'main',
    });
  });
});
