/**
 * Tests that all tbd doc commands referenced in documentation actually work.
 * Extracts `tbd shortcut`, `tbd guidelines`, `tbd template` commands and runs them.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtemp, readFile, readdir, rm, stat } from 'node:fs/promises';
import { join, dirname, extname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const README_PATH = join(__dirname, '..', '..', '..', 'README.md');
const TBD_BIN = join(__dirname, '..', 'dist', 'bin.mjs');
const MONOREPO_ROOT = join(__dirname, '..', '..', '..');
const SOURCE_GUARD_PATHS = [
  '.agents/skills/tbd/SKILL.md',
  '.claude/hooks/tbd-closing-reminder.sh',
  '.claude/scripts/tbd-session.sh',
  '.claude/skills/tbd/SKILL.md',
  '.codex/tbd-closing-reminder.sh',
  '.codex/tbd-session.sh',
  '.tbd/config.yml',
  'AGENTS.md',
];

/** Directories to scan for doc references */
const DOC_DIRS = [join(MONOREPO_ROOT, 'docs'), join(MONOREPO_ROOT, 'packages', 'tbd', 'docs')];

/**
 * Recursively find all markdown files in a directory.
 */
async function findMarkdownFiles(dir: string): Promise<string[]> {
  const files: string[] = [];

  try {
    const entries = await readdir(dir);
    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const stats = await stat(fullPath);

      if (stats.isDirectory()) {
        // Skip node_modules, hidden directories, and specs (which reference future features)
        if (!entry.startsWith('.') && entry !== 'node_modules' && entry !== 'specs') {
          files.push(...(await findMarkdownFiles(fullPath)));
        }
      } else if (extname(entry) === '.md') {
        files.push(fullPath);
      }
    }
  } catch {
    // Directory doesn't exist, skip it
  }

  return files;
}

/**
 * Extract all tbd shortcut|guidelines|template|reference <name> commands from content.
 * Handles both code blocks and inline backticks.
 * Supports prefix:name syntax (e.g., spec:typescript-rules).
 */
function extractDocCommands(content: string): string[] {
  // Normalize: join lines, collapse whitespace
  const normalized = content.replace(/\n/g, ' ').replace(/\s+/g, ' ');

  // Match per-kind readers (tbd shortcut|guidelines|template <name>) and the
  // kind-agnostic reader (tbd docs show <name>). Names can be simple (foo-bar)
  // or prefixed (prefix:foo-bar).
  const pattern =
    /tbd (shortcut|guidelines|template|docs show) ([a-z][a-z0-9-]*(?::[a-z][a-z0-9-]*)?)/g;
  const commands: string[] = [];
  let match;

  while ((match = pattern.exec(normalized)) !== null) {
    const cmd = match[1];
    const name = match[2];
    // Skip flags like --list, --all
    if (cmd && name && !name.startsWith('-')) {
      // Skip prefix:name syntax for now - it's documented but not yet implemented
      // TODO: Remove this check once prefix-based lookup is implemented (f04)
      if (name.includes(':')) {
        continue;
      }
      commands.push(`tbd ${cmd} ${name}`);
    }
  }

  return [...new Set(commands)]; // dedupe
}

// This test runs every `tbd shortcut/guidelines/template` command found in docs.
// Takes ~23s in isolation; under full parallel suite CPU contention pushes it higher.
describe('doc references', { timeout: 60_000 }, () => {
  let managedDiffBefore: string;
  let commandDir: string;
  let commandEnv: NodeJS.ProcessEnv;

  beforeAll(async () => {
    managedDiffBefore = execFileSync('git', ['diff', '--binary', '--', ...SOURCE_GUARD_PATHS], {
      cwd: MONOREPO_ROOT,
      encoding: 'utf-8',
    });
    commandDir = await mkdtemp(join(tmpdir(), 'tbd-doc-references-'));
    commandEnv = {
      ...process.env,
      HOME: commandDir,
      USERPROFILE: commandDir,
      FORCE_COLOR: '0',
      NO_COLOR: '1',
    };
    execFileSync('git', ['init', '--initial-branch=main'], {
      cwd: commandDir,
      stdio: 'pipe',
    });
    execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: commandDir });
    execFileSync('git', ['config', 'user.name', 'Test'], { cwd: commandDir });
    execFileSync(
      process.execPath,
      [TBD_BIN, 'setup', '--auto', '--prefix=test', '--surfaces=portable', '--no-gh-cli'],
      { cwd: commandDir, env: commandEnv, stdio: 'pipe' },
    );
  });

  afterAll(async () => {
    try {
      const managedDiffAfter = execFileSync(
        'git',
        ['diff', '--binary', '--', ...SOURCE_GUARD_PATHS],
        { cwd: MONOREPO_ROOT, encoding: 'utf-8' },
      );
      expect(managedDiffAfter).toBe(managedDiffBefore);
    } finally {
      await rm(commandDir, { recursive: true, force: true });
    }
  });

  it('extracts doc commands from README', async () => {
    const readme = await readFile(README_PATH, 'utf-8');
    const commands = extractDocCommands(readme);

    expect(commands.length).toBeGreaterThan(0);
    expect(commands).toContain('tbd shortcut new-plan-spec');
    expect(commands).toContain('tbd guidelines typescript-rules');
    expect(commands).toContain('tbd template plan-spec');
  });

  it('all doc references in all documentation resolve correctly', async () => {
    // Collect all markdown files from doc directories
    const allFiles: string[] = [README_PATH];
    for (const dir of DOC_DIRS) {
      allFiles.push(...(await findMarkdownFiles(dir)));
    }

    // Extract all commands from all files
    const commandsPerFile = new Map<string, string[]>();
    const allCommands = new Set<string>();

    for (const filePath of allFiles) {
      const content = await readFile(filePath, 'utf-8');
      const commands = extractDocCommands(content);
      if (commands.length > 0) {
        commandsPerFile.set(filePath, commands);
        for (const cmd of commands) {
          allCommands.add(cmd);
        }
      }
    }

    // Validate all unique commands work
    const failures: { cmd: string; files: string[]; error: string }[] = [];

    for (const cmd of allCommands) {
      try {
        const args = cmd.split(' ').slice(1);
        const output = execFileSync(process.execPath, [TBD_BIN, ...args], {
          cwd: commandDir,
          encoding: 'utf-8',
          stdio: 'pipe',
          env: commandEnv,
        });
        // Check for specific "not found" error messages from tbd commands
        // Use precise patterns to avoid false positives from doc content
        const notFoundPatterns = [
          /No shortcut found matching/i,
          /No guideline found matching/i,
          /No template found matching/i,
        ];
        const isNotFound = notFoundPatterns.some((pattern) => pattern.test(output));
        if (isNotFound) {
          const filesWithCmd = [...commandsPerFile.entries()]
            .filter(([, cmds]) => cmds.includes(cmd))
            .map(([file]) => file.replace(MONOREPO_ROOT + '/', ''));
          failures.push({ cmd, files: filesWithCmd, error: 'not found' });
        }
      } catch (error) {
        const filesWithCmd = [...commandsPerFile.entries()]
          .filter(([, cmds]) => cmds.includes(cmd))
          .map(([file]) => file.replace(MONOREPO_ROOT + '/', ''));
        failures.push({ cmd, files: filesWithCmd, error: (error as Error).message });
      }
    }

    // Format failures for readable output
    if (failures.length > 0) {
      const message = failures
        .map((f) => `  ${f.cmd}\n    Error: ${f.error}\n    Referenced in: ${f.files.join(', ')}`)
        .join('\n');
      expect.fail(`Doc reference validation failures:\n${message}`);
    }
  });
});
