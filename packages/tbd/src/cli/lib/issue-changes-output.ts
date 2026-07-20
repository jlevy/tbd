/** Human formatting for the stable issue change report. */

import type { IssueChangesReport } from '../../lib/issue-changes.js';
import type { createColors } from './output.js';

function formatValue(value: unknown): string {
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

/** Render a change report without writing to stdout, for CLI reuse and testing. */
export function formatIssueChangesReport(
  report: IssueChangesReport,
  colors: ReturnType<typeof createColors>,
): string {
  const lines = [`Changes ${report.since}..${report.tip}`];
  if (report.changes.length === 0) {
    lines.push('', 'No matching bead changes');
    return lines.join('\n');
  }

  for (const change of report.changes) {
    lines.push('', `${colors.id(change.id)} [${change.change}] ${change.title}`);
    if (change.fields.length === 0) {
      lines.push('  became ready');
      continue;
    }
    for (const field of change.fields) {
      if (field.hunks) {
        lines.push(`  ${field.field}:`);
        for (const hunk of field.hunks) {
          lines.push(
            `    @@ -${hunk.old_start},${hunk.old_count} +${hunk.new_start},${hunk.new_count} @@`,
          );
          for (const line of hunk.lines) {
            const marker = line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' ';
            lines.push(`    ${marker}${line.text}`);
          }
        }
      } else {
        lines.push(`  ${field.field}: ${formatValue(field.before)} -> ${formatValue(field.after)}`);
      }
    }
  }
  return lines.join('\n');
}
