/**
 * The actor axis: who is accountable versus who is acting.
 *
 * `tbd start` used to claim by writing the agent name into `assignee`, because that was
 * the only actor field there was. In an agent-driven repository that is the wrong
 * field: `assignee` answers "whose plate is this on", and an agent in that slot
 * destroys the answer while adding one nobody asked for. A claim is a delegation, so it
 * writes `delegate` and leaves `assignee` alone.
 *
 * These tests drive the built CLI rather than the handler, because the claim's value is
 * the observable end state of the bead file — which field moved, and which did not.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const BIN = fileURLToPath(new URL('../dist/bin.mjs', import.meta.url));

let repo: string;

/** Run the built CLI in the scratch repo, returning trimmed stdout. */
function tbd(args: string[], env: Record<string, string> = {}): string {
  return execFileSync(process.execPath, [BIN, ...args], {
    cwd: repo,
    encoding: 'utf-8',
    env: { ...process.env, ...env },
  }).trim();
}

function show(id: string): Record<string, unknown> {
  return JSON.parse(tbd(['show', id, '--json'])) as Record<string, unknown>;
}

function create(title: string): string {
  return (JSON.parse(tbd(['create', title, '--json'])) as { id: string }).id;
}

beforeAll(async () => {
  repo = await mkdtemp(join(tmpdir(), 'tbd-actor-'));
  execFileSync('git', ['init', '-q', '.'], { cwd: repo });
  execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: repo });
  execFileSync('git', ['config', 'user.name', 'Test'], { cwd: repo });
  execFileSync('git', ['commit', '-q', '--allow-empty', '-m', 'init'], { cwd: repo });
  tbd(['init', '--prefix=act']);
}, 120_000);

afterAll(async () => {
  await rm(repo, { recursive: true, force: true });
});

describe('tbd start claims the acting axis', () => {
  it('writes the agent to delegate and leaves assignee untouched', () => {
    const id = create('Claim me');
    tbd(['update', id, '--assignee', 'josh']);
    tbd(['start', id], { TBD_AGENT: 'claude-code' });

    const issue = show(id);
    expect(issue.status).toBe('in_progress');
    expect(issue.delegate).toBe('claude-code');
    // The accountable human survives the claim. This is the whole point.
    expect(issue.assignee).toBe('josh');
  });

  it('claims an unassigned bead without inventing an assignee', () => {
    const id = create('No owner');
    tbd(['start', id], { TBD_AGENT: 'claude-code' });

    const issue = show(id);
    expect(issue.delegate).toBe('claude-code');
    expect(issue.assignee ?? null).toBeNull();
  });

  it('reports another agent’s live claim instead of stealing it', () => {
    const id = create('Contended');
    tbd(['start', id], { TBD_AGENT: 'agent-one' });
    const out = tbd(['start', id], { TBD_AGENT: 'agent-two' });

    expect(out).toContain('already claimed by agent-one');
    expect(show(id).delegate).toBe('agent-one');
  });

  it('is idempotent for the same agent', () => {
    const id = create('Mine already');
    tbd(['start', id], { TBD_AGENT: 'agent-one' });
    expect(tbd(['start', id], { TBD_AGENT: 'agent-one' })).toContain('already yours');
  });
});

describe('delegate is settable directly', () => {
  it('accepts --delegate on create and update, and clears on empty', () => {
    const id = create('Direct');
    tbd(['update', id, '--delegate', 'cyrus']);
    expect(show(id).delegate).toBe('cyrus');

    // The empty-string-clears convention every other actor flag uses.
    tbd(['update', id, '--delegate', '']);
    expect(show(id).delegate ?? null).toBeNull();
  });
});
