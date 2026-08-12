/**
 * `tbd ready` - List issues ready to work on.
 *
 * See: tbd-design.md §4.4 Ready
 */

import { Command } from 'commander';

import { BaseCommand } from '../lib/base-command.js';
import { applyLimit } from '../lib/limit-utils.js';
import { loadDataContext } from '../lib/data-context.js';
import { requireInit, NotInitializedError, ValidationError } from '../lib/errors.js';
import { listIssues } from '../../file/storage.js';
import { IssueKind } from '../../lib/schemas.js';
import type { Issue, IssueKindType } from '../../lib/types.js';
import { formatDisplayId, formatDebugId } from '../../lib/ids.js';
import { defaultIssueQuery, selectIssues } from '../../lib/issue-query.js';
import {
  formatIssueLine,
  formatIssueLong,
  formatIssueHeader,
  type IssueForDisplay,
} from '../lib/issue-format.js';

interface ReadyOptions {
  type?: string;
  limit?: string;
  long?: boolean;
}

class ReadyHandler extends BaseCommand {
  async run(options: ReadyOptions): Promise<void> {
    const tbdRoot = await requireInit();

    // Load data context and issues
    let issues: Issue[];
    let dataCtx;
    try {
      dataCtx = await loadDataContext(tbdRoot);
      issues = await listIssues(dataCtx.dataSyncDir);
    } catch {
      throw new NotInitializedError('No issue store found. Run `tbd init` first.');
    }

    // Validate --type before querying, preserving the usage-error contract.
    let kind: IssueKindType | null = null;
    if (options.type) {
      const result = IssueKind.safeParse(options.type);
      if (!result.success) {
        throw new ValidationError(`Invalid type: ${options.type}`);
      }
      kind = result.data;
    }

    // Ready selection, ordering, and tiebreak all come from the shared query module,
    // so this command and any other surface answering "what is ready" cannot disagree.
    let readyIssues = selectIssues(issues, { ...defaultIssueQuery(), ready: true, kind });

    // Apply limit
    readyIssues = applyLimit(readyIssues, options.limit);

    const { mapping, prefix } = dataCtx;
    const showDebug = this.ctx.debug;

    // Format output
    const outputIssues = readyIssues.map((i) => ({
      id: showDebug ? formatDebugId(i.id, mapping, prefix) : formatDisplayId(i.id, mapping, prefix),
      priority: i.priority,
      status: i.status,
      kind: i.kind,
      title: i.title,
      description: i.description,
    }));

    this.output.data(outputIssues, () => {
      if (outputIssues.length === 0) {
        this.output.info('No ready issues found');
        return;
      }

      const colors = this.output.getColors();
      console.log(formatIssueHeader(colors));
      for (const issue of outputIssues) {
        if (options.long) {
          console.log(formatIssueLong(issue as IssueForDisplay, colors));
        } else {
          console.log(formatIssueLine(issue as IssueForDisplay, colors));
        }
      }
    });
  }
}

export const readyCommand = new Command('ready')
  .description('List issues ready to work on (open, unblocked, unclaimed)')
  .option('--type <type>', 'Filter by type')
  .option('--limit <n>', 'Limit results')
  .option('--long', 'Show descriptions')
  .action(async (options, command) => {
    const handler = new ReadyHandler(command);
    await handler.run(options);
  });
