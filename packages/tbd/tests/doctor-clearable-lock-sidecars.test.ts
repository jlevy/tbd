/**
 * Which lock sidecars doctor is willing to delete.
 *
 * This is policy, deliberately kept out of the lock module: that module reports
 * what is on disk, and what counts as safe to remove depends on why you are
 * asking. Tested as a pure function because the interesting cases are about
 * refusing to act, which is awkward to observe end to end.
 */

import { describe, it, expect } from 'vitest';
import { hostname } from 'node:os';

import { clearableLockSidecars } from '../src/cli/commands/doctor.js';
import type { LockSidecar } from '../src/utils/lockfile.js';

const TOKEN = '00000000-0000-4000-8000-00000000000a';

/** A pid high enough that it cannot be running on this host. */
const DEAD_PID = 2_147_483_647;

function sidecar(
  kind: 'owner' | 'stale',
  owner: { host: string; pid: number } | null,
): LockSidecar {
  return {
    path: `/tmp/data-sync.lock.${kind}-${TOKEN}`,
    kind,
    owner: owner ? { version: 1, token: TOKEN, host: owner.host, pid: owner.pid } : null,
  };
}

describe('clearableLockSidecars', () => {
  it('clears a record whose process this host can prove has exited', () => {
    const dead = sidecar('owner', { host: hostname(), pid: DEAD_PID });
    expect(clearableLockSidecars([dead])).toEqual([dead]);
  });

  it('clears a sidecar with no readable record', () => {
    // It cannot name a live process, so keeping it guards nothing.
    const empty = sidecar('owner', null);
    expect(clearableLockSidecars([empty])).toEqual([empty]);
  });

  it('keeps a record naming a live process', () => {
    expect(
      clearableLockSidecars([sidecar('owner', { host: hostname(), pid: process.pid })]),
    ).toEqual([]);
  });

  it('keeps a record from another host', () => {
    // Its pid may well be alive over there; this host cannot tell.
    expect(
      clearableLockSidecars([sidecar('stale', { host: `${hostname()}-elsewhere`, pid: DEAD_PID })]),
    ).toEqual([]);
  });

  it('keeps a live stale sidecar while clearing a dead one beside it', () => {
    // The mixed case is the one that matters: a sweep must not take the whole
    // directory just because part of it is safe.
    const live = sidecar('stale', { host: `${hostname()}-elsewhere`, pid: 4242 });
    const dead = sidecar('owner', { host: hostname(), pid: DEAD_PID });
    expect(clearableLockSidecars([live, dead])).toEqual([dead]);
  });
});
