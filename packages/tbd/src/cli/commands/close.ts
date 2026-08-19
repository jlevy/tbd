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
import { requireInit, NotFoundError, ValidationError } from '../lib/errors.js';
import { IssueResolution } from '../../lib/schemas.js';
import type { IssueResolutionType } from '../../lib/types.js';
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
import { issueNotFoundHint, resolveIssueId } from '../lib/id-suggestions.js';

interface CloseOptions {
  reason?: string;
  reasonFile?: string;
  as?: string;
  duplicateOf?: string;
  ignoreMissing?: boolean;
}

/**
 * Read `--as` and `--duplicate-of` into the terminal axis.
 *
 * `--reason` stays free prose and is unaffected: it says *what happened*, while this
 * says *how it ended*, and the tracker can only render the second.
 */
function parseResolution(options: CloseOptions): {
  resolution: IssueResolutionType;
  duplicateOfInput?: string;
} {
  const parsed = IssueResolution.safeParse(options.as ?? 'completed');
  if (!parsed.success) {
    throw new ValidationError(
      `Invalid --as value: ${options.as}. Expected completed, canceled, or duplicate.`,
    );
  }
  const resolution = parsed.data;

  if (resolution === 'duplicate' && !options.duplicateOf) {
    throw new ValidationError('--duplicate-of <id> is required with --as duplicate');
  }
  if (resolution !== 'duplicate' && options.duplicateOf) {
    throw new ValidationError('--duplicate-of is only valid with --as duplicate');
  }
  return { resolution, duplicateOfInput: options.duplicateOf };
}

class CloseHandler extends BaseCommand {
  async run(ids: string[], options: CloseOptions): Promise<void> {
    const tbdRoot = await requireInit();
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
      const { resolution, duplicateOfInput } = parseResolution(options);
      await withDataSyncContext(
        tbdRoot,
        { lock: true },
        async ({ dataSyncDir, mapping, config }) => {
          // Resolve the duplicate target inside the context, where the id mapping
          // exists, and fail before any write rather than per-issue mid-batch.
          let duplicateOf: string | null = null;
          if (duplicateOfInput) {
            try {
              duplicateOf = resolveIssueId(duplicateOfInput, mapping, config.display.id_prefix);
            } catch {
              throw new ValidationError(
                `--duplicate-of names an unknown issue: ${duplicateOfInput}`,
              );
            }
          }

          const { resolved, missing, orderedInputs } = resolveAllIds(ids, mapping);

          // Fail closed: any unknown ID aborts before writing anything, unless
          // the caller opted into best-effort with --ignore-missing.
          if (missing.length > 0 && !options.ignoreMissing) {
            throw new NotFoundError(
              'Issue',
              missing.join(', '),
              issueNotFoundHint(missing, mapping, config.display.id_prefix),
            );
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
          // real run would mutate. Already-closed is an idempotent skip.
          const toMutate: typeof loaded = [];
          for (const item of loaded) {
            const displayId = this.ctx.debug
              ? formatDebugId(item.issue.id, mapping, config.display.id_prefix)
              : formatDisplayId(item.issue.id, mapping, config.display.id_prefix);
            if (item.issue.status === 'closed') {
              outcomes.set(item.input, {
                id: displayId,
                action: 'skipped',
                ok: true,
                skippedReason: 'already closed',
              });
              continue;
            }
            toMutate.push(item);
          }

          // Dry-run stops here — after resolution, reads, and state checks.
          // A lone already-closed ID keeps the legacy idempotent output (which
          // never consulted dry-run); every other shape previews, including a
          // lone --ignore-missing skip (which mutates nothing but must not
          // fall through to the real-run summary).
          const loneLegacyNoop = ids.length === 1 && loaded.length === 1 && toMutate.length === 0;
          if (!loneLegacyNoop) {
            const loneMutation = ids.length === 1 && toMutate.length === 1;
            const dryRunMessage = loneMutation
              ? 'Would close issue'
              : `Would close ${toMutate.length} issues`;
            const dryRunDetail = loneMutation
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
            issue.status = 'closed';
            issue.closed_at = now();
            issue.close_reason = reason ?? null;
            // Absent reads as completed, so only a non-default resolution is written.
            // That keeps an ordinary close byte-identical to what it produced before
            // this axis existed.
            issue.resolution = resolution === 'completed' ? null : resolution;
            issue.duplicate_of = duplicateOf;
            issue.version += 1;
            issue.updated_at = now();
            try {
              await writeIssue(dataSyncDir, issue);
            } catch (error) {
              if (ids.length === 1) {
                throw error;
              } // legacy single-ID error path
              const message = error instanceof Error ? error.message : String(error);
              outcomes.set(input, {
                id: displayId,
                action: 'failed',
                ok: false,
                skippedReason: message,
              });
              continue;
            }
            outcomes.set(input, { id: displayId, action: 'closed', ok: true });
          }

          results = orderedResults(orderedInputs, outcomes);
        },
      );
    }, 'Failed to close issue');

    if (wasDryRun || results.length === 0) {
      return;
    }

    // Single ID: preserve the exact legacy output (text + JSON). A lone
    // missing ID (only reachable with --ignore-missing, a new flag with no
    // legacy contract) falls through to the bulk summary so the skip is
    // reported instead of exiting silently.
    if (ids.length === 1 && results[0]!.action !== 'missing') {
      const r = results[0]!;
      const alreadyClosed = r.action === 'skipped';
      this.output.data({ id: r.id, closed: true, alreadyClosed }, () => {
        this.output.success(`Closed ${r.id}`);
      });
      return;
    }

    emitBulkSummary(this.output, results, { verb: 'Closed', skippedNote: 'already closed' });

    // Partial application is reported above; name every failed write on stderr
    // (visible under --quiet too) and exit non-zero.
    throwOnWriteFailures(results, 'close');
  }
}

export const closeCommand = new Command('close')
  .description('Close one or more issues')
  .argument('<ids...>', 'Issue ID(s)')
  .option('--reason <text>', 'Close reason ("-" reads stdin)')
  .option('--reason-file <path>', 'Read close reason from a file ("-" reads stdin)')
  .option('--as <resolution>', 'How the work ended: completed, canceled, or duplicate')
  .option('--duplicate-of <id>', 'The issue this duplicates (required with --as duplicate)')
  .option('--ignore-missing', 'Skip unknown IDs instead of failing')
  .action(async (ids, options, command) => {
    const handler = new CloseHandler(command);
    await handler.run(ids, options);
  });
