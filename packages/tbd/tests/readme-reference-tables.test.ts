/**
 * The README's shortcut, guideline, and template tables are generated from the bundled
 * docs' frontmatter by scripts/readme-reference-tables.ts into marked regions of the
 * committed README.md (`pnpm --filter get-tbd generate:readme`). Nothing in the build
 * rewrites the README, so these tests are what keeps the committed tables current:
 * a stale region, a bundled doc missing from its table, a wrong count, or a link to a
 * doc that does not exist fails here, in CI as well as locally.
 *
 * Plan: docs/project/specs/active/plan-2026-09-16-pr-review-lifecycle-and-agent-delegation.md
 * (Final Documentation Updates > Verification).
 */

import { access, readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  README_PATH,
  REFERENCE_DIRS,
  REFERENCE_KINDS,
  REGENERATE_COMMAND,
  REPO_ROOT,
  SUMMARY_BUDGET,
  findRegion,
  loadReferenceDocs,
  renderAllRegions,
  renderReferenceRegion,
  summarize,
  typeset,
  updateReadme,
} from '../scripts/readme-reference-tables.js';

const DISPOSITIONS = ['fixed', 'rebutted', 'declined', 'deferred'];

async function readme(): Promise<string> {
  return (await readFile(README_PATH, 'utf-8')).replace(/\r\n?/gu, '\n');
}

/** Body rows of the table in a region, as `[name, link target]` from the linked-name cell. */
function linkedRows(region: string): [string, string][] {
  return region
    .split('\n')
    .filter((line) => line.startsWith('|') && !/^\| (?:---|[A-Z])/u.test(line))
    .map((line) => {
      const link = /\[`([^`]+)`\]\(([^)]+)\)/u.exec(line);
      if (!link) {
        throw new Error(`row without a linked name: ${line}`);
      }
      return [link[1]!, link[2]!];
    });
}

describe('README reference tables', () => {
  it.each(REFERENCE_KINDS)('the committed %s region matches the generator', async (kind) => {
    const committed = findRegion(await readme(), kind);
    const rendered = renderReferenceRegion(kind, loadReferenceDocs(kind));
    // If this fails, run the command and commit README.md.
    expect(committed, `README.md is stale: run \`${REGENERATE_COMMAND}\``).toBe(rendered);
  });

  it.each(REFERENCE_KINDS)(
    'lists every bundled %s once, with its count and a link that resolves',
    async (kind) => {
      const region = findRegion(await readme(), kind);
      const dir = REFERENCE_DIRS[kind];
      const bundled = (await readdir(join(REPO_ROOT, dir)))
        .filter((file) => file.endsWith('.md'))
        .map((file) => file.slice(0, -'.md'.length))
        .sort();
      expect(bundled.length).toBeGreaterThan(0);

      const rows = linkedRows(region);
      expect(rows.map(([name]) => name).sort()).toEqual(bundled);
      for (const [name, target] of rows) {
        expect(target).toBe(`${dir}/${name}.md`);
        await expect(access(join(REPO_ROOT, target))).resolves.toBeUndefined();
      }

      const count = new RegExp(`^\\*\\*Available ${kind} \\((\\d+)\\):\\*\\*$`, 'mu').exec(region);
      expect(count, 'the region states its count').not.toBeNull();
      expect(Number(count![1])).toBe(bundled.length);
    },
  );

  it('describes address-pr-review with the four dispositions', async () => {
    const row = findRegion(await readme(), 'shortcuts')
      .split('\n')
      .find((line) => line.includes('`address-pr-review`'));
    expect(row).toBeDefined();
    for (const disposition of DISPOSITIONS) {
      expect(row).toContain(disposition);
    }
  });

  it('renders the regions once, in place, and idempotently', async () => {
    const original = await readme();
    const regions = renderAllRegions();
    const updated = updateReadme(original, regions);
    expect(updated).toBe(original);
    expect(updateReadme(updated, regions)).toBe(updated);
    for (const kind of REFERENCE_KINDS) {
      expect(regions[kind].startsWith(`<!-- BEGIN GENERATED ${kind} `)).toBe(true);
      expect(regions[kind].endsWith(`<!-- END GENERATED ${kind} -->`)).toBe(true);
      // Prose lines stay short enough that flowmark never re-wraps them; table rows and
      // HTML comments are exempt from wrapping.
      for (const line of regions[kind].split('\n')) {
        if (!line.startsWith('|') && !line.startsWith('<!--')) {
          expect(line.length, line).toBeLessThan(88);
        }
      }
    }
    // A README without a region cannot be silently left stale.
    const without = original.replace(findRegion(original, 'templates'), '');
    expect(() => updateReadme(without, regions)).toThrow(/exactly one GENERATED templates/u);
  });

  describe('summarize', () => {
    it('keeps a description within the budget whole, minus a trailing period', () => {
      expect(summarize('Create a new feature planning specification document.')).toBe(
        'Create a new feature planning specification document',
      );
    });

    it('cuts a long description at the last clause boundary within the budget', () => {
      const first = 'Address existing PR reviews from any channel.';
      const second = ' Track every finding as a bead; post a reply per review.';
      const padding = ` ${'Then more detail follows here'.repeat(12)}.`;
      expect(summarize(first + second + padding)).toBe(
        'Address existing PR reviews from any channel. Track every finding as a bead; post a reply per review',
      );
      expect(summarize(first + padding)).toBe('Address existing PR reviews from any channel');
    });

    it('takes the shortest clause when none fits, and ignores boundaries in parentheses', () => {
      const clause = `Dedicated review pass (kind=x; see a. b) for ${'a long list of things, '.repeat(12)}and more`;
      expect(clause.length).toBeGreaterThan(SUMMARY_BUDGET);
      expect(summarize(`${clause}; runs on top of review-code`)).toBe(clause);
      expect(summarize(`Index (e.g. TODO.md). ${'x'.repeat(SUMMARY_BUDGET)}`)).toBe(
        'Index (e.g. TODO.md)',
      );
      expect(summarize(`See e.g. the index. ${'x'.repeat(SUMMARY_BUDGET)}`)).toBe(
        'See e.g. the index',
      );
    });

    it('typesets quotes as flowmark would and rejects what it cannot', () => {
      expect(typeset(`the repository's "merge" method`)).toBe('the repository’s “merge” method');
      expect(() => typeset('wait...')).toThrow(/not flowmark-canonical/u);
      expect(() => typeset("'quoted'")).toThrow(/not flowmark-canonical/u);
    });
  });
});
