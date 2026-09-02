import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const SCRIPT = join(import.meta.dirname, '..', 'docs', 'install', 'ensure-gh-cli.sh');

/**
 * Extract a single bash function from the shipped script.
 *
 * The script cannot be sourced directly: it runs an install on load. Pulling the
 * function out keeps the assertions pointed at the real shipped text rather than a
 * copy that can drift.
 */
async function extractFunction(name: string): Promise<string> {
  const source = await readFile(SCRIPT, 'utf8');
  const match = new RegExp(`^${name}\\(\\) \\{$.*?^\\}$`, 'ms').exec(source);
  if (!match) {
    throw new Error(`${name}() not found in ${SCRIPT}`);
  }
  return match[0];
}

describe('ensure-gh-cli.sh', () => {
  describe('version_ge', () => {
    /** Runs `version_ge have want` and reports whether it returned success. */
    async function versionGe(have: string, want: string): Promise<boolean> {
      const fn = await extractFunction('version_ge');
      const result = spawnSync('bash', ['-c', `${fn}\nversion_ge "$1" "$2"`, '_', have, want], {
        encoding: 'utf8',
      });
      if (result.status !== 0 && result.status !== 1) {
        throw new Error(`unexpected exit ${result.status}: ${result.stderr}`);
      }
      return result.status === 0;
    }

    // The floor decides whether an existing gh is replaced. A false "new enough" leaves
    // a vulnerable gh in place; a false "too old" downgrades a good one.
    it.each([
      ['2.97.0', '2.97.0', true, 'equal meets the floor'],
      ['2.98.0', '2.97.0', true, 'newer is kept, never downgraded'],
      ['2.92.0', '2.97.0', false, 'the previous pin is below the floor'],
      ['2.9.0', '2.97.0', false, 'numeric compare, not lexicographic (9 < 97)'],
      ['2.100.0', '2.97.0', true, 'numeric compare, not lexicographic (100 > 97)'],
      ['2.08.0', '2.97.0', false, 'leading zero is not parsed as octal'],
      ['3.0.0', '2.97.0', true, 'major bump'],
      ['1.99.9', '2.97.0', false, 'lower major loses despite higher minor'],
      ['2.97', '2.97.0', true, 'missing patch is treated as .0'],
      ['2.97.1', '2.97.0', true, 'higher patch'],
      ['2.96.9', '2.97.0', false, 'just below the floor'],
      ['2.97.0-rc1', '2.97.0', true, 'prerelease suffix is stripped before comparing'],
    ])('%s >= %s is %s (%s)', async (have, want, expected) => {
      expect(await versionGe(have, want)).toBe(expected);
    });
  });

  it('pins the gh version, the floor, and a checksum for every supported platform', async () => {
    const source = await readFile(SCRIPT, 'utf8');
    const version = /^GH_VERSION="([^"]+)"$/m.exec(source)?.[1];
    const floor = /^GH_MIN_VERSION="([^"]+)"$/m.exec(source)?.[1];
    expect(version).toBeTruthy();
    // A floor above the pinned build would reinstall on every run, forever.
    expect(floor).toBe(version);
    for (const platform of [
      'linux_amd64.tar.gz',
      'linux_arm64.tar.gz',
      'macOS_amd64.zip',
      'macOS_arm64.zip',
    ]) {
      expect(source).toMatch(
        new RegExp(`${platform.replace(/\./g, '\\.')}\\)\\s*echo "[0-9a-f]{64}"`),
      );
    }
  });

  it('installs the gh-stack skill by name and verifies the result', async () => {
    const source = await readFile(SCRIPT, 'utf8');
    // `gh skill install <repo>` with no skill name installs nothing and still exits 0,
    // so both the selector and a result check are load-bearing.
    expect(source).toMatch(/gh skill install "\$GH_STACK_REPO" gh-stack/);
    expect(source).toMatch(/gh_stack_skill_present/);
    // The skill is instructions loaded into later sessions, so it is pinned by SHA.
    expect(source).toMatch(/^GH_STACK_SKILL_SHA="[0-9a-f]{40}"$/m);
  });
});
