/**
 * `tbd prime` - Output workflow context for AI agents.
 *
 * Designed to be called by hooks at session start and before context compaction
 * to ensure agents remember the tbd workflow.
 *
 * See: tbd-design-v3.md §6.4.3 The tbd prime Command
 */

import { Command } from 'commander';
import { readFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';

import { BaseCommand } from '../lib/baseCommand.js';
import { isInitialized } from '../../file/config.js';

interface PrimeOptions {
  full?: boolean;
  mcp?: boolean;
  export?: boolean;
}

/**
 * MCP mode output (~50 tokens, when MCP server detected)
 */
const MCP_MODE_OUTPUT = `# Tbd Issue Tracker Active

# 🚨 SESSION CLOSE PROTOCOL 🚨

Before saying "done": git status → git add → tbd sync → git commit → tbd sync → git push

## Core Rules
- Track strategic work in tbd (multi-session, dependencies, discovered work)
- TodoWrite is fine for simple single-session linear tasks

Start: Check \`tbd ready\` for available work.
`;

/**
 * CLI mode output (~1-2k tokens, full reference)
 */
const CLI_MODE_OUTPUT = `# Tbd Workflow Context

> **Context Recovery**: Run \`tbd prime\` after compaction, clear, or new session
> Hooks auto-call this in Claude Code when .tbd/ detected

# 🚨 SESSION CLOSE PROTOCOL 🚨

**CRITICAL**: Before saying "done" or "complete", you MUST run this checklist:

[ ] 1. git status              (check what changed)
[ ] 2. git add <files>         (stage code changes)
[ ] 3. tbd sync                (commit tbd changes)
[ ] 4. git commit -m "..."     (commit code)
[ ] 5. tbd sync                (commit any new tbd changes)
[ ] 6. git push                (push to remote)

**NEVER skip this.** Work is not done until pushed.

## Core Rules
- Track strategic work in tbd (multi-session, dependencies, discovered work)
- Use \`tbd create\` for issues, TodoWrite for simple single-session execution
- When in doubt, prefer tbd—persistence you don't need beats lost context
- Git workflow: run \`tbd sync\` at session end
- Session management: check \`tbd ready\` for available work

## Essential Commands

### Finding Work
- \`tbd ready\` - Show issues ready to work (no blockers)
- \`tbd list --status open\` - All open issues
- \`tbd list --status in_progress\` - Your active work
- \`tbd show <id>\` - Detailed issue view with dependencies

### Creating & Updating
- \`tbd create "title" --type task|bug|feature --priority 2\` - New issue
  - Priority: 0-4 (0=critical, 2=medium, 4=backlog)
- \`tbd update <id> --status in_progress\` - Claim work
- \`tbd update <id> --assignee username\` - Assign to someone
- \`tbd close <id>\` - Mark complete
- \`tbd close <id> --reason "explanation"\` - Close with reason

### Dependencies & Blocking
- \`tbd dep add <issue> <depends-on>\` - Add dependency
- \`tbd blocked\` - Show all blocked issues
- \`tbd show <id>\` - See what's blocking/blocked by this issue

### Sync & Collaboration
- \`tbd sync\` - Sync with git remote (run at session end)
- \`tbd sync --status\` - Check sync status without syncing

### Project Health
- \`tbd stats\` - Project statistics (open/closed/blocked counts)
- \`tbd doctor\` - Check for issues (sync problems, health checks)

## Common Workflows

**Starting work:**
tbd ready           # Find available work
tbd show <id>       # Review issue details
tbd update <id> --status in_progress  # Claim it

**Completing work:**
tbd close <id>      # Mark complete
tbd sync            # Push to remote

**Creating dependent work:**
tbd create "Implement feature X" --type feature
tbd create "Write tests for X" --type task
tbd dep add <tests-id> <feature-id>  # Tests depend on feature
`;

/**
 * Check if MCP mode is enabled by looking for tbd in Claude settings.
 */
async function isMcpEnabled(): Promise<boolean> {
  try {
    const settingsPath = join(homedir(), '.claude', 'settings.json');
    const content = await readFile(settingsPath, 'utf-8');
    const settings = JSON.parse(content) as Record<string, unknown>;

    // Check if mcpServers contains a tbd-related server
    const mcpServers = settings.mcpServers as Record<string, unknown> | undefined;
    if (!mcpServers) return false;

    // Look for any server with "tbd" in its name
    for (const name of Object.keys(mcpServers)) {
      if (name.toLowerCase().includes('tbd')) {
        return true;
      }
    }

    return false;
  } catch {
    // Settings file doesn't exist or is invalid
    return false;
  }
}

class PrimeHandler extends BaseCommand {
  async run(options: PrimeOptions): Promise<void> {
    const cwd = process.cwd();

    // Silent exit if not in a tbd project
    if (!(await isInitialized(cwd))) {
      // Exit silently with code 0 (no output, no error)
      return;
    }

    // Check for custom override file
    const customPrimePath = join(cwd, '.tbd', 'PRIME.md');

    // If --export, always show default content
    if (!options.export) {
      try {
        await access(customPrimePath);
        const customContent = await readFile(customPrimePath, 'utf-8');
        console.log(customContent);
        return;
      } catch {
        // No custom file, use default
      }
    }

    // Determine output mode
    let useMcpMode: boolean;

    if (options.full) {
      useMcpMode = false;
    } else if (options.mcp) {
      useMcpMode = true;
    } else {
      // Auto-detect: check if MCP server is configured
      useMcpMode = await isMcpEnabled();
    }

    // Output appropriate content
    const content = useMcpMode ? MCP_MODE_OUTPUT : CLI_MODE_OUTPUT;
    console.log(content);
  }
}

export const primeCommand = new Command('prime')
  .description('Output workflow context for AI agents')
  .option('--full', 'Force full CLI output (ignore MCP detection)')
  .option('--mcp', 'Force MCP mode (minimal output, ~50 tokens)')
  .option('--export', 'Output default content (ignores PRIME.md override)')
  .action(async (options, command) => {
    const handler = new PrimeHandler(command);
    await handler.run(options);
  });
