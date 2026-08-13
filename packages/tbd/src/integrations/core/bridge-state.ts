/**
 * Bridge state: one record per link, on the sync branch.
 *
 * The bead carries identity (`extensions.<provider>`); the bridge record
 * carries dynamics — the base tuple that makes reconciliation three-way, the
 * provider's `updatedAt` watermark, and the link's lifecycle state. Records
 * live one-per-file under `bridge/<provider>/links/<bead-id>.yml` so that
 * concurrent syncs from different machines meet in a git merge at file
 * granularity, resolved by the newest-observation rule in `file/git.ts`.
 *
 * Scalars are stored verbatim; the description is stored only as a normalized
 * hash. Change detection needs equality, not content, and bridge records are
 * committed to git, where tracker prose does not belong.
 */

import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';

import { writeFile } from 'atomically';

import { LinkRecordSchema } from '../../lib/schemas.js';
import type { LinkRecord, ProviderNameType } from '../../lib/types.js';
import { parseYamlWithConflictDetection, stringifyYaml } from '../../utils/yaml-utils.js';
import { stripManagedBlock } from './managed-block.js';

/** Directory holding one record per link for a provider. */
export function bridgeLinksDir(dataSyncDir: string, provider: ProviderNameType): string {
  return join(dataSyncDir, 'bridge', provider, 'links');
}

/** Directory holding write-ahead intent files for a provider. */
export function bridgeIntentsDir(dataSyncDir: string, provider: ProviderNameType): string {
  return join(dataSyncDir, 'bridge', provider, 'intents');
}

function recordPath(dataSyncDir: string, provider: ProviderNameType, beadId: string): string {
  return join(bridgeLinksDir(dataSyncDir, provider), `${beadId}.yml`);
}

/**
 * Normalize a description for comparison: strip tbd's managed block (our own
 * splice must never read as a remote edit), normalize line endings, drop
 * trailing whitespace per line, and trim. Linear round-trips markdown with
 * exactly these kinds of cosmetic differences.
 */
export function normalizeDescription(text: string | null | undefined): string {
  const stripped = stripManagedBlock(text ?? '');
  return (
    stripped
      .replace(/\r\n/g, '\n')
      .split('\n')
      .map((line) =>
        line
          .replace(/[ \t]+$/, '')
          // Linear rewrites list bullets (`- item` comes back `* item`), which
          // is rendering-identical markdown. Normalize the marker so bullet
          // style never reads as a content change — observed live: without
          // this, every bead body with a dash list ping-ponged through sync.
          .replace(/^(\s*)[*+-] /, '$1- '),
      )
      .join('\n')
      // Blank-line runs are also reflowed by the tracker; more than one blank
      // line is rendering-identical to one.
      .replace(/\n{3,}/g, '\n\n')
      // The tracker turns tight lists loose: it inserts a blank line between a
      // paragraph and a following list item — bulleted or ordered. Rendering-
      // identical, so blank lines directly before a list item are cosmetic.
      .replace(/\n+(?=\n(?:- |\d+[.)] ))/g, '')
      // The tracker auto-linkifies bare URLs: `https://x` comes back as
      // `[https://x](<https://x>)`. A link whose label IS its target is the
      // same link; unwrap it (angle-bracketed or not) before hashing.
      .replace(/\[([^\]\s]+)\]\(<\1>\)/g, '$1')
      .replace(/\[([^\]\s]+)\]\(\1\)/g, '$1')
      // Bare domains get a scheme added on top: `skills.sh` comes back as
      // `[skills.sh](<http://skills.sh>)`. Same unwrap, scheme-tolerant.
      .replace(/\[([^\]\s]+)\]\(<https?:\/\/\1\/?>\)/g, '$1')
      .replace(/\[([^\]\s]+)\]\(https?:\/\/\1\/?\)/g, '$1')
      .trim()
  );
}

/**
 * The hash format version. Bumped when {@link normalizeDescription} changes:
 * a base hash from an older algorithm matches neither side and would fake a
 * both-changed conflict, so consumers treat stale-prefixed hashes as "no
 * recorded base" for the description field instead.
 */
export const DESCRIPTION_HASH_PREFIX = 'sha256v6:';

/** Hash of the normalized description; equal hashes mean "unchanged". */
export function descriptionHash(text: string | null | undefined): string {
  return `${DESCRIPTION_HASH_PREFIX}${createHash('sha256').update(normalizeDescription(text)).digest('hex')}`;
}

/**
 * Read one link's record. Missing or malformed reads as undefined — a
 * hand-edited or foreign-written record must not crash a sync run; the pair
 * simply reconciles as if newly linked.
 */
export async function readLinkRecord(
  dataSyncDir: string,
  provider: ProviderNameType,
  beadId: string,
): Promise<LinkRecord | undefined> {
  let content: string;
  try {
    content = await readFile(recordPath(dataSyncDir, provider, beadId), 'utf8');
  } catch {
    return undefined;
  }
  try {
    const parsed = LinkRecordSchema.safeParse(parseYamlWithConflictDetection(content));
    return parsed.success ? parsed.data : undefined;
  } catch {
    // Unparseable yaml — including leftover git conflict markers — reads as
    // "no record" rather than crashing the run.
    return undefined;
  }
}

/** Write (or overwrite) one link's record. */
export async function writeLinkRecord(
  dataSyncDir: string,
  provider: ProviderNameType,
  record: LinkRecord,
): Promise<void> {
  const dir = bridgeLinksDir(dataSyncDir, provider);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, `${record.bead_id}.yml`), stringifyYaml(record));
}

/** Remove one link's record (unlink). Missing is fine — the goal is absence. */
export async function deleteLinkRecord(
  dataSyncDir: string,
  provider: ProviderNameType,
  beadId: string,
): Promise<void> {
  await rm(recordPath(dataSyncDir, provider, beadId), { force: true });
}

/**
 * Every valid record for a provider. Malformed files are skipped, not fatal.
 */
export async function listLinkRecords(
  dataSyncDir: string,
  provider: ProviderNameType,
): Promise<LinkRecord[]> {
  let files: string[];
  try {
    files = await readdir(bridgeLinksDir(dataSyncDir, provider));
  } catch {
    return [];
  }
  const records: LinkRecord[] = [];
  for (const file of files.filter((name) => name.endsWith('.yml')).sort()) {
    const beadId = file.slice(0, -'.yml'.length);
    const record = await readLinkRecord(dataSyncDir, provider, beadId);
    if (record) {
      records.push(record);
    }
  }
  return records;
}

/**
 * Reverse index: external id → record. The one-source guard reads this to
 * refuse linking two beads to the same external item.
 */
export function byExternalId(records: readonly LinkRecord[]): Map<string, LinkRecord> {
  const index = new Map<string, LinkRecord>();
  for (const record of records) {
    index.set(record.external_id, record);
  }
  return index;
}

/**
 * The derived pull watermark: the newest `remote_updated_at` across records,
 * or undefined with no links. Callers subtract a generous overlap — over-
 * fetching is free because base comparison discards no-ops.
 */
export function pullWatermark(records: readonly LinkRecord[]): string | undefined {
  let max: string | undefined;
  for (const record of records) {
    if (max === undefined || record.remote_updated_at > max) {
      max = record.remote_updated_at;
    }
  }
  return max;
}
