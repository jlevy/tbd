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
import { TBD_DIR, CACHE_DIR, DATA_SYNC_DIR, ISSUES_DIR } from '../../lib/paths.js';

interface InitOptions {
  syncBranch?: string;
  remote?: string;
}

class InitHandler extends BaseCommand {
  async run(options: InitOptions): Promise<void> {
    const cwd = process.cwd();

    // Check if already initialized
    try {
      await stat(join(cwd, TBD_DIR));
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
      this.output.debug(`Created ${TBD_DIR}/config.yml`);

      // 2. Create .tbd/.gitignore
      const gitignoreContent = [
        '# Local cache (not shared)',
        'cache/',
        '',
        '# Temporary files',
        '*.tmp',
        '',
      ].join('\n');
      await writeFile(join(cwd, TBD_DIR, '.gitignore'), gitignoreContent);
      this.output.debug(`Created ${TBD_DIR}/.gitignore`);

      // 3. Create .tbd/cache/ directory
      await mkdir(join(cwd, CACHE_DIR), { recursive: true });
      this.output.debug(`Created ${CACHE_DIR}/`);

      // 4. Create issues directory placeholder
      await mkdir(join(cwd, ISSUES_DIR), { recursive: true });
      await writeFile(join(cwd, DATA_SYNC_DIR, '.gitkeep'), '');
      this.output.debug(`Created ${ISSUES_DIR}/`);
    }, 'Failed to initialize tbd');

    this.output.data({ initialized: true, version: VERSION }, () => {
      this.output.success('Initialized tbd repository');
      this.output.info('');
      this.output.info('To complete setup, commit the config files:');
      this.output.info(`  git add ${TBD_DIR}/ ${DATA_SYNC_DIR}/`);
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
