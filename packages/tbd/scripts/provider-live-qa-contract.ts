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
  'blocked-slot-create-settle',
  'orphan-detection',
  'cleanup',
] as const;

export type LiveCompatibilityScenarioId = (typeof LIVE_COMPATIBILITY_SCENARIOS)[number];

export interface LiveQaFixture {
  id: string;
  key: string;
}

export interface LiveQaFixtureCleanup {
  /** Fixtures registered on the happy path, in creation order. */
  known: readonly LiveQaFixture[];
  /** Human-readable provider scope and run identity for recovery errors. */
  scope: string;
  /** Independent provider lookup for fixtures a failed scenario did not register. */
  discoverOwned: () => Promise<readonly LiveQaFixture[]>;
  isArchived: (fixture: LiveQaFixture) => Promise<boolean>;
  archive: (fixture: LiveQaFixture) => Promise<void>;
}

function failureText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Archive every fixture the driver knows about or can rediscover from provider state.
 *
 * Discovery runs before archival and is independent of the candidate under test. This
 * closes the failure window where a candidate creates a remote item and then fails
 * before its driver can record the returned id. Discovery failure is itself a cleanup
 * failure; archiving the known subset must never be reported as complete cleanup.
 */
export async function cleanupOwnedFixtures(options: LiveQaFixtureCleanup): Promise<void> {
  const failures: string[] = [];
  const targets = [...options.known].reverse();
  const seen = new Set(targets.map((fixture) => fixture.id));

  try {
    for (const fixture of await options.discoverOwned()) {
      if (!seen.has(fixture.id)) {
        targets.push(fixture);
        seen.add(fixture.id);
      }
    }
  } catch (error) {
    failures.push(`fixture discovery failed for ${options.scope}: ${failureText(error)}`);
  }

  for (const fixture of targets) {
    try {
      if (!(await options.isArchived(fixture))) {
        await options.archive(fixture);
      }
    } catch (error) {
      failures.push(`${fixture.key}: ${failureText(error)}`);
    }
  }

  if (failures.length > 0) {
    throw new Error(`Owned fixture cleanup failed:\n${failures.join('\n')}`);
  }
}

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
