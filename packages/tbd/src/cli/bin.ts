/**
 * CLI binary entry point.
 * This file should be minimal - just imports and runs the CLI.
 */

import { runCli } from './cli.js';
import { EXIT_SUCCESS } from './lib/exit-codes.js';

// Handle EPIPE errors gracefully when output is piped to commands like `head`
// or when a pager closes. Both stdout and stderr can receive EPIPE.
// Exit code 0 is standard - this is intentional user action, not an error.
process.stdout.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EPIPE') {
    process.exit(EXIT_SUCCESS);
  }
  throw err;
});
process.stderr.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EPIPE') {
    process.exit(EXIT_SUCCESS);
  }
  throw err;
});

void runCli();
