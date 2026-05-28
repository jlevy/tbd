/**
 * `tbd reopen` - Reopen a closed issue.
 *
 * See: tbd-design.md §4.4 Reopen
 */

import { Command } from 'commander';

import { BaseCommand } from '../lib/base-command.js';
import { requireInit, NotFoundError, CLIError } from '../lib/errors.js';
import { readIssue, writeIssue } from '../../file/storage.js';
import { formatDisplayId, formatDebugId } from '../../lib/ids.js';
import { now } from '../../utils/time-utils.js';
import { resolveToInternalId } from '../../file/id-mapping.js';
import { withDataSyncContext } from '../lib/data-context.js';

interface ReopenOptions {
  reason?: string;
}

class ReopenHandler extends BaseCommand {
  async run(id: string, options: ReopenOptions): Promise<void> {
    const tbdRoot = await requireInit();

    let displayId = id;
    let didReopen = false;

    await this.execute(async () => {
      await withDataSyncContext(
        tbdRoot,
        { lock: true },
        async ({ dataSyncDir, mapping, config }) => {
          // Resolve input ID to internal ID
          let internalId: string;
          try {
            internalId = resolveToInternalId(id, mapping);
          } catch {
            throw new NotFoundError('Issue', id);
          }

          // Load existing issue
          let issue;
          try {
            issue = await readIssue(dataSyncDir, internalId);
          } catch {
            throw new NotFoundError('Issue', id);
          }

          // Check if not closed
          if (issue.status !== 'closed') {
            throw new CLIError(`Issue ${id} is not closed (status: ${issue.status})`);
          }

          if (this.checkDryRun('Would reopen issue', { id: internalId, reason: options.reason })) {
            return;
          }

          // Update issue
          issue.status = 'open';
          issue.closed_at = null;
          issue.close_reason = null;
          issue.version += 1;
          issue.updated_at = now();

          // Optionally store reopen reason in notes if provided
          if (options.reason) {
            const reopenNote = `Reopened: ${options.reason}`;
            issue.notes = issue.notes ? `${issue.notes}\n\n${reopenNote}` : reopenNote;
          }

          await writeIssue(dataSyncDir, issue);

          displayId = this.ctx.debug
            ? formatDebugId(issue.id, mapping, config.display.id_prefix)
            : formatDisplayId(issue.id, mapping, config.display.id_prefix);
          didReopen = true;
        },
      );
    }, 'Failed to reopen issue');

    if (!didReopen) return;

    this.output.data({ id: displayId, reopened: true }, () => {
      this.output.success(`Reopened ${displayId}`);
    });
  }
}

export const reopenCommand = new Command('reopen')
  .description('Reopen a closed issue')
  .argument('<id>', 'Issue ID')
  .option('--reason <text>', 'Reopen reason')
  .action(async (id, options, command) => {
    const handler = new ReopenHandler(command);
    await handler.run(id, options);
  });
