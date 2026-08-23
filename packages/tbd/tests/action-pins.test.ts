import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const GATE = join(REPO_ROOT, 'scripts', 'check-action-pins.mjs');

/**
 * The gate is exercised by running it, not by importing its internals.
 *
 * What this check is for is its exit status: a pin check that reports problems and
 * still exits zero is the failure mode `ci-and-gates-rules` describes, and only
 * invoking the process proves the status is right.
 */
function runGate(directory?: string): { status: number; output: string } {
  const args = directory === undefined ? [GATE] : [GATE, '--dir', directory];
  try {
    const stdout = execFileSync(process.execPath, args, { cwd: REPO_ROOT, encoding: 'utf8' });
    return { status: 0, output: stdout };
  } catch (error) {
    const failure = error as { status?: number; stdout?: string; stderr?: string };
    return {
      status: failure.status ?? 1,
      output: `${failure.stdout ?? ''}${failure.stderr ?? ''}`,
    };
  }
}

function workflowDirWith(contents: Record<string, string>): string {
  const directory = mkdtempSync(join(tmpdir(), 'action-pins-'));
  for (const [name, body] of Object.entries(contents)) {
    writeFileSync(join(directory, name), body);
  }
  return directory;
}

const workflow = (reference: string) => `jobs:\n  build:\n    steps:\n      - uses: ${reference}\n`;

describe('check-action-pins', () => {
  it('passes on this repository', () => {
    const { status, output } = runGate();
    expect(output).toContain('pinned to commit SHAs');
    expect(status).toBe(0);
  });

  // The negative cases. A pin check nobody has watched reject something is
  // indistinguishable from one whose pattern matches nothing.
  it.each([
    ['a floating major tag', 'actions/checkout@v6'],
    ['an exact release tag', 'astral-sh/setup-uv@v8.3.2'],
    ['a branch', 'owner/action@main'],
    ['a short SHA', 'owner/action@d23441a'],
  ])('exits nonzero for %s', (_label, reference) => {
    const { status, output } = runGate(workflowDirWith({ 'ci.yml': workflow(reference) }));
    expect(status).toBe(1);
    expect(output).toContain(reference);
    expect(output).toContain('ci.yml:4');
  });

  it('accepts a full commit SHA and ignores local actions', () => {
    const directory = workflowDirWith({
      'ci.yml': [
        'jobs:',
        '  build:',
        '    steps:',
        '      - uses: actions/checkout@d23441a48e516b6c34aea4fa41551a30e30af803 # v6',
        '      - uses: ./.github/actions/local',
        '',
      ].join('\n'),
    });
    expect(runGate(directory).status).toBe(0);
  });

  it('exits nonzero when there are no workflow files to check', () => {
    // Otherwise a renamed or missing directory reports the same green as a clean one.
    const { status, output } = runGate(workflowDirWith({}));
    expect(status).toBe(1);
    expect(output).toContain('no workflow files found');
  });
});
