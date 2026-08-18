/**
 * Sweeping sidecar directories left by interrupted lock acquisitions.
 *
 * These accumulate silently: they take part in no mutual exclusion once
 * orphaned, so nothing ever trips over them, and they are simultaneously the
 * only durable record of which process held the lock. The behavior that matters
 * is the asymmetry — a record naming a dead pid is clutter and may be removed, a
 * record naming a live pid or another host may not be, because it can still
 * describe a legitimate holder.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, mkdir, rm, writeFile, readdir } from 'node:fs/promises';
import { hostname, tmpdir } from 'node:os';
import { basename, join } from 'node:path';

import { findAbandonedLockArtifacts, removeAbandonedLockArtifacts } from '../src/utils/lockfile.js';

let dir: string;
let lockPath: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'tbd-lock-artifacts-'));
  lockPath = join(dir, 'data-sync.lock');
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

async function writeSidecar(
  kind: 'owner' | 'stale',
  token: string,
  record: { host: string; pid: number } | null,
): Promise<string> {
  const path = `${lockPath}.${kind}-${token}`;
  await mkdir(path, { recursive: true });
  if (record) {
    await writeFile(
      join(path, 'record'),
      JSON.stringify({ version: 1, token, host: record.host, pid: record.pid }),
    );
  }
  return path;
}

/** Assert exactly one artifact was found, and return it typed. */
async function onlyArtifact(path: string) {
  const found = await findAbandonedLockArtifacts(path);
  expect(found).toHaveLength(1);
  const [artifact] = found;
  if (!artifact) {
    throw new Error('unreachable: length asserted above');
  }
  return artifact;
}

const TOKEN_A = '00000000-0000-4000-8000-00000000000a';
const TOKEN_B = '00000000-0000-4000-8000-00000000000b';
const TOKEN_C = '00000000-0000-4000-8000-00000000000c';

describe('findAbandonedLockArtifacts', () => {
  it('finds both sidecar kinds and reads their owner records', async () => {
    await writeSidecar('owner', TOKEN_A, { host: hostname(), pid: 999_999_998 });
    await writeSidecar('stale', TOKEN_B, { host: hostname(), pid: 999_999_997 });

    const found = await findAbandonedLockArtifacts(lockPath);
    expect(found.map((a) => a.kind).sort()).toEqual(['owner', 'stale']);
    expect(found.every((a) => a.owner !== null)).toBe(true);
  });

  it('never returns the live lock directory itself', async () => {
    // Removing the real lock is stale recovery's job, under its own age and
    // liveness rules. A cleanup sweep must not race it.
    await mkdir(lockPath, { recursive: true });
    await writeFile(
      join(lockPath, 'record'),
      JSON.stringify({ version: 1, token: TOKEN_A, host: hostname(), pid: process.pid }),
    );

    const found = await findAbandonedLockArtifacts(lockPath);
    expect(found).toEqual([]);
  });

  it('treats a record naming this live process as not dead', async () => {
    await writeSidecar('owner', TOKEN_A, { host: hostname(), pid: process.pid });
    const artifact = await onlyArtifact(lockPath);
    expect(artifact.deadOnThisHost).toBe(false);
  });

  it('fails closed on a record from another host', async () => {
    // The pid is meaningless here: it may be alive on the machine that wrote it.
    await writeSidecar('owner', TOKEN_A, { host: `${hostname()}-elsewhere`, pid: process.pid });
    const artifact = await onlyArtifact(lockPath);
    expect(artifact.deadOnThisHost).toBe(false);
  });

  it('treats an unreadable record as removable', async () => {
    // A sidecar with no parseable owner cannot be protecting a named process.
    await writeSidecar('owner', TOKEN_C, null);
    const artifact = await onlyArtifact(lockPath);
    expect(artifact.owner).toBeNull();
    expect(artifact.deadOnThisHost).toBe(true);
  });

  it('ignores unrelated directories beside the lock', async () => {
    await mkdir(join(dir, 'other.lock.owner-' + TOKEN_A), { recursive: true });
    await mkdir(join(dir, 'not-a-sidecar'), { recursive: true });
    expect(await findAbandonedLockArtifacts(lockPath)).toEqual([]);
  });

  it('returns nothing when the parent directory is absent', async () => {
    expect(await findAbandonedLockArtifacts(join(dir, 'missing', 'x.lock'))).toEqual([]);
  });
});

describe('removeAbandonedLockArtifacts', () => {
  it('removes only what this host can prove is dead', async () => {
    const deadPath = await writeSidecar('owner', TOKEN_A, { host: hostname(), pid: 999_999_998 });
    const livePath = await writeSidecar('stale', TOKEN_B, { host: hostname(), pid: process.pid });

    const artifacts = await findAbandonedLockArtifacts(lockPath);
    const removed = await removeAbandonedLockArtifacts(artifacts);

    expect(removed).toBe(1);
    const remaining = await readdir(dir);
    // basename, not a '/' split: Windows paths use backslashes.
    expect(remaining).not.toContain(basename(deadPath));
    expect(remaining).toContain(basename(livePath));
  });

  it('is a no-op when nothing is provably dead', async () => {
    await writeSidecar('owner', TOKEN_A, { host: hostname(), pid: process.pid });
    const artifacts = await findAbandonedLockArtifacts(lockPath);
    expect(await removeAbandonedLockArtifacts(artifacts)).toBe(0);
  });
});
