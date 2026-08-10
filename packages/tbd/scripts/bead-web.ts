#!/usr/bin/env -S pnpm exec tsx

/**
 * Bead web viewer: a spike for a possible `tbd web` command.
 *
 * The guiding constraint is that the browser must not become a second, drifting
 * implementation of `tbd list`. So the query layer is the CLI's own: filtering runs
 * through `issueMatchesSharedFilters`, readiness through `readyIssueIds`, hierarchy
 * through `buildIssueTree`, limits through `applyLimit`, and priorities through
 * `parsePriority`. Query parameters are named after the CLI flags they implement, and
 * every response carries the equivalent `tbd list` command line so the UI documents the
 * CLI rather than replacing it.
 *
 * Reads are in-process. `loadDataContext` plus `listIssues` is the same path `tbd list`
 * takes, without a subprocess per refresh, which is what makes a several-thousand-bead
 * graph feel immediate. Bodies are served from the in-memory snapshot on demand, so the
 * table payload stays small no matter how long the descriptions are.
 *
 * Liveness comes from `tbd watch`, still spawned as a child so it can be cancelled and
 * so the spike keeps exercising the real CLI exit-code contract. Two wake paths stay
 * separate and are labelled differently in the event log:
 *
 * - remote: `tbd watch` reports, then `tbd sync --pull` lands the movement.
 * - local: `fs.watch` over the hidden sync worktree shows edits before they are published.
 *
 * `--demo` builds a disposable bare remote plus writer and watcher clones so the remote
 * path is exercisable without a real remote.
 *
 * Not a shipped surface: `scripts/` is excluded from the published package and this adds
 * no dependency. See the productization notes at the bottom of this file.
 */

import { spawn } from 'node:child_process';
import { watch as watchFilesystem } from 'node:fs';
import type { FSWatcher } from 'node:fs';
import { access, mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import type { IncomingMessage, Server, ServerResponse } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { writeFile } from 'atomically';

import { loadDataContext } from '../src/cli/lib/data-context.js';
import type { TbdDataContext } from '../src/cli/lib/data-context.js';
import { applyLimit } from '../src/cli/lib/limit-utils.js';
import { VERSION } from '../src/cli/lib/version.js';
import { checkWorktreeHealth } from '../src/file/git.js';
import { listWorkspaces } from '../src/file/workspace.js';
import { buildIssueTree } from '../src/cli/lib/tree-view.js';
import type { IssueForTree, TreeNode } from '../src/cli/lib/tree-view.js';
import type { InternalIssueId } from '../src/lib/ids.js';
import { listIssues } from '../src/file/storage.js';
import { resolveToInternalId } from '../src/file/id-mapping.js';
import type { IdMapping } from '../src/file/id-mapping.js';
import { extractUlidFromInternalId, formatDisplayId } from '../src/lib/ids.js';
import { gitSafeEnv } from '../src/lib/git-env.js';
import { issueMatchesSharedFilters, readyIssueIds } from '../src/lib/issue-selection.js';
import { computeIssueStats } from '../src/lib/issue-stats.js';
import type { IssueStats } from '../src/lib/issue-stats.js';
import { parsePriority } from '../src/lib/priority.js';
import type { Issue, IssueKindType, IssueStatusType } from '../src/lib/types.js';

const COMMAND_TIMEOUT_MS = 120_000;
const MAX_OUTPUT_BYTES = 32 * 1024 * 1024;
const MAX_REQUEST_BYTES = 256 * 1024;
const MAX_EVENT_LOG_ENTRIES = 200;
/** Bounds each blocking watch so exit 3 and the resume path are exercised routinely. */
const WATCH_TIMEOUT_SECONDS = 900;
/** Backoff after an operational watch failure, so a broken remote does not spin. */
const WATCH_ERROR_BACKOFF_MS = 5_000;
/** Coalesces the burst of filesystem events a single `tbd update` produces. */
const LOCAL_DEBOUNCE_MS = 300;
/**
 * Quiet window after our own pull or write. Filesystem events from those operations
 * arrive after they complete, and re-reading the whole graph to discover nothing changed
 * is the most expensive no-op this process can perform.
 */
const LOCAL_SUPPRESSION_TRAILING_MS = LOCAL_DEBOUNCE_MS * 4;
/** SSE keep-alive, below the usual 60s idle timeout of intermediate proxies. */
const SSE_KEEPALIVE_MS = 20_000;
/** A client buffering more than this has stopped reading and is dropped. */
const MAX_SSE_BUFFER_BYTES = 1024 * 1024;
/** Upper bound on graceful shutdown, so a stuck socket cannot strand a demo topology. */
const SHUTDOWN_TIMEOUT_MS = 3_000;
/** Row ceiling per response. Mirrors nothing in the CLI; purely a render guard. */
const MAX_ROWS = 4_000;
const DEFAULT_PORT = 7777;
const DEFAULT_INTERVAL_SECONDS = 10;

const packageDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const invocationDir = process.cwd();
const pagePath = join(packageDir, 'scripts', 'bead-web.html');

interface CommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

interface CandidateCommand {
  command: string;
  prefixArgs: string[];
  displayName: string;
  pathToCheck: string | null;
}

interface ViewerOptions {
  repoDir: string | null;
  demo: boolean;
  port: number;
  intervalSeconds: number;
  allowWrite: boolean | null;
  keep: boolean;
}

/** One `tbd list`-shaped query. Field names track the CLI flags one to one. */
interface BoardQuery {
  status: IssueStatusType | null;
  all: boolean;
  type: IssueKindType | null;
  priority: string | null;
  assignee: string | null;
  label: string[];
  parent: string | null;
  spec: string | null;
  deferred: boolean;
  ready: boolean;
  sort: string;
  limit: string | null;
  pretty: boolean;
  /** Free-text narrowing. No CLI equivalent, so it is reported separately. */
  search: string;
}

/** Light row for the table. Bodies are fetched separately and only when opened. */
interface BoardRow {
  id: string;
  internalId: string;
  parentId: string | null;
  title: string;
  status: string;
  kind: string;
  priority: number;
  labels: string[];
  spec_path: string | null;
  assignee: string | null;
  ready: boolean;
  /** Tree guide string, empty in flat mode. */
  prefix: string;
}

interface ChangeField {
  field: string;
  before: unknown;
  after: unknown;
}

interface IssueChange {
  id: string;
  title: string;
  change: string;
  fields: ChangeField[];
}

/**
 * The `tbd watch --json` report. It carries no version marker: like every tbd `--json`
 * surface it evolves by addition only, so this mirror lists just the fields the viewer
 * consumes and ignores anything newer.
 */
interface ChangeReport {
  since: string;
  tip: string;
  changes: IssueChange[];
}

type WatchPhase = 'starting' | 'watching' | 'applying' | 'error' | 'stopped';

interface EventLogEntry {
  at: string;
  level: 'info' | 'wake' | 'error';
  message: string;
}

/**
 * The `tbd status` subset that is meaningful for a served view. Deliberately not the
 * whole StatusData: integration detection and pre-init discovery are CLI-shaped concerns
 * with no meaning here, while everything below is either already authoritative in this
 * process or comes from an existing reusable helper.
 */
interface RepoStatus {
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

/** Everything about the watcher, independent of any one browser's query. */
interface WatchState {
  repoDir: string;
  writerDir: string | null;
  syncBranch: string;
  remote: string;
  candidate: string;
  allowWrite: boolean;
  intervalSeconds: number;
  localTip: string | null;
  totalBeads: number;
  /** `tbd stats`, from the shared aggregator. Recomputed on every data movement. */
  stats: IssueStats | null;
  /** `tbd status`, the served subset. Resolved at startup and after each pull. */
  repoStatus: RepoStatus | null;
  lastReport: ChangeReport | null;
  /**
   * The dataVersion at which lastReport was applied. Local filesystem wakes advance
   * dataVersion without producing a report, so the field-level deltas in lastReport
   * describe the current movement only while this equals dataVersion; the client hides
   * the delta panel otherwise instead of attributing stale remote detail to a local
   * edit (PR #207 review R4).
   */
  reportDataVersion: number;
  /**
   * Beads changed in the latest movement, local or remote. Derived from the snapshot
   * diff (movedIds) on every reload, never from the report alone, so the ● marker and
   * the flash always describe the same event regardless of which wake path observed it
   * (PR #207 review R4).
   */
  changedIds: string[];
  /**
   * Monotonic counter, incremented only when the bead graph itself moved. The browser
   * uses this to distinguish a data change from a view change: a filter edit re-renders
   * without animation, while a bump here is what earns the wake highlight.
   * Starts at 0 and does not increment for the initial load, so opening the page is not
   * mistaken for a change.
   */
  dataVersion: number;
  /** Beads added, removed, or edited since the previous snapshot. Display ids. */
  movedIds: string[];
  /** Subset of movedIds that disappeared, so the browser can animate their removal. */
  removedIds: string[];
  watchPhase: WatchPhase;
  watchSince: string | null;
  watchError: string | null;
  wakeCount: number;
  refreshedAt: string;
  log: EventLogEntry[];
}

/** One loaded snapshot of the bead graph, held in memory between wakes. */
interface Board {
  issues: Issue[];
  byInternalId: Map<string, Issue>;
  byDisplayId: Map<string, Issue>;
  displayIdByInternalId: Map<string, string>;
  ready: ReadonlySet<string>;
  mapping: IdMapping;
  prefix: string;
}

/** Resolve the CLI under test without requiring a global install. */
function resolveCandidateCommand(): CandidateCommand {
  const configured = process.env.TBD_QA_BIN?.trim();
  const defaultBin = join(packageDir, 'dist', 'bin.mjs');
  const candidate = configured === undefined || configured === '' ? defaultBin : configured;
  const looksLikePath =
    isAbsolute(candidate) ||
    candidate.includes(sep) ||
    candidate.startsWith('.') ||
    candidate.endsWith('.mjs');
  const resolvedCandidate = looksLikePath ? resolve(invocationDir, candidate) : candidate;
  const isJavaScriptEntry = /\.(?:c|m)?js$/u.test(resolvedCandidate);

  return {
    command: isJavaScriptEntry ? process.execPath : resolvedCandidate,
    prefixArgs: isJavaScriptEntry ? [resolvedCandidate] : [],
    displayName: resolvedCandidate,
    pathToCheck: looksLikePath ? resolvedCandidate : null,
  };
}

/** Run a bounded subprocess, preserving stdout, stderr, and nonzero exit codes. */
function runCommand(
  cwd: string,
  command: string,
  args: string[],
  timeoutMs: number,
): Promise<CommandResult> {
  return new Promise((resolveResult, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: gitSafeEnv({ NO_COLOR: '1' }),
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    let outputBytes = 0;
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
    }, timeoutMs);

    const collect = (target: 'stdout' | 'stderr', chunk: Buffer): void => {
      outputBytes += chunk.byteLength;
      if (outputBytes > MAX_OUTPUT_BYTES) {
        child.kill('SIGTERM');
        reject(new Error(`Command exceeded ${MAX_OUTPUT_BYTES} bytes of output: ${command}`));
        return;
      }
      if (target === 'stdout') {
        stdout += chunk.toString('utf8');
      } else {
        stderr += chunk.toString('utf8');
      }
    };

    child.stdout.on('data', (chunk: Buffer) => {
      collect('stdout', chunk);
    });
    child.stderr.on('data', (chunk: Buffer) => {
      collect('stderr', chunk);
    });
    child.once('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.once('close', (exitCode, signal) => {
      clearTimeout(timer);
      if (timedOut) {
        reject(new Error(`Command timed out after ${timeoutMs}ms: ${command} ${args.join(' ')}`));
        return;
      }
      if (exitCode === null) {
        reject(new Error(`Command ended on signal ${signal ?? 'unknown'}: ${command}`));
        return;
      }
      resolveResult({ exitCode, stdout, stderr });
    });
  });
}

function runTbd(
  candidate: CandidateCommand,
  cwd: string,
  args: string[],
  timeoutMs = COMMAND_TIMEOUT_MS,
): Promise<CommandResult> {
  return runCommand(cwd, candidate.command, [...candidate.prefixArgs, ...args], timeoutMs);
}

async function git(cwd: string, args: string[]): Promise<string> {
  const result = await runCommand(cwd, 'git', args, COMMAND_TIMEOUT_MS);
  if (result.exitCode !== 0) {
    throw new Error(`git ${args.join(' ')} failed: ${result.stderr.trim()}`);
  }
  return result.stdout.trim();
}

/**
 * Parse the first JSON document in a stream. Some tbd surfaces still print a human
 * banner to stdout ahead of `--json` output (tbd-q5c7), so anchoring on the first
 * structural character keeps the viewer working instead of failing on incidental noise.
 */
function parseLeadingJson(text: string, label: string): unknown {
  const objectStart = text.indexOf('{');
  const arrayStart = text.indexOf('[');
  const candidates = [objectStart, arrayStart].filter((index) => index >= 0);
  if (candidates.length === 0) {
    throw new Error(`${label} produced no JSON document`);
  }
  const start = Math.min(...candidates);
  try {
    return JSON.parse(text.slice(start));
  } catch (error) {
    throw new Error(`${label} produced unparseable JSON`, { cause: error });
  }
}

function asChangeReport(value: unknown, label: string): ChangeReport {
  if (typeof value !== 'object' || value === null || !('changes' in value)) {
    throw new Error(`${label} did not return a change report`);
  }
  return value as ChangeReport;
}

// ---------------------------------------------------------------------------
// Query layer: `tbd list` semantics, reached over HTTP.
// ---------------------------------------------------------------------------

const STATUSES = new Set(['open', 'in_progress', 'blocked', 'deferred', 'closed']);
const KINDS = new Set(['bug', 'feature', 'task', 'epic', 'chore']);

function parseBoardQuery(params: URLSearchParams): BoardQuery {
  const one = (name: string): string | null => {
    const value = params.get(name);
    return value === null || value === '' ? null : value;
  };
  const flag = (name: string): boolean => {
    const value = params.get(name);
    return value !== null && value !== '' && value !== '0' && value !== 'false';
  };
  const status = one('status');
  const type = one('type');
  return {
    status: status !== null && STATUSES.has(status) ? (status as IssueStatusType) : null,
    all: flag('all'),
    type: type !== null && KINDS.has(type) ? (type as IssueKindType) : null,
    priority: one('priority'),
    assignee: one('assignee'),
    label: params.getAll('label').filter((value) => value !== ''),
    parent: one('parent'),
    spec: one('spec'),
    deferred: flag('deferred'),
    ready: flag('ready'),
    sort: one('sort') ?? 'priority',
    limit: one('limit'),
    pretty: flag('pretty'),
    search: params.get('q')?.trim() ?? '',
  };
}

/**
 * The CLI invocation equivalent to a query, so the UI teaches the CLI rather than
 * replacing it.
 *
 * `exact` is false when the view cannot be reproduced by one command. That happens with
 * `--ready`, which is its own command accepting only `--type` and `--limit`, so combining
 * it with a label or a spec narrows the view beyond anything `tbd ready` can express.
 * Printing a command that does not reproduce what is on screen would be worse than
 * admitting the gap.
 */
function describeQueryAsCommand(query: BoardQuery): { command: string; exact: boolean } {
  if (query.ready) {
    const readyParts = ['tbd ready'];
    if (query.type !== null) {
      readyParts.push(`--type ${query.type}`);
    }
    if (query.limit !== null) {
      readyParts.push(`--limit ${query.limit}`);
    }
    const unsupported =
      query.all ||
      query.status !== null ||
      query.priority !== null ||
      query.assignee !== null ||
      query.label.length > 0 ||
      query.parent !== null ||
      query.spec !== null ||
      query.deferred ||
      // `tbd ready` always orders by priority then internal id and exposes no --sort,
      // so a non-default sort makes the view unreproducible too (PR #207 review R2).
      query.sort !== 'priority' ||
      query.pretty;
    return { command: readyParts.join(' '), exact: !unsupported };
  }

  const parts = ['tbd list'];
  if (query.all) {
    parts.push('--all');
  }
  if (query.status !== null) {
    parts.push(`--status ${query.status}`);
  }
  if (query.type !== null) {
    parts.push(`--type ${query.type}`);
  }
  if (query.priority !== null) {
    parts.push(`--priority ${query.priority}`);
  }
  if (query.assignee !== null) {
    parts.push(`--assignee ${query.assignee}`);
  }
  for (const label of query.label) {
    parts.push(`--label ${label}`);
  }
  if (query.parent !== null) {
    parts.push(`--parent ${query.parent}`);
  }
  if (query.spec !== null) {
    parts.push(`--spec ${query.spec}`);
  }
  if (query.deferred) {
    parts.push('--deferred');
  }
  if (query.sort !== 'priority') {
    parts.push(`--sort ${query.sort}`);
  }
  if (query.limit !== null) {
    parts.push(`--limit ${query.limit}`);
  }
  if (query.pretty) {
    parts.push('--pretty');
  }
  return { command: parts.join(' '), exact: true };
}

/**
 * Apply `tbd list`'s filters.
 *
 * The label/spec/status predicate and readiness both come from the shared module, so
 * those cannot drift. The surrounding orchestration still mirrors ListHandler by hand
 * because it lives in a private method; extracting it is the first productization step.
 */
function filterIssues(issues: Issue[], board: Board, query: BoardQuery): Issue[] {
  let resolvedParentId: string | undefined;
  if (query.parent !== null) {
    try {
      resolvedParentId = resolveToInternalId(query.parent, board.mapping);
    } catch {
      return [];
    }
  }

  return issues.filter((issue) => {
    // Default hides closed, exactly as the CLI does, unless --all or --status closed.
    if (!query.all && query.status !== 'closed' && issue.status === 'closed') {
      return false;
    }
    if (
      !issueMatchesSharedFilters(issue, {
        labels: query.label,
        spec: query.spec,
        status: query.status,
      })
    ) {
      return false;
    }
    if (query.type !== null && issue.kind !== query.type) {
      return false;
    }
    if (query.priority !== null) {
      const priority = parsePriority(query.priority);
      if (priority !== undefined && issue.priority !== priority) {
        return false;
      }
    }
    if (query.assignee !== null && issue.assignee !== query.assignee) {
      return false;
    }
    if (resolvedParentId !== undefined && issue.parent_id !== resolvedParentId) {
      return false;
    }
    if (query.deferred && issue.status !== 'deferred') {
      return false;
    }
    if (query.ready && !board.ready.has(issue.id)) {
      return false;
    }
    if (query.search !== '') {
      const displayId = board.displayIdByInternalId.get(issue.id) ?? '';
      const haystack =
        `${displayId} ${issue.title} ${issue.labels.join(' ')} ${issue.spec_path ?? ''}`.toLowerCase();
      if (!haystack.includes(query.search.toLowerCase())) {
        return false;
      }
    }
    return true;
  });
}

/** Mirror ListHandler.sortIssues: priority ascending, created/updated newest first. */
function sortIssues(issues: Issue[], board: Board, sortField: string): Issue[] {
  const primary =
    sortField === 'created'
      ? (issue: Issue): number => -new Date(issue.created_at).getTime()
      : sortField === 'updated'
        ? (issue: Issue): number => -new Date(issue.updated_at).getTime()
        : (issue: Issue): number => issue.priority;

  return [...issues].sort((left, right) => {
    const delta = primary(left) - primary(right);
    if (delta !== 0) {
      return delta;
    }
    // Tiebreak on the internal ULID, exactly as ListHandler.sortIssues does: ULIDs are
    // chronological and deterministic, while short display ids are random, so a
    // display-id tiebreak would order equal-priority rows differently than the CLI
    // for the same query (PR #207 review R1).
    const leftUlid = extractUlidFromInternalId(left.id);
    const rightUlid = extractUlidFromInternalId(right.id);
    return leftUlid < rightUlid ? -1 : leftUlid > rightUlid ? 1 : 0;
  });
}

const TREE_CHARS = {
  BRANCH: '├── ',
  LAST: '└── ',
  VERTICAL: '│   ',
  SPACE: '    ',
} as const;

function toRow(issue: Issue, board: Board, prefix: string): BoardRow {
  const displayId = board.displayIdByInternalId.get(issue.id) ?? issue.id;
  return {
    id: displayId,
    internalId: issue.id,
    parentId:
      issue.parent_id == null
        ? null
        : (board.displayIdByInternalId.get(issue.parent_id) ?? issue.parent_id),
    title: issue.title,
    status: issue.status,
    kind: issue.kind,
    priority: issue.priority,
    labels: issue.labels,
    spec_path: issue.spec_path ?? null,
    assignee: issue.assignee ?? null,
    ready: board.ready.has(issue.id),
    prefix,
  };
}

/**
 * Order rows hierarchically using the CLI's own `buildIssueTree`, then attach the guide
 * string each row draws.
 *
 * The `prefix + connector` below is the one place this deliberately differs from
 * `renderIssueTree`, which drops the ancestor prefix and so flattens grandchildren to
 * depth 1 (tbd-5hh1). Fixing that bug makes the two renderers agree exactly.
 */
function orderAsTree(issues: Issue[], board: Board): BoardRow[] {
  // `IssueForTree` brands its id fields as InternalIssueId while `Issue` carries plain
  // strings. These values come straight off the loaded issues, so the brand holds; the
  // assertion is scoped to the two fields that need it rather than the whole array.
  const forTree: IssueForTree[] = issues.map((issue) => ({
    id: board.displayIdByInternalId.get(issue.id) ?? issue.id,
    internalId: issue.id as InternalIssueId,
    parentId:
      issue.parent_id == null
        ? undefined
        : (board.displayIdByInternalId.get(issue.parent_id) ?? issue.parent_id),
    priority: issue.priority,
    status: issue.status,
    kind: issue.kind,
    title: issue.title,
    child_order_hints: issue.child_order_hints as InternalIssueId[] | undefined,
  }));
  const issueByDisplayId = new Map(
    issues.map((issue) => [board.displayIdByInternalId.get(issue.id) ?? issue.id, issue]),
  );

  const rows: BoardRow[] = [];
  const walk = (node: TreeNode, prefix: string, connector: string, isLast: boolean): void => {
    const issue = issueByDisplayId.get(node.issue.id);
    if (issue !== undefined) {
      rows.push(toRow(issue, board, prefix + connector));
    }
    const childPrefix =
      connector === '' ? '' : prefix + (isLast ? TREE_CHARS.SPACE : TREE_CHARS.VERTICAL);
    node.children.forEach((child, index) => {
      const last = index === node.children.length - 1;
      walk(child, childPrefix, last ? TREE_CHARS.LAST : TREE_CHARS.BRANCH, last);
    });
  };
  for (const root of buildIssueTree(forTree)) {
    walk(root, '', '', true);
  }
  return rows;
}

/**
 * Keep ancestors of matches so a filtered tree stays connected.
 *
 * `ordered` must be the full graph in the requested sort order, not the raw load order:
 * `buildIssueTree` preserves input order for roots, exactly as `tbd list --pretty` relies
 * on, so filtering out of a sorted superset is what makes --sort mean anything in tree
 * mode.
 */
function withAncestors(
  matched: Issue[],
  ordered: Issue[],
  board: Board,
): { issues: Issue[]; matched: Set<string> } {
  const matchedIds = new Set(matched.map((issue) => issue.id));
  const keep = new Set(matchedIds);
  for (const issue of matched) {
    let cursor: Issue | undefined = issue;
    while (cursor?.parent_id != null && !keep.has(cursor.parent_id)) {
      const parent: Issue | undefined = board.byInternalId.get(cursor.parent_id);
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

// ---------------------------------------------------------------------------

function parseViewerOptions(argv: string[]): ViewerOptions {
  const options: ViewerOptions = {
    repoDir: null,
    demo: false,
    port: DEFAULT_PORT,
    intervalSeconds: DEFAULT_INTERVAL_SECONDS,
    allowWrite: null,
    keep: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]!;
    const readValue = (name: string): string => {
      const value = argv[index + 1];
      if (value === undefined) {
        throw new Error(`${name} requires a value`);
      }
      index += 1;
      return value;
    };

    switch (argument) {
      case '--demo':
        options.demo = true;
        break;
      case '--repo':
        options.repoDir = readValue('--repo');
        break;
      case '--port':
        options.port = Number(readValue('--port'));
        break;
      case '--interval':
        options.intervalSeconds = Number(readValue('--interval'));
        break;
      case '--allow-write':
        options.allowWrite = true;
        break;
      case '--read-only':
        options.allowWrite = false;
        break;
      case '--keep':
        options.keep = true;
        break;
      case '--help':
      case '-h':
        console.log(usage());
        process.exit(0);
      // eslint-disable-next-line no-fallthrough
      default:
        throw new Error(`Unknown argument: ${argument}\n\n${usage()}`);
    }
  }

  if (!Number.isInteger(options.port) || options.port < 1 || options.port > 65_535) {
    throw new Error('--port must be an integer between 1 and 65535');
  }
  if (!Number.isFinite(options.intervalSeconds) || options.intervalSeconds < 10) {
    throw new Error('--interval must be at least 10 seconds, matching tbd watch');
  }
  if (options.demo && options.repoDir !== null) {
    throw new Error('--demo builds its own topology and cannot be combined with --repo');
  }
  return options;
}

function usage(): string {
  return [
    'Usage: pnpm tsx packages/tbd/scripts/bead-web.ts [options]',
    '',
    'Options:',
    '  --demo             Build a disposable remote plus writer/watcher clones and serve the watcher',
    '  --repo <dir>       Serve an existing tbd repository (default: current directory)',
    `  --port <n>         HTTP port, bound to loopback only (default: ${DEFAULT_PORT})`,
    `  --interval <s>     tbd watch poll interval, minimum 10 (default: ${DEFAULT_INTERVAL_SECONDS})`,
    '  --allow-write      Permit status/notes edits from the browser (default: on with --demo)',
    '  --read-only        Refuse all writes (default: on with --repo)',
    '  --keep             Retain a --demo topology on exit instead of removing it',
    '',
    'Environment:',
    '  TBD_QA_BIN         CLI under test (default: packages/tbd/dist/bin.mjs)',
  ].join('\n');
}

/** Read the sync remote and branch without a network round trip. */
async function readSyncConfig(repoDir: string): Promise<{ branch: string; remote: string }> {
  const raw = await readFile(join(repoDir, '.tbd', 'config.yml'), 'utf8');
  const syncSection = /^sync:\n((?:[ \t]+.*\n?)*)/mu.exec(raw);
  if (syncSection === null) {
    throw new Error(`No sync section in ${repoDir}/.tbd/config.yml`);
  }
  const body = syncSection[1] ?? '';
  const branch = /^\s+branch:\s*(\S+)/mu.exec(body)?.[1];
  const remote = /^\s+remote:\s*(\S+)/mu.exec(body)?.[1];
  if (branch === undefined || remote === undefined) {
    throw new Error(`Incomplete sync config in ${repoDir}/.tbd/config.yml`);
  }
  return { branch, remote };
}

/**
 * Build the disposable topology `--demo` serves: a bare remote, a writer clone the
 * operator drives by hand, and the watcher clone the viewer observes. Three levels deep
 * so the tree view has real grandchildren, plus one blocked bead so closing its blocker
 * produces a visible readiness transition.
 */
async function createDemoTopology(
  candidate: CandidateCommand,
): Promise<{ root: string; writerDir: string; watcherDir: string }> {
  const root = await mkdtemp(join(tmpdir(), 'tbd-bead-web-'));
  const remoteDir = join(root, 'remote.git');
  const writerDir = join(root, 'writer');
  const watcherDir = join(root, 'watcher');

  await git(root, ['init', '--bare', '--initial-branch=main', remoteDir]);
  await git(root, ['init', '--initial-branch=main', writerDir]);
  await git(writerDir, ['config', 'user.email', 'bead-web@example.com']);
  await git(writerDir, ['config', 'user.name', 'Bead Web Demo']);
  await git(writerDir, ['config', 'commit.gpgsign', 'false']);
  await git(writerDir, ['remote', 'add', 'origin', remoteDir]);

  const specPath = join(writerDir, 'docs', 'bead-web-demo.md');
  await mkdir(dirname(specPath), { recursive: true });
  await writeFile(specPath, '# Bead Web Demo Fixture\n');
  await git(writerDir, ['add', 'docs/bead-web-demo.md']);
  await git(writerDir, ['commit', '-m', 'Initial fixture']);
  await git(writerDir, ['push', '--set-upstream', 'origin', 'main']);

  const init = await runTbd(candidate, writerDir, [
    'init',
    '--prefix',
    'web',
    '--remote',
    'origin',
  ]);
  if (init.exitCode !== 0) {
    throw new Error(`tbd init failed: ${init.stderr.trim()}`);
  }
  await git(writerDir, ['add', '--all']);
  await git(writerDir, ['commit', '-m', 'Initialize tbd']);
  await git(writerDir, ['push']);

  const create = async (options: {
    title: string;
    kind?: string;
    label?: string;
    parent?: string;
    dependsOn?: string;
    description?: string;
  }): Promise<string> => {
    const args = ['create', options.title, '--json'];
    if (options.kind !== undefined) {
      args.push('-t', options.kind);
    }
    if (options.label !== undefined) {
      args.push('--label', options.label);
    }
    if (options.parent !== undefined) {
      args.push('--parent', options.parent);
    }
    if (options.dependsOn !== undefined) {
      args.push('--depends-on', options.dependsOn);
    }
    if (options.description !== undefined) {
      args.push('--description', options.description);
    }
    const created = await runTbd(candidate, writerDir, args);
    if (created.exitCode !== 0) {
      throw new Error(`tbd create failed: ${created.stderr.trim()}`);
    }
    return (parseLeadingJson(created.stdout, 'tbd create') as { id: string }).id;
  };

  const epic = await create({
    title: 'Bead watch rollout',
    kind: 'epic',
    label: 'viewer',
    description: 'Umbrella for the watch infrastructure demo.',
  });
  await create({
    title: 'Design the bead web viewer',
    label: 'viewer',
    parent: epic,
    description: 'Table, expandable bodies, and a live event log.',
  });
  const wiring = await create({
    title: 'Wire the wake paths',
    kind: 'epic',
    label: 'viewer',
    parent: epic,
  });
  await create({
    title: 'Remote path: ls-remote poll plus private-ref fetch',
    label: 'viewer',
    parent: wiring,
    description: 'Polls the sync remote and fetches only after the tip moves.',
  });
  await create({
    title: 'Local path: FSEvents on the hidden sync worktree',
    label: 'viewer',
    parent: wiring,
    description: 'Reflects edits made before anyone publishes them.',
  });
  const smoke = await create({
    title: 'Ship the release smoke',
    label: 'release',
    parent: epic,
  });
  await create({
    title: 'Blocked until the smoke ships',
    label: 'release',
    parent: epic,
    dependsOn: smoke,
  });

  const synced = await runTbd(candidate, writerDir, ['sync', '--issues', '--json']);
  if (synced.exitCode !== 0) {
    throw new Error(`tbd sync --issues failed: ${synced.stderr.trim()}`);
  }

  await git(root, ['clone', remoteDir, watcherDir]);
  await git(watcherDir, ['config', 'user.email', 'bead-web@example.com']);
  await git(watcherDir, ['config', 'user.name', 'Bead Web Demo']);
  await git(watcherDir, ['config', 'commit.gpgsign', 'false']);
  const pulled = await runTbd(candidate, watcherDir, ['sync', '--issues', '--pull']);
  if (pulled.exitCode !== 0) {
    throw new Error(`tbd sync --issues --pull failed: ${pulled.stderr.trim()}`);
  }

  return { root, writerDir, watcherDir };
}

/** Owns the in-memory board, the wake loops, and the browser connections. */
class BeadWebViewer {
  private readonly clients = new Set<ServerResponse>();
  private watchChild: ReturnType<typeof spawn> | null = null;
  private localWatcher: FSWatcher | null = null;
  private localTimer: NodeJS.Timeout | null = null;
  private keepAliveTimer: NodeJS.Timeout | null = null;
  private server: Server | null = null;
  private stopping = false;
  private loading: Promise<void> | null = null;
  private suppressLocalEvents = false;
  /** Trailing quiet window after our own writes, in ms since epoch. */
  private suppressLocalUntil = 0;
  private page = '';
  private readonly now = (): number => Date.now();
  private board: Board = {
    issues: [],
    byInternalId: new Map(),
    byDisplayId: new Map(),
    displayIdByInternalId: new Map(),
    ready: new Set(),
    mapping: { entries: {} } as unknown as IdMapping,
    prefix: 'tbd',
  };

  constructor(
    private readonly candidate: CandidateCommand,
    private readonly state: WatchState,
  ) {}

  async start(port: number): Promise<void> {
    this.page = await readFile(pagePath, 'utf8');
    await this.reload();
    this.state.watchSince = this.state.localTip;
    await this.listen(port);
    await this.startLocalWatch();
    void this.runRemoteWatchLoop();
    this.keepAliveTimer = setInterval(() => {
      for (const client of this.clients) {
        client.write(': keep-alive\n\n');
      }
    }, SSE_KEEPALIVE_MS);
    this.keepAliveTimer.unref();
  }

  async stop(): Promise<void> {
    this.stopping = true;
    this.state.watchPhase = 'stopped';
    this.watchChild?.kill('SIGTERM');
    this.watchChild = null;
    this.localWatcher?.close();
    if (this.localTimer !== null) {
      clearTimeout(this.localTimer);
    }
    if (this.keepAliveTimer !== null) {
      clearInterval(this.keepAliveTimer);
    }
    for (const client of this.clients) {
      client.end();
    }
    this.clients.clear();
    const server = this.server;
    if (server !== null) {
      // Idle keep-alive sockets keep close() pending for seconds, which would delay
      // removing a disposable topology. Drop them, and never let shutdown block.
      server.closeAllConnections();
      await Promise.race([
        new Promise<void>((resolveClose) => {
          server.close(() => {
            resolveClose();
          });
        }),
        sleep(SHUTDOWN_TIMEOUT_MS),
      ]);
    }
  }

  private listen(port: number): Promise<void> {
    return new Promise((resolveListen, rejectListen) => {
      const server = createServer((request, response) => {
        void this.handleRequest(request, response);
      });
      server.once('error', rejectListen);
      // Loopback only: this exposes an entire bead graph and, with --allow-write,
      // a mutation endpoint. It must never be reachable off the host.
      server.listen(port, '127.0.0.1', () => {
        this.server = server;
        resolveListen();
      });
    });
  }

  private log(level: EventLogEntry['level'], message: string): void {
    this.state.log.unshift({ at: new Date().toISOString(), level, message });
    if (this.state.log.length > MAX_EVENT_LOG_ENTRIES) {
      this.state.log.length = MAX_EVENT_LOG_ENTRIES;
    }
  }

  /**
   * Re-read the graph in process, the same way `tbd list` does, without a subprocess.
   * Serialized so overlapping wakes cannot interleave.
   */
  private async reload(): Promise<void> {
    while (this.loading !== null) {
      await this.loading;
    }
    const work = this.reloadOnce();
    this.loading = work;
    try {
      await work;
    } finally {
      this.loading = null;
    }
  }

  private async reloadOnce(): Promise<void> {
    const previousVersions = new Map(
      this.board.issues.map((issue) => [issue.id, issue.version] as const),
    );
    const isInitialLoad = this.board.issues.length === 0 && this.state.dataVersion === 0;

    const context = await loadDataContext(this.state.repoDir);
    const issues = await listIssues(context.dataSyncDir);
    const displayIdByInternalId = new Map(
      issues.map((issue) => [
        issue.id,
        String(formatDisplayId(issue.id, context.mapping, context.prefix)),
      ]),
    );
    const previousDisplayIds = this.board.displayIdByInternalId;

    this.board = {
      issues,
      byInternalId: new Map(issues.map((issue) => [issue.id, issue])),
      byDisplayId: new Map(
        issues.map((issue) => [displayIdByInternalId.get(issue.id) ?? issue.id, issue]),
      ),
      displayIdByInternalId,
      ready: readyIssueIds(issues),
      mapping: context.mapping,
      prefix: context.prefix,
    };

    // Movement is decided by comparing the data to itself, never by comparing what a
    // browser happened to be rendering. `version` bumps on every write, so an edit,
    // a create, and a delete are all detected the same way regardless of which wake
    // path observed them.
    const moved: string[] = [];
    const removed: string[] = [];
    if (!isInitialLoad) {
      for (const issue of issues) {
        if (previousVersions.get(issue.id) !== issue.version) {
          moved.push(displayIdByInternalId.get(issue.id) ?? issue.id);
        }
      }
      for (const [internalId] of previousVersions) {
        if (!this.board.byInternalId.has(internalId)) {
          const displayId = previousDisplayIds.get(internalId) ?? internalId;
          moved.push(displayId);
          removed.push(displayId);
        }
      }
      if (moved.length > 0) {
        // Sticky until the next real movement. A no-op reload must not erase the
        // description of the change that a client may still be about to read.
        this.state.dataVersion += 1;
        this.state.movedIds = moved;
        this.state.removedIds = removed;
        // The ● marker follows the snapshot diff, not the report, so a local wake
        // marks the beads that actually moved rather than leaving the previous remote
        // wake's markers in place (PR #207 review R4).
        this.state.changedIds = moved;
      }
    }
    this.state.totalBeads = issues.length;
    // Same aggregator `tbd stats` renders, so the two can never disagree.
    this.state.stats = computeIssueStats(issues);
    this.state.localTip = await this.readLocalTip();
    this.state.repoStatus = await this.readRepoStatus(context);
    this.state.refreshedAt = new Date().toISOString();
  }

  /**
   * The served subset of `tbd status`, assembled from helpers that were already
   * reusable. Nothing here reimplements a command: config and prefix come from the
   * same data context `tbd list` loads, and worktree health from the same
   * `checkWorktreeHealth` the status command calls.
   */
  private async readRepoStatus(context: TbdDataContext): Promise<RepoStatus> {
    const branch = await runCommand(
      this.state.repoDir,
      'git',
      ['rev-parse', '--abbrev-ref', 'HEAD'],
      COMMAND_TIMEOUT_MS,
    );
    const health = await checkWorktreeHealth(this.state.repoDir, context.config.sync.branch);
    let workspaces: string[] = [];
    try {
      workspaces = await listWorkspaces(this.state.repoDir);
    } catch {
      // Matches the status command: a workspace read failure is not fatal to a report.
    }
    return {
      tbdVersion: VERSION,
      gitBranch: branch.exitCode === 0 ? branch.stdout.trim() : null,
      syncBranch: context.config.sync.branch,
      remote: context.config.sync.remote,
      displayPrefix: context.prefix,
      worktreePath: context.sharedPaths.sharedWorktreePath,
      worktreeHealthy: health.valid,
      worktreeStatus: health.status,
      workspaces,
    };
  }

  private async readLocalTip(): Promise<string | null> {
    const result = await runCommand(
      this.state.repoDir,
      'git',
      ['rev-parse', '--verify', `refs/heads/${this.state.syncBranch}`],
      COMMAND_TIMEOUT_MS,
    );
    return result.exitCode === 0 ? result.stdout.trim() : null;
  }

  /**
   * Push only the watcher state. Browsers re-query the board with their own filters,
   * which keeps every event small no matter how large the graph is.
   *
   * A client that stops reading must not make the server buffer without bound: past
   * the write-buffer cap it is dropped, and its EventSource reconnects on its own.
   */
  private broadcast(): void {
    const payload = `event: state\ndata: ${JSON.stringify(this.state)}\n\n`;
    for (const client of this.clients) {
      if (client.writableLength > MAX_SSE_BUFFER_BYTES) {
        this.clients.delete(client);
        client.destroy();
        continue;
      }
      client.write(payload);
    }
  }

  /**
   * Local wake path: reflect edits made in this checkout before anyone syncs. Issue
   * files live in the shared hidden sync worktree, not under the caller's `.tbd`.
   */
  private async startLocalWatch(): Promise<void> {
    const issuesDir = await this.resolveIssuesDir();
    if (issuesDir === null) {
      this.log('info', 'No hidden sync worktree yet; local file watch is inactive');
      return;
    }
    try {
      this.localWatcher = watchFilesystem(issuesDir, { recursive: true }, () => {
        if (this.localTimer !== null) {
          clearTimeout(this.localTimer);
        }
        this.localTimer = setTimeout(() => {
          void this.onLocalChange();
        }, LOCAL_DEBOUNCE_MS);
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.log('error', `Local file watch unavailable: ${message}`);
    }
  }

  /**
   * Release the local-event suppression, then stay quiet for one trailing window so the
   * filesystem events our own write just produced do not read as a fresh local edit.
   */
  private endLocalSuppression(): void {
    this.suppressLocalEvents = false;
    this.suppressLocalUntil = this.now() + LOCAL_SUPPRESSION_TRAILING_MS;
  }

  /** Resolve the hidden sync worktree's issues directory, or null before it exists. */
  private async resolveIssuesDir(): Promise<string | null> {
    const commonDir = await runCommand(
      this.state.repoDir,
      'git',
      ['rev-parse', '--path-format=absolute', '--git-common-dir'],
      COMMAND_TIMEOUT_MS,
    );
    if (commonDir.exitCode !== 0) {
      return null;
    }
    const issuesDir = join(
      commonDir.stdout.trim(),
      'tbd',
      'data-sync-worktree',
      '.tbd',
      'data-sync',
      'issues',
    );
    try {
      await access(issuesDir);
      return issuesDir;
    } catch {
      return null;
    }
  }

  private async onLocalChange(): Promise<void> {
    // A pull or this viewer's own write rewrites the same files a local edit does, and
    // the filesystem events they produce arrive after the operation has finished. Without
    // the trailing window, every wake would be followed by a redundant full re-read of
    // the graph, which is the single most expensive thing this process does.
    if (this.stopping || this.suppressLocalEvents || this.now() < this.suppressLocalUntil) {
      return;
    }
    try {
      // A pull or this viewer's own write rewrites the same files a local edit does,
      // and their filesystem events can outlive the operation that caused them. reload()
      // reports movement by comparing the data to itself, so attribution is by observed
      // effect rather than by timing, and a no-op event stays silent.
      await this.reload();
      if (this.state.movedIds.length === 0) {
        return;
      }
      this.log('info', 'Local bead files changed (not yet on the sync remote)');
      this.broadcast();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.log('error', `Local refresh failed: ${message}`);
      this.broadcast();
    }
  }

  /**
   * Remote wake path: one blocking `tbd watch` per iteration, resumed from the previous
   * report's tip so a change landing between reports is still delivered.
   */
  private async runRemoteWatchLoop(): Promise<void> {
    while (!this.stopping) {
      const since = this.state.watchSince;
      const args = [
        'watch',
        '--all',
        '--json',
        '--interval',
        String(this.state.intervalSeconds),
        '--timeout',
        String(WATCH_TIMEOUT_SECONDS),
      ];
      if (since !== null) {
        args.push('--since', since);
      }

      this.state.watchPhase = 'watching';
      this.state.watchError = null;
      this.broadcast();

      let result: CommandResult;
      try {
        result = await this.runWatch(args);
      } catch (error) {
        if (this.stopping) {
          return;
        }
        const message = error instanceof Error ? error.message : String(error);
        await this.handleWatchFailure(message);
        continue;
      }
      if (this.stopping) {
        return;
      }

      if (result.exitCode === 3) {
        this.log('info', `Watch window elapsed with no change; resuming from ${short(since)}`);
        continue;
      }
      if (result.exitCode !== 0) {
        await this.handleWatchFailure(
          result.stderr.trim() || `tbd watch exited ${result.exitCode}`,
        );
        continue;
      }

      try {
        this.state.watchPhase = 'applying';
        this.broadcast();
        const report = asChangeReport(parseLeadingJson(result.stdout, 'tbd watch'), 'tbd watch');
        await this.applyReport(report);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await this.handleWatchFailure(`Report handling failed: ${message}`);
      }
    }
  }

  private runWatch(args: string[]): Promise<CommandResult> {
    return new Promise((resolveWatch, rejectWatch) => {
      const child = spawn(this.candidate.command, [...this.candidate.prefixArgs, ...args], {
        cwd: this.state.repoDir,
        env: gitSafeEnv({ NO_COLOR: '1' }),
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      this.watchChild = child;
      let stdout = '';
      let stderr = '';
      child.stdout.on('data', (chunk: Buffer) => {
        stdout += chunk.toString('utf8');
      });
      child.stderr.on('data', (chunk: Buffer) => {
        stderr += chunk.toString('utf8');
      });
      child.once('error', (error) => {
        this.watchChild = null;
        rejectWatch(error);
      });
      child.once('close', (exitCode) => {
        this.watchChild = null;
        resolveWatch({ exitCode: exitCode ?? 1, stdout, stderr });
      });
    });
  }

  /**
   * A report is a wake signal, not permission to render stale state: pull first, then
   * re-read, exactly as the watch-beads worker recipe requires.
   */
  private async applyReport(report: ChangeReport): Promise<void> {
    this.suppressLocalEvents = true;
    try {
      const pull = await runTbd(this.candidate, this.state.repoDir, ['sync', '--issues', '--pull']);
      if (pull.exitCode !== 0) {
        throw new Error(`tbd sync --pull failed: ${pull.stderr.trim()}`);
      }
      await this.reload();
    } finally {
      this.endLocalSuppression();
    }
    this.state.lastReport = report;
    // Stamp which movement this report describes. changedIds is left to the snapshot
    // diff in reload(), so marker and flash stay one source of truth; the report only
    // adds field-level detail, valid while this stamp matches dataVersion.
    this.state.reportDataVersion = this.state.dataVersion;
    this.state.watchSince = report.tip;
    this.state.wakeCount += 1;
    this.state.watchPhase = 'watching';
    const summary = report.changes
      .map((change) => `${change.id} ${change.change}`)
      .slice(0, 5)
      .join(', ');
    this.log(
      'wake',
      `Remote wake: ${report.changes.length} bead(s) changed in ${short(report.since)}..${short(report.tip)}${
        summary === '' ? '' : ` (${summary})`
      }`,
    );
    this.broadcast();
  }

  private async handleWatchFailure(message: string): Promise<void> {
    this.state.watchPhase = 'error';
    this.state.watchError = message;
    this.log('error', message);
    this.broadcast();

    // A saved baseline stops being an ancestor after sync recovery rewrites the branch.
    // Dropping it re-establishes a baseline at the current remote tip rather than
    // failing forever, at the cost of one acknowledged gap.
    if (this.state.watchSince !== null) {
      this.log('info', 'Dropping the resume baseline and re-establishing from the remote tip');
      this.state.watchSince = null;
    }
    await sleep(WATCH_ERROR_BACKOFF_MS);
  }

  /**
   * Loopback binding alone does not stop a hostile web page: DNS rebinding points a
   * name the page may fetch at 127.0.0.1, and a cross-origin form POST reaches the
   * mutation endpoint without CORS ever being consulted. Host must therefore name
   * loopback explicitly, and when a browser supplies an Origin it must be ours.
   */
  private isTrustedRequest(request: IncomingMessage): boolean {
    const host = request.headers.host ?? '';
    const hostname = host.replace(/:\d+$/u, '');
    if (hostname !== '127.0.0.1' && hostname !== 'localhost' && hostname !== '[::1]') {
      return false;
    }
    const origin = request.headers.origin;
    if (origin !== undefined) {
      try {
        const parsed = new URL(origin);
        return (
          parsed.hostname === '127.0.0.1' ||
          parsed.hostname === 'localhost' ||
          parsed.hostname === '[::1]'
        );
      } catch {
        return false;
      }
    }
    return true;
  }

  private async handleRequest(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const url = new URL(request.url ?? '/', 'http://127.0.0.1');
    if (!this.isTrustedRequest(request)) {
      sendJson(response, 403, { error: 'Cross-origin and non-loopback requests are refused' });
      return;
    }
    try {
      if (request.method === 'GET' && url.pathname === '/') {
        response.writeHead(200, {
          'content-type': 'text/html; charset=utf-8',
          'cache-control': 'no-store',
        });
        response.end(this.page);
        return;
      }
      if (request.method === 'GET' && url.pathname === '/api/board') {
        sendJson(response, 200, this.buildBoardResponse(url.searchParams));
        return;
      }
      if (request.method === 'GET' && url.pathname === '/api/bead') {
        this.handleBead(url, response);
        return;
      }
      if (request.method === 'GET' && url.pathname === '/api/events') {
        this.attachEventStream(request, response);
        return;
      }
      if (request.method === 'POST' && url.pathname === '/api/update') {
        await this.handleUpdate(request, response);
        return;
      }
      sendJson(response, 404, { error: 'Not found' });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      sendJson(response, 500, { error: message });
    }
  }

  /** Run one `tbd list`-equivalent query against the in-memory board. */
  private buildBoardResponse(params: URLSearchParams): unknown {
    const query = parseBoardQuery(params);
    // One sort of the whole graph serves both purposes: matches filtered from it are
    // already in order, and in tree mode the ancestors pulled in for context land in
    // the same order the reader asked for.
    const ordered = sortIssues(this.board.issues, this.board, query.sort);
    const filtered = filterIssues(ordered, this.board, query);
    const limited = applyLimit(filtered, query.limit ?? undefined);

    let rows: BoardRow[];
    let contextIds: string[] = [];
    if (query.pretty) {
      const context = withAncestors(limited, ordered, this.board);
      rows = orderAsTree(context.issues, this.board);
      contextIds = rows.filter((row) => !context.matched.has(row.internalId)).map((row) => row.id);
    } else {
      rows = limited.map((issue) => toRow(issue, this.board, ''));
    }

    const described = describeQueryAsCommand(query);
    return {
      command: described.command,
      // The ancestor rows injected for tree context are a deliberate divergence from
      // `tbd list --pretty`, which builds its tree from the filtered set only (unmatched
      // parents make their children roots). The view is better for it, but the command
      // then does not reproduce the table, so exactness must say so and the client names
      // the divergence in its caveat line (PR #207 review R3).
      commandExact: described.exact && contextIds.length === 0,
      // The two inexactness causes separately, so the client can name each: filters the
      // command cannot express, and ancestor rows the command would not print.
      filtersExact: described.exact,
      contextCount: contextIds.length,
      search: query.search,
      total: this.board.issues.length,
      matched: limited.length,
      rows: rows.slice(0, MAX_ROWS),
      truncated: rows.length > MAX_ROWS ? rows.length : 0,
      contextIds,
      state: this.state,
    };
  }

  /**
   * Full body for one bead, served from the in-memory snapshot. `tbd list` omits notes
   * and dependencies, and shipping every body in the table payload would be wasteful,
   * so the expanded view asks for exactly the one it opened.
   */
  private handleBead(url: URL, response: ServerResponse): void {
    const id = url.searchParams.get('id') ?? '';
    if (!/^[A-Za-z0-9][A-Za-z0-9-]{0,63}$/u.test(id)) {
      sendJson(response, 400, { error: 'Invalid bead id' });
      return;
    }
    const issue = this.board.byDisplayId.get(id);
    if (issue === undefined) {
      sendJson(response, 404, { error: `Unknown bead ${id}` });
      return;
    }
    const display = (internalId: string): string =>
      this.board.displayIdByInternalId.get(internalId) ?? internalId;
    sendJson(response, 200, {
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
      labels: issue.labels,
      due_date: issue.due_date ?? null,
      deferred_until: issue.deferred_until ?? null,
      close_reason: issue.close_reason ?? null,
      created_at: issue.created_at,
      updated_at: issue.updated_at,
      version: issue.version,
    });
  }

  private attachEventStream(request: IncomingMessage, response: ServerResponse): void {
    response.writeHead(200, {
      'content-type': 'text/event-stream',
      'cache-control': 'no-store',
      connection: 'keep-alive',
    });
    response.write(`event: state\ndata: ${JSON.stringify(this.state)}\n\n`);
    this.clients.add(response);
    request.once('close', () => {
      this.clients.delete(response);
    });
  }

  private async handleUpdate(request: IncomingMessage, response: ServerResponse): Promise<void> {
    if (!this.state.allowWrite) {
      sendJson(response, 403, { error: 'Viewer is read-only; restart with --allow-write' });
      return;
    }
    // Usage errors are the caller's fault and get 4xx, mirroring the CLI's exit-2
    // discipline; only a failure of the update or sync itself is a 500.
    let body: string;
    try {
      body = await readRequestBody(request);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      sendJson(response, message.includes('too large') ? 413 : 400, { error: message });
      return;
    }
    let parsed: { id?: string; status?: string; notes?: string };
    try {
      parsed = JSON.parse(body) as typeof parsed;
    } catch {
      sendJson(response, 400, { error: 'Request body is not valid JSON' });
      return;
    }
    if (typeof parsed.id !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9-]{0,63}$/u.test(parsed.id)) {
      sendJson(response, 400, { error: 'Invalid bead id' });
      return;
    }
    const args = ['update', parsed.id];
    if (typeof parsed.status === 'string' && parsed.status !== '') {
      if (!STATUSES.has(parsed.status)) {
        sendJson(response, 400, {
          error: `Invalid status; expected one of: ${[...STATUSES].join(', ')}`,
        });
        return;
      }
      args.push('--status', parsed.status);
    }
    if (typeof parsed.notes === 'string') {
      args.push('--notes', parsed.notes);
    }
    if (args.length === 2) {
      sendJson(response, 400, { error: 'Nothing to update' });
      return;
    }

    // Writes go through the CLI, not the file layer, so they take the same validation,
    // locking, and mapping path any other tbd caller does.
    this.suppressLocalEvents = true;
    try {
      const updated = await runTbd(this.candidate, this.state.repoDir, args);
      if (updated.exitCode !== 0) {
        sendJson(response, 500, { error: updated.stderr.trim() || 'tbd update failed' });
        return;
      }
      const synced = await runTbd(this.candidate, this.state.repoDir, ['sync', '--issues']);
      if (synced.exitCode !== 0) {
        sendJson(response, 500, { error: synced.stderr.trim() || 'tbd sync --issues failed' });
        return;
      }
      await this.reload();
    } finally {
      this.endLocalSuppression();
    }
    this.log('info', `Updated ${parsed.id} and published it to the sync remote`);
    this.broadcast();
    sendJson(response, 200, { ok: true });
  }
}

function short(value: string | null): string {
  return value === null ? 'none' : value.slice(0, 8);
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, milliseconds));
}

function sendJson(response: ServerResponse, status: number, payload: unknown): void {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  response.end(JSON.stringify(payload));
}

function readRequestBody(request: IncomingMessage): Promise<string> {
  return new Promise((resolveBody, rejectBody) => {
    let body = '';
    let bytes = 0;
    request.on('data', (chunk: Buffer) => {
      bytes += chunk.byteLength;
      if (bytes > MAX_REQUEST_BYTES) {
        rejectBody(new Error('Request body too large'));
        request.destroy();
        return;
      }
      body += chunk.toString('utf8');
    });
    request.once('end', () => {
      resolveBody(body);
    });
    request.once('error', rejectBody);
  });
}

async function main(): Promise<void> {
  const options = parseViewerOptions(process.argv.slice(2));
  const candidate = resolveCandidateCommand();
  if (candidate.pathToCheck !== null) {
    await access(candidate.pathToCheck);
  }

  let demoRoot: string | null = null;
  let repoDir: string;
  let writerDir: string | null = null;

  if (options.demo) {
    console.log('Building the disposable demo topology...');
    const topology = await createDemoTopology(candidate);
    demoRoot = topology.root;
    repoDir = topology.watcherDir;
    writerDir = topology.writerDir;
  } else {
    repoDir = resolve(invocationDir, options.repoDir ?? '.');
    await access(join(repoDir, '.tbd', 'config.yml'));
  }

  const sync = await readSyncConfig(repoDir);
  const allowWrite = options.allowWrite ?? options.demo;
  const state: WatchState = {
    repoDir,
    writerDir,
    syncBranch: sync.branch,
    remote: sync.remote,
    candidate: candidate.displayName,
    allowWrite,
    intervalSeconds: options.intervalSeconds,
    localTip: null,
    totalBeads: 0,
    stats: null,
    repoStatus: null,
    lastReport: null,
    reportDataVersion: 0,
    changedIds: [],
    dataVersion: 0,
    movedIds: [],
    removedIds: [],
    watchPhase: 'starting',
    watchSince: null,
    watchError: null,
    wakeCount: 0,
    refreshedAt: new Date().toISOString(),
    log: [],
  };

  const viewer = new BeadWebViewer(candidate, state);
  const startedAt = Date.now();
  try {
    await viewer.start(options.port);
  } catch (error) {
    // A failed startup must not strand the disposable topology it just built, and a
    // taken port deserves an instruction rather than a stack trace.
    if (demoRoot !== null && !options.keep) {
      await rm(demoRoot, { recursive: true, force: true });
    }
    if ((error as NodeJS.ErrnoException).code === 'EADDRINUSE') {
      throw new Error(
        `Port ${options.port} is already in use. Pass --port <n> to pick another ` +
          `(another viewer may already be running).`,
      );
    }
    throw error;
  }

  console.log('');
  console.log(`Bead web viewer:  http://127.0.0.1:${options.port}`);
  console.log(`Repository:       ${repoDir}`);
  console.log(`Sync:             ${sync.remote}/${sync.branch}`);
  console.log(`Beads:            ${state.totalBeads} loaded in ${Date.now() - startedAt}ms`);
  console.log(`Writes:           ${allowWrite ? 'enabled' : 'read-only'}`);
  if (writerDir !== null) {
    console.log('');
    console.log('Drive the remote wake path from a second terminal:');
    console.log(`  cd ${writerDir}`);
    console.log(`  ${candidate.displayName} update <id> --notes "hello from the writer"`);
    console.log(`  ${candidate.displayName} sync --issues`);
  }
  console.log('');
  console.log('Press Ctrl+C to stop.');

  let shuttingDown = false;
  const shutdown = (): void => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    void (async () => {
      console.log('\nStopping...');
      await viewer.stop();
      if (demoRoot !== null && !options.keep) {
        await rm(demoRoot, { recursive: true, force: true });
        console.log('Disposable topology removed');
      } else if (demoRoot !== null) {
        console.log(`Disposable topology retained at ${demoRoot}`);
      }
      process.exit(0);
    })();
  };

  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

/*
 * Productization notes, if this becomes `tbd web`:
 *
 * 1. Extract ListHandler.filterIssues/sortIssues into a shared issue-query module, the
 *    way PR #205 extracted issueMatchesSharedFilters. list, ready, changes, watch, and
 *    web would then share one query implementation instead of four that must agree.
 * 2. Fix tbd-5hh1 so renderIssueTree and this viewer draw identical hierarchies, then
 *    delete the local prefix computation in favour of a shared depth-aware walker.
 * 3. watchForIssueChanges takes no AbortSignal, so an in-process watcher cannot be
 *    cancelled without killing the process. Adding one would let `tbd web` drop the
 *    child process entirely.
 * 4. Writes currently shell out to the CLI to inherit its validation and locking.
 *    An in-process path needs the data-sync lock, which loadDataContext deliberately
 *    does not take for reads.
 * 5. Bind to loopback, keep the mutation endpoint behind an explicit flag, and treat
 *    any non-loopback bind as a separate security review. Loopback alone is not the
 *    whole story: this spike already validates Host (DNS rebinding) and Origin
 *    (cross-origin POST), and drops SSE clients that stop reading; a shipped command
 *    keeps all three.
 */
