/**
 * `tbd list` - List issues.
 *
 * See: tbd-design.md §4.4 List
 */

import { Command } from 'commander';

import { BaseCommand } from '../lib/base-command.js';
import { applyLimit } from '../lib/limit-utils.js';
import { requireInit } from '../lib/errors.js';
import { loadDataContext } from '../lib/data-context.js';
import type { Issue, IssueStatusType, IssueKindType } from '../../lib/types.js';
import { listIssues } from '../../file/storage.js';
import { formatDisplayId, formatDebugId } from '../../lib/ids.js';
import type { IdMapping } from '../../file/id-mapping.js';
import { resolveToInternalId } from '../../file/id-mapping.js';
import {
  formatIssueLine,
  formatIssueLong,
  formatIssueHeader,
  formatSpecGroupHeader,
  formatNoSpecGroupHeader,
  type IssueForDisplay,
} from '../lib/issue-format.js';
import { parseDateOption } from '../lib/issue-input-validation.js';
import { parsePriority } from '../../lib/priority.js';
import { selectIssues } from '../../lib/issue-query.js';
import type { IssueQuery, IssueSort } from '../../lib/issue-query.js';
import { buildIssueTree, renderIssueTree } from '../lib/tree-view.js';
import { getTerminalWidth, type createColors } from '../lib/output.js';

interface ListOptions {
  status?: IssueStatusType;
  all?: boolean;
  type?: IssueKindType;
  priority?: string;
  assignee?: string;
  label?: string[];
  parent?: string;
  spec?: string;
  deferred?: boolean;
  deferBefore?: string;
  sort?: string;
  limit?: string;
  count?: boolean;
  long?: boolean;
  pretty?: boolean;
  specs?: boolean;
}

class ListHandler extends BaseCommand {
  async run(options: ListOptions): Promise<void> {
    const tbdRoot = await requireInit();

    // Load shared data context (dataSyncDir, mapping, config, prefix)
    const dataCtx = await loadDataContext(tbdRoot);
    let issues = await listIssues(dataCtx.dataSyncDir);

    // Filter and sort through the shared query module (the single semantics for
    // list/ready/web); this handler keeps only the CLI-shaped concerns: flag parsing,
    // id resolution, limit strings, and rendering.
    issues = this.applyQuery(issues, options, dataCtx.mapping);

    // Apply limit
    issues = applyLimit(issues, options.limit);

    // Count-only mode for testing
    if (options.count) {
      this.output.data({ count: issues.length }, () => {
        console.log(issues.length);
      });
      return;
    }

    const showDebug = this.ctx.debug;
    const { mapping, prefix } = dataCtx;

    // Format output - use short display IDs instead of internal ULIDs
    const displayIssues = issues.map((i) => ({
      id: showDebug ? formatDebugId(i.id, mapping, prefix) : formatDisplayId(i.id, mapping, prefix),
      internalId: i.id,
      parentId: i.parent_id
        ? showDebug
          ? formatDebugId(i.parent_id, mapping, prefix)
          : formatDisplayId(i.parent_id, mapping, prefix)
        : undefined,
      priority: i.priority,
      status: i.status,
      kind: i.kind,
      title: i.title,
      description: i.description ?? undefined,
      assignee: i.assignee ?? undefined,
      labels: i.labels,
      spec_path: i.spec_path ?? undefined,
      // Use internal IDs for order hints (buildIssueTree compares against internal IDs)
      child_order_hints: i.child_order_hints ?? undefined,
    }));

    this.output.data(displayIssues, () => {
      if (issues.length === 0) {
        console.log('No issues found');
        return;
      }

      const colors = this.output.getColors();

      if (options.specs) {
        this.renderGroupedBySpec(displayIssues, options, colors);
      } else {
        this.renderFlat(displayIssues, options, colors);
      }

      console.log('');
      console.log(colors.dim(`${issues.length} issue(s)`));
    });
  }

  private renderFlat(
    displayIssues: (IssueForDisplay & { parentId?: string; spec_path?: string })[],
    options: ListOptions,
    colors: ReturnType<typeof createColors>,
  ): void {
    if (options.pretty) {
      const tree = buildIssueTree(displayIssues);
      const lines = renderIssueTree(tree, colors, {
        long: options.long,
        maxWidth: getTerminalWidth(),
      });
      for (const line of lines) {
        console.log(line);
      }
    } else {
      console.log(formatIssueHeader(colors));
      for (const issue of displayIssues) {
        if (options.long) {
          console.log(formatIssueLong(issue, colors));
        } else {
          console.log(formatIssueLine(issue, colors));
        }
      }
    }
  }

  private renderGroupedBySpec(
    displayIssues: (IssueForDisplay & { parentId?: string; spec_path?: string })[],
    options: ListOptions,
    colors: ReturnType<typeof createColors>,
  ): void {
    // Group issues by spec_path
    const specGroups = new Map<string, typeof displayIssues>();
    const noSpecIssues: typeof displayIssues = [];

    for (const issue of displayIssues) {
      if (issue.spec_path) {
        const group = specGroups.get(issue.spec_path);
        if (group) {
          group.push(issue);
        } else {
          specGroups.set(issue.spec_path, [issue]);
        }
      } else {
        noSpecIssues.push(issue);
      }
    }

    // Render each spec group
    let first = true;
    for (const [specPath, groupIssues] of specGroups) {
      if (!first) {
        console.log('');
      }
      first = false;

      console.log(formatSpecGroupHeader(specPath, groupIssues.length, colors));
      console.log('');
      this.renderFlat(groupIssues, options, colors);
    }

    // Render "No spec" group at the end
    if (noSpecIssues.length > 0) {
      if (!first) {
        console.log('');
      }
      console.log(formatNoSpecGroupHeader(noSpecIssues.length, colors));
      console.log('');
      this.renderFlat(noSpecIssues, options, colors);
    }
  }

  /** Translate CLI flags into an IssueQuery and run the shared selection. */
  private applyQuery(issues: Issue[], options: ListOptions, mapping: IdMapping): Issue[] {
    // Resolve parent filter to internal ID if provided
    let parentId: string | null = null;
    if (options.parent) {
      try {
        parentId = resolveToInternalId(options.parent, mapping);
      } catch {
        // If parent ID cannot be resolved, no issues will match
        return [];
      }
    }

    // An unparseable --priority means "no filter", preserving the legacy behavior.
    const priority =
      options.priority !== undefined ? (parsePriority(options.priority) ?? null) : null;

    const query: IssueQuery = {
      status: options.status ?? null,
      includeClosed: options.all ?? false,
      kind: options.type ?? null,
      priority,
      assignee: options.assignee ?? null,
      labels: options.label ?? [],
      parentId,
      // An empty --spec means "no filter", as before.
      spec: options.spec === '' ? null : (options.spec ?? null),
      deferred: options.deferred ?? false,
      deferBefore:
        options.deferBefore === undefined
          ? null
          : parseDateOption(options.deferBefore, '--defer-before'),
      ready: false,
      sort: (options.sort ?? 'priority') as IssueSort,
      limit: null,
    };
    return selectIssues(issues, query, Date.now());
  }
}

export const listCommand = new Command('list')
  .description('List issues')
  .option('--status <status>', 'Filter: open, in_progress, blocked, deferred, closed')
  .option('--all', 'Include closed issues')
  .option('--type <type>', 'Filter: bug, feature, task, epic')
  .option('--priority <0-4>', 'Filter by priority')
  .option('--assignee <name>', 'Filter by assignee')
  .option('--label <label>', 'Filter by label (repeatable)', (val, prev: string[] | undefined) => [
    ...(prev ?? []),
    val,
  ])
  .option('--parent <id>', 'List children of parent')
  .option(
    '--spec <path>',
    'Filter by spec path (matches full path, partial path suffix, or filename)',
  )
  .option('--deferred', 'Show only deferred issues')
  .option('--defer-before <date>', 'Only issues whose deferred_until falls before this date')
  .option('--sort <field>', 'Sort by: priority, created, updated', 'priority')
  .option('--limit <n>', 'Limit results')
  .option('--count', 'Output only the count of matching issues')
  .option('--long', 'Show descriptions')
  .option('--pretty', 'Show tree view with parent-child relationships')
  .option('--specs', 'Group output by linked spec')
  .action(async (options, command) => {
    const handler = new ListHandler(command);
    await handler.run(options);
  });
