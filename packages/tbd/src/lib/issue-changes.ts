/**
 * Pure, deterministic issue-snapshot diffing for `tbd changes` and `tbd watch`.
 */

import { extractShortId, extractUlidFromInternalId, isInternalId, makeInternalId } from './ids.js';
import { issueMatchesSharedFilters, readyIssueIds } from './issue-selection.js';
import type { Issue, IssueStatusType } from './types.js';
import type { IssueFieldName } from './schemas.js';

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
export type TextHunksOmittedReason = 'complexity_limit';

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
  hunks_omitted?: TextHunksOmittedReason;
}

/** One bead's deterministic change report. */
export interface IssueChange {
  id: string;
  internal_id: string;
  title: string;
  change: IssueChangeKind;
  fields: IssueFieldChange[];
}

/**
 * Stable JSON document shared by the one-shot and blocking commands.
 *
 * Like every other tbd `--json` surface, this document evolves by addition only, so
 * consumers must ignore fields they do not recognize.
 */
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

/** Inputs for diffing two issue snapshots without assigning commit semantics. */
export type CreateIssueChangesOptions = Omit<CreateIssueChangesReportOptions, 'since' | 'tip'>;

export type IssueChangeField = Exclude<IssueFieldName, 'type' | 'id' | 'version' | 'updated_at'>;

// Object insertion order is the stable report order. Record exhaustiveness makes a new
// substantive Issue field a type error until its change-report position is chosen.
const ISSUE_CHANGE_FIELD_ORDER = {
  title: true,
  kind: true,
  status: true,
  priority: true,
  description: true,
  notes: true,
  spec_path: true,
  // Added in f08 and never registered here, because the exhaustiveness guard this
  // table claims to have was silently dead. `tbd changes` has therefore never reported
  // a doc or ref being attached to a bead.
  docs: true,
  refs: true,
  assignee: true,
  delegate: true,
  labels: true,
  dependencies: true,
  parent_id: true,
  child_order_hints: true,
  due_date: true,
  deferred_until: true,
  hold: true,
  hold_until: true,
  started_at: true,
  created_by: true,
  created_at: true,
  closed_at: true,
  close_reason: true,
  resolution: true,
  duplicate_of: true,
  extensions: true,
} as const satisfies Record<IssueChangeField, true>;

const ISSUE_CHANGE_FIELDS = Object.keys(ISSUE_CHANGE_FIELD_ORDER) as IssueChangeField[];

const TEXT_FIELDS: ReadonlySet<IssueChangeField> = new Set(['description', 'notes']);
const TEXT_HUNK_CONTEXT_LINES = 3;
/** Caps Myers trace growth at roughly O(limit^2), independent of body line count. */
const MAX_TEXT_DIFF_EDIT_DISTANCE = 200;

function deepEqual(left: unknown, right: unknown): boolean {
  if (left === right) {
    return true;
  }
  if (left === null || right === null || typeof left !== typeof right) {
    return false;
  }
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
  if (value === undefined || value === null) {
    return null;
  }
  if (Array.isArray(value)) {
    return value.map(normalizeValue);
  }
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

type TextLineDiff =
  | { kind: 'complete'; lines: TextChangeLine[] }
  | { kind: 'omitted'; reason: TextHunksOmittedReason };

function diffTextLines(oldLines: readonly string[], newLines: readonly string[]): TextLineDiff {
  const trace: Map<number, number>[] = [];
  const furthestX = new Map<number, number>([[1, 0]]);
  const maximumDistance = Math.min(oldLines.length + newLines.length, MAX_TEXT_DIFF_EDIT_DISTANCE);
  let finalDistance: number | null = null;

  outer: for (let distance = 0; distance <= maximumDistance; distance += 1) {
    trace.push(new Map(furthestX));
    for (let diagonal = -distance; diagonal <= distance; diagonal += 2) {
      const downX = furthestX.get(diagonal + 1) ?? Number.NEGATIVE_INFINITY;
      const rightX = furthestX.get(diagonal - 1) ?? Number.NEGATIVE_INFINITY;
      let x =
        diagonal === -distance || (diagonal !== distance && rightX < downX) ? downX : rightX + 1;
      if (!Number.isFinite(x)) {
        x = 0;
      }
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

  if (finalDistance === null) {
    return { kind: 'omitted', reason: 'complexity_limit' };
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
    if (distance === 0) {
      break;
    }
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
  return { kind: 'complete', lines: canonical };
}

function createTextHunks(
  before: unknown,
  after: unknown,
): Pick<IssueFieldChange, 'hunks' | 'hunks_omitted'> {
  const oldLines = textLines(before);
  const newLines = textLines(after);
  const diff = diffTextLines(oldLines, newLines);
  if (diff.kind === 'omitted') {
    return { hunks_omitted: diff.reason };
  }
  const lines = diff.lines;
  const positioned: (TextChangeLine & { oldLine: number; newLine: number })[] = [];
  let oldLine = 1;
  let newLine = 1;
  for (const line of lines) {
    positioned.push({ ...line, oldLine, newLine });
    if (line.type !== 'add') {
      oldLine += 1;
    }
    if (line.type !== 'remove') {
      newLine += 1;
    }
  }

  const ranges: { start: number; end: number }[] = [];
  for (let index = 0; index < positioned.length; index += 1) {
    if (positioned[index]!.type === 'context') {
      continue;
    }
    const start = Math.max(0, index - TEXT_HUNK_CONTEXT_LINES);
    const end = Math.min(positioned.length, index + TEXT_HUNK_CONTEXT_LINES + 1);
    const previous = ranges.at(-1);
    if (previous !== undefined && start <= previous.end) {
      previous.end = Math.max(previous.end, end);
    } else {
      ranges.push({ start, end });
    }
  }

  const hunks = ranges.map(({ start, end }) => {
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
  return { hunks };
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
        // Preserve imported short IDs containing a hyphen before treating the
        // leading segment as a display prefix.
        const shortOrUlid = shortToUlid.has(normalized) ? normalized : extractShortId(normalized);
        if (/^[0-9a-z]{26}$/.test(shortOrUlid)) {
          internalId = makeInternalId(shortOrUlid);
        } else {
          const ulid = shortToUlid.get(shortOrUlid);
          if (ulid === undefined) {
            throw new Error(`Unknown issue ID: ${input}`);
          }
          internalId = makeInternalId(ulid);
        }
      }
      if (!knownIssueIds.has(internalId)) {
        throw new Error(`Unknown issue ID: ${input}`);
      }
      return internalId;
    }),
  );
}

/** Fail fast when a static bead selection does not exist in a committed snapshot. */
export function validateIssueChangeSelection(
  snapshot: IssueSnapshot,
  selection: IssueChangeSelection,
): void {
  if (selection.kind !== 'beads') {
    return;
  }
  resolveBeadIds(selection.ids, snapshot.shortToUlid, new Set(snapshot.issues.keys()));
}

function fieldChanges(before: Issue | undefined, after: Issue | undefined): IssueFieldChange[] {
  const createdOrDeleted = before === undefined || after === undefined;
  return ISSUE_CHANGE_FIELDS.flatMap((field): IssueFieldChange[] => {
    const beforeValue = normalizeValue(before?.[field]);
    const afterValue = normalizeValue(after?.[field]);
    if (beforeValue === null && afterValue === null) {
      return [];
    }
    if (!createdOrDeleted && deepEqual(beforeValue, afterValue)) {
      return [];
    }
    const change: IssueFieldChange = { field, before: beforeValue, after: afterValue };
    if (TEXT_FIELDS.has(field) && !deepEqual(beforeValue, afterValue)) {
      Object.assign(change, createTextHunks(beforeValue, afterValue));
    }
    return [change];
  });
}

function issueMatchesFilter(
  issue: Issue | undefined,
  selection: Extract<IssueChangeSelection, { kind: 'filter' }>,
  readyIds: ReadonlySet<string>,
): boolean {
  if (issue === undefined) {
    return false;
  }
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

/** Diff two snapshots for callers that observe local, potentially uncommitted state. */
export function createIssueChanges(options: CreateIssueChangesOptions): IssueChange[] {
  const mapping = mergeMappings(options.before, options.after);
  const candidateIds = new Set([...options.before.issues.keys(), ...options.after.issues.keys()]);
  const explicitIds =
    options.selection.kind === 'beads'
      ? resolveBeadIds(options.selection.ids, mapping.shortToUlid, candidateIds)
      : null;
  // A static bead selection is also a performance boundary. Callers such as the web
  // observer already know which version stamps moved, so do not deep-compare every
  // description and notes field in a large repository just to discard almost all of it.
  const idsToCompare = explicitIds ?? candidateIds;
  const needsReadySets = options.selection.kind === 'filter' && options.selection.ready;
  const emptySet: ReadonlySet<string> = new Set();
  const readyBefore = needsReadySets ? readyIssueIds(options.before.issues.values()) : emptySet;
  const readyAfter = needsReadySets ? readyIssueIds(options.after.issues.values()) : emptySet;
  const changes: IssueChange[] = [];

  for (const internalId of Array.from(idsToCompare).sort((left, right) =>
    left.localeCompare(right),
  )) {
    const before = options.before.issues.get(internalId);
    const after = options.after.issues.get(internalId);
    let selected = false;

    switch (options.selection.kind) {
      case 'all':
        selected = true;
        break;
      case 'beads':
        selected = explicitIds!.has(internalId);
        break;
      case 'filter': {
        const matchedBefore = issueMatchesFilter(before, options.selection, readyBefore);
        const matchedAfter = issueMatchesFilter(after, options.selection, readyAfter);
        selected = options.selection.ready
          ? matchedAfter && !matchedBefore
          : matchedBefore || matchedAfter;
        break;
      }
      default: {
        const exhaustive: never = options.selection;
        throw new Error(`Unhandled selection: ${JSON.stringify(exhaustive)}`);
      }
    }

    if (!selected) {
      continue;
    }
    const fields = fieldChanges(before, after);
    if (fields.length === 0 && !(options.selection.kind === 'filter' && options.selection.ready)) {
      continue;
    }
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

  return changes;
}

/** Create the stable committed report shared by `tbd changes` and an exit-0 `tbd watch`. */
export function createIssueChangesReport(
  options: CreateIssueChangesReportOptions,
): IssueChangesReport {
  return {
    since: options.since,
    tip: options.tip,
    changes: createIssueChanges(options),
  };
}
