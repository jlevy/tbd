import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { pathExists, readMetadataMarker } from '../src/cli/web/snapshot-consistency.js';

describe('web snapshot consistency markers', () => {
  const temporaryDirectories: string[] = [];

  afterEach(async () => {
    await Promise.all(
      temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })),
    );
  });

  it('includes the bounded writer token so reconciliation does not rely on timestamps', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'tbd-snapshot-marker-'));
    temporaryDirectories.push(directory);
    const epochPath = join(directory, 'data-sync.epoch');
    await writeFile(epochPath, 'quiescent:00000000-0000-4000-8000-000000000001\n');

    const marker = await readMetadataMarker([epochPath]);

    expect(marker).toContain(':quiescent:00000000-0000-4000-8000-000000000001');
  });

  it('rejects an oversized epoch without reading it as an unbounded marker payload', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'tbd-snapshot-marker-'));
    temporaryDirectories.push(directory);
    const epochPath = join(directory, 'data-sync.epoch');
    await writeFile(epochPath, 'x'.repeat(1_024));

    await expect(readMetadataMarker([epochPath])).rejects.toThrow('exceeds 128 bytes');
  });

  it('represents missing paths without treating them as an observation failure', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'tbd-snapshot-marker-'));
    temporaryDirectories.push(directory);
    const missing = join(directory, 'missing');

    expect(await pathExists(missing)).toBe(false);
    expect(await readMetadataMarker([missing])).toBe(`${missing}:missing`);
  });
});
