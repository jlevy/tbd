/**
 * `tbd stats` - Show repository statistics.
 *
 * See: tbd-design.md §4.9 Stats
 */

import { Command } from 'commander';

import { BaseCommand } from '../lib/base-command.js';
import { requireInit, NotInitializedError } from '../lib/errors.js';
import { listIssues } from '../../file/storage.js';
import type { Issue, IssueStatusType, IssueKindType } from '../../lib/types.js';
import { resolveDataSyncDir } from '../../lib/paths.js';
import { getStatusIcon, getStatusColor } from '../../lib/status.js';
import { renderFooter } from '../lib/sections.js';

// Column widths for alignment
const LABEL_WIDTH = 16;
const NUMBER_WIDTH = 6;

/**
 * Right-align a number within a given width.
 */
function rightAlign(num: number, width: number = NUMBER_WIDTH): string {
  return String(num).padStart(width);
}

/**
 * Check if a status is "active" (not closed).
 */
function isActiveStatus(status: IssueStatusType): boolean {
  return status !== 'closed';
}

class StatsHandler extends BaseCommand {
  async run(): Promise<void> {
    await requireInit();

    // Load all issues
    let issues: Issue[];
    try {
      const dataSyncDir = await resolveDataSyncDir();
      issues = await listIssues(dataSyncDir);
    } catch {
      throw new NotInitializedError('No issue store found. Run `tbd init` first.');
    }

    // Count by status
    const byStatus: Record<IssueStatusType, number> = {
      open: 0,
      in_progress: 0,
      blocked: 0,
      deferred: 0,
      closed: 0,
    };

    // Count by kind (active and closed separately)
    const byKindActive: Record<IssueKindType, number> = {
      bug: 0,
      feature: 0,
      task: 0,
      epic: 0,
      chore: 0,
    };
    const byKindClosed: Record<IssueKindType, number> = {
      bug: 0,
      feature: 0,
      task: 0,
      epic: 0,
      chore: 0,
    };

    // Count by priority (active and closed separately)
    const byPriorityActive: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };
    const byPriorityClosed: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };

    // Accumulate counts
    for (const issue of issues) {
      byStatus[issue.status]++;

      const isActive = isActiveStatus(issue.status);
      if (isActive) {
        byKindActive[issue.kind]++;
        if (issue.priority >= 0 && issue.priority <= 4) {
          byPriorityActive[issue.priority]!++;
        }
      } else {
        byKindClosed[issue.kind]++;
        if (issue.priority >= 0 && issue.priority <= 4) {
          byPriorityClosed[issue.priority]!++;
        }
      }
    }

    // Calculate totals
    const activeTotal = byStatus.open + byStatus.in_progress + byStatus.blocked + byStatus.deferred;
    const closedTotal = byStatus.closed;
    const total = issues.length;

    const stats = {
      total,
      activeTotal,
      closedTotal,
      byStatus,
      byKindActive,
      byKindClosed,
      byPriorityActive,
      byPriorityClosed,
    };

    this.output.data(stats, () => {
      const colors = this.output.getColors();

      if (stats.total === 0) {
        console.log(colors.dim('No issues yet.'));
        renderFooter(
          [
            { command: 'tbd status', description: 'setup info' },
            { command: 'tbd doctor', description: 'health checks' },
          ],
          colors,
        );
        return;
      }

      // ─────────────────────────────────────────────────────────────
      // By status section
      // ─────────────────────────────────────────────────────────────
      console.log(colors.bold('By status:'));

      // Show each active status with icon and color
      const activeStatuses: IssueStatusType[] = ['open', 'in_progress', 'blocked', 'deferred'];
      for (const status of activeStatuses) {
        const count = stats.byStatus[status];
        if (count > 0) {
          const icon = getStatusIcon(status);
          const colorFn = getStatusColor(status, colors);
          const label = `${icon} ${status}`.padEnd(LABEL_WIDTH);
          console.log(`  ${colorFn(label)}${rightAlign(count)}`);
        }
      }

      // Separator and active subtotal
      console.log(colors.dim(`  ${'─'.repeat(LABEL_WIDTH + NUMBER_WIDTH)}`));
      console.log(`  ${'active'.padEnd(LABEL_WIDTH)}${rightAlign(activeTotal)}`);

      // Closed with icon
      const closedIcon = getStatusIcon('closed');
      const closedColorFn = getStatusColor('closed', colors);
      console.log(
        `  ${closedColorFn(`${closedIcon} closed`.padEnd(LABEL_WIDTH))}${rightAlign(closedTotal)}`,
      );

      // Double separator and total
      console.log(colors.dim(`  ${'═'.repeat(LABEL_WIDTH + NUMBER_WIDTH)}`));
      console.log(colors.bold(`  ${'total'.padEnd(LABEL_WIDTH)}${rightAlign(total)}`));

      // ─────────────────────────────────────────────────────────────
      // By kind section (with active/closed/total columns)
      // ─────────────────────────────────────────────────────────────
      console.log('');
      // Column headers for multi-column sections (add 2 for "  " prefix on data rows)
      const colHeaders = colors.dim(
        `${'active'.padStart(NUMBER_WIDTH)} ${'closed'.padStart(NUMBER_WIDTH)} ${'total'.padStart(NUMBER_WIDTH)}`,
      );
      console.log(colors.bold('By kind:') + ' '.repeat(LABEL_WIDTH - 6) + colHeaders);

      const kindOrder: IssueKindType[] = ['bug', 'feature', 'task', 'epic', 'chore'];
      for (const kind of kindOrder) {
        const active = stats.byKindActive[kind];
        const closed = stats.byKindClosed[kind];
        const kindTotal = active + closed;
        if (kindTotal > 0) {
          console.log(
            `  ${kind.padEnd(LABEL_WIDTH)}${rightAlign(active)} ${rightAlign(closed)} ${rightAlign(kindTotal)}`,
          );
        }
      }

      // ─────────────────────────────────────────────────────────────
      // By priority section (with active/closed/total columns)
      // ─────────────────────────────────────────────────────────────
      console.log('');
      console.log(colors.bold('By priority:') + ' '.repeat(LABEL_WIDTH - 10) + colHeaders);

      const priorityLabels = ['Critical', 'High', 'Medium', 'Low', 'Lowest'];
      for (let i = 0; i <= 4; i++) {
        const active = stats.byPriorityActive[i] ?? 0;
        const closed = stats.byPriorityClosed[i] ?? 0;
        const priorityTotal = active + closed;
        if (priorityTotal > 0) {
          const label = `P${i} (${priorityLabels[i]})`;
          console.log(
            `  ${label.padEnd(LABEL_WIDTH)}${rightAlign(active)} ${rightAlign(closed)} ${rightAlign(priorityTotal)}`,
          );
        }
      }

      // Footer
      renderFooter(
        [
          { command: 'tbd status', description: 'setup info' },
          { command: 'tbd doctor', description: 'health checks' },
        ],
        colors,
      );
    });
  }
}

export const statsCommand = new Command('stats')
  .description('Show repository statistics')
  .action(async (_options, command) => {
    const handler = new StatsHandler(command);
    await handler.run();
  });
