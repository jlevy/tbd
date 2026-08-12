/** Adversarial ownership test for the mkdir-to-owner acquisition boundary. */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  utimes,
  writeFile,
} from 'node:fs/promises';
import { hostname, tmpdir } from 'node:os';
import { join } from 'node:path';

import type * as fsPromises from 'node:fs/promises';

const preparedOwnerOpen = vi.hoisted(() => ({
  prefix: '',
  failureStage: 'open' as 'open' | 'write',
  failuresRemaining: 0,
  attempts: 0,
}));
const ownerLink = vi.hoisted(() => ({
  destination: '',
  armed: false,
  entered: (): void => undefined,
  release: Promise.resolve(),
}));
const staleRename = vi.hoisted(() => ({
  source: '',
  destination: '',
  armed: false,
  entered: (): void => undefined,
  release: Promise.resolve(),
}));
const releaseRename = vi.hoisted(() => ({
  source: '',
  failuresRemaining: 0,
  attempts: 0,
}));
const heartbeatTouch = vi.hoisted(() => ({
  target: '',
  failuresRemaining: 0,
  attempts: 0,
  failed: (): void => undefined,
}));

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof fsPromises>();
  return {
    ...actual,
    open: vi.fn(async (path: string, flags: string | number, mode?: number | string) => {
      if (preparedOwnerOpen.prefix !== '' && path.startsWith(preparedOwnerOpen.prefix)) {
        preparedOwnerOpen.attempts += 1;
        if (preparedOwnerOpen.failuresRemaining > 0) {
          preparedOwnerOpen.failuresRemaining -= 1;
          const error = new Error('owner preparation failed') as NodeJS.ErrnoException;
          error.code = 'ENOSPC';
          if (preparedOwnerOpen.failureStage === 'open') {
            throw error;
          }
          const handle = await actual.open(path, flags, mode);
          return {
            writeFile: () => Promise.reject(error),
            close: () => handle.close(),
          } as unknown as Awaited<ReturnType<typeof actual.open>>;
        }
      }
      return actual.open(path, flags, mode);
    }),
    link: vi.fn(async (source: string, destination: string) => {
      if (ownerLink.armed && destination === ownerLink.destination) {
        ownerLink.armed = false;
        ownerLink.entered();
        await ownerLink.release;
      }
      return actual.link(source, destination);
    }),
    rename: vi.fn(async (source: string, destination: string) => {
      if (
        source === releaseRename.source &&
        destination.startsWith(`${releaseRename.source}.released-`)
      ) {
        releaseRename.attempts += 1;
        if (releaseRename.failuresRemaining > 0) {
          releaseRename.failuresRemaining -= 1;
          const error = new Error('transient release rename') as NodeJS.ErrnoException;
          error.code = 'EPERM';
          throw error;
        }
      }
      if (
        staleRename.armed &&
        source === staleRename.source &&
        destination === staleRename.destination
      ) {
        staleRename.armed = false;
        staleRename.entered();
        await staleRename.release;
      }
      return actual.rename(source, destination);
    }),
    utimes: vi.fn(async (path: string, atime: Date | number, mtime: Date | number) => {
      if (path === heartbeatTouch.target) {
        heartbeatTouch.attempts += 1;
        if (heartbeatTouch.failuresRemaining > 0) {
          heartbeatTouch.failuresRemaining -= 1;
          heartbeatTouch.failed();
          const error = new Error('heartbeat timestamp failed') as NodeJS.ErrnoException;
          error.code = 'EIO';
          throw error;
        }
      }
      return actual.utimes(path, atime, mtime);
    }),
  };
});

import { withLockfile } from '../src/utils/lockfile.js';

function deferred(): { promise: Promise<void>; resolve(): void } {
  let resolve!: () => void;
  const promise = new Promise<void>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe('withLockfile acquisition ownership race', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'tbd-lock-acquire-race-'));
  });

  afterEach(async () => {
    preparedOwnerOpen.prefix = '';
    preparedOwnerOpen.failureStage = 'open';
    preparedOwnerOpen.failuresRemaining = 0;
    preparedOwnerOpen.attempts = 0;
    ownerLink.destination = '';
    ownerLink.armed = false;
    ownerLink.entered = (): void => undefined;
    ownerLink.release = Promise.resolve();
    staleRename.source = '';
    staleRename.destination = '';
    staleRename.armed = false;
    staleRename.entered = (): void => undefined;
    staleRename.release = Promise.resolve();
    releaseRename.source = '';
    releaseRename.failuresRemaining = 0;
    releaseRename.attempts = 0;
    heartbeatTouch.target = '';
    heartbeatTouch.failuresRemaining = 0;
    heartbeatTouch.attempts = 0;
    heartbeatTouch.failed = (): void => undefined;
    await rm(tempDir, { recursive: true, force: true });
  });

  it('does not overwrite a successor when provisional owner installation loses its directory', async () => {
    const lockPath = join(tempDir, 'shared.lock');
    const displacedPath = join(tempDir, 'shared.displaced');
    const firstAtOwnerLink = deferred();
    const releaseFirstOwnerLink = deferred();
    const secondStarted = deferred();
    const releaseSecond = deferred();
    let firstExecuted = false;

    ownerLink.destination = join(lockPath, 'owner');
    ownerLink.armed = true;
    ownerLink.entered = () => {
      firstAtOwnerLink.resolve();
    };
    ownerLink.release = releaseFirstOwnerLink.promise;

    const first = withLockfile(lockPath, () => {
      firstExecuted = true;
      return Promise.resolve('first');
    });
    await firstAtOwnerLink.promise;

    // Model stale recovery during the provisional mkdir -> owner-file window.
    await rename(lockPath, displacedPath);
    const second = withLockfile(lockPath, async () => {
      secondStarted.resolve();
      await releaseSecond.promise;
      return 'second';
    });
    await secondStarted.promise;

    // The resumed first acquisition uses an exclusive hard link and sees EEXIST at the
    // successor's complete owner record. It leaves that generation untouched and
    // returns to the acquisition loop without entering its own critical section.
    releaseFirstOwnerLink.resolve();
    await new Promise((resolve) => setTimeout(resolve, 75));
    expect(firstExecuted).toBe(false);
    await expect(stat(lockPath)).resolves.toMatchObject({});
    const successorOwner = JSON.parse(await readFile(join(lockPath, 'owner'), 'utf8')) as {
      token: string;
      pid: number;
    };
    expect(successorOwner.token).toMatch(/^[0-9a-f-]+$/u);
    expect(successorOwner.pid).toBe(process.pid);

    releaseSecond.resolve();
    await expect(second).resolves.toBe('second');
    await expect(first).resolves.toBe('first');
    await expect(stat(lockPath)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it.each(['open', 'write'] as const)(
    'does not create the canonical lock when owner-record %s fails',
    async (failureStage) => {
      const lockPath = join(tempDir, 'owner-setup-failure.lock');
      preparedOwnerOpen.prefix = `${lockPath}.owner-`;
      preparedOwnerOpen.failureStage = failureStage;
      preparedOwnerOpen.failuresRemaining = 1;
      let executed = false;

      await expect(
        withLockfile(lockPath, () => {
          executed = true;
          return Promise.resolve();
        }),
      ).rejects.toMatchObject({ code: 'ENOSPC' });

      expect(executed).toBe(false);
      expect(preparedOwnerOpen.attempts).toBe(1);
      await expect(stat(lockPath)).rejects.toMatchObject({ code: 'ENOENT' });
      expect(await readdir(tempDir)).toEqual([]);
    },
  );

  it('quiesces and releases a still-owned lock after heartbeat maintenance fails', async () => {
    const lockPath = join(tempDir, 'heartbeat-failure.lock');
    const started = deferred();
    const release = deferred();
    const heartbeatFailed = deferred();
    heartbeatTouch.target = lockPath;
    heartbeatTouch.failuresRemaining = 1;
    heartbeatTouch.failed = () => {
      heartbeatFailed.resolve();
    };

    const work = withLockfile(
      lockPath,
      async (lease) => {
        started.resolve();
        await release.promise;
        await lease.assertOwned();
        return 'done';
      },
      { timeoutMs: 2_000, pollMs: 5, staleMs: 30 },
    );
    await started.promise;
    await heartbeatFailed.promise;

    release.resolve();
    await expect(work).resolves.toBe('done');
    expect(heartbeatTouch.attempts).toBe(1);
    await expect(stat(lockPath)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('does not let a delayed stale observer quarantine a successor generation', async () => {
    const lockPath = join(tempDir, 'stale-aba.lock');
    const deadToken = '00000000-0000-4000-8000-000000000003';
    const stalePath = `${lockPath}.stale-${deadToken}`;
    await mkdir(lockPath);
    await writeFile(
      join(lockPath, 'owner'),
      `${JSON.stringify({
        version: 1,
        token: deadToken,
        host: hostname(),
        pid: 2_147_483_647,
      })}\n`,
    );
    const old = new Date(Date.now() - 60_000);
    await utimes(lockPath, old, old);

    const firstAtRename = deferred();
    const releaseFirstRename = deferred();
    const secondStarted = deferred();
    const releaseSecond = deferred();
    let firstStarted = false;
    staleRename.source = lockPath;
    staleRename.destination = stalePath;
    staleRename.armed = true;
    staleRename.entered = () => {
      firstAtRename.resolve();
    };
    staleRename.release = releaseFirstRename.promise;

    const options = { timeoutMs: 2_000, pollMs: 5, staleMs: 0 };
    const first = withLockfile(
      lockPath,
      () => {
        firstStarted = true;
        return Promise.resolve('first');
      },
      options,
    );
    await firstAtRename.promise;

    const second = withLockfile(
      lockPath,
      async () => {
        secondStarted.resolve();
        await releaseSecond.promise;
        return 'second';
      },
      options,
    );
    await secondStarted.promise;

    // The second waiter quarantined the dead generation and now owns the canonical
    // path. When the first waiter's stale observation resumes, its deterministic
    // destination is occupied, so rename must fail without moving the successor.
    releaseFirstRename.resolve();
    await new Promise((resolve) => setTimeout(resolve, 75));
    expect(firstStarted).toBe(false);
    await expect(stat(lockPath)).resolves.toMatchObject({});
    await expect(stat(stalePath)).resolves.toMatchObject({});

    releaseSecond.resolve();
    await expect(second).resolves.toBe('second');
    await expect(first).resolves.toBe('first');
  });

  it('retries transient release renames without exposing a second owner', async () => {
    const lockPath = join(tempDir, 'release-retry.lock');
    releaseRename.source = lockPath;
    releaseRename.failuresRemaining = 2;

    await expect(withLockfile(lockPath, () => Promise.resolve('done'))).resolves.toBe('done');

    expect(releaseRename.attempts).toBe(3);
    await expect(stat(lockPath)).rejects.toMatchObject({ code: 'ENOENT' });
  });
});
