/**
 * The generated AGENTS.md block survives a Markdown formatter.
 *
 * Setup emits the block in flowmark's canonical form, so the repository's own pinned
 * flowmark leaves it byte for byte: tests/fixtures/agents-md-block.md is this test's
 * expected output, and `pnpm format:md:check` runs flowmark over that fixture. A
 * formatter that wraps differently (another width, Prettier's proseWrap) changes only
 * line breaks, and Prettier also puts blank lines around the marker comments; doctor
 * and setup ignore both for this block. The repository's own pinned Prettier checks
 * that here.
 */

import { execSync, spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { format as prettierFormat, type Options as PrettierOptions } from 'prettier';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { getCodexTbdSection } from '../src/cli/commands/setup.js';
import {
  extractManagedBlock,
  sameMarkdownIgnoringWrapping,
  unwrapMarkdown,
} from '../src/cli/lib/managed-artifact.js';
import {
  POLICY_BLOCK_PROSE,
  renderPolicyBlock,
  withPolicyBlock,
} from '../src/lib/policy-grants.js';
import { subprocessTestTimeout } from './test-helpers.js';

const tbdBin = join(__dirname, '..', 'dist', 'bin.mjs');
const FIXTURE = join(__dirname, 'fixtures', 'agents-md-block.md');
/**
 * The fixture with LF line endings. Git may check it out with CRLF (Windows runners
 * have core.autocrlf), while the generator always emits LF.
 */
async function readFixture(): Promise<string> {
  return (await readFile(FIXTURE, 'utf-8')).replace(/\r\n/gu, '\n');
}

/** The proseWrap settings a project's Prettier may use for Markdown. */
const PRETTIER_MARKDOWN_OPTIONS: PrettierOptions[] = [
  { proseWrap: 'preserve' },
  { proseWrap: 'always' },
  { proseWrap: 'always', printWidth: 60 },
  { proseWrap: 'always', printWidth: 40 },
  { proseWrap: 'never' },
];

function prettierMarkdown(text: string, options: PrettierOptions): Promise<string> {
  return prettierFormat(text, { parser: 'markdown', ...options });
}

const FIXTURE_GRANTS = [
  { name: 'github-workflows', value: 'granted' },
  { name: 'github-editing', value: 'granted' },
  { name: 'github-merge', value: 'confirm-session' },
  { name: 'subagents', value: 'granted' },
];

/** Rewrap every paragraph and list item of `markdown` at `width`, as another formatter might. */
function rewrap(markdown: string, width: number): string {
  return unwrapMarkdown(markdown)
    .split('\n')
    .map((line) => {
      if (line.length <= width || line.startsWith('<!--') || line.startsWith('#')) {
        return line;
      }
      const prefix = /^[-*+] /u.test(line) ? line.slice(0, 2) : '';
      const hang = ' '.repeat(prefix.length);
      const wrapped: string[] = [];
      let current = '';
      for (const word of line.slice(prefix.length).split(' ')) {
        if (
          current !== '' &&
          (wrapped.length === 0 ? prefix : hang).length + current.length + 1 + word.length > width
        ) {
          wrapped.push(current);
          current = word;
        } else {
          current = current === '' ? word : `${current} ${word}`;
        }
      }
      wrapped.push(current);
      return wrapped.map((part, index) => (index === 0 ? prefix : hang) + part).join('\n');
    })
    .join('\n');
}

describe('generated AGENTS.md block', () => {
  it("is emitted in flowmark's canonical form (pinned by the flowmark-checked fixture)", async () => {
    const generated = withPolicyBlock(
      getCodexTbdSection(),
      renderPolicyBlock(FIXTURE_GRANTS, '2026-01-02'),
    );
    expect(generated).toBe(await readFixture());
  });

  it("compares current after the repository's pinned Prettier, under every proseWrap", async () => {
    const fixture = await readFixture();
    for (const options of PRETTIER_MARKDOWN_OPTIONS) {
      const formatted = await prettierMarkdown(fixture, options);
      expect(formatted, JSON.stringify(options)).not.toBe(fixture);
      expect(sameMarkdownIgnoringWrapping(formatted, fixture), JSON.stringify(options)).toBe(true);
    }
  });

  it('uses no em dash, which many repositories lint', () => {
    expect(getCodexTbdSection()).not.toContain('—');
    expect(POLICY_BLOCK_PROSE).not.toContain('—');
  });
});

describe('unwrapMarkdown', () => {
  const canonical = getCodexTbdSection();

  it('equates text that differs only in line wrapping', () => {
    for (const width of [40, 60, 72, 100, 1000]) {
      const rewrapped = rewrap(canonical, width);
      expect(rewrapped).not.toBe(canonical);
      expect(sameMarkdownIgnoringWrapping(rewrapped, canonical), String(width)).toBe(true);
    }
    expect(sameMarkdownIgnoringWrapping(canonical.replace(/\n/gu, '\r\n'), canonical)).toBe(true);
  });

  it('still distinguishes changed words and changed structure', () => {
    expect(sameMarkdownIgnoringWrapping(canonical.replace('quote it', 'obey it'), canonical)).toBe(
      false,
    );
    // Joining a list item into the line before it is a structural change, not wrapping.
    const joined = canonical.replace('\n- Run `tbd skill`', ' - Run `tbd skill`');
    expect(sameMarkdownIgnoringWrapping(joined, canonical)).toBe(false);
    // A paragraph after a heading is not part of the heading.
    expect(unwrapMarkdown('## tbd\nText')).toBe('## tbd\nText');
    expect(unwrapMarkdown('## tbd\n\nText')).not.toBe(unwrapMarkdown('## tbd\nText'));
    // Fenced code keeps its line breaks and spacing.
    expect(unwrapMarkdown('```\na  b\nc\n```')).toBe('```\na  b\nc\n```');
    expect(unwrapMarkdown('Para one\nwraps   here.\n- item\n  continues')).toBe(
      'Para one wraps here.\n- item continues',
    );
  });

  it('ignores blank lines next to a comment line, and only there', () => {
    expect(
      sameMarkdownIgnoringWrapping(
        '<!-- a -->\n\n## tbd\n\nText\n\n<!-- b -->',
        '<!-- a -->\n## tbd\n\nText\n<!-- b -->',
      ),
    ).toBe(true);
    expect(sameMarkdownIgnoringWrapping('## tbd\n\nText', '## tbd\nText')).toBe(false);
    expect(sameMarkdownIgnoringWrapping('One\n\nTwo', 'One\nTwo')).toBe(false);
  });

  it('keeps thematic breaks, setext underlines, and indented code as structure', () => {
    for (const [structured, flattened] of [
      ['Intro text\n---', 'Intro text ---'],
      ['Intro text\n===', 'Intro text ==='],
      ['Para one\n***', 'Para one ***'],
      ['Para one\n***\nPara two', 'Para one\n*** Para two'],
      ['Intro\n\n    a  b\n    c', 'Intro\n\n    a b c'],
      ['Intro\n\n    a  b', 'Intro\n\n    a b'],
    ]) {
      expect(sameMarkdownIgnoringWrapping(structured!, flattened!), structured).toBe(false);
    }
    // Rewrapping prose around them is still only wrapping.
    expect(
      sameMarkdownIgnoringWrapping(
        'Para one\nwraps\n\n***\n\nNext',
        'Para one wraps\n\n***\n\nNext',
      ),
    ).toBe(true);
  });
});

describe(
  'setup and doctor with a rewrapped AGENTS.md block',
  {
    timeout: subprocessTestTimeout(60_000),
  },
  () => {
    let projectDir: string;
    let fakeHome: string;

    beforeEach(async () => {
      const root = await realpath(await mkdtemp(join(tmpdir(), 'tbd-agents-md-wrap-')));
      projectDir = join(root, 'project');
      fakeHome = join(root, 'home');
      await mkdir(projectDir);
      await mkdir(fakeHome);
      execSync('git init --initial-branch=main', { cwd: projectDir, stdio: 'ignore' });
      execSync('git config user.email "test@example.com"', { cwd: projectDir });
      execSync('git config user.name "Test"', { cwd: projectDir });
    });

    afterEach(async () => {
      await rm(join(projectDir, '..'), { recursive: true, force: true });
    });

    function runTbd(args: string[]): { stdout: string; stderr: string; status: number } {
      const result = spawnSync('node', [tbdBin, ...args], {
        cwd: projectDir,
        encoding: 'utf-8',
        env: { ...process.env, HOME: fakeHome, USERPROFILE: fakeHome, FORCE_COLOR: '0' },
      });
      return {
        stdout: result.stdout ?? '',
        stderr: result.stderr ?? '',
        status: result.status ?? 1,
      };
    }

    function agentsMdCheck(): { status: string; message?: string } | undefined {
      const report = JSON.parse(runTbd(['doctor', '--json']).stdout) as {
        integrationChecks: { name: string; status: string; message?: string }[];
      };
      return report.integrationChecks.find((check) => check.name === 'AGENTS.md');
    }

    it('reports a rewrapped block as current and leaves it unchanged', async () => {
      expect(runTbd(['setup', '--auto', '--prefix=test']).status).toBe(0);
      expect(runTbd(['policy', 'grant', 'subagents']).status).toBe(0);
      const agentsPath = join(projectDir, 'AGENTS.md');
      const original = await readFile(agentsPath, 'utf-8');
      const block = extractManagedBlock(
        original,
        '<!-- BEGIN TBD INTEGRATION',
        '<!-- END TBD INTEGRATION -->',
      );
      expect(block).toContain('<!-- BEGIN TBD POLICY GRANTS');

      const rewrapped = original.replace(block, rewrap(block, 60));
      expect(rewrapped).not.toBe(original);
      await writeFile(agentsPath, rewrapped);

      expect(agentsMdCheck()).toMatchObject({ status: 'ok', message: 'current' });
      expect(runTbd(['policy', 'show']).status).toBe(0);
      const setup = runTbd(['setup', '--auto']);
      expect(setup.status, setup.stderr).toBe(0);
      expect(await readFile(agentsPath, 'utf-8')).toBe(rewrapped);

      // A changed word is still drift, and setup restores the generated text.
      await writeFile(agentsPath, rewrapped.replace('(beads)', '(tickets)'));
      expect(agentsMdCheck()?.status).toBe('warn');
      expect(runTbd(['setup', '--auto']).status).toBe(0);
      expect(await readFile(agentsPath, 'utf-8')).toContain('(beads)');
      expect(agentsMdCheck()).toMatchObject({ status: 'ok', message: 'current' });
    });

    it('leaves a Prettier-formatted AGENTS.md current and unchanged', async () => {
      expect(runTbd(['setup', '--auto', '--prefix=test']).status).toBe(0);
      expect(runTbd(['policy', 'grant', 'subagents']).status).toBe(0);
      const agentsPath = join(projectDir, 'AGENTS.md');
      const original = await readFile(agentsPath, 'utf-8');
      for (const options of [{ proseWrap: 'preserve' }, { proseWrap: 'always', printWidth: 60 }]) {
        const formatted = await prettierMarkdown(original, options as PrettierOptions);
        expect(formatted).not.toBe(original);
        await writeFile(agentsPath, formatted);
        expect(agentsMdCheck(), JSON.stringify(options)).toMatchObject({
          status: 'ok',
          message: 'current',
        });
        const setup = runTbd(['setup', '--auto']);
        expect(setup.status, setup.stderr).toBe(0);
        expect(setup.stdout + setup.stderr).not.toContain('Updated existing tbd section');
        expect(await readFile(agentsPath, 'utf-8'), JSON.stringify(options)).toBe(formatted);
      }
    });
  },
);
