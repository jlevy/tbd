/**
 * Directory-based mutual exclusion for concurrent file access.
 *
 * Note: Despite the name "lockfile", this is NOT a POSIX file lock (flock/fcntl).
 * It uses mkdir to create a lock *directory* as a coordination convention — no
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
 * 1. **Acquire**: `mkdir(lockDir)` — fails with EEXIST if held by another process
 * 2. **Hold**: Execute the critical section
 * 3. **Release**: `rmdir(lockDir)` — in a finally block
 * 4. **Stale detection**: If lock mtime exceeds a threshold, assume the holder
 *    crashed and break the lock. This is a heuristic — safe when the critical
 *    section is short-lived (sub-second for file I/O).
 *
 * ## Degraded mode
 *
 * If the lock cannot be acquired within the timeout (e.g., due to a stuck
 * lockfile that isn't old enough to break), the critical section runs anyway.
 * Callers should design their critical sections to be safe without the lock
 * (e.g., using read-merge-write for append-only data).
 */

import { mkdir, rmdir, stat } from 'node:fs/promises';

/** Options for `withLockfile`. */
export interface LockfileOptions {
  /** Maximum time (ms) to wait for the lock. Default: 2000 */
  timeoutMs?: number;
  /** Polling interval (ms) between acquisition attempts. Default: 50 */
  pollMs?: number;
  /** Age (ms) after which a lock is considered stale. Default: 5000 */
  staleMs?: number;
}

const DEFAULT_TIMEOUT_MS = 2_000;
const DEFAULT_POLL_MS = 50;
const DEFAULT_STALE_MS = 5_000;

/**
 * Execute `fn` while holding a lockfile.
 *
 * The lock is a directory at `lockPath` (typically `<target-file>.lock`).
 * Concurrent callers will wait up to `timeoutMs` for the lock, polling
 * every `pollMs`. Stale locks older than `staleMs` are broken automatically.
 *
 * If the lock cannot be acquired, `fn` is still executed (degraded mode).
 * This ensures a stuck lockfile never permanently blocks the CLI.
 *
 * @param lockPath - Path to use as the lock directory (e.g., "/path/to/ids.yml.lock")
 * @param fn - Critical section to execute under the lock
 * @param options - Timing parameters for lock acquisition
 * @returns The return value of `fn`
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

  while (Date.now() < deadline) {
    try {
      // mkdir is atomic per POSIX.1-2017 — fails with EEXIST if already held
      await mkdir(lockPath);
      acquired = true;
      break;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
        // Unexpected error (permissions, disk full, etc.) — skip locking
        break;
      }

      // Lock exists — check if it's stale (holder likely crashed)
      try {
        const lockStat = await stat(lockPath);
        if (Date.now() - lockStat.mtimeMs > staleMs) {
          try {
            await rmdir(lockPath);
          } catch {
            // Another process may have already broken/released it
          }
          continue; // Retry immediately after breaking stale lock
        }
      } catch {
        // Lock was released between our mkdir and stat — retry immediately
        continue;
      }

      // Lock is fresh — wait and retry
      await new Promise((resolve) => setTimeout(resolve, pollMs));
    }
  }

  try {
    return await fn();
  } finally {
    if (acquired) {
      try {
        await rmdir(lockPath);
      } catch {
        // Best-effort cleanup; stale lock detection handles the rest
      }
    }
  }
}
