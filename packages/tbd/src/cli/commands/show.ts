/**
 * `tbd show` - Show issue details.
 *
 * See: tbd-design.md §4.4 Show
 */

import { Command } from 'commander';

import { BaseCommand } from '../lib/base-command.js';
import { NotFoundError } from '../lib/errors.js';
import { loadFullContext } from '../lib/data-context.js';
import {
  formatDependencyDirectionComments,
  getDependencyDirections,
  type DependencyDirections,
} from '../lib/dependency-format.js';
import { readIssue, listIssues } from '../../file/storage.js';
import { serializeIssue } from '../../file/parser.js';
import { formatPriority, getPriorityColor } from '../../lib/priority.js';
import { getStatusColor } from '../../lib/status.js';
import { PARENT_CONTEXT_MAX_LINES } from '../../lib/settings.js';
import type { createColors } from '../lib/output.js';
import type { Issue, IssueStatusType } from '../../lib/types.js';

interface ShowOptions {
  showOrder?: boolean;
  parent?: boolean; // Commander: --no-parent sets this to false (default: true)
  maxLines?: string;
}

/**
 * Render a serialized issue with colorized output, optionally truncated.
 *
 * @param issue - The issue to render
 * @param colors - Color functions
 * @param dependencyDirections - Optional human-facing dependency direction comments
 * @returns Array of formatted lines
 */
function renderIssueLines(
  issue: Issue,
  colors: ReturnType<typeof createColors>,
  dependencyDirections?: DependencyDirections,
): string[] {
  const serialized = serializeIssue(issue);
  const output: string[] = [];
  const dependencyDirectionComments = dependencyDirections
    ? formatDependencyDirectionComments(dependencyDirections)
    : [];

  for (const line of serialized.split('\n')) {
    if (line === '---') {
      output.push(colors.dim(line));
    } else if (line.startsWith('dependencies:')) {
      for (const comment of dependencyDirectionComments) {
        output.push(colors.dim(comment));
      }
      output.push(line);
    } else if (line.startsWith('id:')) {
      output.push(`${colors.dim('id:')} ${colors.id(line.slice(4))}`);
    } else if (line.startsWith('status:')) {
      const status = line.slice(8).trim() as IssueStatusType;
      const statusColor = getStatusColor(status, colors);
      output.push(`${colors.dim('status:')} ${statusColor(status)}`);
    } else if (line.startsWith('priority:')) {
      const priority = parseInt(line.slice(10).trim(), 10);
      const priorityColor = getPriorityColor(priority, colors);
      output.push(`${colors.dim('priority:')} ${priorityColor(formatPriority(priority))}`);
    } else if (line.startsWith('title:')) {
      output.push(`${colors.dim('title:')} ${colors.bold(line.slice(7))}`);
    } else if (line.startsWith('spec_path:')) {
      output.push(`${colors.dim('spec_path:')} ${colors.id(line.slice(11))}`);
    } else if (line.startsWith('## Notes')) {
      output.push(colors.bold(line));
    } else if (line.startsWith('  - ')) {
      output.push(`  - ${colors.label(line.slice(4))}`);
    } else {
      output.push(line);
    }
  }

  return output;
}

/**
 * Print lines with optional max-lines truncation.
 * If maxLines is set and the output exceeds it, truncates and appends an omission notice.
 */
function printWithTruncation(
  lines: string[],
  colors: ReturnType<typeof createColors>,
  maxLines?: number,
): void {
  if (maxLines && lines.length > maxLines) {
    const omitted = lines.length - maxLines;
    for (const line of lines.slice(0, maxLines)) {
      console.log(line);
    }
    console.log(colors.dim(`… [${omitted} line${omitted === 1 ? '' : 's'} omitted]`));
  } else {
    for (const line of lines) {
      console.log(line);
    }
  }
}

class ShowHandler extends BaseCommand {
  async run(id: string, command: Command, options: ShowOptions): Promise<void> {
    // Load unified context with data and helpers
    const ctx = await loadFullContext(command);

    // Resolve input ID to internal ID using helper
    const internalId = ctx.resolveId(id);

    let issue;
    try {
      issue = await readIssue(ctx.dataSyncDir, internalId);
    } catch {
      throw new NotFoundError('Issue', id);
    }

    // Load parent issue if this is a child and --no-parent not specified
    let parentIssue: Issue | undefined;
    if (issue.parent_id && options.parent !== false) {
      try {
        parentIssue = await readIssue(ctx.dataSyncDir, issue.parent_id);
      } catch {
        // Parent referenced but missing - silently skip
      }
    }

    // Parse --max-lines if provided
    const maxLines = options.maxLines ? parseInt(options.maxLines, 10) : undefined;

    // Format display ID using helper (respects debug mode automatically)
    const displayId = ctx.displayId(issue.id);
    const allIssues = ctx.cli.json ? undefined : await listIssues(ctx.dataSyncDir);
    const displayDependencyId = (dependencyId: string) => ctx.displayId(dependencyId);
    const dependencyDirections = allIssues
      ? getDependencyDirections(issue, allIssues, displayDependencyId)
      : undefined;
    const parentDependencyDirections =
      allIssues && parentIssue
        ? getDependencyDirections(parentIssue, allIssues, displayDependencyId)
        : undefined;

    // Create display version with short display ID
    const displayIssue = {
      ...issue,
      displayId,
      ...(parentIssue
        ? {
            parent: {
              ...parentIssue,
              displayId: ctx.displayId(parentIssue.id),
            },
          }
        : {}),
    };

    this.output.data(displayIssue, () => {
      const colors = this.output.getColors();

      // Render main issue first (what the user asked for)
      const issueLines = renderIssueLines(issue, colors, dependencyDirections);
      printWithTruncation(issueLines, colors, maxLines);

      // Show parent context below if this is a child issue
      if (parentIssue) {
        console.log('');
        console.log(colors.dim('The parent of this bead is:'));
        const parentLines = renderIssueLines(parentIssue, colors, parentDependencyDirections);
        printWithTruncation(parentLines, colors, PARENT_CONTEXT_MAX_LINES);
      }

      // Show child_order_hints if --show-order is specified
      if (options.showOrder) {
        console.log('');
        console.log(colors.dim('child_order_hints:'));
        if (issue.child_order_hints && issue.child_order_hints.length > 0) {
          for (const hintId of issue.child_order_hints) {
            const shortId = ctx.displayId(hintId);
            console.log(`  - ${colors.id(shortId)}`);
          }
        } else {
          console.log(`  ${colors.dim('(none)')}`);
        }
      }
    });
  }
}

export const showCommand = new Command('show')
  .description('Show issue details')
  .argument('<id>', 'Issue ID')
  .option('--show-order', 'Display children ordering hints')
  .option('--no-parent', 'Suppress automatic parent context display')
  .option('--max-lines <n>', 'Truncate output to N lines')
  .action(async (id, options, command) => {
    const handler = new ShowHandler(command);
    await handler.run(id, command, options);
  });
