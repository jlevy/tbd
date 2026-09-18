/**
 * `tbd policy` - Show and record agent policy grants in AGENTS.md.
 *
 * Grants live in the policy block inside the tbd block in AGENTS.md. `show`
 * reads the effective grants from the default branch and the pending ones from
 * the working tree; `grant`, `revoke`, and `set` edit the working tree block.
 * The policies and the block syntax are defined by `tbd guidelines
 * agent-policy-grants` and implemented in lib/policy-grants.ts.
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { writeFile } from 'atomically';
import { Command } from 'commander';

import { readConfig } from '../../file/config.js';
import { getCurrentBranch } from '../../file/git.js';
import { AGENTS_MD_REL } from '../../lib/integration-paths.js';
import type {
  DefaultBranchRef,
  EffectiveGrants,
  PolicyBlockParse,
  PolicyDifference,
  PolicyName,
  PolicyStatus,
  WorkingTreeGrants,
} from '../../lib/policy-grants.js';
import {
  POLICIES,
  POLICY_BLOCK_VERSION,
  POLICY_NAMES,
  PolicyBlockError,
  SETUP_AGENTS_MD_HINT,
  checkPolicyValue,
  describeGrantStamp,
  displayPolicyValue,
  diffPolicyStatuses,
  isKnownPolicy,
  parsePolicyBlock,
  readEffectiveGrants,
  readWorkingTreeGrants,
  renderPolicyBlock,
  upsertGrant,
  withPolicyBlock,
} from '../../lib/policy-grants.js';
import { BaseCommand } from '../lib/base-command.js';
import { CLIError, ValidationError, requireInit } from '../lib/errors.js';

const GUIDELINE_HINT = 'tbd guidelines agent-policy-grants';
const UPGRADE_HINT = 'npm install -g get-tbd@latest';

/** A parse without the block text, for JSON output. */
type PolicyBlockSummary =
  | { status: 'missing' }
  | { status: 'unknown-version'; version: string }
  | { status: 'malformed'; problems: string[] }
  | { status: 'ok'; recorded: string | null };

/** The `tbd policy show --json` document. */
interface PolicyShowReport {
  /** Where the effective grants were read from; null when nothing is committed. */
  source: DefaultBranchRef | null;
  block: PolicyBlockSummary;
  policies: PolicyStatus[];
  workingTree: {
    agentsMdExists: boolean;
    integrationBlock: boolean;
    block: PolicyBlockSummary;
    policies: PolicyStatus[];
    /** Policies recorded differently in the working tree than on the default branch. */
    differences: PolicyDifference[];
  };
}

function summarizeParse(parse: PolicyBlockParse): PolicyBlockSummary {
  switch (parse.status) {
    case 'ok':
      return { status: 'ok', recorded: parse.recorded };
    case 'missing':
    case 'unknown-version':
    case 'malformed':
      return parse;
    default: {
      const _exhaustive: never = parse;
      throw new Error(`Unhandled parse status: ${JSON.stringify(_exhaustive)}`);
    }
  }
}

/** The remote whose copy of the default branch is preferred: the sync remote. */
async function syncRemote(tbdRoot: string): Promise<string> {
  try {
    return (await readConfig(tbdRoot)).sync.remote;
  } catch {
    return 'origin';
  }
}

function describeSource(source: DefaultBranchRef | null): string {
  if (!source) {
    return 'nothing is committed yet';
  }
  switch (source.kind) {
    case 'remote-tracking':
    case 'local':
      return `AGENTS.md on ${source.branch} (${source.ref})${describeGrantStamp(source)}`;
    case 'head':
      return `AGENTS.md at HEAD (${source.branch}); no default branch found (no origin/HEAD, main, or master)${describeGrantStamp(source)}`;
    case 'unresolved':
      return `unresolved; every policy is treated as unanswered. Repair: ${source.repair ?? 'git remote set-head <remote> --auto, or git fetch <remote> <branch>'}`;
    default: {
      const _exhaustive: never = source.kind;
      throw new Error(`Unhandled source kind: ${String(_exhaustive)}`);
    }
  }
}

function unknownVersionMessage(where: string, version: string): string {
  return (
    `${where} has a policy block with version v=${version}; this tbd reads v=${POLICY_BLOCK_VERSION}. ` +
    `Upgrade tbd: ${UPGRADE_HINT}`
  );
}

function malformedMessage(where: string, problems: string[]): string {
  return [
    `${where} has a malformed policy block:`,
    ...problems.map((problem) => `  - ${problem}`),
    `Fix it by hand (see \`${GUIDELINE_HINT}\`) or delete the block and record the grants again.`,
  ].join('\n');
}

/** Today's date as YYYY-MM-DD (UTC), for the block's Recorded line. */
function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

class PolicyShowHandler extends BaseCommand {
  async run(): Promise<void> {
    const tbdRoot = await requireInit();
    const remote = await syncRemote(tbdRoot);
    const effective = await this.execute(
      () => readEffectiveGrants(tbdRoot, remote),
      'Failed to read grants from the default branch',
    );
    const workingTree = await readWorkingTreeGrants(tbdRoot);
    const report: PolicyShowReport = {
      source: effective.source,
      block: summarizeParse(effective.parse),
      policies: effective.policies,
      workingTree: {
        agentsMdExists: workingTree.agentsMdExists,
        integrationBlock: workingTree.integrationBlock,
        block: summarizeParse(workingTree.parse),
        policies: workingTree.policies,
        differences: diffPolicyStatuses(effective.policies, workingTree.policies),
      },
    };
    this.output.data(report, () => {
      this.printReport(report, effective, workingTree);
    });
  }

  private printReport(
    report: PolicyShowReport,
    effective: EffectiveGrants,
    workingTree: WorkingTreeGrants,
  ): void {
    const colors = this.output.getColors();
    const lines: string[] = [];
    lines.push(colors.bold(`Agent policy grants`) + colors.dim(` (see \`${GUIDELINE_HINT}\`)`));
    lines.push(`Effective grants: ${describeSource(effective.source)}.`);
    const where = effective.source ? `AGENTS.md on ${effective.source.branch}` : 'AGENTS.md';
    if (effective.parse.status === 'unknown-version') {
      lines.push(
        colors.warn(
          `${unknownVersionMessage(where, effective.parse.version)} Every policy is treated as unanswered.`,
        ),
      );
    } else if (effective.parse.status === 'malformed') {
      lines.push(colors.warn(`${where} has a malformed policy block; every policy is treated as`));
      lines.push(colors.warn('unanswered until it is fixed:'));
      for (const problem of effective.parse.problems) {
        lines.push(colors.warn(`  - ${problem}`));
      }
    }
    lines.push('');

    const answered = report.policies.filter((p) => p.answered);
    const unanswered = report.policies.filter((p) => !p.answered);
    const width = Math.max(...report.policies.map((p) => p.name.length)) + 2;
    if (answered.length > 0) {
      lines.push('Answered:');
      for (const status of answered) {
        lines.push(`  ${status.name.padEnd(width)}${this.describeAnswered(status)}`);
      }
    }
    if (unanswered.length > 0) {
      lines.push('Unanswered (treated as shown until recorded):');
      for (const status of unanswered) {
        const definition = POLICIES[status.name as PolicyName];
        const hint =
          definition.recommended === null
            ? `ask separately; \`tbd policy grant ${status.name}\` records ${definition.grantValue}`
            : `recommended: ${definition.recommended}`;
        lines.push(
          `  ${status.name.padEnd(width)}${(status.effective ?? '').padEnd(14)}${colors.dim(hint)}`,
        );
      }
    }
    lines.push('');

    if (!workingTree.agentsMdExists || !workingTree.integrationBlock) {
      lines.push(
        colors.warn(
          `${AGENTS_MD_REL} in the working tree has no tbd block; ${SETUP_AGENTS_MD_HINT}.`,
        ),
      );
    } else if (workingTree.parse.status === 'unknown-version') {
      lines.push(colors.warn(unknownVersionMessage('The working tree', workingTree.parse.version)));
    } else if (workingTree.parse.status === 'malformed') {
      lines.push(colors.warn(malformedMessage('The working tree', workingTree.parse.problems)));
    } else if (report.workingTree.differences.length > 0) {
      const branch = effective.source?.branch ?? 'the default branch';
      lines.push(colors.warn(`Working tree AGENTS.md differs from ${branch}:`));
      for (const difference of report.workingTree.differences) {
        lines.push(
          `  ${difference.name}: ${difference.from ?? 'unanswered'} -> ${difference.to ?? 'unanswered'}`,
        );
      }
      lines.push(`These grants take effect once committed and merged to ${branch}.`);
    }
    lines.push(colors.dim('Change grants with `tbd policy grant|revoke|set`.'));
    console.log(lines.join('\n'));
  }

  private describeAnswered(status: PolicyStatus): string {
    const colors = this.output.getColors();
    const raw =
      status.known && status.valid ? (status.value ?? '') : displayPolicyValue(status.value ?? '');
    const value = raw.padEnd(14);
    if (!status.known) {
      return `${value}${colors.dim('(unknown policy; a newer tbd may define it)')}`;
    }
    if (!status.valid) {
      return `${value}${colors.warn(`(unknown value; treated as ${status.effective ?? 'unanswered'})`)}`;
    }
    return value.trimEnd();
  }
}

type RecordVerb = 'grant' | 'revoke' | 'set';

/** Shared write path for `grant`, `revoke`, and `set`. */
class PolicyRecordHandler extends BaseCommand {
  async run(verb: RecordVerb, policyName: string, rawValue: string | null): Promise<void> {
    const tbdRoot = await requireInit();
    if (!isKnownPolicy(policyName)) {
      throw new ValidationError(
        `Unknown policy "${policyName}". Policies: ${POLICY_NAMES.join(', ')}`,
      );
    }
    const value = resolveValue(verb, policyName, rawValue);
    const agentsPath = join(tbdRoot, AGENTS_MD_REL);

    let content: string;
    try {
      content = await readFile(agentsPath, 'utf-8');
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        throw new CLIError(`${AGENTS_MD_REL} not found; ${SETUP_AGENTS_MD_HINT}`);
      }
      throw error;
    }

    const parse = parsePolicyBlock(content);
    let grants = parse.status === 'ok' ? parse.grants : [];
    switch (parse.status) {
      case 'unknown-version':
        throw new CLIError(unknownVersionMessage(AGENTS_MD_REL, parse.version));
      case 'malformed':
        throw new CLIError(malformedMessage(AGENTS_MD_REL, parse.problems));
      case 'missing':
      case 'ok':
        break;
      default: {
        const _exhaustive: never = parse;
        throw new Error(`Unhandled parse status: ${JSON.stringify(_exhaustive)}`);
      }
    }

    if (this.checkDryRun(`Would record ${policyName}: ${value} in ${AGENTS_MD_REL}`)) {
      return;
    }

    grants = upsertGrant(grants, policyName, value);
    const recorded = todayDate();
    let updated: string;
    try {
      updated = withPolicyBlock(content, renderPolicyBlock(grants, recorded));
    } catch (error) {
      if (error instanceof PolicyBlockError) {
        throw new CLIError(error.message);
      }
      throw error;
    }
    await this.execute(() => writeFile(agentsPath, updated), `Failed to write ${AGENTS_MD_REL}`);

    const source = (await readEffectiveGrants(tbdRoot, await syncRemote(tbdRoot))).source;
    const effectHint = await describeHowToTakeEffect(tbdRoot, source);
    this.output.data(
      { policy: policyName, value, file: AGENTS_MD_REL, recorded, defaultBranch: source },
      () => {
        this.output.success(`Recorded ${policyName}: ${value} in ${AGENTS_MD_REL}`);
        if (POLICIES[policyName].discouraged.includes(value)) {
          this.output.notice(
            `tbd recommends against ${policyName}: ${value}; recorded because you asked for it.`,
          );
        }
        console.log(`  ${effectHint} \`tbd policy show\` reports effective grants.`);
      },
    );
  }
}

function resolveValue(verb: RecordVerb, policyName: PolicyName, rawValue: string | null): string {
  const definition = POLICIES[policyName];
  switch (verb) {
    case 'grant':
      return definition.grantValue;
    case 'revoke':
      if (definition.revokeValue === null) {
        throw new ValidationError(
          `${policyName} has no revoke value; use \`tbd policy set ${policyName} <value>\` ` +
            `(see \`${GUIDELINE_HINT}\`)`,
        );
      }
      return definition.revokeValue;
    case 'set': {
      const check = checkPolicyValue(policyName, rawValue ?? '');
      if (!check.ok) {
        throw new ValidationError(
          `Unknown value for ${policyName}: "${rawValue ?? ''}" (${check.reason}). ` +
            `See \`${GUIDELINE_HINT}\`.`,
        );
      }
      return check.canonical;
    }
    default: {
      const _exhaustive: never = verb;
      throw new Error(`Unhandled verb: ${String(_exhaustive)}`);
    }
  }
}

/** One sentence on what makes the recorded grant effective, given where grants are read from. */
async function describeHowToTakeEffect(
  tbdRoot: string,
  source: DefaultBranchRef | null,
): Promise<string> {
  if (source?.kind === 'unresolved') {
    return (
      `The default branch could not be resolved (${source.repair}). ` +
      `Grants stay unanswered until it is.`
    );
  }
  if (!source || source.kind === 'head') {
    return `Commit ${AGENTS_MD_REL} for it to take effect.`;
  }
  let current: string | null = null;
  try {
    current = await getCurrentBranch(tbdRoot);
  } catch {
    // Detached or unborn HEAD: fall through to the merge wording.
  }
  if (current !== source.branch) {
    return `Commit ${AGENTS_MD_REL} and merge it to ${source.branch} for it to take effect.`;
  }
  return source.kind === 'remote-tracking'
    ? `Commit ${AGENTS_MD_REL} and push ${source.branch} for it to take effect.`
    : `Commit ${AGENTS_MD_REL} on ${source.branch} for it to take effect.`;
}

const showPolicyCommand = new Command('show')
  .description('Show answered and unanswered policies with their effective values')
  .action(async (_options, command) => {
    const handler = new PolicyShowHandler(command);
    await handler.run();
  });

const grantPolicyCommand = new Command('grant')
  .description("Record a policy's recommended value (linear: epics)")
  .argument('<policy>', `Policy name: ${POLICY_NAMES.join(', ')}`)
  .action(async (policy: string, _options, command) => {
    const handler = new PolicyRecordHandler(command);
    await handler.run('grant', policy, null);
  });

const revokePolicyCommand = new Command('revoke')
  .description("Record a policy's not-granted value")
  .argument('<policy>', `Policy name: ${POLICY_NAMES.join(', ')}`)
  .action(async (policy: string, _options, command) => {
    const handler = new PolicyRecordHandler(command);
    await handler.run('revoke', policy, null);
  });

const setPolicyCommand = new Command('set')
  .description('Record any valid value for a policy (e.g. "standard + 2 rounds")')
  .argument('<policy>', `Policy name: ${POLICY_NAMES.join(', ')}`)
  .argument('<value...>', 'Value; several words are joined with spaces')
  .action(async (policy: string, value: string[], _options, command) => {
    const handler = new PolicyRecordHandler(command);
    await handler.run('set', policy, value.join(' '));
  });

export const policyCommand = new Command('policy')
  .description('Show and record agent policy grants')
  .addCommand(showPolicyCommand, { isDefault: true })
  .addCommand(grantPolicyCommand)
  .addCommand(revokePolicyCommand)
  .addCommand(setPolicyCommand);
