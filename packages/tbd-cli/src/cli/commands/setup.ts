/**
 * `tbd setup` - Configure tbd integration with editors and tools.
 *
 * Subcommands:
 * - `tbd setup claude` - Configure Claude Code hooks
 * - `tbd setup cursor` - Create Cursor IDE rules file
 *
 * See: tbd-design-v3.md §6.4.2 Claude Code Integration
 */

import { Command } from 'commander';
import { readFile, mkdir, access, rm } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { writeFile } from 'atomically';

import { BaseCommand } from '../lib/baseCommand.js';

interface SetupClaudeOptions {
  check?: boolean;
  remove?: boolean;
}

interface SetupCursorOptions {
  check?: boolean;
  remove?: boolean;
}

/**
 * Claude Code hooks configuration
 */
const CLAUDE_HOOKS = {
  hooks: {
    SessionStart: [
      {
        matcher: '',
        hooks: [{ type: 'command', command: 'tbd prime' }],
      },
    ],
    PreCompact: [
      {
        matcher: '',
        hooks: [{ type: 'command', command: 'tbd prime' }],
      },
    ],
  },
};

/**
 * Cursor IDE rules content
 */
const CURSOR_RULES_CONTENT = `# Tbd Issue Tracker Integration

This project uses tbd for git-native issue tracking.

## Issue Tracking Workflow

- Check \`tbd ready\` for available work at session start
- Track strategic work with \`tbd create\`
- Close completed work with \`tbd close <id>\`
- Run \`tbd sync\` before session end

## Core Commands

- \`tbd ready\` - Show issues ready to work (no blockers)
- \`tbd list --status open\` - All open issues
- \`tbd show <id>\` - Issue details with dependencies
- \`tbd create "title" --type task\` - Create new issue
- \`tbd update <id> --status in_progress\` - Claim work
- \`tbd close <id>\` - Mark complete
- \`tbd sync\` - Sync with git remote

## Session Close Protocol

Before saying "done", run:
1. git status
2. git add <files>
3. tbd sync
4. git commit -m "..."
5. tbd sync
6. git push

For more info: \`tbd docs\`
`;

class SetupClaudeHandler extends BaseCommand {
  async run(options: SetupClaudeOptions): Promise<void> {
    const settingsPath = join(homedir(), '.claude', 'settings.json');

    if (options.check) {
      await this.checkClaudeSetup(settingsPath);
      return;
    }

    if (options.remove) {
      await this.removeClaudeHooks(settingsPath);
      return;
    }

    await this.installClaudeHooks(settingsPath);
  }

  private async checkClaudeSetup(settingsPath: string): Promise<void> {
    try {
      await access(settingsPath);
      const content = await readFile(settingsPath, 'utf-8');
      const settings = JSON.parse(content) as Record<string, unknown>;

      const hooks = settings.hooks as Record<string, unknown> | undefined;
      if (!hooks) {
        this.output.info('Claude Code hooks not configured');
        this.output.data({ installed: false });
        return;
      }

      // Check for tbd hooks
      const sessionStart = hooks.SessionStart as { hooks?: { command?: string }[] }[];
      const preCompact = hooks.PreCompact as { hooks?: { command?: string }[] }[];

      const hasSessionStartHook = sessionStart?.some((h) =>
        h.hooks?.some((hook) => hook.command?.includes('tbd prime')),
      );
      const hasPreCompactHook = preCompact?.some((h) =>
        h.hooks?.some((hook) => hook.command?.includes('tbd prime')),
      );

      if (hasSessionStartHook && hasPreCompactHook) {
        this.output.success('Claude Code hooks installed');
        this.output.data({ installed: true, sessionStart: true, preCompact: true });
      } else {
        this.output.warn('Claude Code hooks partially configured');
        this.output.data({
          installed: false,
          sessionStart: hasSessionStartHook,
          preCompact: hasPreCompactHook,
        });
      }
    } catch {
      this.output.info('Claude Code settings not found');
      this.output.data({ installed: false, settingsExists: false });
    }
  }

  private async removeClaudeHooks(settingsPath: string): Promise<void> {
    try {
      await access(settingsPath);
      const content = await readFile(settingsPath, 'utf-8');
      const settings = JSON.parse(content) as Record<string, unknown>;

      if (!settings.hooks) {
        this.output.info('No hooks to remove');
        return;
      }

      const hooks = settings.hooks as Record<string, unknown>;

      // Remove tbd hooks from SessionStart and PreCompact
      const filterHooks = (arr: { hooks?: { command?: string }[] }[] | undefined) => {
        if (!arr) return undefined;
        return arr.filter((h) => !h.hooks?.some((hook) => hook.command?.includes('tbd prime')));
      };

      const sessionStart = filterHooks(
        hooks.SessionStart as { hooks?: { command?: string }[] }[],
      );
      const preCompact = filterHooks(
        hooks.PreCompact as { hooks?: { command?: string }[] }[],
      );

      if (sessionStart?.length === 0) delete hooks.SessionStart;
      else if (sessionStart) hooks.SessionStart = sessionStart;

      if (preCompact?.length === 0) delete hooks.PreCompact;
      else if (preCompact) hooks.PreCompact = preCompact;

      if (Object.keys(hooks).length === 0) {
        delete settings.hooks;
      }

      await writeFile(settingsPath, JSON.stringify(settings, null, 2) + '\n');
      this.output.success('Removed tbd hooks from Claude Code');
    } catch {
      this.output.info('Claude Code settings not found');
    }
  }

  private async installClaudeHooks(settingsPath: string): Promise<void> {
    if (this.checkDryRun('Would install Claude Code hooks', { path: settingsPath })) {
      return;
    }

    try {
      // Ensure directory exists
      await mkdir(dirname(settingsPath), { recursive: true });

      // Load existing settings or create new
      let settings: Record<string, unknown> = {};
      try {
        await access(settingsPath);
        const content = await readFile(settingsPath, 'utf-8');
        settings = JSON.parse(content) as Record<string, unknown>;
      } catch {
        // File doesn't exist, start fresh
      }

      // Merge hooks
      const existingHooks = (settings.hooks as Record<string, unknown>) || {};
      settings.hooks = {
        ...existingHooks,
        ...CLAUDE_HOOKS.hooks,
      };

      await writeFile(settingsPath, JSON.stringify(settings, null, 2) + '\n');
      this.output.success('Installed tbd hooks for Claude Code');
      this.output.info('');
      this.output.info('Hooks added:');
      this.output.info('  - SessionStart: runs `tbd prime` at session start');
      this.output.info('  - PreCompact: runs `tbd prime` before context compaction');
      this.output.info('');
      this.output.info('Use `tbd setup claude --check` to verify installation');
    } catch (error) {
      this.output.error(`Failed to install hooks: ${(error as Error).message}`);
    }
  }
}

class SetupCursorHandler extends BaseCommand {
  async run(options: SetupCursorOptions): Promise<void> {
    const cwd = process.cwd();
    const rulesPath = join(cwd, '.cursor', 'rules', 'tbd.mdc');

    if (options.check) {
      await this.checkCursorSetup(rulesPath);
      return;
    }

    if (options.remove) {
      await this.removeCursorRules(rulesPath);
      return;
    }

    await this.installCursorRules(rulesPath);
  }

  private async checkCursorSetup(rulesPath: string): Promise<void> {
    try {
      await access(rulesPath);
      this.output.success('Cursor rules file exists');
      this.output.data({ installed: true, path: rulesPath });
    } catch {
      this.output.info('Cursor rules file not found');
      this.output.data({ installed: false });
    }
  }

  private async removeCursorRules(rulesPath: string): Promise<void> {
    try {
      await rm(rulesPath);
      this.output.success('Removed Cursor tbd rules file');
    } catch {
      this.output.info('Cursor rules file not found');
    }
  }

  private async installCursorRules(rulesPath: string): Promise<void> {
    if (this.checkDryRun('Would create Cursor rules file', { path: rulesPath })) {
      return;
    }

    try {
      // Ensure directory exists
      await mkdir(dirname(rulesPath), { recursive: true });

      await writeFile(rulesPath, CURSOR_RULES_CONTENT);
      this.output.success('Created Cursor rules file');
      this.output.info(`  ${rulesPath}`);
      this.output.info('');
      this.output.info('Cursor will now see tbd workflow instructions.');
      this.output.info('Use `tbd setup cursor --check` to verify installation');
    } catch (error) {
      this.output.error(`Failed to create rules file: ${(error as Error).message}`);
    }
  }
}

// Create subcommands
const claudeCommand = new Command('claude')
  .description('Configure Claude Code hooks for tbd integration')
  .option('--check', 'Verify installation status')
  .option('--remove', 'Remove tbd hooks')
  .action(async (options, command) => {
    const handler = new SetupClaudeHandler(command);
    await handler.run(options);
  });

const cursorCommand = new Command('cursor')
  .description('Create Cursor IDE rules file for tbd integration')
  .option('--check', 'Verify installation status')
  .option('--remove', 'Remove tbd rules file')
  .action(async (options, command) => {
    const handler = new SetupCursorHandler(command);
    await handler.run(options);
  });

// Main setup command
export const setupCommand = new Command('setup')
  .description('Configure tbd integration with editors and tools')
  .addCommand(claudeCommand)
  .addCommand(cursorCommand);
