/**
 * `tbd start` — claim work, and `tbd whoami` — report who is claiming it.
 *
 * Claiming was already possible: set `status` to `in_progress`, set `assignee` to
 * something. Across 1,681 beads in this repository it had happened exactly zero times,
 * while the closing protocol — which appears in all four instruction surfaces and reads
 * as one verb — was followed consistently. That gap is a naming problem, not a
 * discipline problem, so this is one verb symmetric with `tbd close`.
 *
 * The actor comes from {@link resolveAgentIdentity}, which is total: an agent that
 * cannot name itself still claims under a derived `<harness>@<host>`, because a bead
 * claimed by an imprecisely-named agent is far better recorded than one claimed by
 * nobody.
 *
 * A claim is a *delegation*, so it writes `delegate` and leaves `assignee` alone. The
 * two are different questions — who is accountable, and who is doing the work — and an
 * earlier version of this command collapsed them because `assignee` was the only actor
 * field there was.
 */

import { Command } from 'commander';

import { BaseCommand } from '../lib/base-command.js';
import { requireInit, NotFoundError } from '../lib/errors.js';
import { readIssue, writeIssue } from '../../file/storage.js';
import { readLocalState, writeLocalState } from '../../file/config.js';
import { formatDisplayId } from '../../lib/ids.js';
import { now } from '../../utils/time-utils.js';
import { withDataSyncContext } from '../lib/data-context.js';
import { resolveIssueId } from '../lib/id-suggestions.js';
import {
  resolveAgentIdentity,
  generateAgentId,
  type AgentIdentity,
} from '../../lib/agent-identity.js';

/** Resolve identity for this invocation, reading whatever the session minted. */
async function identityFor(tbdRoot: string, as?: string): Promise<AgentIdentity> {
  const state = await readLocalState(tbdRoot);
  return resolveAgentIdentity({
    as,
    session: { agent_id: state.agent_id, agent_name: state.agent_name },
  });
}

class WhoamiHandler extends BaseCommand {
  async run(options: { as?: string; ensureId?: boolean }): Promise<void> {
    const tbdRoot = await requireInit();

    await this.execute(async () => {
      let identity = await identityFor(tbdRoot, options.as);

      // `--ensure-id` is the session-start path: mint once per working directory and
      // remember it, so every later invocation reports the same agent rather than a
      // fresh one. Idempotent by design, because SessionStart fires again on resume,
      // clear, and compact.
      if (options.ensureId && !identity.id) {
        const state = await readLocalState(tbdRoot);
        const agentId = state.agent_id ?? generateAgentId();
        await writeLocalState(tbdRoot, {
          ...state,
          agent_id: agentId,
          agent_name: state.agent_name ?? identity.name,
        });
        identity = { ...identity, id: agentId };
      }

      this.output.data(
        {
          id: identity.id,
          name: identity.name,
          harness: identity.harness,
          model: identity.model,
          source: identity.source,
        },
        () => {
          const parts = [identity.name];
          if (identity.id) {
            parts.push(`(${identity.id})`);
          }
          this.output.notice(parts.join(' '));
          this.output.info(
            `harness: ${identity.harness}` +
              (identity.model ? ` · model: ${identity.model}` : '') +
              ` · via ${identity.source}`,
          );
        },
      );
    }, 'Failed to resolve agent identity');
  }
}

class StartHandler extends BaseCommand {
  async run(ids: string[], options: { as?: string }): Promise<void> {
    const tbdRoot = await requireInit();
    const identity = await identityFor(tbdRoot, options.as);

    const claimed: string[] = [];
    const skipped: { id: string; reason: string }[] = [];

    await this.execute(async () => {
      await withDataSyncContext(
        tbdRoot,
        { lock: true },
        async ({ dataSyncDir, mapping, config }) => {
          for (const id of ids) {
            const internalId = resolveIssueId(id, mapping, config.display.id_prefix);

            let issue;
            try {
              issue = await readIssue(dataSyncDir, internalId);
            } catch {
              throw new NotFoundError('Issue', id);
            }

            const displayId = formatDisplayId(issue.id, mapping, config.display.id_prefix);

            if (issue.status === 'closed') {
              // Silently reopening closed work would hide a mistake rather than
              // surface it; `tbd reopen` is the deliberate verb for that.
              skipped.push({ id: displayId, reason: 'closed — reopen it first' });
              continue;
            }

            // Someone else's live claim is reported, not stolen. Two agents racing for
            // one bead is a coordination problem, and silently overwriting the loser's
            // claim is how it stays invisible.
            if (
              issue.status === 'in_progress' &&
              issue.delegate &&
              issue.delegate !== identity.name
            ) {
              skipped.push({ id: displayId, reason: `already claimed by ${issue.delegate}` });
              continue;
            }

            if (issue.status === 'in_progress' && issue.delegate === identity.name) {
              skipped.push({ id: displayId, reason: 'already yours' });
              continue;
            }

            if (this.checkDryRun('Would claim', { id: displayId, delegate: identity.name })) {
              continue;
            }

            issue.status = 'in_progress';
            // The claim lands on the acting axis. `assignee` is who is accountable —
            // usually a human, often the same on every bead — and an agent writing
            // itself there answers a question nobody asked while destroying the answer
            // to the one they did.
            issue.delegate = identity.name;
            issue.version += 1;
            issue.updated_at = now();
            await writeIssue(dataSyncDir, issue);
            claimed.push(displayId);
          }
        },
      );
    }, 'Failed to claim issue');

    this.output.data({ claimed, skipped, delegate: identity.name }, () => {
      if (claimed.length > 0) {
        this.output.success(`Claimed as ${identity.name}: ${claimed.join(', ')}`);
      }
      for (const { id, reason } of skipped) {
        this.output.notice(`Skipped ${id}: ${reason}`);
      }
      if (claimed.length === 0 && skipped.length === 0) {
        this.output.info('Nothing to claim');
      }
    });
  }
}

export const startCommand = new Command('start')
  .description('Claim issues: set them in progress and record who is working on them')
  .argument('<ids...>', 'Issue ID(s) to claim')
  .option('--as <name>', 'Claim as this agent name instead of the resolved identity')
  .action(async (ids, options, command) => {
    const handler = new StartHandler(command);
    await handler.run(ids, options);
  });

export const whoamiCommand = new Command('whoami')
  .description('Show the agent identity tbd will record when claiming work')
  .option('--as <name>', 'Resolve as if this name had been passed to a claim')
  .option('--ensure-id', 'Mint and remember an agent id for this working directory')
  .action(async (options, command) => {
    const handler = new WhoamiHandler(command);
    await handler.run(options);
  });
