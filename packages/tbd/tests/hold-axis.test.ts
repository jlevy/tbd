/**
 * The hold axis: begun, then set down, without losing that it began.
 *
 * `deferred` had to overwrite `in_progress` to say "paused", which destroyed the one
 * fact that made a pause worth distinguishing from a backlog item. `started_at` is what
 * survives that now, and it is the reason Paused and Draft are different columns rather
 * than the same one described twice.
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  statusToLinear,
  holdFromLinear,
  PAUSED_LABEL,
  BLOCKED_LABEL,
} from '../src/integrations/linear/mapping.js';

// Every case here spawns the built CLI several times, which costs seconds rather than
// milliseconds and is sensitive to whatever else the suite is running in parallel. The
// 5s default is a load measurement, not a correctness signal; this matches the timeout
// the other binary-driving suites use.
vi.setConfig({ testTimeout: 60_000, hookTimeout: 120_000 });

const BIN = fileURLToPath(new URL('../dist/bin.mjs', import.meta.url));
let repo: string;

function tbd(args: string[], env: Record<string, string> = {}): string {
  return execFileSync(process.execPath, [BIN, ...args], {
    cwd: repo,
    encoding: 'utf-8',
    env: { ...process.env, ...env },
  }).trim();
}
const show = (id: string) => JSON.parse(tbd(['show', id, '--json'])) as Record<string, unknown>;
const create = (title: string) =>
  (JSON.parse(tbd(['create', title, '--json'])) as { id: string }).id;

beforeAll(async () => {
  repo = await mkdtemp(join(tmpdir(), 'tbd-hold-'));
  execFileSync('git', ['init', '-q', '.'], { cwd: repo });
  execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: repo });
  execFileSync('git', ['config', 'user.name', 'Test'], { cwd: repo });
  execFileSync('git', ['commit', '-q', '--allow-empty', '-m', 'init'], { cwd: repo });
  tbd(['init', '--prefix=hold']);
}, 120_000);

afterAll(async () => {
  await rm(repo, { recursive: true, force: true });
});

describe('pausing started work', () => {
  it('keeps the position and the start, and records only why it stopped', () => {
    const id = create('Half done');
    tbd(['start', id], { TBD_AGENT: 'claude-code' });
    const started = show(id).started_at as string;
    expect(started).toBeTruthy();

    tbd(['pause', id, '--reason', 'waiting on review']);
    const paused = show(id);
    // The whole point: still in progress, still knows when it began.
    expect(paused.status).toBe('in_progress');
    expect(paused.started_at).toBe(started);
    expect(paused.hold).toBe('paused');
  });

  it('resumes by lifting the hold, leaving the start untouched', () => {
    const id = create('Resumable');
    tbd(['start', id], { TBD_AGENT: 'claude-code' });
    const started = show(id).started_at as string;
    tbd(['pause', id]);
    tbd(['resume', id]);

    const resumed = show(id);
    expect(resumed.hold ?? null).toBeNull();
    expect(resumed.status).toBe('in_progress');
    expect(resumed.started_at).toBe(started);
  });

  it('never moves started_at once set, even across a re-claim', () => {
    const id = create('Re-claimed');
    tbd(['start', id], { TBD_AGENT: 'claude-code' });
    const first = show(id).started_at as string;
    tbd(['pause', id]);
    tbd(['start', id], { TBD_AGENT: 'claude-code' });
    expect(show(id).started_at).toBe(first);
  });

  it('carries hold_until only while paused', () => {
    const id = create('Timed');
    tbd(['pause', id, '--until', '2026-12-01']);
    expect(show(id).hold_until).toBe('2026-12-01T00:00:00.000Z');
    tbd(['resume', id]);
    expect(show(id).hold_until ?? null).toBeNull();
  });

  it('refuses to hold closed work, since a hold implies it could still move', () => {
    const id = create('Finished');
    tbd(['close', id]);
    expect(tbd(['pause', id])).toContain('reopen it first');
    expect(show(id).hold ?? null).toBeNull();
  });

  it('rejects an unparseable --until rather than storing a bad date', () => {
    const id = create('Bad date');
    expect(() => tbd(['pause', id, '--until', 'soonish'])).toThrow(/Invalid --until/);
  });
});

describe('hold mapped to Linear', () => {
  it('prefers a named Paused state and falls back to a carrier label', () => {
    const target = statusToLinear('in_progress', null, 'paused');
    // Both are offered: the adapter uses the name when the team has that state, and
    // the label only when it does not.
    expect(target.stateType).toBe('started');
    expect(target.stateName).toBe('Paused');
    expect(target.labels).toEqual([PAUSED_LABEL]);
  });

  it('files held-but-unstarted work in the backlog rather than Todo', () => {
    expect(statusToLinear('open', null, 'paused')).toMatchObject({
      stateType: 'backlog',
      labels: [PAUSED_LABEL],
    });
  });

  it('round-trips a pause through the carrier label', () => {
    const target = statusToLinear('in_progress', null, 'paused');
    expect(holdFromLinear(undefined, target.labels)).toBe('paused');
  });

  it('reads a hold from a team state name when no carrier is present', () => {
    expect(holdFromLinear('Paused', [])).toBe('paused');
    expect(holdFromLinear('Blocked', [])).toBe('blocked');
    expect(holdFromLinear('In Progress', [])).toBeNull();
  });

  it('leaves the legacy blocked carrier to the status axis', () => {
    // `tbd:blocked` is the carrier for the legacy `blocked` *status*. Reading it as a
    // hold too would set a position and a modifier from one signal.
    expect(holdFromLinear(undefined, [BLOCKED_LABEL])).toBeNull();
  });
});

describe('date options accept what a person types', () => {
  it('normalizes a plain date on --due and --defer', () => {
    // The stored field is an ISO datetime, but nobody types one. Rejecting `2026-12-01`
    // for want of a time of day is the tool being pedantic about its own storage.
    const id = create('Due dated');
    tbd(['update', id, '--due', '2026-12-01', '--defer', '2026-11-01']);
    const issue = show(id);
    expect(issue.due_date).toBe('2026-12-01T00:00:00.000Z');
    expect(issue.deferred_until).toBe('2026-11-01T00:00:00.000Z');
  });

  it('refuses an unparseable date by flag name, not as a schema error', () => {
    const id = create('Bad date');
    expect(() => tbd(['update', id, '--due', 'soonish'])).toThrow(/Invalid --due value/);
  });

  it('still clears on an empty value', () => {
    const id = create('Clearable');
    tbd(['update', id, '--due', '2026-12-01']);
    tbd(['update', id, '--due', '']);
    expect(show(id).due_date ?? null).toBeNull();
  });
});
