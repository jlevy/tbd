/**
 * `tbd doctor` checks of the policy block in AGENTS.md: a malformed or
 * unknown-version block, unknown values for known policies, a working tree block
 * that differs from the default branch's committed block, unrecognized policy
 * names (an informational note), and the AGENTS.md freshness check for a tbd
 * block that holds grants. Doctor reports and never changes the block.
 *
 * The rules come from packages/tbd/docs/guidelines/agent-policy-grants.md
 * (Where Grants Come From > Validation; The Policy Block).
 */

import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { policyGrantFindings } from '../src/cli/commands/doctor.js';
import { getCodexTbdSection } from '../src/cli/commands/setup.js';
import {
  POLICY_BEGIN_MARKER,
  POLICY_BLOCK_PROSE,
  POLICY_END_MARKER,
  parsePolicyBlock,
  resolvePolicyStatuses,
  withPolicyBlock,
  type DefaultBranchRef,
  type EffectiveGrants,
  type WorkingTreeGrants,
} from '../src/lib/policy-grants.js';
import { subprocessTestTimeout } from './test-helpers.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TBD_BIN = join(__dirname, '..', 'dist', 'bin.mjs');

const ORIGIN_MAIN: DefaultBranchRef = {
  branch: 'main',
  ref: 'refs/remotes/origin/main',
  kind: 'remote-tracking',
};

/** AGENTS.md holding the generated tbd block, with a policy block when `blockLines` is given. */
function agentsMd(blockLines: string[] | null, beginMarker = POLICY_BEGIN_MARKER): string {
  const section =
    blockLines === null
      ? getCodexTbdSection()
      : withPolicyBlock(
          getCodexTbdSection(),
          `${beginMarker}\n${POLICY_BLOCK_PROSE}\n\n${blockLines.join('\n')}\n${POLICY_END_MARKER}\n`,
        );
  return `# Project\n\n${section}`;
}

function effectiveFrom(
  content: string | null,
  source: DefaultBranchRef | null = ORIGIN_MAIN,
): EffectiveGrants {
  const parse = content === null ? ({ status: 'missing' } as const) : parsePolicyBlock(content);
  return { source, parse, policies: resolvePolicyStatuses(parse), committed: content };
}

function workingTreeFrom(content: string | null): WorkingTreeGrants {
  const parse = content === null ? ({ status: 'missing' } as const) : parsePolicyBlock(content);
  return {
    agentsMdExists: content !== null,
    integrationBlock: content !== null,
    parse,
    policies: resolvePolicyStatuses(parse),
  };
}

describe('policyGrantFindings', () => {
  it('warns on stale guidance and keeps warning until the default branch is refreshed', () => {
    const current = agentsMd(['- `subagents`: granted']);
    const stale = current.replace(
      POLICY_BLOCK_PROSE,
      POLICY_BLOCK_PROSE.split('\nOnly the copy')[0]!,
    );
    expect(policyGrantFindings(effectiveFrom(stale), workingTreeFrom(stale))).toEqual([
      expect.objectContaining({
        status: 'warn',
        message: 'policy block guidance is stale or missing',
        suggestion: expect.stringContaining('tbd policy refresh'),
      }),
    ]);
    expect(policyGrantFindings(effectiveFrom(stale), workingTreeFrom(current))).toEqual([
      expect.objectContaining({
        status: 'warn',
        message: 'policy block guidance on origin/main is stale or missing',
      }),
    ]);
    const rewrapped = current.replace(POLICY_BLOCK_PROSE, POLICY_BLOCK_PROSE.replace(/\s+/gu, ' '));
    expect(policyGrantFindings(effectiveFrom(rewrapped), workingTreeFrom(rewrapped))).toEqual([
      expect.objectContaining({ status: 'ok' }),
    ]);
  });

  it('adds no line when no policy block is recorded anywhere', () => {
    expect(
      policyGrantFindings(effectiveFrom(agentsMd(null)), workingTreeFrom(agentsMd(null))),
    ).toEqual([]);
    expect(policyGrantFindings(effectiveFrom(null, null), workingTreeFrom(null))).toEqual([]);
  });

  it('reports one ok line when the working tree block matches the default branch', () => {
    const content = agentsMd(['- `subagents`: granted', '- `github-merge`: confirm-session']);
    expect(policyGrantFindings(effectiveFrom(content), workingTreeFrom(content))).toEqual([
      {
        name: 'Policy grants',
        status: 'ok',
        message: '2 of 7 policies answered, matching origin/main',
        path: 'AGENTS.md',
      },
    ]);
  });

  it('reports a malformed working tree block as an error with the parser problems', () => {
    const committed = agentsMd(['- `subagents`: granted']);
    const malformed = agentsMd(['- `subagents`: granted', '- `subagents`: not-granted']);
    expect(policyGrantFindings(effectiveFrom(committed), workingTreeFrom(malformed))).toEqual([
      {
        name: 'Policy grants',
        status: 'error',
        message: 'malformed policy block (agents treat every policy as unanswered)',
        path: 'AGENTS.md',
        details: ['policy "subagents" is listed twice'],
        suggestion:
          'Fix it by hand (see: tbd guidelines agent-policy-grants) or delete the block and record the grants again with tbd policy',
      },
    ]);
  });

  it('reports each malformed case the parser finds', () => {
    const outside = `${agentsMd(null)}\n${POLICY_BEGIN_MARKER}\n- \`subagents\`: granted\n${POLICY_END_MARKER}\n`;
    const [finding] = policyGrantFindings(effectiveFrom(null), workingTreeFrom(outside));
    expect(finding).toMatchObject({ status: 'error' });
    expect(finding!.details).toEqual([
      expect.stringContaining('the policy block is not inside the tbd block'),
    ]);

    const badLine = agentsMd(['- `Sub Agents`: granted']);
    const [lineFinding] = policyGrantFindings(effectiveFrom(null), workingTreeFrom(badLine));
    expect(lineFinding).toMatchObject({ status: 'error' });
    expect(lineFinding!.details).toEqual([expect.stringContaining('grant line does not match')]);
  });

  it('reports a working tree block with an unknown version as an error asking for an upgrade', () => {
    const newer = agentsMd(['- `subagents`: granted'], '<!-- BEGIN TBD POLICY GRANTS v=2 -->');
    expect(policyGrantFindings(effectiveFrom(newer), workingTreeFrom(newer))).toEqual([
      {
        name: 'Policy grants',
        status: 'error',
        message: 'policy block version v=2 is not supported (this tbd reads v=1)',
        path: 'AGENTS.md',
        suggestion: 'Upgrade tbd: npm install -g get-tbd@latest',
      },
    ]);
  });

  it('bounds and strips control characters from unknown versions on both readings', () => {
    const hostile = `\u001b[2J\u001b[H\u0007${'V'.repeat(400)}`;
    const newer = agentsMd(
      ['- `subagents`: granted'],
      `<!-- BEGIN TBD POLICY GRANTS v=${hostile} -->`,
    );
    const workingFinding = policyGrantFindings(effectiveFrom(null), workingTreeFrom(newer))[0]!;
    const workingMessage = workingFinding.message!;
    expect(workingMessage).toContain('policy block version');
    expect(workingMessage).not.toContain('\u001b[2J');
    expect(workingMessage).not.toContain('\u0007');
    expect(workingMessage.length).toBeLessThan(180);

    const valid = agentsMd(['- `subagents`: granted']);
    const committedFinding = policyGrantFindings(effectiveFrom(newer), workingTreeFrom(valid))[0]!;
    const committedMessage = committedFinding.message!;
    expect(committedMessage).toContain('policy block version');
    expect(committedMessage).not.toContain('\u001b[2J');
    expect(committedMessage).not.toContain('\u0007');
    expect(committedMessage.length).toBeLessThan(180);
  });

  it('warns about unknown values for known policies, naming the fallback and the accepted values', () => {
    const content = agentsMd([
      '- `github-merge`: sometimes',
      '- `pr-review-requirements`: standard + 1 rounds',
      '- `subagents`: granted',
    ]);
    const findings = policyGrantFindings(effectiveFrom(content), workingTreeFrom(content));
    expect(findings).toEqual([
      {
        name: 'Policy grants',
        status: 'warn',
        message: 'unknown values for 2 policies',
        path: 'AGENTS.md',
        details: [
          'github-merge: sometimes (treated as confirm-every; github-merge accepts "never", "confirm-every", "confirm-session", "autonomous")',
          'pr-review-requirements: standard + 1 rounds (treated as standard; "1 rounds" restates standard; rounds must be 2 or more)',
        ],
        suggestion:
          'Record a valid value: tbd policy set <policy> <value> (see: tbd guidelines agent-policy-grants)',
      },
    ]);
  });

  it('warns when the working tree block differs from the default branch, listing each policy', () => {
    const committed = agentsMd(['- `github-merge`: confirm-session', '- `linear`: epics']);
    const working = agentsMd([
      '- `github-merge`: never',
      '- `subagents`: granted',
      '- `linear`: epics',
    ]);
    expect(policyGrantFindings(effectiveFrom(committed), workingTreeFrom(working))).toEqual([
      {
        name: 'Policy grants',
        status: 'warn',
        message: 'working tree block differs from origin/main in 2 policies',
        path: 'AGENTS.md',
        details: ['github-merge: confirm-session -> never', 'subagents: unanswered -> granted'],
        suggestion:
          'These grants take effect once committed and merged to main; see: tbd policy show',
      },
    ]);

    const [removed] = policyGrantFindings(
      effectiveFrom(committed),
      workingTreeFrom(agentsMd(null)),
    );
    expect(removed).toMatchObject({
      status: 'warn',
      message: 'working tree block differs from origin/main in 2 policies',
      details: ['github-merge: confirm-session -> unanswered', 'linear: epics -> unanswered'],
    });
  });

  it('names the ref grants are read from in each source kind', () => {
    const working = agentsMd(['- `subagents`: granted']);
    const local: DefaultBranchRef = { branch: 'trunk', ref: 'refs/heads/trunk', kind: 'local' };
    expect(policyGrantFindings(effectiveFrom(null, local), workingTreeFrom(working))).toEqual([
      expect.objectContaining({
        message: 'working tree block differs from trunk in 1 policy',
        suggestion:
          'These grants take effect once committed and merged to trunk; see: tbd policy show',
      }),
    ]);

    const head: DefaultBranchRef = { branch: 'feature', ref: 'HEAD', kind: 'head' };
    expect(policyGrantFindings(effectiveFrom(null, head), workingTreeFrom(working))).toEqual([
      expect.objectContaining({
        message: 'working tree block differs from HEAD (no default branch found) in 1 policy',
        suggestion: 'These grants take effect once committed; see: tbd policy show',
      }),
    ]);

    expect(policyGrantFindings(effectiveFrom(null, null), workingTreeFrom(working))).toEqual([
      expect.objectContaining({
        message:
          'working tree block differs from the default branch (nothing committed yet) in 1 policy',
        suggestion:
          'These grants take effect once committed and merged to the default branch; see: tbd policy show',
      }),
    ]);

    const unresolved: DefaultBranchRef = {
      branch: 'origin',
      ref: '',
      kind: 'unresolved',
      repair: 'git remote set-head origin --auto, or git fetch origin <default-branch>',
    };
    expect(policyGrantFindings(effectiveFrom(null, unresolved), workingTreeFrom(working))).toEqual([
      expect.objectContaining({
        status: 'warn',
        message: 'default branch could not be resolved; every policy is treated as unanswered',
        suggestion: unresolved.repair,
      }),
      expect.objectContaining({
        status: 'warn',
        message: 'working tree block differs from an unresolved default branch in 1 policy',
      }),
    ]);
  });

  it('warns when the default branch block cannot be read and the working tree block can', () => {
    const committed = agentsMd(['- `subagents`: granted', '- `subagents`: not-granted']);
    const working = agentsMd(['- `subagents`: granted']);
    expect(policyGrantFindings(effectiveFrom(committed), workingTreeFrom(working))).toEqual([
      {
        name: 'Policy grants',
        status: 'warn',
        message: 'malformed policy block on origin/main (agents treat every policy as unanswered)',
        path: 'AGENTS.md',
        details: ['policy "subagents" is listed twice'],
        suggestion:
          'A fixed block takes effect once committed and merged to main (see: tbd guidelines agent-policy-grants)',
      },
    ]);

    const newer = agentsMd(['- `subagents`: granted'], '<!-- BEGIN TBD POLICY GRANTS v=2 -->');
    expect(policyGrantFindings(effectiveFrom(newer), workingTreeFrom(working))).toEqual([
      {
        name: 'Policy grants',
        status: 'warn',
        message: 'policy block version v=2 on origin/main is not supported (this tbd reads v=1)',
        path: 'AGENTS.md',
        suggestion: 'Upgrade tbd: npm install -g get-tbd@latest',
      },
    ]);
  });

  it('notes unrecognized policy names without warning, since newer releases may add policies', () => {
    const content = agentsMd(['- `subagents`: granted', '- `future-policy`: keep me']);
    expect(policyGrantFindings(effectiveFrom(content), workingTreeFrom(content))).toEqual([
      {
        name: 'Policy grants',
        status: 'ok',
        message: '1 of 7 policies answered, matching origin/main',
        path: 'AGENTS.md',
      },
      {
        name: 'Policy grants',
        status: 'ok',
        message:
          'unrecognized policy kept: future-policy (a newer tbd may define it; otherwise check the spelling)',
        path: 'AGENTS.md',
      },
    ]);

    const two = agentsMd(['- `sub-agents`: granted', '- `future-policy`: keep me']);
    const working = agentsMd([
      '- `sub-agents`: granted',
      '- `future-policy`: keep me',
      '- `linear`: epics',
    ]);
    const findings = policyGrantFindings(effectiveFrom(two), workingTreeFrom(working));
    expect(findings.map((finding) => finding.status)).toEqual(['warn', 'ok']);
    expect(findings[1]).toMatchObject({
      message:
        'unrecognized policies kept: sub-agents, future-policy (a newer tbd may define them; otherwise check the spelling)',
    });
  });
});

interface DiagnosticJson {
  name: string;
  status: 'ok' | 'warn' | 'error';
  message?: string;
  details?: string[];
  suggestion?: string;
}

interface DoctorJson {
  integrationChecks: DiagnosticJson[];
}

describe('tbd doctor policy grants', { timeout: subprocessTestTimeout(60_000) }, () => {
  let projectDir: string;
  let fakeHome: string;

  beforeEach(async () => {
    projectDir = await mkdtemp(join(tmpdir(), 'tbd-doctor-policy-'));
    fakeHome = join(projectDir, '.home');
    await mkdir(fakeHome);
    run(['git', 'init', '--initial-branch=main']);
    run(['git', 'config', 'user.email', 'test@example.com']);
    run(['git', 'config', 'user.name', 'Test']);
    run(['git', 'config', 'commit.gpgsign', 'false']);
    await writeFile(join(projectDir, 'README.md'), '# Fixture\n');
    run(['git', 'add', 'README.md']);
    run(['git', 'commit', '-q', '-m', 'test: initialize fixture']);

    const setup = runTbd(['setup', '--auto', '--prefix=test']);
    expect(setup.status, setup.stderr).toBe(0);
    commitAll('test: set up tbd');
  }, subprocessTestTimeout(30_000));

  afterEach(async () => {
    await rm(projectDir, { recursive: true, force: true });
  }, subprocessTestTimeout(30_000));

  function run(command: [string, ...string[]]): void {
    const result = spawnSync(command[0], command.slice(1), { cwd: projectDir, encoding: 'utf-8' });
    expect(result.status, result.stderr).toBe(0);
  }

  function commitAll(message: string): void {
    run(['git', 'add', '-A']);
    run(['git', 'commit', '-q', '-m', message]);
  }

  function runTbd(args: string[]): { stdout: string; stderr: string; status: number } {
    const result = spawnSync('node', [TBD_BIN, ...args], {
      cwd: projectDir,
      encoding: 'utf-8',
      env: {
        ...process.env,
        HOME: fakeHome,
        USERPROFILE: fakeHome,
        FORCE_COLOR: '0',
        NO_COLOR: '1',
      },
    });
    return { stdout: result.stdout || '', stderr: result.stderr || '', status: result.status ?? 1 };
  }

  function doctor(): { status: number; checks: DiagnosticJson[] } {
    const result = runTbd(['doctor', '--json']);
    const report = JSON.parse(result.stdout) as DoctorJson;
    return { status: result.status, checks: report.integrationChecks };
  }

  function named(checks: DiagnosticJson[], name: string): DiagnosticJson[] {
    return checks.filter((check) => check.name === name);
  }

  async function readAgentsMd(): Promise<string> {
    return readFile(join(projectDir, 'AGENTS.md'), 'utf-8');
  }

  it('reports grants pending in the working tree, and keeps AGENTS.md current, without writing', async () => {
    const before = doctor();
    expect(named(before.checks, 'Policy grants')).toEqual([]);
    expect(named(before.checks, 'AGENTS.md')).toEqual([
      expect.objectContaining({ status: 'ok', message: 'current' }),
    ]);

    const grant = runTbd(['policy', 'grant', 'subagents']);
    expect(grant.status, grant.stderr).toBe(0);
    const pending = await readAgentsMd();

    const uncommitted = doctor();
    expect(uncommitted.status).toBe(0);
    expect(named(uncommitted.checks, 'Policy grants')).toEqual([
      {
        name: 'Policy grants',
        status: 'warn',
        message: 'working tree block differs from main in 1 policy',
        path: 'AGENTS.md',
        details: ['subagents: unanswered -> granted'],
        suggestion:
          'These grants take effect once committed and merged to main; see: tbd policy show',
      },
    ]);
    expect(named(uncommitted.checks, 'AGENTS.md')).toEqual([
      expect.objectContaining({ status: 'ok', message: 'current' }),
    ]);
    const text = runTbd(['doctor']);
    expect(text.stdout).toContain(
      '⚠ Policy grants - working tree block differs from main in 1 policy',
    );
    expect(text.stdout).toContain('subagents: unanswered -> granted');
    expect(await readAgentsMd()).toBe(pending);

    commitAll('grant subagents');
    const committed = doctor();
    expect(named(committed.checks, 'Policy grants')).toEqual([
      {
        name: 'Policy grants',
        status: 'ok',
        message: '1 of 7 policies answered, matching main',
        path: 'AGENTS.md',
      },
    ]);
    expect(named(committed.checks, 'AGENTS.md')).toEqual([
      expect.objectContaining({ status: 'ok', message: 'current' }),
    ]);
    expect(await readAgentsMd()).toBe(pending);
  });

  it('reports a malformed block as an error and leaves AGENTS.md unchanged', async () => {
    expect(runTbd(['policy', 'grant', 'subagents']).status).toBe(0);
    commitAll('grant subagents');
    const malformed = (await readAgentsMd()).replace(
      '- `subagents`: granted',
      '- `subagents`: granted\n- `subagents`: not-granted',
    );
    await writeFile(join(projectDir, 'AGENTS.md'), malformed);

    const report = doctor();
    expect(report.status).toBe(1);
    expect(named(report.checks, 'Policy grants')).toEqual([
      expect.objectContaining({
        status: 'error',
        message: 'malformed policy block (agents treat every policy as unanswered)',
        details: ['policy "subagents" is listed twice'],
      }),
    ]);
    expect(named(report.checks, 'AGENTS.md')).toEqual([
      {
        name: 'AGENTS.md',
        status: 'warn',
        message: 'freshness unknown: the policy block cannot be read',
        path: 'AGENTS.md',
        suggestion:
          'Fix the policy block (see the Policy grants finding), then run: tbd setup --auto --surfaces=agents-md',
      },
    ]);
    expect(await readAgentsMd()).toBe(malformed);
  });
});
