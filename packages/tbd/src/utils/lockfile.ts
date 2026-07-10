/**
 * Directory-based mutual exclusion for concurrent file access.
 *
 * Note: Despite the name "lockfile", this is NOT a POSIX file lock (flock/fcntl).
 * It uses mkdir to create a lock *directory* as a coordination convention; no
 * OS-level file locking syscalls are involved. This makes it portable across all
 * filesystems, including NFS and other network mounts where flock/fcntl locks
 * are unreliable or unsupported.
 *
 * This is the same strategy used by:
 *
 * - **Git** for ref updates (e.g., `.git/refs/heads/main.lock`)
 *   See: https://git-scm.com/docs/gitrepository-layout ("lockfile protocol")
 * - **npm** for package-lock.json concurrent access
 *
 * ## Why mkdir?
 *
 * `mkdir(2)` is atomic on all common filesystems (local and network): it either
 * creates the directory or returns EEXIST. Unlike `open(O_CREAT|O_EXCL)`,
 * a directory lock is trivially distinguishable from normal files.
 *
 * Node.js `fs.mkdir` maps directly to the mkdir(2) syscall, preserving
 * the atomicity guarantee:
 *   https://nodejs.org/api/fs.html#fsmkdirpath-options-callback
 *
 * ## Lock lifecycle
 *
 * 1. **Acquire**: `mkdir(lockDir)`; fails with EEXIST if held by another process.
 *    On Windows, a concurrent release can instead surface as a transient EPERM
 *    (NTFS delete-pending directory); this is treated as a busy lock and retried
 *    for a short window, after which the raw EPERM is rethrown (a persistent
 *    EPERM is a genuine permission problem, not the delete-pending race).
 * 2. **Hold**: Execute the critical section
 * 3. **Release**: `rmdir(lockDir)`, in a finally block, with a bounded retry to
 *    absorb transient Windows failures (EBUSY/EPERM from AV scanners or lingering
 *    handles) that would otherwise orphan the lock directory.
 * 4. **Stale detection**: If lock mtime exceeds a threshold, assume the holder
 *    crashed and break the lock. Breaking is done **atomically** by renaming the
 *    stale directory aside (only one waiter can win the rename), so two waiters can
 *    never both break the same lock and end up running concurrently. This is a
 *    heuristic; safe when the critical section is short-lived (sub-second for
 *    file I/O).
 *
 * ## Failure on timeout
 *
 * If the lock cannot be acquired within the timeout, a LockAcquisitionError is
 * thrown. This prevents the dangerous "degraded mode" where the critical section
 * runs without mutual exclusion, which can cause data loss (e.g., lost ID
 * mappings during concurrent `tbd create`).
 *
 * IMPORTANT: `timeoutMs` must be greater than `staleMs` so stale locks from
 * crashed processes are always detected and broken before the timeout expires.
 */

import { mkdir, rename, rmdir, stat } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';

/** Options for `withLockfile`. */
export interface LockfileOptions {
  /** Maximum time (ms) to wait for the lock. Default: 10000 */
  timeoutMs?: number;
  /** Polling interval (ms) between acquisition attempts. Default: 50 */
  pollMs?: number;
  /** Age (ms) after which a lock is considered stale. Default: 5000 */
  staleMs?: number;
}

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_POLL_MS = 50;
const DEFAULT_STALE_MS = 5_000;

/**
 * Lock timing profile for shared data-sync operations.
 *
 * Issue sync can include fetch, merge, push, and outbox import work, so it must
 * not use the short stale window intended for single-file writes. `timeoutMs`
 * is kept just above `staleMs` so a crashed-process lock is always broken as
 * stale before the timeout expires, matching the invariant documented above.
 *
 * Accepted trade-off (no heartbeat): a live `tbd sync` that hangs longer than
 * `staleMs` (30 min) can have its lock broken by another process mid-operation.
 * For current data sizes this is acceptable; single-repo sync workloads
 * complete well under the window, and adding heartbeat metadata adds
 * cross-process state machinery without changing the common case. If sync
 * workloads grow or the lock-break race becomes observable in practice,
 * revisit by adding heartbeat metadata inside the lock directory (touch mtime
 * periodically; treat as stale only if heartbeat is older than `staleMs`).
 * See: plan-2026-05-17-shared-common-dir-sync-worktree.md §Post-Review
 * Hardening H6.
 */
export const DATA_SYNC_LOCK_OPTIONS: Required<LockfileOptions> = {
  timeoutMs: 35 * 60_000,
  pollMs: 250,
  staleMs: 30 * 60_000,
};

/**
 * Error thrown when the lock cannot be acquired within the timeout.
 */
export class LockAcquisitionError extends Error {
  constructor(lockPath: string, timeoutMs: number) {
    super(
      `Failed to acquire lock at ${lockPath} within ${timeoutMs}ms. ` +
        `Another process may be holding the lock. If this persists, ` +
        `delete the lock directory manually and retry.`,
    );
    this.name = 'LockAcquisitionError';
  }
}

/** Filesystem error codes that are transient on Windows and worth retrying. */
const TRANSIENT_RMDIR_CODES = new Set(['EBUSY', 'EPERM', 'EACCES', 'ENOTEMPTY']);

/**
 * How long consecutive EPERM failures from the acquisition mkdir are retried on
 * Windows before the error is rethrown. A delete-pending EPERM clears as soon as
 * the concurrent rmdir completes (milliseconds); an EPERM that persists past this
 * window is a genuine permission problem and must surface as the raw
 * ErrnoException — callers translate it into actionable guidance (e.g.
 * `SharedLockUnwritableError` in withSharedDataSyncLock) rather than letting it
 * burn the whole acquisition timeout and misreport as lock contention.
 */
const WIN32_EPERM_RETRY_WINDOW_MS = 1_000;

/**
 * Remove a lock directory, tolerating transient Windows failures.
 *
 * `rmdir` can intermittently fail with EBUSY/EPERM on Windows (antivirus scanners
 * or lingering directory handles). A few short retries make release reliable; if it
 * still fails, we give up and let stale detection reclaim the directory rather than
 * throwing from a best-effort cleanup path.
 */
async function removeLockDir(lockPath: string, attempts = 5): Promise<void> {
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      await rmdir(lockPath);
      return;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === 'ENOENT') {
        return; // Already gone; nothing to do.
      }
      if (attempt < attempts - 1 && code && TRANSIENT_RMDIR_CODES.has(code)) {
        await new Promise((resolve) => setTimeout(resolve, 20 * (attempt + 1)));
        continue;
      }
      return; // Non-transient or out of attempts: best-effort, leave for stale detection.
    }
  }
}

/**
 * Atomically break a stale lock.
 *
 * Renames the stale directory to a unique sidecar path and removes it. `rename` is
 * atomic, so when several waiters race to break the same stale lock only one wins the
 * rename; the losers see ENOENT and simply retry. This prevents the classic
 * non-atomic break race (rmdir + mkdir) where two waiters both break the lock and both
 * acquire it, defeating mutual exclusion.
 */
async function breakStaleLock(lockPath: string): Promise<void> {
  const sidecar = `${lockPath}.stale-${randomUUID()}`;
  try {
    await rename(lockPath, sidecar);
  } catch {
    // Another waiter already broke or released it, or the holder is no longer stale.
    return;
  }
  await removeLockDir(sidecar);
}

/**
 * Execute `fn` while holding a lockfile.
 *
 * The lock is a directory at `lockPath` (typically `<target-file>.lock`).
 * Concurrent callers will wait up to `timeoutMs` for the lock, polling
 * every `pollMs`. Stale locks older than `staleMs` are broken automatically.
 *
 * If the lock cannot be acquired within the timeout, a LockAcquisitionError
 * is thrown. This ensures mutual exclusion is never silently bypassed, which
 * prevents data loss from concurrent writes.
 *
 * @param lockPath - Path to use as the lock directory (e.g., "/path/to/ids.yml.lock")
 * @param fn - Critical section to execute under the lock
 * @param options - Timing parameters for lock acquisition
 * @returns The return value of `fn`
 * @throws LockAcquisitionError if the lock cannot be acquired within the timeout
 *
 * @example
 * ```ts
 * await withLockfile('/path/to/ids.yml.lock', async () => {
 *   const data = await readFile('/path/to/ids.yml', 'utf-8');
 *   const updated = mergeEntries(data, newEntries);
 *   await writeFile('/path/to/ids.yml', updated);
 * });
 * ```
 */
export async function withLockfile<T>(
  lockPath: string,
  fn: () => Promise<T>,
  options?: LockfileOptions,
): Promise<T> {
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const pollMs = options?.pollMs ?? DEFAULT_POLL_MS;
  const staleMs = options?.staleMs ?? DEFAULT_STALE_MS;

  const deadline = Date.now() + timeoutMs;
  let acquired = false;
  let epermStreakStart: number | undefined;

  while (Date.now() < deadline) {
    try {
      // mkdir is atomic per POSIX.1-2017; fails with EEXIST if already held
      await mkdir(lockPath);
      acquired = true;
      break;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;

      // On Windows, mkdir can transiently fail with EPERM instead of EEXIST when
      // the lock directory is concurrently being removed (NTFS delete-pending
      // state — the same behavior that leads rimraf/graceful-fs to retry EPERM
      // there). Treat it as a busy lock and retry, but only for a short window
      // of consecutive EPERM failures: one that persists is a real permission
      // problem and must be rethrown raw for callers to translate.
      if (code === 'EPERM' && process.platform === 'win32') {
        epermStreakStart ??= Date.now();
        if (Date.now() - epermStreakStart > WIN32_EPERM_RETRY_WINDOW_MS) {
          throw error;
        }
        await new Promise((resolve) => setTimeout(resolve, pollMs));
        continue;
      }
      epermStreakStart = undefined;

      if (code !== 'EEXIST') {
        // Unexpected error (permissions, disk full, missing parent, etc.):
        // preserve the original failure instead of misreporting lock contention.
        throw error;
      }

      // Lock exists; inspect it.
      let lockStat;
      try {
        lockStat = await stat(lockPath);
      } catch {
        // Lock was released between our mkdir and stat; retry immediately
        continue;
      }

      // A non-directory at the lock path is unexpected filesystem state. Do not
      // rename it aside: that would move the user's file out of the way and let the
      // critical section run unprotected. Fail loudly instead (mirrors how an
      // unexpected mkdir error is surfaced rather than masked as contention).
      if (!lockStat.isDirectory()) {
        throw new Error(
          `Lock path exists but is not a directory: ${lockPath}. ` +
            `Refusing to break it; remove the conflicting file and retry.`,
        );
      }

      if (Date.now() - lockStat.mtimeMs > staleMs) {
        // Break atomically so concurrent waiters can't both acquire.
        await breakStaleLock(lockPath);
        continue; // Retry immediately after breaking stale lock
      }

      // Lock is fresh; wait and retry
      await new Promise((resolve) => setTimeout(resolve, pollMs));
    }
  }

  if (!acquired) {
    throw new LockAcquisitionError(lockPath, timeoutMs);
  }

  try {
    return await fn();
  } finally {
    // Best-effort cleanup with retry; stale lock detection handles the rest.
    await removeLockDir(lockPath);
  }
}
