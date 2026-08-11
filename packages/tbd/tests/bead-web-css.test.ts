/**
 * Enforces the design-system rules documented at the top of `src/web/styles.css`.
 *
 * Two rules carry real weight:
 *
 * 1. Color literals live only in the `:root` blocks, so a theme can be retuned in one
 *    place and light/dark cannot drift apart.
 * 2. Data motion and UI motion never mix. Highlighting a row amber because a filter
 *    revealed it tells the reader that something changed upstream when nothing did, so
 *    the wake color and the flash keyframes are reserved for observed data movement.
 *
 * A comment saying so is not enforcement; these assertions are.
 */

import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const packageDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const stylePath = join(packageDir, 'src', 'web', 'styles.css');

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
  const selectorIndex = css.indexOf(selector);
  if (selectorIndex < 0) {
    return null;
  }
  const openIndex = css.indexOf('{', selectorIndex + selector.length);
  if (openIndex < 0) {
    return null;
  }
  let depth = 1;
  for (let index = openIndex + 1; index < css.length; index += 1) {
    if (css[index] === '{') {
      depth += 1;
    } else if (css[index] === '}') {
      depth -= 1;
      if (depth === 0) {
        return css.slice(openIndex + 1, index);
      }
    }
  }
  return null;
}

describe('bead-web design system', () => {
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

  it('reserves the wake color and flash keyframes for data motion', async () => {
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

    // The wake background must not be reachable from a hover/focus/active state, which
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
});
