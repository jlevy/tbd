/**
 * `tbd init` - Initialize tbd in a repository.
 *
 * See: tbd-design-v3.md §4.3 Initialization
 */

import { Command } from 'commander';
import { mkdir, writeFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

import { BaseCommand } from '../lib/baseCommand.js';
import { VERSION } from '../../index.js';
import { initConfig } from '../../file/config.js';

interface InitOptions {
  syncBranch?: string;
  remote?: string;
}

class InitHandler extends BaseCommand {
  async run(options: InitOptions): Promise<void> {
    const cwd = process.cwd();

    // Check if already initialized
    try {
      await stat(join(cwd, '.tbd'));
      this.output.error('tbd is already initialized in this directory');
      return;
    } catch {
      // Not initialized - continue
    }

    if (this.checkDryRun('Would initialize tbd repository', options)) {
      return;
    }

    await this.execute(async () => {
      // 1. Create .tbd/ directory with config.yml
      await initConfig(cwd, VERSION);
      this.output.debug('Created .tbd/config.yml');

      // 2. Create .tbd/.gitignore
      const gitignoreContent = [
        '# Local cache (not shared)',
        'cache/',
        '',
        '# Temporary files',
        '*.tmp',
        '',
      ].join('\n');
      await writeFile(join(cwd, '.tbd', '.gitignore'), gitignoreContent);
      this.output.debug('Created .tbd/.gitignore');

      // 3. Create .tbd/cache/ directory
      await mkdir(join(cwd, '.tbd', 'cache'), { recursive: true });
      this.output.debug('Created .tbd/cache/');

      // 4. Create issues directory placeholder
      await mkdir(join(cwd, '.tbd-sync', 'issues'), { recursive: true });
      await writeFile(join(cwd, '.tbd-sync', '.gitkeep'), '');
      this.output.debug('Created .tbd-sync/issues/');
    }, 'Failed to initialize tbd');

    this.output.data({ initialized: true, version: VERSION }, () => {
      this.output.success('Initialized tbd repository');
      this.output.info('');
      this.output.info('To complete setup, commit the config files:');
      this.output.info('  git add .tbd/ .tbd-sync/');
      this.output.info('  git commit -m "Initialize tbd"');
    });
  }
}

export const initCommand = new Command('init')
  .description('Initialize tbd in a git repository')
  .option('--sync-branch <name>', 'Sync branch name (default: tbd-sync)')
  .option('--remote <name>', 'Remote name (default: origin)')
  .action(async (options, command) => {
    const handler = new InitHandler(command);
    await handler.run(options);
  });
