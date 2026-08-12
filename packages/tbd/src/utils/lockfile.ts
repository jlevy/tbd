/**
 * Directory-based mutual exclusion for concurrent file access.
 *
 * Note: Despite the name "lockfile", this is NOT a POSIX file lock (flock/fcntl).
 * It uses mkdir to create a lock *directory* as a coordination convention; no
 * OS-level file locking syscalls are involved. Atomic acquisition is portable across
 * common local and network filesystems. Automatic stale recovery is deliberately
 * narrower: it requires the recorded owner and waiter to share one host identity and
 * OS PID namespace; other cases retain mutual exclusion but fail closed on recovery.
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
 * 1. **Acquire**: Prepare a complete token/host/pid owner-generation directory, then
 *    `mkdir(lockDir)`; mkdir remains the sole election and fails with EEXIST if held by
 *    another process. The winner atomically renames the prepared generation to
 *    `lockDir/owner` before entering the critical section. An installed generation is
 *    non-empty, so a delayed installer cannot overwrite a successor.
 *    On Windows, a concurrent release can instead surface as a transient EPERM
 *    (NTFS delete-pending directory); this is treated as a busy lock and retried
 *    for a short window, after which the raw EPERM is rethrown (a persistent
 *    EPERM is a genuine permission problem, not the delete-pending race).
 * 2. **Hold**: Best-effort heartbeat the directory mtime and execute the critical
 *    section. The owner token and PID, not heartbeat success, are authoritative.
 * 3. **Release**: Verify the same owner record, rename that generation out of the
 *    canonical path, then remove the sidecar with bounded Windows retries. A cleanup
 *    failure cannot strand an ownerless canonical lock or delete a successor.
 * 4. **Stale detection**: Age only makes a lock eligible for inspection. A recognized
 *    same-host owner is recoverable only when its pid is definitely absent; ambiguous,
 *    remote, and non-empty unrecognized generations fail closed. A stale empty
 *    ownerless directory uses the historical mkdir-lock recovery rule and can be
 *    removed because the new protocol never enters its critical section ownerless.
 *    A dead recognized generation is renamed to a retained token-derived quarantine
 *    path. That non-empty tombstone prevents a delayed waiter from renaming a successor
 *    through canonical-path ABA. A live holder's heartbeat normally avoids the
 *    liveness check altogether.
 *
 * ## Failure on timeout
 *
 * If the lock cannot be acquired within the timeout, a LockAcquisitionError is
 * thrown. This prevents the dangerous "degraded mode" where the critical section
 * runs without mutual exclusion, which can cause data loss (e.g., lost ID
 * mappings during concurrent `tbd create`).
 *
 * IMPORTANT: `timeoutMs` should be greater than `staleMs` so a definitely dead owner
 * can be quarantined before timeout. Safety takes precedence over recovery when owner
 * liveness cannot be proved.
 */

import { mkdir, open, rename, rmdir, stat, unlink, utimes } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { hostname } from 'node:os';
import { join } from 'node:path';

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
 * A unique owner record and one-minute-or-faster heartbeat keep normal live operations
 * from crossing the 30-minute stale threshold. PID liveness keeps a suspended process
 * owned even after that threshold; release checks the record, so an externally
 * displaced holder cannot remove its successor's lock.
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
        `verify that no process is writing before removing the lock directory and retrying.`,
    );
    this.name = 'LockAcquisitionError';
  }
}

/** Filesystem error codes that are transient on Windows and worth retrying. */
const TRANSIENT_RMDIR_CODES = new Set(['EBUSY', 'EPERM', 'EACCES', 'ENOTEMPTY']);
const TRANSIENT_RENAME_CODES = new Set(['EBUSY', 'EPERM', 'EACCES']);

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
const LOCK_OWNER_FILE = 'owner';
const LOCK_OWNER_RECORD_FILE = 'record';
const LOCK_OWNER_VERSION = 1;
const MAX_LOCK_OWNER_BYTES = 1_024;
const MAX_HEARTBEAT_INTERVAL_MS = 60_000;
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

interface LockOwnerRecord {
  version: typeof LOCK_OWNER_VERSION;
  token: string;
  host: string;
  pid: number;
}

/** Lease passed to advanced critical sections that publish their own commit marker. */
export interface LockLease {
  /** Fail if stale recovery displaced this holder. */
  assertOwned(): Promise<void>;
}

class LockOwnershipLostError extends Error {
  constructor(lockPath: string) {
    super(`Lost ownership of lock at ${lockPath} while its critical section was running`);
    this.name = 'LockOwnershipLostError';
  }
}

function isMissing(error: unknown): boolean {
  return (error as NodeJS.ErrnoException).code === 'ENOENT';
}

function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

async function readBoundedOwnerRecord(path: string): Promise<string | null> {
  let handle;
  try {
    handle = await open(path, 'r');
  } catch (error) {
    if (isMissing(error)) {
      return null;
    }
    throw error;
  }
  try {
    const buffer = Buffer.allocUnsafe(MAX_LOCK_OWNER_BYTES + 1);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    if (bytesRead > MAX_LOCK_OWNER_BYTES) {
      throw new Error(`Lock owner record at ${path} exceeds ${MAX_LOCK_OWNER_BYTES} bytes`);
    }
    return buffer.subarray(0, bytesRead).toString('utf8').trim();
  } finally {
    await handle.close();
  }
}

/** Read the portable owner-directory layout, with legacy owner-file compatibility. */
async function readLockOwner(lockPath: string): Promise<string | null> {
  const ownerPath = join(lockPath, LOCK_OWNER_FILE);
  let ownerStat;
  try {
    ownerStat = await stat(ownerPath);
  } catch (error) {
    if (isMissing(error)) {
      return null;
    }
    throw error;
  }
  return readBoundedOwnerRecord(
    ownerStat.isDirectory() ? join(ownerPath, LOCK_OWNER_RECORD_FILE) : ownerPath,
  );
}

function createLockOwner(): LockOwnerRecord {
  return {
    version: LOCK_OWNER_VERSION,
    token: randomUUID(),
    host: hostname(),
    pid: process.pid,
  };
}

function encodeLockOwner(owner: LockOwnerRecord): string {
  return JSON.stringify(owner);
}

function parseLockOwner(value: string): LockOwnerRecord | null {
  try {
    const candidate: unknown = JSON.parse(value);
    if (
      typeof candidate !== 'object' ||
      candidate === null ||
      !('version' in candidate) ||
      candidate.version !== LOCK_OWNER_VERSION ||
      !('token' in candidate) ||
      typeof candidate.token !== 'string' ||
      !UUID_V4.test(candidate.token) ||
      !('host' in candidate) ||
      typeof candidate.host !== 'string' ||
      candidate.host.length === 0 ||
      !('pid' in candidate) ||
      typeof candidate.pid !== 'number' ||
      !Number.isSafeInteger(candidate.pid) ||
      candidate.pid <= 0
    ) {
      return null;
    }
    return candidate as LockOwnerRecord;
  } catch {
    return null;
  }
}

/** True only when this host can prove that the recorded owner process has exited. */
function ownerIsDefinitelyDead(owner: LockOwnerRecord): boolean {
  if (owner.host !== hostname()) {
    return false;
  }
  try {
    process.kill(owner.pid, 0);
    return false;
  } catch (error) {
    // EPERM means the process exists but this user cannot signal it. Every ambiguous
    // result fails closed; only ESRCH is proof that the pid is absent on this host.
    return (error as NodeJS.ErrnoException).code === 'ESRCH';
  }
}

/** Read the same recognized owner before and after the age/liveness decision. */
async function captureDefinitelyDeadOwner(lockPath: string): Promise<LockOwnerRecord | null> {
  const before = await readLockOwner(lockPath);
  if (before === null) {
    return null;
  }
  const owner = parseLockOwner(before);
  if (owner === null || !ownerIsDefinitelyDead(owner)) {
    return null;
  }
  return (await readLockOwner(lockPath)) === before ? owner : null;
}

async function assertLockOwner(lockPath: string, owner: string): Promise<void> {
  if ((await readLockOwner(lockPath)) !== owner) {
    throw new LockOwnershipLostError(lockPath);
  }
}

interface LockHeartbeat {
  lease: LockLease;
  stop(): Promise<void>;
}

/** Refresh a live lock well before stale recovery can consider it abandoned. */
function startLockHeartbeat(lockPath: string, owner: string, staleMs: number): LockHeartbeat {
  const intervalMs = Math.max(1, Math.min(MAX_HEARTBEAT_INTERVAL_MS, Math.floor(staleMs / 3)));
  let stopped = false;
  let disabled = false;
  let timer: NodeJS.Timeout | null = null;
  let inFlight = Promise.resolve();

  const assertOwned = (): Promise<void> => assertLockOwner(lockPath, owner);
  const schedule = (): void => {
    if (stopped || disabled) {
      return;
    }
    timer = setTimeout(() => {
      timer = null;
      inFlight = (async () => {
        await assertLockOwner(lockPath, owner);
        const now = new Date();
        await utimes(lockPath, now, now);
      })()
        .catch(() => {
          // Heartbeats reduce unnecessary stale-owner probes; they do not establish
          // ownership. A timestamp/read failure disables this advisory optimization,
          // while the direct token check at commit/release remains authoritative.
          // Same-host PID liveness still prevents a live holder from being evicted.
          disabled = true;
        })
        .finally(schedule);
    }, intervalMs);
    timer.unref();
  };
  schedule();

  return {
    lease: { assertOwned },
    stop: async () => {
      stopped = true;
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
      await inFlight;
    },
  };
}

/** Build a complete non-empty owner generation before contending for the lock. */
async function prepareLockOwnerGeneration(
  lockPath: string,
  owner: LockOwnerRecord,
  encodedOwner: string,
): Promise<string> {
  const preparedPath = `${lockPath}.owner-${owner.token}`;
  let created = false;
  try {
    await mkdir(preparedPath);
    created = true;
    const handle = await open(join(preparedPath, LOCK_OWNER_RECORD_FILE), 'wx');
    try {
      await handle.writeFile(`${encodedOwner}\n`);
    } finally {
      await handle.close();
    }
  } catch (error) {
    if (created) {
      await removeOwnerGenerationDir(preparedPath);
    }
    throw error;
  }
  return preparedPath;
}

/** Best-effort cleanup for an uninstalled or already-detached owner generation. */
async function removeOwnerGenerationDir(path: string, attempts = 5): Promise<void> {
  let recordRemoved = false;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      if (!recordRemoved) {
        await unlink(join(path, LOCK_OWNER_RECORD_FILE)).catch((error: unknown) => {
          if (!isMissing(error)) {
            throw error;
          }
        });
        recordRemoved = true;
      }
      await rmdir(path);
      return;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === 'ENOENT') {
        return;
      }
      if (attempt < attempts - 1 && code !== undefined && TRANSIENT_RMDIR_CODES.has(code)) {
        await new Promise((resolve) => setTimeout(resolve, 20 * (attempt + 1)));
        continue;
      }
      return;
    }
  }
}

/** Remove only an empty provisional lock; never unlink an installed owner generation. */
async function removeEmptyLockDir(lockPath: string, attempts = 5): Promise<boolean> {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      await rmdir(lockPath);
      return true;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === 'ENOENT') {
        return true;
      }
      if (code === 'ENOTEMPTY') {
        return false;
      }
      if (attempt < attempts - 1 && code !== undefined && TRANSIENT_RMDIR_CODES.has(code)) {
        await new Promise((resolve) => setTimeout(resolve, 20 * (attempt + 1)));
        continue;
      }
      return false;
    }
  }
  return false;
}

/**
 * Remove a lock directory, tolerating transient Windows failures.
 *
 * `rmdir` can intermittently fail with EBUSY/EPERM on Windows (antivirus scanners
 * or lingering directory handles). A few short retries make release reliable; if it
 * still fails, we leave the sidecar for filesystem maintenance rather than throwing
 * from a best-effort cleanup path. Canonical acquisition never depends on a release
 * sidecar being removed.
 */
async function removeLockDir(lockPath: string, expectedOwner: string, attempts = 5): Promise<void> {
  let ownerRemoved = false;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      if (!ownerRemoved) {
        if ((await readLockOwner(lockPath)) !== expectedOwner) {
          return;
        }
        const ownerPath = join(lockPath, LOCK_OWNER_FILE);
        const ownerStat = await stat(ownerPath);
        if (ownerStat.isDirectory()) {
          await removeOwnerGenerationDir(ownerPath);
          try {
            await stat(ownerPath);
            return;
          } catch (error) {
            if (!isMissing(error)) {
              throw error;
            }
          }
        } else {
          // Compatibility with locks created by the legacy owner-file layout.
          await unlink(ownerPath);
        }
        ownerRemoved = true;
      }
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
 * Renames the stale directory to a deterministic sidecar for that owner generation.
 * The sidecar is intentionally retained and non-empty. If a delayed waiter acts after
 * a successor has acquired the canonical path, its rename still targets the occupied
 * old-generation sidecar and fails without moving the successor. This is the ABA-safe
 * part of recovery; using a fresh random sidecar for each waiter would not be safe.
 */
async function breakStaleLock(lockPath: string, owner: LockOwnerRecord): Promise<boolean> {
  const sidecar = `${lockPath}.stale-${owner.token}`;
  try {
    await rename(lockPath, sidecar);
  } catch {
    // Another waiter already quarantined this exact generation, the holder released,
    // or a successor owns the canonical path. The retained, non-empty sidecar makes a
    // delayed rename for the old token fail instead of displacing that successor.
    return false;
  }
  return true;
}

/** Move a verified live generation out of the canonical path before best-effort cleanup. */
async function releaseOwnedLock(lockPath: string, encodedOwner: string): Promise<void> {
  const owner = parseLockOwner(encodedOwner);
  if (owner === null) {
    throw new Error(`Cannot release lock at ${lockPath} with an invalid owner record`);
  }
  const sidecar = `${lockPath}.released-${owner.token}`;
  let renamed = false;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await assertLockOwner(lockPath, encodedOwner);
    try {
      await rename(lockPath, sidecar);
      renamed = true;
      break;
    } catch (error) {
      if (isMissing(error)) {
        throw new LockOwnershipLostError(lockPath);
      }
      const code = (error as NodeJS.ErrnoException).code;
      if (attempt < 4 && code !== undefined && TRANSIENT_RENAME_CODES.has(code)) {
        await new Promise((resolve) => setTimeout(resolve, 20 * (attempt + 1)));
        continue;
      }
      throw error;
    }
  }
  if (!renamed) {
    throw new Error(`Failed to release lock generation at ${lockPath}`);
  }
  if ((await readLockOwner(sidecar)) !== encodedOwner) {
    throw new LockOwnershipLostError(lockPath);
  }
  // Cleanup can be retried by ordinary filesystem maintenance if Windows keeps a
  // transient handle open. The canonical lock path is already safely available.
  await removeLockDir(sidecar, encodedOwner);
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
  fn: (lease: LockLease) => Promise<T>,
  options?: LockfileOptions,
): Promise<T> {
  const ownerRecord = createLockOwner();
  const owner = encodeLockOwner(ownerRecord);
  const preparedOwnerPath = await prepareLockOwnerGeneration(lockPath, ownerRecord, owner);
  try {
    return await runWithPreparedLockGeneration(lockPath, fn, owner, preparedOwnerPath, options);
  } finally {
    // A successful rename consumed this path. On failure, this removes only our
    // token-derived private generation and cannot affect the canonical owner.
    await removeOwnerGenerationDir(preparedOwnerPath);
  }
}

async function runWithPreparedLockGeneration<T>(
  lockPath: string,
  fn: (lease: LockLease) => Promise<T>,
  owner: string,
  preparedOwnerPath: string,
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
      // mkdir is the established atomic election. Owner metadata is already complete,
      // but the winner does not enter its critical section until installation succeeds.
      await mkdir(lockPath);
      try {
        await rename(preparedOwnerPath, join(lockPath, LOCK_OWNER_FILE));
      } catch (error) {
        // Account for an ambiguous network-filesystem rename result before deciding the
        // installation failed. Otherwise remove only our still-empty provisional lock;
        // a displaced successor's non-empty generation cannot be removed or overwritten.
        const observedOwner = await readLockOwner(lockPath);
        if (observedOwner === owner) {
          acquired = true;
          break;
        }
        let ownerEntryExists = false;
        try {
          await stat(join(lockPath, LOCK_OWNER_FILE));
          ownerEntryExists = true;
        } catch (statError) {
          if (!isMissing(statError)) {
            throw statError;
          }
        }
        let preparedOwnerExists = false;
        try {
          await stat(preparedOwnerPath);
          preparedOwnerExists = true;
        } catch (statError) {
          if (!isMissing(statError)) {
            throw statError;
          }
        }
        await removeEmptyLockDir(lockPath);
        if (!preparedOwnerExists) {
          throw error;
        }
        const code = (error as NodeJS.ErrnoException).code;
        if (ownerEntryExists || code === 'EEXIST' || code === 'ENOTEMPTY' || code === 'ENOENT') {
          continue;
        }
        throw error;
      }
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
      } catch (statError) {
        if (isMissing(statError)) {
          continue;
        }
        throw statError;
      }

      // A non-directory at the lock path is unexpected filesystem state. Do not
      // rename it aside: that would move the user's file out of the way and let the
      // critical section run unprotected.
      if (!lockStat.isDirectory()) {
        throw new Error(
          `Lock path exists but is not a directory: ${lockPath}. ` +
            `Refusing to break it; remove the conflicting file and retry.`,
        );
      }

      if (Date.now() - lockStat.mtimeMs > staleMs) {
        const encodedHolder = await readLockOwner(lockPath);
        if (encodedHolder === null) {
          // Compatibility with the historical mkdir-only generation and recovery for a
          // crash in the new mkdir-to-owner-install window. Waiting for staleMs preserves
          // the legacy safety contract; rmdir succeeds only while the directory is empty.
          if (await removeEmptyLockDir(lockPath)) {
            continue;
          }
        }
        const holder = await captureDefinitelyDeadOwner(lockPath);
        if (holder !== null && (await breakStaleLock(lockPath, holder))) {
          continue;
        }
      }

      // Lock is fresh, live, or ambiguous; wait and retry.
      await new Promise((resolve) => setTimeout(resolve, pollMs));
    }
  }

  if (!acquired) {
    throw new LockAcquisitionError(lockPath, timeoutMs);
  }

  const heartbeat = startLockHeartbeat(lockPath, owner, staleMs);
  let result: T | undefined;
  let criticalError: Error | undefined;
  try {
    await heartbeat.lease.assertOwned();
    result = await fn(heartbeat.lease);
  } catch (error) {
    criticalError = asError(error);
  }

  let ownershipError: Error | undefined;
  try {
    await heartbeat.stop();
    await heartbeat.lease.assertOwned();
  } catch (error) {
    ownershipError = asError(error);
  }
  // Once ownership loss is visible, the canonical path is not ours to touch. On the
  // normal path, move our verified generation aside atomically before cleanup so a
  // transient cleanup failure cannot strand an ownerless canonical lock directory.
  if (ownershipError === undefined) {
    try {
      await releaseOwnedLock(lockPath, owner);
    } catch (error) {
      ownershipError = asError(error);
    }
  }

  if (criticalError !== undefined && ownershipError !== undefined) {
    throw new AggregateError(
      [criticalError, ownershipError],
      `Critical section failed after losing lock ownership at ${lockPath}`,
    );
  }
  if (criticalError !== undefined) {
    throw criticalError;
  }
  if (ownershipError !== undefined) {
    throw ownershipError;
  }
  return result as T;
}
