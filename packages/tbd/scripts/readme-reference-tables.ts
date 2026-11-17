/**
 * The README's reference tables of bundled shortcuts, guidelines, and templates.
 *
 * Each table is rendered from the frontmatter (`description`, `category`) of the
 * documents under packages/tbd/docs into a marked region of the committed README.md, so
 * the names, one-line descriptions, and counts cannot drift from what the package ships.
 * Guidelines are grouped exactly as the generated skill directory groups them
 * (`guidelineGroupFor` in src/file/doc-cache.ts, in that directory's order); shortcuts
 * are grouped by their declared category, the field `tbd shortcut --category` filters on.
 *
 * scripts/generate-readme-tables.ts (`pnpm --filter get-tbd generate:readme`) writes
 * the regions, and tests/readme-reference-tables.test.ts fails when the committed
 * regions are stale. Generation is deliberately not part of `pnpm build`: CI builds
 * before it tests, so a build that rewrote README.md would let a stale commit pass the
 * drift test, and the packaged proofs (validate-upgrade-package.mjs,
 * validate-web-package.mjs) require the source checkout to be unchanged across a build.
 *
 * The output is flowmark-canonical (curly quotes, blank lines around each table, no
 * prose line long enough to wrap), so the Markdown formatter never rewrites what the
 * generator wrote and the two cannot fight.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { CachedDoc } from '../src/file/doc-cache.js';
import { generateShortcutDirectory, guidelineGroupFor } from '../src/file/doc-cache.js';
import { parseMarkdownMatter } from '../src/utils/gray-matter.js';

export const REFERENCE_KINDS = ['shortcuts', 'guidelines', 'templates'] as const;
export type ReferenceKind = (typeof REFERENCE_KINDS)[number];

export const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
export const README_PATH = join(REPO_ROOT, 'README.md');

/** Where each kind's documents live, relative to the repository root. */
export const REFERENCE_DIRS: Record<ReferenceKind, string> = {
  shortcuts: 'packages/tbd/docs/shortcuts/standard',
  guidelines: 'packages/tbd/docs/guidelines',
  templates: 'packages/tbd/docs/templates',
};

export const REGENERATE_COMMAND = 'pnpm --filter get-tbd generate:readme';

/**
 * Longest description a table cell keeps whole, in characters. Longer descriptions are
 * cut at a clause boundary. A cell this long renders as about three lines of a
 * three-column table on GitHub, and it keeps a two-sentence summary such as
 * `address-pr-review`'s (which names the four dispositions) intact.
 */
export const SUMMARY_BUDGET = 240;

/**
 * Display order of shortcut categories. The categories themselves come from each
 * shortcut's frontmatter; a category not listed here is appended alphabetically.
 */
const SHORTCUT_CATEGORY_ORDER = [
  'planning',
  'documentation',
  'testing',
  'review',
  'git',
  'cleanup',
  'session',
  'workflow',
  'research',
  'meta',
];

const TABLE_COLUMNS: Record<ReferenceKind, string[]> = {
  shortcuts: ['Category', 'Shortcut', 'Purpose'],
  guidelines: ['Group', 'Guideline', 'What it covers'],
  templates: ['Template', 'Description'],
};

export interface ReferenceDoc {
  name: string;
  /** Path relative to the repository root; the table links to it. */
  path: string;
  description: string;
  category?: string;
}

interface DocGroup {
  label: string;
  docs: ReferenceDoc[];
}

/** Codepoint order: `localeCompare` can differ between the machines that generate and check. */
const compareStrings = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** The bundled documents of one kind, in name order. */
export function loadReferenceDocs(kind: ReferenceKind, repoRoot = REPO_ROOT): ReferenceDoc[] {
  const dir = REFERENCE_DIRS[kind];
  const names = readdirSync(join(repoRoot, dir))
    .filter((file) => file.endsWith('.md'))
    .map((file) => file.slice(0, -'.md'.length))
    .sort(compareStrings);
  if (names.length === 0) {
    throw new Error(`no ${kind} found under ${dir}`);
  }
  return names.map((name) => {
    const path = `${dir}/${name}.md`;
    const { data } = parseMarkdownMatter(readFileSync(join(repoRoot, path), 'utf-8'));
    const description = typeof data.description === 'string' ? data.description.trim() : '';
    if (description === '') {
      throw new Error(`${path} has no frontmatter description for its README table row`);
    }
    return {
      name,
      path,
      description,
      category: typeof data.category === 'string' ? data.category : undefined,
    };
  });
}

/**
 * A one-cell summary of a description: the whole text when it fits the budget,
 * otherwise the longest prefix that ends at a clause boundary (a sentence end,
 * semicolon, or colon followed by a space, or an em dash) within the budget, or the
 * shortest such prefix when none fits. Boundaries inside parentheses and after "e.g."
 * or "i.e." do not count. Trailing punctuation is dropped so every cell ends alike.
 */
export function summarize(description: string): string {
  const text = description.trim();
  const finish = (summary: string): string => summary.replace(/[.;:—]\s*$/u, '').trim();
  if (text.length <= SUMMARY_BUDGET) {
    return finish(text);
  }
  const boundaries: number[] = [];
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text[i]!;
    if (char === '(') {
      depth++;
    } else if (char === ')') {
      depth = Math.max(0, depth - 1);
    }
    if (depth > 0) {
      continue;
    }
    if (char === '—') {
      boundaries.push(i);
    } else if ((char === '.' || char === ';' || char === ':') && text[i + 1] === ' ') {
      if (char === '.' && /(?:^|\s)(?:e\.g|i\.e)$/u.test(text.slice(0, i))) {
        continue;
      }
      boundaries.push(i);
    }
  }
  const fitting = boundaries.filter((at) => at <= SUMMARY_BUDGET);
  const cut = fitting.length > 0 ? fitting[fitting.length - 1] : boundaries[0];
  return finish(cut === undefined ? text : text.slice(0, cut));
}

/**
 * The text as flowmark writes it, so formatting the README never changes a generated
 * cell: apostrophes and quotation marks become their typographic forms, and any
 * character sequence flowmark would still rewrite is an error rather than a fight.
 */
export function typeset(text: string): string {
  const typeset = text.replace(/(\w)'(\w)/gu, '$1’$2').replace(/"([^"]*)"/gu, '“$1”');
  const stray = /['"]|\.\.\./u.exec(typeset);
  if (stray) {
    throw new Error(`"${stray[0]}" is not flowmark-canonical in: ${text}`);
  }
  return typeset;
}

function summaryCell(doc: ReferenceDoc): string {
  try {
    return typeset(summarize(doc.description)).replace(/\|/gu, '\\|');
  } catch (error: unknown) {
    throw new Error(`${doc.path}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

const link = (doc: ReferenceDoc): string => `[\`${doc.name}\`](${doc.path})`;

function shortcutGroups(docs: ReferenceDoc[]): DocGroup[] {
  const byCategory = new Map<string, ReferenceDoc[]>();
  for (const doc of docs) {
    const category = doc.category ?? 'other';
    byCategory.set(category, [...(byCategory.get(category) ?? []), doc]);
  }
  const rank = (category: string): number => {
    const index = SHORTCUT_CATEGORY_ORDER.indexOf(category);
    return index === -1 ? SHORTCUT_CATEGORY_ORDER.length : index;
  };
  return [...byCategory.keys()]
    .sort((a, b) => rank(a) - rank(b) || compareStrings(a, b))
    .map((category) => ({
      label: category.charAt(0).toUpperCase() + category.slice(1),
      docs: byCategory.get(category)!,
    }));
}

function guidelineGroups(docs: ReferenceDoc[]): DocGroup[] {
  const byHeading = new Map<string, ReferenceDoc[]>();
  for (const doc of docs) {
    const heading = guidelineGroupFor(doc.name, doc.category);
    byHeading.set(heading, [...(byHeading.get(heading) ?? []), doc]);
  }
  // The skill directory renders the groups in the CLI's order, which is not exported on
  // its own; reading the order from that rendering keeps this the only grouping.
  const cached: CachedDoc[] = docs.map((doc) => ({
    name: doc.name,
    path: doc.path,
    content: '',
    sourceDir: 'guidelines',
    sizeBytes: 0,
    approxTokens: 0,
    frontmatter: { category: doc.category },
  }));
  const order = [...generateShortcutDirectory([], cached).matchAll(/^### (.+)$/gmu)].map(
    (match) => match[1]!,
  );
  const groups = order
    .filter((heading) => byHeading.has(heading))
    .map((heading) => ({ label: heading, docs: byHeading.get(heading)! }));
  const grouped = groups.reduce((count, group) => count + group.docs.length, 0);
  if (grouped !== docs.length) {
    throw new Error(
      `the skill directory lists ${order.length} guideline groups but ${docs.length - grouped} guidelines fall outside them`,
    );
  }
  return groups;
}

function groupedRows(groups: DocGroup[]): string[] {
  return groups.flatMap(({ label, docs }) =>
    docs.map(
      (doc, index) =>
        `| ${index === 0 ? `**${label}**` : ''} | ${link(doc)} | ${summaryCell(doc)} |`,
    ),
  );
}

function tableRows(kind: ReferenceKind, docs: ReferenceDoc[]): string[] {
  switch (kind) {
    case 'shortcuts':
      return groupedRows(shortcutGroups(docs));
    case 'guidelines':
      return groupedRows(guidelineGroups(docs));
    case 'templates':
      return docs.map((doc) => `| ${link(doc)} | ${summaryCell(doc)} |`);
    default: {
      const _exhaustive: never = kind;
      throw new Error(`Unhandled reference kind: ${String(_exhaustive)}`);
    }
  }
}

export const beginMarker = (kind: ReferenceKind): string =>
  `<!-- BEGIN GENERATED ${kind} (regenerate: ${REGENERATE_COMMAND}) -->`;
export const endMarker = (kind: ReferenceKind): string => `<!-- END GENERATED ${kind} -->`;

/** The full marked region for one kind: markers, the count line, and the table. */
export function renderReferenceRegion(kind: ReferenceKind, docs: ReferenceDoc[]): string {
  const columns = TABLE_COLUMNS[kind];
  return [
    beginMarker(kind),
    '',
    `**Available ${kind} (${docs.length}):**`,
    '',
    `| ${columns.join(' | ')} |`,
    `| ${columns.map(() => '---').join(' | ')} |`,
    ...tableRows(kind, docs),
    '',
    endMarker(kind),
  ].join('\n');
}

/** Every region, rendered from the bundled docs. */
export function renderAllRegions(repoRoot = REPO_ROOT): Record<ReferenceKind, string> {
  const render = (kind: ReferenceKind): string =>
    renderReferenceRegion(kind, loadReferenceDocs(kind, repoRoot));
  return {
    shortcuts: render('shortcuts'),
    guidelines: render('guidelines'),
    templates: render('templates'),
  };
}

const regionPattern = (kind: ReferenceKind): RegExp =>
  new RegExp(
    `^<!-- BEGIN GENERATED ${kind}\\b[^\\n]*-->\\n[\\s\\S]*?^<!-- END GENERATED ${kind} -->$`,
    'gmu',
  );

/** The marked region for `kind` in a README (LF line endings), which must occur once. */
export function findRegion(readme: string, kind: ReferenceKind): string {
  const matches = [...readme.matchAll(regionPattern(kind))];
  if (matches.length !== 1) {
    throw new Error(
      `README.md must contain exactly one GENERATED ${kind} region, found ${matches.length}`,
    );
  }
  return matches[0]![0];
}

/** The README (LF line endings) with every marked region replaced by its rendering. */
export function updateReadme(readme: string, regions: Record<ReferenceKind, string>): string {
  let updated = readme;
  for (const kind of REFERENCE_KINDS) {
    findRegion(updated, kind);
    updated = updated.replace(regionPattern(kind), () => regions[kind]);
  }
  return updated;
}
