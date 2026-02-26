/**
 * `tbd uninstall` - Remove tbd from a repository.
 *
 * Removes the .tbd directory, worktree, and optionally the sync branch.
 */

import { Command } from 'commander';
import { rm, access, readdir, stat } from 'node:fs/promises';
import { execSync } from 'node:child_process';
import { join, relative } from 'node:path';

import { BaseCommand } from '../lib/base-command.js';
import { NotInitializedError, CLIError } from '../lib/errors.js';
import { findTbdRoot, readConfig } from '../../file/config.js';
import {
  branchExists,
  remoteBranchExists,
  isBranchCheckedOutInOtherWorktree,
} from '../../file/git.js';
import { resolveSyncBranchRefs, listManagedLocalBranches } from '../../file/sync-branch.js';
import { SYNC_BRANCH } from '../../lib/paths.js';

interface UninstallOptions {
  confirm?: boolean;
  keepBranch?: boolean;
  removeRemote?: boolean;
}

class UninstallHandler extends BaseCommand {
  async run(options: UninstallOptions): Promise<void> {
    const colors = this.output.getColors();

    // Resolve tbd root (walks up from cwd)
    const tbdRoot = await findTbdRoot(process.cwd());
    if (!tbdRoot) {
      throw new NotInitializedError('No .tbd directory found. Nothing to uninstall.');
    }

    // Read config to get branch info
    let config;
    try {
      config = await readConfig(tbdRoot);
    } catch {
      config = null;
    }

    let syncBranch = config?.sync.branch ?? SYNC_BRANCH;
    let remote = config?.sync.remote ?? 'origin';
    if (config) {
      try {
        const refs = await resolveSyncBranchRefs(tbdRoot, config, { forWrite: false });
        syncBranch = refs.remoteSyncBranch;
        remote = refs.remoteName;
      } catch {
        // Keep config-derived defaults
      }
    }

    const managedLocalBranches = await listManagedLocalBranches(tbdRoot, syncBranch);
    const candidateLocalBranches = Array.from(new Set([syncBranch, ...managedLocalBranches]));
    const removableLocalBranches: string[] = [];
    for (const candidate of candidateLocalBranches) {
      if (await branchExists(candidate)) {
        removableLocalBranches.push(candidate);
      }
    }

    const tbdDir = join(tbdRoot, '.tbd');
    const worktreePath = join(tbdDir, 'data-sync-worktree');

    // Display paths relative to cwd for readability
    const displayPath = (p: string) => relative(process.cwd(), p) || p;

    // Check what exists
    const items: string[] = [];

    // Check worktree
    let worktreeExists = false;
    try {
      await access(worktreePath);
      worktreeExists = true;
      const worktreeStats = await this.getDirectoryStats(worktreePath);
      items.push(`  - Worktree: ${displayPath(worktreePath)} (${worktreeStats.files} files)`);
    } catch {
      // Worktree doesn't exist
    }

    // Check local sync branches
    const localBranchExists = removableLocalBranches.length > 0;
    if (localBranchExists && !options.keepBranch) {
      for (const branch of removableLocalBranches) {
        items.push(`  - Local branch: ${branch}`);
      }
    }

    // Check remote sync branch
    let remoteBranchPresent = false;
    if (options.removeRemote) {
      if (await remoteBranchExists(remote, syncBranch)) {
        remoteBranchPresent = true;
        items.push(`  - Remote branch: ${remote}/${syncBranch}`);
      }
    }

    // Count .tbd contents
    const tbdStats = await this.getDirectoryStats(tbdDir);
    items.push(`  - Directory: ${displayPath(tbdDir)}/ (${tbdStats.files} files)`);

    // Show what will be removed
    console.log(colors.bold('The following will be removed:'));
    console.log('');
    for (const item of items) {
      console.log(colors.warn(item));
    }
    console.log('');

    if (!options.confirm) {
      console.log(`This action is ${colors.bold('irreversible')}.`);
      console.log('');
      console.log(`To confirm, run: ${colors.dim('tbd uninstall --confirm')}`);
      if (!options.keepBranch && localBranchExists) {
        console.log(
          `To keep the sync branch: ${colors.dim('tbd uninstall --confirm --keep-branch')}`,
        );
      }
      if (!options.removeRemote) {
        console.log(
          `To also remove from remote: ${colors.dim('tbd uninstall --confirm --remove-remote')}`,
        );
      }
      return;
    }

    // Check dry-run
    if (this.checkDryRun('Would remove tbd from repository', { items })) {
      return;
    }

    // Perform uninstall
    this.output.info('Uninstalling tbd...');

    // 1. Remove worktree first (git worktree remove)
    if (worktreeExists) {
      try {
        // First try to remove the worktree through git
        execSync(`git worktree remove --force "${worktreePath}"`, {
          encoding: 'utf-8',
          stdio: ['ignore', 'pipe', 'ignore'],
        });
        console.log(`  ${colors.success('✓')} Removed git worktree`);
      } catch {
        // If git worktree remove fails, force delete the directory
        try {
          await rm(worktreePath, { recursive: true, force: true });
          console.log(`  ${colors.success('✓')} Removed worktree directory`);
        } catch {
          console.log(`  ${colors.warn('⚠')} Could not remove worktree directory`);
        }
      }
    }

    // 2. Remove local sync branches
    if (localBranchExists && !options.keepBranch) {
      for (const branch of removableLocalBranches) {
        const inUse = await isBranchCheckedOutInOtherWorktree(tbdRoot, branch);
        if (inUse) {
          console.log(
            `  ${colors.warn('⚠')} Skipped local branch in use by another worktree: ${branch}`,
          );
          continue;
        }

        try {
          execSync(`git branch -D -- "${branch}"`, {
            encoding: 'utf-8',
            stdio: ['ignore', 'pipe', 'ignore'],
          });
          console.log(`  ${colors.success('✓')} Removed local branch: ${branch}`);
        } catch {
          console.log(`  ${colors.warn('⚠')} Could not remove local branch: ${branch}`);
        }
      }
    }

    // 3. Remove remote sync branch
    if (remoteBranchPresent && options.removeRemote) {
      try {
        execSync(`git push ${remote} --delete ${syncBranch}`, {
          encoding: 'utf-8',
          stdio: ['ignore', 'pipe', 'ignore'],
        });
        console.log(`  ${colors.success('✓')} Removed remote branch: ${remote}/${syncBranch}`);
      } catch {
        console.log(
          `  ${colors.warn('⚠')} Could not remove remote branch: ${remote}/${syncBranch}`,
        );
      }
    }

    // 4. Clean up orphaned worktree references
    try {
      execSync('git worktree prune', {
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'ignore'],
      });
    } catch {
      // Ignore errors
    }

    // 5. Remove .tbd directory
    try {
      await rm(tbdDir, { recursive: true, force: true });
      console.log(`  ${colors.success('✓')} Removed .tbd directory`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new CLIError(`Failed to remove .tbd directory: ${message}`);
    }

    console.log('');
    this.output.success('tbd has been uninstalled from this repository.');

    if (options.keepBranch && localBranchExists) {
      console.log('');
      if (removableLocalBranches.length === 1) {
        console.log(
          colors.dim(
            `Note: The ${removableLocalBranches[0]} branch was preserved. Delete it with:`,
          ),
        );
        console.log(colors.dim(`  git branch -D ${removableLocalBranches[0]}`));
      } else {
        console.log(colors.dim('Note: Local sync branches were preserved:'));
        for (const branch of removableLocalBranches) {
          console.log(colors.dim(`  - ${branch}`));
        }
      }
    }

    if (!options.removeRemote && remoteBranchPresent) {
      console.log('');
      console.log(
        colors.dim(
          `Note: The remote ${remote}/${syncBranch} branch was preserved. Delete it with:`,
        ),
      );
      console.log(colors.dim(`  git push ${remote} --delete ${syncBranch}`));
    }
  }

  /**
   * Get stats about a directory (file count, size).
   */
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
}

export const uninstallCommand = new Command('uninstall')
  .description('Remove tbd from this repository')
  .option('--confirm', 'Confirm removal (required to proceed)')
  .option('--keep-branch', 'Keep the local sync branch')
  .option('--remove-remote', 'Also remove the remote sync branch')
  .action(async (options, command) => {
    const handler = new UninstallHandler(command);
    await handler.run(options);
  });
