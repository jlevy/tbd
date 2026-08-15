/**
 * Tests for duplicate short ID resolution in ids.yml.
 *
 * When `merge=union` combines two clones' ids.yml files and both clones
 * independently allocated the same short ID for different beads, the merged
 * file contains the same key twice with different ULID values. These tests
 * verify that the repair is deterministic, convergent, and preserves all ULIDs.
 *
 * See: tbd-ysz0 (tracking bead)
 */

import { describe, it, expect, vi } from 'vitest';
import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  loadIdMapping,
  saveIdMapping,
  deriveShortIdFromUlid,
  resolveDuplicateShortIds,
  parseIdMappingFromYaml,
} from '../src/file/id-mapping.js';
import { formatDisplayId } from '../src/lib/ids.js';
import {
  MergeConflictError,
  parseYamlDocumentEntries,
  stringifyYaml,
} from '../src/utils/yaml-utils.js';

// =============================================================================
// parseYamlDocumentEntries — the AST-based primitive
// =============================================================================

describe('parseYamlDocumentEntries', () => {
  it('extracts all entries including duplicates', () => {
    const content = `00wl: 01aaaaaaaaaaaaaaaaaaaaaaaa
00wl: 01bbbbbbbbbbbbbbbbbbbbbbbb
zzzz: 01cccccccccccccccccccccccc`;

    const { entries, duplicateKeys } = parseYamlDocumentEntries(content);
    expect(entries).toHaveLength(3);
    expect(entries[0]).toEqual({ key: '00wl', value: '01aaaaaaaaaaaaaaaaaaaaaaaa' });
    expect(entries[1]).toEqual({ key: '00wl', value: '01bbbbbbbbbbbbbbbbbbbbbbbb' });
    expect(entries[2]).toEqual({ key: 'zzzz', value: '01cccccccccccccccccccccccc' });
    expect(duplicateKeys).toEqual(['00wl']);
  });

  it('handles quoted keys (all-digit short IDs)', () => {
    // stringifyYaml quotes all-digit keys since they look like YAML numbers.
    // This is the shape produced by tbd's own serializer for numeric short IDs.
    const content = `"1234": 01aaaaaaaaaaaaaaaaaaaaaaaa
a1b2: 01bbbbbbbbbbbbbbbbbbbbbbbb
"0000": 01cccccccccccccccccccccccc`;

    const { entries, duplicateKeys } = parseYamlDocumentEntries(content);
    expect(entries).toHaveLength(3);
    expect(entries[0]).toEqual({ key: '1234', value: '01aaaaaaaaaaaaaaaaaaaaaaaa' });
    expect(entries[1]).toEqual({ key: 'a1b2', value: '01bbbbbbbbbbbbbbbbbbbbbbbb' });
    expect(entries[2]).toEqual({ key: '0000', value: '01cccccccccccccccccccccccc' });
    expect(duplicateKeys).toEqual([]);
  });

  it('handles quoted special YAML scalars', () => {
    const content = `"true": 01aaaaaaaaaaaaaaaaaaaaaaaa
"null": 01bbbbbbbbbbbbbbbbbbbbbbbb
"9999": 01cccccccccccccccccccccccc`;

    const { entries } = parseYamlDocumentEntries(content);
    expect(entries).toHaveLength(3);
    expect(entries[0]!.key).toBe('true');
    expect(entries[1]!.key).toBe('null');
    expect(entries[2]!.key).toBe('9999');
  });

  it('handles trailing comments on lines', () => {
    const content = `a1b2: 01aaaaaaaaaaaaaaaaaaaaaaaa # from clone A
c3d4: 01bbbbbbbbbbbbbbbbbbbbbbbb`;

    const { entries } = parseYamlDocumentEntries(content);
    expect(entries).toHaveLength(2);
    // Trailing comment is stripped by the YAML parser
    expect(entries[0]).toEqual({ key: 'a1b2', value: '01aaaaaaaaaaaaaaaaaaaaaaaa' });
    expect(entries[1]).toEqual({ key: 'c3d4', value: '01bbbbbbbbbbbbbbbbbbbbbbbb' });
  });

  it('handles empty content', () => {
    const { entries, duplicateKeys } = parseYamlDocumentEntries('');
    expect(entries).toEqual([]);
    expect(duplicateKeys).toEqual([]);
  });

  it('handles comments-only content', () => {
    const { entries, duplicateKeys } = parseYamlDocumentEntries('# just a comment\n# another\n');
    expect(entries).toEqual([]);
    expect(duplicateKeys).toEqual([]);
  });

  it('handles duplicates with quoted keys', () => {
    const content = `"1234": 01aaaaaaaaaaaaaaaaaaaaaaaa
"1234": 01bbbbbbbbbbbbbbbbbbbbbbbb`;

    const { entries, duplicateKeys } = parseYamlDocumentEntries(content);
    expect(entries).toHaveLength(2);
    expect(entries[0]!.key).toBe('1234');
    expect(entries[1]!.key).toBe('1234');
    expect(duplicateKeys).toEqual(['1234']);
  });

  it('detects duplicates with trailing comments on duplicated lines', () => {
    const content = `a1b2: 01aaaaaaaaaaaaaaaaaaaaaaaa # from clone A
a1b2: 01bbbbbbbbbbbbbbbbbbbbbbbb # from clone B
c3d4: 01cccccccccccccccccccccccc`;

    const { entries, duplicateKeys } = parseYamlDocumentEntries(content);
    expect(entries).toHaveLength(3);
    expect(entries[0]!.value).toBe('01aaaaaaaaaaaaaaaaaaaaaaaa');
    expect(entries[1]!.value).toBe('01bbbbbbbbbbbbbbbbbbbbbbbb');
    expect(duplicateKeys).toEqual(['a1b2']);
  });

  it('handles keys with dots, dashes, and underscores', () => {
    const content = `stat-in_progress: 01aaaaaaaaaaaaaaaaaaaaaaaa
v2.0: 01bbbbbbbbbbbbbbbbbbbbbbbb`;

    const { entries } = parseYamlDocumentEntries(content);
    expect(entries).toHaveLength(2);
    expect(entries[0]!.key).toBe('stat-in_progress');
    expect(entries[1]!.key).toBe('v2.0');
  });
});

// =============================================================================
// deriveShortIdFromUlid
// =============================================================================

describe('deriveShortIdFromUlid', () => {
  it('derives short ID from last 4 chars of ULID', () => {
    const ulid = '01aabbccddeeffffgghhjjkkll';
    const used = new Set<string>();
    const result = deriveShortIdFromUlid(ulid, used);
    expect(result).toBe('kkll'); // last 4 chars
  });

  it('tries earlier windows when last 4 chars collide', () => {
    const ulid = '01aabbccddeeffffgghhjjkkll';
    const used = new Set<string>(['kkll']); // last 4 chars taken
    const result = deriveShortIdFromUlid(ulid, used);
    // Next non-overlapping window: chars 18-21 = "hhjj"
    expect(result).toBe('hhjj');
  });

  it('is deterministic - same input produces same output', () => {
    const ulid = '01aabbccddeeffffgghhjjkkll';
    const used = new Set<string>(['kkll']);
    const result1 = deriveShortIdFromUlid(ulid, used);
    const result2 = deriveShortIdFromUlid(ulid, used);
    expect(result1).toBe(result2);
  });

  it('falls back to overlapping windows', () => {
    const ulid = '01aabbccddeeffffgghhjjkkll';
    // Block all non-overlapping 4-char windows: offsets 22, 18, 14, 10, 6, 2
    const used = new Set<string>(['kkll', 'hhjj', 'ffgg', 'eeff', 'ccdd', 'aabb']);
    const result = deriveShortIdFromUlid(ulid, used);
    expect(result.length).toBe(4);
    expect(used.has(result)).toBe(false);
  });

  it('produces valid base36 short IDs from ULID characters', () => {
    const ulid = '01hx5zzkbkactav9wevgemmvrz';
    const result = deriveShortIdFromUlid(ulid, new Set());
    expect(result).toMatch(/^[0-9a-z]+$/);
    expect(result.length).toBe(4);
  });
});

// =============================================================================
// deriveShortIdFromUlid — escalation tiers under collision pressure
// =============================================================================

describe('deriveShortIdFromUlid escalation tiers', () => {
  // This ULID has all-distinct characters so every 4-char and 5-char window is unique,
  // making it possible to saturate each tier precisely without accidental collisions.
  // Characters are valid Crockford base32 (a strict subset of the base36 ShortId allows).
  const ulid = '0123456789abcdefghjkmnpqrs';

  // Tier 1: non-overlapping windows (offsets 22, 18, 14, 10, 6, 2)
  const tier1Windows = ['pqrs', 'jkmn', 'efgh', 'abcd', '6789', '2345'];

  // Tier 2: all 23 single-offset 4-char windows (offsets 22 down to 0)
  const allFourCharWindows = [
    'pqrs',
    'npqr',
    'mnpq',
    'kmnp',
    'jkmn',
    'hjkm',
    'ghjk',
    'fghj',
    'efgh',
    'defg',
    'cdef',
    'bcde',
    'abcd',
    '9abc',
    '89ab',
    '789a',
    '6789',
    '5678',
    '4567',
    '3456',
    '2345',
    '1234',
    '0123',
  ];

  // Tier 3: all 22 five-char windows (offsets 21 down to 0)
  const allFiveCharWindows = [
    'npqrs',
    'mnpqr',
    'kmnpq',
    'jkmnp',
    'hjkmn',
    'ghjkm',
    'fghjk',
    'efghj',
    'defgh',
    'cdefg',
    'bcdef',
    'abcde',
    '9abcd',
    '89abc',
    '789ab',
    '6789a',
    '56789',
    '45678',
    '34567',
    '23456',
    '12345',
    '01234',
  ];

  it('tier 2: falls through to single-offset window when all non-overlapping windows are taken', () => {
    const used = new Set<string>(tier1Windows);
    const result = deriveShortIdFromUlid(ulid, used);

    // The single-offset loop starts at offset 22 and works down.
    // Offsets 22, 18, 14, 10, 6, 2 are blocked (same as tier 1).
    // First new offset tried is 21 -> 'npqr'.
    expect(result).toBe('npqr');
    expect(result.length).toBe(4);
    expect(result).toMatch(/^[0-9a-z._-]+$/);
  });

  it('tier 3: falls through to 5-char window when all 23 four-char windows are taken', () => {
    const used = new Set<string>(allFourCharWindows);
    const result = deriveShortIdFromUlid(ulid, used);

    // All 4-char windows exhausted, so the function tries 5-char windows
    // starting at offset 21 -> 'npqrs'.
    expect(result).toBe('npqrs');
    expect(result.length).toBe(5);
    expect(result).toMatch(/^[0-9a-z._-]+$/);
  });

  it('throws when every 4-char and 5-char window is taken', () => {
    const used = new Set<string>([...allFourCharWindows, ...allFiveCharWindows]);

    expect(() => deriveShortIdFromUlid(ulid, used)).toThrow(
      `Cannot derive a unique short ID from ULID ${ulid}. ` +
        `This should be extremely rare — please report this error.`,
    );
  });

  it('determinism: identical inputs produce identical output at every tier', () => {
    // Tier 1 (happy path — covered elsewhere but included for completeness)
    const usedTier1 = new Set<string>();
    expect(deriveShortIdFromUlid(ulid, usedTier1)).toBe(deriveShortIdFromUlid(ulid, usedTier1));

    // Tier 2
    const usedTier2 = new Set<string>(tier1Windows);
    expect(deriveShortIdFromUlid(ulid, usedTier2)).toBe(deriveShortIdFromUlid(ulid, usedTier2));

    // Tier 3
    const usedTier3 = new Set<string>(allFourCharWindows);
    expect(deriveShortIdFromUlid(ulid, usedTier3)).toBe(deriveShortIdFromUlid(ulid, usedTier3));
  });

  it('every tier returns a value matching the ShortId pattern', () => {
    const shortIdPattern = /^[0-9a-z._-]+$/;

    // Tier 1
    expect(deriveShortIdFromUlid(ulid, new Set())).toMatch(shortIdPattern);

    // Tier 2
    expect(deriveShortIdFromUlid(ulid, new Set(tier1Windows))).toMatch(shortIdPattern);

    // Tier 3
    expect(deriveShortIdFromUlid(ulid, new Set(allFourCharWindows))).toMatch(shortIdPattern);
  });
});

// =============================================================================
// resolveDuplicateShortIds
// =============================================================================

describe('resolveDuplicateShortIds', () => {
  it('resolves the exact bug report scenario', () => {
    const entries = [
      { shortId: '00wl', ulid: '01aaaaaaaaaaaaaaaaaaaaaaaa' },
      { shortId: '00wl', ulid: '01bbbbbbbbbbbbbbbbbbbbbbbb' },
      { shortId: 'zzzz', ulid: '01cccccccccccccccccccccccc' },
    ];
    const duplicateKeys = ['00wl'];

    const mapping = resolveDuplicateShortIds(entries, duplicateKeys);

    // Both ULIDs must be addressable
    expect(mapping.shortToUlid.size).toBe(3);
    expect(mapping.ulidToShort.size).toBe(3);

    // Smallest ULID keeps the original short ID
    expect(mapping.shortToUlid.get('00wl')).toBe('01aaaaaaaaaaaaaaaaaaaaaaaa');
    expect(mapping.ulidToShort.get('01aaaaaaaaaaaaaaaaaaaaaaaa')).toBe('00wl');

    // Larger ULID gets a deterministic replacement
    expect(mapping.ulidToShort.has('01bbbbbbbbbbbbbbbbbbbbbbbb')).toBe(true);
    const replacementShortId = mapping.ulidToShort.get('01bbbbbbbbbbbbbbbbbbbbbbbb')!;
    expect(replacementShortId).not.toBe('00wl');
    expect(replacementShortId.length).toBeGreaterThanOrEqual(4);

    // Non-duplicate entry unchanged
    expect(mapping.shortToUlid.get('zzzz')).toBe('01cccccccccccccccccccccccc');
  });

  it('handles harmless duplicates (same ULID repeated)', () => {
    const entries = [
      { shortId: 'a1b2', ulid: '01aaaaaaaaaaaaaaaaaaaaaaaa' },
      { shortId: 'a1b2', ulid: '01aaaaaaaaaaaaaaaaaaaaaaaa' },
      { shortId: 'c3d4', ulid: '01bbbbbbbbbbbbbbbbbbbbbbbb' },
    ];
    const duplicateKeys = ['a1b2'];

    const mapping = resolveDuplicateShortIds(entries, duplicateKeys);

    // Only 2 unique entries
    expect(mapping.shortToUlid.size).toBe(2);
    expect(mapping.ulidToShort.size).toBe(2);
    expect(mapping.shortToUlid.get('a1b2')).toBe('01aaaaaaaaaaaaaaaaaaaaaaaa');
  });

  it('handles multiple duplicate keys', () => {
    const entries = [
      { shortId: 'a1b2', ulid: '01aaaaaaaaaaaaaaaaaaaaaaaa' },
      { shortId: 'a1b2', ulid: '01bbbbbbbbbbbbbbbbbbbbbbbb' },
      { shortId: 'c3d4', ulid: '01cccccccccccccccccccccccc' },
      { shortId: 'c3d4', ulid: '01dddddddddddddddddddddddd' },
    ];
    const duplicateKeys = ['a1b2', 'c3d4'];

    const mapping = resolveDuplicateShortIds(entries, duplicateKeys);

    // All 4 ULIDs must be addressable
    expect(mapping.ulidToShort.size).toBe(4);
    expect(mapping.shortToUlid.size).toBe(4);

    // Smallest ULIDs keep their original short IDs
    expect(mapping.shortToUlid.get('a1b2')).toBe('01aaaaaaaaaaaaaaaaaaaaaaaa');
    expect(mapping.shortToUlid.get('c3d4')).toBe('01cccccccccccccccccccccccc');

    // Displaced ULIDs have replacement short IDs
    expect(mapping.ulidToShort.has('01bbbbbbbbbbbbbbbbbbbbbbbb')).toBe(true);
    expect(mapping.ulidToShort.has('01dddddddddddddddddddddddd')).toBe(true);
  });

  it('tiebreak: lexicographically smallest ULID keeps the short ID', () => {
    // Deliberately put the larger ULID first in file order
    const entries = [
      { shortId: 'x9m3', ulid: '01zzzzzzzzzzzzzzzzzzzzzzzz' },
      { shortId: 'x9m3', ulid: '01aaaaaaaaaaaaaaaaaaaaaaaa' },
    ];
    const duplicateKeys = ['x9m3'];

    const mapping = resolveDuplicateShortIds(entries, duplicateKeys);

    // Smaller ULID wins regardless of file order
    expect(mapping.shortToUlid.get('x9m3')).toBe('01aaaaaaaaaaaaaaaaaaaaaaaa');
    expect(mapping.ulidToShort.get('01aaaaaaaaaaaaaaaaaaaaaaaa')).toBe('x9m3');
  });
});

// =============================================================================
// Convergence: two independent repairs produce identical output
// =============================================================================

describe('convergence', () => {
  it('two independent repairs of the same input produce identical mappings', () => {
    const content = `00wl: 01aaaaaaaaaaaaaaaaaaaaaaaa
00wl: 01bbbbbbbbbbbbbbbbbbbbbbbb
zzzz: 01cccccccccccccccccccccccc`;

    // Simulate two clones independently repairing the same file
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const mapping1 = parseIdMappingFromYaml(content);
    const mapping2 = parseIdMappingFromYaml(content);
    warnSpy.mockRestore();

    // Both must produce identical results
    expect([...mapping1.shortToUlid.entries()].sort()).toEqual(
      [...mapping2.shortToUlid.entries()].sort(),
    );
    expect([...mapping1.ulidToShort.entries()].sort()).toEqual(
      [...mapping2.ulidToShort.entries()].sort(),
    );
  });

  it('convergence holds with multiple duplicate keys', () => {
    const content = `a1b2: 01aaaaaaaaaaaaaaaaaaaaaaaa
a1b2: 01bbbbbbbbbbbbbbbbbbbbbbbb
c3d4: 01cccccccccccccccccccccccc
c3d4: 01dddddddddddddddddddddddd
e5f6: 01eeeeeeeeeeeeeeeeeeeeeeee`;

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const mapping1 = parseIdMappingFromYaml(content);
    const mapping2 = parseIdMappingFromYaml(content);
    warnSpy.mockRestore();

    expect([...mapping1.shortToUlid.entries()].sort()).toEqual(
      [...mapping2.shortToUlid.entries()].sort(),
    );
    expect([...mapping1.ulidToShort.entries()].sort()).toEqual(
      [...mapping2.ulidToShort.entries()].sort(),
    );
  });

  it('convergence holds when entries are in different file order', () => {
    // Clone 1 sees entries in one order
    const content1 = `00wl: 01bbbbbbbbbbbbbbbbbbbbbbbb
00wl: 01aaaaaaaaaaaaaaaaaaaaaaaa
zzzz: 01cccccccccccccccccccccccc`;

    // Clone 2 sees entries in reverse order
    const content2 = `00wl: 01aaaaaaaaaaaaaaaaaaaaaaaa
00wl: 01bbbbbbbbbbbbbbbbbbbbbbbb
zzzz: 01cccccccccccccccccccccccc`;

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const mapping1 = parseIdMappingFromYaml(content1);
    const mapping2 = parseIdMappingFromYaml(content2);
    warnSpy.mockRestore();

    // Same result regardless of file order
    expect([...mapping1.shortToUlid.entries()].sort()).toEqual(
      [...mapping2.shortToUlid.entries()].sort(),
    );
  });
});

// =============================================================================
// loadIdMapping integration: the full scenario from the bug report
// =============================================================================

describe('loadIdMapping with duplicate short IDs', () => {
  async function createTempDir(): Promise<string> {
    const baseDir = join(
      tmpdir(),
      `tbd-test-dup-ids-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    await mkdir(join(baseDir, 'mappings'), { recursive: true });
    return baseDir;
  }

  it('exact bug report scenario: both ULIDs stay addressable, neither formatDisplayId throws', async () => {
    const baseDir = await createTempDir();
    const idsYml = `00wl: 01aaaaaaaaaaaaaaaaaaaaaaaa
00wl: 01bbbbbbbbbbbbbbbbbbbbbbbb
zzzz: 01cccccccccccccccccccccccc
`;
    await writeFile(join(baseDir, 'mappings', 'ids.yml'), idsYml);

    const mapping = await loadIdMapping(baseDir);

    // Both ULIDs must be in the mapping
    expect(mapping.ulidToShort.has('01aaaaaaaaaaaaaaaaaaaaaaaa')).toBe(true);
    expect(mapping.ulidToShort.has('01bbbbbbbbbbbbbbbbbbbbbbbb')).toBe(true);
    expect(mapping.ulidToShort.has('01cccccccccccccccccccccccc')).toBe(true);

    // Neither formatDisplayId call should throw
    expect(() => formatDisplayId('is-01aaaaaaaaaaaaaaaaaaaaaaaa', mapping)).not.toThrow();
    expect(() => formatDisplayId('is-01bbbbbbbbbbbbbbbbbbbbbbbb', mapping)).not.toThrow();
    expect(() => formatDisplayId('is-01cccccccccccccccccccccccc', mapping)).not.toThrow();

    // shortToUlid has 3 entries (two for the formerly-duplicate short ID + zzzz)
    expect(mapping.shortToUlid.size).toBe(3);
  });

  it('smallest ULID keeps the contested short ID', async () => {
    const baseDir = await createTempDir();
    const idsYml = `00wl: 01aaaaaaaaaaaaaaaaaaaaaaaa
00wl: 01bbbbbbbbbbbbbbbbbbbbbbbb
`;
    await writeFile(join(baseDir, 'mappings', 'ids.yml'), idsYml);

    const mapping = await loadIdMapping(baseDir);

    // ULID A (smaller) keeps "00wl"
    expect(mapping.ulidToShort.get('01aaaaaaaaaaaaaaaaaaaaaaaa')).toBe('00wl');
    expect(mapping.shortToUlid.get('00wl')).toBe('01aaaaaaaaaaaaaaaaaaaaaaaa');
  });

  it('displaced ULID gets a deterministic replacement derived from its value', async () => {
    const baseDir = await createTempDir();
    const idsYml = `00wl: 01aaaaaaaaaaaaaaaaaaaaaaaa
00wl: 01bbbbbbbbbbbbbbbbbbbbbbbb
`;
    await writeFile(join(baseDir, 'mappings', 'ids.yml'), idsYml);

    const mapping = await loadIdMapping(baseDir);

    const replacementShortId = mapping.ulidToShort.get('01bbbbbbbbbbbbbbbbbbbbbbbb')!;
    expect(replacementShortId).not.toBe('00wl');
    // Derived from the ULID's last 4 chars
    expect(replacementShortId).toBe('bbbb');
  });

  it('emits a warning about duplicate keys', async () => {
    const baseDir = await createTempDir();
    const idsYml = `00wl: 01aaaaaaaaaaaaaaaaaaaaaaaa
00wl: 01bbbbbbbbbbbbbbbbbbbbbbbb
`;
    await writeFile(join(baseDir, 'mappings', 'ids.yml'), idsYml);

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      await loadIdMapping(baseDir);
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('duplicate key(s): 00wl'));
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('deterministic replacement short IDs'),
      );
    } finally {
      warnSpy.mockRestore();
    }
  });
});

// =============================================================================
// Quoted-key bystander test — the test that would have caught R1
// =============================================================================

describe('quoted keys (numeric short IDs) survive duplicate resolution', () => {
  async function createTempDir(): Promise<string> {
    const baseDir = join(
      tmpdir(),
      `tbd-test-quoted-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    await mkdir(join(baseDir, 'mappings'), { recursive: true });
    return baseDir;
  }

  it('bystander with a quoted numeric short ID stays addressable after duplicate repair', async () => {
    // This is the killer scenario: a file written by tbd's own stringifyYaml
    // containing an at-risk short ID ("100", mirroring the real ids.yml which
    // has 274 quoted entries) alongside a duplicate. The bystander must survive.
    const bystander = { shortId: '100', ulid: '01cccccccccccccccccccccccc' };

    // Build the file the way tbd's serializer would write it, then append a
    // duplicate to simulate a union merge.
    const data: Record<string, string> = {
      '100': bystander.ulid,
      a1b2: '01aaaaaaaaaaaaaaaaaaaaaaaa',
    };
    const base = stringifyYaml(data);
    // Append a duplicate of a1b2 (simulating the other clone's allocation)
    const merged = base + 'a1b2: 01bbbbbbbbbbbbbbbbbbbbbbbb\n';

    const baseDir = await createTempDir();
    await writeFile(join(baseDir, 'mappings', 'ids.yml'), merged);

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const mapping = await loadIdMapping(baseDir);
    warnSpy.mockRestore();

    // The bystander must still be addressable
    expect(mapping.ulidToShort.has(bystander.ulid)).toBe(true);
    expect(mapping.ulidToShort.get(bystander.ulid)).toBe(bystander.shortId);
    expect(() => formatDisplayId(`is-${bystander.ulid}`, mapping)).not.toThrow();

    // Both duplicate ULIDs must also be addressable
    expect(mapping.ulidToShort.has('01aaaaaaaaaaaaaaaaaaaaaaaa')).toBe(true);
    expect(mapping.ulidToShort.has('01bbbbbbbbbbbbbbbbbbbbbbbb')).toBe(true);

    // All 3 ULIDs present
    expect(mapping.shortToUlid.size).toBe(3);
  });

  it('parseIdMappingFromYaml handles quoted keys with duplicates', () => {
    // File with a quoted key and a duplicate — the shape that broke with regex parsing
    const content = `"0622": 01cccccccccccccccccccccccc
a1b2: 01aaaaaaaaaaaaaaaaaaaaaaaa
a1b2: 01bbbbbbbbbbbbbbbbbbbbbbbb`;

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const mapping = parseIdMappingFromYaml(content);
    warnSpy.mockRestore();

    expect(mapping.ulidToShort.size).toBe(3);
    expect(mapping.shortToUlid.size).toBe(3);
    expect(mapping.ulidToShort.get('01cccccccccccccccccccccccc')).toBe('0622');
    expect(() => formatDisplayId('is-01cccccccccccccccccccccccc', mapping)).not.toThrow();
  });

  it('loadIdMapping handles a file produced by stringifyYaml with no duplicates', async () => {
    // Verify that the normal (non-duplicate) path also handles quoted keys
    const data: Record<string, string> = {
      '1234': '01aaaaaaaaaaaaaaaaaaaaaaaa',
      '0000': '01bbbbbbbbbbbbbbbbbbbbbbbb',
      wxyz: '01cccccccccccccccccccccccc',
    };
    const content = stringifyYaml(data);

    const baseDir = join(
      tmpdir(),
      `tbd-test-normal-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    await mkdir(join(baseDir, 'mappings'), { recursive: true });
    await writeFile(join(baseDir, 'mappings', 'ids.yml'), content);

    const mapping = await loadIdMapping(baseDir);
    expect(mapping.shortToUlid.size).toBe(3);
    expect(mapping.shortToUlid.get('1234')).toBe('01aaaaaaaaaaaaaaaaaaaaaaaa');
    expect(mapping.shortToUlid.get('0000')).toBe('01bbbbbbbbbbbbbbbbbbbbbbbb');
    expect(mapping.shortToUlid.get('wxyz')).toBe('01cccccccccccccccccccccccc');
  });
});

// =============================================================================
// Trailing comments on duplicated lines (R3 regression test)
// =============================================================================

describe('trailing comments on duplicated lines', () => {
  it('trailing comments do not prevent duplicate detection or value extraction', () => {
    // The old regex parser could not match lines with trailing comments,
    // causing entries to be silently dropped. The AST parser handles them.
    const content = `a1b2: 01aaaaaaaaaaaaaaaaaaaaaaaa # from clone A
a1b2: 01bbbbbbbbbbbbbbbbbbbbbbbb # from clone B
c3d4: 01cccccccccccccccccccccccc`;

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const mapping = parseIdMappingFromYaml(content);
    warnSpy.mockRestore();

    // All 3 ULIDs must be addressable
    expect(mapping.ulidToShort.size).toBe(3);
    expect(mapping.shortToUlid.size).toBe(3);

    // Smallest ULID keeps a1b2
    expect(mapping.shortToUlid.get('a1b2')).toBe('01aaaaaaaaaaaaaaaaaaaaaaaa');
    // Displaced ULID has a replacement
    expect(mapping.ulidToShort.has('01bbbbbbbbbbbbbbbbbbbbbbbb')).toBe(true);
    expect(mapping.ulidToShort.get('01bbbbbbbbbbbbbbbbbbbbbbbb')).not.toBe('a1b2');
    // Bystander unchanged
    expect(mapping.shortToUlid.get('c3d4')).toBe('01cccccccccccccccccccccccc');
  });
});

// =============================================================================
// Simulated two-clone union-merge end-to-end scenario
// =============================================================================

describe('two-clone union merge end-to-end', () => {
  async function createTempDir(): Promise<string> {
    const baseDir = join(
      tmpdir(),
      `tbd-test-merge-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    await mkdir(join(baseDir, 'mappings'), { recursive: true });
    return baseDir;
  }

  it('simulates union merge, loads, repairs, saves, and verifies', async () => {
    // Scenario: Two clones both allocate short ID "x5k9" for different beads.
    // After union merge, ids.yml has both lines.

    // Clone A's ids.yml (before merge):
    //   x5k9: 01hx5zzkbkactav9wevgemmvrz
    //   a1b2: 01hx5zzkbkbctav9wevgemmvrw

    // Clone B's ids.yml (before merge):
    //   x5k9: 01hx5zzkbkcctav9wevgemmvrx
    //   c3d4: 01hx5zzkbkdctav9wevgemmvry

    // After union merge, the file contains:
    const mergedContent = `a1b2: 01hx5zzkbkbctav9wevgemmvrw
c3d4: 01hx5zzkbkdctav9wevgemmvry
x5k9: 01hx5zzkbkactav9wevgemmvrz
x5k9: 01hx5zzkbkcctav9wevgemmvrx
`;

    const baseDir = await createTempDir();
    await writeFile(join(baseDir, 'mappings', 'ids.yml'), mergedContent);

    // Load the mapping (repair happens here)
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const mapping = await loadIdMapping(baseDir);
    warnSpy.mockRestore();

    // All 4 ULIDs must be addressable
    expect(mapping.ulidToShort.size).toBe(4);
    expect(mapping.shortToUlid.size).toBe(4);

    // The smallest ULID keeps "x5k9"
    expect(mapping.shortToUlid.get('x5k9')).toBe('01hx5zzkbkactav9wevgemmvrz');

    // The displaced ULID has a different short ID
    const displacedShortId = mapping.ulidToShort.get('01hx5zzkbkcctav9wevgemmvrx');
    expect(displacedShortId).toBeDefined();
    expect(displacedShortId).not.toBe('x5k9');

    // All formatDisplayId calls succeed
    for (const ulid of mapping.ulidToShort.keys()) {
      expect(() => formatDisplayId(`is-${ulid}`, mapping)).not.toThrow();
    }

    // Save the repaired mapping
    await saveIdMapping(baseDir, mapping);

    // Reload and verify the file is now clean
    const warnSpy2 = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const reloaded = await loadIdMapping(baseDir);
    // No warning should be emitted on reload (duplicates are gone)
    expect(warnSpy2).not.toHaveBeenCalled();
    warnSpy2.mockRestore();

    // Same content after save-and-reload
    expect(reloaded.shortToUlid.size).toBe(mapping.shortToUlid.size);
    for (const [shortId, ulid] of mapping.shortToUlid) {
      expect(reloaded.shortToUlid.get(shortId)).toBe(ulid);
    }
  });

  it('two clones repairing the same merged file produce identical results', async () => {
    const mergedContent = `a1b2: 01hx5zzkbkbctav9wevgemmvrw
c3d4: 01hx5zzkbkdctav9wevgemmvry
x5k9: 01hx5zzkbkactav9wevgemmvrz
x5k9: 01hx5zzkbkcctav9wevgemmvrx
`;

    // Clone 1 repairs
    const baseDir1 = await createTempDir();
    await writeFile(join(baseDir1, 'mappings', 'ids.yml'), mergedContent);
    const warnSpy1 = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const mapping1 = await loadIdMapping(baseDir1);
    warnSpy1.mockRestore();

    // Clone 2 repairs (same file)
    const baseDir2 = await createTempDir();
    await writeFile(join(baseDir2, 'mappings', 'ids.yml'), mergedContent);
    const warnSpy2 = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const mapping2 = await loadIdMapping(baseDir2);
    warnSpy2.mockRestore();

    // Both must produce identical results
    expect([...mapping1.shortToUlid.entries()].sort()).toEqual(
      [...mapping2.shortToUlid.entries()].sort(),
    );
    expect([...mapping1.ulidToShort.entries()].sort()).toEqual(
      [...mapping2.ulidToShort.entries()].sort(),
    );
  });
});

// =============================================================================
// parseIdMappingFromYaml with duplicate keys (same fix path)
// =============================================================================

describe('parseIdMappingFromYaml with conflicting duplicate keys', () => {
  it('resolves duplicate keys mapping to different ULIDs', () => {
    const yaml = `a1b2: 01hx5zzkbkactav9wevgemmvrz
c3d4: 01hx5zzkbkbctav9wevgemmvrw
a1b2: 01hx5zzkbkxctav9wevgemmabc`;

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const mapping = parseIdMappingFromYaml(yaml);
    warnSpy.mockRestore();

    // All 3 ULIDs must be addressable
    expect(mapping.ulidToShort.size).toBe(3);
    expect(mapping.shortToUlid.size).toBe(3);

    // Smallest ULID keeps "a1b2"
    expect(mapping.shortToUlid.get('a1b2')).toBe('01hx5zzkbkactav9wevgemmvrz');

    // Displaced ULID has a replacement
    expect(mapping.ulidToShort.has('01hx5zzkbkxctav9wevgemmabc')).toBe(true);
    expect(mapping.ulidToShort.get('01hx5zzkbkxctav9wevgemmabc')).not.toBe('a1b2');
  });
});

// =============================================================================
// Validation on the repair path (R5)
// =============================================================================

describe('repair path validates entries loudly', () => {
  it('throws on invalid short ID in file with duplicates', async () => {
    // A file with a duplicate AND an entry whose key is not a valid ShortId.
    // The repair path must fail loudly, not silently skip.
    const baseDir = join(
      tmpdir(),
      `tbd-test-validation-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    await mkdir(join(baseDir, 'mappings'), { recursive: true });

    // "UPPER" contains uppercase which ShortId rejects
    const content = `a1b2: 01aaaaaaaaaaaaaaaaaaaaaaaa
a1b2: 01bbbbbbbbbbbbbbbbbbbbbbbb
UPPER: 01cccccccccccccccccccccccc
`;
    await writeFile(join(baseDir, 'mappings', 'ids.yml'), content);

    await expect(loadIdMapping(baseDir)).rejects.toThrow(/Invalid short ID/);
  });
});

// =============================================================================
// Merge conflict markers must throw even when duplicates are present
// =============================================================================

describe('conflict markers take priority over duplicate-key resolution', () => {
  async function createTempDir(): Promise<string> {
    const baseDir = join(
      tmpdir(),
      `tbd-test-conflict-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    await mkdir(join(baseDir, 'mappings'), { recursive: true });
    return baseDir;
  }

  it('parseIdMappingFromYaml throws MergeConflictError when content has both conflict markers and duplicate keys', () => {
    // Conflicted content that also has duplicate keys — the conflict marker
    // check must run first, not be bypassed by the duplicate-key branch.
    const conflictedWithDuplicates = `00wl: 01aaaaaaaaaaaaaaaaaaaaaaaa
<<<<<<< HEAD
00wl: 01bbbbbbbbbbbbbbbbbbbbbbbb
=======
c3d4: 01cccccccccccccccccccccccc
>>>>>>> origin/tbd-sync`;

    expect(() => parseIdMappingFromYaml(conflictedWithDuplicates)).toThrow(MergeConflictError);
  });

  it('parseIdMappingFromYaml still throws on conflict markers without duplicate keys', () => {
    const conflictedNoDuplicates = `<<<<<<< HEAD
a1b2: 01aaaaaaaaaaaaaaaaaaaaaaaa
=======
c3d4: 01bbbbbbbbbbbbbbbbbbbbbbbb
>>>>>>> origin/tbd-sync`;

    expect(() => parseIdMappingFromYaml(conflictedNoDuplicates)).toThrow(MergeConflictError);
  });

  it('loadIdMapping throws MergeConflictError when file has both conflict markers and duplicate keys', async () => {
    const baseDir = await createTempDir();
    const conflictedWithDuplicates = `00wl: 01aaaaaaaaaaaaaaaaaaaaaaaa
<<<<<<< HEAD
00wl: 01bbbbbbbbbbbbbbbbbbbbbbbb
=======
c3d4: 01cccccccccccccccccccccccc
>>>>>>> origin/tbd-sync
`;
    await writeFile(join(baseDir, 'mappings', 'ids.yml'), conflictedWithDuplicates);

    await expect(loadIdMapping(baseDir)).rejects.toThrow(MergeConflictError);
  });

  it('loadIdMapping still throws on conflict markers without duplicate keys', async () => {
    const baseDir = await createTempDir();
    const conflictedNoDuplicates = `<<<<<<< HEAD
a1b2: 01aaaaaaaaaaaaaaaaaaaaaaaa
=======
c3d4: 01bbbbbbbbbbbbbbbbbbbbbbbb
>>>>>>> origin/tbd-sync
`;
    await writeFile(join(baseDir, 'mappings', 'ids.yml'), conflictedNoDuplicates);

    await expect(loadIdMapping(baseDir)).rejects.toThrow(MergeConflictError);
  });
});
