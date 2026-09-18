/**
 * Setup preserves the policy block inside the AGENTS.md tbd block, and records
 * grants only when `--policies` asks it to.
 *
 * `tbd setup` regenerates the tbd block on every run (and on every upgrade).
 * The policy block that `tbd policy` records inside it is the only record of a
 * project's grants, so setup must carry it over byte for byte, including policy
 * names this tbd does not know, and must never rewrite a block it cannot read.
 * `--policies=recommended` records the recommended set for unanswered policies.
 * The guideline is packages/tbd/docs/guidelines/agent-policy-grants.md
 * (Recording Grants, The Policy Block, Persistence).
 */

import { spawnSync } from 'node:child_process';
import { access, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  CODEX_BEGIN_MARKER,
  CODEX_END_MARKER,
  getCodexTbdSection,
  getCodexTbdSectionPreservingGrants,
  planRecommendedGrants,
} from '../src/cli/commands/setup.js';
import { CLIError } from '../src/cli/lib/errors.js';
import {
  extractManagedBlock,
  inspectManagedArtifact,
  integrationFormatNumber,
  parseManagedIntegrationFormat,
} from '../src/cli/lib/managed-artifact.js';
import { AGENT_INTEGRATION_FORMAT } from '../src/lib/integration-paths.js';
import {
  POLICY_BEGIN_MARKER,
  POLICY_END_MARKER,
  RECOMMENDED_GRANTS,
  parsePolicyBlock,
  renderPolicyBlock,
  resolvePolicyStatuses,
  withPolicyBlock,
} from '../src/lib/policy-grants.js';
import { subprocessTestTimeout } from './test-helpers.js';

const tbdBin = join(__dirname, '..', 'dist', 'bin.mjs');
const CLI_TEST_TIMEOUT_MS = subprocessTestTimeout();
const cleanupPaths: string[] = [];

/**
 * A hand-edited block: irregular spacing on a grant line, a note that is not a
 * grant line, a policy name this tbd does not know, and a stale Recorded date.
 * Setup must write every byte of it back.
 */
const HAND_BLOCK = `${POLICY_BEGIN_MARKER}
### Agent Policy Grants

Hand-written note kept as is.

- \`subagents\`: granted
-   \`future-policy\`:   keep me exactly
- \`github-merge\`: unconditional

Recorded 2025-01-02.
${POLICY_END_MARKER}
`;

const DUPLICATE_BLOCK = `${POLICY_BEGIN_MARKER}\n- \`subagents\`: granted\n- \`subagents\`: not-granted\n${POLICY_END_MARKER}\n`;
const ONE_LINE_BLOCK = `${POLICY_BEGIN_MARKER} - \`subagents\`: granted ${POLICY_END_MARKER}\n`;
const UNKNOWN_VERSION_BLOCK = `<!-- BEGIN TBD POLICY GRANTS v=2 -->\n- \`subagents\`: granted\n${POLICY_END_MARKER}\n`;

/** An AGENTS.md whose tbd block has a stale body, stamped `format`, holding `policyBlock`. */
function staleAgentsMd(policyBlock: string, format = AGENT_INTEGRATION_FORMAT): string {
  return (
    '# Project Instructions for AI Agents\n\n' +
    `${CODEX_BEGIN_MARKER} format=${format} surface=agents-md -->\n` +
    '## tbd\n\nStale body from an earlier release.\n\n' +
    `${policyBlock}${CODEX_END_MARKER}\n\n## My Notes\n\nKeep me.\n`
  );
}

function tbdBlockOf(agentsMd: string): string {
  return extractManagedBlock(agentsMd, CODEX_BEGIN_MARKER, CODEX_END_MARKER);
}

function runTbd(cwd: string, args: string[]): { stdout: string; stderr: string; status: number } {
  const result = spawnSync('node', [tbdBin, ...args], {
    cwd,
    encoding: 'utf-8',
    env: { ...process.env, FORCE_COLOR: '0' },
  });
  return { stdout: result.stdout || '', stderr: result.stderr || '', status: result.status ?? 1 };
}

/** An empty git repository, with no tbd. */
async function gitRepo(): Promise<string> {
  const dir = await realpath(await mkdtemp(join(tmpdir(), 'tbd-setup-policy-')));
  cleanupPaths.push(dir);
  for (const args of [
    ['init', '--initial-branch=main'],
    ['config', 'user.email', 'test@example.com'],
    ['config', 'user.name', 'Test'],
  ]) {
    const git = spawnSync('git', args, { cwd: dir, encoding: 'utf-8' });
    expect(git.status, git.stderr).toBe(0);
  }
  return dir;
}

/** A git repository with tbd initialized and a current AGENTS.md block, as a fresh setup leaves it. */
async function setUpRepo(): Promise<string> {
  const dir = await gitRepo();
  const setup = runTbd(dir, ['setup', '--auto', '--prefix=test', '--surfaces=agents-md']);
  expect(setup.status, setup.stderr).toBe(0);
  return dir;
}

function recommendedExcept(...names: string[]): typeof RECOMMENDED_GRANTS {
  return RECOMMENDED_GRANTS.filter((grant) => !names.includes(grant.name));
}

afterEach(async () => {
  await Promise.all(
    cleanupPaths.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
});

describe('getCodexTbdSectionPreservingGrants', () => {
  it('returns the plain section when AGENTS.md has no policy block', () => {
    expect(getCodexTbdSectionPreservingGrants('')).toBe(getCodexTbdSection());
    expect(getCodexTbdSectionPreservingGrants(staleAgentsMd(''))).toBe(getCodexTbdSection());
  });

  it('carries an existing block over byte for byte, including unknown policy names', () => {
    const section = getCodexTbdSectionPreservingGrants(staleAgentsMd(HAND_BLOCK, 'f08'));

    expect(section).toBe(withPolicyBlock(getCodexTbdSection(), HAND_BLOCK));
    expect(section).toContain(`\n\n${HAND_BLOCK}${CODEX_END_MARKER}\n`);
    expect(section.startsWith(`${CODEX_BEGIN_MARKER} format=${AGENT_INTEGRATION_FORMAT} `)).toBe(
      true,
    );
    expect(section).not.toContain('Stale body');
    // The rest of the block is the generated text, unchanged by the grants.
    expect(section.replace(HAND_BLOCK, '')).toBe(getCodexTbdSection());
    expect(parsePolicyBlock(section)).toMatchObject({
      status: 'ok',
      grants: [
        { name: 'subagents', value: 'granted' },
        { name: 'future-policy', value: 'keep me exactly' },
        { name: 'github-merge', value: 'unconditional' },
      ],
      recorded: '2025-01-02',
    });
  });

  it('refuses a malformed block and says how to fix it', () => {
    const cases: Record<string, string> = {
      'policy listed twice': staleAgentsMd(DUPLICATE_BLOCK),
      'missing END marker': staleAgentsMd(`${POLICY_BEGIN_MARKER}\n- \`subagents\`: granted\n`),
      'block outside the tbd block': `${staleAgentsMd('')}\n${HAND_BLOCK}`,
    };
    for (const [label, content] of Object.entries(cases)) {
      expect(() => getCodexTbdSectionPreservingGrants(content), label).toThrow(CLIError);
      expect(() => getCodexTbdSectionPreservingGrants(content), label).toThrow(
        /malformed policy block[\s\S]*unchanged[\s\S]*agent-policy-grants[\s\S]*tbd policy/,
      );
    }
    expect(() => getCodexTbdSectionPreservingGrants(staleAgentsMd(DUPLICATE_BLOCK))).toThrow(
      /twice/,
    );
  });

  it('refuses a block with a version it does not know and asks for an upgrade', () => {
    expect(() => getCodexTbdSectionPreservingGrants(staleAgentsMd(UNKNOWN_VERSION_BLOCK))).toThrow(
      CLIError,
    );
    expect(() => getCodexTbdSectionPreservingGrants(staleAgentsMd(UNKNOWN_VERSION_BLOCK))).toThrow(
      /v=2[\s\S]*unchanged[\s\S]*get-tbd@latest/,
    );
  });
});

describe('older-release guard', () => {
  it('stamps a block that carries grants above the ceiling of a pre-split release', async () => {
    const dir = await realpath(await mkdtemp(join(tmpdir(), 'tbd-setup-guard-')));
    cleanupPaths.push(dir);
    const agentsPath = join(dir, 'AGENTS.md');
    await writeFile(
      agentsPath,
      `# Project\n\n${getCodexTbdSectionPreservingGrants(staleAgentsMd(HAND_BLOCK, 'f08'))}`,
    );

    const block = tbdBlockOf(await readFile(agentsPath, 'utf-8'));
    expect(parseManagedIntegrationFormat(block)).toBe(AGENT_INTEGRATION_FORMAT);
    // tbd 0.9.0 (integration format f08) reads the stamp with this same parser and
    // number comparison (packages/tbd/src/cli/lib/managed-artifact.ts at v0.9.0),
    // so its setup reports the block too new and refuses to rewrite it.
    expect(integrationFormatNumber(AGENT_INTEGRATION_FORMAT)).toBeGreaterThan(
      integrationFormatNumber('f08'),
    );
    expect(
      await inspectManagedArtifact({
        path: agentsPath,
        expectedContent: 'whatever a 0.9.0 release would generate',
        ownershipMarker: CODEX_BEGIN_MARKER,
        supportedFormat: 'f08',
        selectManagedContent: tbdBlockOf,
      }),
    ).toEqual({ state: 'too-new', format: AGENT_INTEGRATION_FORMAT });
  });
});

describe('tbd setup --auto preserves the policy block', () => {
  it(
    'keeps a block recorded by tbd policy when --surfaces=agents-md refreshes AGENTS.md',
    async () => {
      const dir = await setUpRepo();
      const agentsPath = join(dir, 'AGENTS.md');
      const grant = runTbd(dir, ['policy', 'grant', 'subagents']);
      expect(grant.status, grant.stderr).toBe(0);
      const recorded = await readFile(agentsPath, 'utf-8');
      expect(parsePolicyBlock(recorded)).toMatchObject({ status: 'ok' });

      const result = runTbd(dir, ['setup', '--auto', '--surfaces=agents-md']);
      expect(result.status, result.stderr).toBe(0);
      expect(result.stdout).toContain('Already configured');
      expect(await readFile(agentsPath, 'utf-8')).toBe(recorded);
    },
    CLI_TEST_TIMEOUT_MS,
  );

  it(
    'carries the block through an upgrade of the tbd block, byte for byte',
    async () => {
      const dir = await setUpRepo();
      const agentsPath = join(dir, 'AGENTS.md');
      await writeFile(agentsPath, staleAgentsMd(HAND_BLOCK));

      const result = runTbd(dir, ['setup', '--auto', '--surfaces=agents-md']);
      expect(result.status, result.stderr).toBe(0);

      const agents = await readFile(agentsPath, 'utf-8');
      expect(agents).toContain(`\n\n${HAND_BLOCK}${CODEX_END_MARKER}\n`);
      expect(agents).not.toContain('Stale body');
      expect(agents).toContain('tbd policy show');
      expect(agents).toContain('## My Notes\n\nKeep me.\n');
      expect(tbdBlockOf(agents)).toBe(withPolicyBlock(getCodexTbdSection(), HAND_BLOCK));

      // A second run finds the block current and changes nothing.
      const again = runTbd(dir, ['setup', '--auto', '--surfaces=agents-md']);
      expect(again.status, again.stderr).toBe(0);
      expect(again.stdout).toContain('Already configured');
      expect(await readFile(agentsPath, 'utf-8')).toBe(agents);
    },
    CLI_TEST_TIMEOUT_MS,
  );

  it(
    'carries the block over when the full setup restamps a pre-split block',
    async () => {
      const dir = await setUpRepo();
      const agentsPath = join(dir, 'AGENTS.md');
      await writeFile(agentsPath, staleAgentsMd(HAND_BLOCK, 'f08'));

      const result = runTbd(dir, ['setup', '--auto']);
      expect(result.status, result.stderr).toBe(0);

      const agents = await readFile(agentsPath, 'utf-8');
      expect(agents).toContain(`format=${AGENT_INTEGRATION_FORMAT} surface=agents-md`);
      expect(agents).not.toContain('format=f08');
      expect(tbdBlockOf(agents)).toBe(withPolicyBlock(getCodexTbdSection(), HAND_BLOCK));
    },
    CLI_TEST_TIMEOUT_MS,
  );

  it(
    'refuses to rewrite a malformed block and leaves AGENTS.md unchanged',
    async () => {
      const dir = await setUpRepo();
      const agentsPath = join(dir, 'AGENTS.md');
      const malformed = staleAgentsMd(DUPLICATE_BLOCK);
      await writeFile(agentsPath, malformed);

      const result = runTbd(dir, ['setup', '--auto', '--surfaces=agents-md']);
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain('malformed policy block');
      expect(result.stderr).toContain('twice');
      expect(result.stderr).toContain('tbd policy');
      expect(await readFile(agentsPath, 'utf-8')).toBe(malformed);
    },
    CLI_TEST_TIMEOUT_MS,
  );

  it(
    'refuses a block whose markers share a line instead of deleting its grants',
    async () => {
      const dir = await setUpRepo();
      const agentsPath = join(dir, 'AGENTS.md');
      const oneLine = staleAgentsMd(ONE_LINE_BLOCK);
      await writeFile(agentsPath, oneLine);

      const result = runTbd(dir, ['setup', '--auto', '--surfaces=agents-md']);
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain('malformed policy block');
      expect(result.stderr).toContain('own line');
      expect(await readFile(agentsPath, 'utf-8')).toBe(oneLine);
    },
    CLI_TEST_TIMEOUT_MS,
  );

  it(
    'refuses a block with a version it does not know and leaves AGENTS.md unchanged',
    async () => {
      const dir = await setUpRepo();
      const agentsPath = join(dir, 'AGENTS.md');
      const newer = staleAgentsMd(UNKNOWN_VERSION_BLOCK);
      await writeFile(agentsPath, newer);

      const result = runTbd(dir, ['setup', '--auto']);
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain('v=2');
      expect(result.stderr).toContain('get-tbd@latest');
      expect(await readFile(agentsPath, 'utf-8')).toBe(newer);
    },
    CLI_TEST_TIMEOUT_MS,
  );
});

describe('planRecommendedGrants', () => {
  it('adds exactly the recommended set to an AGENTS.md without a block, leaving linear unanswered', () => {
    for (const content of ['', staleAgentsMd('')]) {
      const plan = planRecommendedGrants(content);
      expect(plan.added).toEqual(RECOMMENDED_GRANTS);
      expect(plan.kept).toEqual([]);
      expect(plan.grants).toEqual(RECOMMENDED_GRANTS);
      expect(plan.grants.map((grant) => grant.name)).not.toContain('linear');
    }
  });

  it('fills only unanswered policies and keeps answered values and unknown names', () => {
    const block = renderPolicyBlock(
      [
        { name: 'github-merge', value: 'unconditional' },
        { name: 'linear', value: 'epics' },
        { name: 'future-policy', value: 'keep me' },
      ],
      '2025-01-02',
    );
    const plan = planRecommendedGrants(staleAgentsMd(block));

    expect(plan.kept).toEqual([{ name: 'github-merge', value: 'unconditional' }]);
    expect(plan.added).toEqual(recommendedExcept('github-merge'));
    expect(plan.grants).toEqual(
      expect.arrayContaining([
        { name: 'github-merge', value: 'unconditional' },
        { name: 'linear', value: 'epics' },
        { name: 'future-policy', value: 'keep me' },
        ...recommendedExcept('github-merge'),
      ]),
    );
    expect(plan.grants).toHaveLength(RECOMMENDED_GRANTS.length + 2);
  });

  it('adds nothing when every recommended policy is answered', () => {
    const plan = planRecommendedGrants(
      staleAgentsMd(renderPolicyBlock(RECOMMENDED_GRANTS, '2025-01-02')),
    );
    expect(plan.added).toEqual([]);
    expect(plan.kept).toEqual(RECOMMENDED_GRANTS);
  });

  it('refuses a block it cannot read', () => {
    expect(() => planRecommendedGrants(staleAgentsMd(DUPLICATE_BLOCK))).toThrow(CLIError);
    expect(() => planRecommendedGrants(staleAgentsMd(DUPLICATE_BLOCK))).toThrow(/twice/);
    expect(() => planRecommendedGrants(staleAgentsMd(UNKNOWN_VERSION_BLOCK))).toThrow(/v=2/);
  });
});

describe('tbd setup --policies', () => {
  it(
    'records exactly the recommended set on a fresh setup and leaves linear unanswered',
    async () => {
      const dir = await gitRepo();
      const result = runTbd(dir, [
        'setup',
        '--auto',
        '--prefix=test',
        '--surfaces=agents-md',
        '--policies=recommended',
      ]);
      expect(result.status, result.stderr).toBe(0);

      const parse = parsePolicyBlock(await readFile(join(dir, 'AGENTS.md'), 'utf-8'));
      expect(parse).toMatchObject({ status: 'ok', grants: RECOMMENDED_GRANTS });
      const unanswered = resolvePolicyStatuses(parse)
        .filter((status) => !status.answered)
        .map((status) => status.name);
      expect(unanswered).toEqual(['linear']);

      expect(result.stdout).toContain('Policy grants (--policies=recommended):');
      for (const grant of RECOMMENDED_GRANTS) {
        expect(result.stdout).toContain(`  ✓ Recorded ${grant.name}: ${grant.value}\n`);
      }
      expect(result.stdout).toContain(
        '  linear is not in the recommended set and stays unanswered; ask the user separately.',
      );
      expect(result.stdout).toContain('`tbd shortcut setup-github-cli`');
      expect(result.stdout).toContain('1 policy is unanswered; setup-tbd asks the user about it.');
    },
    CLI_TEST_TIMEOUT_MS,
  );

  it(
    'records nothing without the flag',
    async () => {
      const dir = await setUpRepo();
      expect(parsePolicyBlock(await readFile(join(dir, 'AGENTS.md'), 'utf-8'))).toEqual({
        status: 'missing',
      });
    },
    CLI_TEST_TIMEOUT_MS,
  );

  it(
    'treats a backticked mention of the policy marker as current, not malformed',
    async () => {
      const dir = await setUpRepo();
      const agentsPath = join(dir, 'AGENTS.md');
      const original = await readFile(agentsPath, 'utf-8');
      await writeFile(
        agentsPath,
        `${original}\nSee the \`<!-- BEGIN TBD POLICY GRANTS v=1 -->\` block.\n`,
      );
      const result = runTbd(dir, ['setup', '--auto', '--surfaces=agents-md']);
      expect(result.status, result.stderr).toBe(0);
      expect(result.stderr + result.stdout).not.toMatch(/END marker is missing/);
      expect(parsePolicyBlock(await readFile(agentsPath, 'utf-8')).status).not.toBe('malformed');
    },
    CLI_TEST_TIMEOUT_MS,
  );

  it(
    'keeps answered policies on an existing project, fills the rest, and implies --auto',
    async () => {
      const dir = await setUpRepo();
      const agentsPath = join(dir, 'AGENTS.md');
      for (const args of [
        ['policy', 'set', 'github-merge', 'unconditional'],
        ['policy', 'set', 'linear', 'epics'],
      ]) {
        const recorded = runTbd(dir, args);
        expect(recorded.status, recorded.stderr).toBe(0);
      }

      const result = runTbd(dir, ['setup', '--policies=recommended', '--surfaces=agents-md']);
      expect(result.status, result.stderr).toBe(0);
      expect(result.stdout).toContain('All set!');
      expect(result.stdout).toContain(
        '  - Kept github-merge: unconditional (already answered; change it with `tbd policy`)',
      );
      expect(result.stdout).not.toContain('Recorded github-merge');
      expect(result.stdout).not.toContain('stays unanswered');

      const recorded = await readFile(agentsPath, 'utf-8');
      const statuses = resolvePolicyStatuses(parsePolicyBlock(recorded));
      expect(statuses.every((status) => status.answered)).toBe(true);
      expect(statuses.find((status) => status.name === 'github-merge')?.value).toBe(
        'unconditional',
      );
      expect(statuses.find((status) => status.name === 'linear')?.value).toBe('epics');

      // With every recommended policy answered, a second run leaves AGENTS.md alone.
      const again = runTbd(dir, [
        'setup',
        '--auto',
        '--policies=recommended',
        '--surfaces=agents-md',
      ]);
      expect(again.status, again.stderr).toBe(0);
      expect(again.stdout).toContain(
        '  Every recommended policy is already answered; nothing recorded.',
      );
      expect(await readFile(agentsPath, 'utf-8')).toBe(recorded);
    },
    CLI_TEST_TIMEOUT_MS,
  );

  it(
    'reports the grants it would record under --dry-run and writes nothing',
    async () => {
      const dir = await setUpRepo();
      const agentsPath = join(dir, 'AGENTS.md');
      const before = await readFile(agentsPath, 'utf-8');

      const result = runTbd(dir, [
        'setup',
        '--auto',
        '--dry-run',
        '--surfaces=agents-md',
        '--policies=recommended',
      ]);
      expect(result.status, result.stderr).toBe(0);
      expect(result.stdout).toContain('Would record policy grants in AGENTS.md');
      expect(result.stdout).toContain('github-workflows: granted');
      expect(await readFile(agentsPath, 'utf-8')).toBe(before);
    },
    CLI_TEST_TIMEOUT_MS,
  );

  it(
    'fails before changing anything when --surfaces excludes agents-md',
    async () => {
      const dir = await gitRepo();
      const result = runTbd(dir, [
        'setup',
        '--auto',
        '--prefix=test',
        '--surfaces=portable,claude',
        '--policies=recommended',
      ]);
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain(
        '--policies records grants in AGENTS.md, but --surfaces excludes agents-md.',
      );
      await expect(access(join(dir, '.tbd'))).rejects.toThrow();
      await expect(access(join(dir, 'AGENTS.md'))).rejects.toThrow();
    },
    CLI_TEST_TIMEOUT_MS,
  );

  it(
    'rejects a value other than recommended',
    async () => {
      const dir = await gitRepo();
      const result = runTbd(dir, ['setup', '--auto', '--prefix=test', '--policies=all']);
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain('recommended');
      await expect(access(join(dir, '.tbd'))).rejects.toThrow();
    },
    CLI_TEST_TIMEOUT_MS,
  );
});
