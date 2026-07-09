/**
 * Windows-specific lockfile acquisition behavior.
 *
 * On Windows, mkdir can transiently fail with EPERM (instead of EEXIST) when the
 * lock directory is concurrently being removed (an NTFS delete-pending directory —
 * the same behavior that leads rimraf/graceful-fs to retry EPERM there). See
 * https://github.com/jlevy/tbd/issues/186. withLockfile must treat this as a busy
 * lock and retry, not throw.
 *
 * mkdir is mocked and process.platform is stubbed so both the win32 and non-win32
 * paths are exercised deterministically on every host platform.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type * as fsPromises from 'node:fs/promises';

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof fsPromises>();
  return {
    ...actual,
    mkdir: vi.fn(actual.mkdir),
  };
});

// Import the mocked mkdir to queue failures per test.
import { mkdir } from 'node:fs/promises';

import { withLockfile, LockAcquisitionError } from '../src/utils/lockfile.js';

function epermError(path: string): NodeJS.ErrnoException {
  const error = new Error(
    `EPERM: operation not permitted, mkdir '${path}'`,
  ) as NodeJS.ErrnoException;
  error.code = 'EPERM';
  return error;
}

function stubPlatform(platform: NodeJS.Platform): void {
  Object.defineProperty(process, 'platform', { value: platform, configurable: true });
}

describe('withLockfile EPERM handling', () => {
  const realPlatform = process.platform;
  let tempDir: string;

  beforeEach(async () => {
    // Restores the real mkdir implementation wrapped by vi.fn above.
    vi.mocked(mkdir).mockReset();
    tempDir = await mkdtemp(join(tmpdir(), 'tbd-lockfile-eperm-'));
  });

  afterEach(async () => {
    stubPlatform(realPlatform);
    vi.mocked(mkdir).mockReset();
    await rm(tempDir, { recursive: true, force: true });
  });

  it('retries transient EPERM on win32 and acquires once it clears', async () => {
    stubPlatform('win32');
    const lockPath = join(tempDir, 'test.lock');

    // Two delete-pending failures, then the real mkdir succeeds.
    vi.mocked(mkdir)
      .mockRejectedValueOnce(epermError(lockPath))
      .mockRejectedValueOnce(epermError(lockPath));

    const result = await withLockfile(lockPath, () => Promise.resolve('acquired'), {
      timeoutMs: 5000,
      pollMs: 5,
    });

    expect(result).toBe('acquired');
    expect(vi.mocked(mkdir)).toHaveBeenCalledTimes(3);
  });

  it('throws EPERM immediately on non-Windows platforms', async () => {
    stubPlatform('linux');
    const lockPath = join(tempDir, 'test.lock');

    vi.mocked(mkdir).mockRejectedValue(epermError(lockPath));

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
    expect(vi.mocked(mkdir)).toHaveBeenCalledTimes(1);
    expect(executed).toBe(false);
  });

  it('bounds persistent EPERM on win32 with LockAcquisitionError at the deadline', async () => {
    stubPlatform('win32');
    const lockPath = join(tempDir, 'test.lock');

    // A real permission problem (not delete-pending) never clears.
    vi.mocked(mkdir).mockRejectedValue(epermError(lockPath));

    let executed = false;
    await expect(
      withLockfile(
        lockPath,
        () => {
          executed = true;
          return Promise.resolve('should-not-run');
        },
        { timeoutMs: 150, pollMs: 10 },
      ),
    ).rejects.toThrow(LockAcquisitionError);

    expect(executed).toBe(false);
  });
});
