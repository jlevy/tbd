/**
 * `tbd close` - Close one or more issues.
 *
 * A single ID preserves the legacy output exactly. Two or more IDs are a bulk
 * operation: processed under one lock, with a one-line summary, a structured
 * `--json` results array, and a visible unsynced-changes hint.
 *
 * See: tbd-design.md §4.4 Close and
 * docs/project/specs/active/plan-2026-06-13-agent-cli-ergonomics.md
 */

import { Command } from 'commander';

import { BaseCommand } from '../lib/base-command.js';
import { requireInit, NotFoundError } from '../lib/errors.js';
import { readIssue, writeIssue } from '../../file/storage.js';
import { formatDisplayId, formatDebugId } from '../../lib/ids.js';
import { now } from '../../utils/time-utils.js';
import { withDataSyncContext } from '../lib/data-context.js';
import { resolveAllIds, emitBulkSummary, type BulkItemResult } from '../lib/bulk.js';
import { resolveBodyInput } from '../lib/body-input.js';

interface CloseOptions {
  reason?: string;
  reasonFile?: string;
  ignoreMissing?: boolean;
}

class CloseHandler extends BaseCommand {
  async run(ids: string[], options: CloseOptions): Promise<void> {
    const tbdRoot = await requireInit();
    const results: BulkItemResult[] = [];

    await this.execute(async () => {
      const reason = await resolveBodyInput({
        name: '--reason',
        value: options.reason,
        fileName: '--reason-file',
        file: options.reasonFile,
      });
      await withDataSyncContext(
        tbdRoot,
        { lock: true },
        async ({ dataSyncDir, mapping, config }) => {
          const { resolved, missing } = resolveAllIds(ids, mapping);

          // Fail closed: any unknown ID aborts before writing anything, unless
          // the caller opted into best-effort with --ignore-missing.
          if (missing.length > 0 && !options.ignoreMissing) {
            throw new NotFoundError('Issue', missing.join(', '));
          }

          const dryRunMessage =
            ids.length === 1 ? 'Would close issue' : `Would close ${resolved.length} issues`;
          if (this.checkDryRun(dryRunMessage, { ids: resolved.map((r) => r.internalId) })) {
            return;
          }

          for (const { input, internalId } of resolved) {
            let issue;
            try {
              issue = await readIssue(dataSyncDir, internalId);
            } catch {
              // Single ID preserves the legacy hard error; bulk reports it.
              if (ids.length === 1 && !options.ignoreMissing) {
                throw new NotFoundError('Issue', input);
              }
              results.push({ id: input, action: 'missing', ok: false, skippedReason: 'not found' });
              continue;
            }

            const displayId = this.ctx.debug
              ? formatDebugId(issue.id, mapping, config.display.id_prefix)
              : formatDisplayId(issue.id, mapping, config.display.id_prefix);

            // Idempotent: already-closed is a reported skip, not a failure.
            if (issue.status === 'closed') {
              results.push({
                id: displayId,
                action: 'skipped',
                ok: true,
                skippedReason: 'already closed',
              });
              continue;
            }

            issue.status = 'closed';
            issue.closed_at = now();
            issue.close_reason = reason ?? null;
            issue.version += 1;
            issue.updated_at = now();
            await writeIssue(dataSyncDir, issue);
            results.push({ id: displayId, action: 'closed', ok: true });
          }

          // Report (but do not fail on) IDs skipped via --ignore-missing.
          for (const m of missing) {
            results.push({ id: m, action: 'missing', ok: false, skippedReason: 'not found' });
          }
        },
      );
    }, 'Failed to close issue');

    if (results.length === 0) return; // dry-run or nothing to do

    // Single ID: preserve the exact legacy output (text + JSON).
    if (ids.length === 1) {
      const r = results[0]!;
      if (r.action === 'missing') return; // --ignore-missing on a lone unknown ID
      const alreadyClosed = r.action === 'skipped';
      this.output.data({ id: r.id, closed: true, alreadyClosed }, () => {
        this.output.success(`Closed ${r.id}`);
      });
      return;
    }

    emitBulkSummary(this.output, results, { verb: 'Closed', skippedNote: 'already closed' });
  }
}

export const closeCommand = new Command('close')
  .description('Close one or more issues')
  .argument('<ids...>', 'Issue ID(s)')
  .option('--reason <text>', 'Close reason ("-" reads stdin)')
  .option('--reason-file <path>', 'Read close reason from a file ("-" reads stdin)')
  .option('--ignore-missing', 'Skip unknown IDs instead of failing')
  .action(async (ids, options, command) => {
    const handler = new CloseHandler(command);
    await handler.run(ids, options);
  });
