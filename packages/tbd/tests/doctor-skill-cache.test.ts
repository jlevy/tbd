import { spawnSync } from 'node:child_process';
import { access, mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';

import { AGENT_INTEGRATION_FORMAT } from '../src/lib/integration-paths.js';
import { subprocessTestTimeout } from './test-helpers.js';

const packageDir = dirname(dirname(fileURLToPath(import.meta.url)));

it(
  'reports unknown skill freshness for cold or partial caches without writing them',
  async () => {
    const root = await mkdtemp(join(tmpdir(), 'tbd-doctor-cold-cache-'));
    const home = join(root, '.home');
    await mkdir(home);
    const run = (command: string, args: string[]) =>
      spawnSync(command, args, {
        cwd: root,
        encoding: 'utf8',
        env: { ...process.env, HOME: home, USERPROFILE: home, FORCE_COLOR: '0', NO_COLOR: '1' },
      });
    const tbd = (args: string[]) => run('node', [join(packageDir, 'dist/bin.mjs'), ...args]);
    const skills = [
      ['Portable Agent Skill', '.agents/skills/tbd/SKILL.md'],
      ['Claude Code skill', '.claude/skills/tbd/SKILL.md'],
    ] as const;
    const findings = () => {
      const result = tbd(['doctor', '--json']);
      const report = JSON.parse(result.stdout) as {
        integrationChecks: { name: string; status: string; message: string }[];
      };
      return skills.map(([name]) => report.integrationChecks.find((entry) => entry.name === name));
    };
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
      const setup = tbd(['setup', '--auto', '--prefix=test']);
      expect(setup.status, setup.stderr).toBe(0);
      for (const finding of findings()) {
        expect(finding).toMatchObject({ status: 'ok', message: 'current' });
      }
      const originals = await Promise.all(
        skills.map(([, path]) => readFile(join(root, path), 'utf8')),
      );
      const configPath = join(root, '.tbd/config.yml');
      const config = await readFile(configPath, 'utf8');
      const docs = join(root, '.tbd/docs');
      const savedDocs = join(root, 'saved-docs');
      await rename(docs, savedDocs);
      for (const finding of findings()) {
        expect(finding).toMatchObject({
          status: 'warn',
          message: 'freshness unknown: doc cache is incomplete',
        });
      }
      await expect(access(docs)).rejects.toMatchObject({ code: 'ENOENT' });
      expect(await readFile(configPath, 'utf8')).toBe(config);
      for (const [index, [, path]] of skills.entries()) {
        expect(await readFile(join(root, path), 'utf8')).toBe(originals[index]);
      }

      // Ownership and compatibility remain diagnosable without the directory inputs.
      await writeFile(
        join(root, skills[0][1]),
        originals[0]!.replace(`format=${AGENT_INTEGRATION_FORMAT}`, 'format=f999'),
      );
      await rm(join(root, skills[1][1]));
      const cold = findings();
      expect(cold[0]).toMatchObject({ status: 'error' });
      expect(cold[0]?.message).toContain('newer integration format');
      expect(cold[1]).toMatchObject({ status: 'warn', message: 'missing' });

      for (const [index, [, path]] of skills.entries()) {
        await writeFile(join(root, path), originals[index]!);
      }
      await rename(savedDocs, docs);
      const cachedDoc = join(docs, 'shortcuts/standard/address-pr-review.md');
      const savedDoc = await readFile(cachedDoc, 'utf8');
      await rm(cachedDoc);
      for (const finding of findings()) {
        expect(finding?.message).toBe('freshness unknown: doc cache is incomplete');
      }
      await writeFile(cachedDoc, savedDoc);
      for (const finding of findings()) {
        expect(finding).toMatchObject({ status: 'ok', message: 'current' });
      }
      await writeFile(join(root, skills[0][1]), originals[0]! + '\nInjected drift.\n');
      expect(findings()[0]).toMatchObject({ status: 'warn', message: 'stale managed file' });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  },
  subprocessTestTimeout(90_000),
);
