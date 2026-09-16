import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmod, mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const SCRIPT = join(import.meta.dirname, '..', 'docs', 'install', 'ensure-gh-cli.sh');
const GH_STACK_VERSION = 'v0.1.0';
const GH_STACK_SKILL_SHA = 'a1b4a3d4d0bcde9ec3a78ab99b2d63af121857a9';
const unixIt = process.platform === 'win32' ? it.skip : it;

const GH_STACK_ASSET_DIGESTS = {
  'darwin-amd64': '712266939bf40349dce6c8893037b88e0453334d30d06750b61ce1a6c8640bb9',
  'darwin-arm64': '5ca98241a265d6de018095cdae5f3c40da5ca782450eec0ea91aa8e3eb183103',
  'linux-amd64': '358552dd7dce0a46ce153fe196270cec482b84f080947890aad4061a8d44bc0b',
  'linux-arm64': 'a79649e121845b7404109de21d65601c09c8c6d021d93738a3428d23986a8841',
} as const;

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

/** Runs the shipped extension-list identity check against mocked tabular output. */
async function ghStackExtensionListMatches(lines: readonly string[]): Promise<boolean> {
  const fn = await extractFunction('gh_stack_extension_list_matches');
  const result = spawnSync(
    'bash',
    [
      '-c',
      [
        'set -o pipefail',
        'gh() { printf "%s\\n" "$GH_EXTENSION_LIST_FIXTURE"; }',
        fn,
        'GH_STACK_REPO="github/gh-stack"',
        `GH_STACK_VERSION="${GH_STACK_VERSION}"`,
        'gh_stack_extension_list_matches',
      ].join('\n'),
    ],
    {
      encoding: 'utf8',
      env: { ...process.env, GH_EXTENSION_LIST_FIXTURE: lines.join('\n') },
    },
  );
  if (result.status !== 0 && result.status !== 1) {
    throw new Error(`unexpected exit ${result.status}: ${result.stderr}`);
  }
  return result.status === 0;
}

/** Runs the shipped platform normalizer without depending on the test host. */
async function ghStackPlatformFor(os: string, arch: string): Promise<string | null> {
  const fn = await extractFunction('gh_stack_platform_for');
  const result = spawnSync(
    'bash',
    ['-c', `${fn}\ngh_stack_platform_for "$1" "$2"`, '_', os, arch],
    {
      encoding: 'utf8',
    },
  );
  if (result.status !== 0 && result.status !== 1) {
    throw new Error(`unexpected exit ${result.status}: ${result.stderr}`);
  }
  return result.status === 0 ? result.stdout.trim() : null;
}

/** Runs the shipped checksum predicate against caller-controlled bytes. */
async function ghStackChecksumMatches(contents: string, expected: string): Promise<boolean> {
  const directory = await mkdtemp(join(tmpdir(), 'tbd-gh-stack-checksum-'));
  const fixture = join(directory, 'asset');
  try {
    await writeFile(fixture, contents);
    const fn = await extractFunction('sha256_matches');
    const result = spawnSync(
      'bash',
      ['-c', `${fn}\nsha256_matches "$1" "$2"`, '_', fixture, expected],
      {
        encoding: 'utf8',
      },
    );
    if (result.status !== 0 && result.status !== 1) {
      throw new Error(`unexpected exit ${result.status}: ${result.stderr}`);
    }
    return result.status === 0;
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

interface ManifestOverrides {
  readonly owner?: string;
  readonly path?: string;
  readonly tag?: string;
}

/** Runs the shipped manifest identity check against a disposable gh data directory. */
async function ghStackManifestMatches(overrides: ManifestOverrides = {}): Promise<boolean> {
  const dataHome = await mkdtemp(join(tmpdir(), 'tbd-gh-stack-manifest-'));
  const extensionDirectory = join(dataHome, 'gh', 'extensions', 'gh-stack');
  try {
    await mkdir(extensionDirectory, { recursive: true });
    const manifest = [
      `owner: ${overrides.owner ?? 'github'}`,
      'name: gh-stack',
      'host: github.com',
      `tag: ${overrides.tag ?? GH_STACK_VERSION}`,
      'ispinned: true',
      `path: ${overrides.path ?? join(extensionDirectory, 'gh-stack')}`,
      '',
    ].join('\n');
    await writeFile(join(extensionDirectory, 'manifest.yml'), manifest);
    const dataHomeFn = await extractFunction('gh_stack_data_home');
    const executableForDataHomeFn = await extractFunction(
      'gh_stack_extension_executable_for_data_home',
    );
    const executableFn = await extractFunction('gh_stack_extension_executable');
    const manifestFileFn = await extractFunction('gh_stack_manifest_file_matches');
    const manifestFn = await extractFunction('gh_stack_manifest_matches');
    const result = spawnSync(
      'bash',
      [
        '-c',
        [
          dataHomeFn,
          executableForDataHomeFn,
          executableFn,
          manifestFileFn,
          manifestFn,
          `GH_STACK_VERSION="${GH_STACK_VERSION}"`,
          'gh_stack_manifest_matches',
        ].join('\n'),
      ],
      { encoding: 'utf8', env: { ...process.env, XDG_DATA_HOME: dataHome } },
    );
    if (result.status !== 0 && result.status !== 1) {
      throw new Error(`unexpected exit ${result.status}: ${result.stderr}`);
    }
    return result.status === 0;
  } finally {
    await rm(dataHome, { recursive: true, force: true });
  }
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

  it('pins an immutable digest for every supported gh-stack release asset', async () => {
    const source = await readFile(SCRIPT, 'utf8');
    expect(source).toContain(`GH_STACK_VERSION="${GH_STACK_VERSION}"`);
    for (const [platform, digest] of Object.entries(GH_STACK_ASSET_DIGESTS)) {
      expect(source).toMatch(new RegExp(`${platform.replace('-', '\\-')}\\)\\s+echo "${digest}"`));
    }
    expect(source).toContain(
      'https://github.com/${GH_STACK_REPO}/releases/download/${GH_STACK_VERSION}/${asset}',
    );
  });

  it.each([
    ['Darwin', 'x86_64', 'darwin-amd64'],
    ['Darwin', 'arm64', 'darwin-arm64'],
    ['Linux', 'x86_64', 'linux-amd64'],
    ['Linux', 'aarch64', 'linux-arm64'],
    ['FreeBSD', 'amd64', null],
    ['Linux', 'riscv64', null],
  ])('maps %s/%s to the reviewed asset %s', async (os, arch, expected) => {
    expect(await ghStackPlatformFor(os, arch)).toBe(expected);
  });

  unixIt('rejects asset bytes that do not match the expected SHA-256 digest', async () => {
    const official = 'reviewed gh-stack asset';
    const digest = createHash('sha256').update(official).digest('hex');
    expect(await ghStackChecksumMatches(official, digest)).toBe(true);
    expect(await ghStackChecksumMatches(`${official} tampered`, digest)).toBe(false);
  });

  unixIt('removes a colliding extension before a checksum failure and cleans staging', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'tbd-gh-stack-fail-closed-'));
    const binDirectory = join(directory, 'bin');
    const homeDirectory = join(directory, 'home');
    const dataHome = join(directory, 'data');
    const tempDirectory = join(directory, 'tmp');
    const marker = join(directory, 'gh-stack-registered');
    const extensionDirectory = join(dataHome, 'gh', 'extensions', 'gh-stack');
    const executable = join(extensionDirectory, 'gh-stack');
    try {
      await Promise.all([
        mkdir(binDirectory, { recursive: true }),
        mkdir(homeDirectory, { recursive: true }),
        mkdir(extensionDirectory, { recursive: true }),
        mkdir(tempDirectory, { recursive: true }),
      ]);
      await Promise.all([
        writeFile(marker, 'registered'),
        writeFile(executable, 'unverified executable'),
        writeFile(
          join(binDirectory, 'gh'),
          `#!/bin/bash
set -eu
if [ "\${1:-}" = "--version" ]; then
    echo "gh version 2.98.0 (test)"
    exit 0
fi
if [ "\${1:-}" = "auth" ] && [ "\${2:-}" = "status" ]; then
    exit 0
fi
if [ "\${1:-}" = "extension" ] && [ "\${2:-}" = "list" ]; then
    if [ -f "${marker}" ]; then
        printf 'gh stack\\texample/gh-stack\\tv9.9.9\\n'
    fi
    exit 0
fi
if [ "\${1:-}" = "extension" ] && [ "\${2:-}" = "remove" ]; then
    rm -f "${marker}"
    rm -rf "${extensionDirectory}"
    exit 0
fi
echo "unexpected mocked gh invocation: $*" >&2
exit 98
`,
        ),
        writeFile(
          join(binDirectory, 'curl'),
          `#!/bin/bash
set -eu
output=""
while [ "$#" -gt 0 ]; do
    case "$1" in
        -o) output=$2; shift 2 ;;
        *) shift ;;
    esac
done
printf 'tampered asset' > "$output"
`,
        ),
      ]);
      await Promise.all([
        chmod(join(binDirectory, 'gh'), 0o755),
        chmod(join(binDirectory, 'curl'), 0o755),
      ]);

      const result = spawnSync('bash', [SCRIPT, '--with-stack'], {
        encoding: 'utf8',
        env: {
          ...process.env,
          GH_TOKEN: '',
          HOME: homeDirectory,
          PATH: `${binDirectory}:${process.env.PATH ?? ''}`,
          TMPDIR: tempDirectory,
          XDG_DATA_HOME: dataHome,
        },
      });
      expect(result.status, result.stderr).toBe(0);
      expect(result.stdout).toContain('checksum mismatch');
      expect(result.stdout).toContain("Do not run 'gh stack'");
      expect(await readFile(marker, 'utf8').catch(() => null)).toBeNull();
      expect(await readFile(executable, 'utf8').catch(() => null)).toBeNull();
      expect(await readdir(tempDirectory)).toEqual([]);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  unixIt('quarantines a competing destination when mv nests the staged directory', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'tbd-gh-stack-publish-race-'));
    const binDirectory = join(directory, 'bin');
    const homeDirectory = join(directory, 'home');
    const dataHome = join(directory, 'data');
    const tempDirectory = join(directory, 'tmp');
    const installRootLog = join(directory, 'gh-stack-install-root');
    const versionAttempt = join(directory, 'gh-stack-version-attempt');
    const extensionDirectory = join(dataHome, 'gh', 'extensions', 'gh-stack');
    const executable = join(extensionDirectory, 'gh-stack');
    const expectedDigest = GH_STACK_ASSET_DIGESTS['linux-amd64'];
    try {
      await Promise.all([
        mkdir(binDirectory, { recursive: true }),
        mkdir(homeDirectory, { recursive: true }),
        mkdir(tempDirectory, { recursive: true }),
      ]);
      await Promise.all([
        writeFile(
          join(binDirectory, 'gh'),
          `#!/bin/bash
set -eu
if [ "\${1:-}" = "--version" ]; then
    echo "gh version 2.98.0 (test)"
    exit 0
fi
if [ "\${1:-}" = "auth" ] && [ "\${2:-}" = "status" ]; then
    exit 0
fi
if [ "\${1:-}" = "extension" ] && [ "\${2:-}" = "list" ]; then
    if [ -f "\${XDG_DATA_HOME}/gh/extensions/gh-stack/manifest.yml" ]; then
        printf 'gh stack\\tgithub/gh-stack\\t${GH_STACK_VERSION}\\n'
    fi
    exit 0
fi
if [ "\${1:-}" = "extension" ] && [ "\${2:-}" = "install" ]; then
    if [ "\${XDG_DATA_HOME}" = "${dataHome}" ]; then
        echo 'extension install used canonical XDG_DATA_HOME' >&2
        exit 96
    fi
    staged_directory="\${XDG_DATA_HOME}/gh/extensions/gh-stack"
    staged_executable="\${staged_directory}/gh-stack"
    mkdir -p "\${staged_directory}"
    printf '%s\\n' \\
        'owner: github' \\
        'name: gh-stack' \\
        'host: github.com' \\
        'tag: ${GH_STACK_VERSION}' \\
        'ispinned: true' \\
        "path: \${staged_executable}" > "\${staged_directory}/manifest.yml"
    printf 'gh unchecked download' > "\${staged_executable}"
    chmod 755 "\${staged_executable}"
    printf '%s\\n' "\${XDG_DATA_HOME}" > "${installRootLog}"
    exit 0
fi
if [ "\${1:-}" = "extension" ] && [ "\${2:-}" = "remove" ]; then
    rm -rf "\${XDG_DATA_HOME}/gh/extensions/gh-stack"
    exit 0
fi
if [ "\${1:-}" = "stack" ] && [ "\${2:-}" = "--version" ]; then
    touch "${versionAttempt}"
    echo 'gh stack version ${GH_STACK_VERSION.slice(1)}'
    exit 0
fi
echo "unexpected mocked gh invocation: $*" >&2
exit 98
`,
        ),
        writeFile(
          join(binDirectory, 'curl'),
          `#!/bin/bash
set -eu
output=""
while [ "$#" -gt 0 ]; do
    case "$1" in
        -o) output=$2; shift 2 ;;
        *) shift ;;
    esac
done
printf 'reviewed asset fixture' > "$output"
`,
        ),
        writeFile(
          join(binDirectory, 'sha256sum'),
          `#!/bin/bash
printf '${expectedDigest}  %s\\n' "$1"
`,
        ),
        writeFile(
          join(binDirectory, 'uname'),
          `#!/bin/bash
case "\${1:-}" in
    -s) echo Linux ;;
    -m) echo x86_64 ;;
    *) echo Linux ;;
esac
`,
        ),
        writeFile(
          join(binDirectory, 'mv'),
          `#!/bin/bash
set -eu
if [ "$#" = "2" ] \
    && [[ "$1" == *'/.tbd-gh-stack.'*'/gh/extensions/gh-stack' ]] \
    && [ "$2" = "${extensionDirectory}" ]; then
    mkdir -p "${extensionDirectory}"
    printf '%s\\n' \\
        'owner: github' \\
        'name: gh-stack' \\
        'host: github.com' \\
        'tag: ${GH_STACK_VERSION}' \\
        'ispinned: true' \\
        'path: ${executable}' > "${join(extensionDirectory, 'manifest.yml')}"
fi
exec /bin/mv "$@"
`,
        ),
      ]);
      await Promise.all(
        ['gh', 'curl', 'sha256sum', 'uname', 'mv'].map((name) =>
          chmod(join(binDirectory, name), 0o755),
        ),
      );

      const result = spawnSync('bash', [SCRIPT, '--with-stack'], {
        encoding: 'utf8',
        env: {
          ...process.env,
          GH_TOKEN: '',
          HOME: homeDirectory,
          PATH: `${binDirectory}:${process.env.PATH ?? ''}`,
          TMPDIR: tempDirectory,
          XDG_DATA_HOME: dataHome,
        },
      });
      expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
      expect(result.stdout).toContain('could not install a verified github/gh-stack extension');
      const isolatedRoot = (await readFile(installRootLog, 'utf8')).trim();
      expect(isolatedRoot).not.toBe(dataHome);
      expect(isolatedRoot.startsWith(`${dataHome}/.tbd-gh-stack.`)).toBe(true);
      expect(await readFile(versionAttempt, 'utf8').catch(() => null)).toBeNull();
      expect(await readFile(executable, 'utf8').catch(() => null)).toBeNull();
      expect(await readdir(tempDirectory)).toEqual([]);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('requires the exact gh-stack command, source, and version', async () => {
    const official = `gh stack\tgithub/gh-stack\t${GH_STACK_VERSION}`;
    expect(await ghStackExtensionListMatches([official])).toBe(true);
    expect(
      await ghStackExtensionListMatches([`gh stack\texample/gh-stack\t${GH_STACK_VERSION}`]),
    ).toBe(false);
    expect(await ghStackExtensionListMatches(['gh stack\tgithub/gh-stack\tv0.0.9'])).toBe(false);
    expect(
      await ghStackExtensionListMatches([official, 'gh stack\texample/gh-stack\tv0.1.0']),
    ).toBe(false);
  });

  unixIt('requires gh to execute the pinned manifest path', async () => {
    expect(await ghStackManifestMatches()).toBe(true);
    expect(await ghStackManifestMatches({ owner: 'example' })).toBe(false);
    expect(await ghStackManifestMatches({ tag: 'v0.0.9' })).toBe(false);
    expect(await ghStackManifestMatches({ path: '/tmp/redirected-gh-stack' })).toBe(false);
  });

  it('publishes only a fully verified isolated registration at the canonical path', async () => {
    const source = (await readFile(SCRIPT, 'utf8')).replaceAll('\r\n', '\n');
    expect(source.match(/--connect-timeout 15 --max-time 120/g)).toHaveLength(2);
    expect(source).toMatch(/sha256_matches "\$asset_path" "\$expected"/);
    expect(source).toMatch(
      /XDG_DATA_HOME="\$STACK_INSTALL_ROOT" \\\n+\s+gh extension install "\$GH_STACK_REPO" --pin "\$GH_STACK_VERSION" --force/,
    );
    expect(source).toContain(
      'STACK_INSTALL_ROOT=$(mktemp -d "${canonical_data_home}/.tbd-gh-stack.XXXXXX")',
    );
    expect(source).toMatch(/cp "\$asset_path" "\$INSTALL_STAGING"/);
    expect(source).toMatch(/mv -f "\$INSTALL_STAGING" "\$staged_executable"/);
    expect(source).toMatch(/mv "\$staged_dir" "\$canonical_dir"/);
    expect(source).toContain('[ ! -e "$staged_dir" ] && [ ! -L "$staged_dir" ] || return 1');
    expect(source).toContain('[ -d "$canonical_dir" ] && [ ! -L "$canonical_dir" ] || return 1');
    const assetVerified = source.indexOf('sha256_matches "$asset_path" "$expected"');
    const isolatedInstall = source.indexOf('XDG_DATA_HOME="$STACK_INSTALL_ROOT"');
    const stagedBytesVerified = source.indexOf('sha256_matches "$staged_executable" "$expected"');
    const manifestRewritten = source.indexOf('rewrite_gh_stack_manifest_path \\');
    const finalManifestVerified = source.indexOf(
      'gh_stack_manifest_file_matches "$staged_manifest" "$canonical_executable"',
    );
    const sentinelCreated = source.indexOf(
      'publish_sentinel=$(mktemp "${staged_dir}/.tbd-verified.XXXXXX")',
    );
    const canonicalPublished = source.indexOf('mv "$staged_dir" "$canonical_dir"');
    const sentinelVerified = source.indexOf('grep -Fqx "$expected" "$canonical_sentinel"');
    const sentinelRemoved = source.indexOf('rm -f "$canonical_sentinel"');
    const publishedIdentityVerified = source.indexOf(
      'gh_stack_extension_identity_matches || return 1',
    );
    const canonicalExecuted = source.indexOf('version_output=$(gh stack --version');
    expect(assetVerified).toBeGreaterThan(-1);
    expect(assetVerified).toBeLessThan(isolatedInstall);
    expect(isolatedInstall).toBeLessThan(stagedBytesVerified);
    expect(stagedBytesVerified).toBeLessThan(manifestRewritten);
    expect(manifestRewritten).toBeLessThan(finalManifestVerified);
    expect(finalManifestVerified).toBeLessThan(sentinelCreated);
    expect(sentinelCreated).toBeLessThan(canonicalPublished);
    expect(canonicalPublished).toBeLessThan(sentinelVerified);
    expect(sentinelVerified).toBeLessThan(sentinelRemoved);
    expect(sentinelRemoved).toBeLessThan(publishedIdentityVerified);
    expect(canonicalPublished).toBeLessThan(publishedIdentityVerified);
    expect(publishedIdentityVerified).toBeLessThan(canonicalExecuted);
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
