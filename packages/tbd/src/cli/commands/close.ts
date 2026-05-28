/**
 * `tbd close` - Close an issue.
 *
 * See: tbd-design.md §4.4 Close
 */

import { Command } from 'commander';

import { BaseCommand } from '../lib/base-command.js';
import { requireInit, NotFoundError } from '../lib/errors.js';
import { readIssue, writeIssue } from '../../file/storage.js';
import { formatDisplayId, formatDebugId } from '../../lib/ids.js';
import { now } from '../../utils/time-utils.js';
import { resolveToInternalId } from '../../file/id-mapping.js';
import { withDataSyncContext } from '../lib/data-context.js';

interface CloseOptions {
  reason?: string;
}

class CloseHandler extends BaseCommand {
  async run(id: string, options: CloseOptions): Promise<void> {
    const tbdRoot = await requireInit();

    let displayId = id;
    let alreadyClosed = false;
    let didClose = false;

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

          displayId = this.ctx.debug
            ? formatDebugId(issue.id, mapping, config.display.id_prefix)
            : formatDisplayId(issue.id, mapping, config.display.id_prefix);

          // Idempotent: if already closed, succeed silently without modification
          if (issue.status === 'closed') {
            alreadyClosed = true;
            didClose = true;
            return;
          }

          if (this.checkDryRun('Would close issue', { id: internalId, reason: options.reason })) {
            return;
          }

          // Update issue
          issue.status = 'closed';
          issue.closed_at = now();
          issue.close_reason = options.reason ?? null;
          issue.version += 1;
          issue.updated_at = now();

          await writeIssue(dataSyncDir, issue);
          didClose = true;
        },
      );
    }, 'Failed to close issue');

    if (!didClose) return;

    this.output.data({ id: displayId, closed: true, alreadyClosed }, () => {
      this.output.success(`Closed ${displayId}`);
    });
  }
}

export const closeCommand = new Command('close')
  .description('Close an issue')
  .argument('<id>', 'Issue ID')
  .option('--reason <text>', 'Close reason')
  .action(async (id, options, command) => {
    const handler = new CloseHandler(command);
    await handler.run(id, options);
  });
