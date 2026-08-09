/** Contract tests for bounded human rendering of issue change reports. */

import { describe, expect, it } from 'vitest';

import { formatIssueChangesReport } from '../src/cli/lib/issue-changes-output.js';
import { createColors } from '../src/cli/lib/output.js';
import type { IssueChangesReport } from '../src/lib/issue-changes.js';

const colors = createColors('never');

describe('formatIssueChangesReport', () => {
  it('explains when a pathological text diff was intentionally omitted', () => {
    const report: IssueChangesReport = {
      format_version: 1,
      since: 'a'.repeat(40),
      tip: 'b'.repeat(40),
      changes: [
        {
          id: 'tbd-a1b2',
          internal_id: 'is-01h00000000000000000000000',
          title: 'Large rewrite',
          change: 'updated',
          fields: [
            {
              field: 'notes',
              before: 'before',
              after: 'after',
              hunks_omitted: 'complexity_limit',
            },
          ],
        },
      ],
    };

    const output = formatIssueChangesReport(report, colors);

    expect(output).toContain('notes: text diff omitted (complexity limit)');
    expect(output).not.toContain('before -> after');
  });
});
