/**
 * `tbd close` - Close an issue.
 *
 * See: tbd-design-v3.md §4.4 Close
 */

import { Command } from 'commander';

import { BaseCommand } from '../lib/baseCommand.js';
import { requireInit } from '../lib/errors.js';
import { readIssue, writeIssue } from '../../file/storage.js';
import { formatDisplayId, formatDebugId } from '../../lib/ids.js';
import { resolveDataSyncDir } from '../../lib/paths.js';
import { now } from '../../utils/timeUtils.js';
import { loadIdMapping, resolveToInternalId } from '../../file/idMapping.js';

interface CloseOptions {
  reason?: string;
}

class CloseHandler extends BaseCommand {
  async run(id: string, options: CloseOptions): Promise<void> {
    await requireInit();

    const dataSyncDir = await resolveDataSyncDir();

    // Load ID mapping for resolution
    const mapping = await loadIdMapping(dataSyncDir);

    // Resolve input ID to internal ID
    let internalId: string;
    try {
      internalId = resolveToInternalId(id, mapping);
    } catch {
      this.output.error(`Issue not found: ${id}`);
      return;
    }

    // Load existing issue
    let issue;
    try {
      issue = await readIssue(dataSyncDir, internalId);
    } catch {
      this.output.error(`Issue not found: ${id}`);
      return;
    }

    // Check if already closed
    if (issue.status === 'closed') {
      this.output.error(`Issue ${id} is already closed`);
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

    // Save
    await this.execute(async () => {
      await writeIssue(dataSyncDir, issue);
    }, 'Failed to close issue');

    // Use already loaded mapping for display
    const showDebug = this.ctx.debug;
    const displayId = showDebug
      ? formatDebugId(issue.id, mapping)
      : formatDisplayId(issue.id, mapping);

    this.output.data({ id: displayId, closed: true }, () => {
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
