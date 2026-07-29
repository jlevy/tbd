/**
 * `tbd show` - Show issue details.
 *
 * A single ID preserves the legacy output exactly (including automatic parent
 * context). Two or more IDs are a bulk read: each issue renders under a dim
 * `── <id> ──` delimiter in argument order (duplicates deduped), parent
 * context is suppressed, `--max-lines` applies per issue, and `--json` emits
 * an array. Unknown IDs fail closed unless `--ignore-missing` downgrades them
 * to a stderr note.
 *
 * See: tbd-design.md §4.4 Show and
 * docs/project/specs/active/plan-2026-07-28-agent-cli-bash-fallbacks.md
 */

import { Command } from 'commander';

import { BaseCommand } from '../lib/base-command.js';
import { NotFoundError } from '../lib/errors.js';
import { loadFullContext, type FullCommandContext } from '../lib/data-context.js';
import {
  formatDependencyDirectionComments,
  getDependencyDirections,
  type DependencyDirections,
} from '../lib/dependency-format.js';
import { resolveAllIds } from '../lib/bulk.js';
import { issueNotFoundHint } from '../lib/id-suggestions.js';
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
  ignoreMissing?: boolean;
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

/** Print the child_order_hints block shown under `--show-order`. */
function printOrderHints(
  issue: Issue,
  ctx: FullCommandContext,
  colors: ReturnType<typeof createColors>,
): void {
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

class ShowHandler extends BaseCommand {
  async run(ids: string[], command: Command, options: ShowOptions): Promise<void> {
    // Load unified context with data and helpers
    const ctx = await loadFullContext(command);
    if (ids.length === 1) {
      await this.showSingle(ctx, ids[0]!, options);
      return;
    }
    await this.showBulk(ctx, ids, options);
  }

  /** Legacy single-ID path: object `--json` shape and automatic parent context. */
  private async showSingle(
    ctx: FullCommandContext,
    id: string,
    options: ShowOptions,
  ): Promise<void> {
    // Resolve input ID to internal ID using helper
    let internalId: string;
    try {
      internalId = ctx.resolveId(id);
    } catch (error) {
      if (options.ignoreMissing) {
        this.output.warn(`Not found: ${id}`);
        return;
      }
      throw error;
    }

    let issue;
    try {
      issue = await readIssue(ctx.dataSyncDir, internalId);
    } catch (error) {
      // Only a genuinely absent file counts as missing; corrupt or unreadable
      // files are repository problems and surface their real error.
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      if (options.ignoreMissing) {
        this.output.warn(`Not found: ${id}`);
        return;
      }
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
        printOrderHints(issue, ctx, colors);
      }
    });
  }

  /**
   * Bulk read path (2+ IDs): validate-all-then-render with the same
   * fail-closed / `--ignore-missing` contract as the bulk mutators, a dim
   * delimiter per issue, per-issue `--max-lines`, and an array `--json` shape.
   * Parent context is suppressed (siblings would repeat the same parent).
   */
  private async showBulk(
    ctx: FullCommandContext,
    ids: string[],
    options: ShowOptions,
  ): Promise<void> {
    const { resolved, missing } = resolveAllIds(ids, ctx.mapping);
    if (missing.length > 0 && !options.ignoreMissing) {
      throw new NotFoundError(
        'Issue',
        missing.join(', '),
        issueNotFoundHint(missing, ctx.mapping, ctx.prefix),
      );
    }

    // Read everything before rendering anything, so a stale mapping aborts
    // (or is reported) up front. Non-ENOENT failures are repository problems
    // and always abort, even with --ignore-missing.
    const loaded: { issue: Issue; displayId: string }[] = [];
    const unreadable: string[] = [];
    for (const { input, internalId } of resolved) {
      try {
        const issue = await readIssue(ctx.dataSyncDir, internalId);
        loaded.push({ issue, displayId: ctx.displayId(issue.id) });
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
        if (!options.ignoreMissing) {
          // The ID resolved, so a did-you-mean would just suggest the input
          // back to itself; point at repository health instead.
          throw new NotFoundError(
            'Issue',
            input,
            'The ID resolves but its issue file is missing — run `tbd doctor` to check repository health.',
          );
        }
        unreadable.push(input);
      }
    }
    const notFound = [...missing, ...unreadable];

    const maxLines = options.maxLines ? parseInt(options.maxLines, 10) : undefined;
    const allIssues = ctx.cli.json ? undefined : await listIssues(ctx.dataSyncDir);

    const jsonIssues = loaded.map(({ issue, displayId }) => ({ ...issue, displayId }));
    this.output.data(jsonIssues, () => {
      const colors = this.output.getColors();
      loaded.forEach(({ issue, displayId }, index) => {
        if (index > 0) console.log('');
        console.log(colors.dim(`── ${displayId} ──`));
        const dependencyDirections = allIssues
          ? getDependencyDirections(issue, allIssues, (dependencyId) => ctx.displayId(dependencyId))
          : undefined;
        printWithTruncation(
          renderIssueLines(issue, colors, dependencyDirections),
          colors,
          maxLines,
        );
        if (options.showOrder) {
          printOrderHints(issue, ctx, colors);
        }
      });
    });

    // Reported after the rendered subset so the note is the last thing an
    // agent reads; stderr in both text and JSON modes, exit stays 0.
    if (notFound.length > 0) {
      this.output.warn(`Not found: ${notFound.join(' ')}`);
    }
  }
}

export const showCommand = new Command('show')
  .description('Show details for one or more issues')
  .argument('<ids...>', 'Issue ID(s)')
  .option('--show-order', 'Display children ordering hints')
  .option('--no-parent', 'Suppress automatic parent context display')
  .option('--max-lines <n>', 'Truncate output to N lines (per issue in bulk)')
  .option('--ignore-missing', 'Skip unknown IDs instead of failing')
  .action(async (ids, options, command) => {
    const handler = new ShowHandler(command);
    await handler.run(ids, command, options);
  });
