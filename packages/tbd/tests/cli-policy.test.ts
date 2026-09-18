/** End-to-end CLI contract tests for `tbd policy`. */

import { execFile, spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import { getCodexTbdSection } from '../src/cli/commands/setup.js';
import { AGENT_INTEGRATION_FORMAT } from '../src/lib/integration-paths.js';
import {
  INTEGRATION_END_MARKER,
  POLICY_BEGIN_MARKER,
  POLICY_END_MARKER,
  POLICY_NAMES,
  parsePolicyBlock,
  renderPolicyBlock,
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
        /Unanswered[^\n]*\n(\s+[a-z-]+.*\n)*\s+github-merge\s+not-granted/,
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
});

describe('tbd policy grant, revoke, and set', () => {
  it(
    'round trips each policy and value and preserves unknown policy names',
    async () => {
      const seeded = `# Project\n\n${getCodexTbdSection().replace(
        INTEGRATION_END_MARKER,
        `${POLICY_BEGIN_MARKER}\n- \`future-policy\`: keep me\n${POLICY_END_MARKER}\n${INTEGRATION_END_MARKER}`,
      )}`;
      const dir = await createRepo({ agentsMd: seeded });

      const expected: Record<string, string> = {};
      const record = (args: string[], name: string, value: string) => {
        const result = runTbd(dir, ['policy', ...args]);
        expect(result.status, `${args.join(' ')}: ${result.stderr}`).toBe(0);
        expected[name] = value;
      };

      for (const name of POLICY_NAMES) {
        if (name === 'pr-review-requirements') {
          continue;
        }
        record(['revoke', name], name, 'not-granted');
      }
      record(['grant', 'github-workflows'], 'github-workflows', 'granted');
      record(['grant', 'github-editing'], 'github-editing', 'granted');
      record(['grant', 'github-merge'], 'github-merge', 'per-request');
      record(['set', 'github-merge', 'unconditional'], 'github-merge', 'unconditional');
      record(['grant', 'github-stacked-prs'], 'github-stacked-prs', 'granted');
      record(['grant', 'subagents'], 'subagents', 'granted');
      record(['grant', 'pr-review-requirements'], 'pr-review-requirements', 'standard');
      record(['set', 'pr-review-requirements', 'none'], 'pr-review-requirements', 'none');
      record(
        ['set', 'pr-review-requirements', 'standard', '+', '2', 'rounds', '+', 'security'],
        'pr-review-requirements',
        'standard + security + 2 rounds',
      );
      record(['grant', 'linear'], 'linear', 'epics');
      record(['set', 'linear', 'epics+specs'], 'linear', 'epics + specs');
      record(['set', 'linear', 'custom'], 'linear', 'custom');

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
    'honors --dry-run and prints the discouraged-value notice for set',
    async () => {
      const dir = await createRepo();
      const original = await readFile(join(dir, 'AGENTS.md'), 'utf-8');
      const dry = runTbd(dir, ['--dry-run', 'policy', 'grant', 'subagents']);
      expect(dry.status, dry.stderr).toBe(0);
      expect(await readFile(join(dir, 'AGENTS.md'), 'utf-8')).toBe(original);

      const discouraged = runTbd(dir, ['policy', 'set', 'github-merge', 'unconditional']);
      expect(discouraged.status, discouraged.stderr).toBe(0);
      expect(discouraged.stdout).toContain('recommends against');
    },
    CLI_TEST_TIMEOUT_MS,
  );
});
