/**
 * Tests for the lockfile mutual exclusion utility.
 *
 * Validates that withLockfile provides correct mutual exclusion using
 * mkdir-based locking, with stale lock detection.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { withLockfile } from '../src/utils/lockfile.js';

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

    // Use longer work duration (200ms) relative to poll interval (50ms default)
    // and longer timeout to ensure the lock is properly acquired rather than
    // falling through to degraded mode.
    const lockOpts = { timeoutMs: 10_000, pollMs: 20 };

    // Launch 3 concurrent critical sections
    await Promise.all([
      withLockfile(
        lockPath,
        async () => {
          order.push(1);
          // Simulate some work — must be long enough relative to poll interval
          await new Promise((r) => setTimeout(r, 200));
          order.push(1);
        },
        lockOpts,
      ),
      withLockfile(
        lockPath,
        async () => {
          order.push(2);
          await new Promise((r) => setTimeout(r, 200));
          order.push(2);
        },
        lockOpts,
      ),
      withLockfile(
        lockPath,
        async () => {
          order.push(3);
          await new Promise((r) => setTimeout(r, 200));
          order.push(3);
        },
        lockOpts,
      ),
    ]);

    // Each critical section should run to completion before the next starts.
    // Entries should appear in pairs: [X, X, Y, Y, Z, Z]
    expect(order).toHaveLength(6);
    expect(order[0]).toBe(order[1]);
    expect(order[2]).toBe(order[3]);
    expect(order[4]).toBe(order[5]);
  });

  it('breaks stale locks', async () => {
    const lockPath = join(tempDir, 'stale.lock');

    // Simulate a stale lock (create the directory manually)
    await mkdir(lockPath);

    // Set staleMs to 0 so any existing lock is considered stale
    const result = await withLockfile(lockPath, () => Promise.resolve('success'), {
      staleMs: 0,
      timeoutMs: 2000,
    });

    expect(result).toBe('success');
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

  it('detects and breaks stale lock within timeout when staleMs < timeoutMs', async () => {
    const lockPath = join(tempDir, 'stale-timing.lock');

    // Simulate a stale lock from a crashed process
    await mkdir(lockPath);

    // With staleMs < timeoutMs, the lock is detected as stale and broken
    const result = await withLockfile(lockPath, () => Promise.resolve('recovered'), {
      timeoutMs: 2000,
      pollMs: 50,
      staleMs: 0, // Immediately considered stale
    });

    expect(result).toBe('recovered');
  });

  it('allows re-acquisition after release', async () => {
    const lockPath = join(tempDir, 'reuse.lock');

    const r1 = await withLockfile(lockPath, () => Promise.resolve('first'));
    const r2 = await withLockfile(lockPath, () => Promise.resolve('second'));

    expect(r1).toBe('first');
    expect(r2).toBe('second');
  });
});
