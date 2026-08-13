/** Canonical persistence for field-conflict attic entries. */

import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

import { writeFile } from 'atomically';

import { ATTIC_ENTRY_FIELD_ORDER, AtticEntrySchema } from '../lib/schemas.js';
import type { AtticEntry } from '../lib/types.js';
import { sortKeys, stringifyYaml } from '../utils/yaml-utils.js';

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
