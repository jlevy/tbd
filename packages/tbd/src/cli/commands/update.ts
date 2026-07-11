/**
 * `tbd update` - Update an issue.
 *
 * See: tbd-design.md §4.4 Update
 */

import { Command } from 'commander';
import { readFile } from 'node:fs/promises';

import { BaseCommand } from '../lib/base-command.js';
import { requireInit, NotFoundError, ValidationError, CLIError } from '../lib/errors.js';
import { readIssue, writeIssue, listIssues } from '../../file/storage.js';
import { parseMarkdownWithFrontmatter } from '../../file/parser.js';
import { formatDisplayId, formatDebugId } from '../../lib/ids.js';
import { IssueStatus, IssueKind } from '../../lib/schemas.js';
import { parsePriority } from '../../lib/priority.js';
import type { IssueStatusType, IssueKindType, PriorityType } from '../../lib/types.js';
import { now } from '../../utils/time-utils.js';
import { resolveToInternalId, type IdMapping } from '../../file/id-mapping.js';
import { resolveAndValidatePath, getPathErrorMessage } from '../../lib/project-paths.js';
import { validateIssueTitle } from '../lib/issue-input-validation.js';
import { withDataSyncContext } from '../lib/data-context.js';
import {
  resolveAllIds,
  loadAllIssues,
  orderedResults,
  emitBulkSummary,
  throwOnWriteFailures,
  type BulkItemResult,
} from '../lib/bulk.js';
import { resolveBodyInput, type BodyInputState } from '../lib/body-input.js';

interface UpdateOptions {
  fromFile?: string;
  title?: string;
  status?: string;
  type?: string;
  priority?: string;
  assignee?: string;
  description?: string;
  notes?: string;
  notesFile?: string;
  due?: string;
  defer?: string;
  addLabel?: string[];
  removeLabel?: string[];
  parent?: string;
  spec?: string;
  childOrder?: string;
  ignoreMissing?: boolean;
}

class UpdateHandler extends BaseCommand {
  async run(ids: string[], options: UpdateOptions): Promise<void> {
    if (ids.length === 1) {
      await this.runSingle(ids[0]!, options);
      return;
    }
    await this.runBulk(ids, options);
  }

  /**
   * Single-ID update preserves the full legacy behavior, including structural
   * side effects (re-parenting, spec propagation, child ordering hints).
   */
  async runSingle(id: string, options: UpdateOptions): Promise<void> {
    const tbdRoot = await requireInit();

    let displayId = id;
    let didUpdate = false;
    let loneMissing = false;

    await this.execute(async () => {
      // Resolve free-text bodies (description/notes) before the data context:
      // the context changes cwd, so relative file paths and stdin must be read
      // up front from the caller's working directory.
      const resolvedOptions = await this.resolveBodyOptions(options);
      await withDataSyncContext(
        tbdRoot,
        { lock: true },
        async ({ dataSyncDir, mapping, config }) => {
          // Resolve input ID to internal ID. A lone unknown ID under
          // --ignore-missing becomes an explicit missing result (same contract
          // as close/reopen) instead of a hard error.
          let internalId: string;
          try {
            internalId = resolveToInternalId(id, mapping);
          } catch {
            if (options.ignoreMissing) {
              loneMissing = true;
              return;
            }
            throw new NotFoundError('Issue', id);
          }

          // Load existing issue. Only a genuinely absent file counts as
          // missing/not-found; a corrupt or unreadable file surfaces its real
          // error (same contract as loadAllIssues in the bulk paths).
          let issue;
          try {
            issue = await readIssue(dataSyncDir, internalId);
          } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
            if (options.ignoreMissing) {
              loneMissing = true;
              return;
            }
            throw new NotFoundError('Issue', id);
          }

          // Parse and validate options
          const updates = await this.parseUpdates(resolvedOptions, mapping, tbdRoot);
          if (updates === null) return;

          if (this.checkDryRun('Would update issue', { id: internalId, ...updates })) {
            return;
          }

          // Capture old spec_path before applying updates (for propagation)
          const oldSpecPath = issue.spec_path;

          // Apply updates
          if (updates.title !== undefined) issue.title = updates.title;
          if (updates.status !== undefined) issue.status = updates.status;
          if (updates.kind !== undefined) issue.kind = updates.kind;
          if (updates.priority !== undefined) issue.priority = updates.priority;
          if (updates.assignee !== undefined) issue.assignee = updates.assignee;
          if (updates.description !== undefined) issue.description = updates.description;
          if (updates.notes !== undefined) issue.notes = updates.notes;
          if (updates.due_date !== undefined) issue.due_date = updates.due_date;
          if (updates.deferred_until !== undefined) issue.deferred_until = updates.deferred_until;
          if (updates.parent_id !== undefined) issue.parent_id = updates.parent_id;
          if (updates.spec_path !== undefined) issue.spec_path = updates.spec_path;
          if (updates.child_order_hints !== undefined)
            issue.child_order_hints = updates.child_order_hints;

          // Inherit spec_path from new parent when re-parenting without explicit --spec
          if (updates.parent_id && options.spec === undefined && !issue.spec_path) {
            try {
              const parentIssue = await readIssue(dataSyncDir, updates.parent_id);
              if (parentIssue.spec_path) {
                issue.spec_path = parentIssue.spec_path;
              }
            } catch {
              // Parent not found; skip inheritance
            }
          }

          // Handle full labels replacement (from --from-file)
          if (updates.labels !== undefined) {
            issue.labels = updates.labels;
          }

          // Handle label updates
          if (updates.addLabels && updates.addLabels.length > 0) {
            const labelsSet = new Set(issue.labels);
            for (const label of updates.addLabels) {
              labelsSet.add(label);
            }
            issue.labels = [...labelsSet];
          }
          if (updates.removeLabels && updates.removeLabels.length > 0) {
            const removeSet = new Set(updates.removeLabels);
            issue.labels = issue.labels.filter((l) => !removeSet.has(l));
          }

          // Update metadata
          issue.version += 1;
          issue.updated_at = now();

          await writeIssue(dataSyncDir, issue);

          // When setting a new parent, append child to parent's child_order_hints
          if (updates.parent_id) {
            try {
              const parentIssue = await readIssue(dataSyncDir, updates.parent_id);
              const hints = parentIssue.child_order_hints ?? [];

              // Only append if not already in hints
              if (!hints.includes(internalId)) {
                parentIssue.child_order_hints = [...hints, internalId];
                parentIssue.version += 1;
                parentIssue.updated_at = now();
                await writeIssue(dataSyncDir, parentIssue);
              }
            } catch {
              // Parent not found or other error - skip order hint update
            }
          }

          // Propagate spec_path to children when parent's spec changes
          if (
            updates.spec_path !== undefined &&
            issue.spec_path &&
            issue.spec_path !== oldSpecPath
          ) {
            const allIssues = await listIssues(dataSyncDir);
            const children = allIssues.filter((i) => i.parent_id === issue.id);
            const timestamp = now();
            for (const child of children) {
              if (!child.spec_path || child.spec_path === oldSpecPath) {
                child.spec_path = issue.spec_path;
                child.version += 1;
                child.updated_at = timestamp;
                await writeIssue(dataSyncDir, child);
              }
            }
          }

          displayId = this.ctx.debug
            ? formatDebugId(issue.id, mapping, config.display.id_prefix)
            : formatDisplayId(issue.id, mapping, config.display.id_prefix);
          didUpdate = true;
        },
      );
    }, 'Failed to update issue');

    if (loneMissing) {
      // A dry run must preview (matching the bulk all-missing shape), never
      // fall through to the real-run summary.
      if (this.checkDryRun('Would update 0 issues', { ids: [] })) return;
      emitBulkSummary(
        this.output,
        [{ id, action: 'missing', ok: false, skippedReason: 'not found' }],
        { verb: 'Updated', skippedNote: 'unchanged' },
      );
      return;
    }

    if (!didUpdate) return;

    this.output.data({ id: displayId, updated: true }, () => {
      this.output.success(`Updated ${displayId}`);
    });
  }

  /**
   * Bulk update (2+ IDs): apply only shared fields that have no lifecycle or
   * structural side effects. Per-ID-only flags are rejected up front, and
   * lifecycle changes stay on `close`/`reopen` so `closed_at`/`close_reason`
   * are never left inconsistent.
   */
  async runBulk(ids: string[], options: UpdateOptions): Promise<void> {
    const perIdOnly: string[] = [];
    if (options.fromFile) perIdOnly.push('--from-file');
    if (options.title !== undefined) perIdOnly.push('--title');
    if (options.description !== undefined) perIdOnly.push('--description');
    if (options.notes !== undefined) perIdOnly.push('--notes');
    if (options.notesFile) perIdOnly.push('--notes-file');
    if (options.status !== undefined) perIdOnly.push('--status');
    if (options.parent !== undefined) perIdOnly.push('--parent');
    if (options.spec !== undefined) perIdOnly.push('--spec');
    if (options.childOrder !== undefined) perIdOnly.push('--child-order');
    if (perIdOnly.length > 0) {
      throw new ValidationError(
        `Cannot use ${perIdOnly.join(', ')} when updating multiple issues. ` +
          `These apply to a single issue; use \`tbd close\`/\`tbd reopen\` for status changes. ` +
          `Bulk update supports shared fields: --priority, --assignee, --type, ` +
          `--add-label, --remove-label, --due, --defer.`,
      );
    }

    const tbdRoot = await requireInit();
    const outcomes = new Map<string, BulkItemResult>();
    let results: BulkItemResult[] = [];
    let wasDryRun = false;

    await this.execute(async () => {
      await withDataSyncContext(
        tbdRoot,
        { lock: true },
        async ({ dataSyncDir, mapping, config }) => {
          const updates = await this.parseUpdates(options, mapping, tbdRoot);
          if (updates === null || Object.keys(updates).length === 0) {
            throw new ValidationError(
              'No fields to update. Specify at least one shared field, e.g. --priority or --add-label.',
            );
          }

          const { resolved, missing, orderedInputs } = resolveAllIds(ids, mapping);
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

          // Dry-run stops here — after resolution and reads — so it previews
          // exactly the writes a real run would perform.
          if (
            this.checkDryRun(`Would update ${loaded.length} issues`, {
              ids: loaded.map((r) => r.internalId),
              ...updates,
            })
          ) {
            wasDryRun = true;
            return;
          }

          // Apply. A write failure mid-batch is captured as a `failed` result
          // so the caller still learns exactly what was written.
          for (const { input, issue } of loaded) {
            if (updates.kind !== undefined) issue.kind = updates.kind;
            if (updates.priority !== undefined) issue.priority = updates.priority;
            if (updates.assignee !== undefined) issue.assignee = updates.assignee;
            if (updates.due_date !== undefined) issue.due_date = updates.due_date;
            if (updates.deferred_until !== undefined) issue.deferred_until = updates.deferred_until;
            if (updates.addLabels && updates.addLabels.length > 0) {
              const labelsSet = new Set(issue.labels);
              for (const label of updates.addLabels) labelsSet.add(label);
              issue.labels = [...labelsSet];
            }
            if (updates.removeLabels && updates.removeLabels.length > 0) {
              const removeSet = new Set(updates.removeLabels);
              issue.labels = issue.labels.filter((l) => !removeSet.has(l));
            }

            issue.version += 1;
            issue.updated_at = now();

            const displayId = this.ctx.debug
              ? formatDebugId(issue.id, mapping, config.display.id_prefix)
              : formatDisplayId(issue.id, mapping, config.display.id_prefix);
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
    }, 'Failed to update issues');

    if (wasDryRun || results.length === 0) return;
    emitBulkSummary(this.output, results, { verb: 'Updated', skippedNote: 'unchanged' });

    // Partial application is reported above; name every failed write on stderr
    // (visible under --quiet too) and exit non-zero.
    throwOnWriteFailures(results, 'update');
  }

  /**
   * Resolve free-text body flags (--description, --notes, --notes-file) to plain
   * strings before entering the data context, so relative file paths resolve
   * against the caller's cwd and stdin ('-') is consumed exactly once.
   * `--from-file` carries its own body and is left untouched.
   */
  private async resolveBodyOptions(options: UpdateOptions): Promise<UpdateOptions> {
    if (options.fromFile) return options;
    // Prevalidate: reject two '-' sentinels before reading anything, so an
    // interactive user is not left typing the first body only to have the
    // second one fail afterward.
    const stdinWanters = [
      options.description === '-' ? '--description' : undefined,
      options.notes === '-' ? '--notes' : undefined,
      options.notesFile === '-' ? '--notes-file' : undefined,
    ].filter((n): n is string => n !== undefined);
    if (stdinWanters.length > 1) {
      throw new CLIError(
        `Cannot read both ${stdinWanters[0]} and ${stdinWanters[1]} from stdin ('-').`,
      );
    }
    const bodyState: BodyInputState = {};
    const resolved: UpdateOptions = { ...options };
    if (options.description !== undefined) {
      resolved.description = await resolveBodyInput(
        { name: '--description', value: options.description },
        bodyState,
      );
    }
    if (options.notes !== undefined || options.notesFile) {
      resolved.notes = await resolveBodyInput(
        {
          name: '--notes',
          value: options.notes,
          fileName: '--notes-file',
          file: options.notesFile,
        },
        bodyState,
      );
      resolved.notesFile = undefined;
    }
    return resolved;
  }

  private async parseUpdates(
    options: UpdateOptions,
    mapping: IdMapping,
    tbdRoot: string,
  ): Promise<{
    title?: string;
    status?: IssueStatusType;
    kind?: IssueKindType;
    priority?: PriorityType;
    assignee?: string | null;
    description?: string | null;
    notes?: string | null;
    due_date?: string | null;
    deferred_until?: string | null;
    parent_id?: string | null;
    spec_path?: string | null;
    child_order_hints?: string[] | null;
    addLabels?: string[];
    removeLabels?: string[];
    labels?: string[];
  } | null> {
    const updates: {
      title?: string;
      status?: IssueStatusType;
      kind?: IssueKindType;
      priority?: PriorityType;
      assignee?: string | null;
      description?: string | null;
      notes?: string | null;
      due_date?: string | null;
      deferred_until?: string | null;
      parent_id?: string | null;
      spec_path?: string | null;
      child_order_hints?: string[] | null;
      addLabels?: string[];
      removeLabels?: string[];
      labels?: string[];
    } = {};

    // Handle --from-file: read all mutable fields from YAML+Markdown file
    if (options.fromFile) {
      let content: string;
      try {
        content = await readFile(options.fromFile, 'utf-8');
      } catch {
        throw new CLIError(`Failed to read file: ${options.fromFile}`);
      }

      try {
        const { frontmatter, description, notes } = parseMarkdownWithFrontmatter(content);

        // Extract mutable fields from frontmatter
        if (typeof frontmatter.title === 'string') {
          updates.title = validateIssueTitle(frontmatter.title, {
            emptyMessage: 'Title cannot be empty',
            rejectBlank: true,
          });
        }
        if (typeof frontmatter.status === 'string') {
          const result = IssueStatus.safeParse(frontmatter.status);
          if (result.success) {
            updates.status = result.data;
          }
        }
        if (typeof frontmatter.kind === 'string') {
          const result = IssueKind.safeParse(frontmatter.kind);
          if (result.success) {
            updates.kind = result.data;
          }
        }
        if (typeof frontmatter.priority === 'number') {
          const priority = parsePriority(String(frontmatter.priority));
          if (priority !== undefined) {
            updates.priority = priority;
          }
        }
        if (frontmatter.assignee !== undefined) {
          updates.assignee = typeof frontmatter.assignee === 'string' ? frontmatter.assignee : null;
        }
        if (frontmatter.due_date !== undefined) {
          updates.due_date = typeof frontmatter.due_date === 'string' ? frontmatter.due_date : null;
        }
        if (frontmatter.deferred_until !== undefined) {
          updates.deferred_until =
            typeof frontmatter.deferred_until === 'string' ? frontmatter.deferred_until : null;
        }
        if (frontmatter.parent_id !== undefined) {
          updates.parent_id =
            typeof frontmatter.parent_id === 'string' ? frontmatter.parent_id : null;
        }
        if (frontmatter.spec_path !== undefined) {
          if (typeof frontmatter.spec_path === 'string' && frontmatter.spec_path) {
            // Validate and normalize the spec path from file
            try {
              const resolved = await resolveAndValidatePath(
                frontmatter.spec_path,
                tbdRoot,
                process.cwd(),
              );
              updates.spec_path = resolved.relativePath;
            } catch (error) {
              throw new ValidationError(getPathErrorMessage(error));
            }
          } else {
            updates.spec_path = null;
          }
        }
        if (Array.isArray(frontmatter.labels)) {
          updates.labels = frontmatter.labels.filter((l): l is string => typeof l === 'string');
        }

        // Set description and notes from body
        updates.description = description || null;
        updates.notes = notes || null;
      } catch (error) {
        throw new CLIError(
          `Failed to parse file: ${options.fromFile}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }

      return updates;
    }

    if (options.title !== undefined) {
      updates.title = validateIssueTitle(options.title, {
        emptyMessage: 'Title cannot be empty',
        rejectBlank: true,
      });
    }

    if (options.status) {
      const result = IssueStatus.safeParse(options.status);
      if (!result.success) {
        throw new ValidationError(`Invalid status: ${options.status}`);
      }
      updates.status = result.data;
    }

    if (options.type) {
      const result = IssueKind.safeParse(options.type);
      if (!result.success) {
        throw new ValidationError(`Invalid type: ${options.type}`);
      }
      updates.kind = result.data;
    }

    if (options.priority) {
      // Use shared parsePriority which accepts both "P1" and "1" formats
      const priority = parsePriority(options.priority);
      if (priority === undefined) {
        throw new ValidationError(`Invalid priority: ${options.priority}. Use P0-P4 or 0-4.`);
      }
      updates.priority = priority;
    }

    if (options.assignee !== undefined) {
      updates.assignee = options.assignee || null;
    }

    // Body fields are pre-resolved (inline/file/stdin) by resolveBodyOptions
    // before the data context, so here they are already plain strings.
    if (options.description !== undefined) {
      updates.description = options.description || null;
    }

    if (options.notes !== undefined) {
      updates.notes = options.notes || null;
    }

    if (options.due !== undefined) {
      updates.due_date = options.due || null;
    }

    if (options.defer !== undefined) {
      updates.deferred_until = options.defer || null;
    }

    if (options.parent !== undefined) {
      if (options.parent) {
        try {
          updates.parent_id = resolveToInternalId(options.parent, mapping);
        } catch {
          throw new ValidationError(`Invalid parent ID: ${options.parent}`);
        }
      } else {
        updates.parent_id = null;
      }
    }

    if (options.spec !== undefined) {
      if (options.spec) {
        // Non-empty spec path: validate and normalize
        try {
          const resolved = await resolveAndValidatePath(options.spec, tbdRoot, process.cwd());
          updates.spec_path = resolved.relativePath;
        } catch (error) {
          throw new ValidationError(getPathErrorMessage(error));
        }
      } else {
        // Empty string: clear the spec path (no validation needed)
        updates.spec_path = null;
      }
    }

    if (options.addLabel && options.addLabel.length > 0) {
      updates.addLabels = options.addLabel;
    }

    if (options.removeLabel && options.removeLabel.length > 0) {
      updates.removeLabels = options.removeLabel;
    }

    // Handle --child-order: set the ordering hints for children
    if (options.childOrder !== undefined) {
      if (options.childOrder === '' || options.childOrder === '""') {
        // Empty string: clear the hints
        updates.child_order_hints = null;
      } else {
        // Parse comma-separated short IDs and resolve to internal IDs
        const shortIds = options.childOrder.split(',').map((s) => s.trim());
        const internalIds: string[] = [];
        for (const shortId of shortIds) {
          if (!shortId) continue; // Skip empty strings
          try {
            const internalId = resolveToInternalId(shortId, mapping);
            internalIds.push(internalId);
          } catch {
            throw new ValidationError(`Invalid ID in --child-order: ${shortId}`);
          }
        }
        updates.child_order_hints = internalIds.length > 0 ? internalIds : null;
      }
    }

    return updates;
  }
}

export const updateCommand = new Command('update')
  .description('Update one or more issues')
  .argument('<ids...>', 'Issue ID(s)')
  .option('--from-file <path>', 'Update all fields from YAML+Markdown file')
  .option('--title <text>', 'Set title')
  .option('--status <status>', 'Set status')
  .option('--type <type>', 'Set type')
  .option('--priority <0-4>', 'Set priority')
  .option('--assignee <name>', 'Set assignee')
  .option('--description <text>', 'Set description ("-" reads stdin)')
  .option('--notes <text>', 'Set working notes ("-" reads stdin)')
  .option('--notes-file <path>', 'Set notes from file ("-" reads stdin)')
  .option('--due <date>', 'Set due date')
  .option('--defer <date>', 'Set deferred until date')
  .option('--add-label <label>', 'Add label', (val, prev: string[] = []) => [...prev, val])
  .option('--remove-label <label>', 'Remove label', (val, prev: string[] = []) => [...prev, val])
  .option('--parent <id>', 'Set parent')
  .option('--spec <path>', 'Set or clear spec path (empty string clears)')
  .option('--child-order <ids>', 'Set child ordering hints (comma-separated IDs)')
  .option('--ignore-missing', 'Skip unknown IDs instead of failing (bulk)')
  .action(async (ids, options, command) => {
    const handler = new UpdateHandler(command);
    await handler.run(ids, options);
  });
