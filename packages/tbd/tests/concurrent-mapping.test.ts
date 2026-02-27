/**
 * Tests for concurrent ID mapping operations.
 *
 * Validates that saveIdMapping's lockfile-based mutual exclusion and
 * read-merge-write prevents data loss when multiple processes write
 * to ids.yml concurrently.
 *
 * See: Bug report "tbd missing short ID mapping after concurrent create"
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  loadIdMapping,
  saveIdMapping,
  addIdMapping,
  generateUniqueShortId,
  type IdMapping,
} from '../src/file/id-mapping.js';
import { TEST_ULIDS } from './test-helpers.js';

function emptyMapping(): IdMapping {
  return {
    shortToUlid: new Map(),
    ulidToShort: new Map(),
  };
}

describe('saveIdMapping concurrent safety', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'tbd-concurrent-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('preserves entries from concurrent writers', async () => {
    // Simulate the race: two "processes" load the same empty mapping,
    // each adds its own entry, then both save.
    // Without the lock + merge, the second save would overwrite the first.

    // Process A loads mapping (empty)
    const mappingA = await loadIdMapping(tempDir);
    // Process B loads mapping (same empty state)
    const mappingB = await loadIdMapping(tempDir);

    // Process A adds its entry and saves
    addIdMapping(mappingA, TEST_ULIDS.CONCURRENT_1, 'aa01');
    await saveIdMapping(tempDir, mappingA);

    // Process B adds its entry and saves (would have overwritten A without merge)
    addIdMapping(mappingB, TEST_ULIDS.CONCURRENT_2, 'bb02');
    await saveIdMapping(tempDir, mappingB);

    // Verify both entries survived
    const result = await loadIdMapping(tempDir);
    expect(result.shortToUlid.get('aa01')).toBe(TEST_ULIDS.CONCURRENT_1);
    expect(result.shortToUlid.get('bb02')).toBe(TEST_ULIDS.CONCURRENT_2);
    expect(result.ulidToShort.get(TEST_ULIDS.CONCURRENT_1)).toBe('aa01');
    expect(result.ulidToShort.get(TEST_ULIDS.CONCURRENT_2)).toBe('bb02');
  });

  it('preserves entries when multiple stale snapshots save sequentially', async () => {
    // Simulate 5 concurrent creates (the reproduction scenario):
    // All load the same snapshot, each adds one entry, then all save.

    const entries: { ulid: string; shortId: string }[] = [
      { ulid: TEST_ULIDS.CONCURRENT_1, shortId: 'cc01' },
      { ulid: TEST_ULIDS.CONCURRENT_2, shortId: 'cc02' },
      { ulid: TEST_ULIDS.CONCURRENT_3, shortId: 'cc03' },
      { ulid: TEST_ULIDS.CONCURRENT_4, shortId: 'cc04' },
      { ulid: TEST_ULIDS.ULID_5, shortId: 'cc05' },
    ];

    // All 5 "processes" load the same empty mapping
    const snapshots = await Promise.all(entries.map(() => loadIdMapping(tempDir)));

    // Each adds its own entry to its stale snapshot
    for (let i = 0; i < entries.length; i++) {
      addIdMapping(snapshots[i]!, entries[i]!.ulid, entries[i]!.shortId);
    }

    // All save sequentially (worst case — each has a stale snapshot)
    for (const snapshot of snapshots) {
      await saveIdMapping(tempDir, snapshot);
    }

    // Verify ALL entries survived
    const result = await loadIdMapping(tempDir);
    for (const entry of entries) {
      expect(result.shortToUlid.get(entry.shortId)).toBe(entry.ulid);
      expect(result.ulidToShort.get(entry.ulid)).toBe(entry.shortId);
    }
    expect(result.shortToUlid.size).toBe(5);
  });

  it('preserves all entries when saves happen concurrently via Promise.all', async () => {
    // With lockfile-based mutual exclusion, even truly concurrent saves
    // are serialized and all entries must survive.
    const entries: { ulid: string; shortId: string }[] = [
      { ulid: TEST_ULIDS.CONCURRENT_1, shortId: 'dd01' },
      { ulid: TEST_ULIDS.CONCURRENT_2, shortId: 'dd02' },
      { ulid: TEST_ULIDS.CONCURRENT_3, shortId: 'dd03' },
    ];

    const snapshots = await Promise.all(entries.map(() => loadIdMapping(tempDir)));

    for (let i = 0; i < entries.length; i++) {
      addIdMapping(snapshots[i]!, entries[i]!.ulid, entries[i]!.shortId);
    }

    // Save all concurrently — the lockfile serializes these
    await Promise.all(snapshots.map((s) => saveIdMapping(tempDir, s)));

    // All entries must survive
    const result = await loadIdMapping(tempDir);
    for (const entry of entries) {
      expect(result.shortToUlid.get(entry.shortId)).toBe(entry.ulid);
      expect(result.ulidToShort.get(entry.ulid)).toBe(entry.shortId);
    }
    expect(result.shortToUlid.size).toBe(3);
  });

  it('does not lose pre-existing entries when saving new ones', async () => {
    // Write initial entries
    const initial = emptyMapping();
    addIdMapping(initial, TEST_ULIDS.CONCURRENT_1, 'ee01');
    addIdMapping(initial, TEST_ULIDS.CONCURRENT_2, 'ee02');
    await saveIdMapping(tempDir, initial);

    // New process loads a stale (empty!) mapping and adds its own entry
    const stale = emptyMapping();
    addIdMapping(stale, TEST_ULIDS.CONCURRENT_3, 'ee03');
    await saveIdMapping(tempDir, stale);

    // Pre-existing entries must still be present
    const result = await loadIdMapping(tempDir);
    expect(result.shortToUlid.get('ee01')).toBe(TEST_ULIDS.CONCURRENT_1);
    expect(result.shortToUlid.get('ee02')).toBe(TEST_ULIDS.CONCURRENT_2);
    expect(result.shortToUlid.get('ee03')).toBe(TEST_ULIDS.CONCURRENT_3);
    expect(result.shortToUlid.size).toBe(3);
  });

  it('handles generateUniqueShortId with stale snapshot', async () => {
    // Process A creates a mapping entry and saves
    const mappingA = await loadIdMapping(tempDir);
    const shortA = generateUniqueShortId(mappingA);
    addIdMapping(mappingA, TEST_ULIDS.CONCURRENT_1, shortA);
    await saveIdMapping(tempDir, mappingA);

    // Process B has a stale snapshot (loaded before A saved)
    const staleB = emptyMapping();
    const shortB = generateUniqueShortId(staleB);
    addIdMapping(staleB, TEST_ULIDS.CONCURRENT_2, shortB);
    await saveIdMapping(tempDir, staleB);

    // Both entries should survive
    const result = await loadIdMapping(tempDir);
    expect(result.ulidToShort.has(TEST_ULIDS.CONCURRENT_1)).toBe(true);
    expect(result.ulidToShort.has(TEST_ULIDS.CONCURRENT_2)).toBe(true);
  });

  it('cleans up lockfile after save', async () => {
    const mapping = emptyMapping();
    addIdMapping(mapping, TEST_ULIDS.CONCURRENT_1, 'ff01');
    await saveIdMapping(tempDir, mapping);

    // Lockfile directory should not remain after successful save
    const { readdir } = await import('node:fs/promises');
    const mappingsDir = join(tempDir, 'mappings');
    const files = await readdir(mappingsDir);
    expect(files.filter((f) => f.includes('.lock'))).toEqual([]);
  });
});
