/** `tbd web` - serve the local bead graph on loopback until interrupted. */

import { Command } from 'commander';
import { realpath, stat } from 'node:fs/promises';
import { resolve } from 'node:path';

import { readConfig } from '../../file/config.js';
import type { OperationLogger } from '../../lib/types.js';
import { BaseCommand } from '../lib/base-command.js';
import { requireInit, ValidationError } from '../lib/errors.js';
import { EXIT_INTERRUPTED, EXIT_SUCCESS } from '../lib/exit-codes.js';
import { ICONS } from '../lib/output.js';
import { suspendDefaultInterruptHandler } from '../lib/signal-handling.js';
import type { WebServerHandle } from '../web/server.js';

interface WebOptions {
  port?: string;
  open?: boolean;
}

interface WebDescriptor {
  url: string;
  port: number;
  pid: number;
  repo: string;
  syncBranch: string;
}

function parsePort(value: string | undefined): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!/^\d+$/u.test(value)) {
    throw new ValidationError('--port must be an integer between 1 and 65535');
  }
  const port = Number(value);
  if (!Number.isSafeInteger(port) || port < 1 || port > 65_535) {
    throw new ValidationError('--port must be an integer between 1 and 65535');
  }
  return port;
}

async function resolveBaseDirectory(value: string | undefined): Promise<string> {
  const requested = resolve(value ?? '.');
  try {
    const canonical = await realpath(requested);
    if (!(await stat(canonical)).isDirectory()) {
      throw new ValidationError(`Base path is not a directory: ${requested}`);
    }
    return canonical;
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error.code === 'ENOENT' || error.code === 'ENOTDIR')
    ) {
      throw new ValidationError(`Base directory does not exist: ${requested}`);
    }
    const detail = error instanceof Error ? error.message : String(error);
    throw new ValidationError(`Cannot access base directory ${requested}: ${detail}`);
  }
}

class WebHandler extends BaseCommand {
  async run(baseDir: string | undefined, options: WebOptions): Promise<void> {
    const port = parsePort(options.port);
    const repo = await requireInit(await resolveBaseDirectory(baseDir));
    const serverModule = await import('../web/server.js');

    if (this.ctx.dryRun) {
      const config = await readConfig(repo);
      const resolvedPort = await serverModule.resolveWebPort({ port });
      this.printDescriptor(
        {
          url: `http://127.0.0.1:${resolvedPort}`,
          port: resolvedPort,
          pid: process.pid,
          repo,
          syncBranch: config.sync.branch,
        },
        true,
      );
      return;
    }

    // This may initialize, migrate, or repair under the shared writer lock. Keep the
    // default SIGINT behavior until it finishes so an interrupted startup never waits
    // for the long-running command's graceful-shutdown path.
    const initialContext = await serverModule.prepareWebContext(repo);

    const spinner = this.output.spinner('Starting tbd web...');
    const logger: OperationLogger = this.output.logger(spinner);
    const restoreDefault = suspendDefaultInterruptHandler();
    let firstSignal: NodeJS.Signals | null = null;
    let resolveSignal!: (signal: NodeJS.Signals) => void;
    const signaled = new Promise<NodeJS.Signals>((resolve) => {
      resolveSignal = resolve;
    });
    const receiveSignal = (signal: NodeJS.Signals): void => {
      if (firstSignal !== null) {
        process.exit(this.signalExitCode(firstSignal));
      }
      firstSignal = signal;
      resolveSignal(signal);
    };
    const onSigint = (): void => {
      receiveSignal('SIGINT');
    };
    const onSigterm = (): void => {
      receiveSignal('SIGTERM');
    };
    process.on('SIGINT', onSigint);
    process.on('SIGTERM', onSigterm);

    let handle: WebServerHandle | null = null;
    try {
      const startup = serverModule.startWebServer({
        repoDir: repo,
        initialContext,
        port,
        logger,
      });
      const first = await Promise.race([
        startup.then((started) => ({ kind: 'started', handle: started }) as const),
        signaled.then((signal) => ({ kind: 'signal', signal }) as const),
      ]);
      if (first.kind === 'signal') {
        // Startup owns any partially-created resources and is bounded by readiness
        // timeouts. Let it settle, then close a successfully-created handle.
        try {
          handle = await startup;
          await handle.close();
        } catch {
          // An interrupted startup failure has already performed server cleanup.
        }
        process.exitCode = this.signalExitCode(first.signal);
        return;
      }
      handle = first.handle;
      spinner.stop();

      const descriptor: WebDescriptor = {
        url: handle.url,
        port: handle.port,
        pid: process.pid,
        repo,
        syncBranch: initialContext.config.sync.branch,
      };
      this.printDescriptor(descriptor, false);

      if (options.open === true && firstSignal === null) {
        try {
          await serverModule.openWebBrowser(handle.url);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          this.output.warn(`Could not open a browser (${message}); use ${handle.url}`);
        }
      }

      const outcome = await Promise.race([handle.closed.then(() => null), signaled]);
      // `close()` is idempotent and owns the observer/SSE teardown too. Run it even if the
      // listener closed first so an unexpected socket shutdown cannot strand observation.
      await handle.close();
      process.exitCode = outcome === null ? EXIT_SUCCESS : this.signalExitCode(outcome);
    } finally {
      spinner.stop();
      process.off('SIGINT', onSigint);
      process.off('SIGTERM', onSigterm);
      restoreDefault();
    }
  }

  private printDescriptor(descriptor: WebDescriptor, dryRun: boolean): void {
    this.output.data(descriptor, () => {
      const colors = this.output.getColors();
      console.log(colors.bold(dryRun ? 'TBD WEB (DRY RUN)' : 'TBD WEB'));
      console.log('');
      console.log(`${ICONS.NOTICE} URL:        ${descriptor.url}`);
      console.log(`${ICONS.NOTICE} Repository: ${descriptor.repo}`);
      console.log(`${ICONS.NOTICE} Sync branch: ${descriptor.syncBranch}`);
      console.log(`${ICONS.NOTICE} Access:      loopback, live read-only viewer`);
      if (!dryRun) {
        console.log('');
        console.log(
          colors.dim('Ask your agent to change beads; ordinary tbd commands update this page.'),
        );
        console.log(colors.dim('Press Ctrl+C to stop.'));
      }
    });
  }

  private signalExitCode(signal: NodeJS.Signals): number {
    return signal === 'SIGINT' ? EXIT_INTERRUPTED : EXIT_SUCCESS;
  }
}

export const webCommand = new Command('web')
  .description('Serve a live, read-only bead view on loopback')
  .argument('[path]', 'Repository or subdirectory to view (default: current directory)')
  .option('--port <n>', 'Bind exactly this loopback port (default: search from 7777)')
  .option('--open', 'Open the page in the default browser after HTTP readiness')
  .action(async (path: string | undefined, options: WebOptions, command: Command) => {
    const handler = new WebHandler(command);
    await handler.run(path, options);
  });
