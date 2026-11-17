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
 * `github-stacked-prs` condition, that the PR docs state the `pr-delivery`
 * condition with its `github-editing` precondition and its limits, that setup-tbd
 * follows the guideline's setup questions, and that the documents added for review
 * and delegation resolve by name with valid frontmatter and the doc footer.
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

/**
 * The sentences of each paragraph and list item, with line wrapping collapsed, so a
 * phrase check can require two facts in one sentence rather than anywhere in the doc.
 */
function sentences(markdown: string): string[] {
  return markdown
    .split(/\n\s*\n|\n(?=[ \t]*(?:[-*+]|\d+\.) )/u)
    .flatMap((block) =>
      flat(block)
        .trim()
        .split(/(?<=[.!?](?:\*\*)?) /u),
    )
    .filter((sentence) => sentence !== '');
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
      expect(prose, rel).toMatch(/instruction to merge a named PR/);
      expect(prose, rel).toMatch(/a PR outside that task needs its own confirmation/);
    },
  );

  it('the CLI manual and design doc leave every opt-in policy unanswered under --policies=recommended', async () => {
    const optIn = POLICY_NAMES.filter((name) => POLICIES[name].recommended === null);
    expect(optIn.length).toBeGreaterThan(1);
    const manual = (await readDoc('tbd-docs.md'))
      .split(/\n(?=- )/u)
      .find((item) => item.startsWith('- `--policies <set>`'))
      ?.split(/\n\s*\n/u)[0];
    const design = (await readDoc('tbd-design.md'))
      .split(/\n\s*\n/u)
      .find((paragraph) => paragraph.startsWith('**Recording.**'));
    for (const [rel, text] of [
      ['tbd-docs.md', manual],
      ['tbd-design.md', design],
    ] as const) {
      expect(text, rel).toBeDefined();
      for (const name of optIn) {
        expect(codeSpans(flat(text!)), `${rel}: ${name}`).toContain(name);
      }
    }
  });

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
    expect(lifecycle).toMatch(/dedicated/);
  });
});

describe('documents that act on grants link to agent-policy-grants', () => {
  it('refreshes the trusted policy ref at both the merge gate and delegation', async () => {
    const review = flat(await readDoc(`${SHORTCUTS}/review-and-merge-prs.md`));
    const delegate = flat(
      section(await readDoc(`${SHORTCUTS}/delegate-to-subagents.md`), 2, 'Check Authorization'),
    );
    // The block re-asks the remote for its default branch before reading the ref git
    // leaves at whatever the default was when the clone was made, then fetches that
    // branch into the ref it just resolved.
    expect(review).toContain('git remote set-head "$POLICY_REMOTE" --auto');
    expect(review).toContain('git symbolic-ref -q "refs/remotes/$POLICY_REMOTE/HEAD"');
    expect(review).toContain('"+refs/heads/$POLICY_BRANCH:$POLICY_REF"');
    const gate = review.slice(review.indexOf('5. **Merge gate'));
    for (const doc of [gate, delegate]) {
      expect(doc).not.toContain('`git fetch <remote> <default-branch>`');
      expect(doc).toContain('explicit destination ref');
      expect(doc).toContain('Prepare');
      // The fetch block has a name, and it is not the `refresh` subcommand.
      expect(doc).toContain('policy fetch block');
      expect(doc).toContain('not `tbd policy refresh`');
    }
  });

  it('the generated tbd block links to the guideline', () => {
    expect(flat(getCodexTbdSection())).toContain(LINK);
  });

  // `tbd sync` publishes bead and doc data on tbd's own branch, never code or a PR, so
  // no policy value gates it and an agent never pauses the closing checklist to ask.
  it('states that tbd sync needs no grant and always runs', async () => {
    const guideline = flat(await readDoc('guidelines/agent-policy-grants.md'));
    // The skill states this in its closing protocol, not its authorization section.
    const baseline = flat(await readDoc('shortcuts/system/skill-baseline.md'));
    for (const doc of [guideline, baseline]) {
      // The guideline bolds the term as a list label; the skill states it inline.
      expect(doc).toMatch(/`tbd sync`(:\*\*)? needs no grant, ever/u);
      expect(doc).toMatch(/no permission to ask for/u);
    }
    // The obligation itself belongs to the closing protocol, in every tier.
    for (const tier of ['skill-baseline', 'skill-brief', 'skill-minimal']) {
      expect(flat(await readDoc(`shortcuts/system/${tier}.md`))).toContain('tbd sync');
    }
    expect(baseline).toContain('Work is not done until pushed, CI passes, and tbd is synced.');
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

describe('the pr-delivery policy delivers requested work as PRs and nothing more', () => {
  /** Delivery without asking is conditioned on the value, not merely mentioned. */
  const CONDITION = /`pr-delivery(?:: |` is `)autonomous`/;
  /** A statement of the autonomous condition, including "follows `pr-delivery`: under `autonomous`". */
  const STATES_AUTONOMOUS =
    /`pr-delivery(?:: |` is `)autonomous`|`pr-delivery`: under `autonomous`/u;
  /** The guideline's precondition: `autonomous` acts only with `github-editing: granted`. */
  const PRECONDITION = /`github-editing(?:: granted`|` (?:is )?granted)/u;

  /** Every sentence of `doc` that states the autonomous condition, each of which must carry the precondition. */
  function autonomousStatements(doc: string): string[] {
    return sentences(doc).filter((sentence) => STATES_AUTONOMOUS.test(sentence));
  }

  it('the guideline defines both values, the standing authorization, and the limits', async () => {
    const delivery = flat(section(await readDoc(GUIDELINE), 2, 'PR Delivery'));
    const rows = tableRows(section(await readDoc(GUIDELINE), 2, 'PR Delivery'));
    expect(rows.slice(1).map((row) => codeSpans(row[0]!)[0])).toEqual([
      ...POLICIES['pr-delivery'].values,
    ]);
    expect(delivery).toContain('a request for a change is also the request for its PR');
    expect(delivery).toContain('standalone PR');
    expect(delivery).toMatch(/GitHub-native stack/);
    expect(delivery).toContain('`create-or-update-pr-simple`');
    expect(delivery).toContain('`stacked-prs`');
    expect(delivery).toContain('standing authorization');
    expect(delivery).toContain('`delegate-to-subagents`');
    // Updating a layer from the one below is a branch update, never a PR merge.
    expect(delivery).toContain('not the merge of a PR');
    const limits = delivery.slice(delivery.indexOf('It does not cover'));
    expect(limits.length).toBeLessThan(delivery.length);
    for (const excluded of [
      '`github-merge`',
      '`pr-review-requirements`',
      '`github-workflows`',
      'settings, secrets, and workflow files',
      'Work the user did not ask for',
    ]) {
      expect(limits, excluded).toContain(excluded);
    }
    expect(delivery).toContain('authorizes no merge');
    expect(delivery).toContain('It acts only with `github-editing: granted`');
    expect(delivery).toContain('A grant never bypasses a tool permission or sandbox');
    expect(delivery).toContain(`Unanswered means \`${POLICIES['pr-delivery'].unansweredValue}\``);
  });

  it('the generated tbd block states the condition and leaves merging to github-merge', () => {
    const block = flat(getCodexTbdSection());
    expect(block).toMatch(CONDITION);
    expect(block).toContain('without asking');
    expect(block).toContain('Merging stays under `github-merge`');
    // Without the editing grant the stricter grant wins, as the guideline says.
    expect(block).toContain('Without `github-editing`, ask before the first push');
  });

  // An agent may read any one of these alone (AGENTS.md is always on), so every
  // sentence that grants delivery without asking also names the grant it acts through.
  it.each([
    'the generated tbd block',
    `${SHORTCUTS}/create-or-update-pr-simple.md`,
    `${SHORTCUTS}/create-or-update-pr-with-validation-plan.md`,
    `${SHORTCUTS}/stacked-prs.md`,
    `${SHORTCUTS}/delegate-to-subagents.md`,
    SETUP_TBD,
    'shortcuts/system/skill-baseline.md',
    'shortcuts/system/skill-brief.md',
    'shortcuts/system/skill-minimal.md',
  ])('%s states the condition with its github-editing precondition', async (rel) => {
    const doc = rel === 'the generated tbd block' ? getCodexTbdSection() : await readDoc(rel);
    expect(flat(doc)).toMatch(CONDITION);
    const statements = autonomousStatements(doc);
    expect(statements.length, rel).toBeGreaterThan(0);
    for (const statement of statements) {
      expect(statement, rel).toMatch(PRECONDITION);
    }
  });

  it('checks each statement of the condition, not the doc as a whole', () => {
    const doc = [
      '- With `pr-delivery: autonomous` and `github-editing` granted, deliver it.',
      '- Under `pr-delivery: autonomous`, stack it.',
      '',
      'Opening a PR follows `pr-delivery`: under `autonomous` it needs no question.',
    ].join('\n');
    expect(autonomousStatements(doc).map((statement) => PRECONDITION.test(statement))).toEqual([
      true,
      false,
      false,
    ]);
  });

  it.each(['README.md', 'tbd-docs.md', 'tbd-design.md'])(
    '%s names github-editing wherever it summarizes the autonomous value',
    async (rel) => {
      const doc =
        rel === 'README.md'
          ? await readFile(join(PACKAGE_DIR, '..', '..', rel), 'utf-8')
          : await readDoc(rel);
      const paragraphs = doc
        .replace(/\r\n?/gu, '\n')
        .split(/\n\s*\n/u)
        .map(flat)
        // A summary of what `pr-delivery: autonomous` does: delivery with no question first.
        .filter(
          (paragraph) =>
            paragraph.includes('`pr-delivery`') &&
            /`autonomous`.*without (?:asking|a confirmation step)/u.test(paragraph),
        );
      expect(paragraphs.length, rel).toBeGreaterThan(0);
      for (const paragraph of paragraphs) {
        expect(paragraph, rel).toContain('`github-editing');
      }
    },
  );

  it('the delegation brief keeps the merge with the coordinator', async () => {
    const brief = flat(section(await readDoc(`${SHORTCUTS}/delegate-to-subagents.md`), 2, 'Brief'));
    expect(brief).toMatch(/`pr-delivery: autonomous`[^.]*deliverable is a PR/);
    expect(brief).toContain('covers no merge');
  });

  it('the guideline and setup-tbd ask separately and record the schema values', async () => {
    const questions = flat(section(await readDoc(GUIDELINE), 2, 'Setup Questions'));
    expect(questions).toMatch(/Ask about PR delivery separately/);
    expect(/“Yes” records `pr-delivery: ([^`]+)`/.exec(questions)?.[1]).toBe(
      POLICIES['pr-delivery'].grantValue,
    );
    expect(/“No” records `pr-delivery: ([^`]+)`/.exec(questions)?.[1]).toBe(
      POLICIES['pr-delivery'].revokeValue,
    );

    const setup = await readDoc(SETUP_TBD);
    expect(flat(section(setup, 2, 'Unanswered'))).toMatch(
      /Ask about PR delivery as its own question/,
    );
    const record = tableRows(section(setup, 2, 'Record'));
    const commandFor = (answerText: string) => record.find((row) => row[0] === answerText)?.[1];
    expect(commandFor('PR delivery: yes')).toContain('`tbd policy grant pr-delivery`');
    expect(commandFor('PR delivery: yes')).toContain(`\`${POLICIES['pr-delivery'].grantValue}\``);
    expect(commandFor('PR delivery: no')).toContain('`tbd policy revoke pr-delivery`');
    expect(commandFor('PR delivery: no')).toContain(`\`${POLICIES['pr-delivery'].revokeValue}\``);
    expect(flat(section(setup, 2, 'Record'))).toContain('except `pr-delivery` and `linear`');
  });
});

describe('setup-tbd follows the guideline setup questions', () => {
  it('reconciles pending proposals before recording the all-recommended answer', async () => {
    const record = flat(section(await readDoc(SETUP_TBD), 2, 'Record'));
    expect(record).toContain('working-tree entries');
    expect(record).toContain('`github-merge: autonomous`');
    expect(record).toContain('`tbd policy grant github-merge`');
    expect(record).toContain('before `--policies=recommended`');
    expect(record).toContain('Do not commit unconfirmed proposals');
  });

  it('keeps pending working-tree proposals out of setup authorization', async () => {
    const setup = await readDoc(SETUP_TBD);
    const review = flat(section(setup, 2, 'Review Policies'));
    const ask = flat(section(setup, 2, 'Unanswered'));
    const act = flat(section(setup, 2, 'What the Grants Need'));
    expect(review).toContain('proposal, not an effective grant');
    expect(review).not.toContain('counts as answered');
    expect(ask).toContain('Pending working-tree values alone do not satisfy this condition');
    expect(act).toContain('only effective default-branch grants or explicit answers');
    expect(act).toContain('current conversation');
    expect(act).toContain('unconfirmed working-tree proposal does not');
  });

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
