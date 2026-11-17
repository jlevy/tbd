/** Permission diagnostics across the complete shared-lock acquisition protocol. */

import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, sep } from 'node:path';
import { promisify } from 'node:util';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type * as fsPromises from 'node:fs/promises';

const lockFault = vi.hoisted(() => ({
  kind: 'none' as 'none' | 'prepare-mkdir' | 'prepare-open' | 'install-rename' | 'unwritable-dir',
  lockPath: '',
  /** For `unwritable-dir`: the directory nothing can be created in, as for EACCES or EPERM. */
  unwritableDir: '',
  code: 'EPERM' as 'EPERM' | 'EACCES',
}));

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof fsPromises>();
  const permissionError = (path: string, dest?: string): NodeJS.ErrnoException => {
    const error = new Error(`permission denied: ${path}`) as NodeJS.ErrnoException & {
      dest?: string;
    };
    error.code = lockFault.code;
    error.path = path;
    error.dest = dest;
    return error;
  };

  const insideUnwritableDir = (path: string): boolean =>
    lockFault.kind === 'unwritable-dir' && path.startsWith(`${lockFault.unwritableDir}${sep}`);

  return {
    ...actual,
    access: vi.fn(async (...args: Parameters<typeof actual.access>) => {
      const path = String(args[0]);
      const mode = args[1] ?? actual.constants.F_OK;
      if (
        lockFault.kind === 'unwritable-dir' &&
        path === lockFault.unwritableDir &&
        (mode & actual.constants.W_OK) !== 0
      ) {
        throw permissionError(path);
      }
      return actual.access(...args);
    }),
    mkdir: vi.fn(async (...args: Parameters<typeof actual.mkdir>) => {
      const path = String(args[0]);
      if (lockFault.kind === 'prepare-mkdir' && path.startsWith(`${lockFault.lockPath}.owner-`)) {
        throw permissionError(path);
      }
      if (insideUnwritableDir(path)) {
        throw permissionError(path);
      }
      return actual.mkdir(...args);
    }),
    open: vi.fn(async (...args: Parameters<typeof actual.open>) => {
      const path = String(args[0]);
      if (lockFault.kind === 'prepare-open' && path.startsWith(`${lockFault.lockPath}.owner-`)) {
        throw permissionError(path);
      }
      return actual.open(...args);
    }),
    rename: vi.fn(async (source: string, destination: string) => {
      if (
        lockFault.kind === 'install-rename' &&
        destination === join(lockFault.lockPath, 'owner')
      ) {
        throw permissionError(source, destination);
      }
      return actual.rename(source, destination);
    }),
  };
});

import {
  assertSharedDataSyncLockWritable,
  SharedLockUnwritableError,
  withSharedDataSyncLock,
} from '../src/file/common-dir-layout.js';
import { previewDataSyncContext } from '../src/cli/lib/data-context.js';
import { resolveSharedTbdPaths, type SharedTbdPaths } from '../src/lib/paths.js';

const execFileAsync = promisify(execFile);

describe('shared lock permission diagnostics', () => {
  let repository: string;
  let paths: SharedTbdPaths;

  beforeEach(async () => {
    repository = await mkdtemp(join(tmpdir(), 'tbd-shared-lock-permission-'));
    await execFileAsync('git', ['init', '--initial-branch=main'], { cwd: repository });
    paths = await resolveSharedTbdPaths(repository);
    lockFault.lockPath = paths.sharedLockPath;
  });

  afterEach(async () => {
    lockFault.kind = 'none';
    lockFault.lockPath = '';
    lockFault.unwritableDir = '';
    lockFault.code = 'EPERM';
    await rm(repository, { recursive: true, force: true });
  });

  it.each([
    ['owner-generation directory preparation', 'prepare-mkdir', 'EPERM'],
    ['owner-record preparation', 'prepare-open', 'EACCES'],
    ['owner-generation installation', 'install-rename', 'EPERM'],
  ] as const)('classifies %s permission failures', async (_name, kind, code) => {
    lockFault.kind = kind;
    lockFault.code = code;
    let executed = false;

    let caught: unknown;
    try {
      await withSharedDataSyncLock(repository, () => {
        executed = true;
        return Promise.resolve();
      });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(SharedLockUnwritableError);
    expect(caught).toMatchObject({ code });
    expect(executed).toBe(false);
    await expect(stat(paths.sharedLockPath)).rejects.toMatchObject({ code: 'ENOENT' });
    expect(await readdir(paths.sharedLocksDir)).toEqual([]);
  });

  it('preserves an unrelated permission error from the critical section', async () => {
    const unrelated = new Error('issue write denied') as NodeJS.ErrnoException;
    unrelated.code = 'EPERM';
    unrelated.path = join(paths.sharedDataSyncDir, 'issues', 'tbd-example.yml');

    await expect(withSharedDataSyncLock(repository, () => Promise.reject(unrelated))).rejects.toBe(
      unrelated,
    );

    await expect(stat(paths.sharedLockPath)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  // A dry run must report the failure the real run hits (#164's sandbox shape) without
  // taking the lock, and with the real run's own message.
  it.each([
    { name: 'the locks directory', unwritable: 'locks', code: 'EPERM' },
    {
      name: 'the git common directory, before any tbd state exists',
      unwritable: 'common',
      code: 'EACCES',
    },
  ] as const)(
    'a lock-free preview raises the same error when $name is unwritable',
    async ({ unwritable, code }) => {
      if (unwritable === 'locks') {
        await mkdir(paths.sharedLocksDir, { recursive: true });
      }
      lockFault.kind = 'unwritable-dir';
      lockFault.unwritableDir = unwritable === 'locks' ? paths.sharedLocksDir : paths.gitCommonDir;
      lockFault.code = code;

      const real = await withSharedDataSyncLock(repository, () => Promise.resolve()).catch(
        (error: unknown) => error,
      );
      expect(real).toBeInstanceOf(SharedLockUnwritableError);
      expect(real).toMatchObject({ code });

      for (const preview of [
        assertSharedDataSyncLockWritable(repository),
        previewDataSyncContext(repository),
      ]) {
        const caught = await preview.catch((error: unknown) => error);
        expect(caught).toBeInstanceOf(SharedLockUnwritableError);
        expect((caught as Error).message).toBe((real as Error).message);
      }
      await expect(stat(paths.sharedLockPath)).rejects.toMatchObject({ code: 'ENOENT' });
    },
  );

  it('a lock-free preview passes where the lock can be taken, and creates nothing', async () => {
    await expect(assertSharedDataSyncLockWritable(repository)).resolves.toBeUndefined();
    await expect(stat(paths.sharedTbdDir)).rejects.toMatchObject({ code: 'ENOENT' });
  });
});
