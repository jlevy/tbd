import { describe, expect, it } from 'vitest';

import { checkWorkflows, findUnpinnedUses } from '../../../scripts/check-action-pins.mjs';

const WORKFLOW_DIR = new URL('../../../.github/workflows', import.meta.url).pathname;

describe('check-action-pins', () => {
  it('passes on this repository', () => {
    const { files, problems } = checkWorkflows(WORKFLOW_DIR);
    expect(files.length).toBeGreaterThan(0);
    expect(problems).toEqual([]);
  });

  // The negative cases. A pin check that has never been watched reject something is
  // indistinguishable from one that matches nothing.
  it.each([
    ['a floating major tag', 'actions/checkout@v6'],
    ['an exact release tag', 'astral-sh/setup-uv@v8.3.2'],
    ['a branch', 'owner/action@main'],
    ['a short SHA', 'owner/action@d23441a'],
  ])('rejects %s', (_label, reference) => {
    const problems = findUnpinnedUses(
      `jobs:\n  a:\n    steps:\n      - uses: ${reference}\n`,
      'probe.yml',
    );
    expect(problems).toEqual([{ file: 'probe.yml', line: 4, reference }]);
  });

  it('accepts a full commit SHA and ignores local actions', () => {
    const source = [
      'jobs:',
      '  a:',
      '    steps:',
      '      - uses: actions/checkout@d23441a48e516b6c34aea4fa41551a30e30af803 # v6',
      '      - uses: ./.github/actions/local',
      '',
    ].join('\n');
    expect(findUnpinnedUses(source, 'probe.yml')).toEqual([]);
  });
});
