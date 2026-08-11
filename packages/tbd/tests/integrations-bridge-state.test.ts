/**
 * Bridge records: round-trip, tolerance of damage, the reverse index, the
 * derived watermark, and description hashing.
 *
 * The hashing invariants matter most: tbd's own managed-block splice and
 * Linear's markdown round-tripping (CRLF, trailing whitespace) must never
 * register as remote edits, or every sync would see phantom description
 * changes.
 */

import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  bridgeLinksDir,
  byExternalId,
  deleteLinkRecord,
  descriptionHash,
  listLinkRecords,
  normalizeDescription,
  pullWatermark,
  readLinkRecord,
  writeLinkRecord,
} from '../src/integrations/core/bridge-state.js';
import { BLOCK_BEGIN, BLOCK_END } from '../src/integrations/core/managed-block.js';
import type { LinkRecord } from '../src/lib/types.js';

const BEAD_ID = 'is-01hx5zzkbkactav9wevgemmvrz';

function record(overrides: Partial<LinkRecord> = {}): LinkRecord {
  return {
    type: 'lk',
    bead_id: BEAD_ID,
    external_id: '9cbb48f8-7a2e-4b9d-9f3e-0c1d2e3f4a5b',
    base: {
      title: 'A bead',
      status: 'open',
      priority: 2,
      labels: [],
      description_hash: descriptionHash('Body'),
    },
    remote_updated_at: '2026-08-10T22:00:00.000Z',
    synced_at: '2026-08-10T22:00:01.000Z',
    state: 'linked',
    ...overrides,
  };
}

describe('link records', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'tbd-bridge-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('round-trips a record through write and read', async () => {
    await writeLinkRecord(dir, 'linear', record());
    const back = await readLinkRecord(dir, 'linear', BEAD_ID);
    expect(back).toEqual(record());
  });

  it('reads missing as undefined', async () => {
    expect(await readLinkRecord(dir, 'linear', BEAD_ID)).toBeUndefined();
  });

  it('reads malformed yaml as undefined rather than throwing', async () => {
    await mkdir(bridgeLinksDir(dir, 'linear'), { recursive: true });
    await writeFile(join(bridgeLinksDir(dir, 'linear'), `${BEAD_ID}.yml`), '{not yaml: [');
    expect(await readLinkRecord(dir, 'linear', BEAD_ID)).toBeUndefined();
  });

  it('reads a record with leftover conflict markers as undefined', async () => {
    await mkdir(bridgeLinksDir(dir, 'linear'), { recursive: true });
    await writeFile(
      join(bridgeLinksDir(dir, 'linear'), `${BEAD_ID}.yml`),
      '<<<<<<< ours\ntype: lk\n=======\ntype: lk\n>>>>>>> theirs\n',
    );
    expect(await readLinkRecord(dir, 'linear', BEAD_ID)).toBeUndefined();
  });

  it('reads a schema-invalid record as undefined', async () => {
    await mkdir(bridgeLinksDir(dir, 'linear'), { recursive: true });
    await writeFile(
      join(bridgeLinksDir(dir, 'linear'), `${BEAD_ID}.yml`),
      'type: lk\nbead_id: not-a-bead-id\n',
    );
    expect(await readLinkRecord(dir, 'linear', BEAD_ID)).toBeUndefined();
  });

  it('deletes are idempotent and produce absence', async () => {
    await writeLinkRecord(dir, 'linear', record());
    await deleteLinkRecord(dir, 'linear', BEAD_ID);
    await deleteLinkRecord(dir, 'linear', BEAD_ID);
    expect(await readLinkRecord(dir, 'linear', BEAD_ID)).toBeUndefined();
  });

  it('lists records, skipping damaged files', async () => {
    const other = record({
      bead_id: 'is-01hx5zzkbkactav9wevgemmvs0',
      external_id: 'other-uuid',
    });
    await writeLinkRecord(dir, 'linear', record());
    await writeLinkRecord(dir, 'linear', other);
    await writeFile(join(bridgeLinksDir(dir, 'linear'), 'is-damaged.yml'), '[');

    const records = await listLinkRecords(dir, 'linear');
    expect(records).toHaveLength(2);
    expect(records.map((r) => r.external_id).sort()).toEqual([
      '9cbb48f8-7a2e-4b9d-9f3e-0c1d2e3f4a5b',
      'other-uuid',
    ]);
  });

  it('keeps providers separate', async () => {
    await writeLinkRecord(dir, 'linear', record());
    expect(await listLinkRecords(dir, 'github')).toEqual([]);
  });
});

describe('the reverse index and watermark', () => {
  it('indexes by external id', () => {
    const a = record();
    const b = record({ bead_id: 'is-01hx5zzkbkactav9wevgemmvs0', external_id: 'uuid-b' });
    const index = byExternalId([a, b]);
    expect(index.get('uuid-b')?.bead_id).toBe('is-01hx5zzkbkactav9wevgemmvs0');
    expect(index.get('nope')).toBeUndefined();
  });

  it('derives the watermark as the newest observation', () => {
    expect(pullWatermark([])).toBeUndefined();
    const older = record({ remote_updated_at: '2026-08-10T20:00:00.000Z' });
    const newer = record({
      bead_id: 'is-01hx5zzkbkactav9wevgemmvs0',
      remote_updated_at: '2026-08-10T23:00:00.000Z',
    });
    expect(pullWatermark([older, newer])).toBe('2026-08-10T23:00:00.000Z');
  });
});

describe('description normalization and hashing', () => {
  it('ignores the managed block', () => {
    const withBlock = `Prose.\n\n${BLOCK_BEGIN}\nmachine text\n${BLOCK_END}`;
    expect(descriptionHash(withBlock)).toBe(descriptionHash('Prose.'));
  });

  it('ignores line-ending and trailing-whitespace differences', () => {
    expect(descriptionHash('a\r\nb  \n')).toBe(descriptionHash('a\nb'));
  });

  it('treats null, undefined, and empty as the same', () => {
    expect(descriptionHash(null)).toBe(descriptionHash(undefined));
    expect(descriptionHash(null)).toBe(descriptionHash(''));
  });

  it('distinguishes genuinely different prose', () => {
    expect(descriptionHash('a')).not.toBe(descriptionHash('b'));
  });

  it('normalizes but does not otherwise rewrite content', () => {
    expect(normalizeDescription('  keep leading\ninternal  spacing')).toBe(
      'keep leading\ninternal  spacing',
    );
  });
});
