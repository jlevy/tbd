/** Canonical persistence for field-conflict attic entries. */

import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

import { writeFile } from 'atomically';

import { ATTIC_ENTRY_FIELD_ORDER, AtticEntrySchema } from '../lib/schemas.js';
import type { AtticEntry } from '../lib/types.js';
import { now } from '../utils/time-utils.js';
import { sortKeys, stringifyYaml } from '../utils/yaml-utils.js';

import type { ConflictEntry } from './git.js';

/** Stable filename used by the attic CLI and conflict-report links. */
export function atticEntryFilename(entry: AtticEntry): string {
  const safeTimestamp = entry.timestamp.replace(/:/g, '-');
  return `${entry.entity_id}_${safeTimestamp}_${entry.field}.yml`;
}

/** Write one validated attic entry and return its filename. */
export async function writeAtticEntryFile(atticDir: string, entry: AtticEntry): Promise<string> {
  const validEntry = AtticEntrySchema.parse(entry);
  await mkdir(atticDir, { recursive: true });

  const filename = atticEntryFilename(validEntry);
  const filepath = join(atticDir, filename);
  const sorted = sortKeys(
    validEntry as unknown as Record<string, unknown>,
    ATTIC_ENTRY_FIELD_ORDER,
  );
  await writeFile(filepath, stringifyYaml(sorted, { sortMapEntries: false }));
  return filename;
}

/**
 * Archive one field a merge had to drop, and return the entry's filename.
 *
 * Every path that resolves a bead conflict writes through here, so an entry from a
 * workspace import and an entry from a `tbd sync` merge are the same file in the same
 * place — which is what lets `tbd attic list`, `show` and `restore` work on both, and
 * what lets an older client read entries a newer one wrote.
 *
 * The winning side is taken from the conflict rather than decided here: the merge does
 * not use one rule for a whole bead (see `ConflictEntry.winner_source`), so a caller
 * computing it per issue gets the deletion and comment-lineage cases backwards.
 *
 * `lost_value` is JSON so a dropped object survives as something `tbd attic show` can
 * print and `restore` can decode; a nullish value archives as the empty string, which is
 * how the field has always been written.
 */
export async function saveConflictToAttic(
  atticDir: string,
  conflict: ConflictEntry,
): Promise<string> {
  const timestamp = now();
  return writeAtticEntryFile(atticDir, {
    entity_id: conflict.issue_id,
    timestamp,
    field: conflict.field,
    lost_value: conflict.lost_value == null ? '' : JSON.stringify(conflict.lost_value),
    winner_source: conflict.winner_source,
    loser_source: conflict.winner_source === 'local' ? 'remote' : 'local',
    context: {
      local_version: conflict.local_version,
      remote_version: conflict.remote_version,
      local_updated_at: timestamp,
      remote_updated_at: timestamp,
    },
  });
}
