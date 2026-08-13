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
  selectIssues,
  sortIssues,
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
/** Detail is diagnostic; board motion remains complete through movedIds/removedIds. */
export const MAX_LOCAL_CHANGE_DETAILS = 100;
export const MAX_LOCAL_CHANGE_DETAIL_BYTES = 256 * 1024;
const MAX_LOCAL_CHANGE_VALUE_CHARS = 2_000;
const MAX_LOCAL_HUNK_LINES = 80;
const MAX_LOCAL_HUNK_LINE_CHARS = 500;

// Prefixes allow dot/underscore, and imported ShortIds also allow dot, underscore,
// and hyphen. Requiring the leading prefix letter still rejects option-shaped input.
const PUBLIC_ID = /^[A-Za-z][A-Za-z0-9._]{0,19}-[0-9a-z._-]+$/u;
const STATUSES = new Set<IssueStatusType>(['open', 'in_progress', 'blocked', 'deferred', 'closed']);
const KINDS = new Set<IssueKindType>(['bug', 'feature', 'task', 'epic', 'chore']);
const SORTS = new Set<IssueSort>(['priority', 'created', 'updated']);
const TREE_CHARS = {
  branch: '├── ',
  last: '└── ',
  vertical: '│   ',
  space: '    ',
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
  contextCount: number;
  search: string;
  total: number;
  matched: number;
  closedHidden: number;
  rows: BoardRow[];
  truncated: number;
  contextIds: string[];
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
}

interface BoardSnapshot {
  issues: Issue[];
  byInternalId: Map<string, Issue>;
  byDisplayId: Map<string, Issue>;
  displayIdByInternalId: Map<string, string>;
  readyIds: ReadonlySet<string>;
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
  };
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
    readyIds: new Set(),
  };
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
    const selected = selectIssues(this.snapshot.issues, queryWithoutLimit).filter((issue) =>
      matchesSearch(
        issue,
        this.snapshot.displayIdByInternalId.get(issue.id) ?? issue.id,
        parsed.search,
      ),
    );
    const limited = parsed.query.limit === null ? selected : selected.slice(0, parsed.query.limit);

    let closedHidden = 0;
    if (!parsed.query.includeClosed && parsed.query.status !== 'closed') {
      const includingClosed = selectIssues(this.snapshot.issues, {
        ...queryWithoutLimit,
        includeClosed: true,
      }).filter((issue) =>
        matchesSearch(
          issue,
          this.snapshot.displayIdByInternalId.get(issue.id) ?? issue.id,
          parsed.search,
        ),
      );
      closedHidden = includingClosed.length - selected.length;
    }

    let rows: BoardRow[];
    let contextIds: string[] = [];
    if (parsed.pretty) {
      const ordered = sortIssues(this.snapshot.issues, parsed.query.sort);
      const context = this.withAncestors(limited, ordered);
      rows = this.orderAsTree(context.issues);
      contextIds = rows.filter((row) => !context.matched.has(row.internalId)).map((row) => row.id);
    } else {
      rows = limited.map((issue) => this.toRow(issue, ''));
    }

    const responseRows = rows.slice(0, MAX_BOARD_ROWS);
    if (contextIds.length > 0) {
      const responseIds = new Set(responseRows.map((row) => row.id));
      contextIds = contextIds.filter((id) => responseIds.has(id));
    }
    const truncated = rows.length > MAX_BOARD_ROWS ? rows.length : 0;

    const described = describeQuery(parsed.query, parsed.parentDisplayId ?? undefined);
    const prettySupported = !parsed.pretty || !parsed.query.ready;
    const command =
      parsed.pretty && !parsed.query.ready ? `${described.command} --pretty` : described.command;
    const filtersExact = described.exact && prettySupported;

    return {
      command,
      commandExact:
        filtersExact && contextIds.length === 0 && parsed.search === '' && truncated === 0,
      filtersExact,
      contextCount: contextIds.length,
      search: parsed.search,
      total: this.snapshot.issues.length,
      matched: limited.length,
      closedHidden,
      rows: responseRows,
      truncated,
      contextIds,
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
      readyIds: readyIssueIds(issues),
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
      ready: this.snapshot.readyIds.has(issue.id),
      updated_at: issue.updated_at,
      prefix,
    };
  }

  private orderAsTree(issues: Issue[]): BoardRow[] {
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
    const rows: BoardRow[] = [];
    const walk = (node: TreeNode, prefix: string, connector: string, isLast: boolean): void => {
      const issue = issueByDisplayId.get(node.issue.id);
      if (issue !== undefined) {
        rows.push(this.toRow(issue, prefix + connector));
      }
      const childPrefix =
        connector === '' ? '' : prefix + (isLast ? TREE_CHARS.space : TREE_CHARS.vertical);
      node.children.forEach((child, index) => {
        const last = index === node.children.length - 1;
        walk(child, childPrefix, last ? TREE_CHARS.last : TREE_CHARS.branch, last);
      });
    };
    for (const root of buildIssueTree(forTree)) {
      walk(root, '', '', true);
    }
    return rows;
  }

  private withAncestors(
    matched: Issue[],
    ordered: Issue[],
  ): { issues: Issue[]; matched: Set<string> } {
    const matchedIds = new Set(matched.map((issue) => issue.id));
    const keep = new Set(matchedIds);
    for (const issue of matched) {
      let cursor: Issue | undefined = issue;
      while (cursor?.parent_id != null && !keep.has(cursor.parent_id)) {
        const parent = this.snapshot.byInternalId.get(cursor.parent_id);
        if (parent === undefined) {
          break;
        }
        keep.add(parent.id);
        cursor = parent;
      }
    }
    return {
      issues: ordered.filter((issue) => keep.has(issue.id)),
      matched: matchedIds,
    };
  }
}
