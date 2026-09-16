import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const SCRIPT = join(import.meta.dirname, '..', 'docs', 'install', 'ensure-gh-cli.sh');
const GH_STACK_SKILL_SHA = 'a1b4a3d4d0bcde9ec3a78ab99b2d63af121857a9';

interface SkillListFixture {
  readonly agentHosts: readonly string[];
  readonly pinned: boolean;
  readonly scope: 'project' | 'user';
  readonly skillName: string;
  readonly sourceURL: string;
  readonly version: string;
}

const OFFICIAL_SKILL_FIXTURE: SkillListFixture = {
  agentHosts: ['codex'],
  pinned: true,
  scope: 'user',
  skillName: 'gh-stack',
  sourceURL: 'https://github.com/github/gh-stack',
  version: GH_STACK_SKILL_SHA,
};

const SKILL_IDENTITY_COLLISIONS: [string, Partial<SkillListFixture>][] = [
  ['same-name skill from a different source', { sourceURL: 'https://github.com/example/gh-stack' }],
  [
    'same-name skill at a different version',
    { version: '1111111111111111111111111111111111111111' },
  ],
  ['same-name skill without a pin', { pinned: false }],
  ['same-name skill in project scope', { scope: 'project' }],
  ['same-name skill installed for another agent', { agentHosts: ['claude-code'] }],
];

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

/** Formats one mocked `gh skill list` record as the installer's Go template does. */
function formatSkillListFixture(fixture: SkillListFixture): string {
  return [
    fixture.skillName,
    fixture.sourceURL,
    fixture.scope,
    fixture.version,
    String(fixture.pinned),
    `${fixture.agentHosts.join(',')},`,
  ].join('\t');
}

/** Builds a skill-list fixture from the valid official identity. */
function skillListFixture(overrides: Partial<SkillListFixture> = {}): SkillListFixture {
  return { ...OFFICIAL_SKILL_FIXTURE, ...overrides };
}

/** Runs the shipped skill identity check against mocked `gh skill list` output. */
async function ghStackSkillPresent(fixtures: readonly SkillListFixture[]): Promise<boolean> {
  const fn = await extractFunction('gh_stack_skill_present');
  const result = spawnSync(
    'bash',
    [
      '-c',
      [
        'set -o pipefail',
        'gh() { printf "%s\\n" "$GH_SKILL_LIST_FIXTURE"; }',
        fn,
        'GH_STACK_REPO="github/gh-stack"',
        `GH_STACK_SKILL_SHA="${GH_STACK_SKILL_SHA}"`,
        'GH_SKILL_AGENT="codex"',
        'gh_stack_skill_present',
      ].join('\n'),
    ],
    {
      encoding: 'utf8',
      env: {
        ...process.env,
        GH_SKILL_LIST_FIXTURE: fixtures.map(formatSkillListFixture).join('\n'),
      },
    },
  );
  if (result.status !== 0 && result.status !== 1) {
    throw new Error(`unexpected exit ${result.status}: ${result.stderr}`);
  }
  return result.status === 0;
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
    expect(source).toContain('gh skill list --agent "$GH_SKILL_AGENT"');
    expect(source).toContain('--json skillName,sourceURL,scope,version,pinned,agentHosts');
    expect(source).toMatch(/--agent "\$GH_SKILL_AGENT" --scope user --force/);
    expect(source.match(/if gh_stack_skill_present; then/g)).toHaveLength(2);
    // The skill is instructions loaded into later sessions, so it is pinned by SHA.
    expect(source).toMatch(/^GH_STACK_SKILL_SHA="[0-9a-f]{40}"$/m);
  });

  it('accepts the pinned official skill for the owning agent and user scope', async () => {
    expect(await ghStackSkillPresent([skillListFixture()])).toBe(true);
  });

  it.each(SKILL_IDENTITY_COLLISIONS)('rejects a %s', async (_description, overrides) => {
    expect(await ghStackSkillPresent([skillListFixture(overrides)])).toBe(false);
  });

  it('rejects a project-scoped collision that shadows the valid user skill', async () => {
    expect(
      await ghStackSkillPresent([
        skillListFixture(),
        skillListFixture({ scope: 'project', version: 'project-shadow' }),
      ]),
    ).toBe(false);
  });
});
