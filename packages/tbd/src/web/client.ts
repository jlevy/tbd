import { STATUS_ICONS } from '../lib/status-icons.js';
import {
  caveatsFor,
  createClientStore,
  DEFAULT_BOARD_SORTS,
  deltasValid,
  formatDeltaValue,
  formatRelativeAge,
  isDefaultBoardSort,
  labelSearchValueForRender,
  MAX_EXPANDED_ROWS,
  paginateBoardRows,
  phaseLabel,
  preserveLabelSearchEditingKey,
  promoteBoardSort,
  resolvedBoardSorts,
} from './core.js';
import type {
  BeadBodyView,
  BoardControls,
  BoardResponse,
  BoardRowView,
  BoardSortKeyView,
  BoardSortView,
  ClientStore,
  ClientView,
  IssueChangeView,
  IssueKindView,
  IssueStatusView,
  IssueStatsView,
  LabelFacetView,
  ObservationStateView,
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
  observerPill: byId('observerpill', HTMLSpanElement),
  countMeta: byId('countmeta', HTMLSpanElement),
  pageControls: byId('pagecontrols', HTMLSpanElement),
  pagePrevious: byId('pageprev', HTMLButtonElement),
  pagePill: byId('pagepill', HTMLSpanElement),
  pageNext: byId('pagenext', HTMLButtonElement),
  tipPill: byId('tippill', HTMLSpanElement),
  search: byId('q', HTMLInputElement),
  status: byId('status', HTMLSelectElement),
  statusValue: byId('statusvalue', HTMLSpanElement),
  kind: byId('type', HTMLSelectElement),
  kindValue: byId('typevalue', HTMLSpanElement),
  priority: byId('priority', HTMLSelectElement),
  priorityValue: byId('priorityvalue', HTMLSpanElement),
  labelChooser: byId('labelchooser', HTMLSpanElement),
  labelTrigger: byId('labeltrigger', HTMLButtonElement),
  labelSummary: byId('labelsummary', HTMLSpanElement),
  labelMenu: byId('labelmenu', HTMLDivElement),
  labelSearch: byId('labelsearch', HTMLInputElement),
  labelChoices: byId('labelchoices', HTMLDivElement),
  spec: byId('spec', HTMLInputElement),
  ready: byId('ready', HTMLInputElement),
  pretty: byId('pretty', HTMLInputElement),
  sortReset: byId('sortreset', HTMLButtonElement),
  expandAll: byId('expandall', HTMLButtonElement),
  gear: byId('gear', HTMLButtonElement),
  menu: byId('menu', HTMLDivElement),
};

const ISSUE_STATUSES = ['open', 'in_progress', 'blocked', 'deferred', 'closed'] as const;
const ISSUE_PRIORITIES = ['0', '1', '2', '3', '4'] as const;
const PRIORITY_LABEL = ['Critical', 'High', 'Medium', 'Low', 'Lowest'] as const;
const RELATIVE_TIME_REFRESH_MS = 30_000;
let boardPageIndex = 0;
let scrollBoardToTopAfterRender = false;
let labelMenuOpen = false;
let pendingLabelFocus: string | null = null;
let labelRenderSignature = '';
const selectedLabels = new Set<string>();
let activeSorts: BoardSortView[] = [];

const tooltip = document.createElement('div');
tooltip.id = 'viewer-tooltip';
tooltip.className = 'viewer-tooltip';
tooltip.setAttribute('role', 'tooltip');
tooltip.setAttribute('aria-hidden', 'true');
document.body.append(tooltip);
let activeTooltipTarget: HTMLElement | null = null;
let activeTooltipDescribedBy: string | null = null;
let tooltipPointer: { x: number; y: number } | null = null;

function setTooltip(target: HTMLElement, value: string): void {
  target.removeAttribute('title');
  target.dataset.tooltip = value;
  if (activeTooltipTarget === target) {
    tooltip.textContent = value;
  }
}

function positionTooltip(): void {
  if (activeTooltipTarget === null) {
    return;
  }
  const viewportGap = 8;
  const pointerOffsetX = 12;
  const pointerOffsetY = 16;
  const anchor = activeTooltipTarget.getBoundingClientRect();
  const tip = tooltip.getBoundingClientRect();
  let x = tooltipPointer?.x ?? anchor.left;
  let y = tooltipPointer?.y ?? anchor.bottom;
  x += tooltipPointer === null ? 0 : pointerOffsetX;
  y += tooltipPointer === null ? viewportGap : pointerOffsetY;
  if (x + tip.width > window.innerWidth - viewportGap) {
    x =
      tooltipPointer === null
        ? window.innerWidth - tip.width - viewportGap
        : tooltipPointer.x - tip.width - viewportGap;
  }
  if (y + tip.height > window.innerHeight - viewportGap) {
    y =
      tooltipPointer === null
        ? anchor.top - tip.height - viewportGap
        : tooltipPointer.y - tip.height - viewportGap;
  }
  tooltip.style.left = `${Math.max(viewportGap, x)}px`;
  tooltip.style.top = `${Math.max(viewportGap, y)}px`;
}

function showTooltip(target: HTMLElement, pointer: { x: number; y: number } | null): void {
  const value = target.dataset.tooltip?.trim();
  if (value === undefined || value === '') {
    return;
  }
  if (activeTooltipTarget !== target) {
    tooltip.classList.remove('visible');
    // Restart the CSS reveal delay for each distinct target, matching pointer intent.
    void tooltip.offsetWidth;
    if (activeTooltipTarget !== null) {
      if (activeTooltipDescribedBy === null) {
        activeTooltipTarget.removeAttribute('aria-describedby');
      } else {
        activeTooltipTarget.setAttribute('aria-describedby', activeTooltipDescribedBy);
      }
    }
    activeTooltipTarget = target;
    activeTooltipDescribedBy = target.getAttribute('aria-describedby');
    const describedBy = new Set((activeTooltipDescribedBy ?? '').split(/\s+/u).filter(Boolean));
    describedBy.add(tooltip.id);
    target.setAttribute('aria-describedby', [...describedBy].join(' '));
  }
  tooltipPointer = pointer;
  tooltip.textContent = value;
  tooltip.classList.toggle('literal', target.hasAttribute('data-tooltip-literal'));
  tooltip.setAttribute('aria-hidden', 'false');
  positionTooltip();
  tooltip.classList.add('visible');
}

function hideTooltip(): void {
  if (activeTooltipTarget !== null) {
    if (activeTooltipDescribedBy === null) {
      activeTooltipTarget.removeAttribute('aria-describedby');
    } else {
      activeTooltipTarget.setAttribute('aria-describedby', activeTooltipDescribedBy);
    }
  }
  activeTooltipTarget = null;
  activeTooltipDescribedBy = null;
  tooltipPointer = null;
  tooltip.classList.remove('visible');
  tooltip.setAttribute('aria-hidden', 'true');
}

function tooltipTarget(target: EventTarget | null): HTMLElement | null {
  return target instanceof Element ? target.closest<HTMLElement>('[data-tooltip]') : null;
}

document.addEventListener('pointerover', (event) => {
  const target = tooltipTarget(event.target);
  if (
    target === null ||
    (event.relatedTarget instanceof Node && target.contains(event.relatedTarget))
  ) {
    return;
  }
  showTooltip(target, { x: event.clientX, y: event.clientY });
});
document.addEventListener('pointermove', (event) => {
  if (activeTooltipTarget === null || tooltipPointer === null) {
    return;
  }
  tooltipPointer = { x: event.clientX, y: event.clientY };
  positionTooltip();
});
document.addEventListener('pointerout', (event) => {
  if (
    activeTooltipTarget === null ||
    (event.relatedTarget instanceof Node && activeTooltipTarget.contains(event.relatedTarget))
  ) {
    return;
  }
  hideTooltip();
});
document.addEventListener('focusin', (event) => {
  const target = tooltipTarget(event.target);
  if (target !== null) {
    showTooltip(target, null);
  }
});
document.addEventListener('focusout', (event) => {
  if (
    activeTooltipTarget !== null &&
    !(event.relatedTarget instanceof Node && activeTooltipTarget.contains(event.relatedTarget))
  ) {
    hideTooltip();
  }
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    hideTooltip();
  }
});
window.addEventListener('scroll', hideTooltip, true);
window.addEventListener('resize', hideTooltip);

function choice<T extends string>(value: string, choices: readonly T[], fallback: T): T {
  return choices.includes(value as T) ? (value as T) : fallback;
}

function isIssueStatus(value: string): value is IssueStatusView {
  return ISSUE_STATUSES.includes(value as IssueStatusView);
}

function isBoardSortKey(value: string | undefined): value is BoardSortKeyView {
  return (
    value !== undefined &&
    ['id', 'priority', 'status', 'kind', 'title', 'updated', 'labels'].includes(value)
  );
}

for (const option of elements.status.options) {
  if (isIssueStatus(option.value)) {
    option.textContent = `${STATUS_ICONS[option.value]} ${option.value}`;
    option.classList.add(`status-${option.value}`);
  }
}
for (const option of elements.priority.options) {
  if (ISSUE_PRIORITIES.includes(option.value as (typeof ISSUE_PRIORITIES)[number])) {
    option.classList.add(`priority-${option.value}`);
  }
}
for (const option of elements.kind.options) {
  option.classList.add('kind-choice');
}

function syncAggregateChooserLabel(
  chooser: HTMLSelectElement,
  display: HTMLSpanElement,
  labels: Readonly<Record<string, string>>,
): void {
  const label = labels[chooser.value];
  display.hidden = label === undefined;
  display.textContent = label ?? '';
}

function syncChooserSemantics(): void {
  for (const status of ISSUE_STATUSES) {
    elements.status.classList.toggle(`status-${status}`, elements.status.value === status);
  }
  for (const priority of ISSUE_PRIORITIES) {
    elements.priority.classList.toggle(
      `priority-${priority}`,
      elements.priority.value === priority,
    );
  }
  syncAggregateChooserLabel(elements.status, elements.statusValue, {
    '': 'status: active',
    any: 'any (incl. closed)',
  });
  syncAggregateChooserLabel(elements.kind, elements.kindValue, { '': 'type: any' });
  syncAggregateChooserLabel(elements.priority, elements.priorityValue, {
    '': 'priority: any',
  });
}

syncChooserSemantics();

function setFacetOption(
  option: HTMLOptionElement,
  label: string,
  count: number,
  selectedValue: string,
): void {
  option.textContent = `${label} · ${count}`;
  const unavailable = count === 0 && option.value !== selectedValue;
  option.hidden = unavailable;
  option.disabled = unavailable;
}

function renderCategoricalFacets(board: BoardResponse): void {
  const statusCounts = new Map(board.statusFacets.map((facet) => [facet.value, facet.count]));
  const statusAny = board.statusFacets.reduce((total, facet) => total + facet.count, 0);
  const statusActive = board.statusFacets.reduce(
    (total, facet) => total + (facet.value === 'closed' ? 0 : facet.count),
    0,
  );
  for (const option of elements.status.options) {
    const count =
      option.value === ''
        ? statusActive
        : option.value === 'any'
          ? statusAny
          : (statusCounts.get(option.value as IssueStatusView) ?? 0);
    const label =
      option.value === ''
        ? 'status: active'
        : option.value === 'any'
          ? 'any (incl. closed)'
          : `${STATUS_ICONS[option.value as IssueStatusView]} ${option.value}`;
    setFacetOption(option, label, count, elements.status.value);
  }

  const kindCounts = new Map(board.kindFacets.map((facet) => [facet.value, facet.count]));
  const kindAny = board.kindFacets.reduce((total, facet) => total + facet.count, 0);
  for (const option of elements.kind.options) {
    const count =
      option.value === '' ? kindAny : (kindCounts.get(option.value as IssueKindView) ?? 0);
    setFacetOption(
      option,
      option.value === '' ? 'type: any' : option.value,
      count,
      elements.kind.value,
    );
  }

  const priorityCounts = new Map(board.priorityFacets.map((facet) => [facet.value, facet.count]));
  const priorityAny = board.priorityFacets.reduce((total, facet) => total + facet.count, 0);
  for (const option of elements.priority.options) {
    const count =
      option.value === '' ? priorityAny : (priorityCounts.get(Number(option.value)) ?? 0);
    setFacetOption(
      option,
      option.value === '' ? 'priority: any' : `P${option.value}`,
      count,
      elements.priority.value,
    );
  }
}

function readControls(): BoardControls {
  return {
    search: elements.search.value,
    labelSearch: elements.labelSearch.value,
    status: choice(elements.status.value, ['', 'any', ...ISSUE_STATUSES] as const, ''),
    kind: choice(elements.kind.value, ['', 'bug', 'feature', 'task', 'epic', 'chore'] as const, ''),
    priority: choice(elements.priority.value, ['', '0', '1', '2', '3', '4'] as const, ''),
    labels: [...selectedLabels].sort(),
    spec: elements.spec.value,
    sorts: activeSorts.map((sort) => ({ ...sort })),
    ready: elements.ready.checked,
    pretty: elements.pretty.checked,
  };
}

function setLabelMenuOpen(open: boolean): void {
  labelMenuOpen = open;
  elements.labelMenu.hidden = !open;
  elements.labelTrigger.setAttribute('aria-expanded', String(open));
  elements.labelChooser.toggleAttribute('data-open', open);
}

function labelChoice(
  label: string | null,
  countValue: number | null,
  selected: boolean,
): HTMLButtonElement {
  const row = document.createElement('button');
  row.type = 'button';
  row.tabIndex = -1;
  row.className = 'label-choice';
  row.setAttribute('role', 'menuitemcheckbox');
  row.setAttribute('aria-checked', String(selected));
  if (label === null) {
    row.dataset.labelAny = '';
  } else {
    row.dataset.labelChoice = label;
  }

  const check = document.createElement('span');
  check.className = 'label-choice-check';
  check.setAttribute('aria-hidden', 'true');
  check.textContent = selected ? '✓' : '';
  const name = document.createElement('span');
  if (label === null) {
    name.className = 'label-choice-any';
  } else {
    name.className = 'tag label-choice-tag';
  }
  name.textContent = label ?? 'labels: any';
  row.append(check, name);
  if (countValue !== null) {
    const count = document.createElement('span');
    count.className = 'label-choice-count';
    count.textContent = String(countValue);
    row.append(count);
  }
  return row;
}

function activeLabelChoiceFocus(): string | null {
  const active = document.activeElement;
  if (!(active instanceof HTMLButtonElement) || !elements.labelChoices.contains(active)) {
    return null;
  }
  return active.hasAttribute('data-label-any') ? '' : (active.dataset.labelChoice ?? null);
}

function restoreLabelChoiceFocus(requested: string | null): void {
  if (requested === null) {
    return;
  }
  const choice = [
    ...elements.labelChoices.querySelectorAll<HTMLButtonElement>('.label-choice'),
  ].find((row) =>
    requested === '' ? row.hasAttribute('data-label-any') : row.dataset.labelChoice === requested,
  );
  choice?.focus();
}

function renderLabelChooser(
  facets: readonly LabelFacetView[],
  labels: readonly string[],
  labelSearch: string,
): void {
  const labelFocus = pendingLabelFocus ?? activeLabelChoiceFocus();
  pendingLabelFocus = null;
  selectedLabels.clear();
  for (const label of labels) {
    selectedLabels.add(label);
  }
  const selected = [...selectedLabels].sort();
  elements.labelSummary.textContent =
    selected.length === 0
      ? 'labels: any'
      : selected.length === 1
        ? selected[0]!
        : `${selected[0]} +${selected.length - 1}`;
  elements.labelTrigger.dataset.active = String(selected.length > 0);
  const renderedLabelSearch = labelSearchValueForRender(
    elements.labelSearch.value,
    labelSearch,
    document.activeElement === elements.labelSearch,
  );
  if (elements.labelSearch.value !== renderedLabelSearch) {
    elements.labelSearch.value = renderedLabelSearch;
  }

  const signature = JSON.stringify([selected, facets]);
  if (signature !== labelRenderSignature) {
    const choices: HTMLButtonElement[] = [labelChoice(null, null, selected.length === 0)];
    for (const facet of facets) {
      choices.push(labelChoice(facet.label, facet.count, selectedLabels.has(facet.label)));
    }
    elements.labelChoices.replaceChildren(...choices);
    labelRenderSignature = signature;
  }
  setLabelMenuOpen(labelMenuOpen);
  restoreLabelChoiceFocus(labelFocus);
}

function renderSortHeaders(sorts: readonly BoardSortView[], pretty: boolean): void {
  const resolved = resolvedBoardSorts(sorts);
  for (const header of document.querySelectorAll<HTMLTableCellElement>('th[data-sort-key]')) {
    const key = header.dataset.sortKey;
    if (!isBoardSortKey(key)) {
      continue;
    }
    const precedence = resolved.findIndex((sort) => sort.key === key);
    const sort = precedence < 0 ? undefined : resolved[precedence];
    header.setAttribute(
      'aria-sort',
      precedence === 0 ? (sort?.direction === 'desc' ? 'descending' : 'ascending') : 'none',
    );
    const button = header.querySelector<HTMLButtonElement>('.sort-button');
    const indicator = header.querySelector<HTMLElement>('.sort-indicator');
    if (indicator !== null) {
      indicator.textContent =
        sort === undefined ? '' : `${sort.direction === 'asc' ? '↑' : '↓'}${precedence + 1}`;
    }
    if (button !== null) {
      const current =
        sort === undefined
          ? 'not in the sort stack'
          : `${sort.direction === 'asc' ? 'ascending' : 'descending'}, precedence ${precedence + 1}`;
      button.setAttribute(
        'aria-label',
        `Sort by ${key}; currently ${current}. Clicking makes it primary${precedence === 0 ? ' and reverses its direction' : ''}.`,
      );
      setTooltip(
        button,
        pretty
          ? key === 'updated'
            ? 'Pretty moves outermost groups by the latest update in each visible subtree; children keep official order.'
            : 'Pretty applies this key to outermost groups; children keep official order.'
          : 'Flat mode applies this key to individual rows.',
      );
    }
  }
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

function updateRelativeTime(time: HTMLTimeElement, nowMs = Date.now()): void {
  const age = formatRelativeAge(time.dateTime, nowMs);
  if (age === null) {
    time.className = 'updated-age';
    time.textContent = 'unknown';
    delete time.dataset.tooltip;
    time.removeAttribute('aria-label');
    return;
  }
  time.className = `updated-age age-${age.tier}`;
  time.dateTime = age.exact;
  setTooltip(time, age.exact);
  time.dataset.tooltipLiteral = '';
  time.textContent = age.label;
  time.setAttribute('aria-label', `${age.label}; ${age.exact}`);
}

function appendUpdatedCell(row: HTMLTableRowElement, timestamp: string): void {
  const cell = appendCell(row, '', 'updated');
  const time = document.createElement('time');
  time.dateTime = timestamp;
  time.dataset.relativeTime = '';
  updateRelativeTime(time);
  cell.append(time);
}

function updateRelativeTimes(): void {
  const nowMs = Date.now();
  for (const time of document.querySelectorAll<HTMLTimeElement>('time[data-relative-time]')) {
    updateRelativeTime(time, nowMs);
  }
}

function copyButton(label: string): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'copy-button';
  setTooltip(button, `Copy ${label}`);
  button.setAttribute('aria-label', `Copy ${label}`);
  button.dataset.copyLabel = label;
  return button;
}

function copyButtonFrom(target: EventTarget | null): HTMLButtonElement | null {
  return target instanceof Element ? target.closest<HTMLButtonElement>('.copy-button') : null;
}

function finishCopy(button: HTMLButtonElement, succeeded: boolean): void {
  button.classList.remove('copied', 'copy-failed', 'copy-suppressed');
  // Restart confirmation when the same value is copied twice in quick succession.
  void button.offsetWidth;
  button.classList.toggle('copied', succeeded);
  button.classList.toggle('copy-failed', !succeeded);
  const feedback = succeeded ? 'Copied' : 'Copy failed';
  const label = button.dataset.copyLabel ?? 'value';
  setTooltip(button, feedback);
  button.setAttribute('aria-label', `${feedback}: ${label}`);
}

function copyValueFor(button: HTMLButtonElement): string {
  const value = button.previousElementSibling;
  return value instanceof HTMLElement && value.classList.contains('copy-value')
    ? (value.dataset.copyValue ?? value.textContent ?? '')
    : '';
}

function copyableText(value: string, label: string): HTMLSpanElement {
  const wrapper = document.createElement('span');
  wrapper.className = 'copyable';
  const text = document.createElement('span');
  text.className = 'copy-value';
  text.textContent = value;
  const button = copyButton(label);
  wrapper.append(text, button);
  return wrapper;
}

function setCopyableText(parent: HTMLElement, value: string, label: string): void {
  if (activeTooltipTarget !== null && parent.contains(activeTooltipTarget)) {
    hideTooltip();
  }
  parent.replaceChildren(copyableText(value, label));
}

function setCopyableBlock(parent: HTMLElement, value: string, label: string): void {
  if (activeTooltipTarget !== null && parent.contains(activeTooltipTarget)) {
    hideTooltip();
  }
  parent.classList.add('copy-surface');
  const text = document.createElement('span');
  text.className = 'copy-value';
  text.textContent = value;
  const button = copyButton(label);
  parent.replaceChildren(text, button);
}

for (const element of document.querySelectorAll<HTMLElement>('[data-copy-value]')) {
  const value = element.dataset.copyValue;
  if (value !== undefined) {
    setCopyableText(element, value, element.dataset.copyLabel ?? 'value');
  }
}

// One delegated copy pipeline keeps large boards light: each literal needs one
// accessible button, but no inline SVG subtree, captured value, or private listeners.
document.addEventListener(
  'click',
  (event) => {
    const button = copyButtonFrom(event.target);
    if (button === null) {
      return;
    }
    // Capture prevents the owning bead row from seeing the same click.
    event.preventDefault();
    event.stopPropagation();
    if (navigator.clipboard === undefined) {
      finishCopy(button, false);
      return;
    }
    void navigator.clipboard.writeText(copyValueFor(button)).then(
      () => {
        finishCopy(button, true);
      },
      () => {
        finishCopy(button, false);
      },
    );
  },
  { capture: true },
);

document.addEventListener('animationend', (event) => {
  const button = copyButtonFrom(event.target);
  if (
    button === null ||
    event.animationName !== 'copy-feedback' ||
    (!button.classList.contains('copied') && !button.classList.contains('copy-failed'))
  ) {
    return;
  }
  button.classList.remove('copied', 'copy-failed');
  button.classList.add('copy-suppressed');
  const label = button.dataset.copyLabel ?? 'value';
  setTooltip(button, `Copy ${label}`);
  button.setAttribute('aria-label', `Copy ${label}`);
});

function revealCopyButton(event: PointerEvent | FocusEvent): void {
  const target = event.target instanceof Element ? event.target : null;
  const surface = target?.closest<HTMLElement>('.copyable, .copy-surface');
  if (surface === null || surface === undefined) {
    return;
  }
  if (event.relatedTarget instanceof Node && surface.contains(event.relatedTarget)) {
    return;
  }
  surface
    .querySelector<HTMLButtonElement>(':scope > .copy-button')
    ?.classList.remove('copy-suppressed');
}
document.addEventListener('pointerover', revealCopyButton);
document.addEventListener('focusin', revealCopyButton);

function appendStatusCell(row: HTMLTableRowElement, status: IssueStatusView): HTMLTableCellElement {
  const cell = appendCell(row, '', `issue-status status-${status}`);
  const icon = document.createElement('span');
  icon.className = 'status-icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = STATUS_ICONS[status];
  cell.append(icon, document.createTextNode(` ${status}`));
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
  if (monospace) {
    setCopyableText(body, String(value), label.toLowerCase());
  } else {
    body.textContent = String(value);
  }
  parent.append(heading, body);
}

function findChange(changes: readonly IssueChangeView[], id: string): IssueChangeView | null {
  return changes.find((change) => change.id === id) ?? null;
}

function renderDelta(parent: HTMLElement, watch: ObservationStateView, id: string): void {
  if (!deltasValid(watch)) {
    return;
  }
  const delta = findChange(watch.latestChanges, id);
  if (delta === null || delta.change === 'created') {
    return;
  }

  const box = document.createElement('div');
  box.className = 'delta';
  const heading = document.createElement('div');
  heading.className = 'blabel';
  heading.textContent = `Changed in the latest local update (${delta.change})`;
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
      const text = field.hunks
        .map((part) =>
          part.lines
            .map((entry) => {
              const marker = entry.type === 'add' ? '+' : entry.type === 'remove' ? '-' : ' ';
              return `${marker}${entry.text}`;
            })
            .join('\n'),
        )
        .join('\n...\n');
      setCopyableBlock(hunk, text, `${field.field} change`);
      line.append(hunk);
    } else {
      const values = document.createElement('span');
      values.className = 'dval copyable';
      const before = formatDeltaValue(field.before);
      const after = formatDeltaValue(field.after);
      const literal = document.createElement('span');
      literal.className = 'copy-value';
      const copyValue = `${before.full}  →  ${after.full}`;
      literal.dataset.copyValue = copyValue;
      literal.setAttribute('aria-label', copyValue);
      const beforeText = document.createElement('span');
      beforeText.className = 'delta-before';
      beforeText.textContent = before.preview;
      const arrow = document.createElement('span');
      arrow.className = 'delta-arrow';
      arrow.textContent = '  →  ';
      const afterText = document.createElement('span');
      afterText.className = 'delta-after';
      afterText.textContent = after.preview;
      literal.append(beforeText, arrow, afterText);
      values.append(literal, copyButton(`${field.field} change`));
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
  const idCell = appendCell(tableRow, '', 'id');
  setCopyableText(idCell, row.id, 'bead ID');
  appendCell(tableRow, `P${row.priority}`, `priority priority-${row.priority}`);
  appendCell(tableRow, 'deleted', 'status-deferred');
  appendCell(tableRow, row.kind, 'kind');
  appendCell(tableRow, row.title, 'title');
  appendUpdatedCell(tableRow, row.updated_at);
  appendCell(tableRow, '', 'labels');
  return tableRow;
}

interface BoardFocusIdentity {
  beadId: string;
  role: 'disclosure' | 'copy';
  copyLabel: string | null;
}

function captureBoardFocus(): BoardFocusIdentity | null {
  const active = document.activeElement;
  if (!(active instanceof HTMLButtonElement)) {
    return null;
  }
  const row = active.closest<HTMLTableRowElement>('tr[data-bead-id]');
  const beadId = row?.dataset.beadId;
  if (beadId === undefined) {
    return null;
  }
  if (active.classList.contains('disclosure')) {
    return { beadId, role: 'disclosure', copyLabel: null };
  }
  if (active.classList.contains('copy-button')) {
    return { beadId, role: 'copy', copyLabel: active.dataset.copyLabel ?? null };
  }
  return null;
}

function restoreBoardFocus(identity: BoardFocusIdentity | null): void {
  if (identity === null) {
    return;
  }
  const row = [...elements.rows.querySelectorAll<HTMLTableRowElement>('tr[data-bead-id]')].find(
    (candidate) => candidate.dataset.beadId === identity.beadId,
  );
  if (row === undefined) {
    return;
  }
  if (identity.role === 'disclosure') {
    row.querySelector<HTMLButtonElement>('.disclosure')?.focus();
    return;
  }
  const button = [...row.querySelectorAll<HTMLButtonElement>('.copy-button')].find(
    (candidate) => candidate.dataset.copyLabel === identity.copyLabel,
  );
  button?.focus();
}

function renderRow(
  view: ClientView,
  row: BoardRowView,
  changedIds: ReadonlySet<string>,
): DocumentFragment {
  const fragment = document.createDocumentFragment();
  const tableRow = document.createElement('tr');
  tableRow.dataset.beadId = row.id;
  const open = view.expanded.has(row.id);
  const classes = [
    changedIds.has(row.id) ? 'changed' : '',
    open ? 'open' : '',
    view.flashIds.has(row.id) ? 'flash' : '',
  ].filter(Boolean);
  tableRow.className = classes.join(' ');
  const caretCell = appendCell(tableRow, '', 'caret');
  const disclosure = document.createElement('button');
  disclosure.type = 'button';
  disclosure.className = 'disclosure';
  disclosure.setAttribute('aria-expanded', String(open));
  disclosure.setAttribute('aria-label', `${open ? 'Collapse' : 'Expand'} ${row.id}`);
  const chevron = document.createElement('span');
  chevron.className = `chevron chevron-${open ? 'down' : 'right'}`;
  chevron.setAttribute('aria-hidden', 'true');
  disclosure.append(chevron);
  caretCell.append(disclosure);
  const idCell = appendCell(tableRow, '', 'id');
  setCopyableText(idCell, row.id, 'bead ID');
  appendCell(tableRow, `P${row.priority}`, `priority priority-${row.priority}`);
  appendStatusCell(tableRow, row.status);
  appendCell(tableRow, row.kind, 'kind');

  const title = appendCell(tableRow, '', 'title');
  const titleContent = document.createElement('span');
  titleContent.className = 'title-content';
  if (row.prefix !== '') {
    const guide = document.createElement('span');
    guide.className = 'guide';
    guide.textContent = row.prefix;
    titleContent.append(guide);
  }
  const titleText = document.createElement('span');
  titleText.className = 'title-text';
  titleText.textContent = row.title;
  titleContent.append(titleText);
  title.append(titleContent);

  appendUpdatedCell(tableRow, row.updated_at);

  const tags = appendCell(tableRow, '', 'labels');
  const cluster = document.createElement('span');
  cluster.className = 'tag-cluster';
  for (const label of row.labels) {
    const tag = document.createElement('span');
    tag.className = 'tag';
    tag.textContent = label;
    cluster.append(tag);
  }
  if (row.ready) {
    const ready = document.createElement('span');
    ready.className = 'ready-marker';
    ready.textContent = 'ready';
    ready.dataset.tooltip = 'Open, unassigned, and has no open blockers';
    cluster.append(ready);
  }
  tags.append(cluster);
  fragment.append(tableRow);

  if (open) {
    const bodyRow = document.createElement('tr');
    bodyRow.className = 'bodyrow';
    appendCell(bodyRow, '', 'caret');
    const cell = appendCell(bodyRow, '', 'body-cell');
    cell.colSpan = 7;
    cell.append(renderBody(view, row.id));
    fragment.append(bodyRow);
  }
  return fragment;
}

function renderStatus(watch: ObservationStateView): void {
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
    ['sync branch', watch.syncBranch, ''],
    ['configured remote', watch.remote, ''],
    ['local tip', short(watch.localTip), ''],
    ['prefix', status?.displayPrefix ?? '…', ''],
    ['worktree', worktree, status === null ? '' : status.worktreeHealthy === true ? 'good' : 'bad'],
    [
      'workspaces',
      status !== null && status.workspaces.length > 0 ? status.workspaces.join(', ') : 'none',
      '',
    ],
    ['observer', watch.observationMode, watch.observationPhase === 'error' ? 'bad' : 'good'],
  ];
  elements.statusList.replaceChildren();
  for (const [key, value, className] of rows) {
    const term = document.createElement('dt');
    term.textContent = key;
    const description = document.createElement('dd');
    description.className = className;
    setCopyableText(description, value, 'repository status value');
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
      [STATUS_ICONS[key], `ico status-${key}`],
      [key, `status-${key}`],
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
    [STATUS_ICONS.closed, 'ico status-closed'],
    ['closed', 'status-closed'],
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
        [`P${priority} ${PRIORITY_LABEL[priority] ?? ''}`, `priority priority-${priority}`],
        [String(active), 'num'],
        [String(closed), 'num'],
      ]);
    }
  }
}

function renderReport(watch: ObservationStateView): void {
  if (watch.latestChanges.length > 0) {
    elements.report.className = '';
    setCopyableBlock(
      elements.report,
      JSON.stringify(
        {
          changed_beads: watch.latestChangeTotal,
          details_truncated: watch.latestChangesTruncated,
          changes: watch.latestChanges,
        },
        null,
        2,
      ),
      'latest local changes',
    );
    return;
  }
  elements.report.className = 'placeholder';
  elements.report.textContent =
    watch.latestChangeTotal > 0
      ? watch.latestChangesTruncated
        ? `${watch.latestChangeTotal} local bead change${watch.latestChangeTotal === 1 ? '' : 's'} detected; field-level detail was truncated. Expand a bead for its current value.`
        : `${watch.latestChangeTotal} local bead ID or version change${watch.latestChangeTotal === 1 ? '' : 's'} had no field-level detail to display.`
      : watch.observationPhase === 'watching'
        ? 'No local changes seen yet. Changes made by tbd commands—including explicit tbd sync—appear here automatically.'
        : 'Waiting for the local observer to start…';
}

function renderLog(watch: ObservationStateView): void {
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
  cell.colSpan = 8;

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
  const boardFocus = captureBoardFocus();
  const page = paginateBoardRows(board.rows, boardPageIndex);
  const changedIds = new Set(view.watch?.movedIds ?? []);
  boardPageIndex = page.pageIndex;
  elements.pageControls.hidden = page.pageCount <= 1;
  elements.pagePrevious.disabled = page.pageIndex === 0;
  elements.pageNext.disabled = page.pageIndex >= page.pageCount - 1;
  elements.pagePill.textContent = `page ${page.pageIndex + 1} of ${page.pageCount}`;
  setTooltip(
    elements.pagePill,
    page.total === 0 ? 'No rows' : `Rows ${page.start + 1}–${page.end} of ${page.total}`,
  );
  elements.rows.replaceChildren();
  for (const row of view.ghostRows) {
    elements.rows.append(renderGhost(row));
  }
  for (const row of page.rows) {
    elements.rows.append(renderRow(view, row, changedIds));
  }
  appendBoardPager(board, page.pageIndex);
  restoreBoardFocus(boardFocus);
  elements.empty.hidden = board.rows.length > 0 || view.ghostRows.length > 0;
  elements.empty.textContent = view.boardError ?? 'No beads match this query.';
  const canBulkExpand = page.rows.length <= MAX_EXPANDED_ROWS;
  const allOpen = page.rows.length > 0 && page.rows.every((row) => view.expanded.has(row.id));
  elements.expandAll.hidden = page.rows.length === 0 || !canBulkExpand;
  elements.expandAll.textContent = allOpen ? 'Collapse all' : 'Expand all';
  elements.expandAll.disabled = elements.expandAll.hidden;
  setTooltip(elements.expandAll, 'Expand or collapse every bead on this page.');
}

function renderHeader(view: ClientView, board: BoardResponse, watch: ObservationStateView): void {
  const phase = phaseLabel(watch);
  elements.observerPill.replaceChildren();
  const dot = document.createElement('span');
  dot.className = 'dot';
  elements.observerPill.append(dot, document.createTextNode(phase.label));
  elements.observerPill.className = `pill ${watch.observationPhase}`;
  setTooltip(elements.observerPill, `Connected to the viewer server. ${phase.help}`);

  const hidden = board.closedHidden > 0 ? ` · ${board.closedHidden} closed hidden` : '';
  elements.countMeta.textContent = `${
    board.matched === board.total
      ? `${board.total} beads`
      : `${board.matched} of ${board.total} shown`
  }${hidden}`;
  setTooltip(
    elements.countMeta,
    board.closedHidden > 0
      ? 'Closed beads are hidden under active, matching tbd list. Choose any or closed to include them.'
      : 'Beads matching the current query, out of the whole graph.',
  );
  setCopyableText(
    elements.tipPill,
    `${watch.syncBranch} @ ${short(watch.localTip)}`,
    'local sync-branch tip',
  );
  setTooltip(
    elements.tipPill,
    'Local sync-branch tip. tbd web never fetches; run tbd sync to exchange remote changes.',
  );
  setCopyableText(elements.command, board.command, 'command');
  const caveats = caveatsFor(board);
  setTooltip(
    elements.command,
    board.commandExact && caveats.length === 0
      ? 'Run this to reproduce the table below.'
      : `Close but not exact: ${caveats.join('; ')}.`,
  );
  elements.pretty.checked = view.controls.pretty;
  activeSorts = view.controls.sorts.map((sort) => ({ ...sort }));
  elements.sortReset.hidden = isDefaultBoardSort(view.controls.sorts);
  renderSortHeaders(view.controls.sorts, view.controls.pretty);
  renderCategoricalFacets(board);
  renderLabelChooser(board.labelFacets, view.controls.labels, view.controls.labelSearch);
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
  if (view.boardError !== null) {
    elements.observerPill.textContent = 'refresh error';
    elements.observerPill.className = 'pill error';
    setTooltip(
      elements.observerPill,
      `Board refresh failed: ${view.boardError}. Showing the last successful board while the viewer retries.`,
    );
  } else if (disconnected) {
    elements.observerPill.textContent = 'disconnected';
    elements.observerPill.className = 'pill error';
    setTooltip(
      elements.observerPill,
      `The live connection dropped; the browser will retry automatically. Last server state: ${phaseLabel(watch).help}`,
    );
  }
  renderBoard(view, board);
  renderStatus(watch);
  renderStats(watch.stats);
  renderReport(watch);
  renderLog(watch);
  if (activeTooltipTarget !== null && !document.contains(activeTooltipTarget)) {
    hideTooltip();
  }
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

/** Coalesce a burst of body or local-observer updates into at most one paint per frame. */
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
    fetchJson: async (url, signal) => {
      const response = await fetch(url, {
        headers: { accept: 'application/json' },
        signal,
      });
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
  syncChooserSemantics();
  void store.setControls(readControls());
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
function debounceLabelSearch(): void {
  if (filterTimer !== null) {
    window.clearTimeout(filterTimer);
  }
  filterTimer = window.setTimeout(() => {
    filterTimer = null;
    void store.setControls(readControls());
  }, 120);
}
for (const input of [elements.search, elements.spec]) {
  input.addEventListener('input', debounceControls);
}
for (const input of [elements.status, elements.kind, elements.priority, elements.ready]) {
  input.addEventListener('change', applyControls);
}
elements.pretty.addEventListener('change', () => {
  applyControls();
});
elements.sortReset.addEventListener('click', () => {
  activeSorts = DEFAULT_BOARD_SORTS.map((sort) => ({ ...sort }));
  applyControls();
});
elements.labelTrigger.addEventListener('click', () => {
  setLabelMenuOpen(!labelMenuOpen);
  if (labelMenuOpen) {
    elements.labelSearch.focus();
  }
});
elements.labelTrigger.addEventListener('keydown', (event) => {
  if (event.key === 'ArrowDown') {
    event.preventDefault();
    setLabelMenuOpen(true);
    elements.labelSearch.focus();
  }
});
elements.labelMenu.addEventListener('click', (event) => {
  const row =
    event.target instanceof Element
      ? event.target.closest<HTMLButtonElement>('.label-choice')
      : null;
  if (row === null) {
    return;
  }
  if (row.hasAttribute('data-label-any')) {
    selectedLabels.clear();
    pendingLabelFocus = '';
  } else {
    const label = row.dataset.labelChoice;
    if (label === undefined) {
      return;
    }
    if (selectedLabels.has(label)) {
      selectedLabels.delete(label);
    } else {
      selectedLabels.add(label);
    }
    pendingLabelFocus = label;
  }
  applyControls();
});
elements.labelMenu.addEventListener('keydown', (event) => {
  if (preserveLabelSearchEditingKey(event.key, document.activeElement === elements.labelSearch)) {
    return;
  }
  const rows = [...elements.labelChoices.querySelectorAll<HTMLButtonElement>('.label-choice')];
  const current = rows.indexOf(document.activeElement as HTMLButtonElement);
  let next = -1;
  if (event.key === 'ArrowDown') {
    next = current < 0 ? 0 : (current + 1) % rows.length;
  } else if (event.key === 'ArrowUp') {
    next = current < 0 ? rows.length - 1 : (current - 1 + rows.length) % rows.length;
  } else if (event.key === 'Home') {
    next = 0;
  } else if (event.key === 'End') {
    next = rows.length - 1;
  } else if (event.key === 'Escape') {
    event.preventDefault();
    setLabelMenuOpen(false);
    elements.labelTrigger.focus();
    return;
  }
  if (next >= 0) {
    event.preventDefault();
    rows[next]?.focus();
  }
});
elements.labelSearch.addEventListener('input', debounceLabelSearch);
elements.rows.addEventListener('click', (event) => {
  const target = event.target instanceof Element ? event.target : null;
  if (target === null) {
    return;
  }
  const row = target.closest<HTMLTableRowElement>('tr[data-bead-id]');
  const suppressForSelection =
    target.closest<HTMLButtonElement>('.disclosure') === null &&
    !(window.getSelection()?.isCollapsed ?? true);
  if (row === null || suppressForSelection) {
    return;
  }
  const id = row.dataset.beadId;
  if (id !== undefined) {
    store.toggle(id);
  }
});
document.addEventListener('pointerdown', (event) => {
  if (event.target instanceof Node && !elements.labelChooser.contains(event.target)) {
    setLabelMenuOpen(false);
  }
});
for (const button of document.querySelectorAll<HTMLButtonElement>('.sort-button[data-sort-key]')) {
  button.addEventListener('click', () => {
    const key = button.dataset.sortKey;
    if (!isBoardSortKey(key)) {
      return;
    }
    const view = store.getView();
    activeSorts = promoteBoardSort(view.controls.sorts, key);
    applyControls();
  });
}
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
    setLabelMenuOpen(false);
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

const relativeTimeTimer = window.setInterval(updateRelativeTimes, RELATIVE_TIME_REFRESH_MS);
window.addEventListener('beforeunload', () => {
  window.clearInterval(relativeTimeTimer);
  store.stop();
});
void store.start();
