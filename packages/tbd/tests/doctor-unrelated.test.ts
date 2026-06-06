/**
 * Unit tests for classifyRemoteSyncHealth (tbd doctor unrelated finding).
 *
 * Unrelated histories must surface as a hard ✗ finding routed to
 * `tbd doctor --fix`, never as healthy and never toward `tbd sync`.
 *
 * See: tbd-fg5a (plan-2026-05-29-tbd-sync-unrelated-history-hardening.md)
 */

import { describe, it, expect } from 'vitest';

import { classifyRemoteSyncHealth, divergenceFinding } from '../src/cli/commands/doctor.js';
import type { RemoteBranchHealth } from '../src/file/git.js';

const base: RemoteBranchHealth = { exists: true, diverged: false, unrelated: false };

describe('classifyRemoteSyncHealth', () => {
  it('reports unrelated histories as a hard error routed to doctor --fix', () => {
    const diag = classifyRemoteSyncHealth(
      { ...base, diverged: true, unrelated: true },
      'origin',
      'tbd-sync',
    );
    expect(diag?.status).toBe('error');
    expect(diag?.fixable).toBe(true);
    expect(diag?.message).toMatch(/unrelated|no common ancestor/i);
    expect(diag?.suggestion).toMatch(/doctor --fix/);
    expect(diag?.suggestion).not.toMatch(/tbd sync/);
  });

  it('reports a plain divergence as a warning toward tbd sync', () => {
    const diag = classifyRemoteSyncHealth({ ...base, diverged: true }, 'origin', 'tbd-sync');
    expect(diag?.status).toBe('warn');
    expect(diag?.suggestion).toMatch(/tbd sync/);
  });

  it('reports an in-sync remote as ok', () => {
    const diag = classifyRemoteSyncHealth(base, 'origin', 'tbd-sync');
    expect(diag?.status).toBe('ok');
  });

  it('returns null when the remote branch does not exist (caller falls through)', () => {
    const diag = classifyRemoteSyncHealth(
      { exists: false, diverged: false, unrelated: false },
      'origin',
      'tbd-sync',
    );
    expect(diag).toBeNull();
  });
});

describe('divergenceFinding (#158 — break the sync ⇄ doctor loop)', () => {
  it('points a plain divergence at tbd sync', () => {
    const diag = divergenceFinding(2, 3, false);
    expect(diag.message).toMatch(/diverged \(2 ahead, 3 behind\)/);
    expect(diag.suggestion).toMatch(/tbd sync/);
  });

  it('points an unrelated divergence at doctor --fix, never tbd sync', () => {
    // For unrelated histories the remediation is the rescue; suggesting tbd sync
    // forms a loop (sync → doctor --fix → sync).
    const diag = divergenceFinding(2, 92, true);
    expect(diag.suggestion).toMatch(/doctor --fix/);
    expect(diag.suggestion).not.toMatch(/tbd sync/);
  });
});
