/** `tbd watch` - Block until selected committed bead state changes. */

import { Command } from 'commander';

import { watchForIssueChanges } from '../../file/bead-watch.js';
import { readConfig } from '../../file/config.js';
import { BaseCommand } from '../lib/base-command.js';
import { parseChangeSelection, type ChangeSelectionOptions } from '../lib/change-selection.js';
import { CLIError, requireInit, ValidationError } from '../lib/errors.js';
import { formatIssueChangesReport } from '../lib/issue-changes-output.js';

interface WatchOptions extends ChangeSelectionOptions {
  since?: string;
  interval: string;
  timeout?: string;
}

const MINIMUM_INTERVAL_SECONDS = 10;

function parseSeconds(value: string, option: string, minimum: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < minimum) {
    const requirement = minimum === 0 ? 'zero or greater' : `at least ${minimum} seconds`;
    throw new ValidationError(`${option} must be ${requirement}`);
  }
  return parsed * 1_000;
}

class WatchHandler extends BaseCommand {
  async run(options: WatchOptions): Promise<void> {
    const tbdRoot = await requireInit();
    const selection = parseChangeSelection(options, true);
    const intervalMs = parseSeconds(options.interval, '--interval', MINIMUM_INTERVAL_SECONDS);
    const timeoutMs =
      options.timeout === undefined ? null : parseSeconds(options.timeout, '--timeout', 0);
    const config = await readConfig(tbdRoot);

    let result;
    try {
      result = await watchForIssueChanges({
        repoDir: tbdRoot,
        remote: config.sync.remote,
        branch: config.sync.branch,
        prefix: config.display.id_prefix,
        selection,
        since: options.since ?? null,
        intervalMs,
        timeoutMs,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const wrapped = new CLIError(message);
      if (error instanceof Error) wrapped.cause = error;
      throw wrapped;
    }

    if (result.kind === 'timeout') {
      process.exitCode = 2;
      return;
    }
    if (!this.ctx.quiet) {
      this.output.data(result.report, () => {
        console.log(formatIssueChangesReport(result.report, this.output.getColors()));
      });
    }
  }
}

export const watchCommand = new Command('watch')
  .description('Wait for selected bead changes on the remote sync branch')
  .option('--bead <ids...>', 'Select one or more bead IDs')
  .option('--label <label>', 'Filter by label (repeatable)', (value, previous: string[] = []) => [
    ...previous,
    value,
  ])
  .option('--spec <path>', 'Filter by spec path')
  .option('--status <status>', 'Filter: open, in_progress, blocked, deferred, closed')
  .option('--ready', 'Wake when a bead newly enters the ready set')
  .option('--all', 'Watch all beads')
  .option('--since <commit>', 'Resume from a sync-branch commit')
  .option('--interval <seconds>', 'Remote tip poll interval (minimum 10)', '30')
  .option('--timeout <seconds>', 'Exit 2 if no selected change occurs in this time')
  .action(async (options, command) => {
    const handler = new WatchHandler(command);
    await handler.run(options);
  });
