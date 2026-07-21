/**
 * Pure, deterministic issue-snapshot diffing for `tbd changes` and `tbd watch`.
 */

import { extractShortId, extractUlidFromInternalId, isInternalId, makeInternalId } from './ids.js';
import { issueMatchesSharedFilters, readyIssueIds } from './issue-selection.js';
import type { Issue, IssueStatusType } from './types.js';

/** One committed issue graph and its append-only public-ID mapping. */
export interface IssueSnapshot {
  issues: ReadonlyMap<string, Issue>;
  shortToUlid: ReadonlyMap<string, string>;
  ulidToShort: ReadonlyMap<string, string>;
}

/** Static or dynamic selection accepted by the change engine. */
export type IssueChangeSelection =
  | { kind: 'all' }
  | { kind: 'beads'; ids: readonly string[] }
  | {
      kind: 'filter';
      labels: readonly string[];
      spec: string | null;
      status: IssueStatusType | null;
      ready: boolean;
    };

export type IssueChangeKind = 'created' | 'updated' | 'deleted';
export type TextChangeLineType = 'context' | 'add' | 'remove';

/** One line in a deterministic description or notes hunk. */
export interface TextChangeLine {
  type: TextChangeLineType;
  text: string;
}

/** A line-oriented text delta. Phase 1 emits one complete deterministic hunk per field. */
export interface TextChangeHunk {
  old_start: number;
  old_count: number;
  new_start: number;
  new_count: number;
  lines: TextChangeLine[];
}

/** One normative issue-field delta. */
export interface IssueFieldChange {
  field: IssueChangeField;
  before: unknown;
  after: unknown;
  hunks?: TextChangeHunk[];
}

/** One bead's deterministic change report. */
export interface IssueChange {
  id: string;
  internal_id: string;
  title: string;
  change: IssueChangeKind;
  fields: IssueFieldChange[];
}

/** Stable JSON document shared by the one-shot and blocking commands. */
export interface IssueChangesReport {
  since: string;
  tip: string;
  changes: IssueChange[];
}

export interface CreateIssueChangesReportOptions {
  since: string;
  tip: string;
  before: IssueSnapshot;
  after: IssueSnapshot;
  prefix: string;
  selection: IssueChangeSelection;
}

const ISSUE_CHANGE_FIELDS = [
  'title',
  'kind',
  'status',
  'priority',
  'description',
  'notes',
  'spec_path',
  'assignee',
  'labels',
  'dependencies',
  'parent_id',
  'child_order_hints',
  'due_date',
  'deferred_until',
  'created_by',
  'created_at',
  'closed_at',
  'close_reason',
  'extensions',
] as const satisfies readonly (keyof Issue)[];

export type IssueChangeField = (typeof ISSUE_CHANGE_FIELDS)[number];

const TEXT_FIELDS: ReadonlySet<IssueChangeField> = new Set(['description', 'notes']);

function deepEqual(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (left === null || right === null || typeof left !== typeof right) return false;
  if (Array.isArray(left) && Array.isArray(right)) {
    return (
      left.length === right.length && left.every((value, index) => deepEqual(value, right[index]))
    );
  }
  if (typeof left === 'object' && typeof right === 'object') {
    const leftRecord = left as Record<string, unknown>;
    const rightRecord = right as Record<string, unknown>;
    const leftKeys = Object.keys(leftRecord);
    const rightKeys = Object.keys(rightRecord);
    return (
      leftKeys.length === rightKeys.length &&
      leftKeys.every((key) => deepEqual(leftRecord[key], rightRecord[key]))
    );
  }
  return false;
}

function normalizeValue(value: unknown): unknown {
  if (value === undefined || value === null) return null;
  if (Array.isArray(value)) return value.map(normalizeValue);
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, normalizeValue(nested)]),
    );
  }
  return value;
}

function textLines(value: unknown): string[] {
  return typeof value === 'string' && value.length > 0 ? value.split('\n') : [];
}

/**
 * Context lines kept on each side of a text change.
 *
 * Reports are piped into agent prompts, so hunks must stay bounded even when a one-line
 * edit lands in a 50KB field; unified diff's conventional three lines of context.
 */
const TEXT_HUNK_CONTEXT_LINES = 3;

function createTextHunks(before: unknown, after: unknown): TextChangeHunk[] {
  const oldLines = textLines(before);
  const newLines = textLines(after);
  let prefixLength = 0;
  while (
    prefixLength < oldLines.length &&
    prefixLength < newLines.length &&
    oldLines[prefixLength] === newLines[prefixLength]
  ) {
    prefixLength += 1;
  }

  let suffixLength = 0;
  while (
    suffixLength < oldLines.length - prefixLength &&
    suffixLength < newLines.length - prefixLength &&
    oldLines[oldLines.length - suffixLength - 1] === newLines[newLines.length - suffixLength - 1]
  ) {
    suffixLength += 1;
  }

  const contextStart = Math.max(0, prefixLength - TEXT_HUNK_CONTEXT_LINES);
  const keptSuffixLength = Math.min(suffixLength, TEXT_HUNK_CONTEXT_LINES);
  const removed = oldLines.slice(prefixLength, oldLines.length - suffixLength);
  const added = newLines.slice(prefixLength, newLines.length - suffixLength);
  const keptPrefix = oldLines.slice(contextStart, prefixLength);
  const keptSuffix = oldLines.slice(
    oldLines.length - suffixLength,
    oldLines.length - suffixLength + keptSuffixLength,
  );

  const lines: TextChangeLine[] = [
    ...keptPrefix.map((text) => ({ type: 'context' as const, text })),
    ...removed.map((text) => ({ type: 'remove' as const, text })),
    ...added.map((text) => ({ type: 'add' as const, text })),
    ...keptSuffix.map((text) => ({ type: 'context' as const, text })),
  ];

  return [
    {
      old_start: contextStart + 1,
      old_count: keptPrefix.length + removed.length + keptSuffix.length,
      new_start: contextStart + 1,
      new_count: keptPrefix.length + added.length + keptSuffix.length,
      lines,
    },
  ];
}

function mergeMappings(
  before: IssueSnapshot,
  after: IssueSnapshot,
): {
  shortToUlid: Map<string, string>;
  ulidToShort: Map<string, string>;
} {
  const shortToUlid = new Map(before.shortToUlid);
  const ulidToShort = new Map(before.ulidToShort);
  for (const [shortId, ulid] of after.shortToUlid) {
    const existingUlid = shortToUlid.get(shortId);
    const existingShortId = ulidToShort.get(ulid);
    if (
      (existingUlid !== undefined && existingUlid !== ulid) ||
      (existingShortId !== undefined && existingShortId !== shortId)
    ) {
      throw new Error(`ID mapping changed incompatibly for ${shortId}`);
    }
    shortToUlid.set(shortId, ulid);
    ulidToShort.set(ulid, shortId);
  }
  return { shortToUlid, ulidToShort };
}

function resolveBeadIds(
  ids: readonly string[],
  shortToUlid: ReadonlyMap<string, string>,
): ReadonlySet<string> {
  return new Set(
    ids.map((input) => {
      const normalized = input.toLowerCase();
      if (isInternalId(normalized)) return normalized;
      const shortOrUlid = extractShortId(normalized);
      if (/^[0-9a-z]{26}$/.test(shortOrUlid)) return makeInternalId(shortOrUlid);
      const ulid = shortToUlid.get(shortOrUlid);
      if (ulid === undefined) throw new Error(`Unknown issue ID: ${input}`);
      return makeInternalId(ulid);
    }),
  );
}

function fieldChanges(before: Issue | undefined, after: Issue | undefined): IssueFieldChange[] {
  const createdOrDeleted = before === undefined || after === undefined;
  return ISSUE_CHANGE_FIELDS.flatMap((field): IssueFieldChange[] => {
    const beforeValue = normalizeValue(before?.[field]);
    const afterValue = normalizeValue(after?.[field]);
    // Created/deleted reports show the full field state, except fields unset on both
    // sides — a null -> null line carries no information.
    if (beforeValue === null && afterValue === null) return [];
    if (!createdOrDeleted && deepEqual(beforeValue, afterValue)) return [];
    const change: IssueFieldChange = { field, before: beforeValue, after: afterValue };
    if (TEXT_FIELDS.has(field) && !deepEqual(beforeValue, afterValue)) {
      change.hunks = createTextHunks(beforeValue, afterValue);
    }
    return [change];
  });
}

function issueMatchesFilter(
  issue: Issue | undefined,
  selection: Extract<IssueChangeSelection, { kind: 'filter' }>,
  readyIds: ReadonlySet<string>,
): boolean {
  if (issue === undefined) return false;
  if (
    !issueMatchesSharedFilters(issue, {
      labels: selection.labels,
      spec: selection.spec,
      status: selection.status,
    })
  ) {
    return false;
  }
  return !selection.ready || readyIds.has(issue.id);
}

/** Create the stable report shared by `tbd changes` and an exit-0 `tbd watch`. */
export function createIssueChangesReport(
  options: CreateIssueChangesReportOptions,
): IssueChangesReport {
  const mapping = mergeMappings(options.before, options.after);
  const explicitIds =
    options.selection.kind === 'beads'
      ? resolveBeadIds(options.selection.ids, mapping.shortToUlid)
      : null;
  const readyBefore = readyIssueIds(options.before.issues.values());
  const readyAfter = readyIssueIds(options.after.issues.values());
  const candidateIds = new Set([...options.before.issues.keys(), ...options.after.issues.keys()]);
  const changes: IssueChange[] = [];

  for (const internalId of Array.from(candidateIds).sort((left, right) =>
    left.localeCompare(right),
  )) {
    const before = options.before.issues.get(internalId);
    const after = options.after.issues.get(internalId);
    const fields = fieldChanges(before, after);
    const changed = fields.length > 0;
    let selected = false;

    switch (options.selection.kind) {
      case 'all':
        selected = changed;
        break;
      case 'beads':
        selected = explicitIds!.has(internalId) && changed;
        break;
      case 'filter': {
        const matchedBefore = issueMatchesFilter(before, options.selection, readyBefore);
        const matchedAfter = issueMatchesFilter(after, options.selection, readyAfter);
        selected = options.selection.ready
          ? matchedAfter && !matchedBefore
          : changed && (matchedBefore || matchedAfter);
        break;
      }
      default: {
        const exhaustive: never = options.selection;
        throw new Error(`Unhandled selection: ${JSON.stringify(exhaustive)}`);
      }
    }

    if (!selected) continue;
    const issue = after ?? before!;
    const ulid = extractUlidFromInternalId(internalId);
    const shortId = mapping.ulidToShort.get(ulid);
    if (shortId === undefined) {
      throw new Error(`No short ID mapping found for internal ID: ${internalId}`);
    }
    changes.push({
      id: `${options.prefix}-${shortId}`,
      internal_id: internalId,
      title: issue.title,
      change: before === undefined ? 'created' : after === undefined ? 'deleted' : 'updated',
      fields,
    });
  }

  return { since: options.since, tip: options.tip, changes };
}
