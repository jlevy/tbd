/** Canonical persistence for field-conflict attic entries. */

import { access, mkdir } from 'node:fs/promises';
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

/**
 * Write one validated attic entry and return its filename.
 *
 * The filename carries the entry's timestamp, and one merge can archive two losses on the
 * same issue and field inside the same millisecond. An archive that silently overwrites an
 * archive is not an archive, so a taken name advances the entry's timestamp by a
 * millisecond until it is free — a millisecond the entries did not literally happen at,
 * which is the smaller lie, and it keeps them in the order they were produced.
 */
export async function writeAtticEntryFile(atticDir: string, entry: AtticEntry): Promise<string> {
  let validEntry = AtticEntrySchema.parse(entry);
  await mkdir(atticDir, { recursive: true });

  let filename = atticEntryFilename(validEntry);
  while (await exists(join(atticDir, filename))) {
    validEntry = {
      ...validEntry,
      timestamp: new Date(new Date(validEntry.timestamp).getTime() + 1).toISOString(),
    };
    filename = atticEntryFilename(validEntry);
  }

  const sorted = sortKeys(
    validEntry as unknown as Record<string, unknown>,
    ATTIC_ENTRY_FIELD_ORDER,
  );
  await writeFile(join(atticDir, filename), stringifyYaml(sorted, { sortMapEntries: false }));
  return filename;
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
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
 * print and `restore` can decode. A nullish loser encodes as `null` rather than the empty
 * string it used to: `decodeAtticTextValue` cannot parse `''` and hands it back verbatim,
 * so restoring an entry for a field that had been CLEARED used to set the field to an
 * empty string instead of clearing it. `null` is also what the restore writer and the
 * integration runner already emit, so all three agree.
 *
 * The entry's own timestamp is the archiving instant, which is what names the file and
 * orders the list. The two context timestamps are the ones the issues carried, because
 * "which side was newer" is most of what someone recovering data needs to know, and
 * recording the archiving instant for both said every conflict happened in a dead heat.
 */
export async function saveConflictToAttic(
  atticDir: string,
  conflict: ConflictEntry,
): Promise<string> {
  return writeAtticEntryFile(atticDir, {
    entity_id: conflict.issue_id,
    timestamp: now(),
    field: conflict.field,
    lost_value: JSON.stringify(conflict.lost_value ?? null),
    winner_source: conflict.winner_source,
    loser_source: conflict.winner_source === 'local' ? 'remote' : 'local',
    context: {
      local_version: conflict.local_version,
      remote_version: conflict.remote_version,
      local_updated_at: conflict.local_updated_at,
      remote_updated_at: conflict.remote_updated_at,
    },
  });
}
