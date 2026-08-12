import { execFile } from 'node:child_process';
import { access, mkdtemp, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

import { afterEach, describe, expect, it } from 'vitest';

import { withSharedDataSyncLock } from '../src/file/common-dir-layout.js';
import { readDataSyncEpoch } from '../src/file/data-sync-epoch.js';
import { resolveSharedTbdPaths } from '../src/lib/paths.js';

const execFileAsync = promisify(execFile);

function deferred(): { promise: Promise<void>; resolve(): void } {
  let resolve!: () => void;
  const promise = new Promise<void>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

describe('data-sync writer epoch', () => {
  const temporaryDirectories: string[] = [];

  afterEach(async () => {
    await Promise.all(
      temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })),
    );
  });

  async function createRepository(): Promise<string> {
    const repository = await mkdtemp(join(tmpdir(), 'tbd-writer-epoch-'));
    temporaryDirectories.push(repository);
    await execFileAsync('git', ['init', '--initial-branch=main'], { cwd: repository });
    return repository;
  }

  it('marks the critical section active and its resulting state quiescent before unlock', async () => {
    const repository = await createRepository();
    const paths = await resolveSharedTbdPaths(repository);
    let activeId = '';

    const result = await withSharedDataSyncLock(repository, async () => {
      const active = await readDataSyncEpoch(paths.sharedDataSyncEpochPath);
      expect(active.phase).toBe('active');
      expect(await exists(paths.sharedLockPath)).toBe(true);
      activeId = active.id;
      return 42;
    });

    expect(result).toBe(42);
    const quiescent = await readDataSyncEpoch(paths.sharedDataSyncEpochPath);
    expect(quiescent).toMatchObject({ phase: 'quiescent', id: activeId });
    expect(await exists(paths.sharedLockPath)).toBe(false);
  });

  it('establishes a quiescent boundary even when the critical section rejects', async () => {
    const repository = await createRepository();
    const paths = await resolveSharedTbdPaths(repository);

    await expect(
      withSharedDataSyncLock(repository, () => Promise.reject(new Error('write failed'))),
    ).rejects.toThrow('write failed');

    expect(await readDataSyncEpoch(paths.sharedDataSyncEpochPath)).toMatchObject({
      phase: 'quiescent',
    });
    expect(await exists(paths.sharedLockPath)).toBe(false);
  });

  it('does not publish quiescence after stale recovery displaces the writer lease', async () => {
    const repository = await createRepository();
    const paths = await resolveSharedTbdPaths(repository);
    const firstStarted = deferred();
    const releaseFirst = deferred();
    const secondStarted = deferred();
    const releaseSecond = deferred();

    const first = withSharedDataSyncLock(repository, async () => {
      firstStarted.resolve();
      await releaseFirst.promise;
    });
    await firstStarted.promise;
    await rename(paths.sharedLockPath, `${paths.sharedLockPath}.displaced`);

    const second = withSharedDataSyncLock(repository, async () => {
      secondStarted.resolve();
      await releaseSecond.promise;
    });
    await secondStarted.promise;
    const secondActive = await readDataSyncEpoch(paths.sharedDataSyncEpochPath);

    releaseFirst.resolve();
    await expect(first).rejects.toThrow('losing lock ownership');
    expect(await readDataSyncEpoch(paths.sharedDataSyncEpochPath)).toEqual(secondActive);

    releaseSecond.resolve();
    await expect(second).resolves.toBeUndefined();
    expect(await readDataSyncEpoch(paths.sharedDataSyncEpochPath)).toMatchObject({
      phase: 'quiescent',
      id: secondActive.id,
    });
  });

  it('rejects corrupt epoch contents instead of weakening snapshot validation', async () => {
    const repository = await createRepository();
    const paths = await resolveSharedTbdPaths(repository);
    await withSharedDataSyncLock(repository, () => Promise.resolve());
    await writeFile(paths.sharedDataSyncEpochPath, 'not-an-epoch\n');

    await expect(readDataSyncEpoch(paths.sharedDataSyncEpochPath)).rejects.toThrow(
      'Invalid data-sync writer epoch',
    );
  });
});
