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
import { writeIssue } from '../../file/storage.js';
import { formatDisplayId, formatDebugId } from '../../lib/ids.js';
import { now } from '../../utils/time-utils.js';
import { withDataSyncContext } from '../lib/data-context.js';
import {
  resolveAllIds,
  loadAllIssues,
  orderedResults,
  emitBulkSummary,
  throwOnWriteFailures,
  type BulkItemResult,
} from '../lib/bulk.js';
import { resolveBodyInput } from '../lib/body-input.js';

interface ReopenOptions {
  reason?: string;
  reasonFile?: string;
  ignoreMissing?: boolean;
}

class ReopenHandler extends BaseCommand {
  async run(ids: string[], options: ReopenOptions): Promise<void> {
    const tbdRoot = await requireInit();
    const isBulk = ids.length > 1;
    const outcomes = new Map<string, BulkItemResult>();
    let results: BulkItemResult[] = [];
    let wasDryRun = false;

    await this.execute(async () => {
      const reason = await resolveBodyInput(
        {
          name: '--reason',
          value: options.reason,
          fileName: '--reason-file',
          file: options.reasonFile,
        },
        {},
      );
      await withDataSyncContext(
        tbdRoot,
        { lock: true },
        async ({ dataSyncDir, mapping, config }) => {
          const { resolved, missing, orderedInputs } = resolveAllIds(ids, mapping);

          // Fail closed: any unknown ID aborts before writing anything, unless
          // the caller opted into best-effort with --ignore-missing.
          if (missing.length > 0 && !options.ignoreMissing) {
            throw new NotFoundError('Issue', missing.join(', '));
          }
          for (const m of missing) {
            outcomes.set(m, { id: m, action: 'missing', ok: false, skippedReason: 'not found' });
          }

          // Read every issue before writing anything, so stale mappings and
          // unreadable files abort (or become skips) before any mutation.
          const loaded = await loadAllIssues(
            dataSyncDir,
            resolved,
            options.ignoreMissing ?? false,
            outcomes,
          );

          // Classify state before dry-run so a preview reflects exactly what a
          // real run would mutate. Only closed issues can be reopened: single
          // ID keeps the legacy hard error; bulk reports a skip so a batch
          // reopen is idempotent.
          const toMutate: typeof loaded = [];
          for (const item of loaded) {
            const displayId = this.ctx.debug
              ? formatDebugId(item.issue.id, mapping, config.display.id_prefix)
              : formatDisplayId(item.issue.id, mapping, config.display.id_prefix);
            if (item.issue.status !== 'closed') {
              if (!isBulk) {
                throw new CLIError(
                  `Issue ${item.input} is not closed (status: ${item.issue.status})`,
                );
              }
              outcomes.set(item.input, {
                id: displayId,
                action: 'skipped',
                ok: true,
                skippedReason:
                  item.issue.status === 'open'
                    ? 'already open'
                    : `not closed (${item.issue.status})`,
              });
              continue;
            }
            toMutate.push(item);
          }

          // Dry-run stops here — after resolution, reads, and state checks —
          // so it previews exactly the writes a real run would perform.
          if (toMutate.length > 0 || ids.length > 1) {
            const dryRunMessage =
              ids.length === 1 ? 'Would reopen issue' : `Would reopen ${toMutate.length} issues`;
            const dryRunDetail =
              ids.length === 1
                ? { id: toMutate[0]!.internalId, reason }
                : { ids: toMutate.map((t) => t.internalId) };
            if (this.checkDryRun(dryRunMessage, dryRunDetail)) {
              wasDryRun = true;
              return;
            }
          }

          // Apply. A write failure mid-batch is captured as a `failed` result
          // (bulk) so the caller still learns exactly what was written.
          for (const { input, issue } of toMutate) {
            const displayId = this.ctx.debug
              ? formatDebugId(issue.id, mapping, config.display.id_prefix)
              : formatDisplayId(issue.id, mapping, config.display.id_prefix);
            issue.status = 'open';
            issue.closed_at = null;
            issue.close_reason = null;
            issue.version += 1;
            issue.updated_at = now();

            // Optionally record the reopen reason in notes.
            if (reason) {
              const reopenNote = `Reopened: ${reason}`;
              issue.notes = issue.notes ? `${issue.notes}\n\n${reopenNote}` : reopenNote;
            }

            try {
              await writeIssue(dataSyncDir, issue);
            } catch (error) {
              if (!isBulk) throw error; // legacy single-ID error path
              const message = error instanceof Error ? error.message : String(error);
              outcomes.set(input, {
                id: displayId,
                action: 'failed',
                ok: false,
                skippedReason: message,
              });
              continue;
            }
            outcomes.set(input, { id: displayId, action: 'reopened', ok: true });
          }

          results = orderedResults(orderedInputs, outcomes);
        },
      );
    }, 'Failed to reopen issue');

    if (wasDryRun || results.length === 0) return;

    // Single ID: preserve the exact legacy output (text + JSON). A lone
    // missing ID (only reachable with --ignore-missing, a new flag with no
    // legacy contract) falls through to the bulk summary so the skip is
    // reported instead of exiting silently.
    if (ids.length === 1 && results[0]!.action !== 'missing') {
      const r = results[0]!;
      this.output.data({ id: r.id, reopened: true }, () => {
        this.output.success(`Reopened ${r.id}`);
      });
      return;
    }

    // Skips cover any non-closed status (open, in_progress, blocked, deferred);
    // per-item skippedReason carries the specific status.
    emitBulkSummary(this.output, results, { verb: 'Reopened', skippedNote: 'not closed' });

    // Partial application is reported above; name every failed write on stderr
    // (visible under --quiet too) and exit non-zero.
    throwOnWriteFailures(results, 'reopen');
  }
}

export const reopenCommand = new Command('reopen')
  .description('Reopen one or more closed issues')
  .argument('<ids...>', 'Issue ID(s)')
  .option('--reason <text>', 'Reopen reason ("-" reads stdin)')
  .option('--reason-file <path>', 'Read reopen reason from a file ("-" reads stdin)')
  .option('--ignore-missing', 'Skip unknown IDs instead of failing')
  .action(async (ids, options, command) => {
    const handler = new ReopenHandler(command);
    await handler.run(ids, options);
  });
