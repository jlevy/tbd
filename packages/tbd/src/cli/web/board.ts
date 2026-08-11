/** In-memory issue snapshot and the read-only response model served by `tbd web`. */

import { join } from 'node:path';

import type { TbdDataContext } from '../lib/data-context.js';
import { loadDataContext } from '../lib/data-context.js';
import { buildIssueTree } from '../lib/tree-view.js';
import type { IssueForTree, TreeNode } from '../lib/tree-view.js';
import { checkWorktreeHealth, git } from '../../file/git.js';
import { resolveToInternalId } from '../../file/id-mapping.js';
import { listIssues } from '../../file/storage.js';
import { listWorkspaces } from '../../file/workspace.js';
import { formatDisplayId } from '../../lib/ids.js';
import type { InternalIssueId } from '../../lib/ids.js';
import type { IssueChangesReport } from '../../lib/issue-changes.js';
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
import { VERSION } from '../lib/version.js';

/** Hard render ceiling; query counts still report the unsliced result size. */
export const MAX_BOARD_ROWS = 4_000;

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

export type WatchPhase = 'starting' | 'watching' | 'applying' | 'error' | 'stopped';

export interface EventLogEntry {
  at: string;
  level: 'info' | 'wake' | 'error';
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
  /** True only when this particular reload observed a changed `id:version` snapshot. */
  moved: boolean;
  dataVersion: number;
  movedIds: string[];
  removedIds: string[];
}

/** Stable additive state document carried by board responses and SSE frames. */
export interface WebState extends BoardSnapshotState {
  repoDir: string;
  syncBranch: string;
  remote: string;
  intervalSeconds: number;
  lastReport: IssueChangesReport | null;
  reportDataVersion: number;
  changedIds: string[];
  watchPhase: WatchPhase;
  watchSince: string | null;
  watchError: string | null;
  wakeCount: number;
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

const emptyStats = computeIssueStats([]);

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
    workspaces = await listWorkspaces(repoDir);
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

const defaultDependencies: BoardStateDependencies = {
  loadContext: loadDataContext,
  listIssues,
  readRepoStatus: defaultReadRepoStatus,
  readLocalTip: defaultReadLocalTip,
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
  ) {
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

  /** Queue every reload so a pull cannot accidentally reuse a pre-pull in-flight read. */
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

  getSyncTarget(): { worktreePath: string; syncBranch: string; remote: string } {
    const context = this.requireContext();
    return {
      worktreePath: context.sharedPaths.sharedWorktreePath,
      syncBranch: context.config.sync.branch,
      remote: context.config.sync.remote,
    };
  }

  getWatchConfig(): { syncBranch: string; remote: string; prefix: string } {
    const context = this.requireContext();
    return {
      syncBranch: context.config.sync.branch,
      remote: context.config.sync.remote,
      prefix: context.prefix,
    };
  }

  getIssuesDirectory(): string {
    return join(this.requireContext().dataSyncDir, 'issues');
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

    const described = describeQuery(parsed.query, parsed.parentDisplayId ?? undefined);
    const prettySupported = !parsed.pretty || !parsed.query.ready;
    const command =
      parsed.pretty && !parsed.query.ready ? `${described.command} --pretty` : described.command;
    const filtersExact = described.exact && prettySupported;

    return {
      command,
      commandExact: filtersExact && contextIds.length === 0 && parsed.search === '',
      filtersExact,
      contextCount: contextIds.length,
      search: parsed.search,
      total: this.snapshot.issues.length,
      matched: limited.length,
      closedHidden,
      rows: rows.slice(0, MAX_BOARD_ROWS),
      truncated: rows.length > MAX_BOARD_ROWS ? rows.length : 0,
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
    const previousVersions = new Map(
      this.snapshot.issues.map((issue) => [issue.id, issue.version] as const),
    );
    const previousDisplayIds = this.snapshot.displayIdByInternalId;
    const context = await this.dependencies.loadContext(this.repoDir);
    const [issues, repoStatus, localTip] = await Promise.all([
      this.dependencies.listIssues(context.dataSyncDir),
      this.dependencies.readRepoStatus(this.repoDir, context),
      this.dependencies.readLocalTip(this.repoDir, context.config.sync.branch),
    ]);
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
    if (this.initialized) {
      const moved: string[] = [];
      const removed: string[] = [];
      for (const issue of issues) {
        if (previousVersions.get(issue.id) !== issue.version) {
          moved.push(displayIdByInternalId.get(issue.id) ?? issue.id);
        }
      }
      for (const [internalId] of previousVersions) {
        if (!nextSnapshot.byInternalId.has(internalId)) {
          const displayId = previousDisplayIds.get(internalId) ?? internalId;
          moved.push(displayId);
          removed.push(displayId);
        }
      }
      if (moved.length > 0) {
        movedThisReload = true;
        dataVersion += 1;
        movedIds = moved;
        removedIds = removed;
      }
    }

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
      moved: movedThisReload,
      dataVersion,
      movedIds: [...movedIds],
      removedIds: [...removedIds],
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
