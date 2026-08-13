/**
 * Enforces the design-system rules documented at the top of `src/web/styles.css`.
 *
 * Two rules carry real weight:
 *
 * 1. Color literals live only in the `:root` blocks, so a theme can be retuned in one
 *    place and light/dark cannot drift apart.
 * 2. Data motion and UI motion never mix. Highlighting a row amber because a filter
 *    revealed it tells the reader that something changed upstream when nothing did, so
 *    the update color and the flash keyframes are reserved for observed data movement.
 *
 * A comment saying so is not enforcement; these assertions are.
 */

import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const packageDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const stylePath = join(packageDir, 'src', 'web', 'styles.css');
const clientPath = join(packageDir, 'src', 'web', 'client.ts');
const pagePath = join(packageDir, 'src', 'web', 'index.html');
const statusIconPath = join(packageDir, 'src', 'lib', 'status-icons.ts');

/** Hex, rgb(), or hsl() written directly in a rule rather than referenced as a token. */
const COLOR_LITERAL = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?)\s*\(/g;

async function readStyleBlock(): Promise<string> {
  return readFile(stylePath, 'utf8');
}

/**
 * Strip the base `:root` block, the one place literals are the whole point. The theme
 * override blocks (`:root:not([data-theme='light'])`, `:root[data-theme='dark']`) are
 * deliberately NOT stripped: they must be pure remaps of --dark-* tokens, so a literal
 * appearing there is exactly the drift this check exists to catch.
 */
function withoutBaseRoot(css: string): string {
  return css.replace(/(^|\})\s*:root\s*\{[^}]*\}/u, '$1');
}

function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//gu, '');
}

function blockAfter(css: string, selector: string): string | null {
  // Git may check text fixtures out with CRLF on Windows. Normalize the input so
  // multiline selectors in these assertions have the same semantics on every host.
  const source = stripComments(css).replace(/\r\n?/gu, '\n');
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
  const match = new RegExp(`${escapedSelector}\\s*\\{`, 'u').exec(source);
  if (match === null) {
    return null;
  }
  const openIndex = source.indexOf('{', match.index + selector.length);
  if (openIndex < 0) {
    return null;
  }
  let depth = 1;
  for (let index = openIndex + 1; index < source.length; index += 1) {
    if (source[index] === '{') {
      depth += 1;
    } else if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) {
        return source.slice(openIndex + 1, index);
      }
    }
  }
  return null;
}

describe('bead-web design system', () => {
  it('finds multiline selectors in CRLF stylesheets', () => {
    const crlf = '.one,\r\n.two {\r\n  display: flex;\r\n}\r\n';
    expect(blockAfter(crlf, '.one,\n.two')).toContain('display: flex');
  });

  it('defines every color as a token, with no literals outside the base :root', async () => {
    const css = stripComments(await readStyleBlock());
    const offenders = withoutBaseRoot(css).match(COLOR_LITERAL) ?? [];
    expect(
      offenders,
      `Color literals must be tokens on the base :root. Found: ${offenders.join(', ')}`,
    ).toEqual([]);
  });

  it('retunes the dark palette without changing any hue', async () => {
    const css = stripComments(await readStyleBlock());
    const base = /(?:^|\})\s*:root\s*\{([^}]*)\}/u.exec(css)?.[1] ?? '';
    expect(base, 'expected a base :root block').not.toBe('');

    const hues = new Map<string, string>();
    for (const [, name, hue] of base.matchAll(/(--[\w-]+):\s*hsl\(\s*([\d.]+)/gu)) {
      hues.set(name!, hue!);
    }

    // Lightness is the theme knob; hue encodes family and must stay put. A few points of
    // drift is fine for legibility, a different family is a bug.
    const drifted: string[] = [];
    let pairs = 0;
    for (const [name, darkHue] of hues) {
      if (!name.startsWith('--dark-')) {
        continue;
      }
      const lightHue = hues.get(`--${name.slice('--dark-'.length)}`);
      expect(lightHue, `${name} has no light counterpart`).toBeDefined();
      pairs += 1;
      if (lightHue !== undefined && Math.abs(Number(lightHue) - Number(darkHue)) > 10) {
        drifted.push(`${name}: ${lightHue} vs ${darkHue}`);
      }
    }
    expect(pairs, 'expected a --dark-* counterpart palette').toBeGreaterThan(5);
    expect(
      drifted,
      `Dark palette must retune lightness, not hue. Drifted: ${drifted.join('; ')}`,
    ).toEqual([]);
  });

  it('keeps the two dark contexts identical, so a theme choice cannot drift', async () => {
    const css = stripComments(await readStyleBlock());
    const systemDark = /:root:not\(\[data-theme='light'\]\)\s*\{([^}]*)\}/u.exec(css)?.[1];
    const explicitDark = /:root\[data-theme='dark'\]\s*\{([^}]*)\}/u.exec(css)?.[1];
    expect(
      systemDark,
      'expected a system-dark override guarded against explicit light',
    ).toBeDefined();
    expect(explicitDark, 'expected an explicit-dark override').toBeDefined();

    const normalize = (block: string): string[] =>
      block
        .split(';')
        .map((line) => line.trim())
        .filter(Boolean)
        .sort();
    expect(
      normalize(explicitDark!),
      'The explicit and system dark blocks must declare exactly the same remaps',
    ).toEqual(normalize(systemDark!));

    // Pure remaps only: every declaration must reference a --dark-* token.
    for (const declaration of normalize(explicitDark!)) {
      expect(
        declaration,
        `Dark overrides must remap --dark-* tokens, not restate values: "${declaration}"`,
      ).toMatch(/var\(--dark-[\w-]+\)$/u);
    }
  });

  it('lets an explicit light choice win over a dark system preference', async () => {
    const css = stripComments(await readStyleBlock());
    const media = blockAfter(css, '@media (prefers-color-scheme: dark)');
    expect(media, 'expected a prefers-color-scheme: dark block').not.toBeNull();
    // Without the :not() guard, choosing light on a dark system would do nothing.
    expect(media).toContain(":root:not([data-theme='light'])");
  });

  it('reserves the update color and flash keyframes for data motion', async () => {
    const css = stripComments(await readStyleBlock());

    // Every rule that animates with the flash keyframes must be a data-motion selector.
    const flashRules = [...css.matchAll(/([^{}]+)\{[^}]*animation:\s*row-flash-[^;]*;/gu)].map(
      (match) => (match[1] ?? '').trim(),
    );
    expect(flashRules.length, 'expected the flash-in and flash-out rules').toBeGreaterThan(0);
    for (const selector of flashRules) {
      expect(
        /\.flash|\.leaving/u.test(selector),
        `Flash keyframes are data motion only; "${selector}" is not a data-motion selector`,
      ).toBe(true);
    }

    // The update background must not be reachable from a hover/focus/active state, which
    // are by definition UI interactions rather than observed data movement.
    const interactionRules = [
      ...css.matchAll(/([^{}]*:(?:hover|focus|active)[^{}]*)\{([^}]*)\}/gu),
    ];
    for (const [, selector, body] of interactionRules) {
      expect(
        (body ?? '').includes('--row-flash-bg'),
        `UI interaction "${(selector ?? '').trim()}" must not use the data-motion color`,
      ).toBe(false);
    }
  });

  it('honors prefers-reduced-motion for both motion families', async () => {
    const css = stripComments(await readStyleBlock());
    const block = blockAfter(css, '@media (prefers-reduced-motion: reduce)');
    expect(block, 'expected a prefers-reduced-motion block').not.toBeNull();
    expect(block).toContain('.flash');
    expect(block).toContain('.leaving');
  });

  it('drives motion from documented duration tokens', async () => {
    const css = stripComments(await readStyleBlock());
    expect(css).toContain('--motion-data-in');
    expect(css).toContain('--motion-data-out');
    expect(css).toContain('--transition-fast');
  });
});

describe('typography: monospace marks data, not chrome', () => {
  it('keeps counts and phase pills sans; only the data pill is monospace', async () => {
    const css = stripComments(await readStyleBlock());
    // The generic pill (counts, phase words) must not opt into monospace...
    const pillRule = /(?:^|\})\s*\.pill\s*\{([^}]*)\}/u.exec(css)?.[1] ?? '';
    expect(pillRule, 'expected a .pill rule').not.toBe('');
    expect(pillRule.includes('--mono'), '.pill is chrome and must stay sans').toBe(false);
    // ...while the tip pill (branch @ sha — actual data) must.
    const tipRule = /#tippill\s*\{([^}]*)\}/u.exec(css)?.[1] ?? '';
    expect(tipRule.includes('--mono'), '#tippill carries data values and must be mono').toBe(true);
  });

  it('renders the empty report state as chrome, not data', async () => {
    const css = stripComments(await readStyleBlock());
    const rule = /#report\.placeholder\s*\{([^}]*)\}/u.exec(css)?.[1] ?? '';
    expect(rule, 'expected the report placeholder rule').not.toBe('');
    expect(rule.includes('--sans'), 'the empty-state note is chrome and must be sans').toBe(true);
    expect(rule.includes('white-space: normal'), 'chrome prose wraps').toBe(true);
  });

  it('aligns stat counts with tabular figures instead of pretending they are data', async () => {
    const css = stripComments(await readStyleBlock());
    const numRule = /#stats td\.num,\s*#stats th\.num\s*\{([^}]*)\}/u.exec(css)?.[1] ?? '';
    expect(numRule, 'expected the stats number rule').not.toBe('');
    expect(numRule.includes('--mono')).toBe(false);
    expect(numRule.includes('tabular-nums')).toBe(true);
  });

  it('uses the shared medium weight for legible small-cap detail labels', async () => {
    const css = await readStyleBlock();
    const labelRule = blockAfter(css, '.blabel');
    expect(css).toContain('--weight-medium: 500');
    expect(labelRule).toContain('font-size: var(--font-size-small)');
    expect(labelRule).toContain('font-weight: var(--weight-medium)');
  });

  it('uses one compact font size instead of an ad-hoc small-type ladder', async () => {
    const css = await readStyleBlock();
    const declarations = withoutBaseRoot(stripComments(css)).match(/font-size:\s*[^;]+;/gu) ?? [];
    expect(css).toContain('--font-size-title: 15px');
    expect(css).toContain('--font-size-body: 14px');
    expect(css).toContain('--font-size-small: 12px');
    expect(declarations.every((declaration) => declaration.includes('var(--font-size-'))).toBe(
      true,
    );
    expect(blockAfter(css, '.section-heading')).toContain('font-size: var(--font-size-small)');
    expect(blockAfter(css, '#viewernote')).toContain('font-size: var(--font-size-small)');
  });

  it('baseline-aligns repository labels and values in an explicit grid', async () => {
    const css = await readStyleBlock();
    const listRule = blockAfter(css, '#statusdl');
    const termRule = blockAfter(css, '#statusdl dt');
    expect(listRule).toContain('display: grid');
    expect(listRule).toContain('align-items: baseline');
    expect(termRule).toContain('float: none');
    expect(termRule).toContain('margin: 0');
  });
});

describe('chevron icon system', () => {
  it('shares one comfortably padded chevron across selects and row disclosures', async () => {
    const [css, client, page] = await Promise.all([
      readStyleBlock(),
      readFile(clientPath, 'utf8'),
      readFile(pagePath, 'utf8'),
    ]);
    const chevronRule = blockAfter(css, '.chevron');
    const selectRule = blockAfter(css, '.select-control > select');
    const disclosureRule = blockAfter(css, '.disclosure');

    expect(chevronRule, 'expected one shared .chevron primitive').not.toBeNull();
    expect(chevronRule).toContain('width: var(--chevron-size)');
    expect(chevronRule).toContain('border-right: var(--chevron-stroke) solid currentColor');
    expect(chevronRule).toContain('border-bottom: var(--chevron-stroke) solid currentColor');
    expect(css).toContain('--chevron-stroke: 1.5px');
    expect(selectRule, 'expected custom select-arrow spacing').not.toBeNull();
    expect(selectRule).toContain('appearance: none');
    expect(selectRule).toContain('padding-right: var(--select-chevron-padding)');
    const selectChevronRule = blockAfter(css, '.select-control > .chevron');
    expect(selectChevronRule, 'expected an inset chooser chevron').not.toBeNull();
    expect(selectChevronRule).toContain('right: var(--select-chevron-inset)');
    expect(disclosureRule, 'expected a stable disclosure line box').not.toBeNull();
    expect(disclosureRule).toContain('place-items: center');

    expect(page.match(/class="select-control"/gu)).toHaveLength(3);
    expect(page.match(/class="chevron chevron-down"/gu)).toHaveLength(4);
    expect(client).toContain("disclosure.setAttribute('aria-expanded', String(open))");
    expect(client).toContain("chevron.className = `chevron chevron-${open ? 'down' : 'right'}`");
    expect(client).not.toMatch(/[▸▾]/u);
  });

  it('routes every board-row click through one toggle path', async () => {
    const client = await readFile(clientPath, 'utf8');
    expect(client).toContain("tableRow.addEventListener('click', () => {");
    expect(client).toContain('store.toggle(row.id)');
    expect(client).not.toContain("disclosure.addEventListener('click'");
  });

  it('baseline-aligns mixed row typography and centers disclosure in the shared line box', async () => {
    const css = await readStyleBlock();
    const cellRule = blockAfter(css, 'td');
    const caretRule = blockAfter(css, 'td.caret');
    const disclosureRule = blockAfter(css, '.disclosure');

    expect(css).toContain('--board-row-line-height: 18px');
    expect(css).toContain('--row-disclosure-offset-y: 1px');
    expect(cellRule).toContain('vertical-align: baseline');
    expect(caretRule).toContain('vertical-align: top');
    expect(disclosureRule).toContain('height: var(--board-row-line-height)');
    expect(disclosureRule).toContain('transform: translateY(var(--row-disclosure-offset-y))');
  });

  it('keeps icon-only controls quiet until hover, focus, or open state', async () => {
    const [css, page] = await Promise.all([readStyleBlock(), readFile(pagePath, 'utf8')]);
    const buttonRule = blockAfter(css, '.icon-button');
    const hoverRule = blockAfter(
      css,
      ".icon-button:hover,\n.icon-button:focus-visible,\n.icon-button[aria-expanded='true']",
    );
    expect(buttonRule, 'expected one icon-only button primitive').not.toBeNull();
    expect(buttonRule).toContain('border: 1px solid transparent');
    expect(buttonRule).toContain('background: transparent');
    expect(hoverRule, 'expected icon buttons to surface on interaction').not.toBeNull();
    expect(hoverRule).toContain('background: var(--panel)');
    expect(hoverRule).toContain('border-color: var(--border)');
    expect(page.match(/class="icon-button"/gu)).toHaveLength(3);
  });
});

describe('literal copy affordance', () => {
  it('reveals one accessible copy primitive for commands and literal values', async () => {
    const [css, client, page] = await Promise.all([
      readStyleBlock(),
      readFile(clientPath, 'utf8'),
      readFile(pagePath, 'utf8'),
    ]);
    const buttonRule = blockAfter(css, '.copy-button');
    const revealRule = blockAfter(
      css,
      '.copyable:hover > .copy-button,\n.copyable:focus-within > .copy-button,\n.copy-button.copied,\n.copy-button.copy-failed',
    );
    expect(buttonRule).toContain('opacity: 0');
    expect(buttonRule).toContain('pointer-events: none');
    expect(buttonRule).toContain('color: var(--muted)');
    expect(revealRule).toContain('opacity: 1');
    expect(revealRule).toContain('pointer-events: auto');
    expect(client).toContain('navigator.clipboard.writeText(copyValueFor(button))');
    expect(client).toContain('event.stopPropagation()');
    expect(client).toContain("button.classList.add('copy-suppressed')");
    expect(client).toContain('{ capture: true }');
    expect(client).toContain("document.addEventListener('animationend'");
    expect(client).toContain("document.addEventListener('pointerover', revealCopyButton)");
    const copyFactory = client.slice(
      client.indexOf('function copyButton('),
      client.indexOf('function copyButtonFrom('),
    );
    expect(copyFactory).not.toContain('addEventListener');
    expect(client).not.toContain("document.createElementNS('http://www.w3.org/2000/svg'");
    expect(buttonRule).toContain('--copy-active-icon: var(--copy-icon)');
    expect(blockAfter(css, '.copy-button::before')).toContain('mask: var(--copy-active-icon)');
    expect(blockAfter(css, '.copy-button.copied')).toContain(
      '--copy-active-icon: var(--copy-complete-icon)',
    );
    expect(
      blockAfter(
        css,
        '.copyable:hover > .copy-button.copy-suppressed,\n.copyable:focus-within > .copy-button.copy-suppressed,\n.copy-surface:hover > .copy-button.copy-suppressed,\n.copy-surface:focus-within > .copy-button.copy-suppressed',
      ),
    ).toContain('opacity: 0');
    expect(css).toContain('M11 15l2 2 5-5');
    expect(css).toContain('--copy-feedback-duration: 1500ms');
    expect(blockAfter(css, '@keyframes copy-feedback')).toContain('67%');
    expect(blockAfter(css, '@keyframes copy-feedback')).not.toContain('color:');
    expect(client).toContain("setCopyableText(idCell, row.id, 'bead ID')");
    expect(client).toContain("setCopyableText(description, value, 'repository status value')");
    expect(client).toContain("setCopyableText(elements.command, board.command, 'command')");
    expect(page).toContain('data-copy-value="tbd status"');
    expect(page).toContain('data-copy-value="tbd stats"');
  });
});

describe('semantic color and component roles', () => {
  it('uses the shared CLI status symbols in board rows, stats, and the status chooser', async () => {
    const [client, page, statusIcons] = await Promise.all([
      readFile(clientPath, 'utf8'),
      readFile(pagePath, 'utf8'),
      readFile(statusIconPath, 'utf8'),
    ]);

    expect(statusIcons).toContain("open: '\u25cb'");
    expect(statusIcons).toContain("in_progress: '\u25d0'");
    expect(statusIcons).toContain("blocked: '\u25cf'");
    expect(statusIcons).toContain("deferred: '\u25cb'");
    expect(statusIcons).toContain("closed: '\u2713'");
    expect(client).toContain("import { STATUS_ICONS } from '../lib/status-icons.js'");
    expect(client).not.toContain('const STATUS_ICON');
    expect(client).toContain('`issue-status status-${status}`');
    expect(client).toContain('STATUS_ICONS[status]');
    expect(client).toContain('option.textContent =');
    expect(client).toContain('STATUS_ICONS[option.value]');
    expect(page).not.toMatch(/[\u25cb\u25d0\u25cf\u2713]/u);
  });

  it('maps lifecycle and priority semantics to the same restrained families as the CLI', async () => {
    const css = await readStyleBlock();
    expect(blockAfter(css, '.status-open')).toContain('color: var(--info)');
    expect(blockAfter(css, '.status-in_progress')).toContain('color: var(--success)');
    expect(blockAfter(css, '.status-blocked')).toContain('color: var(--error)');
    expect(blockAfter(css, '.status-deferred')).toContain('color: var(--muted)');
    expect(blockAfter(css, '.status-closed')).toContain('color: var(--muted)');
    expect(blockAfter(css, '.priority-0')).toContain('color: var(--error)');
    expect(blockAfter(css, '.priority-1')).toContain('color: var(--warning)');
    expect(blockAfter(css, '.tag.ready')).toContain('color: var(--success)');
  });

  it('reuses table semantic classes in the native filter choosers', async () => {
    const [css, client] = await Promise.all([readStyleBlock(), readFile(clientPath, 'utf8')]);
    expect(client).toContain('option.classList.add(`status-${option.value}`)');
    expect(client).toContain('option.classList.add(`priority-${option.value}`)');
    expect(client).toContain("option.classList.add('kind-choice')");
    expect(client).toContain('syncChooserSemantics()');
    expect(blockAfter(css, '.kind-choice')).toContain('color: var(--muted)');
  });

  it('keeps aggregate header metadata plain and reserves enclosures for bounded states', async () => {
    const [css, client, page] = await Promise.all([
      readStyleBlock(),
      readFile(clientPath, 'utf8'),
      readFile(pagePath, 'utf8'),
    ]);
    const metadataRule = blockAfter(css, '.header-meta');
    expect(metadataRule, 'expected a plain header metadata role').not.toBeNull();
    expect(metadataRule).toContain('font-size: var(--font-size-small)');
    expect(metadataRule).toContain('font-variant-numeric: tabular-nums');
    expect(metadataRule).not.toContain('border:');
    expect(metadataRule).not.toContain('padding:');
    expect(page).toContain('<span class="header-meta" id="countmeta">0 beads</span>');
    expect(page).not.toContain('class="pill" id="countpill"');
    expect(client).toContain("countMeta: byId('countmeta', HTMLSpanElement)");
  });

  it('does not manufacture extra auxiliary-text grays with opacity', async () => {
    const css = await readStyleBlock();
    const hintRule = blockAfter(css, '.hint');
    const eventTimeRule = blockAfter(css, '#log time');
    expect(hintRule).toContain('color: var(--muted)');
    expect(hintRule).not.toContain('opacity:');
    expect(eventTimeRule).toContain('color: var(--muted)');
    expect(eventTimeRule).not.toContain('opacity:');
  });
});

describe('tree-title layout', () => {
  it('uses one continuous glyph geometry for first-line and wrapped ancestor verticals', async () => {
    const [css, client] = await Promise.all([readStyleBlock(), readFile(clientPath, 'utf8')]);
    const contentRule = blockAfter(css, '.title-content');
    const textRule = blockAfter(css, '.title-text');
    expect(contentRule, 'expected a wrapper that owns the hanging indent').not.toBeNull();
    expect(contentRule).toContain('display: flex');
    expect(textRule, 'expected a separately wrapping title span').not.toBeNull();
    expect(textRule).toContain('min-width: 0');
    expect(blockAfter(css, '.guide')).toContain('color: var(--muted)');
    const continuationRule = blockAfter(css, '.tree-continuation');
    expect(continuationRule).toContain('top: 0');
    expect(continuationRule).toContain('border-left: 1px solid var(--muted)');
    expect(client).toContain("titleContent.className = 'title-content'");
    expect(client).toContain('treeContinuationColumns(row.prefix)');
    expect(client).toContain('guide.textContent = treeGuideText(row.prefix)');
    expect(client).toContain("titleText.className = 'title-text'");
    expect(client).not.toContain('title.append(document.createTextNode(row.title))');
  });

  it('clamps collapsed summaries at four lines and reveals the full title when open', async () => {
    const css = await readStyleBlock();
    const textRule = blockAfter(css, '.title-text');
    const openTextRule = blockAfter(css, 'tr.open .title-text');
    expect(textRule).toContain('-webkit-line-clamp: 4');
    expect(textRule).toContain('overflow: hidden');
    expect(openTextRule).toContain('-webkit-line-clamp: unset');
    expect(openTextRule).toContain('overflow: visible');
  });
});

describe('tag-column layout', () => {
  it('keeps ready with labels while wrapping only complete tags in a wider column', async () => {
    const [css, client, page] = await Promise.all([
      readStyleBlock(),
      readFile(clientPath, 'utf8'),
      readFile(pagePath, 'utf8'),
    ]);
    const labelsColumnRule = blockAfter(css, '.board-col-labels');
    const titleColumnRule = blockAfter(css, '.board-col-title');
    const clusterRule = blockAfter(css, '.tag-cluster');
    const tagRule = blockAfter(css, '.tag');
    expect(labelsColumnRule).toContain('width: var(--board-labels-column-width)');
    expect(titleColumnRule).toContain('width: var(--board-title-column-width)');
    expect(css).toContain('--board-title-column-width: 29%');
    expect(css).toContain('--board-labels-column-width: 22%');
    expect(clusterRule).toContain('display: flex');
    expect(clusterRule).toContain('flex-wrap: wrap');
    expect(tagRule).toContain('white-space: nowrap');
    expect(client).toContain("appendCell(tableRow, '', 'labels')");
    expect(client).toContain("cluster.className = 'tag-cluster'");
    expect(page).toContain('<th class="labels" data-sort-key="labels">');
  });
});

describe('updated-time and fixed-column system', () => {
  it('renders one semantic updated column with exact time metadata and blue age tiers', async () => {
    const [css, client, page] = await Promise.all([
      readStyleBlock(),
      readFile(clientPath, 'utf8'),
      readFile(pagePath, 'utf8'),
    ]);
    const boardRule = blockAfter(css, '.board-table');
    expect(boardRule).toContain('table-layout: fixed');
    expect(boardRule).toContain('min-width: 820px');
    expect(page).toContain('<colgroup>');
    expect(page).toContain('<col class="board-col-title" />');
    expect(page).toContain('<col class="board-col-updated" />');
    expect(page).toContain('<col class="board-col-labels" />');
    expect(page).toContain('<th class="updated" data-sort-key="updated">');
    expect(client).toContain('time.className = `updated-age age-${age.tier}`');
    expect(client).toContain('time.dateTime = age.exact');
    expect(client).toContain('time.title = age.exact');
    expect(client).toContain('window.setInterval(updateRelativeTimes, RELATIVE_TIME_REFRESH_MS)');
    expect(blockAfter(css, '.updated-age')).toContain('font-family: var(--mono)');
    for (const tier of ['sec', 'min', 'hr', 'day', 'wk', 'old']) {
      expect(css).toContain(`--age-${tier}: hsl(`);
      expect(css).toContain(`--dark-age-${tier}: hsl(`);
      expect(blockAfter(css, `.age-${tier}`)).toContain(`color: var(--age-${tier})`);
    }
  });

  it('keeps expansion and paging inside the complete eight-column grid', async () => {
    const client = await readFile(clientPath, 'utf8');
    expect(client).toContain('cell.colSpan = 7');
    expect(client).toContain('cell.colSpan = 8');
    expect(client).not.toContain('cell.colSpan = 6');
  });
});

describe('dynamic label chooser', () => {
  it('renders a counted accessible multi-chooser capped by the server at 32 facets', async () => {
    const [css, client, page] = await Promise.all([
      readStyleBlock(),
      readFile(clientPath, 'utf8'),
      readFile(pagePath, 'utf8'),
    ]);
    expect(page).toContain('id="labelchooser"');
    expect(page).toContain('id="labeltrigger"');
    expect(page).toContain('id="labelmenu"');
    expect(page).not.toContain('<input id="label"');
    expect(page).toContain('aria-label="Labels; all selected labels are required"');
    expect(page).toContain('aria-label="Filter by every selected label"');
    expect(client).toContain("row.setAttribute('role', 'menuitemcheckbox')");
    expect(client).toContain("count.className = 'label-choice-count'");
    expect(client).toContain("name.className = 'tag label-choice-tag'");
    expect(client).toContain('selectedLabels');
    expect(blockAfter(css, '.label-chooser-menu')).toContain('max-height: 320px');
    expect(blockAfter(css, '.label-choice-count')).toContain('font-variant-numeric: tabular-nums');
  });
});

describe('composable board sorting', () => {
  it('makes every data-column header an accessible sort control and removes the old chooser', async () => {
    const [css, client, page] = await Promise.all([
      readStyleBlock(),
      readFile(clientPath, 'utf8'),
      readFile(pagePath, 'utf8'),
    ]);
    for (const key of ['id', 'priority', 'status', 'kind', 'title', 'updated', 'labels']) {
      expect(page).toContain(`data-sort-key="${key}"`);
    }
    expect(page).not.toContain('id="sort"');
    expect(client).toContain('promoteBoardSort(view.controls.sorts, key)');
    expect(client).toContain('elements.pretty.checked = false');
    expect(client).toContain('if (elements.pretty.checked)');
    expect(client).toContain('activeSorts = []');
    expect(client).toMatch(/header\.setAttribute\(\s*'aria-sort'/u);
    expect(blockAfter(css, '.sort-button')).toContain('font: inherit');
    expect(blockAfter(css, '.sort-indicator')).toContain('font-variant-numeric: tabular-nums');
  });
});

describe('chrome ownership', () => {
  it('keeps viewer guidance with the title and the equivalent command with filters', async () => {
    const [css, page] = await Promise.all([readStyleBlock(), readFile(pagePath, 'utf8')]);
    expect(page).toMatch(
      /<div class="header-identity">[\s\S]*<h1>tbd beads<\/h1>[\s\S]*id="viewernote"[\s\S]*<\/div>/u,
    );
    expect(page).toMatch(
      /<section id="controls"[\s\S]*<div id="toolbar">[\s\S]*<h2 id="boardheading" class="section-heading">[\s\S]*id="cmd"[\s\S]*<\/section>/u,
    );
    expect(page).not.toContain('equivalent:');
    expect(page).toMatch(
      /<h2 class="section-heading">\s*Status\s*<span class="hint" data-copy-value="tbd status"/u,
    );
    expect(blockAfter(css, '.section-heading')).toContain('font-family: var(--sans)');
    expect(blockAfter(css, '#boardheading')).not.toContain('background: var(--panel)');
    expect(blockAfter(css, '#cmd')).toContain('font-family: var(--mono)');
    expect(blockAfter(css, '#viewernote')).toContain('color: var(--muted)');
  });

  it('baseline-aligns the title and aggregate tally on one identity line', async () => {
    const [css, page] = await Promise.all([readStyleBlock(), readFile(pagePath, 'utf8')]);
    const titleLineRule = blockAfter(css, '.header-title-line');
    expect(titleLineRule).toContain('display: flex');
    expect(titleLineRule).toContain('align-items: baseline');
    expect(page).toMatch(
      /<div class="header-title-line">[\s\S]*<h1>tbd beads<\/h1>[\s\S]*id="countmeta"[\s\S]*<\/div>/u,
    );
  });
});

describe('expanded-row emphasis', () => {
  it('bolds only the bead ID and aligns detail to its structural column', async () => {
    const [css, client] = await Promise.all([readStyleBlock(), readFile(clientPath, 'utf8')]);
    const openIdentityRule = blockAfter(css, 'tr.open > td.id');
    const openRowRule = blockAfter(css, 'tr.open > td');
    const bodyRule = blockAfter(css, 'tr.bodyrow > td.body-cell');

    expect(openIdentityRule).toContain('font-weight: var(--weight-strong)');
    expect(css).not.toContain('tr.open > td.title');
    expect(openRowRule).not.toContain('font-weight:');
    expect(bodyRule).not.toContain('background: var(--panel)');
    expect(bodyRule).toContain('padding-left: 10px');
    expect(client).toContain("appendCell(bodyRow, '', 'caret')");
    expect(client).toContain("appendCell(bodyRow, '', 'body-cell')");
    expect(client).toContain('cell.colSpan = 7');
    expect(client).toContain("const title = appendCell(tableRow, '', 'title')");
  });
});

describe('bulk expansion affordance', () => {
  it('shows only a working, accurately page-scoped Expand all or Collapse all action', async () => {
    const [client, page] = await Promise.all([
      readFile(clientPath, 'utf8'),
      readFile(pagePath, 'utf8'),
    ]);
    expect(page).toContain('<button id="expandall" hidden>Expand all</button>');
    expect(client).toContain(
      'elements.expandAll.hidden = page.rows.length === 0 || !canBulkExpand',
    );
    expect(client).toContain("allOpen ? 'Collapse all' : 'Expand all'");
    expect(client).toContain("'Expand or collapse every bead on this page.'");
    expect(client).not.toContain('every bead in the current result');
    expect(client).not.toContain('Expand individually');
    expect(client).not.toContain('Expand page');
    expect(client).not.toContain('Collapse page');
  });
});

describe('live-change marker', () => {
  it('keeps the marker adjacent to the literal bead ID, before reserved copy space', async () => {
    const css = await readStyleBlock();
    const markerRule = blockAfter(css, 'tr.changed td.id .copy-value::after');

    expect(markerRule).toContain("content: ' ●'");
    expect(markerRule).toContain('color: var(--update)');
    expect(css).not.toContain('tr.changed td.id::after');
  });
});

describe('scrollbar design system', () => {
  it('uses subtle token-based scrollbars on every scroll container and matches panel surfaces', async () => {
    const css = await readStyleBlock();
    const globalRule = blockAfter(css, '*');
    const thumbRule = blockAfter(css, '*::-webkit-scrollbar-thumb');
    const preRule = blockAfter(css, 'pre');

    expect(css).toContain('--scrollbar-width: 10px');
    expect(globalRule).toContain('scrollbar-width: thin');
    expect(globalRule).toContain('scrollbar-color: var(--scrollbar-thumb) var(--scrollbar-bg)');
    expect(thumbRule).toContain(
      'border: var(--scrollbar-thumb-border-width) solid var(--scrollbar-bg)',
    );
    expect(preRule).toContain('--scrollbar-bg: var(--panel)');
  });
});

describe('UI motion system', () => {
  it('uses the fast token for interactive transitions and disables it for reduced motion', async () => {
    const css = await readStyleBlock();
    expect(css).not.toContain('transition: all');
    expect(blockAfter(css, '.pill')).toContain('color var(--transition-fast)');
    expect(blockAfter(css, 'tbody tr:not(.bodyrow):not(.board-page-row)')).toContain(
      'background-color var(--transition-fast)',
    );
    expect(blockAfter(css, '.copy-button')).toContain('opacity var(--transition-fast)');
    expect(blockAfter(css, '@media (prefers-reduced-motion: reduce)')).toContain(
      '--motion-fast-duration: 1ms',
    );
  });
});

describe('observer header status', () => {
  it('keeps one connection/watcher pill and moves update count into its tooltip', async () => {
    const [client, page] = await Promise.all([
      readFile(clientPath, 'utf8'),
      readFile(pagePath, 'utf8'),
    ]);
    expect(page).not.toContain('id="updatepill"');
    expect(client).not.toContain('updatePill');
    expect(client).toContain('Connected to the viewer server. ${phase.help}');
    expect(client).toContain("elements.observerPill.textContent = 'disconnected'");
  });
});

describe('Boolean controls', () => {
  it('renders --pretty as a checkbox while leaving actions as buttons', async () => {
    const [client, page] = await Promise.all([
      readFile(clientPath, 'utf8'),
      readFile(pagePath, 'utf8'),
    ]);
    expect(page).toMatch(
      /<label class="check" title="--pretty"[\s\S]*?<input type="checkbox" id="pretty" checked \/> pretty[\s\S]*?<\/label\s*>/u,
    );
    expect(page).not.toContain('id="pretty" class="on"');
    expect(page).not.toMatch(/id="ready"[\s\S]*?class="grow"[\s\S]*?id="pretty"/u);
    expect(client).toContain("pretty: byId('pretty', HTMLInputElement)");
    expect(client).toContain('pretty: elements.pretty.checked');
    expect(client).not.toContain("elements.pretty.addEventListener('click'");
    expect(client).not.toContain("elements.pretty.classList.toggle('on'");
  });
});
