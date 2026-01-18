/**
 * `tbd beads` - Beads migration utilities.
 *
 * Subcommands:
 * - `tbd beads disable` - Disable Beads and move files to .beads-disabled/
 *
 * This command helps users safely migrate from Beads to tbd by moving
 * Beads configuration files to a backup directory rather than deleting them.
 */

import { Command } from 'commander';
import { readFile, mkdir, rename, access, readdir, stat, copyFile } from 'node:fs/promises';
import { execSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { writeFile } from 'atomically';

import { BaseCommand } from '../lib/baseCommand.js';

interface BeadsDisableOptions {
  confirm?: boolean;
}

// Markers for AGENTS.md beads section
const BEADS_BEGIN_MARKER = '<!-- BEGIN BEADS INTEGRATION -->';
const BEADS_END_MARKER = '<!-- END BEADS INTEGRATION -->';

interface DisableItem {
  source: string;
  destination: string;
  description: string;
  type: 'directory' | 'file' | 'config-hooks';
  exists: boolean;
  details?: string;
}

class BeadsDisableHandler extends BaseCommand {
  async run(options: BeadsDisableOptions): Promise<void> {
    const colors = this.output.getColors();
    const cwd = process.cwd();
    const disabledDir = join(cwd, '.beads-disabled');

    // Collect all items that could be disabled
    const items: DisableItem[] = [];

    // 1. Check .beads/ directory
    const beadsDir = join(cwd, '.beads');
    const beadsDirExists = await this.pathExists(beadsDir);
    if (beadsDirExists) {
      const stats = await this.getDirectoryStats(beadsDir);
      items.push({
        source: '.beads/',
        destination: '.beads-disabled/beads/',
        description: 'Beads data directory',
        type: 'directory',
        exists: true,
        details: `${stats.files} files`,
      });
    }

    // 2. Check .beads-hooks/ directory
    const beadsHooksDir = join(cwd, '.beads-hooks');
    const beadsHooksDirExists = await this.pathExists(beadsHooksDir);
    if (beadsHooksDirExists) {
      const stats = await this.getDirectoryStats(beadsHooksDir);
      items.push({
        source: '.beads-hooks/',
        destination: '.beads-disabled/beads-hooks/',
        description: 'Beads git hooks',
        type: 'directory',
        exists: true,
        details: `${stats.files} files`,
      });
    }

    // 3. Check .cursor/rules/beads.mdc
    const cursorBeadsFile = join(cwd, '.cursor', 'rules', 'beads.mdc');
    const cursorBeadsExists = await this.pathExists(cursorBeadsFile);
    if (cursorBeadsExists) {
      items.push({
        source: '.cursor/rules/beads.mdc',
        destination: '.beads-disabled/cursor-rules-beads.mdc',
        description: 'Cursor IDE Beads rules',
        type: 'file',
        exists: true,
      });
    }

    // 4. Check .claude/settings.local.json for bd hooks
    const claudeLocalSettings = join(cwd, '.claude', 'settings.local.json');
    const claudeHooksInfo = await this.checkClaudeLocalHooks(claudeLocalSettings);
    if (claudeHooksInfo.hasBeadsHooks) {
      items.push({
        source: '.claude/settings.local.json',
        destination: '.beads-disabled/claude-settings.local.json',
        description: 'Claude Code project hooks with bd commands',
        type: 'config-hooks',
        exists: true,
        details: claudeHooksInfo.hookCount + ' bd hook(s)',
      });
    }

    // 5. Check AGENTS.md for beads section
    const agentsMd = join(cwd, 'AGENTS.md');
    const agentsMdInfo = await this.checkAgentsMdBeads(agentsMd);
    if (agentsMdInfo.hasBeadsSection) {
      items.push({
        source: 'AGENTS.md',
        destination: '.beads-disabled/AGENTS.md.backup',
        description: 'AGENTS.md with Beads section',
        type: 'file',
        exists: true,
        details: 'contains beads integration markers',
      });
    }

    // Nothing to disable?
    if (items.length === 0) {
      this.output.info('No Beads files found to disable.');
      return;
    }

    // Show what will be moved
    console.log(colors.bold('The following Beads files will be moved to .beads-disabled/:'));
    console.log('');
    for (const item of items) {
      const details = item.details ? colors.dim(` (${item.details})`) : '';
      console.log(`  ${colors.warn(item.source)} → ${colors.dim(item.destination)}${details}`);
      console.log(`    ${colors.dim(item.description)}`);
    }
    console.log('');

    if (!options.confirm) {
      console.log(`This preserves all Beads data for potential rollback.`);
      console.log('');
      console.log(`To confirm, run: ${colors.dim('tbd beads --disable --confirm')}`);
      console.log('');
      console.log(colors.dim('After disabling Beads, run:'));
      console.log(colors.dim('  tbd setup claude   # Install tbd hooks'));
      console.log(colors.dim('  tbd setup cursor   # Install tbd Cursor rules (optional)'));
      console.log(colors.dim('  tbd setup codex    # Update AGENTS.md for tbd (optional)'));
      return;
    }

    // Check dry-run
    if (
      this.checkDryRun('Would disable Beads and move files', { items: items.map((i) => i.source) })
    ) {
      return;
    }

    // Perform the disable
    this.output.info('Disabling Beads...');

    // Stop the Beads daemon first (if running)
    try {
      const result = execSync('bd daemon stop', {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 5000,
      });
      // Check if daemon was actually stopped
      if (result.includes('stopped') || result.includes('Stopped')) {
        console.log(`  ${colors.success('✓')} Stopped Beads daemon`);
      } else {
        console.log(`  ${colors.dim('○')} Beads daemon was not running`);
      }
    } catch (error) {
      const errorMessage = (error as { message?: string }).message ?? '';
      if (errorMessage.includes('not running') || errorMessage.includes('No daemon')) {
        console.log(`  ${colors.dim('○')} Beads daemon was not running`);
      } else if (errorMessage.includes('command not found') || errorMessage.includes('ENOENT')) {
        console.log(`  ${colors.dim('○')} bd command not available (skipping daemon stop)`);
      } else {
        console.log(
          `  ${colors.warn('⚠')} Could not stop Beads daemon: ${errorMessage.split('\n')[0]}`,
        );
      }
    }

    // Create .beads-disabled/ directory
    await mkdir(disabledDir, { recursive: true });

    // Track successful operations for RESTORE.md
    const completed: { source: string; destination: string; action: string; restoreCmd: string }[] =
      [];

    for (const item of items) {
      const sourcePath = join(cwd, item.source);
      const destPath = join(cwd, item.destination);

      try {
        // Ensure destination directory exists
        await mkdir(dirname(destPath), { recursive: true });

        if (item.type === 'directory') {
          // Move directory
          await rename(sourcePath, destPath);
          console.log(`  ${colors.success('✓')} Moved ${item.source}`);
          completed.push({
            source: item.source,
            destination: item.destination,
            action: 'moved directory',
            restoreCmd: `mv ${item.destination} ${item.source}`,
          });
        } else if (item.type === 'file') {
          // Copy file (preserve original for AGENTS.md case where we might modify it)
          await copyFile(sourcePath, destPath);
          if (item.source === 'AGENTS.md') {
            // Remove beads section from AGENTS.md
            await this.removeBeadsSectionFromAgentsMd(agentsMd);
            console.log(
              `  ${colors.success('✓')} Backed up and removed Beads section from ${item.source}`,
            );
            completed.push({
              source: item.source,
              destination: item.destination,
              action: 'backed up original, removed Beads section from current',
              restoreCmd: `cp ${item.destination} ${item.source}`,
            });
          } else {
            // Move file
            await rename(sourcePath, destPath);
            console.log(`  ${colors.success('✓')} Moved ${item.source}`);
            completed.push({
              source: item.source,
              destination: item.destination,
              action: 'moved file',
              restoreCmd: `mv ${item.destination} ${item.source}`,
            });
          }
        } else if (item.type === 'config-hooks') {
          // Copy settings file first
          await copyFile(sourcePath, destPath);
          // Remove bd hooks from local settings
          await this.removeBeadsHooksFromClaudeSettings(claudeLocalSettings);
          console.log(
            `  ${colors.success('✓')} Backed up and removed bd hooks from ${item.source}`,
          );
          completed.push({
            source: item.source,
            destination: item.destination,
            action: 'backed up original, removed bd hooks from current',
            restoreCmd: `cp ${item.destination} ${item.source}`,
          });
        }
      } catch (error) {
        console.log(
          `  ${colors.warn('⚠')} Could not move ${item.source}: ${(error as Error).message}`,
        );
      }
    }

    // Write RESTORE.md with clear restore instructions
    if (completed.length > 0) {
      const restoreMd = this.generateRestoreMd(completed);
      const restorePath = join(disabledDir, 'RESTORE.md');
      await writeFile(restorePath, restoreMd);
      console.log(`  ${colors.success('✓')} Created RESTORE.md with rollback instructions`);
    }

    console.log('');
    this.output.success('Beads has been disabled.');
    console.log('');
    console.log('All Beads files have been moved to .beads-disabled/');
    console.log(colors.dim('See .beads-disabled/RESTORE.md for rollback instructions.'));
    console.log('');
    console.log(colors.dim('Next steps:'));
    console.log(colors.dim('  tbd setup claude   # Install tbd hooks'));
    console.log(colors.dim('  tbd setup cursor   # Install tbd Cursor rules (optional)'));
    console.log(colors.dim('  tbd setup codex    # Update AGENTS.md for tbd (optional)'));
  }

  private async pathExists(path: string): Promise<boolean> {
    try {
      await access(path);
      return true;
    } catch {
      return false;
    }
  }

  private async getDirectoryStats(dirPath: string): Promise<{ files: number; size: number }> {
    let files = 0;
    let size = 0;

    const walk = async (dir: string): Promise<void> => {
      try {
        const entries = await readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = join(dir, entry.name);
          if (entry.isDirectory()) {
            await walk(fullPath);
          } else {
            files++;
            try {
              const stats = await stat(fullPath);
              size += stats.size;
            } catch {
              // Ignore stat errors
            }
          }
        }
      } catch {
        // Ignore errors
      }
    };

    await walk(dirPath);
    return { files, size };
  }

  private async checkClaudeLocalHooks(
    settingsPath: string,
  ): Promise<{ hasBeadsHooks: boolean; hookCount: number }> {
    try {
      await access(settingsPath);
      const content = await readFile(settingsPath, 'utf-8');
      const settings = JSON.parse(content) as Record<string, unknown>;

      const hooks = settings.hooks as Record<string, unknown[]> | undefined;
      if (!hooks) {
        return { hasBeadsHooks: false, hookCount: 0 };
      }

      let hookCount = 0;
      for (const hookType of Object.keys(hooks)) {
        const hookArray = hooks[hookType] as { hooks?: { command?: string }[] }[];
        for (const hookEntry of hookArray) {
          if (hookEntry.hooks) {
            for (const hook of hookEntry.hooks) {
              if (
                hook.command &&
                (hook.command.includes('bd ') || hook.command.includes('bd prime'))
              ) {
                hookCount++;
              }
            }
          }
        }
      }

      return { hasBeadsHooks: hookCount > 0, hookCount };
    } catch {
      return { hasBeadsHooks: false, hookCount: 0 };
    }
  }

  private async removeBeadsHooksFromClaudeSettings(settingsPath: string): Promise<void> {
    const content = await readFile(settingsPath, 'utf-8');
    const settings = JSON.parse(content) as Record<string, unknown>;

    const hooks = settings.hooks as Record<string, unknown[]> | undefined;
    if (!hooks) return;

    // Filter out bd hooks from each hook type
    for (const hookType of Object.keys(hooks)) {
      const hookArray = hooks[hookType] as {
        matcher?: string;
        hooks?: { type?: string; command?: string }[];
      }[];
      hooks[hookType] = hookArray
        .map((entry) => {
          if (!entry.hooks) return entry;
          entry.hooks = entry.hooks.filter(
            (hook) =>
              !hook.command ||
              (!hook.command.includes('bd ') && !hook.command.includes('bd prime')),
          );
          return entry;
        })
        .filter((entry) => !entry.hooks || entry.hooks.length > 0);

      if ((hooks[hookType]).length === 0) {
        delete hooks[hookType];
      }
    }

    if (Object.keys(hooks).length === 0) {
      delete settings.hooks;
    }

    await writeFile(settingsPath, JSON.stringify(settings, null, 2) + '\n');
  }

  private async checkAgentsMdBeads(agentsMdPath: string): Promise<{ hasBeadsSection: boolean }> {
    try {
      await access(agentsMdPath);
      const content = await readFile(agentsMdPath, 'utf-8');
      return { hasBeadsSection: content.includes(BEADS_BEGIN_MARKER) };
    } catch {
      return { hasBeadsSection: false };
    }
  }

  private async removeBeadsSectionFromAgentsMd(agentsMdPath: string): Promise<void> {
    const content = await readFile(agentsMdPath, 'utf-8');

    const startIdx = content.indexOf(BEADS_BEGIN_MARKER);
    const endIdx = content.indexOf(BEADS_END_MARKER);

    if (startIdx === -1 || endIdx === -1 || startIdx > endIdx) {
      return; // No valid markers found
    }

    // Find the end of the end marker line
    let endOfEndMarker = endIdx + BEADS_END_MARKER.length;
    const nextNewline = content.indexOf('\n', endOfEndMarker);
    if (nextNewline !== -1) {
      endOfEndMarker = nextNewline + 1;
    }

    // Also remove leading blank lines before the section
    let trimStart = startIdx;
    while (trimStart > 0 && (content[trimStart - 1] === '\n' || content[trimStart - 1] === '\r')) {
      trimStart--;
    }

    const newContent = content.slice(0, trimStart) + content.slice(endOfEndMarker);

    // If file is now empty or just whitespace, leave it as is (don't delete)
    await writeFile(agentsMdPath, newContent);
  }

  private generateRestoreMd(
    completed: { source: string; destination: string; action: string; restoreCmd: string }[],
  ): string {
    const timestamp = new Date().toISOString();
    const lines: string[] = [
      '# Beads Restore Instructions',
      '',
      `Beads was disabled on: ${timestamp}`,
      '',
      '## What Was Changed',
      '',
      '| Original Location | Backup Location | Action |',
      '|-------------------|-----------------|--------|',
    ];

    for (const item of completed) {
      lines.push(`| \`${item.source}\` | \`${item.destination}\` | ${item.action} |`);
    }

    lines.push('');
    lines.push('## To Restore Beads');
    lines.push('');
    lines.push('Run the following commands from your project root:');
    lines.push('');
    lines.push('```bash');

    for (const item of completed) {
      lines.push(`# Restore ${item.source}`);
      lines.push(item.restoreCmd);
      lines.push('');
    }

    lines.push('# Optionally remove this backup directory');
    lines.push('rm -rf .beads-disabled/');
    lines.push('```');
    lines.push('');
    lines.push('## Notes');
    lines.push('');
    lines.push('- For files that had content removed (AGENTS.md, .claude/settings.local.json),');
    lines.push('  restoring will overwrite current content with the backed-up version.');
    lines.push('- If you have made changes to these files since disabling Beads,');
    lines.push('  you may need to manually merge the Beads content back in.');
    lines.push('- After restoring, you may need to restart the Beads daemon: `bd daemon start`');
    lines.push('');

    return lines.join('\n');
  }
}

interface BeadsOptions {
  disable?: boolean;
  confirm?: boolean;
}

// Main beads command with --disable flag
export const beadsCommand = new Command('beads')
  .description('Beads migration utilities')
  .option('--disable', 'Disable Beads and move files to .beads-disabled/')
  .option('--confirm', 'Confirm the operation (required to proceed)')
  .action(async (options: BeadsOptions, command: Command) => {
    if (options.disable) {
      const handler = new BeadsDisableHandler(command);
      await handler.run(options);
    } else {
      // Show help if no option specified
      console.log('Usage: tbd beads --disable [--confirm]');
      console.log('');
      console.log('Options:');
      console.log('  --disable   Disable Beads and move files to .beads-disabled/');
      console.log('  --confirm   Confirm the operation (required to proceed)');
      console.log('');
      console.log('This command helps migrate from Beads to tbd by safely');
      console.log('moving Beads configuration files to a backup directory.');
    }
  });
