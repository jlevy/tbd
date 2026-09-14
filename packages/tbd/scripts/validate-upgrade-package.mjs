#!/usr/bin/env node
/* global console, process */

/**
 * Prove a packed candidate upgrades real published repositories safely.
 *
 * Three baselines exercise the real-world path and distinct compatibility contracts:
 * - the oldest published f08 release (0.7.0), the same-format case: the weakest client
 *   that must still read a repository this candidate has written;
 * - the common pre-f07 release (0.4.2 / f06), whose client must fail closed after upgrade;
 * - the last pre-f07 release (0.5.0 / f06), the older boundary.
 *
 * The first baseline changes meaning with each format bump, and has to be revisited the
 * release *after* one. While the candidate was f07, 0.6.3 was the same-format case. The
 * f08 bump made every published version older-format, so the same-format slot was
 * deliberately left empty until an f08 build shipped — a pre-f08 client parses beads in
 * Zod strip mode and would delete fields it does not know, which is the point of the
 * bump. f08 shipped in 0.7.0, so the slot is filled again, and the additive-field path
 * this release actually takes is covered rather than assumed.
 *
 * The *oldest* f08 release is the baseline rather than the newest, for two reasons. It
 * is the weakest client that must still work, so it is the stronger test. And it stays
 * strictly older than any candidate, including an unbumped working tree, so CI can run
 * this gate on every branch instead of only at release time.
 */

/**
 * The format a candidate build is expected to produce.
 *
 * Kept beside the scenarios rather than imported: this script runs against a *packed*
 * tarball, so reading the constant out of the working tree would assert the candidate
 * against itself and pass no matter what it produced.
 */
const CANDIDATE_FORMAT = 'f08';

import { execFile } from 'node:child_process';
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { delimiter, dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { isDeepStrictEqual, promisify } from 'node:util';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';

const execFileAsync = promisify(execFile);
const scriptDir = dirname(fileURLToPath(import.meta.url));
const packageDir = join(scriptDir, '..');
const sourceRepoDir = join(packageDir, '..', '..');
const sameFormatBaseline = process.env.TBD_UPGRADE_SAME_FORMAT_FROM ?? '0.7.0';
const commonUpgradeBaseline = process.env.TBD_UPGRADE_COMMON_FROM ?? '0.4.2';
const previousFormatBaseline = process.env.TBD_UPGRADE_PREVIOUS_FORMAT_FROM ?? '0.5.0';
// The NEWEST published f08 release, for the config round trip only: that scenario asks
// what a teammate's client will preserve, not what the weakest one can read.
const latestFormatBaseline = process.env.TBD_UPGRADE_LATEST_FORMAT_FROM ?? '0.8.1';
const managedUpgradePaths = new Set([
  '.agents/skills/tbd/SKILL.md',
  '.claude/.gitignore',
  '.claude/hooks/tbd-closing-reminder.sh',
  '.claude/scripts/ensure-gh-cli.sh',
  '.claude/scripts/tbd-session.sh',
  '.claude/settings.json',
  '.claude/skills/tbd/SKILL.md',
  '.codex/ensure-gh-cli.sh',
  '.codex/hooks.json',
  '.codex/tbd-closing-reminder.sh',
  '.codex/tbd-session.sh',
  '.tbd/.gitattributes',
  '.tbd/.gitignore',
  '.tbd/config.yml',
  'AGENTS.md',
]);

function invariant(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function run(command, args, options = {}) {
  return execFileAsync(command, args, {
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
    ...options,
  });
}

async function runPackageManager(command, args, options = {}) {
  if (process.platform === 'win32') {
    return run(process.env.ComSpec ?? 'cmd.exe', ['/d', '/c', `${command}.cmd`, ...args], {
      windowsHide: true,
      ...options,
    });
  }
  return run(command, args, options);
}

function withoutAmbientNpmConfig() {
  return Object.fromEntries(
    Object.entries(process.env).filter(([name]) => !/^npm_config_/iu.test(name)),
  );
}

async function repositoryStatus(directory) {
  const { stdout } = await run('git', ['status', '--porcelain=v1', '--untracked-files=all'], {
    cwd: directory,
  });
  return stdout;
}

async function git(directory, ...args) {
  const { stdout } = await run('git', args, { cwd: directory });
  return stdout.trim();
}

async function invokeCli(cli, repository, home, args) {
  const options = {
    cwd: repository,
    env: {
      ...process.env,
      CODEX_HOME: join(home, '.codex'),
      FORCE_COLOR: '0',
      HOME: home,
      NO_COLOR: '1',
      PATH: `${cli.launcherDir}${delimiter}${process.env.PATH ?? ''}`,
      USERPROFILE: home,
    },
  };
  try {
    const { stdout, stderr } = await run(process.execPath, [cli.cliPath, ...args], options);
    return { code: 0, stdout, stderr };
  } catch (error) {
    return {
      code: typeof error.code === 'number' ? error.code : 1,
      stdout: typeof error.stdout === 'string' ? error.stdout : '',
      stderr: typeof error.stderr === 'string' ? error.stderr : String(error),
    };
  }
}

async function packCandidate(destination, version) {
  const env = { ...process.env, TBD_VERSION_OVERRIDE: version };
  // Build explicitly instead of depending on prepack: security-conscious developer
  // environments commonly export ignore-scripts, but an explicit project build is safe
  // and the candidate proof must never package stale or missing dist output.
  await runPackageManager('pnpm', ['build'], { cwd: packageDir, env });
  await runPackageManager('pnpm', ['pack', '--pack-destination', destination], {
    cwd: packageDir,
    // The explicit build above is the only trusted project script this proof needs.
    env: { ...env, NPM_CONFIG_IGNORE_SCRIPTS: 'true' },
  });
}

async function packPublished(destination, version) {
  // Exact historical first-party artifacts only; npm pack does not run lifecycle scripts.
  await runPackageManager(
    'npm',
    ['pack', `get-tbd@${version}`, '--pack-destination', destination, '--ignore-scripts'],
    {
      cwd: destination,
      // pnpm exports its config as npm_config_* variables to child scripts. In
      // particular, an ambient `before` policy can hide the historical baseline we
      // intentionally selected. Exact first-party versions are exempt from the
      // third-party cool-off and are fetched without lifecycle scripts.
      env: withoutAmbientNpmConfig(),
    },
  );
}

async function findOnlyArchive(directory) {
  const archives = (await readdir(directory)).filter((entry) => entry.endsWith('.tgz'));
  invariant(
    archives.length === 1,
    `Expected one archive in ${directory}, found ${archives.length}`,
  );
  return join(directory, archives[0]);
}

async function extractPackage(archive, destination, dependencyTree) {
  await mkdir(destination, { recursive: true });
  await run('tar', ['-xzf', archive, '-C', destination]);
  const extracted = join(destination, 'package');
  await symlink(dependencyTree, join(extracted, 'node_modules'), 'junction');
  const manifest = JSON.parse(await readFile(join(extracted, 'package.json'), 'utf8'));
  invariant(manifest.name === 'get-tbd', `Unexpected package name ${String(manifest.name)}`);
  const bin = typeof manifest.bin === 'string' ? manifest.bin : manifest.bin?.tbd;
  invariant(typeof bin === 'string', `get-tbd@${String(manifest.version)} has no tbd binary`);
  const cliPath = join(extracted, bin);
  await access(cliPath);
  // The package entry point, for scenarios that import the published parser and schemas
  // instead of driving the published CLI.
  const entry = manifest.exports?.['.']?.default ?? manifest.main;
  invariant(typeof entry === 'string', `get-tbd@${String(manifest.version)} has no entry point`);
  const indexPath = join(extracted, entry);
  await access(indexPath);
  const launcherDir = join(destination, 'qa-bin');
  await mkdir(launcherDir);
  if (process.platform === 'win32') {
    await writeFile(
      join(launcherDir, 'tbd.cmd'),
      `@echo off\r\n"${process.execPath}" "${cliPath}" %*\r\n`,
    );
  } else {
    await symlink(cliPath, join(launcherDir, 'tbd'));
  }
  return { cliPath, indexPath, launcherDir, manifest };
}

async function initializeRepository(repository) {
  await mkdir(repository, { recursive: true });
  await git(repository, 'init', '--initial-branch=main');
  await git(repository, 'config', 'user.name', 'tbd upgrade QA');
  await git(repository, 'config', 'user.email', 'tbd-upgrade-qa@example.invalid');
  await git(repository, 'config', 'commit.gpgSign', 'false');
  await git(repository, 'commit', '--allow-empty', '--message', 'Initialize upgrade QA');
}

async function addPreservationProbes(configPath) {
  const config = parseYaml(await readFile(configPath, 'utf8'));
  config.upgrade_qa = { preserve: 'top-level-value' };
  config.integrations = {
    ...(config.integrations ?? {}),
    upgrade_qa_provider: {
      custom: { preserve: 'provider-value' },
      enabled: false,
    },
  };
  await writeFile(configPath, stringifyYaml(config, { lineWidth: 0 }));
}

/**
 * The tbd data-sync worktree of a repository, and the data directory inside it.
 *
 * The worktree is attached to the *common* git directory, so it is shared by every
 * linked worktree of the repository and is not found by joining `.git` to the
 * repository path.
 */
async function worktreeDirectory(repository) {
  const commonDirOutput = await git(repository, 'rev-parse', '--git-common-dir');
  const commonDir = isAbsolute(commonDirOutput)
    ? commonDirOutput
    : resolve(repository, commonDirOutput);
  return join(commonDir, 'tbd', 'data-sync-worktree');
}

async function dataSyncDirectory(repository) {
  return join(await worktreeDirectory(repository), '.tbd', 'data-sync');
}

async function snapshotIssueData(repository) {
  const dataDir = await dataSyncDirectory(repository);
  const snapshot = {};
  for (const relativeDir of ['issues', 'mappings']) {
    const directory = join(dataDir, relativeDir);
    for (const filename of (await readdir(directory)).sort()) {
      snapshot[`${relativeDir}/${filename}`] = await readFile(join(directory, filename), 'utf8');
    }
  }
  return snapshot;
}

async function assertHardenedGhInstallers(repository, name) {
  const claudeInstaller = await readFile(
    join(repository, '.claude', 'scripts', 'ensure-gh-cli.sh'),
    'utf8',
  );
  const codexInstaller = await readFile(join(repository, '.codex', 'ensure-gh-cli.sh'), 'utf8');
  invariant(
    claudeInstaller === codexInstaller,
    `${name}: Claude and Codex received different GitHub CLI installers`,
  );
  invariant(
    claudeInstaller.includes('# Automated GitHub CLI setup for agent sessions'),
    `${name}: installer carries a surface-specific header`,
  );
  invariant(
    claudeInstaller.includes('INSTALL_TMP_DIR=$(mktemp -d "${TMPDIR:-/tmp}/tbd-gh.XXXXXX")') &&
      claudeInstaller.includes('trap cleanup EXIT') &&
      claudeInstaller.includes('ARCHIVE_PATH="${INSTALL_TMP_DIR}/${ASSET}"'),
    `${name}: installer does not isolate downloaded and extracted files`,
  );
  invariant(
    claudeInstaller.includes('INSTALL_STAGING=$(mktemp "$HOME/.local/bin/.gh.XXXXXX")') &&
      claudeInstaller.includes('mv -f "$INSTALL_STAGING" "$HOME/.local/bin/gh"'),
    `${name}: installer does not replace the destination atomically`,
  );
  invariant(
    !claudeInstaller.includes('EXTRACT_DIR="/tmp/') &&
      !claudeInstaller.includes('curl -fsSL -o "/tmp/${ASSET}"'),
    `${name}: installer writes to a shared fixed temporary path`,
  );
}

async function validateScenario({
  candidate,
  candidateVersion,
  expectedBaselineFormat,
  expectManagedScriptChange,
  expectOldClientToWork,
  root,
  baseline,
  baselineVersion,
  name,
}) {
  const repository = join(root, `${name}-repository`);
  const home = join(root, `${name}-home`);
  await initializeRepository(repository);
  await mkdir(home, { recursive: true });

  const baselineSetup = await invokeCli(baseline, repository, home, [
    'setup',
    '--auto',
    '--prefix=qa',
  ]);
  invariant(
    baselineSetup.code === 0,
    `${name}: baseline setup failed\n${baselineSetup.stdout}\n${baselineSetup.stderr}`,
  );
  const create = await invokeCli(baseline, repository, home, [
    'create',
    'Upgrade QA seed',
    '--type=task',
  ]);
  invariant(
    create.code === 0,
    `${name}: baseline create failed\n${create.stdout}\n${create.stderr}`,
  );

  const configPath = join(repository, '.tbd', 'config.yml');
  const baselineConfig = parseYaml(await readFile(configPath, 'utf8'));
  invariant(
    baselineConfig.tbd_format === expectedBaselineFormat,
    `${name}: expected ${expectedBaselineFormat}, found ${String(baselineConfig.tbd_format)}`,
  );
  await addPreservationProbes(configPath);
  await git(repository, 'add', '--all');
  await git(repository, 'commit', '--message', `Record ${baselineVersion} baseline`);
  invariant((await repositoryStatus(repository)) === '', `${name}: baseline repository is dirty`);
  const issueDataBefore = await snapshotIssueData(repository);

  const firstUpgrade = await invokeCli(candidate, repository, home, ['setup', '--auto']);
  const firstOutput = firstUpgrade.stdout + firstUpgrade.stderr;
  invariant(
    firstUpgrade.code === 0,
    `${name}: candidate setup failed\n${firstUpgrade.stdout}\n${firstUpgrade.stderr}`,
  );
  invariant(
    !firstOutput.includes('Cleaned up legacy'),
    `${name}: candidate misclassified current hooks as legacy`,
  );
  invariant(
    firstOutput.includes(`Recorded tbd setup version`) && firstOutput.includes(candidateVersion),
    `${name}: candidate did not report the setup version transition`,
  );
  invariant(
    firstOutput.includes('Review and commit the generated repository changes.'),
    `${name}: candidate omitted the commit action`,
  );

  const upgradedConfig = parseYaml(await readFile(configPath, 'utf8'));
  invariant(
    upgradedConfig.tbd_format === CANDIDATE_FORMAT,
    `${name}: candidate did not produce ${CANDIDATE_FORMAT}`,
  );
  invariant(
    upgradedConfig.tbd_version === candidateVersion,
    `${name}: config reports ${String(upgradedConfig.tbd_version)}, expected ${candidateVersion}`,
  );
  invariant(
    upgradedConfig.tbd_fallback_version === candidateVersion,
    `${name}: config fallback reports ${String(upgradedConfig.tbd_fallback_version)}, ` +
      `expected ${candidateVersion}`,
  );
  invariant(
    upgradedConfig.upgrade_qa?.preserve === 'top-level-value',
    `${name}: top-level config probe was lost`,
  );
  invariant(
    upgradedConfig.integrations?.upgrade_qa_provider?.custom?.preserve === 'provider-value',
    `${name}: provider config probe was lost`,
  );
  const upgrades = upgradedConfig.tbd_upgrades ?? [];
  invariant(
    upgrades.at(-1)?.version === candidateVersion,
    `${name}: upgrade history does not end at ${candidateVersion}`,
  );
  invariant(
    JSON.stringify(await snapshotIssueData(repository)) === JSON.stringify(issueDataBefore),
    `${name}: setup changed issue or mapping data`,
  );

  // Stage inside the disposable repository so the snapshot also covers any newly
  // generated, previously untracked files.
  await git(repository, 'add', '--all');
  const changedFiles = (await git(repository, 'diff', '--cached', '--name-only'))
    .split('\n')
    .filter(Boolean);
  const unexpectedFiles = changedFiles.filter((path) => !managedUpgradePaths.has(path));
  invariant(
    unexpectedFiles.length === 0,
    `${name}: upgrade changed non-managed paths: ${unexpectedFiles.join(', ')}`,
  );
  const expectedChangedFiles = ['.tbd/config.yml'];
  if (expectManagedScriptChange) {
    expectedChangedFiles.push('.claude/scripts/tbd-session.sh', '.codex/tbd-session.sh');
  }
  for (const expected of expectedChangedFiles) {
    invariant(changedFiles.includes(expected), `${name}: expected ${expected} in the upgrade diff`);
  }
  if (!expectManagedScriptChange) {
    for (const stable of ['.claude/scripts/tbd-session.sh', '.codex/tbd-session.sh']) {
      invariant(
        !changedFiles.includes(stable),
        `${name}: compatible patch upgrade unexpectedly rewrote ${stable}`,
      );
    }
  }
  const sessionScript = await readFile(
    join(repository, '.claude', 'scripts', 'tbd-session.sh'),
    'utf8',
  );
  invariant(
    sessionScript.includes('tbd config get tbd_format'),
    `${name}: format compatibility probe is missing`,
  );
  invariant(
    sessionScript.includes('npx --yes "get-tbd@$configured_fallback_version"'),
    `${name}: session fallback does not read the exact configured version`,
  );
  invariant(
    !/get-tbd@\d+\.\d+\.\d+/u.test(sessionScript),
    `${name}: session script embeds a release version`,
  );
  await assertHardenedGhInstallers(repository, name);

  const firstDiff = await git(repository, 'diff', '--cached', '--binary');
  const repeatedUpgrade = await invokeCli(candidate, repository, home, ['setup', '--auto']);
  invariant(
    repeatedUpgrade.code === 0,
    `${name}: repeated candidate setup failed\n${repeatedUpgrade.stdout}\n${repeatedUpgrade.stderr}`,
  );
  invariant(
    !(repeatedUpgrade.stdout + repeatedUpgrade.stderr).includes('Cleaned up legacy'),
    `${name}: repeated setup claimed legacy cleanup`,
  );
  invariant(
    !(repeatedUpgrade.stdout + repeatedUpgrade.stderr).includes('Recorded tbd setup version'),
    `${name}: repeated setup recorded a duplicate version`,
  );
  invariant(
    (await git(repository, 'diff', '--binary')) === '',
    `${name}: repeated setup changed files after the staged upgrade snapshot`,
  );
  invariant(
    (await git(repository, 'diff', '--cached', '--binary')) === firstDiff,
    `${name}: repeated setup changed the upgrade diff`,
  );

  const configBeforeOldClient = await readFile(configPath, 'utf8');
  const oldClientArgs = expectOldClientToWork
    ? ['status']
    : ['create', 'Rejected stale-client write'];
  const oldClient = await invokeCli(baseline, repository, home, oldClientArgs);
  if (expectOldClientToWork) {
    invariant(
      oldClient.code === 0,
      `${name}: same-format baseline stopped working\n${oldClient.stdout}\n${oldClient.stderr}`,
    );
  } else {
    invariant(
      oldClient.code !== 0,
      `${name}: older-format client accepted the ${CANDIDATE_FORMAT} repository`,
    );
    invariant(
      /newer version of tbd|newer tbd version|supports up to format/iu.test(
        oldClient.stdout + oldClient.stderr,
      ),
      `${name}: older-format rejection omitted the upgrade explanation`,
    );
  }
  invariant(
    (await readFile(configPath, 'utf8')) === configBeforeOldClient,
    `${name}: old client changed config while checking compatibility`,
  );
  if (!expectOldClientToWork) {
    invariant(
      JSON.stringify(await snapshotIssueData(repository)) === JSON.stringify(issueDataBefore),
      `${name}: older-format client changed issue or mapping data`,
    );
  }

  const list = await invokeCli(candidate, repository, home, ['list', '--json']);
  invariant(
    list.code === 0 && list.stdout.includes('Upgrade QA seed'),
    `${name}: seed issue missing`,
  );
  console.log(
    `Packed upgrade proof passed: ${baselineVersion} (${expectedBaselineFormat}) -> ` +
      `${candidateVersion} (${CANDIDATE_FORMAT})`,
  );
}

async function validateLegacyRemoteSyncUpgrade({
  baseline,
  baselineVersion,
  candidate,
  candidateVersion,
  root,
}) {
  const seedRepository = join(root, 'legacy-remote-seed');
  const bareRemote = join(root, 'legacy-remote.git');
  const repository = join(root, 'legacy-remote-clone');
  const home = join(root, 'legacy-remote-home');
  await initializeRepository(seedRepository);
  await mkdir(home, { recursive: true });

  const baselineSetup = await invokeCli(baseline, seedRepository, home, [
    'setup',
    '--auto',
    '--prefix=qa',
  ]);
  invariant(
    baselineSetup.code === 0,
    `legacy-remote: baseline setup failed\n${baselineSetup.stdout}\n${baselineSetup.stderr}`,
  );
  await git(seedRepository, 'add', '--all');
  await git(seedRepository, 'commit', '--message', `Record ${baselineVersion} baseline`);

  const historicalCreate = await invokeCli(baseline, seedRepository, home, [
    'create',
    'Legacy historical seed',
    '--type=task',
  ]);
  invariant(
    historicalCreate.code === 0,
    `legacy-remote: baseline create failed\n${historicalCreate.stdout}\n${historicalCreate.stderr}`,
  );

  // Reproduce the released f06 state found in jlevy/tryscript: a remote tbd-sync
  // branch once contained valid issues, a legacy sync later removed the entire
  // scaffold, and unrelated branch files still need to survive recovery.
  const oldWorktree = join(seedRepository, '.git', 'tbd', 'data-sync-worktree');
  await git(oldWorktree, 'add', '--force', '.tbd/data-sync');
  await git(oldWorktree, 'commit', '--message', 'Record historical tracker data');
  await writeFile(join(oldWorktree, 'legacy-marker.txt'), 'preserve me\n');
  await git(oldWorktree, 'add', 'legacy-marker.txt');
  await git(oldWorktree, 'commit', '--message', 'Record legacy branch file');
  await git(oldWorktree, 'rm', '-r', '.tbd/data-sync');
  await git(oldWorktree, 'commit', '--message', 'Legacy sync removed data scaffold');

  await mkdir(bareRemote);
  await git(bareRemote, 'init', '--bare');
  await git(seedRepository, 'remote', 'add', 'origin', bareRemote);
  await git(seedRepository, 'push', '--set-upstream', 'origin', 'main');
  await git(bareRemote, 'symbolic-ref', 'HEAD', 'refs/heads/main');
  await git(oldWorktree, 'push', 'origin', 'tbd-sync');
  await run('git', ['clone', bareRemote, repository]);
  await git(repository, 'config', 'user.name', 'tbd upgrade QA');
  await git(repository, 'config', 'user.email', 'tbd-upgrade-qa@example.invalid');
  await git(repository, 'config', 'commit.gpgSign', 'false');

  const upgrade = await invokeCli(candidate, repository, home, ['setup', '--auto']);
  invariant(
    upgrade.code === 0,
    `legacy-remote: candidate setup failed\n${upgrade.stdout}\n${upgrade.stderr}`,
  );
  invariant(
    /Restored \d+ missing tbd-sync data files from Git history/u.test(
      upgrade.stdout + upgrade.stderr,
    ),
    'legacy-remote: candidate did not report historical data recovery',
  );
  const configPath = join(repository, '.tbd', 'config.yml');
  const config = parseYaml(await readFile(configPath, 'utf8'));
  invariant(
    config.tbd_format === CANDIDATE_FORMAT,
    `legacy-remote: candidate did not produce ${CANDIDATE_FORMAT}`,
  );
  invariant(
    config.tbd_version === candidateVersion,
    `legacy-remote: config reports ${String(config.tbd_version)}, expected ${candidateVersion}`,
  );

  const worktree = await worktreeDirectory(repository);
  await access(join(worktree, '.tbd', 'data-sync', 'meta.yml'));
  invariant(
    (await readFile(join(worktree, 'legacy-marker.txt'), 'utf8')) === 'preserve me\n',
    'legacy-remote: upgrade discarded a legacy branch file',
  );

  const create = await invokeCli(candidate, repository, home, [
    'create',
    'Legacy remote upgrade probe',
    '--type=task',
  ]);
  invariant(
    create.code === 0,
    `legacy-remote: first create failed\n${create.stdout}\n${create.stderr}`,
  );
  const list = await invokeCli(candidate, repository, home, ['list', '--json']);
  invariant(
    list.code === 0 && list.stdout.includes('Legacy historical seed'),
    `legacy-remote: historical issue was not recovered\n${list.stdout}\n${list.stderr}`,
  );
  invariant(
    list.stdout.includes('Legacy remote upgrade probe'),
    'legacy-remote: newly created issue is missing',
  );
  const push = await invokeCli(candidate, repository, home, ['sync', '--issues', '--push']);
  invariant(push.code === 0, `legacy-remote: sync failed\n${push.stdout}\n${push.stderr}`);
  await git(bareRemote, 'show', 'tbd-sync:.tbd/data-sync/meta.yml');
  invariant(
    (await git(bareRemote, 'show', 'tbd-sync:legacy-marker.txt')) === 'preserve me',
    'legacy-remote: pushed data branch discarded a legacy branch file',
  );

  const statusBeforeRepeat = await repositoryStatus(repository);
  const repeated = await invokeCli(candidate, repository, home, ['setup', '--auto']);
  invariant(
    repeated.code === 0,
    `legacy-remote: repeated setup failed\n${repeated.stdout}\n${repeated.stderr}`,
  );
  invariant(
    (await repositoryStatus(repository)) === statusBeforeRepeat,
    'legacy-remote: repeated setup changed the repository diff',
  );
  console.log(
    `Packed legacy-remote proof passed: ${baselineVersion} (f06) -> ` +
      `${candidateVersion} (${CANDIDATE_FORMAT})`,
  );
}

/**
 * Split an issue file into its YAML front matter and its Markdown body.
 *
 * Issue files are a `---` fenced YAML block followed by the description as Markdown, so
 * neither half can be reached with `parseYaml` on the whole file.
 */
async function readIssueFile(path) {
  const text = await readFile(path, 'utf8');
  const fence = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/u.exec(text);
  invariant(fence, `Issue file has no front matter: ${path}`);
  return { front: parseYaml(fence[1]), body: text.slice(fence[0].length) };
}

/** Mutate an issue file's front matter in place, leaving its body untouched. */
async function patchIssueFrontMatter(path, patch) {
  const { front, body } = await readIssueFile(path);
  patch(front);
  await writeFile(path, `---\n${stringifyYaml(front, { lineWidth: 0 })}---\n${body}`);
}

function parseCliJson(result, description) {
  invariant(result.code === 0, `${description} failed\n${result.stdout}\n${result.stderr}`);
  try {
    return JSON.parse(result.stdout);
  } catch (error) {
    throw new Error(`${description} did not return JSON (${String(error)})\n${result.stdout}`);
  }
}

/**
 * Fixed values for the coexistence scenario, named so each assertion says what it means.
 *
 * `COEXISTENCE_WORKSPACE_UPDATED_AT` is far in the future only to make the workspace copy
 * unambiguously the newer of the two sides, which is what decides the merge winner.
 */
const COEXISTENCE_DESCRIPTION = 'Description the candidate wrote';
const COEXISTENCE_COMMENT_LOCAL_ID = '01CMT0000000000000000000A';
const COEXISTENCE_COMMENT_AT = '2026-01-01T00:00:00.000Z';
const COEXISTENCE_WORKSPACE_UPDATED_AT = '2099-12-31T23:59:59.000Z';
const COEXISTENCE_SEED_TIMESTAMP = '2026-01-02T03:04:05.000Z';
const COEXISTENCE_RUN_ID = 'coexistence-run';

/**
 * f08 contract T4: two clients on different versions sharing one repository.
 *
 * The other scenarios each prove a *sequential* claim — an old repository, upgraded once,
 * still works. This one proves a *concurrent* claim: a clone on a published release and a
 * clone on the candidate, both live against one bare remote, read and write each other's
 * data without loss. That is the state a mixed-version team is actually in, because nobody
 * upgrades every machine at the same moment.
 *
 * It needs two clones rather than two directories because "sharing a repository" in tbd
 * means sharing the `tbd-sync` branch, so the interesting merges happen in git between two
 * working copies, not inside one process. It needs the real published tarball rather than
 * an old code path because the whole risk is behavior that cannot be seen by reading the
 * candidate's source.
 *
 * What each step proves, in the order the sequence builds it:
 *
 *   1. The baseline reads what the candidate wrote — beads created by the candidate list
 *      under the older client, with no migration step in between. The baseline is a plain
 *      `git clone` that never runs `setup`; its first `tbd sync` provisions the worktree.
 *   2. Attic entries survive the version gap in both directions: the baseline lists and
 *      shows a candidate-written conflict entry with its lost value intact, and restores a
 *      candidate-written entry back onto the issue. This is the load-bearing assertion for
 *      `tbd-ajq2`, which makes `tbd sync` write attic entries from a new code path — it may
 *      only do so once the format an older client reads is proven, so T4 gates ajq2 rather
 *      than depending on it. The entry format under test is the one ajq2 will emit
 *      (`writeAtticEntryFile` into the flat `attic/`, which is what `tbd attic` reads).
 *   3. The candidate reads back what the baseline wrote, after the baseline merged and
 *      pushed work of its own: a round trip, not a one-way read.
 *   4. Neither side's data is dropped by the other's merge — each client's bead is present
 *      at the end, an `extensions` namespace the older client does not understand comes
 *      back through it unchanged rather than stripped, and the bridge state it has no
 *      credentials to read (a link record and a journaled intent) survives its merge and
 *      push byte for byte, on the shared branch and in the candidate's checkout.
 *
 * Deliberately NOT asserted here: that the baseline's integration reader ACCEPTS
 * candidate-written bridge state. That is interpretation rather than preservation, and
 * `listIntentFiles` is reachable only through the credentialed sync path
 * (`integrations/core/sync-engine.ts`), so exercising it needs Linear or the mock server,
 * and this script has neither. It matters — an unrecognized intent makes `listIntentFiles`
 * throw for the whole provider — but the assertion belongs with T3 (`tbd-s4kb`,
 * mixed-version Linear convergence), which owns `tests/helpers/linear-mock-server.ts`.
 * Recorded so the gap is a decision rather than an oversight.
 */
async function validateCrossVersionCoexistence({
  baseline,
  baselineVersion,
  candidate,
  candidateVersion,
  root,
}) {
  const label = 'coexistence';
  const bareRemote = join(root, `${label}-remote.git`);
  const candidateRepo = join(root, `${label}-candidate`);
  const baselineRepo = join(root, `${label}-baseline`);
  const home = join(root, `${label}-home`);
  await mkdir(home, { recursive: true });

  // The candidate establishes the repository: one machine upgrades first and the rest of
  // the team follows, which is the sequence a mixed-version team actually goes through.
  await initializeRepository(candidateRepo);
  const setup = await invokeCli(candidate, candidateRepo, home, ['setup', '--auto', '--prefix=xv']);
  invariant(setup.code === 0, `${label}: candidate setup failed\n${setup.stdout}\n${setup.stderr}`);
  await git(candidateRepo, 'add', '--all');
  await git(candidateRepo, 'commit', '--message', `Record ${candidateVersion} scaffold`);

  const created = await invokeCli(candidate, candidateRepo, home, [
    'create',
    'Written by the candidate',
    '--type=task',
    '--description',
    COEXISTENCE_DESCRIPTION,
  ]);
  invariant(
    created.code === 0,
    `${label}: candidate create failed\n${created.stdout}\n${created.stderr}`,
  );

  const issuesDirectory = join(await dataSyncDirectory(candidateRepo), 'issues');
  const issueFiles = (await readdir(issuesDirectory)).filter((entry) => entry.endsWith('.md'));
  invariant(issueFiles.length === 1, `${label}: expected one issue, found ${issueFiles.length}`);
  const issueFile = join(issuesDirectory, issueFiles[0]);
  const issueUlid = (await readIssueFile(issueFile)).front.id;
  invariant(typeof issueUlid === 'string', `${label}: issue file has no id`);

  // ---- A real conflict entry, produced the way the code produces one today. ----
  //
  // Only the workspace importer and the integration runner write to the attic on this
  // build, and the importer cannot conflict on a plain field by construction: it passes
  // the older side as the merge base (`file/workspace.ts`), so one side always equals the
  // base and last-writer-wins has nothing to archive. The path that does archive is the
  // provider-comment postcondition — two `extensions` namespaces carrying different link
  // `id`s, at least one with a comment log, cannot be unioned into a single lineage, so
  // the losing namespace goes to the attic (`file/git.ts` preserveNamespaceComments).
  // That is also the shape a real integration writes.
  //
  // The namespace is written into the issue file directly because no CLI command sets
  // arbitrary `extensions` — an integration does, and this script has no provider.
  await patchIssueFrontMatter(issueFile, (front) => {
    front.extensions = {
      demo: {
        id: 'demo-issue-1',
        comments: [
          {
            local_id: COEXISTENCE_COMMENT_LOCAL_ID,
            at: COEXISTENCE_COMMENT_AT,
            body: 'from the provider',
          },
        ],
      },
    };
  });

  const saved = await invokeCli(candidate, candidateRepo, home, [
    'save',
    '--workspace',
    'xv-conflict',
  ]);
  invariant(saved.code === 0, `${label}: workspace save failed\n${saved.stdout}\n${saved.stderr}`);

  const workspaceIssues = join(candidateRepo, '.tbd', 'workspaces', 'xv-conflict', 'issues');
  const workspaceFiles = (await readdir(workspaceIssues)).filter((entry) => entry.endsWith('.md'));
  invariant(
    workspaceFiles.length === 1,
    `${label}: expected one saved workspace issue, found ${workspaceFiles.length}`,
  );
  // The workspace copy moves to a different provider link, and is the newer of the two, so
  // the importer takes it as the winner and archives the repository's namespace.
  await patchIssueFrontMatter(join(workspaceIssues, workspaceFiles[0]), (front) => {
    front.extensions.demo.id = 'demo-issue-2';
    front.extensions.demo.comments[0].body = 'from the other link';
    front.updated_at = COEXISTENCE_WORKSPACE_UPDATED_AT;
  });

  const importResult = await invokeCli(candidate, candidateRepo, home, [
    'import',
    '--workspace=xv-conflict',
    '--merge',
  ]);
  invariant(
    importResult.code === 0 &&
      /1 conflict\(s\) moved to attic/u.test(importResult.stdout + importResult.stderr),
    `${label}: candidate did not archive the losing provider namespace\n` +
      `${importResult.stdout}\n${importResult.stderr}`,
  );

  // ---- A candidate-written entry on a restorable field. ----
  //
  // `tbd attic restore` writes back only text fields (title, description, notes), and no
  // path on this build produces a conflict on one, for the reason above. So seed one entry
  // by hand — the f08 attic format, as an older sync would have left it — and have the
  // CANDIDATE restore it. That restore is what produces the entry the baseline is then
  // tested against: `buildRestorationAtticEntry` through `writeAtticEntryFile`, the same
  // writer every other entry goes through. The hand-written seed only has to be good
  // enough for the candidate to accept; the entry under test is genuinely candidate-written.
  const atticDirectory = join(await dataSyncDirectory(candidateRepo), 'attic');
  const seedFile = `${issueUlid}_${COEXISTENCE_SEED_TIMESTAMP.replace(/:/gu, '-')}_description.yml`;
  await writeFile(
    join(atticDirectory, seedFile),
    stringifyYaml(
      {
        entity_id: issueUlid,
        timestamp: COEXISTENCE_SEED_TIMESTAMP,
        field: 'description',
        lost_value: JSON.stringify('a description an older sync discarded'),
        winner_source: 'local',
        loser_source: 'remote',
        context: {
          local_version: 1,
          remote_version: 1,
          local_updated_at: COEXISTENCE_SEED_TIMESTAMP,
          remote_updated_at: COEXISTENCE_SEED_TIMESTAMP,
        },
      },
      { lineWidth: 0 },
    ),
  );
  const seedRestore = await invokeCli(candidate, candidateRepo, home, [
    'attic',
    'restore',
    issueUlid,
    COEXISTENCE_SEED_TIMESTAMP,
  ]);
  invariant(
    seedRestore.code === 0,
    `${label}: candidate could not read an f08 attic entry\n${seedRestore.stdout}\n${seedRestore.stderr}`,
  );

  const candidateEntries = parseCliJson(
    await invokeCli(candidate, candidateRepo, home, ['attic', 'list', '--json']),
    `${label}: candidate attic list --json`,
  );
  const restorable = candidateEntries.find(
    (entry) => entry.field === 'description' && entry.timestamp !== COEXISTENCE_SEED_TIMESTAMP,
  );
  invariant(
    restorable,
    `${label}: candidate restore did not archive the value it replaced\n` +
      JSON.stringify(candidateEntries),
  );

  // ---- Bridge state the older client cannot interpret. ----
  //
  // Link records and journaled intents live on the same `tbd-sync` branch as the beads,
  // under `bridge/<provider>/`, and a client with no credentials for that provider never
  // reads them — it only merges and pushes the branch they sit on. So the claim here is
  // data preservation, not interpretation: whatever the candidate wrote must come back
  // byte for byte after a merge and a push by the older client. Whether the baseline's
  // reader ACCEPTS a candidate-written intent is a separate claim that needs a live
  // provider, and belongs with T3 (`tbd-s4kb`); see the note above.
  //
  // Written directly because reaching the real writers takes credentials this script does
  // not have. The shapes are the ones `lib/schemas.ts` defines (`LinkRecordSchema`,
  // `IntentFileSchema`), so a future reader-side assertion can use the same fixtures.
  const bridgeDirectory = join(await dataSyncDirectory(candidateRepo), 'bridge', 'linear');
  await mkdir(join(bridgeDirectory, 'links'), { recursive: true });
  await mkdir(join(bridgeDirectory, 'intents'), { recursive: true });
  const linkRecordPath = join(bridgeDirectory, 'links', `${issueUlid}.yml`);
  const intentFilePath = join(bridgeDirectory, 'intents', `${COEXISTENCE_RUN_ID}.yml`);
  await writeFile(
    linkRecordPath,
    stringifyYaml({
      base: {
        assignee: null,
        description_hash: `sha256v7:${'0'.repeat(64)}`,
        labels: ['coexistence'],
        priority: 2,
        status: 'open',
        title: 'Written by the candidate',
      },
      bead_id: issueUlid,
      external_id: 'f53df50f-cbd8-4069-bb90-8d27b86cc51e',
      external_key: 'XV-1',
      external_url: 'https://linear.app/example/issue/XV-1',
      remote_updated_at: COEXISTENCE_COMMENT_AT,
      state: 'linked',
      synced_at: COEXISTENCE_COMMENT_AT,
      type: 'lk',
    }),
  );
  await writeFile(
    intentFilePath,
    stringifyYaml({
      type: 'in',
      run_id: COEXISTENCE_RUN_ID,
      provider: 'linear',
      created_at: COEXISTENCE_COMMENT_AT,
      ops: [],
    }),
  );
  const linkRecordBefore = await readFile(linkRecordPath, 'utf8');
  const intentFileBefore = await readFile(intentFilePath, 'utf8');

  // ---- Publish, then bring the second machine up on the published release. ----
  await mkdir(bareRemote);
  await git(bareRemote, 'init', '--bare');
  await git(bareRemote, 'symbolic-ref', 'HEAD', 'refs/heads/main');
  await git(candidateRepo, 'remote', 'add', 'origin', bareRemote);
  await git(candidateRepo, 'push', '--set-upstream', 'origin', 'main');
  const firstPush = await invokeCli(candidate, candidateRepo, home, ['sync', '--issues', '--push']);
  invariant(
    firstPush.code === 0,
    `${label}: candidate push failed\n${firstPush.stdout}\n${firstPush.stderr}`,
  );

  // No `setup` on the baseline, deliberately: this is not an upgrade. The published client
  // already shares the candidate's format, so it must work from a plain clone and
  // provision its own data worktree on first sync.
  await run('git', ['clone', bareRemote, baselineRepo]);
  await git(baselineRepo, 'config', 'user.name', 'tbd upgrade QA');
  await git(baselineRepo, 'config', 'user.email', 'tbd-upgrade-qa@example.invalid');
  await git(baselineRepo, 'config', 'commit.gpgSign', 'false');
  const baselinePull = await invokeCli(baseline, baselineRepo, home, [
    'sync',
    '--issues',
    '--pull',
  ]);
  invariant(
    baselinePull.code === 0,
    `${label}: baseline ${baselineVersion} could not pull the candidate's data\n` +
      `${baselinePull.stdout}\n${baselinePull.stderr}`,
  );

  // 1. The baseline reads the candidate's beads.
  const baselineIssues = parseCliJson(
    await invokeCli(baseline, baselineRepo, home, ['list', '--json']),
    `${label}: baseline ${baselineVersion} list --json`,
  );
  invariant(
    baselineIssues.some((issue) => issue.title === 'Written by the candidate'),
    `${label}: baseline ${baselineVersion} cannot see a bead the candidate wrote\n` +
      JSON.stringify(baselineIssues),
  );

  // 2. The baseline lists, shows and restores candidate-written attic entries.
  const baselineEntries = parseCliJson(
    await invokeCli(baseline, baselineRepo, home, ['attic', 'list', '--json']),
    `${label}: baseline ${baselineVersion} attic list --json`,
  );
  const archivedNamespace = baselineEntries.find((entry) => entry.field === 'extensions.demo');
  invariant(
    archivedNamespace && typeof archivedNamespace.timestamp === 'string',
    `${label}: baseline ${baselineVersion} cannot list the conflict entry the candidate wrote\n` +
      JSON.stringify(baselineEntries),
  );
  const shown = await invokeCli(baseline, baselineRepo, home, [
    'attic',
    'show',
    archivedNamespace.id,
    archivedNamespace.timestamp,
  ]);
  invariant(
    shown.code === 0 &&
      shown.stdout.includes('demo-issue-1') &&
      shown.stdout.includes('from the provider'),
    `${label}: baseline ${baselineVersion} lost the archived namespace's contents\n` +
      `${shown.stdout}\n${shown.stderr}`,
  );

  const restored = await invokeCli(baseline, baselineRepo, home, [
    'attic',
    'restore',
    restorable.id,
    restorable.timestamp,
  ]);
  invariant(
    restored.code === 0,
    `${label}: baseline ${baselineVersion} could not restore a candidate-written attic entry\n` +
      `${restored.stdout}\n${restored.stderr}`,
  );
  const restoredShow = await invokeCli(baseline, baselineRepo, home, ['show', restorable.id]);
  invariant(
    restoredShow.code === 0 && restoredShow.stdout.includes(COEXISTENCE_DESCRIPTION),
    `${label}: baseline ${baselineVersion} restore did not write the archived value back\n` +
      `${restoredShow.stdout}\n${restoredShow.stderr}`,
  );

  // 3 and 4. The baseline adds work of its own and pushes; the candidate merges it, and
  //          nothing either side wrote is dropped on the way through.
  const baselineCreate = await invokeCli(baseline, baselineRepo, home, [
    'create',
    'Written by the baseline',
    '--type=task',
  ]);
  invariant(
    baselineCreate.code === 0,
    `${label}: baseline create failed\n${baselineCreate.stdout}\n${baselineCreate.stderr}`,
  );
  const baselinePush = await invokeCli(baseline, baselineRepo, home, [
    'sync',
    '--issues',
    '--push',
  ]);
  invariant(
    baselinePush.code === 0,
    `${label}: baseline ${baselineVersion} could not push\n` +
      `${baselinePush.stdout}\n${baselinePush.stderr}`,
  );

  const branchFiles = await git(bareRemote, 'ls-tree', '-r', '--name-only', 'tbd-sync');
  for (const path of [
    `.tbd/data-sync/bridge/linear/links/${issueUlid}.yml`,
    `.tbd/data-sync/bridge/linear/intents/${COEXISTENCE_RUN_ID}.yml`,
  ]) {
    invariant(
      branchFiles.split('\n').includes(path),
      `${label}: ${baselineVersion} dropped ${path} from the shared branch\n${branchFiles}`,
    );
  }

  const candidatePull = await invokeCli(candidate, candidateRepo, home, ['sync', '--issues']);
  invariant(
    candidatePull.code === 0,
    `${label}: candidate could not merge the baseline's push\n` +
      `${candidatePull.stdout}\n${candidatePull.stderr}`,
  );
  const finalIssues = parseCliJson(
    await invokeCli(candidate, candidateRepo, home, ['list', '--all', '--json']),
    `${label}: candidate list --all --json`,
  );
  const titles = finalIssues.map((issue) => issue.title);
  invariant(
    titles.includes('Written by the baseline'),
    `${label}: the candidate lost a bead the ${baselineVersion} client created\n${titles.join(', ')}`,
  );
  invariant(
    titles.includes('Written by the candidate'),
    `${label}: the round trip through ${baselineVersion} lost the candidate's own bead\n` +
      titles.join(', '),
  );

  const final = await readIssueFile(issueFile);
  const demo = final.front.extensions?.demo;
  invariant(
    demo?.id === 'demo-issue-2' &&
      demo.comments?.length === 1 &&
      demo.comments[0].local_id === COEXISTENCE_COMMENT_LOCAL_ID &&
      demo.comments[0].body === 'from the other link',
    `${label}: ${baselineVersion} altered an extensions namespace it does not understand\n` +
      JSON.stringify(demo),
  );
  invariant(
    final.body.trim() === COEXISTENCE_DESCRIPTION,
    `${label}: the description the ${baselineVersion} client restored did not come back\n` +
      final.body,
  );

  invariant(
    (await readFile(linkRecordPath, 'utf8')) === linkRecordBefore,
    `${label}: the link record did not survive the round trip through ${baselineVersion}`,
  );
  invariant(
    (await readFile(intentFilePath, 'utf8')) === intentFileBefore,
    `${label}: the journaled intent did not survive the round trip through ${baselineVersion}`,
  );

  console.log(
    `Packed coexistence proof passed: ${candidateVersion} and ${baselineVersion} shared one ` +
      `${CANDIDATE_FORMAT} remote without data loss`,
  );
}

/**
 * Probes for the config round trip, one per nesting level the schema treats differently.
 *
 * A key survives an older client rewriting config only if the level it sits at is
 * `.passthrough()`. The levels are not uniform — `PolicyDefinitionSchema` is deliberately
 * not passthrough while the three clauses inside it are — so a probe at one level says
 * nothing about another, and each has to be checked where it actually lives.
 *
 * `POLICY_SIBLING_PROBE` is the negative control: it must be DROPPED. Without it a test
 * that only checks for survival passes just as well against a client that rewrites
 * nothing at all, which is not the claim.
 *
 * Any sprint change that adds a config key adds a probe here, at the key's own level.
 */
const CONFIG_PROBES = {
  topLevel: ['upgrade_qa', 'preserve'],
  identity: ['integrations', 'linear', 'identity', 'qa_probe'],
  policyClause: ['integrations', 'linear', 'policy', 'outbound', 'qa_probe'],
};
const POLICY_SIBLING_PROBE = ['integrations', 'linear', 'policy', 'qa_sibling'];

function readPath(value, path) {
  return path.reduce((current, key) => (current == null ? undefined : current[key]), value);
}

/**
 * f08 contract T1: a published client rewrites config without dropping the sprint's keys.
 *
 * `tbd config set` and `tbd setup --auto` both read the whole config, validate it, and
 * write it back. A key the reading schema does not declare survives that round trip only
 * where the level is `.passthrough()`, so every key this sprint adds is a bet that the
 * clients already in the field will carry it. The bet is checkable, and this is the check:
 * the candidate writes the config, then the OLD client rewrites it twice, and the keys
 * have to still be there at the level they were written.
 *
 * It runs against the newest published f08 release rather than the oldest, deliberately —
 * the opposite of the upgrade scenarios. Those ask what the weakest client can still
 * read; this one asks what the client a teammate is most likely to be running will
 * preserve, which is the release that ships alongside the keys.
 *
 * When that release IS the candidate — before the version bump, where the working tree
 * still carries the last published version — it falls back to the older same-format
 * baseline and says so. The scenario keeps running either way: a client comparing a build
 * against itself proves nothing, and silently skipping proves less.
 */
async function validateOldClientConfigRoundTrip({
  baseline,
  baselineVersion,
  candidate,
  candidateVersion,
  root,
}) {
  const label = 'config-round-trip';
  const repository = join(root, `${label}-repository`);
  const home = join(root, `${label}-home`);
  await initializeRepository(repository);
  await mkdir(home, { recursive: true });

  const setup = await invokeCli(candidate, repository, home, ['setup', '--auto', '--prefix=qat']);
  invariant(setup.code === 0, `${label}: candidate setup failed\n${setup.stdout}\n${setup.stderr}`);

  // Written on top of the candidate's own config rather than instead of it, so the round
  // trip carries everything a real repository has, not just the probes.
  const configPath = join(repository, '.tbd', 'config.yml');
  const config = parseYaml(await readFile(configPath, 'utf8'));
  config.upgrade_qa = { preserve: 'top-level-value' };
  config.integrations = {
    ...(config.integrations ?? {}),
    linear: {
      ...(config.integrations?.linear ?? {}),
      enabled: false,
      target: { team_key: 'OS' },
      identity: { qa_probe: 'identity-value' },
      policy: {
        qa_sibling: 'dropped-by-schema',
        outbound: { qa_probe: 'outbound-value' },
      },
    },
  };
  await writeFile(configPath, stringifyYaml(config, { lineWidth: 0 }));

  // Both write paths, because they validate and rewrite by different routes.
  const set = await invokeCli(baseline, repository, home, [
    'config',
    'set',
    'sync.remote',
    'origin',
  ]);
  invariant(
    set.code === 0,
    `${label}: baseline ${baselineVersion} config set failed\n${set.stdout}\n${set.stderr}`,
  );
  const baselineSetup = await invokeCli(baseline, repository, home, ['setup', '--auto']);
  invariant(
    baselineSetup.code === 0,
    `${label}: baseline ${baselineVersion} setup failed\n${baselineSetup.stdout}\n${baselineSetup.stderr}`,
  );

  const after = parseYaml(await readFile(configPath, 'utf8'));
  for (const [name, path] of Object.entries(CONFIG_PROBES)) {
    invariant(
      readPath(after, path) !== undefined,
      `${label}: ${baselineVersion} dropped the ${name} key ${path.join('.')}\n` +
        stringifyYaml(after, { lineWidth: 0 }),
    );
  }
  invariant(
    readPath(after, POLICY_SIBLING_PROBE) === undefined,
    `${label}: ${POLICY_SIBLING_PROBE.join('.')} survived, so this scenario cannot detect a ` +
      `dropped key and the assertions above prove nothing`,
  );

  // The old client records itself as the last to run setup — expected, that is what the
  // field means — but it must not walk the repository's format back.
  invariant(
    after.tbd_format === CANDIDATE_FORMAT,
    `${label}: ${baselineVersion} rewrote tbd_format to ${String(after.tbd_format)}`,
  );
  invariant(
    after.sync?.remote === 'origin',
    `${label}: ${baselineVersion} config set did not take effect`,
  );

  console.log(
    `Packed config round trip passed: ${candidateVersion} config survives ${baselineVersion} ` +
      `rewriting it`,
  );
}

/**
 * Fields a published f08 client is KNOWN to drop from a candidate-written link record.
 *
 * `LinkRecordSchema` and `BridgeBaseSchema` are deliberately not `.passthrough()`, unlike
 * the issue schema: a bridge record is tbd's own bookkeeping, and letting arbitrary keys
 * ride along in it would make every sync a guess about what is load-bearing. The cost is
 * that a field this build adds is stripped by any client that predates it, so a teammate
 * on that client silently discards it on their next sync.
 *
 * That is a decision, not an accident — the stability sprint plan records the minimum
 * client version these fields require. The list is here so the decision has to be made
 * again: add a field to a bridge record without adding it here and this gate fails.
 */
const BASELINE_DROPS_FROM_LINK_RECORD = ['refinement_state_id', 'refinement_slot'];
const BASELINE_DROPS_FROM_BRIDGE_BASE = ['slot'];

/**
 * f08 contract T2: the published client's own parser and schemas read what we write.
 *
 * Every other scenario drives a published CLI as a process, which proves the commands
 * work but says nothing about *why* when they do not. This one imports the published
 * package's exported `parseIssue`, `serializeIssue` and schemas and runs them directly
 * against candidate-written files, so a compatibility break is reported as the field it
 * happened to rather than as a command that misbehaved.
 *
 * What it pins, in the order the file formats matter:
 *
 *   1. Beads parse identically under both versions, including the two shapes most likely
 *      to disagree: a description that itself contains a `## Notes` heading (the
 *      delimiter the format uses to split description from notes), and a bead carrying
 *      f08 fields the older schema never declared.
 *   2. A bead that goes through the older client and comes back has lost nothing. Note
 *      what is NOT asserted: byte identity. The older client keeps fields it does not
 *      know — the issue schema is `.passthrough()` — but writes them in a different place,
 *      because its field order does not mention them. Reordering is churn; dropping is
 *      data loss, and only the second one is a compatibility break.
 *   3. A bridge link record loses exactly the fields we already decided it would, and no
 *      others, because those schemas are NOT passthrough. `base.description_hash` in
 *      particular survives, or the next sync on either side would see every description
 *      as changed.
 *   4. Config parses under the older schema with its keys intact.
 */
async function validateOldParserRoundTrip({
  baseline,
  baselineVersion,
  candidate,
  candidateVersion,
  root,
}) {
  const label = 'old-parser';
  const repository = join(root, `${label}-repository`);
  const home = join(root, `${label}-home`);
  await initializeRepository(repository);
  await mkdir(home, { recursive: true });

  const setup = await invokeCli(candidate, repository, home, ['setup', '--auto', '--prefix=qat']);
  invariant(setup.code === 0, `${label}: candidate setup failed\n${setup.stdout}\n${setup.stderr}`);

  // A description containing the very heading the format uses as a delimiter.
  const trickyCreate = await invokeCli(candidate, repository, home, [
    'create',
    'A description that contains the notes delimiter',
    '--description',
    'Prose before.\n\n## Notes\n\nProse after.',
    '--json',
  ]);
  invariant(
    trickyCreate.code === 0,
    `${label}: candidate create failed\n${trickyCreate.stdout}\n${trickyCreate.stderr}`,
  );
  const trickyId = JSON.parse(trickyCreate.stdout).id;
  const noted = await invokeCli(candidate, repository, home, [
    'update',
    trickyId,
    '--notes',
    'Working notes written separately.',
  ]);
  invariant(noted.code === 0, `${label}: candidate update --notes failed\n${noted.stderr}`);

  const plain = await invokeCli(candidate, repository, home, [
    'create',
    'A plain bead with no notes at all',
    '--description',
    'Just a description.',
    '--json',
  ]);
  invariant(plain.code === 0, `${label}: candidate create failed\n${plain.stderr}`);

  // f08 fields the published schema never declared. The issue schema is passthrough, so
  // the claim is that they survive; the link record below is the case where they do not.
  const held = await invokeCli(candidate, repository, home, [
    'create',
    'A bead the candidate put on hold',
    '--description',
    'Body.',
    '--json',
  ]);
  invariant(held.code === 0, `${label}: candidate create failed\n${held.stderr}`);
  const heldHold = await invokeCli(candidate, repository, home, [
    'update',
    JSON.parse(held.stdout).id,
    '--hold',
    'blocked',
  ]);
  invariant(heldHold.code === 0, `${label}: candidate update --hold failed\n${heldHold.stderr}`);

  const candidateExports = await import(pathToFileURL(candidate.indexPath).href);
  const baselineExports = await import(pathToFileURL(baseline.indexPath).href);

  const issuesDirectory = join(await dataSyncDirectory(repository), 'issues');
  const issueFiles = (await readdir(issuesDirectory)).filter((entry) => entry.endsWith('.md'));
  invariant(issueFiles.length === 3, `${label}: expected 3 beads, found ${issueFiles.length}`);

  for (const file of issueFiles) {
    const text = await readFile(join(issuesDirectory, file), 'utf8');
    const fromCandidate = candidateExports.parseIssue(text);
    const fromBaseline = baselineExports.parseIssue(text);
    invariant(
      isDeepStrictEqual(fromCandidate, fromBaseline),
      `${label}: ${baselineVersion} parses ${file} differently than ${candidateVersion}\n` +
        `${JSON.stringify(fromBaseline)}\n${JSON.stringify(fromCandidate)}`,
    );

    // Through the older client and back: reordering is allowed, losing a field is not.
    const rewritten = baselineExports.serializeIssue(fromBaseline);
    invariant(
      isDeepStrictEqual(candidateExports.parseIssue(rewritten), fromCandidate),
      `${label}: a bead rewritten by ${baselineVersion} no longer reads the same\n` +
        `${rewritten}\n${text}`,
    );
  }

  // A link record with every field this build writes, including the ones the published
  // schema does not declare. Written as a literal rather than produced by a sync, which
  // would need a credentialed provider this script does not have.
  const linkRecord = {
    type: 'lk',
    bead_id: JSON.parse(held.stdout).internalId,
    external_id: 'f53df50f-cbd8-4069-bb90-8d27b86cc51e',
    external_key: 'OS-1',
    external_url: 'https://linear.app/example/issue/OS-1',
    refinement_state_id: 'a-tracker-state-id',
    refinement_slot: 'in_qa',
    base: {
      title: 'A bead the candidate put on hold',
      status: 'open',
      slot: 'in_qa',
      priority: 2,
      labels: ['coexistence'],
      assignee: null,
      description_hash: `sha256v7:${'0'.repeat(64)}`,
    },
    remote_updated_at: '2026-01-01T00:00:00.000Z',
    synced_at: '2026-01-01T00:00:00.000Z',
    state: 'linked',
  };
  const candidateRecord = candidateExports.LinkRecordSchema.parse(linkRecord);
  for (const key of [
    ...Object.keys(linkRecord),
    ...Object.keys(linkRecord.base).map((k) => `base.${k}`),
  ]) {
    const [head, tail] = key.split('.');
    const present = tail ? tail in candidateRecord.base : head in candidateRecord;
    invariant(present, `${label}: the candidate's own LinkRecordSchema dropped ${key}`);
  }

  const baselineRecord = baselineExports.LinkRecordSchema.parse(linkRecord);
  const droppedTop = Object.keys(linkRecord).filter((key) => !(key in baselineRecord));
  const droppedBase = Object.keys(linkRecord.base).filter((key) => !(key in baselineRecord.base));
  invariant(
    isDeepStrictEqual(droppedTop.sort(), [...BASELINE_DROPS_FROM_LINK_RECORD].sort()) &&
      isDeepStrictEqual(droppedBase.sort(), [...BASELINE_DROPS_FROM_BRIDGE_BASE].sort()),
    `${label}: ${baselineVersion} drops a different set of link-record fields than recorded. ` +
      `Top level: [${droppedTop.join(', ')}], expected [${BASELINE_DROPS_FROM_LINK_RECORD.join(', ')}]. ` +
      `base: [${droppedBase.join(', ')}], expected [${BASELINE_DROPS_FROM_BRIDGE_BASE.join(', ')}]. ` +
      `A new bridge-record field needs a minimum-version decision before it ships.`,
  );
  invariant(
    baselineRecord.base.description_hash === linkRecord.base.description_hash,
    `${label}: ${baselineVersion} changed the stored description hash, so every pair would ` +
      `read as edited on its next sync`,
  );

  // Config, through the published schema rather than the published CLI (that is T1).
  const rawConfig = parseYaml(await readFile(join(repository, '.tbd', 'config.yml'), 'utf8'));
  const parsedConfig = baselineExports.ConfigSchema.parse(rawConfig);
  for (const key of Object.keys(rawConfig)) {
    invariant(
      key in parsedConfig,
      `${label}: ${baselineVersion} dropped the top-level config key ${key}`,
    );
  }
  invariant(
    parsedConfig.tbd_format === CANDIDATE_FORMAT,
    `${label}: ${baselineVersion} read tbd_format as ${String(parsedConfig.tbd_format)}`,
  );

  console.log(
    `Packed parser proof passed: ${baselineVersion} reads ${candidateVersion} beads, link ` +
      `records and config`,
  );
}

const sourceStatusBefore = await repositoryStatus(sourceRepoDir);
const temporaryDir = await mkdtemp(join(tmpdir(), 'tbd-upgrade-package-'));
try {
  const manifest = JSON.parse(await readFile(join(packageDir, 'package.json'), 'utf8'));
  const candidateVersion = manifest.version;
  invariant(typeof candidateVersion === 'string', 'Candidate package has no version');

  const dependencyTree = await realpath(join(packageDir, 'node_modules'));
  const candidateArchiveDir = join(temporaryDir, 'candidate-archive');
  const sameArchiveDir = join(temporaryDir, 'same-format-archive');
  const commonArchiveDir = join(temporaryDir, 'common-upgrade-archive');
  const previousArchiveDir = join(temporaryDir, 'previous-format-archive');
  await Promise.all([
    mkdir(candidateArchiveDir),
    mkdir(sameArchiveDir),
    mkdir(commonArchiveDir),
    mkdir(previousArchiveDir),
  ]);
  await packCandidate(candidateArchiveDir, candidateVersion);
  await Promise.all([
    packPublished(sameArchiveDir, sameFormatBaseline),
    packPublished(commonArchiveDir, commonUpgradeBaseline),
    packPublished(previousArchiveDir, previousFormatBaseline),
  ]);

  const candidate = await extractPackage(
    await findOnlyArchive(candidateArchiveDir),
    join(temporaryDir, 'candidate'),
    dependencyTree,
  );
  invariant(
    candidate.manifest.version === candidateVersion,
    `Packed candidate manifest reports ${String(candidate.manifest.version)}`,
  );
  const candidateVersionResult = await invokeCli(
    candidate,
    sourceRepoDir,
    join(temporaryDir, 'candidate-version-home'),
    ['--version'],
  );
  invariant(
    candidateVersionResult.code === 0 && candidateVersionResult.stdout.trim() === candidateVersion,
    `Packed candidate CLI does not report ${candidateVersion}`,
  );

  const sameFormatPackage = await extractPackage(
    await findOnlyArchive(sameArchiveDir),
    join(temporaryDir, 'same-format'),
    dependencyTree,
  );
  invariant(
    sameFormatPackage.manifest.version === sameFormatBaseline,
    `Same-format baseline resolved to ${String(sameFormatPackage.manifest.version)}`,
  );
  const commonUpgradePackage = await extractPackage(
    await findOnlyArchive(commonArchiveDir),
    join(temporaryDir, 'common-upgrade'),
    dependencyTree,
  );
  invariant(
    commonUpgradePackage.manifest.version === commonUpgradeBaseline,
    `Common upgrade baseline resolved to ${String(commonUpgradePackage.manifest.version)}`,
  );
  const previousFormatPackage = await extractPackage(
    await findOnlyArchive(previousArchiveDir),
    join(temporaryDir, 'previous-format'),
    dependencyTree,
  );
  invariant(
    previousFormatPackage.manifest.version === previousFormatBaseline,
    `Previous-format baseline resolved to ${String(previousFormatPackage.manifest.version)}`,
  );

  // A same-format baseline is only a comparison if the candidate is a *different*
  // version. Before the release bump the working tree still carries the last published
  // version, so baseline and candidate are the same build and the scenario degenerates
  // — setup reports no transition because there is none. Caught here, by name, rather
  // than surfacing later as a confusing invariant about missing output.
  invariant(
    candidateVersion !== sameFormatBaseline,
    `Candidate version ${candidateVersion} equals the same-format baseline. ` +
      `Bump the version before running this gate, or set TBD_UPGRADE_SAME_FORMAT_FROM ` +
      `to an earlier published release.`,
  );

  await validateScenario({
    baseline: sameFormatPackage,
    baselineVersion: sameFormatBaseline,
    candidate,
    candidateVersion,
    expectedBaselineFormat: 'f08',
    // A same-format upgrade should not churn the managed launcher. Setting this false
    // asserts the stronger thing: the script is byte-stable across a compatible patch.
    // It was `true` while this slot held a format-bump baseline, where the rewrite is
    // expected.
    expectManagedScriptChange: false,
    // The contract that distinguishes a same-format upgrade from a format bump: the
    // older client must still read a repository this candidate has written. That is
    // what makes an additive release additive, and it is only checkable once a
    // published build shares the candidate's format.
    expectOldClientToWork: true,
    name: 'latest-published',
    root: temporaryDir,
  });
  await validateScenario({
    baseline: commonUpgradePackage,
    baselineVersion: commonUpgradeBaseline,
    candidate,
    candidateVersion,
    expectedBaselineFormat: 'f06',
    expectManagedScriptChange: true,
    expectOldClientToWork: false,
    name: 'common-upgrade',
    root: temporaryDir,
  });
  await validateScenario({
    baseline: previousFormatPackage,
    baselineVersion: previousFormatBaseline,
    candidate,
    candidateVersion,
    expectedBaselineFormat: 'f06',
    expectManagedScriptChange: true,
    expectOldClientToWork: false,
    name: 'format-change',
    root: temporaryDir,
  });
  await validateLegacyRemoteSyncUpgrade({
    baseline: commonUpgradePackage,
    baselineVersion: commonUpgradeBaseline,
    candidate,
    candidateVersion,
    root: temporaryDir,
  });
  // The coexistence proof uses the same-format baseline, not the f06 one: the claim is
  // about two clients that share a format sharing a repository. An f06 client would fail
  // closed on an f08 remote, which is the *other* contract, covered by validateScenario.
  await validateCrossVersionCoexistence({
    baseline: sameFormatPackage,
    baselineVersion: sameFormatBaseline,
    candidate,
    candidateVersion,
    root: temporaryDir,
  });

  // The config round trip wants the newest published f08 release. Before the release bump
  // the working tree still carries the last published version, so that release IS the
  // candidate and comparing it against itself proves nothing; fall back to the older
  // same-format baseline, loudly, rather than skipping the scenario.
  const configRoundTripBaseline =
    latestFormatBaseline === candidateVersion ? sameFormatBaseline : latestFormatBaseline;
  if (configRoundTripBaseline !== latestFormatBaseline) {
    console.log(
      `Config round trip falls back to ${configRoundTripBaseline}: the candidate is ` +
        `${candidateVersion}, so ${latestFormatBaseline} is this same build. Bump the version ` +
        `to exercise the release the sprint's keys ship alongside.`,
    );
  }
  let configRoundTripPackage = sameFormatPackage;
  if (configRoundTripBaseline !== sameFormatBaseline) {
    const latestArchiveDir = join(temporaryDir, 'latest-format-archive');
    await mkdir(latestArchiveDir);
    await packPublished(latestArchiveDir, configRoundTripBaseline);
    configRoundTripPackage = await extractPackage(
      await findOnlyArchive(latestArchiveDir),
      join(temporaryDir, 'latest-format'),
      dependencyTree,
    );
    invariant(
      configRoundTripPackage.manifest.version === configRoundTripBaseline,
      `Config round trip baseline resolved to ${String(configRoundTripPackage.manifest.version)}`,
    );
  }
  await validateOldClientConfigRoundTrip({
    baseline: configRoundTripPackage,
    baselineVersion: configRoundTripBaseline,
    candidate,
    candidateVersion,
    root: temporaryDir,
  });

  // The parser proof uses the OLDEST published f08 release, not the newest: it asks what
  // the weakest client can still read, the same question the upgrade scenarios ask.
  await validateOldParserRoundTrip({
    baseline: sameFormatPackage,
    baselineVersion: sameFormatBaseline,
    candidate,
    candidateVersion,
    root: temporaryDir,
  });

  const sourceStatusAfter = await repositoryStatus(sourceRepoDir);
  invariant(
    sourceStatusAfter === sourceStatusBefore,
    `Packed upgrade proof changed the source checkout:\n${sourceStatusAfter}`,
  );
} finally {
  await rm(temporaryDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}
