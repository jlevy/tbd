/** Process-wide default interrupt policy with an explicit long-running-command lease. */

import { EXIT_INTERRUPTED } from './exit-codes.js';

let installed = false;

function defaultInterruptHandler(): never {
  console.error('\nInterrupted');
  process.exit(EXIT_INTERRUPTED);
}

export function installDefaultInterruptHandler(): void {
  if (installed) {
    return;
  }
  process.on('SIGINT', defaultInterruptHandler);
  installed = true;
}

/** Temporarily remove the eager CLI handler while a command performs bounded teardown. */
export function suspendDefaultInterruptHandler(): () => void {
  if (!installed) {
    return () => {};
  }
  process.off('SIGINT', defaultInterruptHandler);
  installed = false;
  let restored = false;
  return () => {
    if (restored) {
      return;
    }
    restored = true;
    installDefaultInterruptHandler();
  };
}
