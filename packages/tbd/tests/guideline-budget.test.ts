import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { ALWAYS_LOAD_GUIDELINES, guidelineGroupFor } from '../src/file/doc-cache.js';

const GUIDELINES_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'guidelines');

/**
 * Words in the always-load core, measured on the rendered documents.
 *
 * This is a budget, not a trivia assertion. Everything in this group is read before
 * the agent has seen a line of the repository's own code, so its size competes
 * directly with attention available for local contracts and the changed control flow.
 * Raising the ceiling is a deliberate decision that costs every session, and it should
 * be made by moving something out rather than by editing the number.
 */
const ALWAYS_LOAD_WORD_BUDGET = 1500;

async function wordCount(name: string): Promise<number> {
  const text = await readFile(join(GUIDELINES_DIR, `${name}.md`), 'utf8');
  return text.split(/\s+/).filter(Boolean).length;
}

describe('always-load guideline budget', () => {
  it('keeps the always-load core inside its word budget', async () => {
    const counts = await Promise.all(
      ALWAYS_LOAD_GUIDELINES.map(async (name) => [name, await wordCount(name)] as const),
    );
    const total = counts.reduce((sum, [, words]) => sum + words, 0);
    const breakdown = counts
      .sort((a, b) => b[1] - a[1])
      .map(([name, words]) => `${name}: ${words}`)
      .join(', ');
    expect(
      total,
      `always-load core is ${total} words (budget ${ALWAYS_LOAD_WORD_BUDGET}) — ${breakdown}`,
    ).toBeLessThanOrEqual(ALWAYS_LOAD_WORD_BUDGET);
  });

  it('measures a non-empty core', async () => {
    // A budget check over an empty set passes for the wrong reason.
    expect(ALWAYS_LOAD_GUIDELINES.length).toBeGreaterThan(0);
    for (const name of ALWAYS_LOAD_GUIDELINES) {
      expect(await wordCount(name)).toBeGreaterThan(0);
    }
  });

  it('routes the large topic guidelines instead of always loading them', () => {
    // These are the documents whose size makes the budget question real. Each one is
    // useful and none of them applies to every task.
    for (const name of [
      'golden-testing-guidelines',
      'general-testing-rules',
      'general-tdd-guidelines',
      'ci-and-gates-rules',
      'filesystem-rules',
      'release-engineering-rules',
      'code-review-rules',
    ]) {
      expect(guidelineGroupFor(name), name).toBe('Cross-cutting engineering topics');
    }
  });
});
