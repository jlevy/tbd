/**
 * Keeps the agent-policy-grants guideline, the policy grants library, and the
 * documents that route to them in agreement.
 *
 * The guideline (docs/guidelines/agent-policy-grants.md) is the single
 * definition of the policies. These tests parse its tables, grammar examples,
 * recommended set, and example block, and compare them with the schema and
 * renderer in src/lib/policy-grants.ts, so a change to either side fails here.
 * They also check that the generated tbd block and the shortcuts that act on
 * grants link to the guideline, that the stacked-PR docs state the
 * `github-stacked-prs` condition, that setup-tbd follows the guideline's setup
 * questions, and that the documents added for review and delegation resolve by
 * name with valid frontmatter and the doc footer.
 *
 * The routing of `tbd setup` output to setup-tbd is covered in setup-flows.test.ts
 * and golden-output.test.ts.
 */

import { readFile } from 'node:fs/promises';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { getCodexTbdSection } from '../src/cli/commands/setup.js';
import { DocCache } from '../src/file/doc-cache.js';
import { DOC_CATEGORIES } from '../src/lib/doc-categories.js';
import {
  POLICIES,
  POLICY_NAMES,
  RECOMMENDED_GRANTS,
  checkPolicyValue,
  renderPolicyBlock,
  type PolicyGrant,
  type PolicyName,
} from '../src/lib/policy-grants.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PACKAGE_DIR = join(__dirname, '..');
const DOCS_DIR = join(PACKAGE_DIR, 'docs');
const GUIDELINE = 'guidelines/agent-policy-grants.md';
const SHORTCUTS = 'shortcuts/standard';
const SETUP_TBD = `${SHORTCUTS}/setup-tbd.md`;
const LINK = '`tbd guidelines agent-policy-grants`';

/**
 * A bundled doc with LF line endings. A Windows checkout has CRLF, which the
 * `\n`-anchored parsing below would otherwise miss.
 */
async function readDoc(relPath: string): Promise<string> {
  return (await readFile(join(DOCS_DIR, relPath), 'utf-8')).replace(/\r\n?/gu, '\n');
}

/** Collapse line wrapping so reflowing prose does not break phrase checks. */
function flat(text: string): string {
  return text.replace(/\s+/gu, ' ');
}

/**
 * The body of the first heading at `level` whose text contains `title`, up to the
 * next heading at that level or above. Fenced code blocks are not headings.
 */
function section(markdown: string, level: number, title: string): string {
  const lines = markdown.split('\n');
  const prefix = `${'#'.repeat(level)} `;
  const start = lines.findIndex((line) => line.startsWith(prefix) && line.includes(title));
  if (start < 0) {
    throw new Error(`no level-${level} heading containing "${title}"`);
  }
  let inFence = false;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i]!;
    if (line.startsWith('```')) {
      inFence = !inFence;
      continue;
    }
    const heading = /^(#+) /.exec(line);
    if (!inFence && heading && heading[1]!.length <= level) {
      end = i;
      break;
    }
  }
  return lines.slice(start + 1, end).join('\n');
}

/** The cells of each Markdown table body row, trimmed (separator rows dropped). */
function tableRows(markdown: string): string[][] {
  return markdown
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('|') && !/^[|\s:-]+$/.test(line))
    .map((line) =>
      line
        .replace(/^\||\|$/g, '')
        .split('|')
        .map((cell) => cell.trim()),
    );
}

/** Rows whose first cell is a backticked policy name, keyed by that name. */
function policyRows(markdown: string): Map<string, string[]> {
  const rows = new Map<string, string[]>();
  for (const row of tableRows(markdown)) {
    const name = /^`([a-z][a-z0-9-]*)`$/.exec(row[0]!)?.[1];
    if (name) {
      rows.set(name, row.slice(1));
    }
  }
  return rows;
}

/** The contents of each inline code span, in order. */
function codeSpans(text: string): string[] {
  return [...text.matchAll(/`([^`]+)`/g)].map((match) => match[1]!);
}

/** `name: value` pairs written as code spans, as the guideline lists grants in prose. */
function grantSpans(text: string): PolicyGrant[] {
  return [...text.matchAll(/`([a-z][a-z0-9-]*): ([^`]+)`/g)].map((match) => ({
    name: match[1]!,
    value: match[2]!,
  }));
}

/** The Valid and Unknown example lists of one Custom Values subsection. */
function customExamples(guideline: string, policy: PolicyName) {
  const body = flat(section(section(guideline, 2, 'Custom Values'), 3, `\`${policy}\``));
  const match = /Valid: ([^.]*)\. Unknown: ([^.]*)\./.exec(body);
  if (!match) {
    throw new Error(`no Valid/Unknown examples for ${policy}`);
  }
  return { valid: codeSpans(match[1]!), unknown: codeSpans(match[2]!) };
}

describe('agent-policy-grants guideline matches the policy schema', () => {
  it('lists the schema policies, fixed values, and recommendations in its policy table', async () => {
    const guideline = await readDoc(GUIDELINE);
    const rows = policyRows(section(guideline, 2, 'The Policies'));
    expect([...rows.keys()]).toEqual([...POLICY_NAMES]);

    for (const name of POLICY_NAMES) {
      const definition = POLICIES[name];
      const [valuesCell, recommendedCell] = rows.get(name)!;
      const documented = codeSpans(valuesCell!);
      if (definition.grammar === null) {
        expect(documented, name).toEqual(definition.values);
      } else {
        // A grammar policy lists some fixed values and names custom values; any other
        // fixed value must appear among its grammar's valid examples.
        expect(valuesCell, name).toContain('custom');
        const { valid } = customExamples(guideline, name);
        for (const value of documented) {
          expect(definition.values, name).toContain(value);
        }
        for (const value of definition.values) {
          expect([...documented, ...valid], name).toContain(value);
        }
      }
      // No code span in the Recommended cell means no recommendation.
      expect(codeSpans(recommendedCell!)[0] ?? null, name).toBe(definition.recommended);
    }
  });

  it('defines custom values for exactly the policies with a grammar', async () => {
    const custom = section(await readDoc(GUIDELINE), 2, 'Custom Values');
    const subsections = [...custom.matchAll(/^### `([a-z][a-z0-9-]*)`$/gm)].map((m) => m[1]);
    expect(subsections).toEqual(POLICY_NAMES.filter((name) => POLICIES[name].grammar !== null));
  });

  it('gives the grant and revoke values of the schema', async () => {
    const rows = policyRows(section(await readDoc(GUIDELINE), 2, 'Recording Grants'));
    expect([...rows.keys()]).toEqual([...POLICY_NAMES]);
    for (const name of POLICY_NAMES) {
      const [grantCell, revokeCell] = rows.get(name)!;
      expect(codeSpans(grantCell!), name).toEqual([POLICIES[name].grantValue]);
      const revoke = POLICIES[name].revokeValue;
      if (revoke === null) {
        // "Not applicable: use `set`" holds a code span that is not a value.
        expect(revokeCell, name).toContain('Not applicable');
      } else {
        expect(codeSpans(revokeCell!), name).toEqual([revoke]);
      }
    }
  });

  it('says revoke returns to the unanswered value, and names the values only set records', async () => {
    const recording = flat(section(await readDoc(GUIDELINE), 2, 'Recording Grants'));
    expect(recording).toMatch(/revoke value is the value an unanswered policy takes/);
    expect(recording).not.toContain('recommends against');
    expect(grantSpans(recording)).toEqual(
      expect.arrayContaining([
        { name: 'github-merge', value: 'never' },
        { name: 'github-merge', value: 'autonomous' },
        { name: 'pr-review-requirements', value: 'none' },
      ]),
    );
  });

  it('states the unanswered defaults of the schema', async () => {
    const answered = flat(section(await readDoc(GUIDELINE), 2, 'Answered and Unanswered'));
    const fallbackMatch = /agents treat it as `([^`]+)`/.exec(answered);
    expect(fallbackMatch).not.toBeNull();
    const fallback = fallbackMatch![1]!;
    const exceptions = new Map(
      [...answered.matchAll(/`([^`]+)` for `([^`]+)`/gu)].map((m) => [m[2]!, m[1]!]),
    );
    // Every policy whose unanswered default is not the fallback must be named as an
    // exception, and no exception may be stale.
    for (const name of POLICY_NAMES) {
      expect(POLICIES[name].unansweredValue, name).toBe(exceptions.get(name) ?? fallback);
    }
    for (const [policy, value] of exceptions) {
      expect(POLICIES[policy as PolicyName]?.unansweredValue, policy).toBe(value);
    }
  });

  it('defines the recommended set as RECOMMENDED_GRANTS, without linear', async () => {
    const guideline = await readDoc(GUIDELINE);
    const paragraphs = section(guideline, 2, 'The Recommended Set').split(/\n\s*\n/);
    const definition = paragraphs.find((paragraph) => paragraph.includes('All recommended'));
    expect(definition).toBeDefined();
    expect(grantSpans(definition!)).toEqual(RECOMMENDED_GRANTS);
    expect(RECOMMENDED_GRANTS.map((grant) => grant.name)).not.toContain('linear');

    // The setup questions offer the same policies with the same recommendations.
    const questions = section(guideline, 2, 'Setup Questions');
    const offered = [...questions.matchAll(/^- `([a-z][a-z0-9-]*)` \(recommended: `([^`]+)`\)/gm)];
    expect(offered.map((m) => ({ name: m[1], value: m[2] }))).toEqual(RECOMMENDED_GRANTS);
  });

  it('accepts and rejects the custom-value examples it lists', async () => {
    const guideline = await readDoc(GUIDELINE);
    for (const name of POLICY_NAMES.filter((policy) => POLICIES[policy].grammar !== null)) {
      const { valid, unknown } = customExamples(guideline, name);
      expect(valid.length, name).toBeGreaterThan(0);
      expect(unknown.length, name).toBeGreaterThan(0);
      for (const value of valid) {
        // The examples are written in canonical form.
        expect(checkPolicyValue(name, value), `${name}: ${value}`).toEqual({
          ok: true,
          canonical: value,
        });
      }
      for (const value of unknown) {
        expect(checkPolicyValue(name, value).ok, `${name}: ${value}`).toBe(false);
      }
    }
  });

  it('writes pr-review-requirements additions in the canonical order it states', async () => {
    const custom = flat(
      section(section(await readDoc(GUIDELINE), 2, 'Custom Values'), 3, 'pr-review-requirements'),
    );
    const order = /Canonical order: ([^.]*)\./.exec(custom);
    expect(order).not.toBeNull();
    expect(order![1]).toMatch(/then rounds$/);
    const kinds = codeSpans(order![1]!);
    expect(kinds.length).toBeGreaterThan(0);
    const scrambled = ['standard', '2 rounds', ...[...kinds].reverse()].join(' + ');
    expect(checkPolicyValue('pr-review-requirements', scrambled)).toEqual({
      ok: true,
      canonical: ['standard', ...kinds, '2 rounds'].join(' + '),
    });
  });

  it('shows the block renderPolicyBlock writes for its example grants', async () => {
    const body = section(await readDoc(GUIDELINE), 2, 'The Policy Block');
    const example = /```markdown\n([\s\S]*?)```/.exec(body)?.[1];
    expect(example).toBeDefined();
    const grants = [...example!.matchAll(/^- `([^`]+)`: (.+)$/gm)].map((m) => ({
      name: m[1]!,
      value: m[2]!,
    }));
    const recorded = /^Recorded (\d{4}-\d{2}-\d{2})\.$/m.exec(example!)?.[1];
    expect(grants.map((grant) => grant.name)).toEqual([...POLICY_NAMES]);
    for (const grant of grants) {
      expect(checkPolicyValue(grant.name as PolicyName, grant.value).ok, grant.name).toBe(true);
    }
    expect(recorded).toBeDefined();
    expect(renderPolicyBlock(grants, recorded!)).toBe(example);
  });
});

describe('long-lived docs state the merge ladder and review invariance', () => {
  const MERGE_VALUES = ['never', 'confirm-every', 'confirm-session', 'autonomous'] as const;

  it.each(['tbd-design.md', 'tbd-docs.md'])(
    '%s names the four github-merge values and that no value weakens pr-review-requirements',
    async (rel) => {
      const prose = flat(await readDoc(rel));
      for (const value of MERGE_VALUES) {
        expect(prose, rel).toContain(`\`${value}\``);
      }
      expect(prose, rel).toMatch(/no value weakens `pr-review-requirements`/i);
      expect(prose, rel).toContain(LINK);
      expect(prose, rel).toMatch(/settable (?:preferences|policy grants|grants)/);
    },
  );

  it('tbd-design.md §6.4.9 describes the review lifecycle', async () => {
    const lifecycle = flat(section(await readDoc('tbd-design.md'), 4, 'PR Review Lifecycle'));
    expect(lifecycle).toContain('`tbd shortcut pr-review-workflows`');
    expect(lifecycle).toContain('`review-github-pr`');
    expect(lifecycle).toContain('`address-pr-review`');
    expect(lifecycle).toContain('`review-and-merge-prs`');
    expect(lifecycle).toContain('`stacked-prs`');
    for (const word of ['fixed', 'rebutted', 'declined', 'deferred']) {
      expect(lifecycle).toContain(`\`${word}\``);
    }
    expect(lifecycle).toContain('lettered');
    expect(lifecycle).toMatch(/merge gate/);
  });
});

describe('documents that act on grants link to agent-policy-grants', () => {
  it('the generated tbd block links to the guideline', () => {
    expect(flat(getCodexTbdSection())).toContain(LINK);
  });

  it.each(['setup-tbd', 'delegate-to-subagents', 'review-and-merge-prs', 'stacked-prs'])(
    '%s links to the guideline',
    async (name) => {
      expect(flat(await readDoc(`${SHORTCUTS}/${name}.md`))).toContain(LINK);
    },
  );

  it("skill-baseline's GitHub Authorization section links to the guideline", async () => {
    const baseline = await readDoc('shortcuts/system/skill-baseline.md');
    expect(flat(section(baseline, 2, 'GitHub Authorization'))).toContain(LINK);
  });
});

describe('stacked-PR documents state the github-stacked-prs condition', () => {
  /** Stacking is conditioned on the grant, not merely mentioned alongside it. */
  const CONDITION = /`github-stacked-prs` (?:is (?:not )?granted|grant\b)/;

  it('the generated tbd block states it', () => {
    expect(flat(getCodexTbdSection())).toMatch(CONDITION);
  });

  it.each([
    'stacked-prs',
    'create-or-update-pr-simple',
    'create-or-update-pr-with-validation-plan',
    'setup-github-cli',
  ])('%s states it', async (name) => {
    expect(flat(await readDoc(`${SHORTCUTS}/${name}.md`))).toMatch(CONDITION);
  });
});

describe('setup-tbd follows the guideline setup questions', () => {
  it('reviews policies first and asks only about unanswered ones, in the recommended set', async () => {
    const setup = await readDoc(SETUP_TBD);
    const review = setup.indexOf('tbd policy show');
    expect(review).toBeGreaterThan(-1);
    expect(review).toBeLessThan(setup.search(/^## .*Unanswered/m));
    const ask = section(setup, 2, 'Unanswered');
    expect(flat(ask)).toContain('only the unanswered policies');

    // The question template lists the recommended set with its recommendations.
    const template = [...ask.matchAll(/^\d+\. ([a-z][a-z0-9-]*) \(recommended: ([^)]+)\)/gm)];
    expect(template.map((m) => ({ name: m[1], value: m[2] }))).toEqual(RECOMMENDED_GRANTS);
  });

  it('offers the all-recommended answer the guideline defines, and "not now"', async () => {
    const answer = 'yes, all recommended automations and review policies';
    const guidelineQuestions = section(await readDoc(GUIDELINE), 2, 'Setup Questions');
    expect(flat(guidelineQuestions).toLowerCase()).toContain(answer);

    const setup = await readDoc(SETUP_TBD);
    expect(flat(section(setup, 2, 'Unanswered')).toLowerCase()).toContain(answer);
    const record = tableRows(section(setup, 2, 'Record'));
    const commandFor = (answerText: string) =>
      record.find((row) => row[0]!.toLowerCase().startsWith(answerText))?.[1];
    expect(commandFor('all recommended')).toContain('`tbd setup --auto --policies=recommended`');
    expect(commandFor('not now')).toBe('Nothing');
  });

  it('asks about Linear separately and records the answers the schema defines', async () => {
    const guideline = flat(section(await readDoc(GUIDELINE), 2, 'Setup Questions'));
    expect(guideline).toMatch(/Ask about Linear separately/);
    const yes = /“Yes” records `linear: ([^`]+)`/.exec(guideline)?.[1];
    const no = /“No” records `linear: ([^`]+)`/.exec(guideline)?.[1];
    expect(yes).toBe(POLICIES.linear.grantValue);
    expect(no).toBe(POLICIES.linear.revokeValue);

    const setup = await readDoc(SETUP_TBD);
    expect(flat(section(setup, 2, 'Unanswered'))).toMatch(
      /Ask about Linear as its own question|Ask about Linear separately/,
    );
    const record = tableRows(section(setup, 2, 'Record'));
    const commandFor = (answerText: string) => record.find((row) => row[0] === answerText)?.[1];
    expect(commandFor('Linear: yes')).toContain(`\`tbd policy set linear ${yes}\``);
    expect(commandFor('Linear: no')).toContain('`tbd policy revoke linear`');
  });

  it('names the gh and Linear authentication steps', async () => {
    const needs = flat(section(await readDoc(SETUP_TBD), 2, 'What the Grants Need'));
    expect(needs).toContain('`gh auth status`');
    expect(needs).toContain('`tbd shortcut setup-github-cli`');
    expect(needs).toContain('`tbd shortcut setup-linear`');
    expect(needs).toContain('`LINEAR_API_KEY`');
  });

  it('verifies with tbd doctor and tbd policy show', async () => {
    const verify = flat(section(await readDoc(SETUP_TBD), 2, 'Verify'));
    expect(verify).toContain('tbd doctor');
    expect(verify).toContain('tbd policy show');
  });
});

describe('requests route to setup-tbd and delegate-to-subagents', () => {
  /** Whether some table row pairs the request phrase with the shortcut command. */
  function routes(markdown: string, request: string, shortcut: string): boolean {
    return tableRows(markdown).some((row) => {
      const text = row.join(' | ');
      return text.includes(request) && text.includes(`\`tbd shortcut ${shortcut}\``);
    });
  }

  it.each(['skill-baseline', 'skill-brief', 'skill-minimal'])(
    '%s routes setup and delegation requests',
    async (tier) => {
      const skill = await readDoc(`shortcuts/system/${tier}.md`);
      expect(routes(skill, 'Set up tbd', 'setup-tbd')).toBe(true);
      expect(routes(skill, 'You can use sub-agents', 'delegate-to-subagents')).toBe(true);
    },
  );

  it('welcome-user routes "Set up tbd" to setup-tbd', async () => {
    const welcome = await readDoc(`${SHORTCUTS}/welcome-user.md`);
    expect(routes(welcome, 'Set up tbd', 'setup-tbd')).toBe(true);
  });
});

describe('documents added for review and delegation resolve by name', () => {
  const FOOTER = /<!-- This document follows common-doc-guidelines\.md\.[\s\S]*?-->\s*$/;
  const EXPECTED: [name: string, dir: string][] = [
    ['setup-tbd', SHORTCUTS],
    ['delegate-to-subagents', SHORTCUTS],
    ['review-and-merge-prs', SHORTCUTS],
    ['review-code-security', SHORTCUTS],
    ['review-code-performance', SHORTCUTS],
    ['review-code-correctness', SHORTCUTS],
    ['agent-policy-grants', 'guidelines'],
    ['agent-model-tiers', 'guidelines'],
  ];

  it('each has title, description, and category frontmatter and the doc footer', async () => {
    const cache = new DocCache([join('docs', SHORTCUTS), join('docs', 'guidelines')], PACKAGE_DIR);
    await cache.load({ skipAutoSync: true });

    for (const [name, dir] of EXPECTED) {
      const doc = cache.get(name)?.doc;
      expect(doc, name).toBeDefined();
      expect(relative(DOCS_DIR, dirname(doc!.path)).split(sep).join('/'), name).toBe(dir);
      const { title, description, category } = doc!.frontmatter ?? {};
      for (const field of [title, description, category]) {
        expect(field?.trim(), name).toBeTruthy();
      }
      if (dir === 'guidelines') {
        expect(DOC_CATEGORIES, name).toContain(category);
      }
      expect(doc!.content, name).toMatch(FOOTER);
    }
  });
});
