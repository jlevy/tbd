/**
 * Parity oracle for `src/lib/issue-query.ts`.
 *
 * The oracles below are verbatim ports of the logic `selectIssues` replaced: the
 * pre-extraction `ListHandler.filterIssues`/`sortIssues` bodies and the pre-extraction
 * `tbd ready` pipeline. The refactor is safe exactly to the extent that the shared
 * module and these oracles agree on every query over a corpus that exercises every
 * filter and plenty of sort ties — so the comparison runs id-sequence-exact, not
 * set-equal.
 */

import { describe, expect, it } from 'vitest';

import { comparisonChain, ordering } from '../src/lib/comparison-chain.js';
import { extractUlidFromInternalId } from '../src/lib/ids.js';
import { defaultIssueQuery, selectIssues } from '../src/lib/issue-query.js';
import type { IssueQuery, IssueSort } from '../src/lib/issue-query.js';
import { issueMatchesSharedFilters, readyIssueIds } from '../src/lib/issue-selection.js';
import type { Issue, IssueKindType, IssueStatusType } from '../src/lib/types.js';

// ─── Oracles: the original implementations, ported verbatim ─────────────────

/** Pre-extraction ListHandler.filterIssues, minus CLI parsing (already resolved). */
function legacyListFilter(
  issues: Issue[],
  query: {
    includeClosed: boolean;
    status: IssueStatusType | null;
    kind: IssueKindType | null;
    priority: number | null;
    assignee: string | null;
    labels: readonly string[];
    parentId: string | null;
    spec: string | null;
    deferred: boolean;
  },
): Issue[] {
  return issues.filter((issue) => {
    if (!query.includeClosed && query.status !== 'closed' && issue.status === 'closed') {
      return false;
    }
    if (
      !issueMatchesSharedFilters(issue, {
        labels: query.labels,
        spec: query.spec,
        status: query.status,
      })
    ) {
      return false;
    }
    if (query.kind !== null && issue.kind !== query.kind) {
      return false;
    }
    if (query.priority !== null && issue.priority !== query.priority) {
      return false;
    }
    if (query.assignee !== null && issue.assignee !== query.assignee) {
      return false;
    }
    if (query.parentId !== null && issue.parent_id !== query.parentId) {
      return false;
    }
    if (query.deferred && issue.status !== 'deferred') {
      return false;
    }
    return true;
  });
}

/** Pre-extraction ListHandler.sortIssues. */
function legacyListSort(issues: Issue[], sortField: string): Issue[] {
  const primarySelector: (i: Issue) => number =
    sortField === 'created'
      ? (i) => new Date(i.created_at).getTime()
      : sortField === 'updated'
        ? (i) => new Date(i.updated_at).getTime()
        : (i) => i.priority;
  const primaryOrdering =
    sortField === 'created' || sortField === 'updated' ? ordering.reversed : ordering.default;
  return [...issues].sort(
    comparisonChain<Issue>()
      .compare(primarySelector, primaryOrdering)
      .compare((i) => extractUlidFromInternalId(i.id))
      .result(),
  );
}

/**
 * Pre-extraction `tbd ready` pipeline. Note its tiebreak was the full internal id
 * rather than the extracted ULID; ids share the constant `is-` prefix, so the orders
 * are provably identical — this oracle keeps the original expression to prove it.
 */
function legacyReady(issues: Issue[], kind: IssueKindType | null): Issue[] {
  const readyIds = readyIssueIds(issues);
  let readyIssues = issues.filter((issue) => readyIds.has(issue.id));
  if (kind !== null) {
    readyIssues = readyIssues.filter((i) => i.kind === kind);
  }
  readyIssues.sort(
    comparisonChain<Issue>()
      .compare((i) => i.priority)
      .compare((i) => i.id)
      .result(),
  );
  return readyIssues;
}

// ─── Corpus: every filter dimension, dense sort ties ────────────────────────

const STATUSES: IssueStatusType[] = ['open', 'in_progress', 'blocked', 'deferred', 'closed'];
const KINDS: IssueKindType[] = ['bug', 'feature', 'task', 'epic', 'chore'];

/** Deterministic PRNG (mulberry32) so the corpus is stable across runs. */
function prng(seed: number): () => number {
  let state = seed;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildCorpus(): Issue[] {
  const random = prng(0x5eed);
  const issues: Issue[] = [];
  const count = 120;
  for (let index = 0; index < count; index += 1) {
    // Zero-padded so ULID-order and creation-order agree; ties are engineered by
    // reusing a small set of priorities and a handful of shared timestamps.
    const ulid = `01HZZZZZZZZZZZZZZZZZ${String(index).padStart(6, '0')}`;
    const status = STATUSES[Math.floor(random() * STATUSES.length)]!;
    const labels: string[] = [];
    if (random() < 0.4) {
      labels.push('alpha');
    }
    if (random() < 0.3) {
      labels.push('beta');
    }
    const parent =
      index > 10 && random() < 0.3 ? issues[Math.floor(random() * index)]!.id : undefined;
    const issue: Issue = {
      type: 'is',
      id: `is-${ulid}`,
      version: 1,
      title: `Issue ${index}`,
      kind: KINDS[Math.floor(random() * KINDS.length)]!,
      status,
      priority: Math.floor(random() * 3),
      labels,
      dependencies: [],
      created_at: `2026-01-0${1 + (index % 5)}T00:00:00.000Z`,
      updated_at: `2026-02-0${1 + (index % 3)}T00:00:00.000Z`,
    } as unknown as Issue;
    if (random() < 0.35) {
      (issue as { assignee?: string }).assignee = random() < 0.5 ? 'alice' : 'bob';
    }
    if (random() < 0.3) {
      (issue as { spec_path?: string }).spec_path =
        random() < 0.5 ? 'docs/specs/plan-a.md' : 'docs/specs/plan-b.md';
    }
    if (parent !== undefined) {
      (issue as { parent_id?: string }).parent_id = parent;
    }
    if (random() < 0.25 && issues.length > 0) {
      // A `blocks` edge from this issue to an earlier one, so the ready set is rich.
      issue.dependencies = [
        { type: 'blocks', target: issues[Math.floor(random() * issues.length)]!.id },
      ] as Issue['dependencies'];
    }
    issues.push(issue);
  }
  return issues;
}

const corpus = buildCorpus();

function ids(issues: Issue[]): string[] {
  return issues.map((issue) => issue.id);
}

// ─── The parity suites ──────────────────────────────────────────────────────

describe('selectIssues parity with the legacy list pipeline', () => {
  const sorts: IssueSort[] = ['priority', 'created', 'updated'];
  const parentPool = corpus.filter((issue) => issue.parent_id != null);

  /** A deterministic sample of the query space, dense enough to hit every branch. */
  function queries(): IssueQuery[] {
    const out: IssueQuery[] = [];
    const random = prng(0xfeed);
    for (const status of [null, ...STATUSES] as (IssueStatusType | null)[]) {
      for (const includeClosed of [false, true]) {
        for (const sort of sorts) {
          out.push({
            ...defaultIssueQuery(),
            status,
            includeClosed,
            sort,
            kind: random() < 0.4 ? KINDS[Math.floor(random() * KINDS.length)]! : null,
            priority: random() < 0.35 ? Math.floor(random() * 3) : null,
            assignee: random() < 0.3 ? (random() < 0.5 ? 'alice' : 'bob') : null,
            labels: random() < 0.4 ? (random() < 0.5 ? ['alpha'] : ['alpha', 'beta']) : [],
            parentId:
              random() < 0.25 && parentPool.length > 0
                ? parentPool[Math.floor(random() * parentPool.length)]!.parent_id!
                : null,
            spec: random() < 0.3 ? 'plan-a.md' : null,
            deferred: random() < 0.2,
          });
        }
      }
    }
    return out;
  }

  it('matches the oracle id-sequence-exactly across the query space', () => {
    const all = queries();
    expect(all.length).toBeGreaterThan(30);
    for (const query of all) {
      const expected = ids(legacyListSort(legacyListFilter(corpus, query), query.sort));
      const actual = ids(selectIssues(corpus, query));
      expect(actual, JSON.stringify(query)).toEqual(expected);
    }
  });

  it('applies limit after sorting, like applyLimit did', () => {
    const query = { ...defaultIssueQuery(), limit: 7 };
    const expected = ids(legacyListSort(legacyListFilter(corpus, query), 'priority')).slice(0, 7);
    expect(ids(selectIssues(corpus, query))).toEqual(expected);
  });
});

describe('selectIssues parity with the legacy ready pipeline', () => {
  it('matches for every kind filter, including the internal-id-vs-ULID tiebreak', () => {
    for (const kind of [null, ...KINDS] as (IssueKindType | null)[]) {
      const expected = ids(legacyReady(corpus, kind));
      const actual = ids(selectIssues(corpus, { ...defaultIssueQuery(), ready: true, kind }));
      expect(actual, `kind=${String(kind)}`).toEqual(expected);
    }
  });
});
