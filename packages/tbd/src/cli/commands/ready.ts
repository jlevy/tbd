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
import { readyIssueIds } from '../../lib/issue-selection.js';
import { formatDisplayId, formatDebugId } from '../../lib/ids.js';
import { comparisonChain } from '../../lib/comparison-chain.js';
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

    const readyIds = readyIssueIds(issues);
    let readyIssues = issues.filter((issue) => readyIds.has(issue.id));

    // Filter by type if specified
    if (options.type) {
      const result = IssueKind.safeParse(options.type);
      if (!result.success) {
        throw new ValidationError(`Invalid type: ${options.type}`);
      }
      const kind: IssueKindType = result.data;
      readyIssues = readyIssues.filter((i) => i.kind === kind);
    }

    // Sort by priority (lowest number = highest priority), then by ID for determinism
    readyIssues.sort(
      comparisonChain<Issue>()
        .compare((i) => i.priority)
        .compare((i) => i.id)
        .result(),
    );

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
