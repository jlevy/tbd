/**
 * tbd's install and upgrade advice follows its own supply-chain rules: the newest
 * release at least 14 days old, without install scripts, and never `get-tbd@latest`.
 * The code constant and the agent-facing docs must give the same command.
 */

import { spawnSync } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

import { TBD_INSTALL_COMMAND } from '../src/lib/install-advice.js';

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
