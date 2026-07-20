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

/** A line-oriented text delta with bounded unified-diff-style context. */
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
const TEXT_HUNK_CONTEXT_LINES = 3;

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

function diffTextLines(oldLines: readonly string[], newLines: readonly string[]): TextChangeLine[] {
  const trace: Map<number, number>[] = [];
  const furthestX = new Map<number, number>([[1, 0]]);
  const maximumDistance = oldLines.length + newLines.length;
  let finalDistance = 0;

  outer: for (let distance = 0; distance <= maximumDistance; distance += 1) {
    trace.push(new Map(furthestX));
    for (let diagonal = -distance; diagonal <= distance; diagonal += 2) {
      const downX = furthestX.get(diagonal + 1) ?? Number.NEGATIVE_INFINITY;
      const rightX = furthestX.get(diagonal - 1) ?? Number.NEGATIVE_INFINITY;
      let x =
        diagonal === -distance || (diagonal !== distance && rightX < downX) ? downX : rightX + 1;
      if (!Number.isFinite(x)) x = 0;
      let y = x - diagonal;
      while (x < oldLines.length && y < newLines.length && oldLines[x] === newLines[y]) {
        x += 1;
        y += 1;
      }
      furthestX.set(diagonal, x);
      if (x >= oldLines.length && y >= newLines.length) {
        finalDistance = distance;
        break outer;
      }
    }
  }

  const reversed: TextChangeLine[] = [];
  let x = oldLines.length;
  let y = newLines.length;
  for (let distance = finalDistance; distance >= 0; distance -= 1) {
    const values = trace[distance]!;
    const diagonal = x - y;
    const downX = values.get(diagonal + 1) ?? Number.NEGATIVE_INFINITY;
    const rightX = values.get(diagonal - 1) ?? Number.NEGATIVE_INFINITY;
    const previousDiagonal =
      diagonal === -distance || (diagonal !== distance && rightX < downX)
        ? diagonal + 1
        : diagonal - 1;
    const previousX = values.get(previousDiagonal) ?? 0;
    const previousY = previousX - previousDiagonal;

    while (x > previousX && y > previousY) {
      reversed.push({ type: 'context', text: oldLines[x - 1]! });
      x -= 1;
      y -= 1;
    }
    if (distance === 0) break;
    if (x === previousX) {
      reversed.push({ type: 'add', text: newLines[y - 1]! });
      y -= 1;
    } else {
      reversed.push({ type: 'remove', text: oldLines[x - 1]! });
      x -= 1;
    }
  }

  const forward = reversed.reverse();
  const canonical: TextChangeLine[] = [];
  for (let index = 0; index < forward.length; ) {
    const line = forward[index]!;
    if (line.type === 'context') {
      canonical.push(line);
      index += 1;
      continue;
    }
    const changed: TextChangeLine[] = [];
    while (index < forward.length && forward[index]!.type !== 'context') {
      changed.push(forward[index]!);
      index += 1;
    }
    canonical.push(
      ...changed.filter((entry) => entry.type === 'remove'),
      ...changed.filter((entry) => entry.type === 'add'),
    );
  }
  return canonical;
}

function createTextHunks(before: unknown, after: unknown): TextChangeHunk[] {
  const oldLines = textLines(before);
  const newLines = textLines(after);
  const lines = diffTextLines(oldLines, newLines);
  const positioned: (TextChangeLine & { oldLine: number; newLine: number })[] = [];
  let oldLine = 1;
  let newLine = 1;
  for (const line of lines) {
    positioned.push({ ...line, oldLine, newLine });
    if (line.type !== 'add') oldLine += 1;
    if (line.type !== 'remove') newLine += 1;
  }

  const ranges: { start: number; end: number }[] = [];
  for (let index = 0; index < positioned.length; index += 1) {
    if (positioned[index]!.type === 'context') continue;
    const start = Math.max(0, index - TEXT_HUNK_CONTEXT_LINES);
    const end = Math.min(positioned.length, index + TEXT_HUNK_CONTEXT_LINES + 1);
    const previous = ranges.at(-1);
    if (previous !== undefined && start <= previous.end) {
      previous.end = Math.max(previous.end, end);
    } else {
      ranges.push({ start, end });
    }
  }

  return ranges.map(({ start, end }) => {
    const entries = positioned.slice(start, end);
    const first = entries[0]!;
    return {
      old_start: first.oldLine,
      old_count: entries.filter((line) => line.type !== 'add').length,
      new_start: first.newLine,
      new_count: entries.filter((line) => line.type !== 'remove').length,
      lines: entries.map(({ type, text }) => ({ type, text })),
    };
  });
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
  knownIssueIds: ReadonlySet<string>,
): ReadonlySet<string> {
  return new Set(
    ids.map((input) => {
      const normalized = input.toLowerCase();
      let internalId: string;
      if (isInternalId(normalized)) {
        internalId = normalized;
      } else {
        const shortOrUlid = extractShortId(normalized);
        if (/^[0-9a-z]{26}$/.test(shortOrUlid)) {
          internalId = makeInternalId(shortOrUlid);
        } else {
          const ulid = shortToUlid.get(shortOrUlid);
          if (ulid === undefined) throw new Error(`Unknown issue ID: ${input}`);
          internalId = makeInternalId(ulid);
        }
      }
      if (!knownIssueIds.has(internalId)) throw new Error(`Unknown issue ID: ${input}`);
      return internalId;
    }),
  );
}

/** Fail fast when a static bead selection does not exist in a committed snapshot. */
export function validateIssueChangeSelection(
  snapshot: IssueSnapshot,
  selection: IssueChangeSelection,
): void {
  if (selection.kind !== 'beads') return;
  resolveBeadIds(selection.ids, snapshot.shortToUlid, new Set(snapshot.issues.keys()));
}

function fieldChanges(before: Issue | undefined, after: Issue | undefined): IssueFieldChange[] {
  const createdOrDeleted = before === undefined || after === undefined;
  return ISSUE_CHANGE_FIELDS.flatMap((field): IssueFieldChange[] => {
    const beforeValue = normalizeValue(before?.[field]);
    const afterValue = normalizeValue(after?.[field]);
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
  const candidateIds = new Set([...options.before.issues.keys(), ...options.after.issues.keys()]);
  const explicitIds =
    options.selection.kind === 'beads'
      ? resolveBeadIds(options.selection.ids, mapping.shortToUlid, candidateIds)
      : null;
  const readyBefore = readyIssueIds(options.before.issues.values());
  const readyAfter = readyIssueIds(options.after.issues.values());
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
