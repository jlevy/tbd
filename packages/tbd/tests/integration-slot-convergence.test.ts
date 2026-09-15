/**
 * A sync that changes nothing must write nothing.
 *
 * `tbd integration sync` is meant to settle: once a bead and its tracker item agree, every
 * later run should be silent. For a bead with an open blocker it never settles. The bead
 * and the item are both exactly where they started, and every second run still pushes the
 * state the item is already in — forever, one wasted write per blocked bead per two syncs,
 * each one stamping `updatedAt` so the item looks freshly edited to everyone watching it.
 *
 * The cause is the recorded base flipping sides rather than holding still. `reconcile`
 * seeds the merged slot from the local one and then lets the winning side overwrite it, so
 * the stored base alternates `backlog` (what the bead computes: open, not ready) and `todo`
 * (what the column says). With the base equal to one side, the OTHER side always looks like
 * the one that changed, so each run resolves in the opposite direction from the last.
 *
 * Nothing moves either way because both slots decompose to `status: open` — outbound,
 * `decomposeSlot` collapses `backlog` into `open` and `statusToLinear` maps that to Todo,
 * which is where the item already is; inbound, `todo` decomposes to `open`, which is what
 * the bead already is. The write is a no-op that still costs an API call and a timestamp.
 *
 * This is GH #265. The test asserts the settling property directly — after the first run
 * creates the pair, every later run issues zero mutations — because that is the claim, and
 * asserting on bead or column values would pass right through the bug: neither ever changes.
 */

import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LinearMockServer } from './helpers/linear-mock-server.js';

// Each run spawns the real CLI against the mock over HTTP; nine of them do not fit the
// default per-test budget.
vi.setConfig({ testTimeout: 120_000, hookTimeout: 60_000 });

const execFileAsync = promisify(execFile);
const BIN = join(import.meta.dirname, '..', 'dist', 'bin.mjs');

describe('tbd integration sync settles', () => {
  // A repository and a mock per test, deliberately. The loop under test keeps writing on
  // every second run, so a shared fixture would leak its mutations into the control and
  // fail it for the wrong reason — the control exists to show the assertion is specific.
  let dir: string;
  let server: LinearMockServer;

  async function cli(args: string[]): Promise<{ stdout: string; stderr: string; code: number }> {
    try {
      const { stdout, stderr } = await execFileAsync(process.execPath, [BIN, ...args], {
        cwd: dir,
        env: {
          ...process.env,
          HOME: dir,
          LINEAR_API_KEY: 'lin_api_test',
          LINEAR_API_URL: server.endpoint,
          NO_COLOR: '1',
        },
      });
      return { stdout, stderr, code: 0 };
    } catch (error) {
      const failed = error as { stdout?: string; stderr?: string; code?: number };
      return { stdout: failed.stdout ?? '', stderr: failed.stderr ?? '', code: failed.code ?? 1 };
    }
  }

  /** Mutations the mock received during one sync, by GraphQL operation name. */
  async function syncMutations(): Promise<string[]> {
    const before = server.requests.length;
    const result = await cli(['integration', 'sync']);
    expect(result.code, `sync failed\n${result.stdout}\n${result.stderr}`).toBe(0);
    return server.requests
      .slice(before)
      .filter((request) => /mutation/iu.test(request.query))
      .map((request) => /mutation\s+(\w+)/u.exec(request.query)?.[1] ?? 'mutation');
  }

  beforeEach(async () => {
    server = new LinearMockServer();
    await server.start();

    dir = await mkdtemp(join(tmpdir(), 'tbd-slot-convergence-'));
    const sh = async (cmd: string, args: string[]): Promise<void> => {
      await execFileAsync(cmd, args, { cwd: dir });
    };
    await sh('git', ['init', '-q', '--initial-branch=main']);
    await sh('git', ['config', 'user.email', 't@e.com']);
    await sh('git', ['config', 'user.name', 'T']);
    await sh('git', ['config', 'commit.gpgsign', 'false']);
    await writeFile(join(dir, '.gitignore'), '.env\n');
    await sh('git', ['add', '-A']);
    await sh('git', ['commit', '-q', '-m', 'init']);

    expect((await cli(['init', '--prefix=slt'])).code).toBe(0);
    const config = await readFile(join(dir, '.tbd', 'config.yml'), 'utf8');
    await writeFile(
      join(dir, '.tbd', 'config.yml'),
      `${config}\nintegrations:\n  linear:\n    enabled: true\n    target:\n      team_key: FIN\n` +
        `    policy:\n      outbound:\n        kinds: [epic, task]\n` +
        `        statuses: [open, in_progress, blocked]\n`,
    );
  }, 60_000);

  afterEach(async () => {
    await server.stop();
    await rm(dir, { recursive: true, force: true });
  });

  /** Create a bead through the CLI and return the display id the other commands take. */
  async function createBead(title: string, kind: string): Promise<string> {
    const result = await cli(['create', title, `--type=${kind}`, '--json']);
    expect(result.code, `create failed\n${result.stdout}\n${result.stderr}`).toBe(0);
    const { id } = JSON.parse(result.stdout) as { id: string };
    return id;
  }

  it('creates a bead with an open blocker in Backlog and stays settled', async () => {
    const epic = await createBead('A blocked epic', 'epic');
    const blocker = await createBead('A blocker', 'task');
    expect((await cli(['dep', 'add', epic, blocker])).code).toBe(0);

    // The first run creates both items. Everything after it is the claim under test.
    expect(await syncMutations()).not.toHaveLength(0);

    const later: string[][] = [];
    for (let run = 2; run <= 9; run++) {
      later.push(await syncMutations());
    }
    const writes = later.flat();

    // Creation writes the computed slot directly, so every later run must be silent.
    // Before the fix this was four IssueUpdates across these eight runs, and it never
    // stopped.
    expect(writes, `expected no writes across runs 2-9, got ${JSON.stringify(later)}`).toHaveLength(
      0,
    );

    // The tail stays silent as an explicit guard against alternating every other run.
    expect(later.slice(-4)).toEqual([[], [], [], []]);

    // The write moved the column. That is what ends the disagreement: the old no-op push
    // wrote the state the item was already in, so the two sides never converged.
    const [item] = [...server.issues.values()].filter((i) => i.title === 'A blocked epic');
    expect(item?.state.name).toBe('Backlog');
  });

  it('writes nothing after the first run for an unblocked bead (control)', async () => {
    // Same shape without the dependency. If this one ever fails, the assertion above is
    // measuring general sync churn rather than the blocked-slot loop.
    await createBead('An unblocked epic', 'epic');
    expect(await syncMutations()).not.toHaveLength(0);

    const later: string[][] = [];
    for (let run = 2; run <= 5; run++) {
      later.push(await syncMutations());
    }
    expect(later).toEqual([[], [], [], []]);
  });
});
