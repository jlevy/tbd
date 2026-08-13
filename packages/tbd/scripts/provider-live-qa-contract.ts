/**
 * Provider-neutral live QA contract for external-tracker adapters.
 *
 * Each provider driver supplies its own API operations and assertions while this
 * checklist keeps scenario coverage and completion reporting consistent.
 */

export const LIVE_COMPATIBILITY_SCENARIOS = [
  'setup',
  'explicit-import',
  'deferred-claim-replay',
  'tbd-to-provider-fields-comments-assignee',
  'provider-to-tbd-fields-comments-assignee',
  'provider-created-hierarchy',
  'automatic-inbound-scope',
  'concurrent-conflict-recovery',
  'exact-once-settle',
  'orphan-detection',
  'cleanup',
] as const;

export type LiveCompatibilityScenarioId = (typeof LIVE_COMPATIBILITY_SCENARIOS)[number];

export class LiveCompatibilityChecklist {
  readonly #completed = new Set<LiveCompatibilityScenarioId>();

  constructor(
    private readonly report: (id: LiveCompatibilityScenarioId) => void = () => undefined,
  ) {}

  async run(id: LiveCompatibilityScenarioId, action: () => Promise<void>): Promise<void> {
    if (this.#completed.has(id)) {
      throw new Error(`Compatibility scenario already completed: ${id}`);
    }
    await action();
    this.#completed.add(id);
    this.report(id);
  }

  assertComplete(): number {
    const missing = LIVE_COMPATIBILITY_SCENARIOS.filter((id) => !this.#completed.has(id));
    if (missing.length > 0) {
      throw new Error(`Live QA did not complete compatibility scenarios: ${missing.join(', ')}`);
    }
    return this.#completed.size;
  }
}
