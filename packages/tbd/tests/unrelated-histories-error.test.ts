/**
 * Unit tests for UnrelatedHistoriesError (tbd sync dedicated message).
 *
 * See: tbd-xsb4 (plan-2026-05-29-tbd-sync-unrelated-history-hardening.md)
 */

import { describe, it, expect } from 'vitest';

import { UnrelatedHistoriesError, SyncError } from '../src/cli/lib/errors.js';

describe('UnrelatedHistoriesError', () => {
  it('is a SyncError so the sync command surfaces it (not swallowed as first-sync)', () => {
    const err = new UnrelatedHistoriesError('origin', 'tbd-sync');
    expect(err).toBeInstanceOf(SyncError);
    expect(err.name).toBe('UnrelatedHistoriesError');
  });

  it('names the remote/branch and routes to tbd doctor --fix, not tbd sync', () => {
    const err = new UnrelatedHistoriesError('upstream', 'tbd-sync');
    expect(err.message).toMatch(/upstream\/tbd-sync/);
    expect(err.message).toMatch(/unrelated|no common ancestor/i);
    expect(err.message).toMatch(/tbd doctor --fix/);
  });

  it('defaults to origin/tbd-sync', () => {
    expect(new UnrelatedHistoriesError().message).toMatch(/origin\/tbd-sync/);
  });
});
