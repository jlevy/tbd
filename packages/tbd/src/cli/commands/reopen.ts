/**
 * `tbd reopen` - Reopen one or more closed issues.
 *
 * A single ID preserves the legacy output exactly, including the hard error when
 * the issue is not closed. Two or more IDs are a bulk operation: processed under
 * one lock, with a one-line summary, a structured `--json` results array, and a
 * visible unsynced-changes hint. Already-open issues are a reported skip in the
 * bulk path only (single-ID keeps erroring for backward compatibility).
 *
 * See: tbd-design.md §4.4 Reopen and
 * docs/project/specs/active/plan-2026-06-13-agent-cli-ergonomics.md
 */

import { Command } from 'commander';

import { BaseCommand } from '../lib/base-command.js';
import { requireInit, NotFoundError, CLIError } from '../lib/errors.js';
import { readIssue, writeIssue } from '../../file/storage.js';
import { formatDisplayId, formatDebugId } from '../../lib/ids.js';
import { now } from '../../utils/time-utils.js';
import { withDataSyncContext } from '../lib/data-context.js';
import { resolveAllIds, summarizeBulk, toJsonResult, type BulkItemResult } from '../lib/bulk.js';

interface ReopenOptions {
  reason?: string;
  ignoreMissing?: boolean;
}

class ReopenHandler extends BaseCommand {
  async run(ids: string[], options: ReopenOptions): Promise<void> {
    const tbdRoot = await requireInit();
    const isBulk = ids.length > 1;
    const results: BulkItemResult[] = [];

    await this.execute(async () => {
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
            ids.length === 1 ? 'Would reopen issue' : `Would reopen ${resolved.length} issues`;
          if (this.checkDryRun(dryRunMessage, { ids: resolved.map((r) => r.internalId) })) {
            return;
          }

          for (const { input, internalId } of resolved) {
            let issue;
            try {
              issue = await readIssue(dataSyncDir, internalId);
            } catch {
              // Single ID preserves the legacy hard error; bulk reports it.
              if (!isBulk && !options.ignoreMissing) {
                throw new NotFoundError('Issue', input);
              }
              results.push({ id: input, action: 'missing', ok: false, skippedReason: 'not found' });
              continue;
            }

            const displayId = this.ctx.debug
              ? formatDebugId(issue.id, mapping, config.display.id_prefix)
              : formatDisplayId(issue.id, mapping, config.display.id_prefix);

            // Only closed issues can be reopened. Single ID keeps the legacy
            // hard error; bulk reports a skip so a batch reopen is idempotent.
            if (issue.status !== 'closed') {
              if (!isBulk) {
                throw new CLIError(`Issue ${input} is not closed (status: ${issue.status})`);
              }
              results.push({
                id: displayId,
                action: 'skipped',
                ok: true,
                skippedReason:
                  issue.status === 'open' ? 'already open' : `not closed (${issue.status})`,
              });
              continue;
            }

            issue.status = 'open';
            issue.closed_at = null;
            issue.close_reason = null;
            issue.version += 1;
            issue.updated_at = now();

            // Optionally record the reopen reason in notes.
            if (options.reason) {
              const reopenNote = `Reopened: ${options.reason}`;
              issue.notes = issue.notes ? `${issue.notes}\n\n${reopenNote}` : reopenNote;
            }

            await writeIssue(dataSyncDir, issue);
            results.push({ id: displayId, action: 'reopened', ok: true });
          }

          // Report (but do not fail on) IDs skipped via --ignore-missing.
          for (const m of missing) {
            results.push({ id: m, action: 'missing', ok: false, skippedReason: 'not found' });
          }
        },
      );
    }, 'Failed to reopen issue');

    if (results.length === 0) return; // dry-run or nothing to do

    // Single ID: preserve the exact legacy output (text + JSON).
    if (ids.length === 1) {
      const r = results[0]!;
      if (r.action === 'missing') return; // --ignore-missing on a lone unknown ID
      this.output.data({ id: r.id, reopened: true }, () => {
        this.output.success(`Reopened ${r.id}`);
      });
      return;
    }

    this.emitBulkSummary(results);
  }

  /** Bulk path: one summary line + structured JSON, with a visible sync hint. */
  private emitBulkSummary(results: BulkItemResult[]): void {
    const summary = summarizeBulk(results);
    const syncPending = summary.changed > 0;
    const json: Record<string, unknown> = {
      results: results.map(toJsonResult),
      summary,
    };
    if (syncPending) {
      json.sync = { pending: true, hint: 'Run `tbd sync` to publish.' };
    }

    this.output.data(json, () => {
      const parts = [`Reopened ${summary.changed}`];
      if (summary.skipped > 0) parts.push(`skipped ${summary.skipped} (already open)`);
      if (summary.missing > 0) parts.push(`not found ${summary.missing}`);
      const idList = results.map((r) => r.id).join(' ');
      this.output.success(`${parts.join(', ')}: ${idList}`);
      if (syncPending) {
        this.output.notice('Unsynced changes — run `tbd sync` to publish.');
      }
    });
  }
}

export const reopenCommand = new Command('reopen')
  .description('Reopen one or more closed issues')
  .argument('<ids...>', 'Issue ID(s)')
  .option('--reason <text>', 'Reopen reason')
  .option('--ignore-missing', 'Skip unknown IDs instead of failing')
  .action(async (ids, options, command) => {
    const handler = new ReopenHandler(command);
    await handler.run(ids, options);
  });
