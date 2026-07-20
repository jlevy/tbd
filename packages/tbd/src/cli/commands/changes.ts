/** `tbd changes` - Diff committed issue snapshots on the local sync branch. */

import { Command } from 'commander';

import { readConfig } from '../../file/config.js';
import { createChangesReportFromRefs } from '../../file/sync-branch-changes.js';
import { BaseCommand } from '../lib/base-command.js';
import { parseChangeSelection, type ChangeSelectionOptions } from '../lib/change-selection.js';
import { CLIError, requireInit } from '../lib/errors.js';
import { formatIssueChangesReport } from '../lib/issue-changes-output.js';

interface ChangesOptions extends ChangeSelectionOptions {
  since: string;
}

class ChangesHandler extends BaseCommand {
  async run(options: ChangesOptions): Promise<void> {
    const tbdRoot = await requireInit();
    const config = await readConfig(tbdRoot);
    const selection = parseChangeSelection(options, false);
    let report;
    try {
      report = await createChangesReportFromRefs({
        repoDir: tbdRoot,
        sinceRef: options.since,
        tipRef: `refs/heads/${config.sync.branch}`,
        prefix: config.display.id_prefix,
        selection,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const wrapped = new CLIError(message);
      if (error instanceof Error) wrapped.cause = error;
      throw wrapped;
    }

    if (!this.ctx.quiet) {
      this.output.data(report, () => {
        console.log(formatIssueChangesReport(report, this.output.getColors()));
      });
    }
    if (report.changes.length === 0) process.exitCode = 3;
  }
}

export const changesCommand = new Command('changes')
  .description('Report committed bead changes since a sync-branch commit')
  .requiredOption('--since <commit>', 'Baseline sync-branch commit')
  .option('--bead <ids...>', 'Select one or more bead IDs')
  .option('--label <label>', 'Filter by label (repeatable)', (value, previous: string[] = []) => [
    ...previous,
    value,
  ])
  .option('--spec <path>', 'Filter by spec path')
  .option('--status <status>', 'Filter: open, in_progress, blocked, deferred, closed')
  .option('--ready', 'Report beads newly entering the ready set')
  .option('--all', 'Select all beads (the default for changes)')
  .action(async (options, command) => {
    const handler = new ChangesHandler(command);
    await handler.run(options);
  });
