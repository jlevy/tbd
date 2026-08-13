import { describe, expect, it, vi } from 'vitest';

import {
  LIVE_COMPATIBILITY_SCENARIOS,
  LiveCompatibilityChecklist,
} from '../scripts/provider-live-qa-contract.js';

describe('LiveCompatibilityChecklist', () => {
  it('enforces and reports the shared provider compatibility contract', async () => {
    const report = vi.fn();
    const checklist = new LiveCompatibilityChecklist(report);

    for (const id of LIVE_COMPATIBILITY_SCENARIOS) {
      await checklist.run(id, () => Promise.resolve());
    }

    expect(checklist.assertComplete()).toBe(LIVE_COMPATIBILITY_SCENARIOS.length);
    expect(report).toHaveBeenCalledTimes(LIVE_COMPATIBILITY_SCENARIOS.length);
    expect(report).toHaveBeenLastCalledWith('cleanup');
  });

  it('does not record a failed scenario and identifies every missing scenario', async () => {
    const checklist = new LiveCompatibilityChecklist();

    await expect(
      checklist.run('setup', () => Promise.reject(new Error('provider unavailable'))),
    ).rejects.toThrow('provider unavailable');

    expect(() => checklist.assertComplete()).toThrow(
      'setup, explicit-import, deferred-claim-replay',
    );
  });

  it('rejects duplicate execution so a scenario cannot inflate completion evidence', async () => {
    const checklist = new LiveCompatibilityChecklist();
    await checklist.run('setup', () => Promise.resolve());

    await expect(checklist.run('setup', () => Promise.resolve())).rejects.toThrow(
      'Compatibility scenario already completed: setup',
    );
  });
});
