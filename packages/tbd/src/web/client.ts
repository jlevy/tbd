import {
  caveatsFor,
  createClientStore,
  deltasValid,
  MAX_EXPANDED_ROWS,
  paginateBoardRows,
  phaseLabel,
} from './core.js';
import type {
  BeadBodyView,
  BoardControls,
  BoardResponse,
  BoardRowView,
  ChangeReportView,
  ClientStore,
  ClientView,
  IssueStatsView,
  WatchStateView,
} from './core.js';

type ThemeMode = 'system' | 'light' | 'dark';

function byId<T extends HTMLElement>(id: string, constructor: new () => T): T {
  const element = document.getElementById(id);
  if (!(element instanceof constructor)) {
    throw new Error(`Missing or invalid web UI element #${id}`);
  }
  return element;
}

const elements = {
  tableWrap: byId('tablewrap', HTMLDivElement),
  rows: byId('rows', HTMLTableSectionElement),
  empty: byId('empty', HTMLDivElement),
  report: byId('report', HTMLPreElement),
  log: byId('log', HTMLUListElement),
  statusList: byId('statusdl', HTMLDListElement),
  stats: byId('stats', HTMLTableElement),
  command: byId('cmd', HTMLSpanElement),
  watchPill: byId('watchpill', HTMLSpanElement),
  wakePill: byId('wakepill', HTMLSpanElement),
  countPill: byId('countpill', HTMLSpanElement),
  pageControls: byId('pagecontrols', HTMLSpanElement),
  pagePrevious: byId('pageprev', HTMLButtonElement),
  pagePill: byId('pagepill', HTMLSpanElement),
  pageNext: byId('pagenext', HTMLButtonElement),
  tipPill: byId('tippill', HTMLSpanElement),
  search: byId('q', HTMLInputElement),
  status: byId('status', HTMLSelectElement),
  kind: byId('type', HTMLSelectElement),
  priority: byId('priority', HTMLSelectElement),
  labels: byId('label', HTMLInputElement),
  spec: byId('spec', HTMLInputElement),
  sort: byId('sort', HTMLSelectElement),
  ready: byId('ready', HTMLInputElement),
  pretty: byId('pretty', HTMLButtonElement),
  expandAll: byId('expandall', HTMLButtonElement),
  gear: byId('gear', HTMLButtonElement),
  menu: byId('menu', HTMLDivElement),
};

const STATUS_ICON: Record<string, string> = {
  open: '○',
  in_progress: '◐',
  blocked: '●',
  deferred: '○',
  closed: '✓',
};
const PRIORITY_LABEL = ['Critical', 'High', 'Medium', 'Low', 'Lowest'] as const;
let boardPageIndex = 0;
let scrollBoardToTopAfterRender = false;

function choice<T extends string>(value: string, choices: readonly T[], fallback: T): T {
  return choices.includes(value as T) ? (value as T) : fallback;
}

function readControls(pretty: boolean): BoardControls {
  return {
    search: elements.search.value,
    status: choice(
      elements.status.value,
      ['', 'any', 'open', 'in_progress', 'blocked', 'deferred', 'closed'] as const,
      '',
    ),
    kind: choice(elements.kind.value, ['', 'bug', 'feature', 'task', 'epic', 'chore'] as const, ''),
    priority: choice(elements.priority.value, ['', '0', '1', '2', '3', '4'] as const, ''),
    labels: elements.labels.value,
    spec: elements.spec.value,
    sort: choice(elements.sort.value, ['priority', 'created', 'updated'] as const, 'priority'),
    ready: elements.ready.checked,
    pretty,
  };
}

function short(value: string | null): string {
  return value === null || value === '' ? 'none' : value.slice(0, 8);
}

function appendCell(row: HTMLTableRowElement, text: string, className = ''): HTMLTableCellElement {
  const cell = document.createElement('td');
  cell.textContent = text;
  cell.className = className;
  row.append(cell);
  return cell;
}

function appendSection(
  parent: HTMLElement,
  label: string,
  value: string | number | null | undefined,
  monospace = false,
): void {
  if (value === undefined || value === null || value === '') {
    return;
  }
  const heading = document.createElement('div');
  heading.className = 'blabel';
  heading.textContent = label;
  const body = document.createElement('div');
  body.className = monospace ? 'btext mono' : 'btext';
  body.textContent = String(value);
  parent.append(heading, body);
}

function findChange(
  report: ChangeReportView | null,
  id: string,
): ChangeReportView['changes'][number] | null {
  return report?.changes.find((change) => change.id === id) ?? null;
}

function jsonText(value: unknown): string {
  return JSON.stringify(value) ?? 'undefined';
}

function renderDelta(parent: HTMLElement, watch: WatchStateView, id: string): void {
  if (!deltasValid(watch)) {
    return;
  }
  const delta = findChange(watch.lastReport, id);
  if (delta === null) {
    return;
  }

  const box = document.createElement('div');
  box.className = 'delta';
  const heading = document.createElement('div');
  heading.className = 'blabel';
  heading.textContent = `Changed in the latest wake (${delta.change})`;
  box.append(heading);

  for (const field of delta.fields) {
    const line = document.createElement('div');
    line.className = 'dfield';
    const name = document.createElement('span');
    name.className = 'dname';
    name.textContent = field.field;
    line.append(name);
    if (field.hunks !== undefined && field.hunks.length > 0) {
      const hunk = document.createElement('pre');
      hunk.className = 'hunk';
      hunk.textContent = field.hunks
        .map((part) =>
          part.lines
            .map((entry) => {
              const marker = entry.type === 'add' ? '+' : entry.type === 'remove' ? '-' : ' ';
              return `${marker}${entry.text}`;
            })
            .join('\n'),
        )
        .join('\n...\n');
      line.append(hunk);
    } else {
      const values = document.createElement('span');
      values.className = 'dval';
      values.textContent = `${jsonText(field.before)}  →  ${jsonText(field.after)}`;
      line.append(values);
    }
    box.append(line);
  }
  parent.append(box);
}

function renderLoadedBody(parent: HTMLElement, body: BeadBodyView): void {
  appendSection(parent, 'Description', body.description);
  appendSection(parent, 'Notes', body.notes);
  appendSection(parent, 'Spec', body.spec_path, true);
  appendSection(parent, 'Assignee', body.assignee);
  appendSection(parent, 'Parent', body.parent, true);
  if (body.dependencies !== undefined && body.dependencies.length > 0) {
    appendSection(
      parent,
      'Dependencies',
      body.dependencies.map((dependency) => `${dependency.type} → ${dependency.target}`).join('\n'),
      true,
    );
  }
  appendSection(parent, 'Due', body.due_date, true);
  appendSection(parent, 'Deferred until', body.deferred_until, true);
  appendSection(parent, 'Close reason', body.close_reason);
  const timestamps = [
    body.created_at === undefined ? null : `created  ${body.created_at}`,
    body.updated_at === undefined ? null : `updated  ${body.updated_at}`,
    body.version === undefined ? null : `version  ${body.version}`,
  ].filter((line): line is string => line !== null);
  appendSection(parent, 'Timestamps', timestamps.join('\n'), true);
}

function renderBody(view: ClientView, id: string): HTMLElement {
  const body = document.createElement('div');
  if (view.watch !== null) {
    renderDelta(body, view.watch, id);
  }
  const cached = view.bodies.get(id);
  if (cached?.kind === 'error') {
    const error = document.createElement('div');
    error.className = 'btext err';
    error.textContent = cached.error;
    body.append(error);
  } else if (cached?.kind === 'loaded') {
    renderLoadedBody(body, cached.body);
  } else {
    const heading = document.createElement('div');
    heading.className = 'blabel';
    heading.textContent = view.inFlightBodies.has(id) ? 'Loading' : 'Waiting to load';
    const skeleton = document.createElement('span');
    skeleton.className = 'skeleton';
    body.append(heading, skeleton);
  }
  return body;
}

function renderGhost(row: BoardRowView): HTMLTableRowElement {
  const tableRow = document.createElement('tr');
  tableRow.className = 'leaving';
  appendCell(tableRow, '', 'caret');
  appendCell(tableRow, row.id, 'id');
  appendCell(tableRow, `P${row.priority}`);
  appendCell(tableRow, 'deleted');
  appendCell(tableRow, row.kind);
  appendCell(tableRow, row.title);
  appendCell(tableRow, '');
  return tableRow;
}

function renderRow(
  view: ClientView,
  row: BoardRowView,
  changedIds: ReadonlySet<string>,
  contextIds: ReadonlySet<string>,
): DocumentFragment {
  const fragment = document.createDocumentFragment();
  const tableRow = document.createElement('tr');
  const open = view.expanded.has(row.id);
  const classes = [
    changedIds.has(row.id) ? 'changed' : '',
    open ? 'open' : '',
    contextIds.has(row.id) ? 'context' : '',
    view.flashIds.has(row.id) ? 'flash' : '',
  ].filter(Boolean);
  tableRow.className = classes.join(' ');

  const caretCell = appendCell(tableRow, '', 'caret');
  const disclosure = document.createElement('button');
  disclosure.type = 'button';
  disclosure.className = 'disclosure';
  disclosure.setAttribute('aria-expanded', String(open));
  disclosure.setAttribute('aria-label', `${open ? 'Collapse' : 'Expand'} ${row.id}`);
  disclosure.textContent = open ? '▾' : '▸';
  disclosure.addEventListener('click', () => {
    store.toggle(row.id);
  });
  caretCell.append(disclosure);
  appendCell(tableRow, row.id, 'id');
  appendCell(tableRow, `P${row.priority}`);
  appendCell(tableRow, row.status);
  appendCell(tableRow, row.kind);

  const title = appendCell(tableRow, '');
  if (row.prefix !== '') {
    const guide = document.createElement('span');
    guide.className = 'guide';
    guide.textContent = row.prefix;
    title.append(guide);
  }
  title.append(document.createTextNode(row.title));

  const tags = appendCell(tableRow, '');
  if (row.ready) {
    const ready = document.createElement('span');
    ready.className = 'tag ready';
    ready.textContent = 'ready';
    tags.append(ready);
  }
  for (const label of row.labels) {
    const tag = document.createElement('span');
    tag.className = 'tag';
    tag.textContent = label;
    tags.append(tag);
  }
  fragment.append(tableRow);

  if (open) {
    const bodyRow = document.createElement('tr');
    bodyRow.className = 'bodyrow';
    const cell = appendCell(bodyRow, '');
    cell.colSpan = 7;
    cell.append(renderBody(view, row.id));
    fragment.append(bodyRow);
  }
  return fragment;
}

function renderStatus(watch: WatchStateView): void {
  const status = watch.repoStatus;
  const worktree =
    status === null
      ? '…'
      : status.worktreeHealthy === true
        ? 'healthy'
        : (status.worktreeStatus ?? 'unhealthy');
  const rows: [string, string, string][] = [
    ['repo', watch.repoDir, ''],
    ['tbd', status?.tbdVersion ?? '…', ''],
    ['branch', status?.gitBranch ?? 'detached', ''],
    ['sync', `${watch.remote}/${watch.syncBranch}`, ''],
    ['tip', short(watch.localTip), ''],
    ['prefix', status?.displayPrefix ?? '…', ''],
    ['worktree', worktree, status === null ? '' : status.worktreeHealthy === true ? 'good' : 'bad'],
    [
      'workspaces',
      status !== null && status.workspaces.length > 0 ? status.workspaces.join(', ') : 'none',
      '',
    ],
    ['watching', `since ${short(watch.watchSince)}, every ${watch.intervalSeconds}s`, ''],
  ];
  elements.statusList.replaceChildren();
  for (const [key, value, className] of rows) {
    const term = document.createElement('dt');
    term.textContent = key;
    const description = document.createElement('dd');
    description.className = className;
    description.textContent = value;
    elements.statusList.append(term, description);
  }
}

function appendStatsRow(cells: [string, string][], className = ''): void {
  const row = document.createElement('tr');
  row.className = className;
  for (const [text, cellClass] of cells) {
    appendCell(row, text, cellClass);
  }
  elements.stats.append(row);
}

function renderStats(stats: IssueStatsView | null): void {
  elements.stats.replaceChildren();
  if (stats === null) {
    return;
  }
  appendStatsRow(
    [
      ['By status', ''],
      ['', 'num'],
    ],
    'group',
  );
  for (const key of ['open', 'in_progress', 'blocked', 'deferred'] as const) {
    appendStatsRow([
      [STATUS_ICON[key] ?? '', 'ico'],
      [key, ''],
      [String(stats.byStatus[key]), 'num'],
    ]);
  }
  appendStatsRow(
    [
      ['', 'ico'],
      ['active', ''],
      [String(stats.active), 'num'],
    ],
    'total',
  );
  appendStatsRow([
    [STATUS_ICON.closed ?? '', 'ico'],
    ['closed', ''],
    [String(stats.closed), 'num'],
  ]);
  appendStatsRow(
    [
      ['', 'ico'],
      ['total', ''],
      [String(stats.total), 'num'],
    ],
    'total',
  );

  appendStatsRow(
    [
      ['By kind', ''],
      ['active', 'num'],
      ['closed', 'num'],
    ],
    'group',
  );
  for (const kind of ['bug', 'feature', 'task', 'epic', 'chore'] as const) {
    const active = stats.byKindActive[kind] ?? 0;
    const closed = stats.byKindClosed[kind] ?? 0;
    if (active + closed > 0) {
      appendStatsRow([
        [kind, ''],
        [String(active), 'num'],
        [String(closed), 'num'],
      ]);
    }
  }

  appendStatsRow(
    [
      ['By priority', ''],
      ['active', 'num'],
      ['closed', 'num'],
    ],
    'group',
  );
  for (let priority = 0; priority <= 4; priority += 1) {
    const active = stats.byPriorityActive[String(priority)] ?? 0;
    const closed = stats.byPriorityClosed[String(priority)] ?? 0;
    if (active + closed > 0) {
      appendStatsRow([
        [`P${priority} ${PRIORITY_LABEL[priority] ?? ''}`, ''],
        [String(active), 'num'],
        [String(closed), 'num'],
      ]);
    }
  }
}

function renderReport(watch: WatchStateView): void {
  if (watch.lastReport !== null) {
    elements.report.className = '';
    elements.report.textContent = JSON.stringify(watch.lastReport, null, 2);
    return;
  }
  elements.report.className = 'placeholder';
  elements.report.textContent =
    watch.watchPhase === 'watching'
      ? `No changes seen yet. Actively watching ${watch.remote}/${watch.syncBranch}, ` +
        `checking every ${watch.intervalSeconds}s—the first report will appear here.`
      : 'Waiting for the watcher to start…';
}

function renderLog(watch: WatchStateView): void {
  elements.log.replaceChildren();
  for (const entry of watch.log.slice(0, 60)) {
    const item = document.createElement('li');
    item.className = entry.level;
    const time = document.createElement('time');
    time.textContent = entry.at.slice(11, 19);
    item.append(time, document.createTextNode(entry.message));
    elements.log.append(item);
  }
}

function navigateBoardPage(pageIndex: number): void {
  boardPageIndex = pageIndex;
  scrollBoardToTopAfterRender = true;
  // Expanded bodies belong to the page being left. Clearing them also drops queued
  // detail work before the next bounded render window is painted.
  store.setExpanded([]);
}

function appendBoardPager(board: BoardResponse, pageIndex: number): void {
  const page = paginateBoardRows(board.rows, pageIndex);
  if (page.pageCount <= 1 && board.truncated === 0) {
    return;
  }

  const row = document.createElement('tr');
  row.className = 'board-page-row';
  const cell = appendCell(row, '', 'board-page');
  cell.colSpan = 7;

  const previous = document.createElement('button');
  previous.type = 'button';
  previous.textContent = 'Previous';
  previous.disabled = page.pageIndex === 0;
  previous.addEventListener('click', () => {
    navigateBoardPage(page.pageIndex - 1);
  });

  const summary = document.createElement('span');
  const range =
    page.total === 0 ? 'No rows' : `Rows ${page.start + 1}–${page.end} of ${page.total}`;
  const serverLimit =
    board.truncated === 0
      ? ''
      : ` · Server returned the first ${board.rows.length} of ${board.truncated} rows; narrow the query to reach the remainder.`;
  summary.textContent = `${range}${serverLimit}`;

  const next = document.createElement('button');
  next.type = 'button';
  next.textContent = 'Next';
  next.disabled = page.pageIndex >= page.pageCount - 1;
  next.addEventListener('click', () => {
    navigateBoardPage(page.pageIndex + 1);
  });

  cell.append(previous, summary, next);
  elements.rows.append(row);
}

function renderBoard(view: ClientView, board: BoardResponse): void {
  const page = paginateBoardRows(board.rows, boardPageIndex);
  const changedIds = new Set(view.watch?.changedIds ?? []);
  const contextIds = new Set(board.contextIds);
  boardPageIndex = page.pageIndex;
  elements.pageControls.hidden = page.pageCount <= 1;
  elements.pagePrevious.disabled = page.pageIndex === 0;
  elements.pageNext.disabled = page.pageIndex >= page.pageCount - 1;
  elements.pagePill.textContent = `page ${page.pageIndex + 1} of ${page.pageCount}`;
  elements.pagePill.title =
    page.total === 0 ? 'No rows' : `Rows ${page.start + 1}–${page.end} of ${page.total}`;
  elements.rows.replaceChildren();
  for (const row of view.ghostRows) {
    elements.rows.append(renderGhost(row));
  }
  for (const row of page.rows) {
    elements.rows.append(renderRow(view, row, changedIds, contextIds));
  }
  appendBoardPager(board, page.pageIndex);
  elements.empty.hidden = board.rows.length > 0 || view.ghostRows.length > 0;
  elements.empty.textContent = view.boardError ?? 'No beads match this query.';
  const canBulkExpand = page.rows.length <= MAX_EXPANDED_ROWS;
  const allOpen = page.rows.length > 0 && page.rows.every((row) => view.expanded.has(row.id));
  elements.expandAll.textContent = canBulkExpand
    ? allOpen
      ? 'Collapse page'
      : 'Expand page'
    : 'Expand individually';
  elements.expandAll.disabled = page.rows.length === 0 || !canBulkExpand;
  elements.expandAll.title = canBulkExpand
    ? 'Expand or collapse every row on this page.'
    : `Narrow the query to ${MAX_EXPANDED_ROWS} rows or fewer to expand them together.`;
}

function renderHeader(view: ClientView, board: BoardResponse, watch: WatchStateView): void {
  const phase = phaseLabel(watch);
  elements.watchPill.replaceChildren();
  const dot = document.createElement('span');
  dot.className = 'dot';
  elements.watchPill.append(dot, document.createTextNode(phase.label));
  elements.watchPill.className = `pill ${watch.watchPhase}`;
  elements.watchPill.title = phase.help;
  elements.wakePill.textContent = `${watch.wakeCount} ${watch.wakeCount === 1 ? 'wake' : 'wakes'}`;
  elements.wakePill.title = 'Graph changes observed since this viewer started.';

  const hidden = board.closedHidden > 0 ? ` · ${board.closedHidden} closed hidden` : '';
  elements.countPill.textContent = `${board.matched === board.total ? `${board.total} beads` : `${board.matched} of ${board.total}`}${hidden}`;
  elements.countPill.title =
    board.closedHidden > 0
      ? 'Closed beads are hidden under active, matching tbd list. Choose any or closed to include them.'
      : 'Beads matching the current query, out of the whole graph.';
  elements.tipPill.textContent = `${watch.remote}/${watch.syncBranch} @ ${short(watch.localTip)}`;
  elements.tipPill.title = `Resuming from ${short(watch.watchSince)}.`;
  elements.command.textContent = board.command;
  const caveats = caveatsFor(board);
  elements.command.title =
    board.commandExact && caveats.length === 0
      ? 'Run this to reproduce the table below.'
      : `Close but not exact: ${caveats.join('; ')}.`;
  elements.pretty.classList.toggle('on', view.controls.pretty);
  document.title = `tbd beads (${watch.totalBeads})`;
}

let disconnected = false;
let ghostTimer: number | null = null;
let renderFrame: number | null = null;
function render(): void {
  const view = store.getView();
  const { board, watch } = view;
  if (board === null || watch === null) {
    elements.empty.hidden = false;
    elements.empty.textContent = view.boardError ?? 'Loading beads…';
    return;
  }

  renderHeader(view, board, watch);
  if (disconnected) {
    elements.watchPill.textContent = 'disconnected';
    elements.watchPill.className = 'pill error';
    elements.watchPill.title = 'The live connection dropped; the browser will retry automatically.';
  }
  renderBoard(view, board);
  renderStatus(watch);
  renderStats(watch.stats);
  renderReport(watch);
  renderLog(watch);
  store.acknowledgeDataMotion();

  if (scrollBoardToTopAfterRender) {
    scrollBoardToTopAfterRender = false;
    elements.tableWrap.scrollIntoView({ block: 'start' });
  }

  if (view.ghostRows.length > 0 && ghostTimer === null) {
    ghostTimer = window.setTimeout(() => {
      ghostTimer = null;
      store.clearGhostRows();
    }, 400);
  }
}

/** Coalesce a burst of body or watcher updates into at most one table paint per frame. */
function scheduleRender(): void {
  if (renderFrame !== null) {
    return;
  }
  renderFrame = window.requestAnimationFrame(() => {
    renderFrame = null;
    render();
  });
}

const store: ClientStore = createClientStore(
  {
    fetchJson: async (url) => {
      const response = await fetch(url, { headers: { accept: 'application/json' } });
      if (!response.ok) {
        let detail = `${response.status} ${response.statusText}`;
        try {
          const payload: unknown = await response.json();
          if (
            typeof payload === 'object' &&
            payload !== null &&
            'error' in payload &&
            typeof payload.error === 'string'
          ) {
            detail = payload.error;
          }
        } catch {
          // Preserve the HTTP status when an intermediary returns a non-JSON error.
        }
        throw new Error(detail);
      }
      return response.json() as Promise<unknown>;
    },
    openEvents: (url, onState, lastEventId) => {
      const eventUrl = new URL(url, window.location.href);
      if (lastEventId !== undefined) {
        eventUrl.searchParams.set('lastEventId', lastEventId);
      }
      const source = new EventSource(eventUrl);
      source.addEventListener('open', () => {
        disconnected = false;
        scheduleRender();
      });
      source.addEventListener('state', (event: MessageEvent<string>) => {
        disconnected = false;
        try {
          onState(JSON.parse(event.data) as unknown);
        } catch {
          disconnected = true;
          scheduleRender();
        }
      });
      source.addEventListener('error', () => {
        disconnected = true;
        scheduleRender();
      });
      return {
        close: () => {
          source.close();
        },
      };
    },
  },
  scheduleRender,
  { storage: window.localStorage },
);

let filterTimer: number | null = null;
function applyControls(): void {
  boardPageIndex = 0;
  store.setExpanded([]);
  void store.setControls(readControls(store.getView().controls.pretty));
}
function debounceControls(): void {
  if (filterTimer !== null) {
    window.clearTimeout(filterTimer);
  }
  filterTimer = window.setTimeout(() => {
    filterTimer = null;
    applyControls();
  }, 120);
}
for (const input of [elements.search, elements.labels, elements.spec]) {
  input.addEventListener('input', debounceControls);
}
for (const input of [
  elements.status,
  elements.kind,
  elements.priority,
  elements.sort,
  elements.ready,
]) {
  input.addEventListener('change', applyControls);
}
elements.pretty.addEventListener('click', () => {
  const controls = store.getView().controls;
  boardPageIndex = 0;
  store.setExpanded([]);
  void store.setControls({ ...readControls(!controls.pretty), pretty: !controls.pretty });
});
elements.expandAll.addEventListener('click', () => {
  const view = store.getView();
  const ids =
    view.board === null
      ? []
      : paginateBoardRows(view.board.rows, boardPageIndex).rows.map((row) => row.id);
  if (ids.length > MAX_EXPANDED_ROWS) {
    return;
  }
  const allOpen = ids.length > 0 && ids.every((id) => view.expanded.has(id));
  store.setExpanded(allOpen ? [] : ids);
});
elements.pagePrevious.addEventListener('click', () => {
  navigateBoardPage(boardPageIndex - 1);
});
elements.pageNext.addEventListener('click', () => {
  navigateBoardPage(boardPageIndex + 1);
});

const themeButtons = [...document.querySelectorAll<HTMLButtonElement>('[data-theme-choice]')];
function themeMode(value: string | undefined): ThemeMode {
  return choice(value ?? '', ['system', 'light', 'dark'] as const, 'system');
}
function applyTheme(mode: ThemeMode, persist: boolean): void {
  document.documentElement.dataset.themeMode = mode;
  if (mode === 'system') {
    delete document.documentElement.dataset.theme;
  } else {
    document.documentElement.dataset.theme = mode;
  }
  for (const button of themeButtons) {
    button.setAttribute('aria-checked', String(button.dataset.themeChoice === mode));
  }
  if (persist) {
    try {
      window.localStorage.setItem('tbd.themeMode', mode);
    } catch {
      // Storage is optional; the choice remains effective for this page load.
    }
  }
}
function closeMenu(): void {
  elements.menu.hidden = true;
  elements.gear.setAttribute('aria-expanded', 'false');
}
elements.gear.addEventListener('click', (event) => {
  event.stopPropagation();
  elements.menu.hidden = !elements.menu.hidden;
  elements.gear.setAttribute('aria-expanded', String(!elements.menu.hidden));
});
elements.menu.addEventListener('click', (event) => {
  event.stopPropagation();
});
document.addEventListener('click', closeMenu);
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    closeMenu();
  }
});
for (const button of themeButtons) {
  button.addEventListener('click', () => {
    applyTheme(themeMode(button.dataset.themeChoice), true);
  });
}
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (document.documentElement.dataset.themeMode === 'system') {
    applyTheme('system', false);
  }
});
applyTheme(themeMode(document.documentElement.dataset.themeMode), false);

window.addEventListener('beforeunload', () => {
  store.stop();
});
void store.start();
