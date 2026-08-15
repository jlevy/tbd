/**
 * ID mapping management for short public IDs.
 *
 * Maps 4-char base36 short IDs to 26-char ULIDs.
 * Stored in .tbd/data-sync/mappings/ids.yml
 *
 * See: tbd-design.md §2.5 ID Generation
 */

import { readFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { writeFile } from 'atomically';

import {
  parseYamlToleratingDuplicateKeys,
  detectDuplicateYamlKeys,
  stringifyYaml,
  hasMergeConflictMarkers,
} from '../utils/yaml-utils.js';
import { withLockfile } from '../utils/lockfile.js';

import {
  generateShortId,
  extractUlidFromInternalId,
  makeInternalId,
  isInternalId,
  extractShortId,
  asInternalId,
  type InternalIssueId,
} from '../lib/ids.js';
import { naturalSort } from '../lib/sort.js';
import { IdMappingYamlSchema } from '../lib/schemas.js';

/**
 * ID mapping from short ID to ULID.
 * Format in ids.yml:
 *   a7k2: 01hx5zzkbkactav9wevgemmvrz
 *   b3m9: 01hx5zzkbkbctav9wevgemmvrz
 */
export interface IdMapping {
  shortToUlid: Map<string, string>;
  ulidToShort: Map<string, string>;
}

/**
 * Get the path to the ids.yml mapping file.
 */
function getMappingPath(baseDir: string): string {
  return join(baseDir, 'mappings', 'ids.yml');
}

function serializeIdMapping(mapping: IdMapping): string {
  const data: Record<string, string> = {};
  const sortedKeys = naturalSort(Array.from(mapping.shortToUlid.keys()));
  for (const key of sortedKeys) {
    data[key] = mapping.shortToUlid.get(key)!;
  }
  return stringifyYaml(data);
}

/**
 * Parse all key-value entries from raw ids.yml content, preserving every
 * occurrence of duplicate keys. The YAML parser's `uniqueKeys: false` mode
 * silently drops all but the last value for each key; this line-level parser
 * captures every entry so that duplicate-key repair can see all competing ULIDs.
 *
 * Only matches top-level `shortId: ulid` lines; comments and blank lines are
 * skipped. This is safe because ids.yml is a flat key-value map.
 */
export function parseAllIdEntries(content: string): { shortId: string; ulid: string }[] {
  const entries: { shortId: string; ulid: string }[] = [];
  for (const line of content.split('\n')) {
    // Match lines like "a7k2: 01hx5zzkbkactav9wevgemmvrz"
    // ShortId allows [0-9a-z._-]+, Ulid is exactly 26 [0-9a-z] chars
    const match = /^([0-9a-z._-]+):\s+([0-9a-z]{26})\s*$/.exec(line);
    if (match) {
      entries.push({ shortId: match[1]!, ulid: match[2]! });
    }
  }
  return entries;
}

/**
 * Derive a deterministic short ID from a ULID by extracting character windows.
 *
 * Tries successive non-overlapping 4-char windows from the end of the ULID,
 * then overlapping single-offset windows, then 5-char windows as a last resort.
 * The derivation is a pure function of the ULID and the set of already-used
 * short IDs, so two clones repairing the same file independently will compute
 * the same replacement — no randomness involved.
 */
export function deriveShortIdFromUlid(ulid: string, usedShortIds: Set<string>, length = 4): string {
  // Try non-overlapping windows from the end: [22:26], [18:22], [14:18], ...
  for (let offset = ulid.length - length; offset >= 0; offset -= length) {
    const candidate = ulid.slice(offset, offset + length);
    if (!usedShortIds.has(candidate)) {
      return candidate;
    }
  }

  // Try every single-offset window from the end
  for (let offset = ulid.length - length; offset >= 0; offset--) {
    const candidate = ulid.slice(offset, offset + length);
    if (!usedShortIds.has(candidate)) {
      return candidate;
    }
  }

  // Last resort: try 5-char windows (longer ID)
  const longerLength = length + 1;
  for (let offset = ulid.length - longerLength; offset >= 0; offset--) {
    const candidate = ulid.slice(offset, offset + longerLength);
    if (!usedShortIds.has(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    `Cannot derive a unique short ID from ULID ${ulid}. ` +
      `This should be extremely rare — please report this error.`,
  );
}

/**
 * Resolve duplicate short IDs that map to different ULIDs.
 *
 * When `merge=union` combines two clones' ids.yml files that independently
 * allocated the same short ID for different beads, the merged file contains
 * the same key twice with different values. This function deterministically
 * resolves the conflict:
 *
 * 1. For each contested short ID, the lexicographically smallest ULID keeps it
 *    (ULIDs are time-ordered, so the earlier-created bead wins).
 * 2. Each displaced ULID receives a new short ID derived from its own characters
 *    via `deriveShortIdFromUlid` — no randomness, so every clone that sees the
 *    same merged file computes the same repair.
 * 3. Duplicate keys are processed in sorted order for full determinism.
 *
 * @param allEntries - Every key-value pair from the raw file, in file order
 * @param duplicateKeys - The set of short IDs that appear more than once
 * @returns A resolved IdMapping where every ULID is addressable
 */
export function resolveDuplicateShortIds(
  allEntries: { shortId: string; ulid: string }[],
  duplicateKeys: string[],
): IdMapping {
  // Collect all ULIDs for each duplicate short ID
  const duplicateUlids = new Map<string, Set<string>>();
  for (const key of duplicateKeys) {
    duplicateUlids.set(key, new Set());
  }
  for (const { shortId, ulid } of allEntries) {
    const set = duplicateUlids.get(shortId);
    if (set) {
      set.add(ulid);
    }
  }

  // Build the base mapping from all unique entries (non-duplicated keys).
  // For duplicated keys, only the winner (smallest ULID) gets the original short ID.
  const shortToUlid = new Map<string, string>();
  const ulidToShort = new Map<string, string>();
  const usedShortIds = new Set<string>();

  // First pass: add all non-duplicate entries
  const seenShortIds = new Set<string>();
  for (const { shortId, ulid } of allEntries) {
    if (duplicateUlids.has(shortId)) {
      continue; // Handle duplicates separately below
    }
    if (!seenShortIds.has(shortId)) {
      shortToUlid.set(shortId, ulid);
      ulidToShort.set(ulid, shortId);
      usedShortIds.add(shortId);
      seenShortIds.add(shortId);
    }
  }

  // Second pass: resolve each duplicate key deterministically.
  // Process duplicate keys in sorted order for cross-clone determinism.
  const sortedDuplicateKeys = [...duplicateKeys].sort();
  const displacedUlids: { ulid: string; originalShortId: string }[] = [];

  for (const shortId of sortedDuplicateKeys) {
    const ulids = duplicateUlids.get(shortId)!;

    if (ulids.size <= 1) {
      // Same ULID repeated (harmless duplicate); just keep one copy
      const ulid = ulids.values().next().value!;
      shortToUlid.set(shortId, ulid);
      ulidToShort.set(ulid, shortId);
      usedShortIds.add(shortId);
      continue;
    }

    // Multiple different ULIDs: smallest ULID keeps the short ID
    const sorted = [...ulids].sort();
    const winner = sorted[0]!;
    shortToUlid.set(shortId, winner);
    ulidToShort.set(winner, shortId);
    usedShortIds.add(shortId);

    // Collect displaced ULIDs for re-allocation
    for (let i = 1; i < sorted.length; i++) {
      displacedUlids.push({ ulid: sorted[i]!, originalShortId: shortId });
    }
  }

  // Third pass: assign deterministic replacement short IDs to displaced ULIDs.
  // Process in sorted order by ULID for determinism.
  displacedUlids.sort((a, b) => (a.ulid < b.ulid ? -1 : a.ulid > b.ulid ? 1 : 0));

  for (const { ulid } of displacedUlids) {
    const newShortId = deriveShortIdFromUlid(ulid, usedShortIds);
    shortToUlid.set(newShortId, ulid);
    ulidToShort.set(ulid, newShortId);
    usedShortIds.add(newShortId);
  }

  return { shortToUlid, ulidToShort };
}

/**
 * Load the ID mapping from disk.
 * Returns empty mapping if file doesn't exist.
 *
 * When the file contains duplicate short IDs (from a `merge=union` merge where
 * two clones independently allocated the same short ID for different beads),
 * the duplicates are resolved deterministically at load time so that every ULID
 * remains addressable. The file is corrected on the next save.
 */
export async function loadIdMapping(baseDir: string): Promise<IdMapping> {
  const filePath = getMappingPath(baseDir);

  let content: string;
  try {
    content = await readFile(filePath, 'utf-8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
    // An absent mapping is normal before the first issue is created. Any other
    // read failure must remain visible; treating EACCES/EIO/EISDIR as an empty
    // mapping can publish or write fabricated fallback display IDs.
    return {
      shortToUlid: new Map(),
      ulidToShort: new Map(),
    };
  }

  // Detect duplicate keys from the raw content before YAML parsing.
  const duplicateKeys = detectDuplicateYamlKeys(content);

  if (duplicateKeys.length > 0) {
    // Parse all entries from raw content (preserving every duplicate) and
    // resolve deterministically so no ULID loses its mapping.
    const allEntries = parseAllIdEntries(content);
    const mapping = resolveDuplicateShortIds(allEntries, duplicateKeys);

    console.warn(
      `Warning: ${filePath} contains ${duplicateKeys.length} duplicate key(s): ${duplicateKeys.join(', ')}. ` +
        `This usually happens after a union merge of two clones. ` +
        `Displaced entries have been assigned deterministic replacement short IDs. ` +
        `The file will be auto-fixed on next save.`,
    );

    return mapping;
  }

  // No duplicates: standard YAML parse path
  const { data: rawData } = parseYamlToleratingDuplicateKeys(content, filePath);
  const data = rawData ?? {};

  // Validate with Zod schema - ensures all keys are valid short IDs and values are ULIDs
  const parseResult = IdMappingYamlSchema.safeParse(data);
  if (!parseResult.success) {
    throw new Error(`Invalid ID mapping format in ${filePath}: ${parseResult.error.message}`);
  }
  const validData = parseResult.data;

  const shortToUlid = new Map<string, string>();
  const ulidToShort = new Map<string, string>();

  for (const [shortId, ulid] of Object.entries(validData)) {
    shortToUlid.set(shortId, ulid);
    ulidToShort.set(ulid, shortId);
  }

  return { shortToUlid, ulidToShort };
}

/**
 * Save the ID mapping to disk with mutual exclusion.
 *
 * Uses a lockfile to serialize concurrent writers, then performs read-merge-write
 * inside the lock. This prevents the lost-update problem when multiple `tbd create`
 * commands run in parallel.
 *
 * The merge is safe because ID mappings are append-only; entries are never
 * intentionally removed. If the lock cannot be acquired within the timeout,
 * a LockAcquisitionError is thrown rather than proceeding without protection.
 */
export async function saveIdMapping(baseDir: string, mapping: IdMapping): Promise<void> {
  const filePath = getMappingPath(baseDir);

  // Ensure directory exists
  await mkdir(dirname(filePath), { recursive: true });

  await withLockfile(filePath + '.lock', async () => {
    // Inside the lock: read current on-disk state, merge with our in-memory
    // mapping, and write the result. Our entries take precedence for short ID
    // conflicts (extremely unlikely with random 4-char base36 IDs).
    let merged = mapping;
    let onDiskSize = 0;
    try {
      const onDisk = await loadIdMappingRaw(filePath);
      onDiskSize = onDisk.shortToUlid.size;
      if (onDiskSize > 0) {
        merged = mergeIdMappings(mapping, onDisk);
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
      // No mapping has been written yet; start from the caller's mapping.
    }

    // Safety check: ID mappings are append-only. If the merged result has fewer
    // entries than what's on disk, something went wrong. Refuse to write so the
    // caller can investigate rather than silently destroying entries.
    if (merged.shortToUlid.size < onDiskSize) {
      throw new Error(
        `Refusing to save ID mapping: would lose ${onDiskSize - merged.shortToUlid.size} entries ` +
          `(on-disk: ${onDiskSize}, proposed: ${merged.shortToUlid.size}). ` +
          `ID mappings are append-only; this indicates a bug.`,
      );
    }

    await writeFile(filePath, serializeIdMapping(merged));
  });
}

/**
 * Replace an invalid mapping after a caller has explicitly recovered its full content.
 *
 * This is intentionally separate from `saveIdMapping`: ordinary saves must read and
 * merge the append-only file or fail, never treat corruption as absence. Recovery
 * callers first parse both conflict sides while holding the repository writer lock;
 * this inner mapping lock then prevents a legacy low-level writer from racing the
 * canonical replacement.
 */
export async function replaceRecoveredIdMapping(
  baseDir: string,
  recovered: IdMapping,
): Promise<void> {
  const filePath = getMappingPath(baseDir);
  await mkdir(dirname(filePath), { recursive: true });
  await withLockfile(filePath + '.lock', () => writeFile(filePath, serializeIdMapping(recovered)));
}

/**
 * Load an ID mapping directly from a file path (internal helper for save merging).
 * Separated from loadIdMapping to avoid coupling the save path to baseDir resolution.
 */
async function loadIdMappingRaw(filePath: string): Promise<IdMapping> {
  const content = await readFile(filePath, 'utf-8');

  const { data: rawData } = parseYamlToleratingDuplicateKeys(content, filePath);
  const data = rawData ?? {};

  const parseResult = IdMappingYamlSchema.safeParse(data);
  if (!parseResult.success) {
    throw new Error(`Invalid ID mapping format in ${filePath}: ${parseResult.error.message}`);
  }
  const validData = parseResult.data;

  const shortToUlid = new Map<string, string>();
  const ulidToShort = new Map<string, string>();

  for (const [shortId, ulid] of Object.entries(validData)) {
    shortToUlid.set(shortId, ulid);
    ulidToShort.set(ulid, shortId);
  }

  return { shortToUlid, ulidToShort };
}

/**
 * Calculate the optimal short ID length based on existing ID count.
 *
 * At 50K issues, switches from 4-char to 5-char IDs to keep
 * collision probability low (~3% per attempt with 4 chars at 50K).
 *
 * With 10 retries per length, actual failure probability is astronomically low.
 */
export function calculateOptimalLength(existingCount: number): number {
  return existingCount < 50_000 ? 4 : 5;
}

/**
 * Generate a unique short ID that doesn't collide with existing ones.
 *
 * Calculates optimal length (4 or 5 chars) based on existing ID count,
 * then retries with the next length if collisions occur.
 *
 * @returns The new short ID
 * @throws If unable to generate a unique ID after max attempts
 */
export function generateUniqueShortId(mapping: IdMapping): string {
  const ATTEMPTS_PER_LENGTH = 10;
  const existingCount = mapping.shortToUlid.size;
  const optimalLength = calculateOptimalLength(existingCount);

  // Try optimal length first, then fall back to longer if needed
  for (const length of [optimalLength, optimalLength + 1]) {
    for (let attempt = 0; attempt < ATTEMPTS_PER_LENGTH; attempt++) {
      const shortId = generateShortId(length);
      if (!mapping.shortToUlid.has(shortId)) {
        return shortId;
      }
    }
  }

  throw new Error(
    `Failed to generate unique short ID after 20 attempts with ${existingCount} existing IDs. ` +
      `This should be extremely rare - please report if you see this error.`,
  );
}

/**
 * Register a new ID mapping.
 * @param ulid - The ULID (without is- prefix)
 * @param shortId - The short ID (4 chars)
 */
export function addIdMapping(mapping: IdMapping, ulid: string, shortId: string): void {
  mapping.shortToUlid.set(shortId, ulid);
  mapping.ulidToShort.set(ulid, shortId);
}

/**
 * Get the short ID for a ULID.
 * @param ulid - The ULID (without is- prefix)
 * @returns The short ID, or undefined if not found
 */
export function getShortId(mapping: IdMapping, ulid: string): string | undefined {
  return mapping.ulidToShort.get(ulid);
}

/**
 * Get the ULID for a short ID.
 * @param shortId - The short ID
 * @returns The ULID (without is- prefix), or undefined if not found
 */
export function getUlid(mapping: IdMapping, shortId: string): string | undefined {
  return mapping.shortToUlid.get(shortId);
}

/**
 * Check if a short ID exists in the mapping.
 */
export function hasShortId(mapping: IdMapping, shortId: string): boolean {
  return mapping.shortToUlid.has(shortId);
}

/**
 * Create a short ID mapping for a new internal ID.
 * Generates a unique short ID and registers it in the mapping.
 *
 * @param internalId - The internal ID (is-{ulid})
 * @param mapping - The ID mapping to update
 * @returns The generated short ID
 */
export function createShortIdMapping(internalId: string, mapping: IdMapping): string {
  // Extract ULID from internal ID (remove prefix)
  const ulid = extractUlidFromInternalId(internalId);

  // Check if already mapped
  const existing = mapping.ulidToShort.get(ulid);
  if (existing) {
    return existing;
  }

  // Generate unique short ID
  const shortId = generateUniqueShortId(mapping);

  // Register mapping
  addIdMapping(mapping, ulid, shortId);

  return shortId;
}

/**
 * Resolve any ID input to an internal ID ({prefix}-{ulid}).
 *
 * Handles:
 * - Internal IDs: {prefix}-{ulid} -> {prefix}-{ulid}
 * - Short IDs: a7k2 -> {prefix}-{ulid from mapping}
 * - Prefixed short IDs: bd-a7k2 -> {prefix}-{ulid from mapping}
 *
 * @param input - The ID input (short ID, prefixed short ID, or internal ID)
 * @param mapping - The ID mapping for short ID resolution
 * @returns The internal ID ({prefix}-{ulid})
 * @throws If the short ID is not found in the mapping
 */
export function resolveToInternalId(input: string, mapping: IdMapping): InternalIssueId {
  const lower = input.toLowerCase();

  // If it's already an internal ID, return it
  if (isInternalId(lower)) {
    return asInternalId(lower);
  }

  // Imported short IDs may themselves contain a hyphen. Prefer an exact
  // mapping before interpreting the leading segment as a display prefix.
  const exactUlid = mapping.shortToUlid.get(lower);
  if (exactUlid) {
    return makeInternalId(exactUlid);
  }

  // Extract the short ID portion (strips any prefix like "bd-" or "is-")
  const shortId = extractShortId(lower);

  // If it's a full ULID (26 chars), it might be a bare internal ID
  if (shortId.length === 26 && /^[0-9a-z]{26}$/.test(shortId)) {
    return makeInternalId(shortId);
  }

  // Must be a short ID - look it up in the mapping
  const ulid = mapping.shortToUlid.get(shortId);
  if (!ulid) {
    throw new Error(`Unknown issue ID: ${input}. ` + `Short ID "${shortId}" not found in mapping.`);
  }

  return makeInternalId(ulid);
}

/**
 * Parse an ID mapping from raw YAML content.
 * Used for loading mappings from git show output during conflict resolution.
 *
 * When duplicate keys map to different ULIDs (from a union merge), resolves
 * them deterministically so no ULID loses its mapping.
 *
 * @throws MergeConflictError if content contains merge conflict markers
 */
export function parseIdMappingFromYaml(content: string): IdMapping {
  // Detect duplicates from raw content first
  const duplicateKeys = detectDuplicateYamlKeys(content);

  if (duplicateKeys.length > 0) {
    console.warn(
      `Warning: ID mapping YAML contains ${duplicateKeys.length} duplicate key(s): ${duplicateKeys.join(', ')}. ` +
        `Duplicates will be auto-resolved.`,
    );

    // Parse all entries preserving duplicates, then resolve deterministically
    const allEntries = parseAllIdEntries(content);
    return resolveDuplicateShortIds(allEntries, duplicateKeys);
  }

  // No duplicates: standard parse path
  const { data: rawData } = parseYamlToleratingDuplicateKeys(content);
  const data = rawData ?? {};

  // Validate with Zod schema
  const parseResult = IdMappingYamlSchema.safeParse(data);
  if (!parseResult.success) {
    throw new Error(`Invalid ID mapping format: ${parseResult.error.message}`);
  }
  const validData = parseResult.data;

  const shortToUlid = new Map<string, string>();
  const ulidToShort = new Map<string, string>();

  for (const [shortId, ulid] of Object.entries(validData)) {
    shortToUlid.set(shortId, ulid);
    ulidToShort.set(ulid, shortId);
  }

  return { shortToUlid, ulidToShort };
}

/**
 * Ensure all given internal IDs have short ID mappings.
 * Creates missing mappings for any IDs without entries.
 *
 * This repairs state after git merges that may add issue files
 * without corresponding mapping entries (e.g., when outbox issues
 * are merged from a feature branch but ids.yml doesn't include them).
 *
 * When a `historicalMapping` is provided, the function will try to recover
 * the original short ID from that mapping before generating a new random one.
 * This preserves ID stability so that existing references (in docs, PRs,
 * conversations) remain valid.
 *
 * @param internalIds - Array of internal IDs (is-{ulid}) to reconcile
 * @param mapping - The ID mapping to update (mutated in-place)
 * @param historicalMapping - Optional mapping from prior state (e.g., git history) to recover original short IDs
 * @returns Object with `created` (IDs that got new random short IDs) and `recovered` (IDs restored from history)
 */
export function reconcileMappings(
  internalIds: string[],
  mapping: IdMapping,
  historicalMapping?: IdMapping,
): { created: string[]; recovered: string[] } {
  const created: string[] = [];
  const recovered: string[] = [];

  for (const id of internalIds) {
    const ulid = extractUlidFromInternalId(id);
    if (mapping.ulidToShort.has(ulid)) {
      continue; // Already has a mapping
    }

    // Try to recover original short ID from historical mapping
    const historicalShortId = historicalMapping?.ulidToShort.get(ulid);
    if (historicalShortId && !mapping.shortToUlid.has(historicalShortId)) {
      // Recovered: restore the original short ID
      addIdMapping(mapping, ulid, historicalShortId);
      recovered.push(id);
    } else {
      // No history available or short ID conflicts; generate new random one
      createShortIdMapping(id, mapping);
      created.push(id);
    }
  }

  return { created, recovered };
}

/**
 * Merge two ID mappings by combining all entries from both.
 * ID mappings are always additive (new IDs are only added, never removed),
 * so merging simply unions all key-value pairs.
 *
 * If the same short ID maps to different ULIDs in each mapping (a conflict),
 * the local mapping takes precedence (caller should log a warning).
 *
 * @param local - The local ID mapping
 * @param remote - The remote ID mapping
 * @returns Merged mapping with all entries from both
 */
export function mergeIdMappings(local: IdMapping, remote: IdMapping): IdMapping {
  const merged: IdMapping = {
    shortToUlid: new Map(local.shortToUlid),
    ulidToShort: new Map(local.ulidToShort),
  };

  // Add all remote entries that don't conflict
  for (const [shortId, ulid] of remote.shortToUlid) {
    if (!merged.shortToUlid.has(shortId)) {
      merged.shortToUlid.set(shortId, ulid);
      merged.ulidToShort.set(ulid, shortId);
    }
    // If shortId already exists with different ulid, keep local (conflict resolution)
  }

  // Also check for ULIDs that exist in remote but not in local
  // (different short ID for same ULID - shouldn't happen but handle gracefully)
  for (const [ulid, shortId] of remote.ulidToShort) {
    if (!merged.ulidToShort.has(ulid) && !merged.shortToUlid.has(shortId)) {
      merged.shortToUlid.set(shortId, ulid);
      merged.ulidToShort.set(ulid, shortId);
    }
  }

  return merged;
}

/**
 * Resolve merge conflicts in ids.yml content by extracting both sides and merging.
 *
 * ids.yml is a sorted key-value YAML map where entries are append-only.
 * The most common merge conflict is both sides adding non-overlapping keys,
 * which is trivially auto-resolvable by keeping all entries from both sides.
 *
 * @param content - Raw file content that may contain git merge conflict markers
 * @returns Merged IdMapping with entries from both sides
 */
export function resolveIdMappingConflicts(content: string): IdMapping {
  if (!hasMergeConflictMarkers(content)) {
    return parseIdMappingFromYaml(content);
  }

  const lines = content.split('\n');
  const oursLines: string[] = [];
  const theirsLines: string[] = [];
  let inConflict: 'none' | 'ours' | 'theirs' = 'none';

  for (const line of lines) {
    if (line.startsWith('<<<<<<< ')) {
      inConflict = 'ours';
      continue;
    }
    if (line === '=======' && inConflict === 'ours') {
      inConflict = 'theirs';
      continue;
    }
    if (line.startsWith('>>>>>>> ') && inConflict === 'theirs') {
      inConflict = 'none';
      continue;
    }

    if (inConflict === 'none') {
      oursLines.push(line);
      theirsLines.push(line);
    } else if (inConflict === 'ours') {
      oursLines.push(line);
    } else {
      theirsLines.push(line);
    }
  }

  const oursMapping = parseIdMappingFromYaml(oursLines.join('\n'));
  const theirsMapping = parseIdMappingFromYaml(theirsLines.join('\n'));

  return mergeIdMappings(oursMapping, theirsMapping);
}
