/**
 * CLI binary entry point.
 * This file should be minimal - just imports and runs the CLI.
 */

import { runCli } from './cli.js';
import {
  handleDiagnosticStreamError,
  handlePrimaryStdoutError,
} from './lib/process-stream-errors.js';

// Only primary stdout has the Unix early-consumer success policy. Keep stderr
// failures nonzero and preserve any failure outcome already selected by runCli().
process.stdout.on('error', handlePrimaryStdoutError);
process.stderr.on('error', handleDiagnosticStreamError);

void runCli();
