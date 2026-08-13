/** Permission diagnostics across the complete shared-lock acquisition protocol. */

import { execFile } from 'node:child_process';
import { mkdtemp, readdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type * as fsPromises from 'node:fs/promises';

const lockFault = vi.hoisted(() => ({
  kind: 'none' as 'none' | 'prepare-mkdir' | 'prepare-open' | 'install-rename',
  lockPath: '',
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

  return {
    ...actual,
    mkdir: vi.fn(async (...args: Parameters<typeof actual.mkdir>) => {
      const path = String(args[0]);
      if (lockFault.kind === 'prepare-mkdir' && path.startsWith(`${lockFault.lockPath}.owner-`)) {
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
  SharedLockUnwritableError,
  withSharedDataSyncLock,
} from '../src/file/common-dir-layout.js';
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
});
