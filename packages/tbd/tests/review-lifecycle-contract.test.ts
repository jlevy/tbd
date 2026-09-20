/**
 * Contract tests for the PR review lifecycle and sub-agent delegation docs.
 *
 * `pr-review-workflows` is the single definition of the review-state contract: the
 * review and disposition markers, the review kinds, the four dispositions, and the
 * one-round default with its ask-before-another-round rule. The review shortcuts apply
 * that contract, `review-and-merge-prs` holds the one full merge gate, every skill tier
 * and the README request table route the request vocabulary to those shortcuts, and
 * `agent-model-tiers` defines the tiers the review roles use.
 *
 * These tests pin that structure in the source docs under packages/tbd/docs and the
 * README the package also ships, so they need no build. Prose is collapsed to single
 * spaces before phrase checks, so reflowing
 * a paragraph does not break them; wherever possible they assert structure (table
 * columns, marker fields, references) rather than sentences.
 *
 * Plan: docs/project/specs/active/plan-2026-09-16-pr-review-lifecycle-and-agent-delegation.md
 * (Testing Strategy > Contract tests).
 */

import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DOCS_DIR = join(__dirname, '..', 'docs');
const STANDARD_DIR = join(DOCS_DIR, 'shortcuts', 'standard');
const SYSTEM_DIR = join(DOCS_DIR, 'shortcuts', 'system');
const GUIDELINES_DIR = join(DOCS_DIR, 'guidelines');
const README_PATH = join(__dirname, '..', '..', '..', 'README.md');

const REVIEW_KINDS = ['senior', 'security', 'performance', 'correctness', 'follow-up'];
const DEDICATED_KINDS = ['security', 'performance', 'correctness'];
const DISPOSITIONS = ['fixed', 'rebutted', 'declined', 'deferred'];
const TIERS = ['strong', 'moderate', 'fast'];
const MARKER_FIELDS: Record<string, string[]> = {
  review: ['v', 'id', 'kind', 'pr', 'round', 'head', 'base'],
  dispositions: ['v', 'review', 'head'],
};

interface RequestRoute {
  phrase: string;
  shortcut: string;
  mode?: string;
}

/** The review requests, as Request Vocabulary in `pr-review-workflows` defines them. */
const REVIEW_REQUESTS: RequestRoute[] = [
  { phrase: 'Review PR #N', shortcut: 'review-github-pr' },
  { phrase: 'Address the reviews on PR #N', shortcut: 'address-pr-review' },
  { phrase: 'Review and fix PR #N', shortcut: 'review-and-merge-prs', mode: 'fix' },
  { phrase: 'Get PR #N merge-ready', shortcut: 'review-and-merge-prs', mode: 'merge-ready' },
  {
    phrase: 'Make sure PR #N is reviewed and merged',
    shortcut: 'review-and-merge-prs',
    mode: 'merge',
  },
];

/** Every request phrase a routing surface must send to its shortcut. */
const ALL_REQUESTS: RequestRoute[] = [
  ...REVIEW_REQUESTS,
  { phrase: 'Set up tbd', shortcut: 'setup-tbd' },
  { phrase: 'You can use sub-agents', shortcut: 'delegate-to-subagents' },
];

/** Surfaces that route every request phrase: the skill tiers and the README request table. */
const ROUTING_SURFACES = [
  { label: 'skill-baseline', path: join(SYSTEM_DIR, 'skill-baseline.md') },
  { label: 'skill-brief', path: join(SYSTEM_DIR, 'skill-brief.md') },
  { label: 'skill-minimal', path: join(SYSTEM_DIR, 'skill-minimal.md') },
  { label: 'README', path: README_PATH },
];

/** The lifecycle shortcuts, besides the review-code-* engines. */
const LIFECYCLE_SHORTCUTS = [
  'pr-review-workflows',
  'review-github-pr',
  'address-pr-review',
  'review-and-merge-prs',
  'delegate-to-subagents',
];

// ---------------------------------------------------------------------------
// Doc readers
// ---------------------------------------------------------------------------

const cache = new Map<string, Promise<string>>();

function read(path: string): Promise<string> {
  let text = cache.get(path);
  if (!text) {
    text = readFile(path, 'utf-8');
    cache.set(path, text);
  }
  return text;
}

const shortcutDoc = (name: string) => read(join(STANDARD_DIR, `${name}.md`));

const collapse = (text: string) => text.replace(/\s+/gu, ' ').trim();

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');

async function mdNames(dir: string): Promise<string[]> {
  return (await readdir(dir))
    .filter((f) => f.endsWith('.md'))
    .map((f) => f.slice(0, -3))
    .sort();
}

/**
 * Every shipped Markdown doc, by path relative to packages/tbd/docs, plus the README,
 * which the package ships too (copy-docs.mjs) and which summarizes the same contract.
 */
async function allDocs(): Promise<{ rel: string; text: string }[]> {
  const entries = await readdir(DOCS_DIR, { recursive: true });
  const files = entries.filter((e) => e.endsWith('.md')).sort();
  const docs = await Promise.all(
    files.map(async (entry) => {
      const rel = entry.replaceAll('\\', '/');
      return { rel, text: await read(join(DOCS_DIR, entry)) };
    }),
  );
  return [...docs, { rel: 'README.md', text: await read(README_PATH) }];
}

async function reviewCodeShortcuts(): Promise<string[]> {
  return (await mdNames(STANDARD_DIR)).filter((n) => n.startsWith('review-code-'));
}

// ---------------------------------------------------------------------------
// Markdown structure
// ---------------------------------------------------------------------------

/** The doc's lines with fenced code blanked, so code never reads as prose or headings. */
function proseLines(doc: string): string[] {
  let inFence = false;
  return doc.split('\n').map((line) => {
    if (/^\s*```/u.test(line)) {
      inFence = !inFence;
      return '';
    }
    return inFence ? '' : line;
  });
}

/** The section under the first heading starting with `prefix`, through the next heading of its level or higher. */
function section(doc: string, prefix: string): string {
  const lines = doc.split('\n');
  const prose = proseLines(doc);
  let start = -1;
  let level = 0;
  for (const [i, line] of prose.entries()) {
    const heading = /^(#+) /u.exec(line);
    if (!heading) {
      continue;
    }
    if (start === -1) {
      if (line.startsWith(prefix)) {
        start = i;
        level = heading[1]!.length;
      }
    } else if (heading[1]!.length <= level) {
      return lines.slice(start, i).join('\n');
    }
  }
  if (start === -1) {
    throw new Error(`no heading starting with "${prefix}"`);
  }
  return lines.slice(start).join('\n');
}

/** Step `n` of a shortcut's numbered instructions, up to the next step or heading. */
function step(doc: string, n: number): string {
  const start = doc.search(new RegExp(`^${n}\\. \\*\\*`, 'mu'));
  if (start === -1) {
    throw new Error(`no step ${n}`);
  }
  const rest = doc.slice(start);
  const end = rest.slice(1).search(new RegExp(`^(?:${n + 1}\\. \\*\\*|#+ )`, 'mu'));
  return end === -1 ? rest : rest.slice(0, end + 1);
}

/** Body rows of every Markdown table in `text`, as trimmed cells. */
function tableRows(text: string): string[][] {
  const rows: string[][] = [];
  let header = true;
  for (const line of text.split('\n')) {
    if (!line.trimStart().startsWith('|')) {
      header = true;
      continue;
    }
    const cells = line
      .trim()
      .replace(/^\||\|$/gu, '')
      .split('|')
      .map((c) => c.trim());
    if (cells.every((c) => /^:?-+:?$/u.test(c))) {
      continue;
    }
    if (header) {
      header = false;
      continue;
    }
    rows.push(cells);
  }
  return rows;
}

/** Table rows, list items, and paragraphs, each collapsed to one line. */
function textUnits(doc: string): string[] {
  const units: string[] = [];
  let current: string[] = [];
  const flush = () => {
    if (current.length > 0) {
      units.push(collapse(current.join(' ')));
    }
    current = [];
  };
  for (const line of proseLines(doc)) {
    if (line.trim() === '' || line.trimStart().startsWith('|')) {
      flush();
      if (line.trim() !== '') {
        units.push(collapse(line));
      }
      continue;
    }
    if (/^\s*(?:[-*+]|\d+\.) |^#/u.test(line)) {
      flush();
    }
    current.push(line);
  }
  flush();
  return units;
}

const unquote = (cell: string) => cell.replace(/^[“"]|[”"]$/gu, '');

/** Backticked words in `text`, in order. */
const backticked = (text: string) => [...text.matchAll(/`([^`]+)`/gu)].map((m) => m[1]!);

/** Names cited as `tbd shortcut <name>` or `tbd guidelines <name> ...`, as `kind:name`. */
function references(doc: string): Set<string> {
  const refs = new Set<string>();
  for (const span of backticked(collapse(proseLines(doc).join('\n')))) {
    const command = /^tbd (shortcut|guidelines) (.+)$/u.exec(span.trim());
    if (!command) {
      continue;
    }
    for (const name of command[2]!.split(' ')) {
      if (/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(name)) {
        refs.add(`${command[1]}:${name}`);
      }
    }
  }
  return refs;
}

interface Marker {
  name: string;
  fields: [string, string][];
  /** The marker is shown in full, not elided with `...` or cut off inside a filter. */
  complete: boolean;
  text: string;
}

/** Every `<!-- tbd:review ... -->` and `<!-- tbd:dispositions ... -->` marker in a doc. */
function markers(doc: string): Marker[] {
  return [...doc.matchAll(/<!-- tbd:(review|dispositions)\b([^\n]*)/gu)].map((m) => {
    let rest = m[2]!;
    const end = rest.search(/-->|[`"]/u);
    const closed = end !== -1 && rest.startsWith('-->', end);
    if (end !== -1) {
      rest = rest.slice(0, end);
    }
    const fields: [string, string][] = [];
    let elided = false;
    for (const token of rest.trim().split(/\s+/u).filter(Boolean)) {
      const field = /^([a-z]+)=(\S+)$/u.exec(token);
      if (field) {
        fields.push([field[1]!, field[2]!]);
      } else {
        elided = true;
        if (token !== '...') {
          fields.push([token, '']);
        }
        break;
      }
    }
    return { name: m[1]!, fields, complete: closed && !elided, text: m[0] };
  });
}

const isPlaceholder = (value: string) => /^<[^<>]+>$/u.test(value);

/** The disposition words of each marked disposition-reply example, with its review letter. */
function dispositionReplies(doc: string): { review: string; lines: [string, string][] }[] {
  const replies: { review: string; lines: [string, string][] }[] = [];
  const lines = doc.split('\n');
  for (const [i, line] of lines.entries()) {
    const marker = /^\s*<!-- tbd:dispositions v=1 review=(\S+) /u.exec(line);
    if (!marker) {
      continue;
    }
    const entries: [string, string][] = [];
    for (const next of lines.slice(i + 1)) {
      if (/^\s*```/u.test(next) || next.trim() === '') {
        break;
      }
      const entry = /^\s*- ([A-Z]+)\d+: ([a-z]+)\b/u.exec(next);
      if (entry) {
        entries.push([entry[1]!, entry[2]!]);
      }
    }
    replies.push({ review: marker[1]!, lines: entries });
  }
  return replies;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('review lifecycle contract', () => {
  describe('review and disposition markers', () => {
    it('every marker in the shipped docs is versioned and keeps its fields in contract order', async () => {
      const problems: string[] = [];
      let complete = 0;
      for (const { rel, text } of await allDocs()) {
        for (const bare of text.matchAll(/tbd:(review|dispositions)\b(?! v=1\b)/gu)) {
          problems.push(`${rel}: unversioned marker near "${bare[0]}"`);
        }
        for (const marker of markers(text)) {
          const keys = marker.fields.map(([key]) => key);
          const expected = MARKER_FIELDS[marker.name]!;
          const wanted = marker.complete ? expected : expected.slice(0, keys.length);
          if (keys.join(' ') !== wanted.join(' ')) {
            problems.push(`${rel}: fields [${keys.join(' ')}] in ${marker.text}`);
          }
          if (marker.complete) {
            complete++;
          }
          for (const [key, value] of marker.fields) {
            if (isPlaceholder(value)) {
              continue;
            }
            const ok =
              (key === 'v' && value === '1') ||
              (key === 'kind' && REVIEW_KINDS.includes(value)) ||
              ((key === 'id' || key === 'review') && /^[A-Z]+$/u.test(value)) ||
              ((key === 'pr' || key === 'round') && /^\d+$/u.test(value)) ||
              ((key === 'head' || key === 'base') && /^[0-9a-f]{40}$/u.test(value));
            if (!ok) {
              problems.push(`${rel}: ${key}=${value} in ${marker.text}`);
            }
          }
        }
      }
      expect(problems).toEqual([]);
      expect(complete).toBeGreaterThan(0);
    });

    it('pr-review-workflows defines both markers and the review shortcuts show them', async () => {
      const shown: Record<string, { name: string; complete: boolean }[]> = {
        // The definition shows both markers in full.
        'pr-review-workflows': [
          { name: 'review', complete: true },
          { name: 'dispositions', complete: true },
        ],
        // The reviewer writes the full review marker.
        'review-github-pr': [{ name: 'review', complete: true }],
        // The addressing agent matches reviews by marker and writes full disposition replies.
        'address-pr-review': [
          { name: 'review', complete: false },
          { name: 'dispositions', complete: true },
        ],
        // The coordinator verifies a published review by its marker.
        'review-and-merge-prs': [{ name: 'review', complete: false }],
      };
      for (const [name, required] of Object.entries(shown)) {
        const found = markers(await shortcutDoc(name));
        for (const want of required) {
          expect(
            found.some((m) => m.name === want.name && (m.complete || !want.complete)),
            `${name} must show a ${want.complete ? 'full ' : ''}tbd:${want.name} marker`,
          ).toBe(true);
        }
      }
    });

    it('verifies the complete review marker on the published channel before continuing', async () => {
      const reviewStep = step(await shortcutDoc('review-and-merge-prs'), 2);
      const prose = collapse(reviewStep);
      expect(reviewStep).toContain('repos/$REPO/pulls/<N>/reviews');
      expect(reviewStep).toContain('repos/$REPO/issues/<N>/comments');
      expect(reviewStep).toContain('{commit_id, html_url, body}');
      expect(reviewStep).toContain('{html_url, body}');
      expect(
        markers(reviewStep).some((marker) => marker.name === 'review' && marker.complete),
      ).toBe(true);
      expect(prose).toContain('compare the complete marker');
      expect(prose).toContain('actual published channel');
      expect(prose).toContain('A scratch or worktree file is not publication');
      expect(prose).toContain('Stop if the published artifact or matching marker is missing');
    });

    it('defines exactly the five review kinds and maps each to its review engine', async () => {
      const workflows = collapse(
        section(await shortcutDoc('pr-review-workflows'), '### Review Header and Marker'),
      );
      const definition = /`kind` is ([^.]+)\./u.exec(workflows);
      expect(definition, 'pr-review-workflows must define `kind`').not.toBeNull();
      expect(backticked(definition![1]!)).toEqual(REVIEW_KINDS);

      const engines = Object.fromEntries(
        [
          ...collapse(step(await shortcutDoc('review-github-pr'), 7)).matchAll(
            /`([a-z-]+)`: `tbd shortcut ([a-z-]+)`/gu,
          ),
        ].map((m) => [m[1]!, m[2]!]),
      );
      expect(engines).toEqual({
        senior: 'review-code',
        'follow-up': 'review-code',
        security: 'review-code-security',
        performance: 'review-code-performance',
        correctness: 'review-code-correctness',
      });
    });

    it('uses only defined kinds, and each dedicated review shortcut only its own', async () => {
      const kindValues = (doc: string) =>
        [...doc.matchAll(/(?<![\w-])kind=([^\s`),]+)/gu)].map((m) => m[1]!);

      for (const name of [...LIFECYCLE_SHORTCUTS, ...(await reviewCodeShortcuts())]) {
        for (const value of kindValues(await shortcutDoc(name))) {
          expect(
            isPlaceholder(value) || REVIEW_KINDS.includes(value),
            `${name}: kind=${value}`,
          ).toBe(true);
        }
      }
      for (const kind of DEDICATED_KINDS) {
        const values = kindValues(await shortcutDoc(`review-code-${kind}`));
        expect(values.length, `review-code-${kind} must name kind=${kind}`).toBeGreaterThan(0);
        expect(new Set(values)).toEqual(new Set([kind]));
      }
    });
  });

  describe('dispositions', () => {
    it('pr-review-workflows defines exactly the four dispositions, each with evidence', async () => {
      const definition = section(await shortcutDoc('pr-review-workflows'), '### Dispositions');
      expect(collapse(definition)).toContain('exactly one disposition');
      const rows = tableRows(definition);
      expect(rows.map(([name]) => backticked(name!).join(''))).toEqual(DISPOSITIONS);
      for (const row of rows) {
        expect(
          row.slice(1).filter(Boolean),
          `${row[0]!} needs a meaning and evidence`,
        ).toHaveLength(2);
      }
    });

    it('address-pr-review gives each finding one of the same four', async () => {
      const doc = await shortcutDoc('address-pr-review');
      const triage = step(doc, 6);
      expect([...triage.matchAll(/\*\*`([a-z]+)`\*\*/gu)].map((m) => m[1])).toEqual(DISPOSITIONS);
    });

    it('marked disposition-reply examples list the four dispositions for the marked review', async () => {
      for (const name of ['pr-review-workflows', 'address-pr-review']) {
        const replies = dispositionReplies(await shortcutDoc(name));
        expect(replies.length, `${name} must show a marked disposition reply`).toBeGreaterThan(0);
        for (const reply of replies) {
          expect(
            reply.lines.map(([, word]) => word),
            name,
          ).toEqual(DISPOSITIONS);
          for (const [letter] of reply.lines) {
            expect(letter, name).toBe(reply.review);
          }
        }
      }
    });

    it('no shipped doc states another count or lists an incomplete set of alternatives', async () => {
      const word = '`?(?:fixed|rebutted|declined|deferred)`?';
      // An "or" or slash enumeration of three or more dispositions reads as the full set,
      // so it must name all four; an "and" list states something about a subset.
      const run = new RegExp(`(?<![\\w-])${word}(?:(?:,? or |,? and |, |/)${word})+`, 'gu');
      const problems: string[] = [];
      for (const { rel, text } of await allDocs()) {
        const prose = collapse(proseLines(text).join('\n'));
        for (const count of prose.matchAll(/\b(two|three|five|six|[2356]) dispositions\b/giu)) {
          problems.push(`${rel}: "${count[0]}"`);
        }
        if (/disposition map/iu.test(prose)) {
          problems.push(`${rel}: retired "disposition map"`);
        }
        for (const list of prose.matchAll(run)) {
          const words = list[0].match(/fixed|rebutted|declined|deferred/gu) ?? [];
          if (
            words.length >= 3 &&
            !list[0].includes(' and ') &&
            words.join() !== DISPOSITIONS.join()
          ) {
            problems.push(`${rel}: "${list[0]}"`);
          }
        }
      }
      expect(problems).toEqual([]);
    });
  });

  describe('request vocabulary', () => {
    it('pr-review-workflows defines the review requests, and review-and-merge-prs the same modes', async () => {
      const vocabulary = tableRows(
        section(await shortcutDoc('pr-review-workflows'), '## Request Vocabulary'),
      ).map(([request, route]) => {
        const target = /^`([a-z-]+)`(?: \(([a-z-]+) mode\))?$/u.exec(route!);
        expect(target, `unparsed route "${route!}"`).not.toBeNull();
        return { phrase: unquote(request!), shortcut: target![1]!, mode: target![2] };
      });
      expect(vocabulary).toEqual(REVIEW_REQUESTS);

      const modes = tableRows(section(await shortcutDoc('review-and-merge-prs'), '## Modes')).map(
        ([mode, request]) => ({
          phrase: unquote(request!),
          shortcut: 'review-and-merge-prs',
          mode,
        }),
      );
      expect(modes).toEqual(REVIEW_REQUESTS.filter((r) => r.mode));
    });

    it.each(ROUTING_SURFACES)(
      '$label routes every request phrase to its shortcut',
      async ({ path }) => {
        const units = textUnits(await read(path));
        const missing = ALL_REQUESTS.filter(({ phrase, shortcut }) => {
          const route = new RegExp(`tbd shortcut ${escapeRegExp(shortcut)}(?![\\w-])`, 'u');
          return !units.some(
            (unit) => unit.toLowerCase().includes(phrase.toLowerCase()) && route.test(unit),
          );
        }).map(({ phrase, shortcut }) => `"${phrase}" -> ${shortcut}`);
        expect(missing).toEqual([]);
      },
    );
  });

  describe('cross-references', () => {
    it('every tbd shortcut and tbd guidelines name in the lifecycle docs exists', async () => {
      const shortcuts = new Set([...(await mdNames(STANDARD_DIR)), ...(await mdNames(SYSTEM_DIR))]);
      const guidelines = new Set(await mdNames(GUIDELINES_DIR));
      const unresolved: string[] = [];
      for (const name of [
        ...LIFECYCLE_SHORTCUTS,
        'review-code',
        ...(await reviewCodeShortcuts()),
      ]) {
        const refs = references(await shortcutDoc(name));
        expect(refs.size, `${name} must cite other docs`).toBeGreaterThan(0);
        for (const ref of refs) {
          const [kind, target] = ref.split(':') as [string, string];
          if (!(kind === 'shortcut' ? shortcuts : guidelines).has(target)) {
            unresolved.push(`${name}: ${ref}`);
          }
        }
      }
      expect(unresolved).toEqual([]);
    });

    it('the lifecycle shortcuts link to each other and to their guidelines', async () => {
      const required: Record<string, string[]> = {
        'pr-review-workflows': [
          'shortcut:review-code',
          'shortcut:review-code-security',
          'shortcut:review-code-performance',
          'shortcut:review-code-correctness',
          'shortcut:review-github-pr',
          'shortcut:address-pr-review',
          'shortcut:review-and-merge-prs',
          'shortcut:delegate-to-subagents',
          'guidelines:agent-model-tiers',
          'guidelines:agent-policy-grants',
        ],
        'review-github-pr': [
          'shortcut:pr-review-workflows',
          'shortcut:address-pr-review',
          'shortcut:review-and-merge-prs',
          'guidelines:agent-model-tiers',
        ],
        'address-pr-review': ['shortcut:pr-review-workflows', 'shortcut:review-github-pr'],
        'review-and-merge-prs': [
          'shortcut:pr-review-workflows',
          'shortcut:review-github-pr',
          'shortcut:address-pr-review',
          'shortcut:delegate-to-subagents',
          'guidelines:agent-policy-grants',
        ],
        'delegate-to-subagents': [
          'shortcut:pr-review-workflows',
          'shortcut:review-and-merge-prs',
          'guidelines:agent-model-tiers',
          'guidelines:agent-policy-grants',
        ],
      };
      // Every review-code-* variant runs on, or defers to, the review-code engine.
      for (const name of await reviewCodeShortcuts()) {
        required[name] = ['shortcut:review-code', 'shortcut:pr-review-workflows'];
      }
      for (const [name, refs] of Object.entries(required)) {
        const found = references(await shortcutDoc(name));
        expect(
          refs.filter((ref) => !found.has(ref)),
          `${name} is missing links`,
        ).toEqual([]);
      }
    });
  });

  describe('rounds and the merge gate', () => {
    it('gates an atomic stack without requiring its included layers to be merged first', async () => {
      const doc = await shortcutDoc('review-and-merge-prs');
      const gate = collapse(step(doc, 5));
      const merge = collapse(step(doc, 6));
      expect(gate).toContain('every unmerged lower layer is included in the proposed merge');
      expect(gate).toContain('independently passes the other gate conditions');
      expect(gate).toContain('those included layers need not have merged yet');
      expect(gate).toContain('every higher layer targets the branch directly below it');
      expect(merge).toContain('gh stack merge <target> --yes --<merge|squash|rebase>');
      expect(merge).toContain('every included head immediately before');
    });

    it('pr-review-workflows sets one round by default and asks before another', async () => {
      const workflows = await shortcutDoc('pr-review-workflows');
      const rounds = section(workflows, '## Review Coverage and Rounds');
      const text = collapse(rounds);
      expect(text).toContain('every PR gets one senior engineering review');
      expect(text).toContain('one pass addressing all of its findings');
      expect(text).toContain('ask before starting another round');
      expect(text).toContain('Rounds the user requested up front run without asking again');
      expect(text).toContain('`kind=follow-up`');

      const fixMode = tableRows(section(workflows, '## Request Vocabulary')).find(([request]) =>
        request!.includes('Review and fix'),
      );
      expect(collapse(fixMode![2]!)).toContain('asked about another round');

      // The signals for another round are listed once, here.
      const units = textUnits(rounds);
      const intro = units.findIndex((u) => u.endsWith('Signals:'));
      expect(intro, 'the rounds section must list its signals').toBeGreaterThan(-1);
      const signals: string[] = [];
      for (const unit of units.slice(intro + 1)) {
        if (!unit.startsWith('- ')) {
          break;
        }
        signals.push(unit.slice(2).replace(/[;.]$/u, ''));
      }
      expect(signals.length).toBeGreaterThan(0);
      for (const { rel, text: doc } of await allDocs()) {
        if (rel.endsWith('pr-review-workflows.md')) {
          continue;
        }
        const prose = collapse(doc);
        for (const signal of signals) {
          expect(prose, `${rel} restates a signal`).not.toContain(signal);
        }
      }

      const decide = collapse(step(await shortcutDoc('review-and-merge-prs'), 4));
      expect(decide).toContain('Review Coverage and Rounds');
      expect(decide).toContain('tell the user which and ask');
    });

    it('review-and-merge-prs step 5 holds the one full merge gate, and pr-review-workflows points to it', async () => {
      const gate = step(await shortcutDoc('review-and-merge-prs'), 5);
      expect(gate).toMatch(/^5\. \*\*Merge gate/u);
      expect(collapse(gate)).toContain('authoritative merge gate');
      const conditions = textUnits(gate).filter((u) => u.startsWith('- '));
      expect(conditions.length).toBeGreaterThan(0);
      for (const condition of conditions) {
        expect(condition).toContain('Check:');
      }

      const summary = section(await shortcutDoc('pr-review-workflows'), '## Merge Gate');
      expect(collapse(summary)).toContain('`tbd shortcut review-and-merge-prs`');
      expect(collapse(summary)).toContain('(step 5)');
      expect(textUnits(summary).filter((u) => /^(?:[-*+]|\d+\.) /u.test(u))).toEqual([]);

      // No other doc that discusses the merge gate carries a checked condition list.
      for (const { rel, text } of await allDocs()) {
        if (rel.endsWith('review-and-merge-prs.md') || !/merge gate/iu.test(text)) {
          continue;
        }
        expect(text, `${rel} restates merge gate checks`).not.toContain('Check:');
      }
    });
  });

  describe('agent model tiers', () => {
    const tiersPath = join(GUIDELINES_DIR, 'agent-model-tiers.md');

    it('defines the strong, moderate, and fast tiers', async () => {
      const rows = tableRows(section(await read(tiersPath), '## The Tiers'));
      expect(rows.map(([tier]) => tier)).toEqual(TIERS);
      for (const row of rows) {
        expect(
          row.slice(1).filter(Boolean),
          `${row[0]!} needs a model, level, and work`,
        ).toHaveLength(3);
      }
    });

    it('keeps dated model suggestions in one section and names models only there', async () => {
      const doc = await read(tiersPath);
      const headings = proseLines(doc).filter((l) => l.startsWith('## '));
      const dated = headings.filter((h) =>
        collapse(section(doc, h).replace(/^>\s?/gmu, '')).includes('Suggestions as of'),
      );
      expect(dated).toHaveLength(1);
      const suggestions = section(doc, dated[0]!);
      const date = /Suggestions as of (\d{4}-\d{2}-\d{2}), not requirements/u.exec(
        collapse(suggestions.replace(/^>\s?/gmu, '')),
      )?.[1];
      expect(date, 'the suggestions must be dated').toBeDefined();
      expect(new Date(`${date!}T00:00:00Z`).toISOString().slice(0, 10)).toBe(date);
      expect(dated[0], 'the heading carries the same date').toContain(date);

      const rows = tableRows(suggestions);
      expect(rows.map(([tier]) => tier)).toEqual(TIERS);
      const models = new Set(
        rows.flatMap((cells) =>
          cells
            .slice(1)
            .flatMap((cell) =>
              [...cell.matchAll(/([A-Za-z][\w.\- ]*?) \(`([^`]+)`\)/gu)].flatMap((m) => [
                m[1]!,
                m[2]!,
              ]),
            ),
        ),
      );
      expect(models.size).toBeGreaterThan(0);

      const outside = doc.replace(suggestions, '');
      const shipped = await allDocs();
      expect(
        shipped.map((d) => d.rel).filter((rel) => rel.includes('\\')),
        'allDocs paths are posix-style so Windows readdir backslashes do not leak',
      ).toEqual([]);
      const elsewhere = [
        { label: 'agent-model-tiers outside its suggestions', text: outside },
        ...shipped
          .filter((d) => !d.rel.endsWith('guidelines/agent-model-tiers.md'))
          .map((d) => ({ label: d.rel, text: d.text })),
      ];
      const named: string[] = [];
      for (const { label, text } of elsewhere) {
        for (const model of models) {
          if (new RegExp(`(?<![\\w.-])${escapeRegExp(model)}(?![\\w.-])`, 'iu').test(text)) {
            named.push(`${label}: ${model}`);
          }
        }
      }
      expect(named).toEqual([]);
    });

    it('the review roles use the defined tiers', async () => {
      const roles = Object.fromEntries(
        tableRows(section(await shortcutDoc('pr-review-workflows'), '## Roles')).map(
          ([role, tier]) => [role!, tier!],
        ),
      );
      expect(roles).toMatchObject({
        Reviewer: 'strong',
        'Dedicated reviewer': 'strong',
        'Addressing agent': 'moderate',
        Administrator: 'fast',
      });
      // The coordinator is the user's own session and is not assigned a tier.
      expect(roles.Coordinator).toBeDefined();
      expect(TIERS).not.toContain(roles.Coordinator);

      const steps = tableRows(
        section(await shortcutDoc('review-and-merge-prs'), '## Who Runs Each Step'),
      );
      for (const [stepName, , tier] of steps) {
        if (tier) {
          expect(TIERS, `${stepName!}: ${tier}`).toContain(/^[a-z]+/u.exec(tier)?.[0]);
        }
      }
      const tierOf = (prefix: string) =>
        /^[a-z]+/u.exec(steps.find(([s]) => s!.startsWith(prefix))![2]!)?.[0];
      expect(tierOf('2. Review')).toBe(roles.Reviewer);
      expect(tierOf('3. Address')).toBe(roles['Addressing agent']);
    });
  });

  describe('validation findings folded from Phase 4', () => {
    it('delegate-to-subagents forbids concurrent builds in one checkout and warns about user-level agents', async () => {
      const doc = collapse(await shortcutDoc('delegate-to-subagents'));
      expect(doc).toContain('Parallel writers in one checkout');
      expect(doc).toContain('Only one of them runs tests or builds that regenerate shared outputs');
      expect(doc).toContain('User-level definitions appear in every project');
      expect(doc).toContain('do not copy them into');
    });

    it('address-pr-review treats GitHub CI as the full-suite gate', async () => {
      const verify = collapse(step(await shortcutDoc('address-pr-review'), 7));
      expect(verify).toContain('GitHub CI at the pushed head is the required full-suite gate');
      expect(verify).toContain('Local pre-push');
      expect(verify).toContain('Name the hook and the reason');
    });

    it('review publish falls back when the reviews API is refused', async () => {
      const channels = collapse(
        section(await shortcutDoc('pr-review-workflows'), '### Review Channels'),
      );
      const publish = collapse(step(await shortcutDoc('review-github-pr'), 10));
      const dispositions = collapse(step(await shortcutDoc('address-pr-review'), 8));
      for (const [label, text] of [
        ['pr-review-workflows', channels],
        ['review-github-pr', publish],
        ['address-pr-review', dispositions],
      ] as const) {
        expect(text, label).toContain('403');
        expect(text, label).toContain('same marked body');
      }
    });

    it('the skill warns that update --notes replaces the notes body', async () => {
      const skill = collapse(await read(join(SYSTEM_DIR, 'skill-baseline.md')));
      expect(skill).toContain('`tbd update --notes` replaces the entire notes body');
    });
  });
});
