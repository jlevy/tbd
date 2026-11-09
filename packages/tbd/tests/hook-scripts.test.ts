/**
 * Behavior of the generated hook scripts: `tbd-session.sh` and
 * `tbd-closing-reminder.sh` (the same bytes under .claude/ and .codex/) and the Codex
 * hook commands, which are boundary-limited wrappers.
 *
 * The scripts come from a real `tbd setup --auto` run, then run as copies in fixture
 * repositories whose config each test controls, with a hermetic PATH of shims: no git,
 * no jq, and only the tools a case provides. The shims record what ran, so each test
 * proves which CLI the script chose and with which arguments.
 */

import { spawnSync } from 'node:child_process';
import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir, platform } from 'node:os';
import { dirname, join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { GIT_PUSH_DETECTOR_JS } from '../src/cli/lib/git-push-detector.js';
import { subprocessTestTimeout } from './test-helpers.js';

const describeUnix = platform() === 'win32' ? describe.skip : describe;

const tbdBin = join(__dirname, '..', 'dist', 'bin.mjs');
const BASH = spawnSync('bash', ['-c', 'command -v bash'], { encoding: 'utf-8' }).stdout.trim();
const COOL_OFF_MS = 14 * 24 * 60 * 60 * 1000;
const CUTOFF_TOLERANCE_MS = 10 * 60 * 1000;
const PIN = '9.9.9-rc.1+build.5';

const SESSION_SCRIPTS = ['.claude/scripts/tbd-session.sh', '.codex/tbd-session.sh'];
const CLOSING_SCRIPTS = ['.claude/hooks/tbd-closing-reminder.sh', '.codex/tbd-closing-reminder.sh'];

interface RunResult {
  status: number | null;
  stdout: string;
  stderr: string;
}

interface RunOptions {
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  input?: string;
}

describe('git push detector source', () => {
  it('embeds safely in a single-quoted Bash argument', () => {
    expect(GIT_PUSH_DETECTOR_JS).not.toContain("'");
    expect(GIT_PUSH_DETECTOR_JS).not.toContain('`');
    expect(GIT_PUSH_DETECTOR_JS).not.toContain('${');
  });
});

describeUnix('generated hook scripts', { timeout: subprocessTestTimeout(60_000) }, () => {
  let root: string;
  let fakeHome: string;
  let log: string;
  let npxArgv: string;
  const scripts = new Map<string, Buffer>();
  let codexClosingCommand: string;
  let codexSessionCommands: { sessionStart: string[]; preCompact: string };
  let claudeClosingCommand: string;
  const bins: Record<
    | 'full'
    | 'npxOnly'
    | 'nodeOnly'
    | 'noNode'
    | 'brokenNode'
    | 'brokenNodeNoNpx'
    | 'silentNode'
    | 'bashOnly',
    string
  > = {
    full: '',
    npxOnly: '',
    nodeOnly: '',
    noNode: '',
    brokenNode: '',
    brokenNodeNoNpx: '',
    silentNode: '',
    bashOnly: '',
  };

  async function writeExecutable(path: string, content: string): Promise<void> {
    await writeFile(path, content);
    await chmod(path, 0o755);
  }

  /** A PATH directory holding exactly the named tools. */
  async function makeBin(name: string, tools: string[]): Promise<string> {
    const dir = join(root, `bin-${name}`);
    await mkdir(dir);
    for (const tool of tools) {
      const path = join(dir, tool);
      switch (tool) {
        case 'bash':
          await writeExecutable(path, `#!/bin/sh\nexec "${BASH}" "$@"\n`);
          break;
        case 'node':
          await symlink(process.execPath, path);
          break;
        case 'broken-node':
          // Fails, or prints a non-date, for the `-e` cutoff computation only.
          await writeExecutable(
            join(dir, 'node'),
            '#!/bin/bash\n' +
              'if [ "$1" = "-e" ] && [ "$#" -gt 2 ]; then\n' +
              '  if [ "$HOOK_TEST_NODE_MODE" = "garbage" ]; then echo "not a date"; exit 0; fi\n' +
              '  exit 1\n' +
              'fi\n' +
              `exec "${process.execPath}" "$@"\n`,
          );
          break;
        case 'silent-node':
          // Fails every invocation without printing anything.
          await writeExecutable(join(dir, 'node'), '#!/bin/bash\nexit 1\n');
          break;
        case 'tbd':
          await writeExecutable(
            path,
            '#!/bin/bash\n' +
              'case "$1" in\n' +
              '  config) [ "$2 $3" = "get tbd_format" ] && exit "${HOOK_TEST_TBD_READ_STATUS:-0}"; exit 1 ;;\n' +
              '  whoami) exit 0 ;;\n' +
              '  prime|closing) printf "tbd %s\\n" "$*" >> "$HOOK_TEST_LOG"; exit "${HOOK_TEST_TBD_STATUS:-0}" ;;\n' +
              'esac\n' +
              'exit 1\n',
          );
          break;
        case 'npx':
          await writeExecutable(
            path,
            '#!/bin/bash\n' +
              'printf "%s\\n" "$@" > "$HOOK_TEST_NPX_ARGV"\n' +
              'exit "${HOOK_TEST_NPX_STATUS:-0}"\n',
          );
          break;
        default:
          throw new Error(`unknown tool ${tool}`);
      }
    }
    return dir;
  }

  function env(bin: string, extra: Record<string, string> = {}): Record<string, string> {
    return {
      HOME: fakeHome,
      PATH: bin,
      TBD_HOOK_PATH_PREFIX: '',
      XDG_CACHE_HOME: '',
      HOOK_TEST_LOG: log,
      HOOK_TEST_NPX_ARGV: npxArgv,
      ...extra,
    };
  }

  async function resetRecords(): Promise<void> {
    await writeFile(log, '');
    await rm(npxArgv, { force: true });
  }

  async function tbdLog(): Promise<string> {
    return (await readFile(log, 'utf-8')).trim();
  }

  /** Copy the generated scripts into a fresh repository with the given config. */
  async function makeFixture(name: string, config: string | null): Promise<string> {
    const dir = join(root, name);
    for (const rel of [...SESSION_SCRIPTS, ...CLOSING_SCRIPTS]) {
      await mkdir(dirname(join(dir, rel)), { recursive: true });
      await writeFile(join(dir, rel), scripts.get(rel)!);
    }
    if (config !== null) {
      await mkdir(join(dir, '.tbd'), { recursive: true });
      await writeFile(join(dir, '.tbd', 'config.yml'), config);
    }
    return dir;
  }

  function run(script: string, bin: string, options: RunOptions = {}): RunResult {
    const result = spawnSync(BASH, [script, ...(options.args ?? [])], {
      cwd: options.cwd ?? root,
      encoding: 'utf-8',
      env: env(bin, options.env),
      input: options.input,
    });
    return { status: result.status, stdout: result.stdout, stderr: result.stderr };
  }

  function runCommand(command: string, bin: string, options: RunOptions = {}): RunResult {
    const result = spawnSync(BASH, ['-c', command], {
      cwd: options.cwd ?? root,
      encoding: 'utf-8',
      env: env(bin, options.env),
      input: options.input,
    });
    return { status: result.status, stdout: result.stdout, stderr: result.stderr };
  }

  function hookInput(command: string): string {
    return JSON.stringify({ tool_input: { command } });
  }

  function isCurrentCutoff(cutoff: string | undefined): boolean {
    return (
      cutoff !== undefined &&
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(cutoff) &&
      Math.abs(Date.now() - COOL_OFF_MS - Date.parse(cutoff)) < CUTOFF_TOLERANCE_MS
    );
  }

  /**
   * The npx fallback must run exactly the configured pin with the cool-off and
   * no-install-scripts policy as flags, and with its dedicated cache.
   */
  async function expectFallbackArgv(args: string[], cache: string): Promise<void> {
    const argv = (await readFile(npxArgv, 'utf-8')).split('\n').slice(0, -1);
    const [yes, before, ignoreScripts, cacheFlag, ...command] = argv;
    expect(yes).toBe('--yes');
    expect(before?.startsWith('--before=')).toBe(true);
    expect(isCurrentCutoff(before?.slice('--before='.length)), String(before)).toBe(true);
    expect(ignoreScripts).toBe('--ignore-scripts');
    expect(cacheFlag).toBe(`--cache=${cache}`);
    expect(command).toEqual([`get-tbd@${PIN}`, ...args]);
  }

  beforeAll(async () => {
    root = await realpath(await mkdtemp(join(tmpdir(), 'tbd-hook-scripts-')));
    fakeHome = join(root, 'home');
    await mkdir(fakeHome);
    log = join(root, 'tbd.log');
    npxArgv = join(root, 'npx.argv');

    const generated = join(root, 'generated');
    await mkdir(generated);
    for (const args of [
      ['init', '--initial-branch=main'],
      ['config', 'user.email', 'test@example.com'],
      ['config', 'user.name', 'Test'],
    ]) {
      expect(spawnSync('git', args, { cwd: generated }).status).toBe(0);
    }
    const setup = spawnSync('node', [tbdBin, 'setup', '--auto', '--prefix=test'], {
      cwd: generated,
      encoding: 'utf-8',
      env: { ...process.env, HOME: fakeHome, USERPROFILE: fakeHome, FORCE_COLOR: '0' },
    });
    expect(setup.status, setup.stderr).toBe(0);
    for (const rel of [...SESSION_SCRIPTS, ...CLOSING_SCRIPTS]) {
      scripts.set(rel, await readFile(join(generated, rel)));
    }
    const codexHooks = JSON.parse(await readFile(join(generated, '.codex/hooks.json'), 'utf-8'));
    codexClosingCommand = codexHooks.hooks.PostToolUse[0].hooks[0].command;
    codexSessionCommands = {
      sessionStart: codexHooks.hooks.SessionStart.map(
        (entry: { hooks: { command: string }[] }) => entry.hooks[0]!.command,
      ),
      preCompact: codexHooks.hooks.PreCompact[0].hooks[0].command,
    };
    const claudeSettings = JSON.parse(
      await readFile(join(generated, '.claude/settings.json'), 'utf-8'),
    );
    claudeClosingCommand = claudeSettings.hooks.PostToolUse[0].hooks[0].command;

    bins.full = await makeBin('full', ['bash', 'node', 'tbd', 'npx']);
    bins.npxOnly = await makeBin('npx-only', ['bash', 'node', 'npx']);
    bins.nodeOnly = await makeBin('node-only', ['bash', 'node']);
    bins.noNode = await makeBin('no-node', ['bash', 'npx']);
    bins.brokenNode = await makeBin('broken-node', ['bash', 'broken-node', 'npx']);
    bins.brokenNodeNoNpx = await makeBin('broken-node-no-npx', ['bash', 'broken-node']);
    bins.silentNode = await makeBin('silent-node', ['bash', 'silent-node', 'tbd']);
    bins.bashOnly = await makeBin('bash-only', ['bash']);
  });

  afterAll(async () => {
    await rm(root, { recursive: true, force: true });
  });

  const PIN_CONFIG = `tbd_format: f08\ntbd_fallback_version: ${PIN}\n`;

  describe.each(SESSION_SCRIPTS)('%s', (rel) => {
    const fixtureName = rel.replace(/[/.]/gu, '-');

    it('primes with a compatible local CLI from any directory, without git', async () => {
      const dir = await makeFixture(`${fixtureName}-local`, PIN_CONFIG);
      await resetRecords();
      const result = run(join(dir, rel), bins.full, { args: ['--brief'] });
      expect(result.status, result.stderr).toBe(0);
      expect(await tbdLog()).toBe('tbd prime --brief');
      expect(existsSync(npxArgv)).toBe(false);
    });

    it('runs the exact configured pin under the cool-off when the local CLI cannot read the repository', async () => {
      const dir = await makeFixture(`${fixtureName}-fallback`, PIN_CONFIG);
      await resetRecords();
      const result = run(join(dir, rel), bins.full, {
        env: { HOOK_TEST_TBD_READ_STATUS: '1' },
      });
      expect(result.status, result.stderr).toBe(0);
      expect(result.stderr).toContain('cannot read this repository format');
      expect(await tbdLog()).toBe('');
      await expectFallbackArgv(['prime'], join(fakeHome, '.cache', 'tbd-fallback-npm'));

      // Inherited npm settings, in either case, do not change the flags, and the
      // dedicated cache follows XDG_CACHE_HOME.
      await resetRecords();
      const xdg = join(root, 'xdg-cache');
      const inherited = run(join(dir, rel), bins.npxOnly, {
        env: {
          NPM_CONFIG_BEFORE: '2099-01-01',
          NPM_CONFIG_IGNORE_SCRIPTS: 'false',
          npm_config_before: '2099-01-01',
          npm_config_ignore_scripts: 'false',
          XDG_CACHE_HOME: xdg,
        },
      });
      expect(inherited.status, inherited.stderr).toBe(0);
      expect(inherited.stderr).toContain('tbd CLI not found; using configured fallback');
      await expectFallbackArgv(['prime'], join(xdg, 'tbd-fallback-npm'));
    });

    it('propagates an npx failure and names the cool-off', async () => {
      const dir = await makeFixture(`${fixtureName}-npx-fails`, PIN_CONFIG);
      await resetRecords();
      const result = run(join(dir, rel), bins.npxOnly, { env: { HOOK_TEST_NPX_STATUS: '41' } });
      expect(result.status).toBe(41);
      expect(result.stderr).toContain('exited with status 41');
      expect(result.stderr).toContain('14-day cool-off');
    });

    it('fails closed without a working node', async () => {
      const dir = await makeFixture(`${fixtureName}-node`, PIN_CONFIG);
      await resetRecords();
      const noNode = run(join(dir, rel), bins.noNode);
      expect(noNode.status).toBe(1);
      expect(noNode.stderr).toContain('node is required to compute the cool-off cutoff');
      expect(existsSync(npxArgv)).toBe(false);
      for (const mode of ['fail', 'garbage']) {
        const broken = run(join(dir, rel), bins.brokenNode, {
          env: { HOOK_TEST_NODE_MODE: mode },
        });
        expect(broken.status, mode).toBe(1);
        expect(broken.stderr).toContain('node failed to compute the cool-off cutoff');
        expect(existsSync(npxArgv)).toBe(false);
      }
    });

    it('gives an install hint under the cool-off when npx is unavailable', async () => {
      const dir = await makeFixture(`${fixtureName}-no-npx`, PIN_CONFIG);
      const withNode = run(join(dir, rel), bins.nodeOnly);
      expect(withNode.status).toBe(1);
      expect(withNode.stderr).toContain('tbd CLI not found and npx is unavailable');
      const hint =
        /Install it with: npm install -g --ignore-scripts --before=(\S+) get-tbd@(\S+)\n/u.exec(
          withNode.stderr,
        );
      expect(hint, withNode.stderr).not.toBeNull();
      expect(isCurrentCutoff(hint?.[1])).toBe(true);
      expect(hint?.[2]).toBe(PIN);

      const withoutNode = run(join(dir, rel), bins.bashOnly);
      expect(withoutNode.status).toBe(1);
      expect(withoutNode.stderr).toContain(
        `Install it with: npm install -g --ignore-scripts get-tbd@${PIN}\n`,
      );
      expect(withoutNode.stderr).toContain('published at least 14 days ago');
    });

    it.each([
      'tbd_fallback_version: latest\n',
      'tbd_fallback_version: ^0.10.0\n',
      'tbd_fallback_version: 0.10\n',
      'tbd_fallback_version: 0.10.0; touch SHOULD_NOT_RUN\n',
      'tbd_fallback_version: 0.10.0 --registry=https://example.invalid\n',
      'tbd_fallback_version: get-tbd@0.10.0\n',
      '',
    ])('rejects fallback config %j without invoking npx', async (pinLine) => {
      const dir = await makeFixture(`${fixtureName}-bad-pin`, `tbd_format: f08\n${pinLine}`);
      await resetRecords();
      const result = run(join(dir, rel), bins.npxOnly);
      expect(result.status).toBe(1);
      expect(result.stderr).toContain('valid exact tbd_fallback_version');
      expect(existsSync(npxArgv)).toBe(false);
      await rm(dir, { recursive: true, force: true });
    });

    it('refuses to run from an unexpected location', async () => {
      const dir = join(root, `${fixtureName}-elsewhere`);
      await mkdir(dir, { recursive: true });
      await writeFile(join(dir, 'tbd-session.sh'), scripts.get(rel)!);
      await resetRecords();
      const result = run(join(dir, 'tbd-session.sh'), bins.full);
      expect(result.status).toBe(1);
      expect(result.stderr).toContain('Unexpected session hook location');
      expect(await tbdLog()).toBe('');
    });

    it("never adopts an enclosing directory's configuration", async () => {
      const ancestor = await makeFixture(
        `${fixtureName}-ancestor`,
        'tbd_fallback_version: 6.6.6\n',
      );
      const nested = join(ancestor, 'nested');
      await mkdir(dirname(join(nested, rel)), { recursive: true });
      await writeFile(join(nested, rel), scripts.get(rel)!);
      await resetRecords();
      const result = run(join(nested, rel), bins.full, {
        cwd: nested,
        env: { HOOK_TEST_TBD_READ_STATUS: '1' },
      });
      expect(result.status).toBe(1);
      expect(result.stderr).toContain('Cannot locate repository .tbd/config.yml');
      expect(existsSync(npxArgv)).toBe(false);
    });
  });

  describe.each(CLOSING_SCRIPTS)('%s', (rel) => {
    const fixtureName = rel.replace(/[/.]/gu, '-');

    const PUSH_FORMS = [
      'git push',
      'git commit -m test\ngit push origin HEAD',
      'git -C "/some dir" push origin HEAD',
      '/usr/bin/git push origin HEAD',
      "GIT_SSH_COMMAND='ssh -i /tmp/key' git push origin HEAD",
      'env GIT_CONFIG_COUNT=1 git push origin HEAD',
      'command git push origin HEAD',
      'eval git push origin HEAD',
      'git status && git push',
      'git status; git push',
      'if git commit -m test; then git push origin HEAD; fi',
      'for i in 1; do git push origin HEAD; done',
      '(git push origin HEAD)',
      'case x in x) git push origin HEAD ;; esac',
    ];
    const NON_PUSH_FORMS = [
      'echo git push',
      'git commit -m push',
      'git --help push',
      'git --version push',
      'git -h push',
      'if echo git push; then :; fi',
      'for git in push; do :; done',
      'eval echo git push',
      'eval "git push origin HEAD"',
      'printf "git push\\n"',
      'pwd',
    ];

    it('reminds after every shell form of git push, without jq or git', async () => {
      const dir = await makeFixture(`${fixtureName}-push`, PIN_CONFIG);
      for (const command of PUSH_FORMS) {
        await resetRecords();
        const result = run(join(dir, rel), bins.full, { input: hookInput(command) });
        expect(result.status, `${JSON.stringify(command)}: ${result.stderr}`).toBe(0);
        expect(await tbdLog(), JSON.stringify(command)).toBe('tbd closing');
      }
    });

    it('stays quiet for commands that do not push', async () => {
      const dir = await makeFixture(`${fixtureName}-no-push`, PIN_CONFIG);
      for (const command of NON_PUSH_FORMS) {
        await resetRecords();
        const result = run(join(dir, rel), bins.full, { input: hookInput(command) });
        expect(result.status, JSON.stringify(command)).toBe(0);
        expect(await tbdLog(), JSON.stringify(command)).toBe('');
      }
      await resetRecords();
      const other = run(join(dir, rel), bins.full, { input: JSON.stringify({ tool_input: {} }) });
      expect(other.status).toBe(0);
      expect(await tbdLog()).toBe('');
    });

    it('fails visibly on malformed hook JSON', async () => {
      const dir = await makeFixture(`${fixtureName}-malformed`, PIN_CONFIG);
      for (const input of ['{', '']) {
        const result = run(join(dir, rel), bins.full, { input });
        expect(result.status).toBe(1);
        expect(result.stderr).toMatch(/invalid hook JSON/iu);
      }
    });

    it('needs node to read its input', async () => {
      const dir = await makeFixture(`${fixtureName}-no-node`, PIN_CONFIG);
      const result = run(join(dir, rel), bins.bashOnly, { input: hookInput('git push') });
      expect(result.status).toBe(1);
      expect(result.stderr).toContain('node is required to read the closing hook input');
    });

    it('explains a node that fails without a message', async () => {
      const dir = await makeFixture(`${fixtureName}-silent-node`, PIN_CONFIG);
      await resetRecords();
      const result = run(join(dir, rel), bins.silentNode, { input: hookInput('git push') });
      expect(result.status).toBe(1);
      expect(result.stderr).toContain('The closing hook could not read its input with node');
      expect(await tbdLog()).toBe('');
    });

    it('exits quietly without its own .tbd, even inside a tbd repository', async () => {
      const ancestor = await makeFixture(`${fixtureName}-ancestor`, PIN_CONFIG);
      const nested = join(ancestor, 'nested');
      await mkdir(dirname(join(nested, rel)), { recursive: true });
      await writeFile(join(nested, rel), scripts.get(rel)!);
      await resetRecords();
      const result = run(join(nested, rel), bins.full, {
        cwd: nested,
        input: hookInput('git push'),
        env: { HOOK_TEST_TBD_READ_STATUS: '1' },
      });
      expect(result.status, result.stderr).toBe(0);
      expect(await tbdLog()).toBe('');
      expect(existsSync(npxArgv)).toBe(false);
    });

    it('propagates a tbd closing failure without falling back', async () => {
      const dir = await makeFixture(`${fixtureName}-tbd-fails`, PIN_CONFIG);
      await resetRecords();
      const result = run(join(dir, rel), bins.full, {
        input: hookInput('git push'),
        env: { HOOK_TEST_TBD_STATUS: '23' },
      });
      expect(result.status).toBe(23);
      expect(existsSync(npxArgv)).toBe(false);
    });

    it('runs the configured pin under the cool-off and propagates its failure', async () => {
      const dir = await makeFixture(`${fixtureName}-fallback`, PIN_CONFIG);
      await resetRecords();
      const fallback = run(join(dir, rel), bins.full, {
        input: hookInput('git push'),
        env: { HOOK_TEST_TBD_READ_STATUS: '1' },
      });
      expect(fallback.status, fallback.stderr).toBe(0);
      expect(fallback.stderr).toContain('cannot read this repository format');
      expect(await tbdLog()).toBe('');
      await expectFallbackArgv(['closing'], join(fakeHome, '.cache', 'tbd-fallback-npm'));

      const failing = run(join(dir, rel), bins.npxOnly, {
        input: hookInput('git push'),
        env: { HOOK_TEST_NPX_STATUS: '37' },
      });
      expect(failing.status).toBe(37);
    });

    it('explains a missing CLI and fails closed on a broken node', async () => {
      const dir = await makeFixture(`${fixtureName}-no-cli`, PIN_CONFIG);
      const missing = run(join(dir, rel), bins.nodeOnly, { input: hookInput('git push') });
      expect(missing.status).toBe(1);
      expect(missing.stderr).toContain('tbd CLI not found and npx is unavailable');
      expect(missing.stderr).toMatch(
        /Install it with: npm install -g --ignore-scripts --before=\S+ get-tbd@\S+\n/u,
      );

      await resetRecords();
      const broken = run(join(dir, rel), bins.brokenNode, { input: hookInput('git push') });
      expect(broken.status).toBe(1);
      expect(broken.stderr).toContain('node failed to compute the cool-off cutoff');
      expect(existsSync(npxArgv)).toBe(false);

      const brokenNoNpx = run(join(dir, rel), bins.brokenNodeNoNpx, {
        input: hookInput('git push'),
      });
      expect(brokenNoNpx.status).toBe(1);
      expect(brokenNoNpx.stderr).toContain('published at least 14 days ago');
    });
  });

  it('runs the configured Claude closing command from a subdirectory', async () => {
    const dir = await makeFixture('claude-command', PIN_CONFIG);
    await mkdir(join(dir, 'src', 'deep'), { recursive: true });
    await resetRecords();
    const result = runCommand(claudeClosingCommand, bins.full, {
      cwd: join(dir, 'src', 'deep'),
      input: hookInput('git push'),
      env: { CLAUDE_PROJECT_DIR: dir },
    });
    expect(result.status, result.stderr).toBe(0);
    expect(await tbdLog()).toBe('tbd closing');
  });

  describe('Codex hook commands', () => {
    async function markerHook(dir: string, marker: string): Promise<void> {
      await mkdir(join(dir, '.codex'), { recursive: true });
      await writeFile(
        join(dir, '.codex', 'tbd-closing-reminder.sh'),
        `#!/bin/bash\nprintf "" > ${JSON.stringify(marker)}\n`,
      );
    }

    function runWrapper(cwd: string): RunResult {
      return runCommand(codexClosingCommand, bins.bashOnly, {
        cwd,
        input: hookInput('git push'),
        env: { PWD: cwd },
      });
    }

    it("runs the project's hook from a subdirectory and never a nested stray copy", async () => {
      const project = join(root, 'codex-project');
      const projectMarker = join(root, 'codex-project-ran');
      const strayMarker = join(root, 'codex-stray-ran');
      await mkdir(join(project, '.git'), { recursive: true });
      await markerHook(project, projectMarker);
      await writeFile(join(project, '.codex', 'hooks.json'), '{}\n');
      await markerHook(join(project, 'sub'), strayMarker);

      const fromNested = runWrapper(join(project, 'sub'));
      expect(fromNested.status, fromNested.stderr).toBe(0);
      expect(existsSync(projectMarker)).toBe(true);
      expect(existsSync(strayMarker)).toBe(false);

      // A symlinked working directory resolves to the physical project.
      await rm(projectMarker);
      const linked = join(root, 'codex-linked-sub');
      await symlink(join(project, 'sub'), linked);
      const fromLink = runWrapper(linked);
      expect(fromLink.status, fromLink.stderr).toBe(0);
      expect(existsSync(projectMarker)).toBe(true);
      expect(existsSync(strayMarker)).toBe(false);
    });

    it('fails visibly when the Codex project lacks its closing hook', async () => {
      const project = join(root, 'codex-missing-hook');
      const strayMarker = join(root, 'codex-missing-hook-stray-ran');
      await mkdir(join(project, '.codex'), { recursive: true });
      await writeFile(join(project, '.codex', 'hooks.json'), '{}\n');
      await markerHook(join(project, 'sub'), strayMarker);
      const result = runWrapper(join(project, 'sub'));
      expect(result.status).toBe(1);
      expect(result.stderr).toContain('Cannot locate the Codex closing hook');
      expect(existsSync(strayMarker)).toBe(false);
    });

    it('runs the session, PreCompact, and gh CLI hooks from a subdirectory', async () => {
      const project = await makeFixture('codex-session-project', PIN_CONFIG);
      await mkdir(join(project, '.git'));
      await writeFile(join(project, '.codex', 'hooks.json'), '{}\n');
      const ghMarker = join(root, 'codex-gh-cli-ran');
      await writeFile(
        join(project, '.codex', 'ensure-gh-cli.sh'),
        `#!/bin/bash\nprintf "" > ${JSON.stringify(ghMarker)}\n`,
      );
      const cwd = join(project, 'packages', 'foo');
      await mkdir(cwd, { recursive: true });
      const [sessionStart, ghCli] = codexSessionCommands.sessionStart;
      expect(ghCli).toBeDefined();

      await resetRecords();
      const session = runCommand(sessionStart!, bins.full, { cwd, env: { PWD: cwd } });
      expect(session.status, session.stderr).toBe(0);
      expect(await tbdLog()).toBe('tbd prime');

      await resetRecords();
      const brief = runCommand(codexSessionCommands.preCompact, bins.full, {
        cwd,
        env: { PWD: cwd },
      });
      expect(brief.status, brief.stderr).toBe(0);
      expect(await tbdLog()).toBe('tbd prime --brief');

      const gh = runCommand(ghCli!, bins.full, { cwd, env: { PWD: cwd } });
      expect(gh.status, gh.stderr).toBe(0);
      expect(existsSync(ghMarker)).toBe(true);
    });

    it('fails visibly when the Codex project lacks its session hook', async () => {
      const project = join(root, 'codex-missing-session');
      await mkdir(join(project, '.codex'), { recursive: true });
      await writeFile(join(project, '.codex', 'hooks.json'), '{}\n');
      const result = runCommand(codexSessionCommands.sessionStart[0]!, bins.bashOnly, {
        cwd: project,
        env: { PWD: project },
      });
      expect(result.status).toBe(1);
      expect(result.stderr).toContain('Cannot locate the Codex session hook');
    });

    it('exits quietly in a Git project without Codex hooks', async () => {
      const project = join(root, 'git-without-codex');
      const strayMarker = join(root, 'git-without-codex-ran');
      await mkdir(join(project, '.git'), { recursive: true });
      await markerHook(project, strayMarker);
      await mkdir(join(project, 'work'));
      const result = runWrapper(join(project, 'work'));
      expect(result.status).toBe(0);
      expect(result.stderr).toBe('');
      expect(existsSync(strayMarker)).toBe(false);
    });
  });
});
