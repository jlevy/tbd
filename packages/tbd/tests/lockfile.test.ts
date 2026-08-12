/**
 * Tests for the lockfile mutual exclusion utility.
 *
 * Validates that withLockfile provides correct mutual exclusion using
 * mkdir-based locking, with stale lock detection.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir, stat, writeFile, readFile, rename, utimes } from 'node:fs/promises';
import { hostname, tmpdir } from 'node:os';
import { join } from 'node:path';

import { withLockfile } from '../src/utils/lockfile.js';

function deferred(): { promise: Promise<void>; resolve(): void } {
  let resolve!: () => void;
  const promise = new Promise<void>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

const DEAD_OWNER_TOKEN = '00000000-0000-4000-8000-000000000001';

async function createDeadStaleLock(lockPath: string): Promise<void> {
  await mkdir(lockPath);
  await writeFile(
    join(lockPath, 'owner'),
    `${JSON.stringify({
      version: 1,
      token: DEAD_OWNER_TOKEN,
      host: hostname(),
      pid: 2_147_483_647,
    })}\n`,
  );
  const old = new Date(Date.now() - 60_000);
  await utimes(lockPath, old, old);
}

describe('withLockfile', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'tbd-lockfile-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('executes the critical section and returns its value', async () => {
    const lockPath = join(tempDir, 'test.lock');
    const result = await withLockfile(lockPath, () => Promise.resolve(42));
    expect(result).toBe(42);
  });

  it('cleans up the lock directory after execution', async () => {
    const lockPath = join(tempDir, 'test.lock');
    await withLockfile(lockPath, () => Promise.resolve());

    // Lock directory should not exist after completion
    await expect(stat(lockPath)).rejects.toThrow();
  });

  it('cleans up the lock directory even if fn throws', async () => {
    const lockPath = join(tempDir, 'test.lock');

    await expect(withLockfile(lockPath, () => Promise.reject(new Error('boom')))).rejects.toThrow(
      'boom',
    );

    // Lock should be released despite the error
    await expect(stat(lockPath)).rejects.toThrow();
  });

  it('serializes concurrent access within a single process', async () => {
    const lockPath = join(tempDir, 'test.lock');
    const order: number[] = [];

    // Track how many critical sections run at once. Mutual exclusion means this
    // never exceeds 1.
    //
    // staleMs is comfortably above the 200ms critical section (so a live holder is
    // never mistaken for stale) but well below the test timeout. On Windows a
    // release rmdir can stall; a low staleMs lets the next waiter reclaim the
    // orphaned lock within ~1s instead of hanging, while the atomic stale-break in
    // withLockfile guarantees two waiters can't both reclaim it and run concurrently.
    let active = 0;
    let maxActive = 0;
    const lockOpts = { timeoutMs: 30_000, pollMs: 20, staleMs: 1_000 };

    const section = (id: number) => async () => {
      active++;
      maxActive = Math.max(maxActive, active);
      order.push(id);
      // Simulate some work — must be long enough relative to poll interval.
      await new Promise((r) => setTimeout(r, 200));
      order.push(id);
      active--;
    };

    // Launch 3 concurrent critical sections.
    await Promise.all([
      withLockfile(lockPath, section(1), lockOpts),
      withLockfile(lockPath, section(2), lockOpts),
      withLockfile(lockPath, section(3), lockOpts),
    ]);

    // No two critical sections ever overlapped.
    expect(maxActive).toBe(1);

    // Each critical section ran to completion before the next started.
    // Entries appear in pairs: [X, X, Y, Y, Z, Z].
    expect(order).toHaveLength(6);
    expect(order[0]).toBe(order[1]);
    expect(order[2]).toBe(order[3]);
    expect(order[4]).toBe(order[5]);
  }, 30_000);

  it('heartbeats a long live holder so stale recovery cannot overlap it', async () => {
    const lockPath = join(tempDir, 'heartbeat.lock');
    const release = deferred();
    const started = deferred();
    let active = 0;
    let maximumActive = 0;
    let secondEntered = false;
    const options = { timeoutMs: 2_000, pollMs: 10, staleMs: 120 };

    const first = withLockfile(
      lockPath,
      async () => {
        active += 1;
        maximumActive = Math.max(maximumActive, active);
        started.resolve();
        await release.promise;
        active -= 1;
      },
      options,
    );
    await started.promise;
    const second = withLockfile(
      lockPath,
      () => {
        secondEntered = true;
        active += 1;
        maximumActive = Math.max(maximumActive, active);
        active -= 1;
        return Promise.resolve();
      },
      options,
    );

    // More than two stale windows pass while the first holder remains live.
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(secondEntered).toBe(false);
    expect(maximumActive).toBe(1);

    release.resolve();
    await Promise.all([first, second]);
    expect(secondEntered).toBe(true);
    expect(maximumActive).toBe(1);
  });

  it('does not evict a live owner whose heartbeat appears stale after suspension', async () => {
    const lockPath = join(tempDir, 'suspended-live.lock');
    const started = deferred();
    const release = deferred();

    const first = withLockfile(
      lockPath,
      async () => {
        started.resolve();
        await release.promise;
      },
      { timeoutMs: 2_000, pollMs: 10, staleMs: 10_000 },
    );
    await started.promise;
    const old = new Date(Date.now() - 60_000);
    await utimes(lockPath, old, old);

    let secondEntered = false;
    await expect(
      withLockfile(
        lockPath,
        () => {
          secondEntered = true;
          return Promise.resolve();
        },
        { timeoutMs: 200, pollMs: 10, staleMs: 50 },
      ),
    ).rejects.toThrow('Failed to acquire lock');
    expect(secondEntered).toBe(false);

    release.resolve();
    await expect(first).resolves.toBeUndefined();
  });

  it('does not let a displaced holder remove the successor lock', async () => {
    const lockPath = join(tempDir, 'ownership.lock');
    const displacedPath = join(tempDir, 'ownership.displaced');
    const firstStarted = deferred();
    const releaseFirst = deferred();
    const secondStarted = deferred();
    const releaseSecond = deferred();

    const first = withLockfile(lockPath, async () => {
      firstStarted.resolve();
      await releaseFirst.promise;
    });
    await firstStarted.promise;

    // Model the atomic step performed by stale recovery, then let a successor own the
    // canonical path while the displaced holder is still alive.
    await rename(lockPath, displacedPath);
    const second = withLockfile(lockPath, async () => {
      secondStarted.resolve();
      await releaseSecond.promise;
    });
    await secondStarted.promise;

    releaseFirst.resolve();
    await expect(first).rejects.toThrow('Lost ownership of lock');
    await expect(stat(lockPath)).resolves.toMatchObject({});

    releaseSecond.resolve();
    await expect(second).resolves.toBeUndefined();
    await expect(stat(lockPath)).rejects.toThrow();
  });

  it('breaks stale locks', async () => {
    const lockPath = join(tempDir, 'stale.lock');

    await createDeadStaleLock(lockPath);

    // Set staleMs to 0 so any existing lock is considered stale
    const result = await withLockfile(lockPath, () => Promise.resolve('success'), {
      staleMs: 0,
      timeoutMs: 2000,
    });

    expect(result).toBe('success');
    await expect(stat(`${lockPath}.stale-${DEAD_OWNER_TOKEN}`)).resolves.toMatchObject({});
  });

  it('throws LockAcquisitionError on timeout instead of running unprotected', async () => {
    const lockPath = join(tempDir, 'held.lock');

    // Create a "held" lock
    await mkdir(lockPath);

    // Try to acquire with short timeout and long stale threshold (won't break)
    await expect(
      withLockfile(lockPath, () => Promise.resolve('should-not-run'), {
        timeoutMs: 200,
        pollMs: 50,
        staleMs: 999_999, // Lock won't be considered stale
      }),
    ).rejects.toThrow('Failed to acquire lock');

    // Clean up the manually created lock
    await rm(lockPath, { recursive: true, force: true });
  });

  it('preserves unexpected filesystem errors instead of masking them as lock contention', async () => {
    let executed = false;

    await expect(
      withLockfile(join(tempDir, 'missing-parent', 'held.lock'), () => {
        executed = true;
        return Promise.resolve('should-not-run');
      }),
    ).rejects.toMatchObject({ code: 'ENOENT' });

    expect(executed).toBe(false);
  });

  it('refuses to break a non-directory at the lock path and leaves it untouched', async () => {
    const lockPath = join(tempDir, 'occupied.lock');
    // A regular file (not the directory the lock protocol creates) sits at the path.
    await writeFile(lockPath, 'important user data');

    let executed = false;
    await expect(
      withLockfile(
        lockPath,
        () => {
          executed = true;
          return Promise.resolve('should-not-run');
        },
        { staleMs: -1, timeoutMs: 2000 }, // would mark any lock stale immediately
      ),
    ).rejects.toThrow('not a directory');

    // The critical section never ran and the file was not moved aside.
    expect(executed).toBe(false);
    expect(await readFile(lockPath, 'utf-8')).toBe('important user data');
  });

  it('detects and breaks stale lock within timeout when staleMs < timeoutMs', async () => {
    const lockPath = join(tempDir, 'stale-timing.lock');

    await createDeadStaleLock(lockPath);

    // With staleMs < timeoutMs, the lock is detected as stale and broken
    const result = await withLockfile(lockPath, () => Promise.resolve('recovered'), {
      timeoutMs: 2000,
      pollMs: 50,
      staleMs: 0, // Immediately considered stale
    });

    expect(result).toBe('recovered');
  });

  it('serializes waiters recovering the same dead generation without ABA overlap', async () => {
    const lockPath = join(tempDir, 'stale-aba.lock');
    await createDeadStaleLock(lockPath);
    const releaseFirst = deferred();
    const firstStarted = deferred();
    let active = 0;
    let maximumActive = 0;

    const enter = async (wait: Promise<void>): Promise<void> => {
      active += 1;
      maximumActive = Math.max(maximumActive, active);
      await wait;
      active -= 1;
    };
    const options = { timeoutMs: 2_000, pollMs: 5, staleMs: 0 };
    const first = withLockfile(
      lockPath,
      async () => {
        firstStarted.resolve();
        await enter(releaseFirst.promise);
      },
      options,
    );
    const second = withLockfile(lockPath, () => enter(Promise.resolve()), options);

    await firstStarted.promise;
    await expect(stat(`${lockPath}.stale-${DEAD_OWNER_TOKEN}`)).resolves.toMatchObject({});
    await new Promise((resolve) => setTimeout(resolve, 75));
    expect(maximumActive).toBe(1);

    releaseFirst.resolve();
    await Promise.all([first, second]);
    expect(maximumActive).toBe(1);
  });

  it('allows re-acquisition after release', async () => {
    const lockPath = join(tempDir, 'reuse.lock');

    const r1 = await withLockfile(lockPath, () => Promise.resolve('first'));
    const r2 = await withLockfile(lockPath, () => Promise.resolve('second'));

    expect(r1).toBe('first');
    expect(r2).toBe('second');
  });
});
