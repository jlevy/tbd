/** End-to-end CLI contract tests for `tbd policy`. */

import { execFile, spawnSync } from 'node:child_process';
import { chmod, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import { getCodexTbdSection } from '../src/cli/commands/setup.js';
import { withSharedDataSyncLock } from '../src/file/common-dir-layout.js';
import { withAgentsMdLock } from '../src/cli/lib/managed-artifact.js';
import { TBD_LOCKS_DIR, resolveSharedTbdPaths } from '../src/lib/paths.js';
import { AGENT_INTEGRATION_FORMAT } from '../src/lib/integration-paths.js';
import {
  INTEGRATION_END_MARKER,
  POLICIES,
  POLICY_BEGIN_MARKER,
  POLICY_BLOCK_PROSE,
  POLICY_END_MARKER,
  POLICY_NAMES,
  parsePolicyBlock,
  renderPolicyBlock,
  withPolicyBlock,
} from '../src/lib/policy-grants.js';
import { CURRENT_FORMAT } from '../src/lib/tbd-format.js';
import { stringifyYaml } from '../src/utils/yaml-utils.js';
import { subprocessTestTimeout } from './test-helpers.js';

const execFileAsync = promisify(execFile);
const packageDir = fileURLToPath(new URL('..', import.meta.url));
const tbdBin = join(packageDir, 'dist', 'bin.mjs');
const cleanupPaths: string[] = [];
const CLI_TEST_TIMEOUT_MS = subprocessTestTimeout();

interface PolicyStatusJson {
  name: string;
  known: boolean;
  answered: boolean;
  value: string | null;
  valid: boolean;
  effective: string | null;
  recommended: string | null;
}

interface PolicyShowJson {
  source: { branch: string; ref: string; kind: string } | null;
  block: { status: string; problems?: string[]; version?: string; recorded?: string | null };
  policies: PolicyStatusJson[];
  workingTree: {
    agentsMdExists: boolean;
    integrationBlock: boolean;
    block: { status: string };
    policies: PolicyStatusJson[];
    differences: { name: string; from: string | null; to: string | null }[];
  };
}

async function git(cwd: string, ...args: string[]): Promise<string> {
  const { stdout } = await execFileAsync('git', args, { cwd });
  return stdout.trim();
}

function runTbd(cwd: string, args: string[]) {
  return spawnSync(process.execPath, [tbdBin, ...args], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, NO_COLOR: '1' },
  });
}

function showJson(cwd: string): PolicyShowJson {
  const result = runTbd(cwd, ['policy', 'show', '--json']);
  expect(result.status, result.stderr).toBe(0);
  return JSON.parse(result.stdout) as PolicyShowJson;
}

function policy(report: { policies: PolicyStatusJson[] }, name: string): PolicyStatusJson {
  const found = report.policies.find((p) => p.name === name);
  expect(found, name).toBeDefined();
  return found!;
}

async function tempDir(prefix: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), prefix));
  cleanupPaths.push(dir);
  return dir;
}

async function initRepo(dir: string, branch: string): Promise<void> {
  await git(dir, 'init', '-q', '-b', branch);
  await git(dir, 'config', 'user.email', 'test@example.com');
  await git(dir, 'config', 'user.name', 'Test User');
  await git(dir, 'config', 'commit.gpgsign', 'false');
}

/** Write the minimal .tbd/config.yml that makes `requireInit` succeed. */
async function writeTbdConfig(dir: string): Promise<void> {
  await mkdir(join(dir, '.tbd'), { recursive: true });
  await writeFile(
    join(dir, '.tbd', 'config.yml'),
    stringifyYaml({
      tbd_format: CURRENT_FORMAT,
      tbd_version: '0.4.1',
      tbd_upgrades: [],
      display: { id_prefix: 'tbd' },
      sync: { branch: 'tbd-sync', remote: 'origin', storage: 'git-common-dir-v1' },
      settings: { auto_sync: false, doc_auto_sync_hours: 24, use_gh_cli: false },
    }),
  );
}

/** A tbd-initialized repository on `main` whose AGENTS.md holds the setup-generated block. */
async function createRepo(options: { agentsMd?: string | null } = {}): Promise<string> {
  const dir = await tempDir('tbd-cli-policy-');
  await initRepo(dir, 'main');
  await writeTbdConfig(dir);
  const agentsMd = options.agentsMd === undefined ? `# Project\n\n${getCodexTbdSection()}` : null;
  const content = options.agentsMd ?? agentsMd;
  if (content !== null) {
    await writeFile(join(dir, 'AGENTS.md'), content);
  }
  await git(dir, 'add', '-A');
  await git(dir, 'commit', '-q', '-m', 'init');
  return dir;
}

beforeAll(() => {
  expect(tbdBin).toBeTruthy();
});

afterEach(async () => {
  await Promise.all(
    cleanupPaths
      .splice(0)
      .map((path) => rm(path, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })),
  );
});

describe('tbd policy show', () => {
  it(
    'reports every policy unanswered in a project without a block',
    async () => {
      const dir = await createRepo();
      const report = showJson(dir);
      expect(report.source).toMatchObject({
        branch: 'main',
        ref: 'refs/heads/main',
        kind: 'local',
      });
      expect(report.block.status).toBe('missing');
      expect(report.policies.map((p) => p.name)).toEqual([...POLICY_NAMES]);
      expect(report.policies.every((p) => !p.answered)).toBe(true);
      expect(policy(report, 'pr-review-requirements').effective).toBe('standard');
      expect(policy(report, 'subagents').effective).toBe('not-granted');
      expect(report.workingTree).toMatchObject({
        agentsMdExists: true,
        integrationBlock: true,
        block: { status: 'missing' },
        differences: [],
      });

      const text = runTbd(dir, ['policy', 'show']);
      expect(text.status).toBe(0);
      expect(text.stdout).toContain('Unanswered');
      expect(text.stdout).toContain('refs/heads/main');
      expect(text.stdout).not.toContain('Answered:');
    },
    CLI_TEST_TIMEOUT_MS,
  );

  it(
    'is the default subcommand and distinguishes answered from unanswered policies',
    async () => {
      const dir = await createRepo();
      expect(runTbd(dir, ['policy', 'grant', 'subagents']).status).toBe(0);
      await git(dir, 'commit', '-q', '-am', 'grant subagents');

      const result = runTbd(dir, ['policy']);
      expect(result.status, result.stderr).toBe(0);
      expect(result.stdout).toMatch(/Answered:\n\s+subagents\s+granted/);
      expect(result.stdout).toMatch(
        /Unanswered[^\n]*\n(\s+[a-z-]+.*\n)*\s+github-merge\s+confirm-every/,
      );
      expect(result.stdout).toContain('tbd guidelines agent-policy-grants');
      expect(result.stdout).not.toContain('differs');
    },
    CLI_TEST_TIMEOUT_MS,
  );

  it(
    'shows a working tree block that differs from the default branch without making it effective',
    async () => {
      const dir = await createRepo();
      const grant = runTbd(dir, ['policy', 'grant', 'subagents']);
      expect(grant.status, grant.stderr).toBe(0);
      expect(grant.stdout).toContain('subagents: granted');
      expect(grant.stdout).toContain('main');

      const before = showJson(dir);
      expect(policy(before, 'subagents')).toMatchObject({
        answered: false,
        effective: 'not-granted',
      });
      expect(policy(before.workingTree, 'subagents')).toMatchObject({
        answered: true,
        effective: 'granted',
      });
      expect(before.workingTree.differences).toEqual([
        { name: 'subagents', from: null, to: 'granted' },
      ]);
      const text = runTbd(dir, ['policy', 'show']);
      expect(text.stdout).toContain('differs');
      expect(text.stdout).toContain('subagents: unanswered -> granted');

      await git(dir, 'commit', '-q', '-am', 'grant subagents');
      const after = showJson(dir);
      expect(policy(after, 'subagents')).toMatchObject({ answered: true, effective: 'granted' });
      expect(after.workingTree.differences).toEqual([]);
    },
    CLI_TEST_TIMEOUT_MS,
  );

  it(
    'exits 0 and points to setup when AGENTS.md has no tbd block',
    async () => {
      const dir = await createRepo({ agentsMd: null });
      const result = runTbd(dir, ['policy', 'show']);
      expect(result.status, result.stderr).toBe(0);
      expect(result.stdout).toContain('tbd setup --auto');
      const report = showJson(dir);
      expect(report.workingTree).toMatchObject({ agentsMdExists: false, integrationBlock: false });
    },
    CLI_TEST_TIMEOUT_MS,
  );

  it(
    'prints no control characters from a recorded value, on any surface',
    async () => {
      // The block is attacker-controlled on an untrusted branch, and a value is free text
      // to the end of the line. An escape sequence in one used to reach `doctor`'s detail
      // and `policy show`'s difference list unbounded, where erase-display wipes the
      // warning saying the value is not a valid grant.
      const hostile = `\u001b[2J\u001b[H GRANTED-BY-USER \u0007${'A'.repeat(400)}`;
      const block = `${POLICY_BEGIN_MARKER}\n- \`github-merge\`: ${hostile}\n${POLICY_END_MARKER}\n`;
      const section = getCodexTbdSection().replace(
        INTEGRATION_END_MARKER,
        `${block}${INTEGRATION_END_MARKER}`,
      );
      const dir = await createRepo({ agentsMd: `# Project\n\n${section}` });

      for (const args of [['policy', 'show'], ['doctor']]) {
        const result = runTbd(dir, args);
        const output = `${result.stdout}${result.stderr}`;
        expect(output, args.join(' ')).not.toContain('\u001b[2J');
        expect(output, args.join(' ')).not.toContain('\u0007');
        const longest = Math.max(...output.split('\n').map((line) => line.length));
        expect(longest, args.join(' ')).toBeLessThan(200);
      }
    },
    CLI_TEST_TIMEOUT_MS,
  );

  it(
    'prints no control characters from a malformed-block line, on any surface',
    async () => {
      // parsePolicyBlock quotes the offending line in two problem messages: a grant
      // inside a comment or fence, and a candidate that does not match the grant
      // line. Both used to interpolate the raw line, so an erase-display sequence
      // and a 400-character payload reached `doctor` details and `policy show`
      // unbounded.
      const hostile = `\u001b[2J\u0007${'B'.repeat(400)}`;
      const hidden = `<!--\n- \`github-merge\`: ${hostile}\n-->`;
      const unmatched = `- **github-merge**: ${hostile}`;
      const block = `${POLICY_BEGIN_MARKER}\n${hidden}\n${unmatched}\n${POLICY_END_MARKER}\n`;
      const section = getCodexTbdSection().replace(
        INTEGRATION_END_MARKER,
        `${block}${INTEGRATION_END_MARKER}`,
      );
      const dir = await createRepo({ agentsMd: `# Project\n\n${section}` });

      for (const args of [['policy', 'show'], ['doctor']]) {
        const result = runTbd(dir, args);
        const output = `${result.stdout}${result.stderr}`;
        expect(output, args.join(' ')).toContain('malformed');
        expect(output, args.join(' ')).toContain('not a grant');
        expect(output, args.join(' ')).toContain('does not match');
        expect(output, args.join(' ')).not.toContain('\u001b[2J');
        expect(output, args.join(' ')).not.toContain('\u0007');
        const longest = Math.max(...output.split('\n').map((line) => line.length));
        expect(longest, args.join(' ')).toBeLessThan(200);
      }
    },
    CLI_TEST_TIMEOUT_MS,
  );

  it(
    'bounds and strips control characters from an unknown block version',
    async () => {
      const hostile = `\u001b[2J\u001b[H\u0007${'V'.repeat(400)}`;
      const block = `<!-- BEGIN TBD POLICY GRANTS v=${hostile} -->\n- \`subagents\`: granted\n${POLICY_END_MARKER}\n`;
      const section = getCodexTbdSection().replace(
        INTEGRATION_END_MARKER,
        `${block}${INTEGRATION_END_MARKER}`,
      );
      const dir = await createRepo({ agentsMd: `# Project\n\n${section}` });

      for (const args of [['policy', 'show'], ['policy', 'grant', 'subagents'], ['doctor']]) {
        const result = runTbd(dir, args);
        const output = `${result.stdout}${result.stderr}`;
        expect(output, args.join(' ')).toContain('policy block');
        expect(output, args.join(' ')).not.toContain('\u001b[2J');
        expect(output, args.join(' ')).not.toContain('\u0007');
        const longest = Math.max(...output.split('\n').map((line) => line.length));
        expect(longest, args.join(' ')).toBeLessThan(200);
      }
    },
    CLI_TEST_TIMEOUT_MS,
  );

  it(
    'does not title an unresolved default branch as Effective grants',
    async () => {
      const dir = await createRepo();
      await git(dir, 'remote', 'add', 'origin', 'https://example.com/tbd.git');
      expect(runTbd(dir, ['policy', 'grant', 'subagents']).status).toBe(0);
      const text = runTbd(dir, ['policy', 'show']);
      expect(text.status, text.stderr).toBe(0);
      expect(text.stdout).toMatch(/Default branch: unresolved/);
      expect(text.stdout).not.toContain('Effective grants:');
      expect(text.stdout).toContain('differs from the unresolved default branch');
      expect(text.stdout).toMatch(
        /These grants take effect once the default branch is resolvable \(/,
      );
      expect(text.stdout).not.toContain('differs from origin');
      expect(text.stdout).not.toContain('merged to origin');
      const report = showJson(dir);
      expect(report.source?.kind).toBe('unresolved');
      expect(report.policies.every((p) => !p.answered)).toBe(true);
    },
    CLI_TEST_TIMEOUT_MS,
  );
});

describe('tbd policy grant, revoke, and set', () => {
  it.each(POLICY_NAMES)(
    'round trips %s values and preserves other policy names',
    async (name) => {
      const expected: Record<string, string> = Object.fromEntries(
        POLICY_NAMES.filter((other) => other !== name).map((other) => [
          other,
          POLICIES[other].grantValue,
        ]),
      );
      const existing = renderPolicyBlock(
        [
          ...Object.entries(expected).map(([other, value]) => ({ name: other, value })),
          { name: 'future-policy', value: 'keep me' },
        ],
        '2026-01-01',
      );
      const seeded = `# Project\n\n${getCodexTbdSection().replace(
        INTEGRATION_END_MARKER,
        `${existing}${INTEGRATION_END_MARKER}`,
      )}`;
      const dir = await createRepo({ agentsMd: seeded });

      const record = async (args: string[], value: string) => {
        const result = runTbd(dir, ['policy', ...args]);
        expect(result.status, `${args.join(' ')}: ${result.stderr}`).toBe(0);
        expected[name] = value;
        const parsed = parsePolicyBlock(await readFile(join(dir, 'AGENTS.md'), 'utf-8'));
        expect(parsed).toMatchObject({
          status: 'ok',
          grants: expect.arrayContaining([{ name, value }]),
        });
      };

      const revoke = POLICIES[name].revokeValue;
      if (revoke !== null) {
        await record(['revoke', name], revoke);
      }
      await record(['grant', name], POLICIES[name].grantValue);
      if (name === 'github-merge') {
        await record(['set', name, 'autonomous'], 'autonomous');
      } else if (name === 'pr-review-requirements') {
        await record(['set', name, 'none'], 'none');
        await record(
          ['set', name, 'standard', '+', '2', 'rounds', '+', 'security'],
          'standard + security + 2 rounds',
        );
      } else if (name === 'linear') {
        await record(['set', name, 'epics+specs'], 'epics + specs');
        await record(['set', name, 'custom'], 'custom');
      }

      const report = showJson(dir);
      for (const [name, value] of Object.entries(expected)) {
        expect(policy(report.workingTree, name)).toMatchObject({
          answered: true,
          value,
          valid: true,
        });
      }
      expect(policy(report.workingTree, 'future-policy')).toMatchObject({
        known: false,
        value: 'keep me',
      });

      const agentsMd = await readFile(join(dir, 'AGENTS.md'), 'utf-8');
      const parsed = parsePolicyBlock(agentsMd);
      expect(parsed.status).toBe('ok');
      if (parsed.status === 'ok') {
        expect(parsed.recorded).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        const grants = [
          ...POLICY_NAMES.map((name) => ({ name, value: expected[name]! })),
          { name: 'future-policy', value: 'keep me' },
        ];
        expect(agentsMd).toContain(renderPolicyBlock(grants, parsed.recorded!));
      }
      expect(agentsMd).toContain(`format=${AGENT_INTEGRATION_FORMAT} surface=agents-md`);
      expect(agentsMd).toContain(`${POLICY_END_MARKER}\n${INTEGRATION_END_MARKER}`);
    },
    CLI_TEST_TIMEOUT_MS,
  );

  it(
    'restamps a block written by an older tbd and refuses one from a newer tbd',
    async () => {
      const older = `# Project\n\n${getCodexTbdSection().replace(
        `format=${AGENT_INTEGRATION_FORMAT}`,
        'format=f08',
      )}`;
      const dir = await createRepo({ agentsMd: older });
      expect(runTbd(dir, ['policy', 'grant', 'subagents']).status).toBe(0);
      expect(await readFile(join(dir, 'AGENTS.md'), 'utf-8')).toContain(
        `format=${AGENT_INTEGRATION_FORMAT} surface=agents-md`,
      );

      const newer = `# Project\n\n${getCodexTbdSection().replace(
        `format=${AGENT_INTEGRATION_FORMAT}`,
        'format=f999',
      )}`;
      await writeFile(join(dir, 'AGENTS.md'), newer);
      const refused = runTbd(dir, ['policy', 'grant', 'subagents']);
      expect(refused.status).toBe(1);
      expect(refused.stderr).toContain('newer tbd');
      expect(await readFile(join(dir, 'AGENTS.md'), 'utf-8')).toBe(newer);
    },
    CLI_TEST_TIMEOUT_MS,
  );

  it(
    'validates the intended policy update before reporting a dry run',
    async () => {
      const missing = await createRepo({ agentsMd: '# Project\n' });
      const missingOriginal = await readFile(join(missing, 'AGENTS.md'), 'utf-8');
      for (const prefix of [[], ['--dry-run']]) {
        const result = runTbd(missing, [...prefix, 'policy', 'grant', 'subagents']);
        expect(result.status).toBe(1);
        expect(result.stderr).toContain('has no tbd block');
        expect(result.stdout).not.toContain('Would record');
        expect(await readFile(join(missing, 'AGENTS.md'), 'utf-8')).toBe(missingOriginal);
      }

      const tooNew = `# Project\n\n${getCodexTbdSection().replace(
        `format=${AGENT_INTEGRATION_FORMAT}`,
        'format=f999',
      )}`;
      const newer = await createRepo({ agentsMd: tooNew });
      for (const prefix of [[], ['--dry-run']]) {
        const result = runTbd(newer, [...prefix, 'policy', 'grant', 'subagents']);
        expect(result.status).toBe(1);
        expect(result.stderr).toContain('newer tbd');
        expect(result.stdout).not.toContain('Would record');
        expect(await readFile(join(newer, 'AGENTS.md'), 'utf-8')).toBe(tooNew);
      }
    },
    CLI_TEST_TIMEOUT_MS,
  );

  it(
    'refuses symlink and nonregular AGENTS.md targets without changing their contents',
    async () => {
      const outsideDir = await tempDir('tbd-cli-policy-outside-');
      const outside = join(outsideDir, 'outside-AGENTS.md');
      const original = `# Outside\n\n${getCodexTbdSection()}`;
      await writeFile(outside, original);
      const linked = await createRepo({ agentsMd: null });
      await symlink(outside, join(linked, 'AGENTS.md'));

      for (const prefix of [[], ['--dry-run']]) {
        const result = runTbd(linked, [...prefix, 'policy', 'grant', 'subagents']);
        expect(result.status).toBe(1);
        expect(result.stderr).toMatch(/regular file|symbolic link/);
        expect(await readFile(outside, 'utf-8')).toBe(original);
      }

      const nonregular = await createRepo({ agentsMd: null });
      await mkdir(join(nonregular, 'AGENTS.md'));
      const refused = runTbd(nonregular, ['policy', 'grant', 'subagents']);
      expect(refused.status).toBe(1);
      expect(refused.stderr).toContain('regular file');
    },
    CLI_TEST_TIMEOUT_MS,
  );

  it(
    'does not make a grant on an unmerged branch effective',
    async () => {
      const origin = join(await tempDir('tbd-cli-policy-origin-'), 'origin.git');
      await execFileAsync('git', ['init', '-q', '--bare', '-b', 'main', origin]);
      const seed = await createRepo();
      await git(seed, 'remote', 'add', 'origin', origin);
      await git(seed, 'push', '-q', 'origin', 'main');

      const clone = await tempDir('tbd-cli-policy-clone-');
      await execFileAsync('git', ['clone', '-q', origin, clone]);
      await git(clone, 'config', 'user.email', 'test@example.com');
      await git(clone, 'config', 'user.name', 'Test User');
      await git(clone, 'config', 'commit.gpgsign', 'false');
      await git(clone, 'checkout', '-q', '-b', 'feature');
      const grant = runTbd(clone, ['policy', 'grant', 'subagents']);
      expect(grant.status, grant.stderr).toBe(0);
      expect(grant.stdout).toContain('merge');
      await git(clone, 'commit', '-q', '-am', 'grant on a branch');

      const onBranch = showJson(clone);
      expect(onBranch.source).toMatchObject({
        branch: 'main',
        ref: 'refs/remotes/origin/main',
        kind: 'remote-tracking',
      });
      expect(policy(onBranch, 'subagents')).toMatchObject({ answered: false });
      expect(onBranch.workingTree.differences).toEqual([
        { name: 'subagents', from: null, to: 'granted' },
      ]);

      await git(clone, 'checkout', '-q', 'main');
      await git(clone, 'merge', '-q', '--ff-only', 'feature');
      expect(policy(showJson(clone), 'subagents')).toMatchObject({ answered: false });
      await git(clone, 'push', '-q', 'origin', 'main');
      const merged = showJson(clone);
      expect(policy(merged, 'subagents')).toMatchObject({ answered: true, effective: 'granted' });
      expect(merged.workingTree.differences).toEqual([]);
    },
    CLI_TEST_TIMEOUT_MS,
  );

  it(
    'refuses to record when AGENTS.md or its tbd block is missing',
    async () => {
      const missing = await createRepo({ agentsMd: null });
      const noFile = runTbd(missing, ['policy', 'grant', 'subagents']);
      expect(noFile.status).toBe(1);
      expect(noFile.stderr).toContain('tbd setup --auto');

      const noBlock = await createRepo({ agentsMd: '# Project\n\nNo tbd block here.\n' });
      const result = runTbd(noBlock, ['policy', 'set', 'linear', 'epics']);
      expect(result.status).toBe(1);
      expect(result.stderr).toContain('tbd setup --auto');
      expect(await readFile(join(noBlock, 'AGENTS.md'), 'utf-8')).toBe(
        '# Project\n\nNo tbd block here.\n',
      );
    },
    CLI_TEST_TIMEOUT_MS,
  );

  it(
    'validates policy names and values before writing',
    async () => {
      const dir = await createRepo();
      const original = await readFile(join(dir, 'AGENTS.md'), 'utf-8');

      const unknownPolicy = runTbd(dir, ['policy', 'grant', 'nope']);
      expect(unknownPolicy.status).toBe(2);
      expect(unknownPolicy.stderr).toContain('nope');

      const badValue = runTbd(dir, [
        'policy',
        'set',
        'pr-review-requirements',
        'standard + 1 rounds',
      ]);
      expect(badValue.status).toBe(2);
      expect(badValue.stderr).toContain('standard + 1 rounds');

      const noRevoke = runTbd(dir, ['policy', 'revoke', 'pr-review-requirements']);
      expect(noRevoke.status).toBe(2);
      expect(noRevoke.stderr).toContain('tbd policy set');

      const wrongFixed = runTbd(dir, ['policy', 'set', 'subagents', 'per-request']);
      expect(wrongFixed.status).toBe(2);

      expect(await readFile(join(dir, 'AGENTS.md'), 'utf-8')).toBe(original);
    },
    CLI_TEST_TIMEOUT_MS,
  );

  it(
    'refuses to rewrite a malformed block and reports the problem',
    async () => {
      const malformed = `# Project\n\n${getCodexTbdSection().replace(
        INTEGRATION_END_MARKER,
        `${POLICY_BEGIN_MARKER}\n- \`subagents\`: granted\n- \`subagents\`: not-granted\n${POLICY_END_MARKER}\n${INTEGRATION_END_MARKER}`,
      )}`;
      const dir = await createRepo({ agentsMd: malformed });
      const result = runTbd(dir, ['policy', 'grant', 'linear']);
      expect(result.status).toBe(1);
      expect(result.stderr).toContain('twice');
      expect(await readFile(join(dir, 'AGENTS.md'), 'utf-8')).toBe(malformed);

      const report = showJson(dir);
      expect(report.block.status).toBe('malformed');
      expect(report.policies.every((p) => !p.answered)).toBe(true);
    },
    CLI_TEST_TIMEOUT_MS,
  );

  it(
    'honors --dry-run and records set values with no notice',
    async () => {
      const dir = await createRepo();
      const original = await readFile(join(dir, 'AGENTS.md'), 'utf-8');
      const dry = runTbd(dir, ['--dry-run', 'policy', 'grant', 'subagents']);
      expect(dry.status, dry.stderr).toBe(0);
      expect(await readFile(join(dir, 'AGENTS.md'), 'utf-8')).toBe(original);

      const autonomous = runTbd(dir, ['policy', 'set', 'github-merge', 'autonomous']);
      expect(autonomous.status, autonomous.stderr).toBe(0);
      expect(autonomous.stdout).toContain('Recorded github-merge: autonomous');
      expect(autonomous.stdout).not.toContain('recommends against');
      expect(policy(showJson(dir).workingTree, 'github-merge')).toMatchObject({
        answered: true,
        value: 'autonomous',
      });

      const none = runTbd(dir, ['policy', 'set', 'pr-review-requirements', 'none']);
      expect(none.status, none.stderr).toBe(0);
      expect(none.stdout).toContain('Recorded pr-review-requirements: none');
      expect(none.stdout).not.toContain('recommends against');
      expect(policy(showJson(dir).workingTree, 'pr-review-requirements')).toMatchObject({
        answered: true,
        value: 'none',
      });
    },
    CLI_TEST_TIMEOUT_MS,
  );
});

describe('policy write serialization', () => {
  it(
    'reads after acquiring the AGENTS.md lock and preserves a concurrent revocation',
    async () => {
      const dir = await createRepo();
      const agentsPath = join(dir, 'AGENTS.md');
      const original = await readFile(agentsPath, 'utf8');
      await writeFile(
        agentsPath,
        withPolicyBlock(
          original,
          renderPolicyBlock([{ name: 'github-merge', value: 'autonomous' }], '2026-09-19'),
        ),
      );
      // The lock lives in the checkout beside AGENTS.md, not in the repository's
      // shared $GIT_COMMON_DIR/tbd tree.
      const locksDir = join(dir, TBD_LOCKS_DIR);
      let completed = false;
      let command: ReturnType<typeof execFileAsync> | undefined;
      try {
        await withAgentsMdLock(dir, async () => {
          command = execFileAsync(process.execPath, [tbdBin, 'policy', 'grant', 'subagents'], {
            cwd: dir,
            env: { ...process.env, NO_COLOR: '1' },
            timeout: CLI_TEST_TIMEOUT_MS,
          });
          void command.then(
            () => {
              completed = true;
            },
            () => {
              completed = true;
            },
          );
          // Observe an actual contender, rather than sleeping and assuming startup finished.
          const deadline = Date.now() + CLI_TEST_TIMEOUT_MS / 2;
          while (
            !(await readdir(locksDir)).some((name) => name.startsWith('agents-md.lock.owner-'))
          ) {
            if (completed || Date.now() > deadline) {
              throw new Error('Policy command did not wait for the held AGENTS.md lock');
            }
            await new Promise((resolve) => setTimeout(resolve, 25));
          }
          expect(completed).toBe(false);
          await writeFile(
            agentsPath,
            withPolicyBlock(
              original,
              renderPolicyBlock([{ name: 'github-merge', value: 'never' }], '2026-09-20'),
            ),
          );
        });
      } finally {
        // The holder always releases before awaiting the child, including on assertion failure.
        await command;
      }
      expect(parsePolicyBlock(await readFile(agentsPath, 'utf8'))).toMatchObject({
        status: 'ok',
        grants: [
          { name: 'github-merge', value: 'never' },
          { name: 'subagents', value: 'granted' },
        ],
      });
    },
    CLI_TEST_TIMEOUT_MS,
  );
});

describe('tbd policy refresh', () => {
  it(
    'refreshes old guidance while preserving decisions, notes, date and line endings',
    async () => {
      const oldProse = POLICY_BLOCK_PROSE.split('\nOnly the copy committed')[0]!;
      const current = withPolicyBlock(
        getCodexTbdSection(),
        renderPolicyBlock(
          [
            { name: 'github-merge', value: 'never' },
            { name: 'future-policy', value: 'custom decision' },
          ],
          '2026-01-02',
        ),
      ).replace('Recorded 2026-01-02.', 'Owner note: keep this context.\n\nRecorded 2026-01-02.');
      const stale = current.replace(POLICY_BLOCK_PROSE, oldProse).replace(/\n/g, '\r\n');
      const dir = await createRepo({ agentsMd: stale });
      const path = join(dir, 'AGENTS.md');
      const dry = runTbd(dir, ['--dry-run', 'policy', 'refresh']);
      expect(dry.status, dry.stderr).toBe(0);
      expect(dry.stdout).toContain('Would refresh');
      expect(await readFile(path, 'utf8')).toBe(stale);
      const result = runTbd(dir, ['policy', 'refresh']);
      expect(result.status, result.stderr).toBe(0);
      expect(result.stdout).toContain('recorded values are unchanged');
      const updated = await readFile(path, 'utf8');
      expect(updated).toBe(current.replace(/\n/g, '\r\n'));
      const second = runTbd(dir, ['policy', 'refresh', '--json']);
      expect(second.status, second.stderr).toBe(0);
      expect(JSON.parse(second.stdout)).toMatchObject({ changed: false });
      expect(await readFile(path, 'utf8')).toBe(updated);
    },
    CLI_TEST_TIMEOUT_MS,
  );

  it(
    'refuses missing policy blocks and symlink targets without changing files',
    async () => {
      const dir = await createRepo();
      const path = join(dir, 'AGENTS.md');
      const original = await readFile(path, 'utf8');
      const missing = runTbd(dir, ['policy', 'refresh']);
      expect(missing.status).toBe(1);
      expect(await readFile(path, 'utf8')).toBe(original);
      const external = join(await tempDir('tbd-policy-refresh-target-'), 'AGENTS.md');
      await writeFile(external, original);
      await rm(path);
      await symlink(external, path, 'file');
      const linked = runTbd(dir, ['policy', 'refresh']);
      expect(linked.status).toBe(1);
      expect(linked.stderr).toContain('symbolic link');
      expect(await readFile(external, 'utf8')).toBe(original);
    },
    CLI_TEST_TIMEOUT_MS,
  );

  it(
    'always reports an outcome, in text and JSON, for both dry and real runs',
    async () => {
      const stale = withPolicyBlock(
        getCodexTbdSection(),
        renderPolicyBlock([{ name: 'github-merge', value: 'never' }], '2026-01-02'),
      ).replace(POLICY_BLOCK_PROSE, POLICY_BLOCK_PROSE.split('\nOnly the copy committed')[0]!);
      const dir = await createRepo({ agentsMd: stale });

      const dryJson = runTbd(dir, ['--dry-run', 'policy', 'refresh', '--json']);
      expect(dryJson.status, dryJson.stderr).toBe(0);
      expect(JSON.parse(dryJson.stdout)).toMatchObject({
        file: 'AGENTS.md',
        changed: true,
        dryRun: true,
      });

      const real = runTbd(dir, ['policy', 'refresh']);
      expect(real.status, real.stderr).toBe(0);
      expect(real.stdout).toContain('Refreshed');

      // Nothing left to do: previously a current block printed nothing at all
      // on a dry run, with or without --json.
      const currentDry = runTbd(dir, ['--dry-run', 'policy', 'refresh']);
      expect(currentDry.status, currentDry.stderr).toBe(0);
      expect(currentDry.stdout).toContain('Nothing to refresh');
      const currentDryJson = runTbd(dir, ['--dry-run', 'policy', 'refresh', '--json']);
      expect(currentDryJson.status, currentDryJson.stderr).toBe(0);
      expect(JSON.parse(currentDryJson.stdout)).toMatchObject({ changed: false, dryRun: true });
    },
    CLI_TEST_TIMEOUT_MS,
  );

  it(
    'points a missing AGENTS.md at the same setup hint `grant` gives',
    async () => {
      const dir = await createRepo({ agentsMd: null });

      const grant = runTbd(dir, ['policy', 'grant', 'subagents']);
      const refresh = runTbd(dir, ['policy', 'refresh']);

      expect(grant.status).toBe(1);
      expect(refresh.status).toBe(1);
      expect(refresh.stderr).toContain('tbd setup --auto');
      // The old message advised creating the file by hand, which only leads to
      // "no policy block to refresh".
      expect(refresh.stderr).not.toContain('Create it as a regular file');
    },
    CLI_TEST_TIMEOUT_MS,
  );
});

describe('policy dry-run shared-state invariant', () => {
  it.each([
    ['policy', 'grant', 'subagents'],
    ['policy', 'refresh'],
    ['setup', '--auto', '--surfaces=agents-md', '--policies=recommended'],
  ])(
    'previews %s %s without creating or changing shared Git metadata',
    async (...args) => {
      const current = withPolicyBlock(
        getCodexTbdSection(),
        renderPolicyBlock([{ name: 'github-merge', value: 'never' }], '2026-01-02'),
      );
      const stale = current.replace(
        POLICY_BLOCK_PROSE,
        POLICY_BLOCK_PROSE.split('\nOnly the copy committed')[0]!,
      );
      const dir = await createRepo({ agentsMd: stale });
      const paths = await resolveSharedTbdPaths(dir);
      await withSharedDataSyncLock(dir, async () => {
        // Establish shared metadata before asserting that dry runs leave it unchanged.
      });

      async function snapshot(root: string): Promise<Record<string, string>> {
        const result: Record<string, string> = {};
        async function visit(relative: string): Promise<void> {
          const entries = await readdir(join(root, relative), { withFileTypes: true });
          for (const entry of entries) {
            const path = join(relative, entry.name);
            if (entry.isDirectory()) {
              result[path] = 'directory';
              await visit(path);
            } else {
              result[path] = (await readFile(join(root, path))).toString('base64');
            }
          }
        }
        await visit('');
        return result;
      }

      const before = await snapshot(paths.sharedTbdDir);
      const configPath = join(dir, '.tbd/config.yml');
      const config = await readFile(configPath, 'utf8');
      const result = runTbd(dir, ['--dry-run', ...args]);
      expect(result.status, result.stderr).toBe(0);
      expect(result.stdout).toContain('[DRY-RUN]');
      expect(await snapshot(paths.sharedTbdDir)).toEqual(before);
      expect(await readFile(join(dir, 'AGENTS.md'), 'utf8')).toBe(stale);
      expect(await readFile(configPath, 'utf8')).toBe(config);
    },
    CLI_TEST_TIMEOUT_MS,
  );
});

/**
 * AGENTS.md is a checkout file, so writing it must not depend on the shared
 * `$GIT_COMMON_DIR/tbd` tree. That tree is outside the writable area in a common
 * agent-sandbox layout (Codex worktrees), where the checkout itself is writable.
 */
describe.skipIf(process.platform === 'win32')(
  'AGENTS.md writes without the shared tbd tree',
  () => {
    it.each([
      ['policy', 'grant', 'subagents'],
      ['setup', '--auto', '--surfaces=agents-md'],
    ])(
      'runs %s %s with $GIT_COMMON_DIR/tbd unwritable',
      async (...args) => {
        const dir = await createRepo();
        const paths = await resolveSharedTbdPaths(dir);
        await mkdir(paths.sharedTbdDir, { recursive: true });
        await chmod(paths.sharedTbdDir, 0o500);
        try {
          const dry = runTbd(dir, ['--dry-run', ...args]);
          expect(dry.status, dry.stderr).toBe(0);
          const result = runTbd(dir, args);
          expect(result.status, result.stderr).toBe(0);
          expect(await readFile(join(dir, 'AGENTS.md'), 'utf8')).toContain('BEGIN TBD INTEGRATION');
        } finally {
          await chmod(paths.sharedTbdDir, 0o700);
        }
      },
      CLI_TEST_TIMEOUT_MS,
    );
  },
);

/**
 * A grant value is attacker-controlled text on a checked-out branch. Every place
 * that prints one strips control characters and caps the length, so a working-tree
 * value cannot clear the terminal above a warning or flood the output.
 */
describe('hostile grant values are sanitized wherever they are printed', () => {
  /** ESC (clears the screen and homes the cursor), BEL, and 300 characters. */
  const HOSTILE_VALUE = `[2J[H${'A'.repeat(300)}`;

  it(
    'strips and caps the value in setup --policies=recommended output',
    async () => {
      const dir = await createRepo({
        agentsMd: withPolicyBlock(
          `# Project\n\n${getCodexTbdSection()}`,
          renderPolicyBlock([{ name: 'subagents', value: HOSTILE_VALUE }], '2026-01-02'),
        ),
      });
      const result = runTbd(dir, ['setup', '--auto', '--policies=recommended']);
      expect(result.status, result.stderr).toBe(0);
      const output = result.stdout + result.stderr;
      // The `Kept <name>: <value>` line is the site that printed it raw.
      expect(output).toContain('Kept subagents');
      expect(output).not.toContain('[2J');
      expect(output).not.toContain('');
      expect(output).not.toContain('A'.repeat(200));
    },
    CLI_TEST_TIMEOUT_MS,
  );
});
