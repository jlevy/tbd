/**
 * `tbd create` - Create a new issue.
 *
 * See: tbd-design.md §4.4 Create
 */

import { Command } from 'commander';

import { BaseCommand } from '../lib/base-command.js';
import { requireInit, CLIError, ValidationError } from '../lib/errors.js';
import type { Issue, IssueKindType, PriorityType } from '../../lib/types.js';
import { generateInternalId, extractUlidFromInternalId, formatDisplayId } from '../../lib/ids.js';
import { readIssue, writeIssue } from '../../file/storage.js';
import {
  saveIdMapping,
  generateUniqueShortId,
  addIdMapping,
  resolveToInternalId,
} from '../../file/id-mapping.js';
import { IssueKind } from '../../lib/schemas.js';
import { parsePriority } from '../../lib/priority.js';
import { now } from '../../utils/time-utils.js';
import { resolveSpecArg, getPathErrorMessage } from '../../lib/project-paths.js';
import { validateIssueTitle } from '../lib/issue-input-validation.js';
import { withDataSyncContext, notifyWorktreeRepaired } from '../lib/data-context.js';
import { resolveBodyInput } from '../lib/body-input.js';
import { applyDependencyWrites, type DependencyWriteOutcome } from '../lib/bulk.js';
import { issueNotFoundHint } from '../lib/id-suggestions.js';

interface CreateOptions {
  fromFile?: string;
  type?: string;
  priority?: string;
  description?: string;
  file?: string;
  assignee?: string;
  due?: string;
  defer?: string;
  parent?: string;
  label?: string[];
  spec?: string;
  dependsOn?: string[];
}

class CreateHandler extends BaseCommand {
  async run(title: string | undefined, options: CreateOptions): Promise<void> {
    const tbdRoot = await requireInit();

    // Validate title is provided (unless --from-file)
    if (!title && !options.fromFile) {
      throw new ValidationError('Title is required. Use: tbd create "Issue title"');
    }
    const validatedTitle =
      title === undefined
        ? undefined
        : validateIssueTitle(title, {
            emptyMessage: 'Title is required. Use: tbd create "Issue title"',
            rejectBlank: true,
          });

    // Parse and validate options
    const kind = this.parseKind(options.type ?? 'task');
    const priority = this.validatePriority(options.priority ?? '2');

    // Resolve description from inline text, a file, or stdin ('-').
    const description = await resolveBodyInput(
      {
        name: '--description',
        value: options.description,
        fileName: '--file',
        file: options.file,
      },
      {},
    );

    // Validate and normalize spec path if provided
    let specPath: string | undefined;
    if (options.spec) {
      try {
        const resolved = await resolveSpecArg(options.spec, tbdRoot, process.cwd());
        specPath = resolved.relativePath;
      } catch (error) {
        throw new ValidationError(getPathErrorMessage(error));
      }
    }

    if (
      this.checkDryRun('Would create issue', {
        title: validatedTitle,
        kind,
        priority,
        spec: specPath,
        ...options,
      })
    ) {
      return;
    }

    const timestamp = now();
    const id = generateInternalId();
    const ulid = extractUlidFromInternalId(id);

    let shortId: string;
    let prefix: string;
    let issue: Issue;
    let wireOutcome: DependencyWriteOutcome | undefined;
    await this.execute(async () => {
      await withDataSyncContext(
        tbdRoot,
        { lock: true },
        async ({ dataSyncDir, config, mapping, repairedWorktreeStatus }) => {
          // Surface a silent worktree heal so a write never looks like it landed
          // normally when the worktree had to be materialized first. #135
          notifyWorktreeRepaired(repairedWorktreeStatus);
          prefix = config.display.id_prefix;

          shortId = generateUniqueShortId(mapping);
          addIdMapping(mapping, ulid, shortId);

          // Resolve parent ID if provided (convert display ID to internal ID)
          let parentId: string | undefined;
          if (options.parent) {
            try {
              parentId = resolveToInternalId(options.parent, mapping);
            } catch {
              throw new ValidationError(`Invalid parent ID: ${options.parent}`);
            }
          }

          // Inherit spec_path from parent if not explicitly provided
          if (!specPath && parentId) {
            const parentIssue = await readIssue(dataSyncDir, parentId);
            if (parentIssue.spec_path) {
              specPath = parentIssue.spec_path;
            }
          }

          // Resolve and read all --depends-on blockers before creating the
          // issue, so a bad blocker ID fails before anything is written.
          const blockers: Issue[] = [];
          if (options.dependsOn && options.dependsOn.length > 0) {
            const missing: string[] = [];
            const seen = new Set<string>();
            for (const input of options.dependsOn) {
              let blockerInternalId: string;
              try {
                blockerInternalId = resolveToInternalId(input, mapping);
              } catch {
                missing.push(input);
                continue;
              }
              if (seen.has(blockerInternalId)) continue;
              seen.add(blockerInternalId);
              try {
                blockers.push(await readIssue(dataSyncDir, blockerInternalId));
              } catch (error) {
                // Only a genuinely absent file is an unknown ID; anything else
                // (corrupt YAML, permissions) is a repository problem.
                if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
                missing.push(input);
              }
            }
            if (missing.length > 0) {
              const hint = issueNotFoundHint(missing, mapping, config.display.id_prefix);
              throw new ValidationError(
                `Invalid --depends-on ID: ${missing.join(', ')}${hint ? `\n${hint}` : ''}`,
              );
            }
          }

          issue = {
            type: 'is',
            id,
            version: 1,
            title: validatedTitle!,
            kind,
            status: 'open',
            priority,
            labels: options.label ?? [],
            dependencies: [],
            created_at: timestamp,
            updated_at: timestamp,
            description: description ?? undefined,
            assignee: options.assignee ?? undefined,
            due_date: options.due ?? undefined,
            deferred_until: options.defer ?? undefined,
            parent_id: parentId,
            spec_path: specPath,
          };

          // Write both the issue and the mapping
          await writeIssue(dataSyncDir, issue);
          await saveIdMapping(dataSyncDir, mapping);

          // Wire blockers: each edge lives on the blocker's issue file. The
          // new issue is durable at this point, so a blocker-write failure is
          // reported per target (with the created ID) rather than aborting.
          if (blockers.length > 0) {
            wireOutcome = await applyDependencyWrites(
              dataSyncDir,
              blockers.map((blockerIssue) => ({
                internalId: blockerIssue.id,
                issue: blockerIssue,
              })),
              (internalId) => formatDisplayId(internalId, mapping, config.display.id_prefix),
              (blockerIssue) => {
                blockerIssue.dependencies.push({ type: 'blocks', target: id });
                blockerIssue.version += 1;
                blockerIssue.updated_at = timestamp;
                return 'changed';
              },
            );
          }

          // When creating with a parent, append child to parent's child_order_hints
          if (parentId) {
            try {
              const parentIssue = await readIssue(dataSyncDir, parentId);
              const hints = parentIssue.child_order_hints ?? [];

              // Only append if not already in hints (shouldn't happen for new issue, but safe)
              if (!hints.includes(id)) {
                parentIssue.child_order_hints = [...hints, id];
                parentIssue.version += 1;
                parentIssue.updated_at = timestamp;
                await writeIssue(dataSyncDir, parentIssue);
              }
            } catch {
              // Parent not found or other error - skip order hint update
            }
          }
        },
      );
    }, 'Failed to create issue');

    // Output with display ID (prefix + short ID)
    const displayId = `${prefix!}-${shortId!}`;
    this.output.data({ id: displayId, internalId: id, title: validatedTitle }, () => {
      this.output.success(`Created ${displayId}: ${validatedTitle}`);
    });

    // The issue exists even when blocker wiring failed, so the created ID is
    // always revealed above; the error names the finishing command so a
    // retry updates this bead instead of creating a duplicate.
    if (wireOutcome && wireOutcome.failed.length > 0) {
      const failedIds = wireOutcome.failed.map((f) => f.id);
      const detail = wireOutcome.failed.map((f) => `${f.id} (${f.message})`).join(', ');
      const attempted = wireOutcome.failed.length + wireOutcome.changed.length;
      throw new CLIError(
        `Created ${displayId}, but ${wireOutcome.failed.length} of ${attempted} --depends-on ` +
          `edges failed to wire: ${detail}. ` +
          `Run \`tbd dep add ${displayId} ${failedIds.join(' ')}\` to finish (do not re-run create).`,
      );
    }
  }

  private parseKind(value: string): IssueKindType {
    const result = IssueKind.safeParse(value);
    if (!result.success) {
      throw new ValidationError(`Invalid type: ${value}. Must be: bug, feature, task, epic, chore`);
    }
    return result.data;
  }

  private validatePriority(value: string): PriorityType {
    // Use shared parsePriority which accepts both "P1" and "1" formats
    const num = parsePriority(value);
    if (num === undefined) {
      throw new ValidationError(`Invalid priority: ${value}. Use P0-P4 or 0-4.`);
    }
    return num;
  }
}

export const createCommand = new Command('create')
  .description('Create a new issue')
  .argument('[title]', 'Issue title')
  .option('--from-file <path>', 'Create from YAML+Markdown file')
  .option('-t, --type <type>', 'Issue type: bug, feature, task, epic, chore', 'task')
  .option('-p, --priority <0-4>', 'Priority (0=critical, 4=lowest)', '2')
  .option('-d, --description <text>', 'Description ("-" reads stdin)')
  .option('-f, --file <path>', 'Read description from file ("-" reads stdin)')
  .option('--assignee <name>', 'Assignee')
  .option('--due <date>', 'Due date (ISO8601)')
  .option('--defer <date>', 'Defer until date (ISO8601)')
  .option('--parent <id>', 'Parent issue ID')
  .option('--spec <path>', 'Link to spec document (relative path)')
  .option('-l, --label <label>', 'Add label (repeatable)', (val, prev: string[] = []) => [
    ...prev,
    val,
  ])
  .option(
    '--depends-on <id>',
    'Blocker issue ID this issue depends on (repeatable)',
    (val, prev: string[] = []) => [...prev, val],
  )
  .action(async (title, options, command) => {
    const handler = new CreateHandler(command);
    await handler.run(title, options);
  });
