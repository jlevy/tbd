import { spawnSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';
import { parse, stringify } from 'yaml';

import { subprocessTestTimeout } from './test-helpers.js';

const packageDir = dirname(dirname(fileURLToPath(import.meta.url)));
const repoRoot = join(packageDir, '../..');

it(
  'keeps both committed installed skills byte-for-byte equal to fresh setup output',
  async () => {
    const root = await mkdtemp(join(tmpdir(), 'tbd-installed-skill-drift-'));
    const home = join(root, '.home');
    await mkdir(home);
    const run = (command: string, args: string[]) =>
      spawnSync(command, args, {
        cwd: root,
        encoding: 'utf8',
        env: { ...process.env, HOME: home, USERPROFILE: home, FORCE_COLOR: '0', NO_COLOR: '1' },
      });
    try {
      for (const args of [
        ['init', '--initial-branch=main'],
        ['config', 'user.email', 'test@example.com'],
        ['config', 'user.name', 'Test'],
        ['commit', '--allow-empty', '-m', 'test: fixture'],
      ]) {
        const result = run('git', args);
        expect(result.status, result.stderr).toBe(0);
      }
      const tbd = (args: string[]) => run('node', [join(packageDir, 'dist/bin.mjs'), ...args]);
      const setup = tbd(['setup', '--auto', '--prefix=test']);
      expect(setup.status, setup.stderr).toBe(0);

      // Use this project's doc sources and forks, but keep fixture storage and identity.
      const project = parse(await readFile(join(repoRoot, '.tbd/config.yml'), 'utf8')) as {
        docs_cache: unknown;
      };
      const configPath = join(root, '.tbd/config.yml');
      const config = parse(await readFile(configPath, 'utf8')) as Record<string, unknown>;
      config.docs_cache = project.docs_cache;
      await writeFile(configPath, stringify(config));
      try {
        await cp(join(repoRoot, 'docs/tbd'), join(root, 'docs/tbd'), { recursive: true });
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
          throw error;
        }
      }
      const regenerate = tbd(['setup', '--auto', '--surfaces=portable,claude']);
      expect(regenerate.status, regenerate.stderr).toBe(0);
      for (const path of ['.agents/skills/tbd/SKILL.md', '.claude/skills/tbd/SKILL.md']) {
        // Normalize checkout line endings only; every remaining byte, including
        // line wrapping, ordering, and final newlines, must match the generator.
        const committed = (await readFile(join(repoRoot, path), 'utf8')).replace(/\r\n/g, '\n');
        const generated = (await readFile(join(root, path), 'utf8')).replace(/\r\n/g, '\n');
        expect(committed, `${path}: regenerate with tbd setup --auto`).toBe(generated);
      }
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  },
  subprocessTestTimeout(60_000),
);
