#!/usr/bin/env node
/* global console, process */

/**
 * Prove a packed candidate upgrades real published repositories safely.
 *
 * Three baselines exercise the real-world path and distinct compatibility contracts:
 * - the latest published patch (0.7.1 / f08), the same-format case, whose client must
 *   keep working against a repository this candidate has touched;
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
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';

const execFileAsync = promisify(execFile);
const scriptDir = dirname(fileURLToPath(import.meta.url));
const packageDir = join(scriptDir, '..');
const sourceRepoDir = join(packageDir, '..', '..');
const sameFormatBaseline = process.env.TBD_UPGRADE_SAME_FORMAT_FROM ?? '0.7.1';
const commonUpgradeBaseline = process.env.TBD_UPGRADE_COMMON_FROM ?? '0.4.2';
const previousFormatBaseline = process.env.TBD_UPGRADE_PREVIOUS_FORMAT_FROM ?? '0.5.0';
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
  return { cliPath, launcherDir, manifest };
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

async function snapshotIssueData(repository) {
  const commonDirOutput = await git(repository, 'rev-parse', '--git-common-dir');
  const commonDir = isAbsolute(commonDirOutput)
    ? commonDirOutput
    : resolve(repository, commonDirOutput);
  const dataDir = join(commonDir, 'tbd', 'data-sync-worktree', '.tbd', 'data-sync');
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

  const commonDirOutput = await git(repository, 'rev-parse', '--git-common-dir');
  const commonDir = isAbsolute(commonDirOutput)
    ? commonDirOutput
    : resolve(repository, commonDirOutput);
  const worktree = join(commonDir, 'tbd', 'data-sync-worktree');
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

  const sourceStatusAfter = await repositoryStatus(sourceRepoDir);
  invariant(
    sourceStatusAfter === sourceStatusBefore,
    `Packed upgrade proof changed the source checkout:\n${sourceStatusAfter}`,
  );
} finally {
  await rm(temporaryDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}
