/**
 * tbd's install and upgrade advice follows its own supply-chain rules: the newest
 * release at least 14 days old, without install scripts, and never `get-tbd@latest`.
 * The code constant and the agent-facing docs must give the same command.
 */

import { spawnSync } from 'node:child_process';
import { chmod, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  TBD_COOL_OFF_NOTE,
  TBD_INSTALL_COMMAND,
  tbdUpgradeAdvice,
  tbdUpgradeCommand,
} from '../src/lib/install-advice.js';

const packageDir = join(__dirname, '..');
const repoRoot = join(packageDir, '..', '..');

async function markdownFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        return markdownFiles(path);
      }
      return Promise.resolve(entry.name.endsWith('.md') ? [path] : []);
    }),
  );
  return nested.flat();
}

describe('install advice', () => {
  it('installs the newest release at least 14 days old, without install scripts', () => {
    expect(TBD_INSTALL_COMMAND.startsWith('npm install -g --ignore-scripts --before=')).toBe(true);
    expect(TBD_INSTALL_COMMAND.endsWith(' get-tbd')).toBe(true);
    expect(TBD_INSTALL_COMMAND).not.toContain('@latest');

    // The --before value is a shell command substitution; evaluate it as a shell would.
    const before = /--before="\$\((node -p '[^']+')\)"/u.exec(TBD_INSTALL_COMMAND)?.[1];
    expect(before).toBeDefined();
    const result = spawnSync('bash', ['-c', `printf %s "$(${before!})"`], { encoding: 'utf-8' });
    expect(result.status, result.stderr).toBe(0);
    const cutoff = Date.parse(result.stdout);
    expect(Math.abs(Date.now() - 14 * 24 * 60 * 60 * 1000 - cutoff)).toBeLessThan(60_000);
  });

  it('upgrades to at least the recorded release, under the same cool-off', async () => {
    // Run the command in a shell with an npm shim that records its argv.
    const bin = await mkdtemp(join(tmpdir(), 'tbd-install-advice-'));
    try {
      await writeFile(join(bin, 'npm'), '#!/bin/sh\nprintf "%s\\n" "$@"\n');
      await chmod(join(bin, 'npm'), 0o755);
      const result = spawnSync('bash', ['-c', tbdUpgradeCommand('0.11.0-rc.1+build.5')], {
        encoding: 'utf-8',
        env: { ...process.env, PATH: `${bin}:${process.env.PATH ?? ''}` },
      });
      expect(result.status, result.stderr).toBe(0);
      const [install, global, ignoreScripts, before, spec] = result.stdout.split('\n');
      expect([install, global, ignoreScripts]).toEqual(['install', '-g', '--ignore-scripts']);
      const cutoff = Date.parse(before!.slice('--before='.length));
      expect(Math.abs(Date.now() - 14 * 24 * 60 * 60 * 1000 - cutoff)).toBeLessThan(60_000);
      expect(spec).toBe('get-tbd@>=0.11.0-rc.1+build.5');
    } finally {
      await rm(bin, { recursive: true, force: true });
    }
  });

  it('falls back to the plain command for a missing or non-exact recorded release', () => {
    for (const recorded of [undefined, '', 'latest', '^0.11.0', "0.11.0'; touch x; '", '0.11']) {
      expect(tbdUpgradeCommand(recorded), String(recorded)).toBe(TBD_INSTALL_COMMAND);
      expect(tbdUpgradeAdvice('Upgrade tbd', recorded)).toBe(
        `Upgrade tbd: ${TBD_INSTALL_COMMAND}\n${TBD_COOL_OFF_NOTE}`,
      );
    }
    expect(tbdUpgradeAdvice('Upgrade tbd', '0.11.0')).toBe(
      `Upgrade tbd to get-tbd 0.11.0 or newer: ${tbdUpgradeCommand('0.11.0')}\n${TBD_COOL_OFF_NOTE}`,
    );
    expect(TBD_COOL_OFF_NOTE).toContain('under 14 days old');
    expect(TBD_COOL_OFF_NOTE).toContain('tbd guidelines supply-chain-hardening');
  });

  it('tells setup-tbd readers what a cool-off miss means', async () => {
    const text = await readFile(join(packageDir, 'docs/shortcuts/standard/setup-tbd.md'), 'utf-8');
    expect(text).toContain('or newer');
    expect(text).toMatch(/no matching version[\s\S]*under 14 days old/u);
    expect(text).toContain('Never bypass the cool-off');
  });

  it('documents npx only with the dedicated cache that keeps the cool-off', async () => {
    const paths = [...(await markdownFiles(join(packageDir, 'docs'))), join(repoRoot, 'README.md')];
    const npxLines: string[] = [];
    for (const path of paths) {
      for (const line of (await readFile(path, 'utf-8')).split('\n')) {
        if (/npx [^`]*get-tbd@/u.test(line)) {
          npxLines.push(`${relative(repoRoot, path)}: ${line.trim()}`);
        }
      }
    }
    expect(npxLines.length).toBeGreaterThan(0);
    for (const line of npxLines) {
      expect(line).toContain('--before=');
      expect(line).toContain('--ignore-scripts');
      expect(line).toMatch(/--cache=\S+/u);
    }
  });

  it('is the command the skill tiers and the setup shortcut give', async () => {
    for (const rel of [
      'docs/shortcuts/system/skill-baseline.md',
      'docs/shortcuts/system/skill-minimal.md',
      'docs/shortcuts/standard/setup-tbd.md',
      'docs/tbd-docs.md',
    ]) {
      expect(await readFile(join(packageDir, rel), 'utf-8'), rel).toContain(TBD_INSTALL_COMMAND);
    }
    expect(await readFile(join(repoRoot, 'README.md'), 'utf-8')).toContain(TBD_INSTALL_COMMAND);
  });

  it('never recommends an unpinned latest install in shipped docs', async () => {
    // supply-chain-hardening quotes `npm i -g get-tbd@latest` as the example of what a
    // release-age gate re-resolves; it explains the rule rather than recommending it.
    const explainer = join(packageDir, 'docs', 'guidelines', 'supply-chain-hardening.md');
    const paths = [...(await markdownFiles(join(packageDir, 'docs'))), join(repoRoot, 'README.md')];
    const offenders: string[] = [];
    for (const path of paths.filter((candidate) => candidate !== explainer)) {
      for (const line of (await readFile(path, 'utf-8')).split('\n')) {
        if (/get-tbd@latest|npx get-tbd(?!@)/u.test(line)) {
          offenders.push(`${relative(repoRoot, path)}: ${line.trim()}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('never tells agents to create refs through the GitHub API around a git broker', async () => {
    for (const rel of [
      'docs/shortcuts/system/skill-baseline.md',
      'docs/shortcuts/standard/setup-github-cli.md',
      'docs/install/ensure-gh-cli.sh',
    ]) {
      const text = await readFile(join(packageDir, rel), 'utf-8');
      expect(text, rel).not.toMatch(/gh api (-X \S+ )?repos\/\S*\/git\/refs/u);
      expect(text, rel).not.toMatch(/on the direct channel instead/u);
    }
  });
});
