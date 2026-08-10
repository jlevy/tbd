/**
 * Bulk-change thresholds for mirror runs.
 */

import { describe, expect, it } from 'vitest';

import {
  CREATE_CONFIRM_THRESHOLD,
  UPDATE_CONFIRM_THRESHOLD,
  checkBulkThreshold,
} from '../src/integrations/core/bulk-guard.js';

const interactive = { assumeYes: false, interactive: true };
const headless = { assumeYes: false, interactive: false };

describe('bulk threshold', () => {
  it('proceeds for a small run', () => {
    expect(checkBulkThreshold({ creates: 5, updates: 5 }, headless)).toEqual({ kind: 'proceed' });
  });

  it('proceeds exactly at the thresholds, which are limits not targets', () => {
    const counts = { creates: CREATE_CONFIRM_THRESHOLD, updates: UPDATE_CONFIRM_THRESHOLD };
    expect(checkBulkThreshold(counts, headless)).toEqual({ kind: 'proceed' });
  });

  it('asks a human when creates exceed the threshold', () => {
    const decision = checkBulkThreshold(
      { creates: CREATE_CONFIRM_THRESHOLD + 1, updates: 0 },
      interactive,
    );
    expect(decision.kind).toBe('needs-confirmation');
    if (decision.kind === 'needs-confirmation') {
      expect(decision.reasons[0]).toContain('creates');
    }
  });

  it('asks a human when updates exceed the threshold', () => {
    const decision = checkBulkThreshold(
      { creates: 0, updates: UPDATE_CONFIRM_THRESHOLD + 1 },
      interactive,
    );
    expect(decision.kind).toBe('needs-confirmation');
    if (decision.kind === 'needs-confirmation') {
      expect(decision.reasons[0]).toContain('updates');
    }
  });

  it('reports both reasons when both exceed', () => {
    const decision = checkBulkThreshold(
      { creates: CREATE_CONFIRM_THRESHOLD + 1, updates: UPDATE_CONFIRM_THRESHOLD + 1 },
      interactive,
    );
    expect(decision.kind).toBe('needs-confirmation');
    if (decision.kind === 'needs-confirmation') {
      expect(decision.reasons).toHaveLength(2);
    }
  });

  it('refuses rather than prompting when nothing can answer, so CI never hangs', () => {
    const decision = checkBulkThreshold(
      { creates: CREATE_CONFIRM_THRESHOLD + 1, updates: 0 },
      headless,
    );
    expect(decision.kind).toBe('refused');
    if (decision.kind === 'refused') {
      expect(decision.message).toContain('--yes');
      expect(decision.message).toContain('--dry-run');
    }
  });

  it('proceeds without asking once affirmed with --yes', () => {
    const decision = checkBulkThreshold(
      { creates: 1000, updates: 1000 },
      { assumeYes: true, interactive: false },
    );
    expect(decision).toEqual({ kind: 'proceed' });
  });

  it('sets the create threshold below the update threshold, since creates are harder to undo', () => {
    expect(CREATE_CONFIRM_THRESHOLD).toBeLessThan(UPDATE_CONFIRM_THRESHOLD);
  });
});
