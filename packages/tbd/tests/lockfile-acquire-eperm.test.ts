/**
 * Acquire-side hardening for `withLockfile`: a transient Windows mkdir failure
 * (EBUSY/EPERM/EACCES raised when acquisition races a concurrent rmdir of the same
 * lock directory) must be retried, but a *persistent* permission failure — the
 * genuinely-unwritable-lock case that `tbd doctor` reports — must still surface.
 *
 * These run on every platform with a mocked `node:fs/promises` so the behavior is
 * deterministic; the real Windows race is timing-dependent and not reproducible in
 * CI. See lockfile.ts and tbd-29k3 / the lockfile.test.ts concurrency test.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

const { mkdirMock } = vi.hoisted(() => ({ mkdirMock: vi.fn() }));

vi.mock('node:fs/promises', () => ({
  mkdir: mkdirMock,
  rmdir: vi.fn().mockResolvedValue(undefined),
  rename: vi.fn().mockResolvedValue(undefined),
  stat: vi.fn().mockResolvedValue({ isDirectory: () => true, mtimeMs: Date.now() }),
}));

const { withLockfile } = await import('../src/utils/lockfile.js');

function eperm(): NodeJS.ErrnoException {
  const error = new Error('EPERM: operation not permitted, mkdir') as NodeJS.ErrnoException;
  error.code = 'EPERM';
  return error;
}

describe('withLockfile acquire: transient Windows mkdir EPERM', () => {
  afterEach(() => {
    mkdirMock.mockReset();
  });

  it('retries a transient mkdir EPERM and then acquires the lock', async () => {
    mkdirMock
      .mockRejectedValueOnce(eperm())
      .mockRejectedValueOnce(eperm())
      .mockResolvedValueOnce(undefined);
    const critical = vi.fn().mockResolvedValue('ok');

    await expect(withLockfile('/tmp/transient.lock', critical, { pollMs: 1 })).resolves.toBe('ok');
    expect(critical).toHaveBeenCalledTimes(1);
    expect(mkdirMock).toHaveBeenCalledTimes(3);
  });

  it('still surfaces a persistent EPERM (genuinely unwritable dir) after the bounded budget', async () => {
    mkdirMock.mockRejectedValue(eperm());
    const critical = vi.fn();

    await expect(
      withLockfile('/tmp/unwritable.lock', critical, { pollMs: 1 }),
    ).rejects.toMatchObject({ code: 'EPERM' });
    expect(critical).not.toHaveBeenCalled();
    // The 5-retry budget plus the final attempt that re-raises the original error.
    expect(mkdirMock).toHaveBeenCalledTimes(6);
  });

  it('throws non-transient mkdir errors (e.g. ENOSPC) immediately, without retrying', async () => {
    const enospc = new Error('ENOSPC: no space left on device') as NodeJS.ErrnoException;
    enospc.code = 'ENOSPC';
    mkdirMock.mockRejectedValue(enospc);
    const critical = vi.fn();

    await expect(withLockfile('/tmp/full.lock', critical, { pollMs: 1 })).rejects.toMatchObject({
      code: 'ENOSPC',
    });
    expect(critical).not.toHaveBeenCalled();
    expect(mkdirMock).toHaveBeenCalledTimes(1);
  });
});
