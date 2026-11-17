/** In-memory issue snapshot and the read-only response model served by `tbd web`. */

import { join } from 'node:path';

import type { TbdDataContext } from '../lib/data-context.js';
import { loadDataContext } from '../lib/data-context.js';
import { buildIssueTree } from '../lib/tree-view.js';
import type { IssueForTree, TreeNode } from '../lib/tree-view.js';
import { checkWorktreeHealth, git } from '../../file/git.js';
import { readDataSyncEpoch } from '../../file/data-sync-epoch.js';
import { resolveToInternalId } from '../../file/id-mapping.js';
import { listIssues } from '../../file/storage.js';
import type { InvalidIssueFile } from '../../file/storage.js';
import { listWorkspaces } from '../../file/workspace.js';
import { formatDisplayId } from '../../lib/ids.js';
import type { InternalIssueId } from '../../lib/ids.js';
import { createIssueChanges } from '../../lib/issue-changes.js';
import type {
  IssueChange,
  IssueFieldChange,
  IssueSnapshot,
  TextChangeHunk,
} from '../../lib/issue-changes.js';
import {
  defaultIssueQuery,
  describeQuery,
  filterIssues,
  selectIssues,
} from '../../lib/issue-query.js';
import type { IssueQuery, IssueSort } from '../../lib/issue-query.js';
import { readyIssueIds } from '../../lib/issue-selection.js';
import { computeIssueStats } from '../../lib/issue-stats.js';
import type { IssueStats } from '../../lib/issue-stats.js';
import { parsePriority } from '../../lib/priority.js';
import type { Issue, IssueKindType, IssueStatusType } from '../../lib/types.js';
import { resolveSharedTbdPaths } from '../../lib/paths.js';
import { VERSION } from '../lib/version.js';
import { pathExists, readMetadataMarker } from './snapshot-consistency.js';

/** Hard response ceiling; the browser pages these rows into smaller render windows. */
export const MAX_BOARD_ROWS = 10_000;
/** Keep dynamic label menus bounded while retaining every selected value. */
export const MAX_LABEL_FACETS = 32;
/** Detail is diagnostic; board motion remains complete through movedIds/removedIds. */
export const MAX_LOCAL_CHANGE_DETAILS = 100;
export const MAX_LOCAL_CHANGE_DETAIL_BYTES = 256 * 1024;
const MAX_LOCAL_CHANGE_VALUE_CHARS = 2_000;
const MAX_LOCAL_HUNK_LINES = 80;
const MAX_LOCAL_HUNK_LINE_CHARS = 500;

// Prefixes allow dot/underscore, and imported ShortIds also allow dot, underscore,
// and hyphen. Requiring the leading prefix letter still rejects option-shaped input.
const PUBLIC_ID = /^[A-Za-z][A-Za-z0-9._]{0,19}-[0-9a-z._-]+$/u;
const STATUS_VALUES = ['open', 'in_progress', 'blocked', 'deferred', 'closed'] as const;
const KIND_VALUES = ['bug', 'feature', 'task', 'epic', 'chore'] as const;
const PRIORITY_VALUES = [0, 1, 2, 3, 4] as const;
const STATUSES = new Set<IssueStatusType>(STATUS_VALUES);
const KINDS = new Set<IssueKindType>(KIND_VALUES);
const SORTS = new Set<IssueSort>(['priority', 'created', 'updated']);
const BOARD_SORT_KEYS = new Set<BoardSortKey>([
  'id',
  'priority',
  'status',
  'kind',
  'title',
  'updated',
  'labels',
]);
const TREE_CHARS = {
  child: '└── ',
  indent: '    ',
} as const;

export interface BoardRow {
  id: string;
  internalId: string;
  parentId: string | null;
  title: string;
  status: IssueStatusType;
  kind: IssueKindType;
  priority: number;
  labels: string[];
  spec_path: string | null;
  assignee: string | null;
  ready: boolean;
  updated_at: string;
  /** Tree guide string, empty in flat mode. */
  prefix: string;
}

export type BoardSortKey = 'id' | 'priority' | 'status' | 'kind' | 'title' | 'updated' | 'labels';
export type BoardSortDirection = 'asc' | 'desc';

export interface BoardSort {
  key: BoardSortKey;
  direction: BoardSortDirection;
}

export interface LabelFacet {
  label: string;
  count: number;
}

export interface ValueFacet<T extends string | number> {
  value: T;
  count: number;
}

export interface BeadBody {
  id: string;
  internalId: string;
  title: string;
  kind: IssueKindType;
  status: IssueStatusType;
  priority: number;
  description: string | null;
  notes: string | null;
  spec_path: string | null;
  assignee: string | null;
  parent: string | null;
  dependencies: { type: string; target: string }[];
  labels: string[];
  due_date: string | null;
  deferred_until: string | null;
  close_reason: string | null;
  created_at: string;
  updated_at: string;
  version: number;
}

export interface RepoStatus {
  tbdVersion: string;
  gitBranch: string | null;
  syncBranch: string;
  remote: string;
  displayPrefix: string;
  worktreePath: string | null;
  worktreeHealthy: boolean | null;
  worktreeStatus: string | null;
  workspaces: string[];
}

export type ObservationPhase = 'starting' | 'watching' | 'error' | 'stopped';
export type ObservationMode = 'native+reconcile' | 'native' | 'reconcile' | 'unavailable';

export interface EventLogEntry {
  at: string;
  level: 'info' | 'update' | 'error';
  message: string;
}

export interface BoardSnapshotState {
  localTip: string | null;
  totalBeads: number;
  stats: IssueStats;
  repoStatus: RepoStatus | null;
  dataVersion: number;
  movedIds: string[];
  removedIds: string[];
  refreshedAt: string;
}

export interface BoardReloadResult {
  /** True when a concurrent writer made this candidate unsafe to publish. */
  deferred: boolean;
  /** True only when this particular reload observed a changed `id:version` snapshot. */
  moved: boolean;
  /** Includes config, local-tip, and repository-status changes that should reach clients. */
  stateChanged: boolean;
  dataVersion: number;
  movedIds: string[];
  removedIds: string[];
  changes: IssueChange[];
  changeTotal: number;
  changesTruncated: boolean;
}

/** Stable additive state document carried by board responses and SSE frames. */
export interface WebState extends BoardSnapshotState {
  observerId: string;
  /** Monotonic within one observer instance, including metadata-only publications. */
  stateVersion: number;
  repoDir: string;
  syncBranch: string;
  remote: string;
  latestChanges: IssueChange[];
  latestChangeTotal: number;
  latestChangesTruncated: boolean;
  changeDataVersion: number;
  observationPhase: ObservationPhase;
  observationMode: ObservationMode;
  observationError: string | null;
  updateCount: number;
  log: EventLogEntry[];
}

export interface BoardResponse {
  command: string;
  commandExact: boolean;
  filtersExact: boolean;
  search: string;
  total: number;
  matched: number;
  closedHidden: number;
  statusFacets: ValueFacet<IssueStatusType>[];
  kindFacets: ValueFacet<IssueKindType>[];
  priorityFacets: ValueFacet<number>[];
  labelFacets: LabelFacet[];
  orderingCaveat: string | null;
  rows: BoardRow[];
  truncated: number;
  state: WebState;
}

export type BeadLookupResult =
  | { kind: 'ok'; body: BeadBody }
  | { kind: 'invalid' }
  | { kind: 'not-found' };

export interface BoardStateDependencies {
  loadContext: (repoDir: string) => Promise<TbdDataContext>;
  listIssues: (dataSyncDir: string) => Promise<Issue[]>;
  readRepoStatus: (repoDir: string, context: TbdDataContext) => Promise<RepoStatus>;
  readLocalTip: (repoDir: string, branch: string) => Promise<string | null>;
  /** Optional in tests; production uses it to avoid reading inside writer transactions. */
  readWriterActive?: (repoDir: string, context: TbdDataContext | null) => Promise<boolean>;
  /** Optional in tests; production validates that candidate reads span one stable token. */
  readSnapshotMarker?: (paths: readonly string[]) => Promise<string>;
  /** Optional in tests; production requires one unchanged quiescent writer epoch. */
  readSnapshotEpoch?: (path: string) => Promise<string | null>;
  now: () => Date;
}

interface ParsedBoardQuery {
  query: IssueQuery;
  parentDisplayId: string | null;
  pretty: boolean;
  search: string;
  labelSearch: string;
  sorts: BoardSort[];
}

interface BoardSnapshot {
  issues: Issue[];
  byInternalId: Map<string, Issue>;
  byDisplayId: Map<string, Issue>;
  displayIdByInternalId: Map<string, string>;
}

interface BoundedChanges {
  changes: IssueChange[];
  truncated: boolean;
}

const emptyStats = computeIssueStats([]);

function repoStatusEqual(left: RepoStatus | null, right: RepoStatus | null): boolean {
  if (left === right) {
    return true;
  }
  return (
    left !== null &&
    right !== null &&
    left.tbdVersion === right.tbdVersion &&
    left.gitBranch === right.gitBranch &&
    left.syncBranch === right.syncBranch &&
    left.remote === right.remote &&
    left.displayPrefix === right.displayPrefix &&
    left.worktreePath === right.worktreePath &&
    left.worktreeHealthy === right.worktreeHealthy &&
    left.worktreeStatus === right.worktreeStatus &&
    left.workspaces.length === right.workspaces.length &&
    left.workspaces.every((workspace, index) => workspace === right.workspaces[index])
  );
}

function stringMapEqual(
  left: ReadonlyMap<string, string>,
  right: ReadonlyMap<string, string>,
): boolean {
  return left.size === right.size && [...left].every(([key, value]) => right.get(key) === value);
}

/** Fields loaded from disk that affect snapshot interpretation or observation paths. */
function reloadContextEqual(left: TbdDataContext, right: TbdDataContext): boolean {
  return (
    left.dataSyncDir === right.dataSyncDir &&
    left.prefix === right.prefix &&
    left.config.sync.branch === right.config.sync.branch &&
    left.config.sync.remote === right.config.sync.remote &&
    left.sharedPaths.gitCommonDir === right.sharedPaths.gitCommonDir &&
    left.sharedPaths.sharedWorktreePath === right.sharedPaths.sharedWorktreePath &&
    left.sharedPaths.sharedLockPath === right.sharedPaths.sharedLockPath &&
    left.sharedPaths.sharedDataSyncEpochPath === right.sharedPaths.sharedDataSyncEpochPath &&
    stringMapEqual(left.mapping.shortToUlid, right.mapping.shortToUlid) &&
    stringMapEqual(left.mapping.ulidToShort, right.mapping.ulidToShort)
  );
}

function truncateString(value: string, maximum: number): string {
  if (value.length <= maximum) {
    return value;
  }
  return `${value.slice(0, maximum)}… [${value.length - maximum} characters omitted from live detail]`;
}

function boundChangeValue(value: unknown): unknown {
  if (typeof value === 'string') {
    return truncateString(value, MAX_LOCAL_CHANGE_VALUE_CHARS);
  }
  const encoded = JSON.stringify(value);
  if (encoded === undefined || encoded.length <= MAX_LOCAL_CHANGE_VALUE_CHARS) {
    return value;
  }
  return `[${Buffer.byteLength(encoded)}-byte value omitted from live detail; expand the bead for its current value]`;
}

function boundHunks(hunks: readonly TextChangeHunk[] | undefined): TextChangeHunk[] | undefined {
  if (hunks === undefined) {
    return undefined;
  }
  let linesRemaining = MAX_LOCAL_HUNK_LINES;
  const bounded: TextChangeHunk[] = [];
  for (const hunk of hunks) {
    if (linesRemaining === 0) {
      break;
    }
    const lines = hunk.lines.slice(0, linesRemaining).map((line) => ({
      ...line,
      text: truncateString(line.text, MAX_LOCAL_HUNK_LINE_CHARS),
    }));
    linesRemaining -= lines.length;
    bounded.push({ ...hunk, lines });
  }
  return bounded;
}

function boundFieldChange(field: IssueFieldChange): IssueFieldChange {
  const hunks = boundHunks(field.hunks);
  return {
    ...field,
    before: boundChangeValue(field.before),
    after: boundChangeValue(field.after),
    ...(hunks === undefined ? {} : { hunks }),
  };
}

function fieldNamesOnly(change: IssueChange): IssueChange {
  return {
    ...change,
    title: truncateString(change.title, MAX_LOCAL_CHANGE_VALUE_CHARS),
    fields: change.fields.map((field) => ({
      field: field.field,
      before: '[detail omitted from live view]',
      after: '[expand the bead for its current value]',
    })),
  };
}

function boundLocalChanges(changes: readonly IssueChange[]): BoundedChanges {
  const bounded: IssueChange[] = [];
  let bytes = 2; // JSON array brackets
  for (const change of changes) {
    let candidate: IssueChange = {
      ...change,
      title: truncateString(change.title, MAX_LOCAL_CHANGE_VALUE_CHARS),
      fields: change.fields.map(boundFieldChange),
    };
    let candidateBytes =
      Buffer.byteLength(JSON.stringify(candidate)) + (bounded.length > 0 ? 1 : 0);
    if (bytes + candidateBytes > MAX_LOCAL_CHANGE_DETAIL_BYTES) {
      candidate = fieldNamesOnly(change);
      candidateBytes = Buffer.byteLength(JSON.stringify(candidate)) + (bounded.length > 0 ? 1 : 0);
      if (bytes + candidateBytes <= MAX_LOCAL_CHANGE_DETAIL_BYTES) {
        bounded.push(candidate);
      }
      return { changes: bounded, truncated: true };
    }
    bounded.push(candidate);
    bytes += candidateBytes;
  }
  return { changes: bounded, truncated: false };
}

async function defaultReadRepoStatus(
  repoDir: string,
  context: TbdDataContext,
): Promise<RepoStatus> {
  let gitBranch: string | null = null;
  try {
    gitBranch = await git('-C', repoDir, 'rev-parse', '--abbrev-ref', 'HEAD');
  } catch {
    // A detached or temporarily unreadable Git checkout does not invalidate the board.
  }

  const health = await checkWorktreeHealth(repoDir, context.config.sync.branch);
  let workspaces: string[] = [];
  try {
    workspaces = (await listWorkspaces(repoDir)).sort((left, right) => left.localeCompare(right));
  } catch {
    // Matches `tbd status`: workspace enumeration is diagnostic, not load-bearing.
  }

  return {
    tbdVersion: VERSION,
    gitBranch,
    syncBranch: context.config.sync.branch,
    remote: context.config.sync.remote,
    displayPrefix: context.prefix,
    worktreePath: context.sharedPaths.sharedWorktreePath,
    worktreeHealthy: health.valid,
    worktreeStatus: health.status,
    workspaces,
  };
}

async function defaultReadLocalTip(repoDir: string, branch: string): Promise<string | null> {
  try {
    return await git('-C', repoDir, 'rev-parse', '--verify', `refs/heads/${branch}`);
  } catch {
    return null;
  }
}

async function readCompleteIssueSnapshot(dataSyncDir: string): Promise<Issue[]> {
  const invalid: InvalidIssueFile[] = [];
  const issues = await listIssues(dataSyncDir, {
    warnOnInvalid: false,
    validateFileName: true,
    onInvalidIssue: (entry) => invalid.push(entry),
  });
  if (invalid.length > 0) {
    const first = invalid[0]!;
    const remainder = invalid.length === 1 ? '' : ` and ${invalid.length - 1} more invalid files`;
    throw new Error(
      `Cannot publish an incomplete bead snapshot: ${first.file}: ${first.reason}${remainder}`,
    );
  }
  return issues;
}

const defaultDependencies: BoardStateDependencies = {
  // Server startup performs the normal repair-capable preparation once. A live
  // observer must never enter or wait on the writer-lock graph.
  loadContext: (repoDir) => loadDataContext(repoDir, { repair: false }),
  listIssues: readCompleteIssueSnapshot,
  readRepoStatus: defaultReadRepoStatus,
  readLocalTip: defaultReadLocalTip,
  readWriterActive: async (repoDir, context) => {
    const lockPath =
      context?.sharedPaths.sharedLockPath ?? (await resolveSharedTbdPaths(repoDir)).sharedLockPath;
    return pathExists(lockPath);
  },
  readSnapshotMarker: readMetadataMarker,
  readSnapshotEpoch: async (path) => {
    const epoch = await readDataSyncEpoch(path);
    return epoch.phase === 'quiescent' ? epoch.token : null;
  },
  now: () => new Date(),
};

function optional(params: URLSearchParams, name: string): string | null {
  const value = params.get(name);
  return value === null || value === '' ? null : value;
}

function flag(params: URLSearchParams, name: string): boolean {
  const value = params.get(name);
  return value !== null && value !== '' && value !== '0' && value !== 'false';
}

function parseLimit(value: string | null): number | null {
  if (value === null) {
    return null;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function parseBoardSorts(params: URLSearchParams): BoardSort[] {
  const sorts: BoardSort[] = [];
  const seen = new Set<BoardSortKey>();
  for (const value of params.getAll('order')) {
    const [rawKey, rawDirection, ...remainder] = value.split(':');
    if (
      remainder.length > 0 ||
      rawKey === undefined ||
      !BOARD_SORT_KEYS.has(rawKey as BoardSortKey) ||
      (rawDirection !== 'asc' && rawDirection !== 'desc')
    ) {
      continue;
    }
    const key = rawKey as BoardSortKey;
    if (!seen.has(key)) {
      sorts.push({ key, direction: rawDirection });
      seen.add(key);
    }
    if (sorts.length >= BOARD_SORT_KEYS.size) {
      break;
    }
  }
  return sorts;
}

function parseBoardQuery(params: URLSearchParams, context: TbdDataContext): ParsedBoardQuery {
  const statusValue = optional(params, 'status');
  const kindValue = optional(params, 'type');
  const sortValue = optional(params, 'sort');
  const priorityValue = optional(params, 'priority');
  const parentDisplayId = optional(params, 'parent');
  let parentId: string | null = null;
  if (parentDisplayId !== null) {
    try {
      parentId = resolveToInternalId(parentDisplayId, context.mapping);
    } catch {
      // Preserve `tbd list --parent` behavior: an unknown public id matches no rows.
      parentId = `unresolved:${parentDisplayId}`;
    }
  }

  const query = {
    ...defaultIssueQuery(),
    status:
      statusValue !== null && STATUSES.has(statusValue as IssueStatusType)
        ? (statusValue as IssueStatusType)
        : null,
    includeClosed: flag(params, 'all'),
    kind:
      kindValue !== null && KINDS.has(kindValue as IssueKindType)
        ? (kindValue as IssueKindType)
        : null,
    priority: priorityValue === null ? null : (parsePriority(priorityValue) ?? null),
    assignee: optional(params, 'assignee'),
    labels: params.getAll('label').filter(Boolean),
    parentId,
    spec: optional(params, 'spec'),
    deferred: flag(params, 'deferred'),
    ready: flag(params, 'ready'),
    sort:
      sortValue !== null && SORTS.has(sortValue as IssueSort)
        ? (sortValue as IssueSort)
        : 'priority',
    limit: parseLimit(optional(params, 'limit')),
  } satisfies IssueQuery;

  return {
    query,
    parentDisplayId,
    pretty: flag(params, 'pretty'),
    search: params.get('q')?.trim() ?? '',
    labelSearch: params.get('labelq')?.trim() ?? '',
    sorts: parseBoardSorts(params),
  };
}

function describeBoardOrdering(sorts: readonly BoardSort[], pretty: boolean): string | null {
  if (sorts.length === 0) {
    return null;
  }
  const title = (key: BoardSortKey): string =>
    key === 'id' ? 'ID' : `${key[0]!.toUpperCase()}${key.slice(1)}`;
  const stack = sorts
    .map((sort) => `${title(sort.key)} ${sort.direction === 'asc' ? '↑' : '↓'}`)
    .join(' then ');
  if (!pretty) {
    return `Browser column sort: ${stack}; flat mode applies the stack to individual rows`;
  }
  const groupRule = sorts.some((sort) => sort.key === 'updated')
    ? "Pretty orders outermost groups by each visible subtree's latest update and keeps children in official order"
    : 'Pretty orders outermost groups and keeps children in official order';
  return `Browser column sort: ${stack}; ${groupRule}`;
}

function compareText(left: string, right: string): number {
  const normalizedLeft = left.normalize('NFKC').toLocaleLowerCase('en-US');
  const normalizedRight = right.normalize('NFKC').toLocaleLowerCase('en-US');
  if (normalizedLeft !== normalizedRight) {
    return normalizedLeft < normalizedRight ? -1 : 1;
  }
  const exactLeft = left.normalize('NFKC');
  const exactRight = right.normalize('NFKC');
  return exactLeft < exactRight ? -1 : exactLeft > exactRight ? 1 : 0;
}

function compareTimestamps(left: string, right: string): number {
  const leftTime = Date.parse(left);
  const rightTime = Date.parse(right);
  if (Number.isFinite(leftTime) && Number.isFinite(rightTime)) {
    return leftTime - rightTime;
  }
  return compareText(left, right);
}

function matchesSearch(issue: Issue, displayId: string, search: string): boolean {
  if (search === '') {
    return true;
  }
  const haystack = `${displayId} ${issue.title} ${issue.labels.join(' ')} ${
    issue.spec_path ?? ''
  }`.toLowerCase();
  return haystack.includes(search.toLowerCase());
}

/** Serialized, immutable-at-request-time board snapshot. */
export class BoardState {
  private context: TbdDataContext | null = null;
  private initialized = false;
  private snapshot: BoardSnapshot = {
    issues: [],
    byInternalId: new Map(),
    byDisplayId: new Map(),
    displayIdByInternalId: new Map(),
  };
  /** Ready ids for the response being built; see `buildBoardResponse`. */
  private responseReadyIds: ReadonlySet<string> = new Set();

  private snapshotState: BoardSnapshotState;
  private reloadTail: Promise<unknown> = Promise.resolve();

  constructor(
    readonly repoDir: string,
    private readonly dependencies: BoardStateDependencies = defaultDependencies,
    initialContext: TbdDataContext | null = null,
  ) {
    this.context = initialContext;
    this.snapshotState = {
      localTip: null,
      totalBeads: 0,
      stats: emptyStats,
      repoStatus: null,
      dataVersion: 0,
      movedIds: [],
      removedIds: [],
      refreshedAt: dependencies.now().toISOString(),
    };
  }

  /** Queue reloads so overlapping local events cannot publish snapshots out of order. */
  reload(): Promise<BoardReloadResult> {
    const work = this.reloadTail.catch(() => undefined).then(() => this.reloadOnce());
    this.reloadTail = work.catch(() => undefined);
    return work;
  }

  getSnapshotState(): BoardSnapshotState {
    return {
      ...this.snapshotState,
      movedIds: [...this.snapshotState.movedIds],
      removedIds: [...this.snapshotState.removedIds],
    };
  }

  getWebConfig(): { syncBranch: string; remote: string } {
    const context = this.requireContext();
    return {
      syncBranch: context.config.sync.branch,
      remote: context.config.sync.remote,
    };
  }

  getObservationRoot(): string {
    return this.requireContext().dataSyncDir;
  }

  /** Constant-size metadata inputs used to reconcile dropped filesystem events. */
  getObservationPaths(): string[] {
    return this.observationPaths(this.requireContext());
  }

  private observationPaths(context: TbdDataContext): string[] {
    return [
      join(this.repoDir, '.tbd', 'config.yml'),
      join(this.repoDir, '.tbd', 'workspaces'),
      context.dataSyncDir,
      join(context.dataSyncDir, 'issues'),
      join(context.dataSyncDir, 'mappings'),
      context.sharedPaths.sharedDataSyncEpochPath,
      join(
        context.sharedPaths.gitCommonDir,
        'refs',
        'heads',
        ...context.config.sync.branch.split('/'),
      ),
    ];
  }

  buildBoardResponse(params: URLSearchParams, state: WebState): BoardResponse {
    const context = this.requireContext();
    const parsed = parseBoardQuery(params, context);
    const queryWithoutLimit = { ...parsed.query, limit: null };
    // Readiness depends on `deferred_until`, so it is a function of the clock and cannot
    // be cached on the snapshot. Evaluate it once here and reuse that instant for both
    // the Ready filter and the per-row marker: two reads would let a deferral elapsing
    // mid-response show a bead in the Ready view without its ready marker. This method
    // is synchronous, so no other response can interleave with the field below.
    const readyAt = this.dependencies.now().getTime();
    this.responseReadyIds = readyIssueIds(this.snapshot.issues, readyAt);
    const filterFacetPool = (query: IssueQuery): Issue[] =>
      filterIssues(this.snapshot.issues, query, readyAt).filter((issue) =>
        matchesSearch(
          issue,
          this.snapshot.displayIdByInternalId.get(issue.id) ?? issue.id,
          parsed.search,
        ),
      );
    const selected = selectIssues(this.snapshot.issues, queryWithoutLimit, readyAt).filter(
      (issue) =>
        matchesSearch(
          issue,
          this.snapshot.displayIdByInternalId.get(issue.id) ?? issue.id,
          parsed.search,
        ),
    );
    const labelFacetPool = filterFacetPool({ ...queryWithoutLimit, labels: [] });
    const statusFacetPool = filterFacetPool({
      ...queryWithoutLimit,
      status: null,
      includeClosed: true,
    });
    const kindFacetPool = filterFacetPool({ ...queryWithoutLimit, kind: null });
    const priorityFacetPool = filterFacetPool({ ...queryWithoutLimit, priority: null });
    const orderedSelected =
      parsed.sorts.length === 0 ? selected : this.sortIssuesByColumns(selected, parsed.sorts);
    const limited =
      parsed.query.limit === null ? orderedSelected : orderedSelected.slice(0, parsed.query.limit);

    let closedHidden = 0;
    if (!parsed.query.includeClosed && parsed.query.status !== 'closed') {
      const includingClosed = selectIssues(
        this.snapshot.issues,
        {
          ...queryWithoutLimit,
          includeClosed: true,
        },
        readyAt,
      ).filter((issue) =>
        matchesSearch(
          issue,
          this.snapshot.displayIdByInternalId.get(issue.id) ?? issue.id,
          parsed.search,
        ),
      );
      closedHidden = includingClosed.length - selected.length;
    }

    let rows: BoardRow[];
    const pretty = parsed.pretty;
    if (pretty) {
      // A filtered-out parent stays out, exactly as in `tbd list --pretty`; its
      // matching descendants become roots. Column sorts order only those outermost
      // visible groups, while buildIssueTree retains official ordering within them.
      rows = this.orderAsTree(limited, parsed.sorts);
    } else {
      rows = limited.map((issue) => this.toRow(issue, ''));
    }

    const responseRows = rows.slice(0, MAX_BOARD_ROWS);
    const truncated = rows.length > MAX_BOARD_ROWS ? rows.length : 0;

    const described = describeQuery(parsed.query, parsed.parentDisplayId ?? undefined);
    const prettySupported = !pretty || !parsed.query.ready;
    const command =
      pretty && !parsed.query.ready ? `${described.command} --pretty` : described.command;
    const filtersExact = described.exact && prettySupported;

    return {
      command,
      commandExact:
        filtersExact && parsed.sorts.length === 0 && parsed.search === '' && truncated === 0,
      filtersExact,
      search: parsed.search,
      total: this.snapshot.issues.length,
      matched: limited.length,
      closedHidden,
      statusFacets: this.buildValueFacets(statusFacetPool, STATUS_VALUES, (issue) => issue.status),
      kindFacets: this.buildValueFacets(kindFacetPool, KIND_VALUES, (issue) => issue.kind),
      priorityFacets: this.buildValueFacets(
        priorityFacetPool,
        PRIORITY_VALUES,
        (issue) => issue.priority,
      ),
      labelFacets: this.buildLabelFacets(labelFacetPool, parsed.query.labels, parsed.labelSearch),
      orderingCaveat: describeBoardOrdering(parsed.sorts, pretty),
      rows: responseRows,
      truncated,
      state,
    };
  }

  getBead(id: string): BeadLookupResult {
    if (!PUBLIC_ID.test(id)) {
      return { kind: 'invalid' };
    }
    const issue = this.snapshot.byDisplayId.get(id);
    if (issue === undefined) {
      return { kind: 'not-found' };
    }
    const display = (internalId: string): string =>
      this.snapshot.displayIdByInternalId.get(internalId) ?? internalId;
    return {
      kind: 'ok',
      body: {
        id,
        internalId: issue.id,
        title: issue.title,
        kind: issue.kind,
        status: issue.status,
        priority: issue.priority,
        description: issue.description ?? null,
        notes: issue.notes ?? null,
        spec_path: issue.spec_path ?? null,
        assignee: issue.assignee ?? null,
        parent: issue.parent_id == null ? null : display(issue.parent_id),
        dependencies: issue.dependencies.map((dependency) => ({
          type: dependency.type,
          target: display(dependency.target),
        })),
        labels: [...issue.labels],
        due_date: issue.due_date ?? null,
        deferred_until: issue.deferred_until ?? null,
        close_reason: issue.close_reason ?? null,
        created_at: issue.created_at,
        updated_at: issue.updated_at,
        version: issue.version,
      },
    };
  }

  private async reloadOnce(): Promise<BoardReloadResult> {
    const guardContext = this.context;
    if (await this.writerActive(guardContext)) {
      return this.deferredReloadResult();
    }
    const beforeContextEpoch =
      guardContext === null ? undefined : await this.captureQuiescentEpoch(guardContext);
    if (beforeContextEpoch === null) {
      return this.deferredReloadResult();
    }
    const beforeContextMarker =
      guardContext === null ? undefined : await this.captureStableMarker(guardContext);
    if (beforeContextMarker === null) {
      return this.deferredReloadResult();
    }
    const previousVersions = new Map(
      this.snapshot.issues.map((issue) => [issue.id, issue.version] as const),
    );
    const previousDisplayIds = this.snapshot.displayIdByInternalId;
    const previousContext = this.context;
    const previousState = this.snapshotState;
    let context: TbdDataContext;
    try {
      context = await this.dependencies.loadContext(this.repoDir);
    } catch (error) {
      if (guardContext !== null) {
        const afterFailureMarker = await this.captureStableMarker(guardContext);
        if (
          afterFailureMarker === null ||
          (beforeContextMarker !== undefined && afterFailureMarker !== beforeContextMarker)
        ) {
          return this.deferredReloadResult();
        }
      } else if (await this.writerActive(null)) {
        return this.deferredReloadResult();
      }
      throw error;
    }
    if (guardContext !== null) {
      const afterContextEpoch = await this.captureQuiescentEpoch(guardContext);
      const afterContextMarker = await this.captureStableMarker(guardContext);
      if (
        afterContextEpoch === null ||
        (beforeContextEpoch !== undefined && afterContextEpoch !== beforeContextEpoch) ||
        afterContextMarker === null ||
        (beforeContextMarker !== undefined && afterContextMarker !== beforeContextMarker)
      ) {
        return this.deferredReloadResult();
      }
    }
    // Context can change the sync branch whose ref participates in the snapshot.
    // Validate the candidate's own paths around the issue/status/tip reads as well as
    // validating the old paths around context loading.
    const beforeCandidateEpoch = await this.captureQuiescentEpoch(context);
    if (beforeCandidateEpoch === null) {
      return this.deferredReloadResult();
    }
    const beforeCandidateMarker = await this.captureStableMarker(context);
    if (beforeCandidateMarker === null) {
      return this.deferredReloadResult();
    }
    let issues: Issue[];
    let repoStatus: RepoStatus;
    let localTip: string | null;
    try {
      [issues, repoStatus, localTip] = await Promise.all([
        this.dependencies.listIssues(context.dataSyncDir),
        this.dependencies.readRepoStatus(this.repoDir, context),
        this.dependencies.readLocalTip(this.repoDir, context.config.sync.branch),
      ]);
    } catch (error) {
      const afterFailureEpoch = await this.captureQuiescentEpoch(context);
      const afterFailureMarker = await this.captureStableMarker(context);
      if (
        afterFailureEpoch === null ||
        (beforeCandidateEpoch !== undefined && afterFailureEpoch !== beforeCandidateEpoch) ||
        afterFailureMarker === null ||
        (beforeCandidateMarker !== undefined && afterFailureMarker !== beforeCandidateMarker)
      ) {
        return this.deferredReloadResult();
      }
      throw error;
    }
    let verifiedContext: TbdDataContext;
    try {
      verifiedContext = await this.dependencies.loadContext(this.repoDir);
    } catch (error) {
      const afterFailureEpoch = await this.captureQuiescentEpoch(context);
      const afterFailureMarker = await this.captureStableMarker(context);
      if (
        afterFailureEpoch === null ||
        (beforeCandidateEpoch !== undefined && afterFailureEpoch !== beforeCandidateEpoch) ||
        afterFailureMarker === null ||
        (beforeCandidateMarker !== undefined && afterFailureMarker !== beforeCandidateMarker)
      ) {
        return this.deferredReloadResult();
      }
      throw error;
    }
    if (!reloadContextEqual(context, verifiedContext)) {
      return this.deferredReloadResult();
    }
    context = verifiedContext;
    const afterMarker = await this.captureStableMarker(context);
    const afterEpoch = await this.captureQuiescentEpoch(context);
    if (
      afterEpoch === null ||
      (beforeCandidateEpoch !== undefined && afterEpoch !== beforeCandidateEpoch) ||
      afterMarker === null ||
      (beforeCandidateMarker !== undefined && afterMarker !== beforeCandidateMarker)
    ) {
      return this.deferredReloadResult();
    }
    const displayIdByInternalId = new Map(
      issues.map((issue) => [
        issue.id,
        String(formatDisplayId(issue.id, context.mapping, context.prefix)),
      ]),
    );
    const nextSnapshot: BoardSnapshot = {
      issues,
      byInternalId: new Map(issues.map((issue) => [issue.id, issue])),
      byDisplayId: new Map(
        issues.map((issue) => [displayIdByInternalId.get(issue.id) ?? issue.id, issue]),
      ),
      displayIdByInternalId,
    };

    let dataVersion = this.snapshotState.dataVersion;
    let movedIds = this.snapshotState.movedIds;
    let removedIds = this.snapshotState.removedIds;
    let movedThisReload = false;
    let changes: IssueChange[] = [];
    let changeTotal = 0;
    let changesTruncated = false;
    if (this.initialized) {
      if (previousContext === null) {
        throw new Error('Initialized BoardState is missing its data context');
      }
      const moved: string[] = [];
      const movedInternalIds: string[] = [];
      const removed: string[] = [];
      for (const issue of issues) {
        if (
          previousVersions.get(issue.id) !== issue.version ||
          previousDisplayIds.get(issue.id) !== displayIdByInternalId.get(issue.id)
        ) {
          moved.push(displayIdByInternalId.get(issue.id) ?? issue.id);
          movedInternalIds.push(issue.id);
        }
      }
      for (const [internalId] of previousVersions) {
        if (!nextSnapshot.byInternalId.has(internalId)) {
          const displayId = previousDisplayIds.get(internalId) ?? internalId;
          moved.push(displayId);
          movedInternalIds.push(internalId);
          removed.push(displayId);
        }
      }
      if (moved.length > 0) {
        movedThisReload = true;
        dataVersion += 1;
        movedIds = moved;
        removedIds = removed;
        changeTotal = movedInternalIds.length;
        const before: IssueSnapshot = {
          issues: new Map(this.snapshot.issues.map((issue) => [issue.id, issue])),
          shortToUlid: previousContext.mapping.shortToUlid,
          ulidToShort: previousContext.mapping.ulidToShort,
        };
        const after: IssueSnapshot = {
          issues: nextSnapshot.byInternalId,
          shortToUlid: context.mapping.shortToUlid,
          ulidToShort: context.mapping.ulidToShort,
        };
        const detailIds = movedInternalIds.slice(0, MAX_LOCAL_CHANGE_DETAILS);
        const rawChanges = createIssueChanges({
          readyAt: this.dependencies.now().getTime(),
          before,
          after,
          prefix: context.prefix,
          selection: { kind: 'beads', ids: detailIds },
        });
        const bounded = boundLocalChanges(rawChanges);
        changes = bounded.changes;
        changesTruncated = movedInternalIds.length > MAX_LOCAL_CHANGE_DETAILS || bounded.truncated;
      }
    }

    const metadataChanged =
      this.initialized &&
      (previousState.localTip !== localTip ||
        !repoStatusEqual(previousState.repoStatus, repoStatus) ||
        previousContext?.config.sync.branch !== context.config.sync.branch ||
        previousContext?.config.sync.remote !== context.config.sync.remote ||
        previousContext?.prefix !== context.prefix);

    this.context = context;
    this.snapshot = nextSnapshot;
    this.snapshotState = {
      localTip,
      totalBeads: issues.length,
      stats: computeIssueStats(issues),
      repoStatus,
      dataVersion,
      movedIds,
      removedIds,
      refreshedAt: this.dependencies.now().toISOString(),
    };
    this.initialized = true;
    return {
      deferred: false,
      moved: movedThisReload,
      stateChanged: movedThisReload || metadataChanged,
      dataVersion,
      movedIds: [...movedIds],
      removedIds: [...removedIds],
      changes,
      changeTotal,
      changesTruncated,
    };
  }

  private async writerActive(context: TbdDataContext | null): Promise<boolean> {
    return (await this.dependencies.readWriterActive?.(this.repoDir, context)) ?? false;
  }

  /** Return null while a writer epoch is active, otherwise its exact quiescent token. */
  private async captureQuiescentEpoch(context: TbdDataContext): Promise<string | null | undefined> {
    if (await this.writerActive(context)) {
      return null;
    }
    const readEpoch = this.dependencies.readSnapshotEpoch;
    if (readEpoch === undefined) {
      return undefined;
    }
    const epoch = await readEpoch(context.sharedPaths.sharedDataSyncEpochPath);
    return epoch === null || (await this.writerActive(context)) ? null : epoch;
  }

  /**
   * Return undefined when guards are intentionally omitted by an injected test harness,
   * null when a writer overlaps the read, and otherwise the stable metadata token.
   */
  private async captureStableMarker(context: TbdDataContext): Promise<string | null | undefined> {
    if (await this.writerActive(context)) {
      return null;
    }
    const readMarker = this.dependencies.readSnapshotMarker;
    if (readMarker === undefined) {
      return undefined;
    }
    const marker = await readMarker(this.observationPaths(context));
    return (await this.writerActive(context)) ? null : marker;
  }

  private deferredReloadResult(): BoardReloadResult {
    return {
      deferred: true,
      moved: false,
      stateChanged: false,
      dataVersion: this.snapshotState.dataVersion,
      movedIds: [...this.snapshotState.movedIds],
      removedIds: [...this.snapshotState.removedIds],
      changes: [],
      changeTotal: 0,
      changesTruncated: false,
    };
  }

  private requireContext(): TbdDataContext {
    if (this.context === null) {
      throw new Error('BoardState must be loaded before it can serve requests');
    }
    return this.context;
  }

  private toRow(issue: Issue, prefix: string): BoardRow {
    const displayId = this.snapshot.displayIdByInternalId.get(issue.id) ?? issue.id;
    return {
      id: displayId,
      internalId: issue.id,
      parentId:
        issue.parent_id == null
          ? null
          : (this.snapshot.displayIdByInternalId.get(issue.parent_id) ?? issue.parent_id),
      title: issue.title,
      status: issue.status,
      kind: issue.kind,
      priority: issue.priority,
      labels: [...issue.labels],
      spec_path: issue.spec_path ?? null,
      assignee: issue.assignee ?? null,
      ready: this.responseReadyIds.has(issue.id),
      updated_at: issue.updated_at,
      prefix,
    };
  }

  private buildLabelFacets(
    candidates: readonly Issue[],
    selectedLabels: readonly string[],
    labelSearch: string,
  ): LabelFacet[] {
    const selected = new Set(selectedLabels.filter(Boolean));
    const intersection = candidates.filter((issue) =>
      [...selected].every((label) => issue.labels.includes(label)),
    );
    const counts = new Map<string, number>();
    for (const issue of intersection) {
      for (const label of new Set(issue.labels)) {
        counts.set(label, (counts.get(label) ?? 0) + 1);
      }
    }
    for (const label of selected) {
      counts.set(label, intersection.length);
    }
    const ranked = [...counts].map(([label, count]) => ({ label, count }));
    ranked.sort((left, right) => right.count - left.count || compareText(left.label, right.label));

    const normalizedSearch = labelSearch.normalize('NFKC').toLocaleLowerCase('en-US');
    const discoverable =
      normalizedSearch === ''
        ? ranked
        : ranked.filter(
            (facet) =>
              selected.has(facet.label) ||
              facet.label.normalize('NFKC').toLocaleLowerCase('en-US').includes(normalizedSearch),
          );
    const kept = discoverable.slice(0, MAX_LABEL_FACETS);
    const keptLabels = new Set(kept.map((facet) => facet.label));
    const rank = new Map(ranked.map((facet, index) => [facet.label, index]));
    const selectedFacets = [...selected]
      .map((label) => ({ label, count: counts.get(label) ?? 0 }))
      .sort(
        (left, right) =>
          (rank.get(left.label) ?? Number.MAX_SAFE_INTEGER) -
            (rank.get(right.label) ?? Number.MAX_SAFE_INTEGER) ||
          compareText(left.label, right.label),
      );
    for (const facet of selectedFacets) {
      if (keptLabels.has(facet.label)) {
        continue;
      }
      const eviction = kept.findLastIndex((candidate) => !selected.has(candidate.label));
      if (eviction < 0) {
        break;
      }
      keptLabels.delete(kept[eviction]!.label);
      kept.splice(eviction, 1, facet);
      keptLabels.add(facet.label);
    }
    kept.sort(
      (left, right) =>
        (rank.get(left.label) ?? Number.MAX_SAFE_INTEGER) -
          (rank.get(right.label) ?? Number.MAX_SAFE_INTEGER) ||
        compareText(left.label, right.label),
    );
    return kept;
  }

  private buildValueFacets<T extends string | number>(
    candidates: readonly Issue[],
    values: readonly T[],
    select: (issue: Issue) => T,
  ): ValueFacet<T>[] {
    const counts = new Map<T, number>();
    for (const issue of candidates) {
      const value = select(issue);
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
    return values.map((value) => ({ value, count: counts.get(value) ?? 0 }));
  }

  private compareIssuesByColumns(
    left: Issue,
    right: Issue,
    sorts: readonly BoardSort[],
    effectiveUpdatedAt?: ReadonlyMap<string, string>,
  ): number {
    const displayId = (issue: Issue): string =>
      this.snapshot.displayIdByInternalId.get(issue.id) ?? issue.id;
    const labels = (issue: Issue): string => [...issue.labels].sort(compareText).join('\u0000');
    const textValue = (
      issue: Issue,
      key: Exclude<BoardSortKey, 'priority' | 'updated'>,
    ): string => {
      switch (key) {
        case 'id':
          return displayId(issue);
        case 'status':
          return issue.status;
        case 'kind':
          return issue.kind;
        case 'title':
          return issue.title;
        case 'labels':
          return labels(issue);
        default: {
          const exhaustive: never = key;
          throw new Error('Unsupported board sort key', { cause: exhaustive });
        }
      }
    };
    for (const sort of sorts) {
      const compared =
        sort.key === 'priority'
          ? left.priority - right.priority
          : sort.key === 'updated'
            ? compareTimestamps(
                effectiveUpdatedAt?.get(left.id) ?? left.updated_at,
                effectiveUpdatedAt?.get(right.id) ?? right.updated_at,
              )
            : compareText(textValue(left, sort.key), textValue(right, sort.key));
      if (compared !== 0) {
        return sort.direction === 'asc' ? compared : -compared;
      }
    }
    return compareText(displayId(left), displayId(right));
  }

  private sortIssuesByColumns(issues: readonly Issue[], sorts: readonly BoardSort[]): Issue[] {
    return [...issues].sort((left, right) => this.compareIssuesByColumns(left, right, sorts));
  }

  private orderAsTree(issues: Issue[], sorts: readonly BoardSort[]): BoardRow[] {
    const forTree: IssueForTree[] = issues.map((issue) => ({
      id: this.snapshot.displayIdByInternalId.get(issue.id) ?? issue.id,
      internalId: issue.id as InternalIssueId,
      parentId:
        issue.parent_id == null
          ? undefined
          : (this.snapshot.displayIdByInternalId.get(issue.parent_id) ?? issue.parent_id),
      priority: issue.priority,
      status: issue.status,
      kind: issue.kind,
      title: issue.title,
      child_order_hints: issue.child_order_hints as InternalIssueId[] | undefined,
    }));
    const issueByDisplayId = new Map(
      issues.map((issue) => [this.snapshot.displayIdByInternalId.get(issue.id) ?? issue.id, issue]),
    );
    const roots = buildIssueTree(forTree);
    if (sorts.length > 0) {
      // Sorting a pretty tree moves whole outermost groups. Every parent kind rolls
      // Updated up from its complete visible subtree; child arrays remain untouched so
      // buildIssueTree's official child_order_hints contract always wins within a group.
      const effectiveUpdatedAt = new Map<string, string>();
      const rollUpUpdatedAt = (node: TreeNode): string => {
        const issue = issueByDisplayId.get(node.issue.id);
        let latest = issue?.updated_at ?? '';
        for (const child of node.children) {
          const childLatest = rollUpUpdatedAt(child);
          if (latest === '' || compareTimestamps(childLatest, latest) > 0) {
            latest = childLatest;
          }
        }
        if (issue !== undefined) {
          effectiveUpdatedAt.set(issue.id, latest);
        }
        return latest;
      };
      for (const root of roots) {
        rollUpUpdatedAt(root);
      }
      roots.sort((left, right) =>
        this.compareIssuesByColumns(
          issueByDisplayId.get(left.issue.id)!,
          issueByDisplayId.get(right.issue.id)!,
          sorts,
          effectiveUpdatedAt,
        ),
      );
    }

    const rows: BoardRow[] = [];
    const walk = (node: TreeNode, depth: number): void => {
      const issue = issueByDisplayId.get(node.issue.id);
      if (issue !== undefined) {
        const prefix = depth === 0 ? '' : TREE_CHARS.indent.repeat(depth - 1) + TREE_CHARS.child;
        rows.push(this.toRow(issue, prefix));
      }
      node.children.forEach((child) => {
        walk(child, depth + 1);
      });
    };
    for (const root of roots) {
      walk(root, 0);
    }
    return rows;
  }
}
