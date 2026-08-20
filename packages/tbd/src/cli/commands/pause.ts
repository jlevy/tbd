/**
 * `tbd pause` and `tbd resume` — set work down without losing that it started.
 *
 * Before the hold axis existed the only way to say "stop working on this" was
 * `--status deferred`, which overwrote `in_progress` and destroyed the one fact that
 * made a pause interesting: that the work had begun. Position and modifier are separate
 * now, so pausing leaves `status` and `started_at` exactly where they are and records
 * *why* the work is not moving beside them.
 *
 * Symmetric with `tbd close` / `tbd reopen`: one verb each way, bulk by default.
 */

import { Command } from 'commander';

import { BaseCommand } from '../lib/base-command.js';
import { requireInit, NotFoundError, ValidationError } from '../lib/errors.js';
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
import { issueNotFoundHint } from '../lib/id-suggestions.js';
import { IssueHold } from '../../lib/schemas.js';
import type { IssueHoldType } from '../../lib/types.js';

interface HoldOptions {
  until?: string;
  reason?: string;
  ignoreMissing?: boolean;
}

/** Parse `--until` into an ISO timestamp, rejecting anything unparseable. */
function parseUntil(value: string | undefined): string | null {
  if (!value) {
    return null;
  }
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    throw new ValidationError(`Invalid --until value: ${value}. Expected a date or timestamp.`);
  }
  return new Date(parsed).toISOString();
}

class HoldHandler extends BaseCommand {
  constructor(
    command: Command,
    private readonly hold: IssueHoldType | null,
    private readonly verb: string,
  ) {
    super(command);
  }

  async run(ids: string[], options: HoldOptions): Promise<void> {
    const tbdRoot = await requireInit();
    const outcomes = new Map<string, BulkItemResult>();
    let results: BulkItemResult[] = [];
    let wasDryRun = false;

    await this.execute(async () => {
      const holdUntil = parseUntil(options.until);
      if (holdUntil && this.hold !== 'paused') {
        throw new ValidationError('--until is only valid when pausing');
      }

      await withDataSyncContext(
        tbdRoot,
        { lock: true },
        async ({ dataSyncDir, mapping, config }) => {
          const { resolved, missing, orderedInputs } = resolveAllIds(ids, mapping);
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

          const loaded = await loadAllIssues(
            dataSyncDir,
            resolved,
            options.ignoreMissing ?? false,
            outcomes,
          );

          const toMutate: typeof loaded = [];
          for (const item of loaded) {
            const displayId = this.ctx.debug
              ? formatDebugId(item.issue.id, mapping, config.display.id_prefix)
              : formatDisplayId(item.issue.id, mapping, config.display.id_prefix);

            // A hold describes work that could still move. Closed work cannot, and
            // saying otherwise is the contradiction the write boundary rejects.
            if (item.issue.status === 'closed') {
              outcomes.set(item.input, {
                id: displayId,
                action: 'skipped',
                ok: true,
                skippedReason: 'closed — reopen it first',
              });
              continue;
            }
            if ((item.issue.hold ?? null) === this.hold) {
              outcomes.set(item.input, {
                id: displayId,
                action: 'skipped',
                ok: true,
                skippedReason: this.hold ? `already ${this.hold}` : 'not on hold',
              });
              continue;
            }
            toMutate.push(item);
          }

          if (
            this.checkDryRun(`Would ${this.verb} ${toMutate.length} issue(s)`, {
              ids: toMutate.map((t) => t.internalId),
            })
          ) {
            wasDryRun = true;
            return;
          }

          for (const { input, issue } of toMutate) {
            const displayId = this.ctx.debug
              ? formatDebugId(issue.id, mapping, config.display.id_prefix)
              : formatDisplayId(issue.id, mapping, config.display.id_prefix);
            issue.hold = this.hold;
            // `hold_until` belongs to the pause it qualifies, so it goes when the pause
            // goes rather than lingering as a date nothing refers to.
            issue.hold_until = this.hold === 'paused' ? holdUntil : null;
            if (options.reason) {
              issue.notes = `${issue.notes ? `${issue.notes}\n\n` : ''}${
                this.hold ? 'Paused' : 'Resumed'
              }: ${options.reason}`;
            }
            issue.version += 1;
            issue.updated_at = now();
            try {
              await writeIssue(dataSyncDir, issue);
            } catch (error) {
              const message = error instanceof Error ? error.message : String(error);
              outcomes.set(input, {
                id: displayId,
                action: 'failed',
                ok: false,
                skippedReason: message,
              });
              continue;
            }
            outcomes.set(input, { id: displayId, action: 'updated', ok: true });
          }

          results = orderedResults(orderedInputs, outcomes);
        },
      );
    }, `Failed to ${this.verb} issue`);

    if (wasDryRun || results.length === 0) {
      return;
    }
    // Unlike `close`, a hold can be skipped for genuinely different reasons — the
    // work is closed, or it already carries this hold — so the note is built from the
    // reasons actually present rather than fixed in advance.
    const skippedReasons = [
      ...new Set(
        results
          .filter((result) => result.action === 'skipped')
          .map((result) => result.skippedReason)
          .filter((reason): reason is string => Boolean(reason)),
      ),
    ];
    emitBulkSummary(this.output, results, {
      verb: this.hold ? 'Paused' : 'Resumed',
      skippedNote: skippedReasons.join('; ') || 'unchanged',
    });
    throwOnWriteFailures(results, this.verb);
  }
}

export const pauseCommand = new Command('pause')
  .description('Set work down without losing that it started')
  .argument('<ids...>', 'Issue ID(s)')
  .option('--until <when>', 'When the pause is expected to lift')
  .option('--reason <text>', 'Why, appended to notes')
  .option('--ignore-missing', 'Skip unknown IDs instead of failing')
  .action(async (ids, options, command) => {
    await new HoldHandler(command, 'paused', 'pause').run(ids, options);
  });

export const resumeCommand = new Command('resume')
  .description('Lift a hold and make the work movable again')
  .argument('<ids...>', 'Issue ID(s)')
  .option('--reason <text>', 'Why, appended to notes')
  .option('--ignore-missing', 'Skip unknown IDs instead of failing')
  .action(async (ids, options, command) => {
    await new HoldHandler(command, null, 'resume').run(ids, options);
  });

/** Exported for `tbd update --hold`, which shares the vocabulary. */
export const HOLD_VALUES = IssueHold.options;
