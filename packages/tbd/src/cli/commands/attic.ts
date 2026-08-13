/**
 * `tbd attic` - Attic (conflict archive) commands.
 *
 * See: tbd-design.md §4.11 Attic Commands
 */

import { Command } from 'commander';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { parseYamlWithConflictDetection } from '../../utils/yaml-utils.js';

import { BaseCommand } from '../lib/base-command.js';
import { requireInit, NotFoundError, ValidationError } from '../lib/errors.js';
import { readIssue, writeIssue } from '../../file/storage.js';
import { formatDisplayId, formatDebugId } from '../../lib/ids.js';
import { resolveToInternalId, type IdMapping } from '../../file/id-mapping.js';
import { resolveAtticDir } from '../../lib/paths.js';
import { formatTimestampAgo } from '../../lib/format-utils.js';
import { now } from '../../utils/time-utils.js';
import type { AtticEntry } from '../../lib/types.js';
import { AtticEntrySchema } from '../../lib/schemas.js';
import { loadDataContext, withDataSyncContext } from '../lib/data-context.js';
import { writeAtticEntryFile } from '../../file/attic-entry.js';

/** Parse attic entry filename into its filterable components. */
export function parseAtticFilename(
  filename: string,
): { entityId: string; timestamp: string; field: string } | null {
  // Format: is-abc123_2025-01-07T10-30-00Z_description.yml
  const match = /^(is-[0-9a-z]{26})_(.+)_([^_]+)\.yml$/.exec(filename);
  if (!match) {
    return null;
  }
  const [, entityId, timestamp, field] = match;
  // Convert hyphens back to colons in timestamp
  const isoTimestamp = timestamp!.replace(/T(\d{2})-(\d{2})-(\d{2})/, 'T$1:$2:$3');
  return { entityId: entityId!, timestamp: isoTimestamp, field: field! };
}

/** Resolve every user-facing ID form accepted by the rest of the issue CLI. */
export function resolveAtticIssueId(input: string, mapping: IdMapping): string {
  return resolveToInternalId(input, mapping);
}

/** Decode canonical JSON storage while retaining legacy plain-text entries. */
export function decodeAtticTextValue(value: string): string | null {
  try {
    const decoded: unknown = JSON.parse(value);
    return typeof decoded === 'string' || decoded === null ? decoded : value;
  } catch {
    return value;
  }
}

/**
 * Build the reverse archive written before a restore overwrites the current
 * winner. Writing this first makes restore failure one-sided and recoverable:
 * an extra archive is harmless, while an overwritten value without one is not.
 */
export function buildRestorationAtticEntry(input: {
  original: AtticEntry;
  currentValue: string | null | undefined;
  currentVersion: number;
  currentUpdatedAt: string;
  restoredAt: string;
}): AtticEntry {
  return {
    entity_id: input.original.entity_id,
    timestamp: input.restoredAt,
    field: input.original.field,
    lost_value: JSON.stringify(input.currentValue ?? null),
    winner_source: input.original.loser_source,
    loser_source: input.original.winner_source,
    context: {
      local_version: input.currentVersion,
      remote_version: input.original.context.remote_version,
      local_updated_at: input.currentUpdatedAt,
      remote_updated_at: input.original.context.remote_updated_at,
    },
  };
}

/**
 * List all attic entries.
 */
async function listAtticEntries(tbdRoot: string, filterById?: string): Promise<AtticEntry[]> {
  const atticPath = await resolveAtticDir(tbdRoot);
  let files: string[];

  try {
    files = await readdir(atticPath);
  } catch {
    // Attic directory doesn't exist - return empty
    return [];
  }

  const entries: AtticEntry[] = [];

  for (const file of files) {
    if (!file.endsWith('.yml')) {
      continue;
    }

    const parsed = parseAtticFilename(file);
    if (!parsed) {
      continue;
    }

    // Filter by ID if specified
    if (filterById && parsed.entityId !== filterById) {
      continue;
    }

    try {
      const filePath = join(atticPath, file);
      const content = await readFile(filePath, 'utf-8');
      const rawData = parseYamlWithConflictDetection(content, filePath);
      const entry = AtticEntrySchema.parse(rawData);
      entries.push(entry);
    } catch {
      // Skip invalid files (including those with merge conflicts or schema errors)
    }
  }

  // Sort by timestamp descending (most recent first)
  entries.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  return entries;
}

/**
 * Save an attic entry.
 */
export async function saveAtticEntry(tbdRoot: string, entry: AtticEntry): Promise<void> {
  const atticPath = await resolveAtticDir(tbdRoot);
  await writeAtticEntryFile(atticPath, entry);
}

// List attic entries
class AtticListHandler extends BaseCommand {
  async run(id?: string): Promise<void> {
    const tbdRoot = await requireInit();

    // Load ID mapping and config for display, initializing shared layout first.
    const { mapping, config } = await loadDataContext(tbdRoot);

    const filterId = id ? resolveAtticIssueId(id, mapping) : undefined;
    const entries = await listAtticEntries(tbdRoot, filterId);

    const prefix = config.display.id_prefix;
    const showDebug = this.ctx.debug;

    const output = entries.map((e) => ({
      id: showDebug
        ? formatDebugId(e.entity_id, mapping, prefix)
        : formatDisplayId(e.entity_id, mapping, prefix),
      timestamp: e.timestamp,
      field: e.field,
      winner: e.winner_source,
    }));

    this.output.data(output, () => {
      const colors = this.output.getColors();
      if (output.length === 0) {
        console.log('No attic entries');
        return;
      }
      console.log(
        `${colors.dim('ID'.padEnd(12))}${colors.dim('WHEN'.padEnd(14))}${colors.dim('FIELD'.padEnd(14))}${colors.dim('WINNER')}`,
      );
      for (const entry of output) {
        const when = formatTimestampAgo(entry.timestamp) ?? entry.timestamp;
        console.log(
          `${colors.id(entry.id.padEnd(12))}${when.padEnd(14)}${entry.field.padEnd(14)}${entry.winner}`,
        );
      }
    });
  }
}

// Show attic entry
class AtticShowHandler extends BaseCommand {
  async run(id: string, timestamp: string): Promise<void> {
    const tbdRoot = await requireInit();

    // Load ID mapping and config for display, initializing shared layout first.
    const { mapping, config } = await loadDataContext(tbdRoot);

    const normalizedId = resolveAtticIssueId(id, mapping);
    const entries = await listAtticEntries(tbdRoot, normalizedId);

    // Find entry matching timestamp (approximate match for different formats)
    const entry = entries.find(
      (e) => e.timestamp === timestamp || e.timestamp.replace(/:/g, '-') === timestamp,
    );

    if (!entry) {
      throw new NotFoundError('Attic entry', `${id} at ${timestamp}`);
    }

    const prefix = config.display.id_prefix;
    const showDebug = this.ctx.debug;
    const displayId = showDebug
      ? formatDebugId(entry.entity_id, mapping, prefix)
      : formatDisplayId(entry.entity_id, mapping, prefix);

    this.output.data(entry, () => {
      const colors = this.output.getColors();
      console.log(`${colors.bold('Entity:')} ${displayId}`);
      console.log(`${colors.bold('Timestamp:')} ${entry.timestamp}`);
      console.log(`${colors.bold('Field:')} ${entry.field}`);
      console.log(`${colors.bold('Winner:')} ${entry.winner_source}`);
      console.log(`${colors.bold('Loser:')} ${entry.loser_source}`);
      console.log('');
      console.log(colors.bold('Lost value:'));
      console.log(entry.lost_value);
      console.log('');
      console.log(colors.bold('Context:'));
      console.log(`  Local version: ${entry.context.local_version}`);
      console.log(`  Remote version: ${entry.context.remote_version}`);
      const localAgo = formatTimestampAgo(entry.context.local_updated_at);
      const remoteAgo = formatTimestampAgo(entry.context.remote_updated_at);
      console.log(`  Local updated: ${localAgo ?? entry.context.local_updated_at}`);
      console.log(`  Remote updated: ${remoteAgo ?? entry.context.remote_updated_at}`);
    });
  }
}

// Restore from attic
class AtticRestoreHandler extends BaseCommand {
  async run(id: string, timestamp: string): Promise<void> {
    const tbdRoot = await requireInit();

    const { mapping } = await loadDataContext(tbdRoot);

    const normalizedId = resolveAtticIssueId(id, mapping);
    const entries = await listAtticEntries(tbdRoot, normalizedId);

    // Find entry matching timestamp
    const entry = entries.find(
      (e) => e.timestamp === timestamp || e.timestamp.replace(/:/g, '-') === timestamp,
    );

    if (!entry) {
      throw new NotFoundError('Attic entry', `${id} at ${timestamp}`);
    }

    if (this.checkDryRun('Would restore from attic', { id: normalizedId, field: entry.field })) {
      return;
    }

    let displayId = id;

    await this.execute(async () => {
      await withDataSyncContext(
        tbdRoot,
        { lock: true },
        async ({ dataSyncDir, mapping, config }) => {
          // Load the current issue
          let issue;
          try {
            issue = await readIssue(dataSyncDir, normalizedId);
          } catch {
            throw new NotFoundError('Issue', id);
          }

          // Restore the field value
          const field = entry.field as keyof typeof issue;
          if (field === 'description' || field === 'notes' || field === 'title') {
            const restored = decodeAtticTextValue(entry.lost_value);
            const current = issue[field];
            if (restored === null) {
              if (field === 'title') {
                throw new ValidationError('Cannot restore a null title');
              }
              if (field === 'description') {
                const withoutDescription = { ...issue };
                delete withoutDescription.description;
                issue = withoutDescription;
              } else {
                const withoutNotes = { ...issue };
                delete withoutNotes.notes;
                issue = withoutNotes;
              }
            } else {
              (issue as Record<string, unknown>)[field] = restored;
            }

            if ((current ?? null) !== restored) {
              const restoredAt = now();
              await writeAtticEntryFile(
                join(dataSyncDir, 'attic'),
                buildRestorationAtticEntry({
                  original: entry,
                  currentValue: typeof current === 'string' ? current : null,
                  currentVersion: issue.version,
                  currentUpdatedAt: issue.updated_at,
                  restoredAt,
                }),
              );
              issue.updated_at = restoredAt;
            } else {
              issue.updated_at = now();
            }
          } else {
            throw new ValidationError(`Cannot restore field: ${entry.field}`);
          }

          issue.version += 1;

          await writeIssue(dataSyncDir, issue);

          displayId = this.ctx.debug
            ? formatDebugId(normalizedId, mapping, config.display.id_prefix)
            : formatDisplayId(normalizedId, mapping, config.display.id_prefix);
        },
      );
    }, 'Failed to restore from attic');

    this.output.success(`Restored ${entry.field} for ${displayId} from attic entry ${timestamp}`);
  }
}

interface AtticListOptions {
  since?: string;
  limit?: string;
}

const listAtticCommand = new Command('list')
  .description('List attic entries')
  .argument('[id]', 'Filter by issue ID')
  .option('--since <date>', 'Entries since date')
  .option('--limit <n>', 'Limit results')
  .action(async (id, options: AtticListOptions, command) => {
    const handler = new AtticListHandler(command);
    await handler.run(id);
  });

const showAtticCommand = new Command('show')
  .description('Show attic entry details')
  .argument('<id>', 'Issue ID')
  .argument('<timestamp>', 'Entry timestamp')
  .action(async (id, timestamp, _options, command) => {
    const handler = new AtticShowHandler(command);
    await handler.run(id, timestamp);
  });

const restoreAtticCommand = new Command('restore')
  .description('Restore lost value from attic')
  .argument('<id>', 'Issue ID')
  .argument('<timestamp>', 'Entry timestamp')
  .action(async (id, timestamp, _options, command) => {
    const handler = new AtticRestoreHandler(command);
    await handler.run(id, timestamp);
  });

export const atticCommand = new Command('attic')
  .description('Manage conflict archive (attic)')
  .addCommand(listAtticCommand)
  .addCommand(showAtticCommand)
  .addCommand(restoreAtticCommand);
