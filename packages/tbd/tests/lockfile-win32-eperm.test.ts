/**
 * Windows-specific lockfile acquisition behavior.
 *
 * On Windows, mkdir can transiently fail with EPERM (instead of EEXIST) when the
 * lock directory is concurrently being removed (an NTFS delete-pending directory —
 * the same behavior that leads rimraf/graceful-fs to retry EPERM there). See
 * https://github.com/jlevy/tbd/issues/186. withLockfile must treat this as a busy
 * lock and retry, not throw.
 *
 * The canonical lock mkdir is fault-injected and process.platform is stubbed so both
 * the win32 and non-win32 paths are exercised deterministically on every host platform.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type * as fsPromises from 'node:fs/promises';

const canonicalMkdir = vi.hoisted(() => ({
  target: '',
  failuresRemaining: 0,
  attempts: 0,
}));

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof fsPromises>();
  return {
    ...actual,
    mkdir: vi.fn(async (...args: Parameters<typeof actual.mkdir>) => {
      const path = String(args[0]);
      if (path === canonicalMkdir.target) {
        canonicalMkdir.attempts += 1;
        if (canonicalMkdir.failuresRemaining > 0) {
          if (Number.isFinite(canonicalMkdir.failuresRemaining)) {
            canonicalMkdir.failuresRemaining -= 1;
          }
          const error = new Error(
            `EPERM: operation not permitted, mkdir '${path}'`,
          ) as NodeJS.ErrnoException;
          error.code = 'EPERM';
          error.path = path;
          throw error;
        }
      }
      return actual.mkdir(...args);
    }),
  };
});

import { withLockfile, LockAcquisitionError } from '../src/utils/lockfile.js';

function stubPlatform(platform: NodeJS.Platform): void {
  Object.defineProperty(process, 'platform', { value: platform, configurable: true });
}

describe('withLockfile EPERM handling', () => {
  const realPlatform = process.platform;
  let tempDir: string;

  beforeEach(async () => {
    canonicalMkdir.target = '';
    canonicalMkdir.failuresRemaining = 0;
    canonicalMkdir.attempts = 0;
    tempDir = await mkdtemp(join(tmpdir(), 'tbd-lockfile-eperm-'));
  });

  afterEach(async () => {
    stubPlatform(realPlatform);
    canonicalMkdir.target = '';
    canonicalMkdir.failuresRemaining = 0;
    canonicalMkdir.attempts = 0;
    await rm(tempDir, { recursive: true, force: true });
  });

  it('retries transient EPERM on win32 and acquires once it clears', async () => {
    stubPlatform('win32');
    const lockPath = join(tempDir, 'test.lock');

    // Two delete-pending failures, then the real canonical mkdir succeeds. Private
    // owner-generation preparation is deliberately unaffected.
    canonicalMkdir.target = lockPath;
    canonicalMkdir.failuresRemaining = 2;

    const result = await withLockfile(lockPath, () => Promise.resolve('acquired'), {
      timeoutMs: 5000,
      pollMs: 5,
    });

    expect(result).toBe('acquired');
    expect(canonicalMkdir.attempts).toBe(3);
  });

  it('throws EPERM immediately on non-Windows platforms', async () => {
    stubPlatform('linux');
    const lockPath = join(tempDir, 'test.lock');

    canonicalMkdir.target = lockPath;
    canonicalMkdir.failuresRemaining = Number.POSITIVE_INFINITY;

    let executed = false;
    await expect(
      withLockfile(
        lockPath,
        () => {
          executed = true;
          return Promise.resolve('should-not-run');
        },
        { timeoutMs: 5000, pollMs: 5 },
      ),
    ).rejects.toMatchObject({ code: 'EPERM' });

    // A genuine POSIX permission error must fail fast, without retries.
    expect(canonicalMkdir.attempts).toBe(1);
    expect(executed).toBe(false);
  });

  it('rethrows persistent EPERM raw on win32 once the retry window elapses', async () => {
    stubPlatform('win32');
    const lockPath = join(tempDir, 'test.lock');

    // A real permission problem (not delete-pending) never clears. It must
    // surface as the raw ErrnoException — with .path intact — well before the
    // acquisition timeout, so withSharedDataSyncLock can translate it into
    // SharedLockUnwritableError instead of misreporting lock contention.
    canonicalMkdir.target = lockPath;
    canonicalMkdir.failuresRemaining = Number.POSITIVE_INFINITY;

    const start = Date.now();
    let executed = false;
    await expect(
      withLockfile(
        lockPath,
        () => {
          executed = true;
          return Promise.resolve('should-not-run');
        },
        { timeoutMs: 60_000, pollMs: 25 },
      ),
    ).rejects.toMatchObject({ code: 'EPERM', path: lockPath });

    const elapsed = Date.now() - start;
    expect(executed).toBe(false);
    // It retried through the window (not fail-fast) but gave up long before
    // the 60s acquisition timeout.
    expect(canonicalMkdir.attempts).toBeGreaterThan(2);
    expect(elapsed).toBeGreaterThanOrEqual(1000);
    expect(elapsed).toBeLessThan(10_000);
  });

  it('bounds EPERM retries with LockAcquisitionError when the deadline is shorter than the window', async () => {
    stubPlatform('win32');
    const lockPath = join(tempDir, 'test.lock');

    canonicalMkdir.target = lockPath;
    canonicalMkdir.failuresRemaining = Number.POSITIVE_INFINITY;

    // With timeoutMs below the EPERM retry window, the acquisition deadline
    // still governs: the loop exits and reports a timeout.
    await expect(
      withLockfile(lockPath, () => Promise.resolve('should-not-run'), {
        timeoutMs: 150,
        pollMs: 10,
      }),
    ).rejects.toThrow(LockAcquisitionError);
  });
});
