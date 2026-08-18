/**
 * Enumerating the sidecar directories a lock leaves beside itself.
 *
 * `listLockSidecars` reports what is on disk and nothing more; deciding which
 * entries are safe to delete is the caller's policy (see `clearableLockSidecars`
 * in doctor). The split matters because "safe to remove" depends on why you are
 * asking, while "these exist and here is who owned them" does not.
 *
 * The load-bearing test is the round trip: real stale recovery writes a sidecar,
 * and enumeration must find it. Acquisition, recovery, and enumeration each
 * depend on the same naming convention, and a suffix change that broke only the
 * third would otherwise be invisible.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, mkdir, rm, writeFile, utimes } from 'node:fs/promises';
import { hostname, tmpdir } from 'node:os';
import { basename, join } from 'node:path';

import {
  listLockSidecars,
  lockOwnerIsDefinitelyDead,
  withLockfile,
} from '../src/utils/lockfile.js';

let dir: string;
let lockPath: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'tbd-lock-sidecars-'));
  lockPath = join(dir, 'data-sync.lock');
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const TOKEN_A = '00000000-0000-4000-8000-00000000000a';
const TOKEN_B = '00000000-0000-4000-8000-00000000000b';

/** A pid high enough that it cannot be running on this host. */
const DEAD_PID = 2_147_483_647;

async function writeSidecar(
  kind: 'owner' | 'stale',
  token: string,
  record: { host: string; pid: number } | null,
): Promise<string> {
  const path = `${lockPath}.${kind}-${token}`;
  await mkdir(path, { recursive: true });
  if (record) {
    const encoded = `${JSON.stringify({ version: 1, token, host: record.host, pid: record.pid })}\n`;
    if (kind === 'owner') {
      // A prepared generation: the record sits at the top level.
      await writeFile(join(path, 'record'), encoded);
    } else {
      // A quarantined lock directory: the record is under `owner/`.
      await mkdir(join(path, 'owner'), { recursive: true });
      await writeFile(join(path, 'owner', 'record'), encoded);
    }
  }
  return path;
}

describe('listLockSidecars', () => {
  it('finds a sidecar that real stale recovery produced', async () => {
    // The round trip. Build a lock owned by a dead pid, age it past the stale
    // window, then contend for it: recovery quarantines the old generation into
    // a sidecar, which enumeration must then find. This is what keeps the three
    // users of the naming convention in step.
    await mkdir(lockPath);
    await writeFile(
      join(lockPath, 'owner'),
      `${JSON.stringify({ version: 1, token: TOKEN_A, host: hostname(), pid: DEAD_PID })}\n`,
    );
    const old = new Date(Date.now() - 60_000);
    await utimes(lockPath, old, old);

    await withLockfile(lockPath, () => Promise.resolve(), {
      timeoutMs: 5_000,
      pollMs: 20,
      staleMs: 1_000,
    });

    const sidecars = await listLockSidecars(lockPath);
    expect(sidecars).toHaveLength(1);
    expect(sidecars[0]?.kind).toBe('stale');
    expect(basename(sidecars[0]?.path ?? '')).toContain(TOKEN_A);
  });

  it('reports both kinds with their owner records', async () => {
    await writeSidecar('owner', TOKEN_A, { host: hostname(), pid: DEAD_PID });
    await writeSidecar('stale', TOKEN_B, { host: hostname(), pid: DEAD_PID });

    const found = await listLockSidecars(lockPath);
    expect(found.map((s) => s.kind).sort()).toEqual(['owner', 'stale']);
    expect(found.every((s) => s.owner !== null)).toBe(true);
  });

  it('never returns the live lock directory itself', async () => {
    // Breaking the real lock is stale recovery's job, under its own age and
    // liveness rules. Enumeration must not hand it to a cleanup sweep.
    await mkdir(lockPath, { recursive: true });
    await writeFile(
      join(lockPath, 'owner'),
      `${JSON.stringify({ version: 1, token: TOKEN_A, host: hostname(), pid: process.pid })}\n`,
    );
    expect(await listLockSidecars(lockPath)).toEqual([]);
  });

  it('reports a null owner for a sidecar with no readable record', async () => {
    await writeSidecar('owner', TOKEN_A, null);
    const found = await listLockSidecars(lockPath);
    expect(found).toHaveLength(1);
    expect(found[0]?.owner).toBeNull();
  });

  it('ignores another lock, a non-sidecar directory, and a malformed token', async () => {
    await mkdir(join(dir, `other.lock.owner-${TOKEN_A}`), { recursive: true });
    await mkdir(join(dir, 'not-a-sidecar'), { recursive: true });
    await mkdir(`${lockPath}.owner-not-a-uuid`, { recursive: true });
    expect(await listLockSidecars(lockPath)).toEqual([]);
  });

  it('reads the owner out of a stale sidecar, whose record is nested', async () => {
    // Regression: reading a stale sidecar as if it were a prepared generation
    // reports owner: null, and an ownerless sidecar looks like it protects
    // nobody. A stale sidecar can be quarantining a live holder.
    await writeSidecar('stale', TOKEN_B, { host: `${hostname()}-elsewhere`, pid: 4242 });
    const [sidecar] = await listLockSidecars(lockPath);
    expect(sidecar?.owner).not.toBeNull();
    expect(sidecar?.owner?.pid).toBe(4242);
    expect(lockOwnerIsDefinitelyDead(sidecar!.owner!)).toBe(false);
  });

  it('returns nothing when the parent directory is absent', async () => {
    expect(await listLockSidecars(join(dir, 'missing', 'x.lock'))).toEqual([]);
  });
});

describe('lockOwnerIsDefinitelyDead', () => {
  it('proves a departed pid on this host', () => {
    expect(
      lockOwnerIsDefinitelyDead({ version: 1, token: TOKEN_A, host: hostname(), pid: DEAD_PID }),
    ).toBe(true);
  });

  it('never calls a live process dead', () => {
    expect(
      lockOwnerIsDefinitelyDead({ version: 1, token: TOKEN_A, host: hostname(), pid: process.pid }),
    ).toBe(false);
  });

  it('fails closed on a record from another host', () => {
    // The pid is meaningless here: it may well be alive on the host that wrote it.
    expect(
      lockOwnerIsDefinitelyDead({
        version: 1,
        token: TOKEN_A,
        host: `${hostname()}-elsewhere`,
        pid: DEAD_PID,
      }),
    ).toBe(false);
  });
});
