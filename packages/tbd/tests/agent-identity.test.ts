/**
 * Agent identity resolution and the `agid-` format.
 *
 * The format choice is the part worth pinning: `agid-{ulid}` reuses tbd's internal ID
 * shape because agent ids are minted independently on many machines at session start,
 * with no shared lock and no registry to consult before pushing. A short registry-checked
 * id — the thing that makes 4-character bead display ids safe — cannot be used here.
 */

import { describe, it, expect } from 'vitest';

import {
  generateAgentId,
  isAgentId,
  slugifyAgentName,
  detectHarness,
  detectModel,
  derivedAgentName,
  resolveAgentIdentity,
  AGENT_ID_PREFIX,
} from '../src/lib/agent-identity.js';

describe('agent id format', () => {
  it('mints agid- plus a 26-char ULID', () => {
    const id = generateAgentId();
    expect(id).toMatch(/^agid-[0-9a-z]{26}$/);
    expect(id.startsWith(`${AGENT_ID_PREFIX}-`)).toBe(true);
  });

  it('mints a distinct id every time, with no registry consulted', () => {
    // Uncoordinated minting is the whole reason for the ULID payload: this must hold
    // without any shared state to check against.
    const ids = new Set(Array.from({ length: 500 }, () => generateAgentId()));
    expect(ids.size).toBe(500);
  });

  it('is time-ordered, so ids sort into creation order', () => {
    const first = generateAgentId();
    const second = generateAgentId();
    expect(second > first).toBe(true);
  });

  it('validates its own output and rejects near-misses', () => {
    expect(isAgentId(generateAgentId())).toBe(true);
    expect(isAgentId('agid-tooshort')).toBe(false);
    expect(isAgentId('is-01hx5zzkbkactav9wevgemmvrz')).toBe(false);
    expect(isAgentId('agid-01HX5ZZKBKACTAV9WEVGEMMVRZ'.toUpperCase())).toBe(true);
  });
});

describe('agent name slugification', () => {
  it('keeps the characters a tracker label and query string tolerate', () => {
    expect(slugifyAgentName('claude-code@host.local')).toBe('claude-code@host.local');
    expect(slugifyAgentName('Some Agent Name')).toBe('some-agent-name');
    expect(slugifyAgentName('  spaced  ')).toBe('spaced');
  });

  it('never returns an empty name', () => {
    // An empty assignee is indistinguishable from an unclaimed bead, which is the
    // failure this whole command exists to remove.
    expect(slugifyAgentName('!!!')).toBe('agent');
    expect(slugifyAgentName('')).toBe('agent');
  });
});

describe('harness detection', () => {
  it('detects Claude Code from the variable set in every spawned subprocess', () => {
    // CLAUDECODE=1 is set in all subprocesses, so a bare `tbd start` self-attributes
    // with no hook installed at all.
    expect(detectHarness({ CLAUDECODE: '1' })).toBe('claude-code');
    expect(detectHarness({ CLAUDE_CODE_ENTRYPOINT: 'cli' })).toBe('claude-code');
  });

  it('detects the other harnesses from their own markers', () => {
    expect(detectHarness({ CURSOR_PROJECT_DIR: '/x' })).toBe('cursor');
    expect(detectHarness({ CODEX_HOME: '/x' })).toBe('codex');
  });

  it('reports unknown rather than guessing', () => {
    // Codex sets no per-subprocess marker, so an unmarked environment must degrade
    // honestly instead of being attributed to whatever ran last.
    expect(detectHarness({})).toBe('unknown');
  });

  it('records a model only when the environment offers one', () => {
    expect(detectModel({ ANTHROPIC_MODEL: 'opus' })).toBe('opus');
    expect(detectModel({})).toBeUndefined();
  });
});

describe('identity resolution order', () => {
  const session = { agent_id: 'agid-01aaaaaaaaaaaaaaaaaaaaaaaa', agent_name: 'session-agent' };

  it('prefers an explicit --as over everything', () => {
    const identity = resolveAgentIdentity({
      as: 'Explicit Name',
      session,
      env: { TBD_AGENT: 'env-agent', CLAUDECODE: '1' },
    });
    expect(identity.name).toBe('explicit-name');
    expect(identity.source).toBe('flag');
  });

  it('prefers $TBD_AGENT over the session', () => {
    const identity = resolveAgentIdentity({ session, env: { TBD_AGENT: 'env-agent' } });
    expect(identity.name).toBe('env-agent');
    expect(identity.source).toBe('env');
  });

  it('uses the session identity, carrying its id', () => {
    const identity = resolveAgentIdentity({ session, env: {} });
    expect(identity.name).toBe('session-agent');
    expect(identity.id).toBe(session.agent_id);
    expect(identity.source).toBe('session');
  });

  it('always resolves to something, even with nothing to go on', () => {
    // Resolution is total on purpose: a bead claimed by an imprecisely-named agent is
    // far better recorded than one claimed by nobody.
    const identity = resolveAgentIdentity({ env: {} });
    expect(identity.name.length).toBeGreaterThan(0);
    expect(identity.source).toBe('derived');
  });

  it('derives a name that names the harness and not the OS user', () => {
    // The existing user_map stance keeps person identity out of synced data by default;
    // an agent name should not be the thing that leaks it.
    const derived = derivedAgentName({ CLAUDECODE: '1' });
    expect(derived.startsWith('claude-code@')).toBe(true);
  });

  it('carries the harness and model through every resolution path', () => {
    const identity = resolveAgentIdentity({
      as: 'named',
      env: { CLAUDECODE: '1', ANTHROPIC_MODEL: 'opus' },
    });
    expect(identity.harness).toBe('claude-code');
    expect(identity.model).toBe('opus');
  });
});
