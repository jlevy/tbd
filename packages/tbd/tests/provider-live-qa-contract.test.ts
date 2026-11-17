import { describe, expect, it, vi } from 'vitest';

import {
  cleanupOwnedFixtures,
  LIVE_COMPATIBILITY_SCENARIOS,
  LiveCompatibilityChecklist,
} from '../scripts/provider-live-qa-contract.js';

describe('cleanupOwnedFixtures', () => {
  it('rediscovers and archives an issue created before a scenario failed', async () => {
    const archive = vi.fn(() => Promise.resolve());

    await cleanupOwnedFixtures({
      known: [],
      scope: 'Linear OS/tbd token run-123',
      discoverOwned: () => Promise.resolve([{ id: 'remote-created', key: 'OS-123' }]),
      isArchived: () => Promise.resolve(false),
      archive,
    });

    expect(archive).toHaveBeenCalledOnce();
    expect(archive).toHaveBeenCalledWith({ id: 'remote-created', key: 'OS-123' });
  });

  it('fails cleanup when discovery fails while still archiving registered fixtures', async () => {
    const archive = vi.fn(() => Promise.resolve());

    await expect(
      cleanupOwnedFixtures({
        known: [{ id: 'known', key: 'OS-1' }],
        scope: 'Linear OS/tbd token run-123',
        discoverOwned: () => Promise.reject(new Error('query unavailable')),
        isArchived: () => Promise.resolve(false),
        archive,
      }),
    ).rejects.toThrow('fixture discovery failed for Linear OS/tbd token run-123');

    expect(archive).toHaveBeenCalledWith({ id: 'known', key: 'OS-1' });
  });
});

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
