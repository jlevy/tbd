import { EXIT_SUCCESS } from './exit-codes.js';

/**
 * Treat an expected close of primary stdout as quiet only when no failure has
 * already selected a nonzero process outcome.
 */
export function handlePrimaryStdoutError(error: NodeJS.ErrnoException): void {
  if (error.code === 'EPIPE') {
    process.exitCode ??= EXIT_SUCCESS;
    return;
  }
  throw error;
}

/** Diagnostic output failure must never turn an operational failure into success. */
export function handleDiagnosticStreamError(error: NodeJS.ErrnoException): never {
  throw error;
}
