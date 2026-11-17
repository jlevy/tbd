#!/usr/bin/env node
/* global clearTimeout, console, fetch, process, setTimeout, URL, WebSocket */

/**
 * Drive the built `tbd web` Workmap in headless Chrome at the server's maximum served
 * row count and prove, through the real live path, that:
 *
 * - every card is reachable and operable by keyboard alone, and focus survives the
 *   rerenders that follow expansion, body loads, and live bead updates;
 * - in-page view and grouping choices are written to the page URL, so reloading the
 *   address or opening it in a fresh profile reproduces what the viewer chose;
 * - rendering work is bounded: at most one board page of cards is mounted, a toggle or a
 *   one-bead live update re-creates at most the card it changed, and a live update
 *   reuses every other card.
 *
 * Chrome is required, so this is an explicit QA tier rather than part of `pnpm test`.
 * Set CHROME_PATH to choose a browser binary. The script never touches the source
 * checkout: it builds a disposable repository, serves it, and removes it.
 */

import { execFile, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { access, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const scriptDir = dirname(fileURLToPath(import.meta.url));
const packageDir = join(scriptDir, '..');
const tbdBin = join(packageDir, 'dist', 'bin.mjs');

/** The board API's response cap (MAX_BOARD_ROWS in src/cli/web/board.ts). */
const MAX_SERVED_ROWS = 10_000;
/** The browser's bounded paint window (BOARD_PAGE_SIZE in src/web/core.ts). */
const PAGE_SIZE = 5_000;
const AREAS = [
  'caching',
  'tracker',
  'sync',
  'web',
  'cli',
  'docs',
  'storage',
  'search',
  'auth',
  'perf',
  'infra',
  'release',
  'ui',
  'api',
  'tests',
  'ops',
  'data',
  'merge',
  'import',
  'export',
  'config',
];

function invariant(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function availablePort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  invariant(address !== null && typeof address !== 'string', 'Expected a TCP address');
  const port = address.port;
  await new Promise((resolve) => {
    server.close(resolve);
  });
  return port;
}

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ].filter((candidate) => candidate !== undefined && candidate !== '');
  const found = candidates.find((candidate) => existsSync(candidate));
  invariant(
    found !== undefined,
    `Chrome is required for this QA tier; set CHROME_PATH (tried ${candidates.join(', ')})`,
  );
  return found;
}

async function tbd(repoDir, args) {
  const { stdout } = await execFileAsync(process.execPath, [tbdBin, ...args], {
    cwd: repoDir,
    maxBuffer: 64 * 1024 * 1024,
  });
  return stdout;
}

/** A labeling convention with every bucket kind: groups, conflicts, and no value. */
function generatedBeads(count) {
  const lines = [];
  for (let index = 0; index < count; index += 1) {
    const labels = [`area:${AREAS[index % AREAS.length]}`];
    if (index % 7 === 0) {
      labels.push(`team:t${index % 5}`);
    }
    if (index % 97 === 0) {
      labels.push(`area:${AREAS[(index + 3) % AREAS.length]}`);
    }
    if (index % 13 === 0) {
      labels.length = 0;
    }
    const at = new Date(Date.UTC(2026, 0, 1) + index * 60_000).toISOString();
    lines.push(
      JSON.stringify({
        id: `bd-${index}`,
        title: `Workmap QA bead ${index} with a title long enough to wrap in a narrow card`,
        status: ['open', 'in_progress', 'blocked', 'deferred'][index % 4],
        priority: index % 5,
        issue_type: ['bug', 'task', 'feature', 'chore'][index % 4],
        labels,
        description: `Body for QA bead ${index}`,
        created_at: at,
        updated_at: at,
      }),
    );
  }
  return `${lines.join('\n')}\n`;
}

function waitForDescriptor(child) {
  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      reject(new Error(`tbd web did not become ready\n${stdout}\n${stderr}`));
    }, 60_000);
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
      try {
        const descriptor = JSON.parse(stdout);
        clearTimeout(timer);
        resolve(descriptor);
      } catch {
        // The descriptor is pretty-printed and may span chunks.
      }
    });
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      reject(new Error(`tbd web exited early (code ${code}, signal ${signal})\n${stderr}`));
    });
  });
}

function waitForExit(child) {
  if (child.exitCode !== null || child.signalCode !== null) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    child.once('exit', () => {
      resolve();
    });
  });
}

/** Minimal flattened-session CDP client over Node's built-in WebSocket. */
class Cdp {
  constructor(socket) {
    this.socket = socket;
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Set();
    socket.addEventListener('message', (event) => {
      const message = JSON.parse(String(event.data));
      if (message.id === undefined) {
        for (const listener of [...this.listeners]) {
          listener(message);
        }
        return;
      }
      const waiter = this.pending.get(message.id);
      this.pending.delete(message.id);
      if (message.error !== undefined) {
        waiter?.reject(new Error(`${waiter.method}: ${message.error.message}`));
      } else {
        waiter?.resolve(message.result);
      }
    });
  }

  static async connect(url) {
    const socket = new WebSocket(url);
    await new Promise((resolve, reject) => {
      socket.addEventListener('open', resolve, { once: true });
      socket.addEventListener('error', () => reject(new Error(`Cannot connect to ${url}`)), {
        once: true,
      });
    });
    return new Cdp(socket);
  }

  /**
   * Resolve with the next `method` event from `sessionId` that satisfies `accept`.
   * Subscribe before sending the command that causes the event, so it cannot be missed.
   */
  nextEvent(method, sessionId, timeoutMs, accept = () => true) {
    return new Promise((resolve, reject) => {
      const listener = (message) => {
        if (message.method === method && message.sessionId === sessionId && accept(message.params)) {
          this.listeners.delete(listener);
          clearTimeout(timer);
          resolve(message.params);
        }
      };
      const timer = setTimeout(() => {
        this.listeners.delete(listener);
        reject(new Error(`Timed out waiting for ${method}`));
      }, timeoutMs);
      this.listeners.add(listener);
    });
  }

  send(method, params = {}, sessionId = undefined) {
    const id = this.nextId++;
    this.socket.send(JSON.stringify({ id, method, params, sessionId }));
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject, method });
    });
  }

  close() {
    this.socket.close();
  }
}

/** One page (tab) in a browser context, driven through a flattened session. */
class Page {
  constructor(cdp, sessionId) {
    this.cdp = cdp;
    this.sessionId = sessionId;
  }

  static async open(cdp, url, browserContextId) {
    const { targetId } = await cdp.send('Target.createTarget', {
      url: 'about:blank',
      ...(browserContextId === undefined ? {} : { browserContextId }),
    });
    const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
    const page = new Page(cdp, sessionId);
    await page.send('Page.enable');
    await page.send('Runtime.enable');
    await page.send('Performance.enable');
    await page.send('Emulation.setDeviceMetricsOverride', {
      width: 1400,
      height: 1000,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await page.navigate(url);
    return page;
  }

  send(method, params = {}) {
    return this.cdp.send(method, params, this.sessionId);
  }

  async evaluate(expression) {
    const result = await this.send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (result.exceptionDetails !== undefined) {
      throw new Error(
        `Page evaluation failed: ${result.exceptionDetails.exception?.description ?? result.exceptionDetails.text}`,
      );
    }
    return result.result.value;
  }

  /**
   * Run `start`, then wait for the load event of the document it creates, and prove the
   * page now answers from a new document: nothing is evaluated in, or satisfied by, the
   * document being replaced while it is still answering.
   */
  async replaceDocument(start) {
    await this.evaluate('window.__qaReplacedDocument = true');
    const loaded = this.cdp.nextEvent('Page.loadEventFired', this.sessionId, 30_000);
    await start();
    await loaded;
    invariant(
      (await this.evaluate('window.__qaReplacedDocument === undefined')) === true,
      'The load event arrived but the previous document is still answering',
    );
  }

  navigate(url) {
    return this.replaceDocument(() => this.send('Page.navigate', { url }));
  }

  reload() {
    return this.replaceDocument(() => this.send('Page.reload', { ignoreCache: true }));
  }

  async waitFor(expression, timeoutMs = 30_000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if ((await this.evaluate(`Boolean(${expression})`)) === true) {
        return;
      }
      await delay(50);
    }
    throw new Error(`Timed out waiting for: ${expression}`);
  }

  async taskMs() {
    const { metrics } = await this.send('Performance.getMetrics');
    return (metrics.find((metric) => metric.name === 'TaskDuration')?.value ?? 0) * 1_000;
  }

  async press(name) {
    const keys = {
      Enter: { key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: '\r' },
      Space: { key: ' ', code: 'Space', windowsVirtualKeyCode: 32, text: ' ' },
      Tab: { key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 },
    };
    const key = keys[name];
    invariant(key !== undefined, `Unknown key ${name}`);
    const common = {
      key: key.key,
      code: key.code,
      windowsVirtualKeyCode: key.windowsVirtualKeyCode,
      nativeVirtualKeyCode: key.windowsVirtualKeyCode,
    };
    await this.send('Input.dispatchKeyEvent', {
      type: key.text === undefined ? 'rawKeyDown' : 'keyDown',
      ...common,
      ...(key.text === undefined ? {} : { text: key.text, unmodifiedText: key.text }),
    });
    await this.send('Input.dispatchKeyEvent', { type: 'keyUp', ...common });
  }

  /** A real pointer click at the center of the first element matching `selector`. */
  async click(selector) {
    const box = await this.evaluate(`(() => {
      const element = document.querySelector(${JSON.stringify(selector)});
      if (element === null) return null;
      element.scrollIntoView({ block: 'center' });
      const rect = element.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    })()`);
    invariant(box !== null, `Nothing to click for ${selector}`);
    for (const type of ['mousePressed', 'mouseReleased']) {
      await this.send('Input.dispatchMouseEvent', {
        type,
        x: box.x,
        y: box.y,
        button: 'left',
        clickCount: 1,
      });
    }
  }
}

/**
 * Page-side probe, reset before each action: `created` counts mounted cards that did not
 * exist before it, `detached` counts card nodes removed or moved, and `inserted` counts
 * distinct element nodes inserted (new or moved) under the workmap. A step settles once
 * nothing on the page has changed for the quiet window.
 */
const PROBE = `window.__workmapProbe = {
  mark() {
    this.seen = new WeakSet(document.querySelectorAll('.workmap-card'));
    this.counted = new WeakSet();
    this.inserted = 0;
    this.detached = 0;
    this.lastMutation = performance.now();
    this.observer?.disconnect();
    this.observer = new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (node.nodeType !== 1) continue;
          // Records are read after the fact, so a subtree inserted and then filled would be
          // counted twice; count each element node once.
          for (const element of [node, ...node.getElementsByTagName('*')]) {
            if (!this.counted.has(element)) {
              this.counted.add(element);
              this.inserted += 1;
            }
          }
        }
        for (const node of record.removedNodes) {
          if (node.nodeType === 1) {
            this.detached += node.matches('.workmap-card') ? 1 : node.getElementsByClassName('workmap-card').length;
          }
        }
      }
      this.lastMutation = performance.now();
    });
    this.observer.observe(document.getElementById('workmapgroups'), { childList: true, subtree: true, characterData: true });
    // Settle on the whole page: a render that reuses every card still rewrites the
    // status panel and log, and must count toward the step that caused it.
    this.activity?.disconnect();
    this.activity = new MutationObserver(() => {
      this.lastMutation = performance.now();
    });
    this.activity.observe(document.body, { childList: true, subtree: true, characterData: true });
  },
  quiet(ms) {
    return performance.now() - this.lastMutation >= ms;
  },
  report() {
    const cards = [...document.querySelectorAll('.workmap-card')];
    return {
      mounted: cards.length,
      created: cards.filter((card) => !this.seen.has(card)).length,
      detached: this.detached,
      inserted: this.inserted,
    };
  },
};`;

const results = [];
const measurements = [];

async function check(name, run) {
  try {
    await run();
    results.push({ name, ok: true });
  } catch (error) {
    results.push({
      name,
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Mark, run `action`, wait until `settled` holds and the page has been quiet for
 * `quietMs`, then measure. Startup uses a longer window because the first live state and
 * the board refetch it triggers can land well after the first paint.
 */
async function measure(page, label, action, settled, { timeoutMs = 60_000, quietMs = 400 } = {}) {
  await page.evaluate('window.__workmapProbe.mark()');
  const before = await page.taskMs();
  const started = Date.now();
  await action();
  await page.waitFor(`(${settled}) && window.__workmapProbe.quiet(${quietMs})`, timeoutMs);
  const report = await page.evaluate('window.__workmapProbe.report()');
  const entry = {
    label,
    ...report,
    taskMs: Math.round((await page.taskMs()) - before),
    wallMs: Date.now() - started - quietMs,
  };
  measurements.push(entry);
  return entry;
}

const CARD = '#workmapgroups .workmap-card';
const FIRST_CARD = `${CARD}[data-bead-id]`;

const temporaryDir = await mkdtemp(join(tmpdir(), 'tbd-web-workmap-'));
let server = null;
let chrome = null;
let cdp = null;
try {
  await access(tbdBin);
  const repoDir = join(temporaryDir, 'repository');
  await execFileAsync('git', ['init', '--quiet', repoDir]);
  for (const [key, value] of [
    ['user.name', 'tbd workmap QA'],
    ['user.email', 'tbd-workmap-qa@example.invalid'],
  ]) {
    await execFileAsync('git', ['config', key, value], { cwd: repoDir });
  }
  await execFileAsync('git', ['commit', '--quiet', '--allow-empty', '-m', 'init'], {
    cwd: repoDir,
  });
  await tbd(repoDir, ['init', '--prefix=qa']);
  const beadsFile = join(temporaryDir, 'beads.jsonl');
  await writeFile(beadsFile, generatedBeads(MAX_SERVED_ROWS));
  await tbd(repoDir, ['import', beadsFile]);

  const port = await availablePort();
  server = spawn(
    process.execPath,
    [
      tbdBin,
      '--json',
      'web',
      '--port',
      String(port),
      '--view',
      'workmap',
      '--group-prefix',
      'area:',
    ],
    { cwd: repoDir, stdio: ['ignore', 'pipe', 'pipe'] },
  );
  const descriptor = await waitForDescriptor(server);
  const origin = `http://127.0.0.1:${port}`;
  invariant(
    descriptor.url === origin &&
      descriptor.pageUrl === `${origin}/?view=workmap&group=area%3A`,
    `Unexpected descriptor URLs ${descriptor.url} and ${descriptor.pageUrl}`,
  );
  const served = await (
    await fetch(`${origin}/api/board?order=updated:desc&order=priority:asc&pretty=1`)
  ).json();
  invariant(
    served.rows.length === MAX_SERVED_ROWS && served.truncated === 0,
    `Expected ${MAX_SERVED_ROWS} served rows, got ${served.rows.length} (truncated ${served.truncated})`,
  );

  const profileDir = join(temporaryDir, 'chrome-profile');
  const chromeArgs = [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--no-proxy-server',
    '--remote-debugging-port=0',
    `--user-data-dir=${profileDir}`,
    'about:blank',
  ];
  if (process.getuid?.() === 0) {
    // Chrome refuses to start its sandbox as root (as in some CI containers).
    chromeArgs.unshift('--no-sandbox');
  }
  chrome = spawn(findChrome(), chromeArgs, { stdio: 'ignore' });
  const activePortFile = join(profileDir, 'DevToolsActivePort');
  const deadline = Date.now() + 30_000;
  while (!existsSync(activePortFile)) {
    invariant(Date.now() < deadline, 'Chrome did not publish a DevTools port');
    await delay(100);
  }
  await delay(100);
  const [devtoolsPort, browserPath] = (await readFile(activePortFile, 'utf8')).trim().split('\n');
  cdp = await Cdp.connect(`ws://127.0.0.1:${devtoolsPort}${browserPath}`);

  const page = await Page.open(cdp, descriptor.pageUrl, undefined);
  await page.evaluate(PROBE);
  const initial = await measure(
    page,
    'initial workmap paint (link from tbd web --view workmap --group-prefix area:)',
    async () => {},
    `document.querySelectorAll(${JSON.stringify(CARD)}).length > 0`,
    { quietMs: 1_500 },
  );

  // Calibration: the probe's own polling also counts as task time.
  await measure(page, 'idle: no action (probe polling only)', async () => {}, 'true');

  await check('mounts at most one board page of cards at the served-row cap', async () => {
    invariant(
      initial.mounted <= PAGE_SIZE,
      `${initial.mounted} cards mounted for ${MAX_SERVED_ROWS} rows (page size ${PAGE_SIZE})`,
    );
    const pager = await page.evaluate(
      `({ hidden: document.getElementById('pagecontrols').hidden, text: document.getElementById('pagepill').textContent })`,
    );
    invariant(
      !pager.hidden && pager.text === 'page 1 of 2',
      `Unexpected pager ${JSON.stringify(pager)}`,
    );
  });

  await check('shows every served row exactly once across workmap pages', async () => {
    const mountedIds = `[...document.querySelectorAll(${JSON.stringify(FIRST_CARD)})].map((card) => card.dataset.beadId)`;
    const firstPage = await page.evaluate(mountedIds);
    await page.click('#pagenext');
    // The pill and the cards change in the same synchronous render.
    await page.waitFor(`document.getElementById('pagepill').textContent === 'page 2 of 2'`, 5_000);
    const secondPage = await page.evaluate(mountedIds);
    const shown = new Set([...firstPage, ...secondPage]);
    invariant(
      firstPage.length + secondPage.length === MAX_SERVED_ROWS &&
        shown.size === MAX_SERVED_ROWS &&
        served.rows.every((row) => shown.has(row.id)),
      `Pages mounted ${firstPage.length} + ${secondPage.length} cards (${shown.size} distinct) for ${MAX_SERVED_ROWS} served rows`,
    );
    await page.click('#pageprev');
    await page.waitFor(`document.getElementById('pagepill').textContent === 'page 1 of 2'`);
  });

  await page.evaluate(PROBE);
  const firstId = await page.evaluate(
    `document.querySelector(${JSON.stringify(FIRST_CARD)}).dataset.beadId`,
  );
  const cardSelector = `${CARD}[data-bead-id=${JSON.stringify(firstId)}]`;

  const pointerOpen = await measure(
    page,
    'pointer: expand one card (body loads)',
    () => page.click(`${cardSelector} .workmap-card-title`),
    `document.querySelector(${JSON.stringify(`${cardSelector} .workmap-card-body .btext`)}) !== null`,
  );
  const pointerClose = await measure(
    page,
    'pointer: collapse the same card',
    () => page.click(`${cardSelector} .workmap-card-title`),
    `document.querySelector(${JSON.stringify(`${cardSelector} .workmap-card-body`)}) === null`,
  );
  await check('a pointer toggle neither re-creates nor moves any card', async () => {
    for (const entry of [pointerOpen, pointerClose]) {
      invariant(
        entry.created === 0 && entry.detached === 0,
        `${entry.label}: created ${entry.created}, detached ${entry.detached} cards`,
      );
    }
  });

  await check('Tab reaches the first card disclosure from the view chooser', async () => {
    await page.evaluate(
      `document.querySelector('#viewchooser [data-view-choice="workmap"]').focus()`,
    );
    await page.press('Tab');
    const focused = await page.evaluate(`(() => {
      const active = document.activeElement;
      return {
        tag: active?.tagName ?? null,
        disclosure: active?.classList.contains('disclosure') ?? false,
        bead: active?.closest('.workmap-card')?.dataset.beadId ?? null,
        expanded: active?.getAttribute('aria-expanded') ?? null,
      };
    })()`);
    invariant(
      focused.tag === 'BUTTON' &&
        focused.disclosure &&
        focused.bead === firstId &&
        focused.expanded === 'false',
      `Tab focused ${JSON.stringify(focused)} instead of the ${firstId} disclosure`,
    );
  });

  await check('Enter expands and Space collapses, keeping focus on the same control', async () => {
    await page.evaluate('window.__focusedControl = document.activeElement');
    const keyboardOpen = await measure(
      page,
      'keyboard: Enter expands the focused card (body loads)',
      () => page.press('Enter'),
      `document.querySelector(${JSON.stringify(`${cardSelector} .workmap-card-body .btext`)}) !== null`,
      { timeoutMs: 10_000 },
    );
    const afterOpen = await page.evaluate(
      `({ same: document.activeElement === window.__focusedControl, expanded: document.activeElement?.getAttribute('aria-expanded') ?? null })`,
    );
    invariant(
      afterOpen.same && afterOpen.expanded === 'true',
      `After Enter: ${JSON.stringify(afterOpen)}`,
    );
    const keyboardClose = await measure(
      page,
      'keyboard: Space collapses the focused card',
      () => page.press('Space'),
      `document.querySelector(${JSON.stringify(`${cardSelector} .workmap-card-body`)}) === null`,
      { timeoutMs: 10_000 },
    );
    const afterClose = await page.evaluate(
      `({ same: document.activeElement === window.__focusedControl, expanded: document.activeElement?.getAttribute('aria-expanded') ?? null })`,
    );
    invariant(
      afterClose.same && afterClose.expanded === 'false',
      `After Space: ${JSON.stringify(afterClose)}`,
    );
    for (const entry of [keyboardOpen, keyboardClose]) {
      invariant(
        entry.created === 0 && entry.detached === 0,
        `${entry.label}: created ${entry.created}, detached ${entry.detached} cards`,
      );
    }
  });

  await check(
    'a live one-bead update rebuilds and moves only that card, keeping its focus',
    async () => {
      // The updated bead sorts first (updated descending), so this also moves the card.
      const target = await page.evaluate(
        `[...document.querySelectorAll(${JSON.stringify(FIRST_CARD)})][3].dataset.beadId`,
      );
      const targetSelector = `${CARD}[data-bead-id=${JSON.stringify(target)}]`;
      await page.evaluate(
        `document.querySelector(${JSON.stringify(`${targetSelector} .disclosure`)})?.focus()`,
      );
      const title = `Live edit for ${target}`;
      const live = await measure(
        page,
        'live: tbd update of one mounted bead (title change, card moves)',
        () => tbd(repoDir, ['update', target, '--title', title]),
        `document.querySelector(${JSON.stringify(`${targetSelector} .workmap-card-title`)})?.textContent === ${JSON.stringify(title)}`,
      );
      invariant(
        live.created <= 1 && live.detached <= 1,
        `Live update created ${live.created} and detached ${live.detached} cards`,
      );
      const focused = await page.evaluate(
        `({ bead: document.activeElement?.closest('.workmap-card')?.dataset.beadId ?? null, disclosure: document.activeElement?.classList.contains('disclosure') ?? false })`,
      );
      invariant(
        focused.bead === target && focused.disclosure,
        `Focus after live update: ${JSON.stringify(focused)}`,
      );
    },
  );

  await check('in-page view and grouping choices are written to the page URL', async () => {
    const query = `Object.fromEntries(new URLSearchParams(location.search))`;
    await page.click('#viewchooser [data-view-choice="list"]');
    await page.waitFor(`!document.getElementById('tablewrap').hidden`);
    const afterList = await page.evaluate(query);
    invariant(afterList.view === 'list', `After choosing list: ${JSON.stringify(afterList)}`);
    await page.click('#viewchooser [data-view-choice="workmap"]');
    await page.waitFor(`!document.getElementById('workmapwrap').hidden`);
    await page.evaluate(`(() => {
      const select = document.getElementById('workmapgroup');
      select.value = 'team:';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    })()`);
    await page.waitFor(`new URLSearchParams(location.search).get('group') === 'team:'`, 5_000);
    const afterGroup = await page.evaluate(query);
    invariant(
      afterGroup.view === 'workmap' && afterGroup.group === 'team:',
      `After choosing team: grouping: ${JSON.stringify(afterGroup)}`,
    );
  });

  await check('reloading the address restores the chosen view and grouping', async () => {
    await page.reload();
    await page.waitFor(`document.querySelectorAll(${JSON.stringify(CARD)}).length > 0`);
    const restored = await page.evaluate(
      `({ workmap: !document.getElementById('workmapwrap').hidden, group: document.getElementById('workmapgroup').value })`,
    );
    invariant(
      restored.workmap && restored.group === 'team:',
      `After reload: ${JSON.stringify(restored)}`,
    );
  });

  await check('the copied address reproduces the choice in a fresh profile', async () => {
    const address = await page.evaluate('location.href');
    const { browserContextId } = await cdp.send('Target.createBrowserContext');
    const fresh = await Page.open(cdp, address, browserContextId);
    await fresh.waitFor(`document.querySelectorAll(${JSON.stringify(CARD)}).length > 0`);
    const shown = await fresh.evaluate(
      `({ workmap: !document.getElementById('workmapwrap').hidden, group: document.getElementById('workmapgroup').value, heading: document.querySelector('.workmap-group-name')?.firstChild?.textContent ?? null })`,
    );
    invariant(
      shown.workmap && shown.group === 'team:' && shown.heading?.startsWith('t') === true,
      `Fresh profile showed ${JSON.stringify(shown)} for ${address}`,
    );
    await cdp.send('Target.disposeBrowserContext', { browserContextId });
  });

  await check('a link copied before any grouping choice names the grouping it showed', async () => {
    const { browserContextId: sharerContext } = await cdp.send('Target.createBrowserContext');
    const sharer = await Page.open(cdp, `${origin}/`, sharerContext);
    await sharer.waitFor(`document.querySelectorAll('#rows tr[data-bead-id]').length > 0`);
    await sharer.click('#viewchooser [data-view-choice="workmap"]');
    await sharer.waitFor(`document.querySelectorAll(${JSON.stringify(CARD)}).length > 0`);
    const address = await sharer.evaluate('location.href');
    const query = new URL(address).searchParams;
    invariant(
      query.get('view') === 'workmap' && query.get('group') === 'area:',
      `Default grouping was not written to ${address}`,
    );
    const { browserContextId: recipientContext } = await cdp.send('Target.createBrowserContext');
    const recipient = await Page.open(cdp, `${origin}/`, recipientContext);
    await recipient.evaluate(
      `localStorage.setItem('tbd.web.workmapPrefix', 'team:'); localStorage.setItem('tbd.web.boardView', 'list')`,
    );
    await recipient.navigate(address);
    await recipient.waitFor(`document.querySelectorAll(${JSON.stringify(CARD)}).length > 0`);
    const shown = await recipient.evaluate(
      `({ workmap: !document.getElementById('workmapwrap').hidden, group: document.getElementById('workmapgroup').value })`,
    );
    invariant(
      shown.workmap && shown.group === 'area:',
      `A recipient storing team: saw ${JSON.stringify(shown)} for ${address}`,
    );
    for (const browserContextId of [sharerContext, recipientContext]) {
      await cdp.send('Target.disposeBrowserContext', { browserContextId });
    }
  });
} finally {
  if (cdp !== null) {
    // Closing through the protocol also stops Chrome's helper processes, which could
    // otherwise still be writing the profile while it is removed. The reply may never
    // arrive because the browser closes the socket.
    await Promise.race([cdp.send('Browser.close').catch(() => undefined), delay(2_000)]);
    cdp.close();
  }
  if (chrome !== null) {
    await Promise.race([waitForExit(chrome), delay(5_000)]);
    if (chrome.exitCode === null && chrome.signalCode === null) {
      chrome.kill('SIGKILL');
      await waitForExit(chrome);
    }
  }
  if (server !== null) {
    server.kill('SIGINT');
    await waitForExit(server);
  }
  await rm(temporaryDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}

console.log(`Workmap live-path measurements at ${MAX_SERVED_ROWS} served rows:`);
console.table(measurements);
for (const result of results) {
  console.log(
    `${result.ok ? 'PASS' : 'FAIL'} ${result.name}${result.ok ? '' : `\n     ${result.detail}`}`,
  );
}
const failed = results.filter((result) => !result.ok).length;
console.log(`${results.length - failed} passed, ${failed} failed`);
process.exitCode = failed === 0 ? 0 : 1;
