/**
 * Regression for tbd-q5c7: `tbd sync --status --json` printed a human "Docs:" banner
 * on stdout ahead of the JSON document whenever the docs cache was stale, breaking
 * every consumer that pipes the command into a JSON parser.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { printDocSyncStatus } from '../src/cli/lib/docs-sync-output.js';
import { OutputManager } from '../src/cli/lib/output.js';
import type { CommandContext } from '../src/cli/lib/context.js';
import type { SyncDocsResult } from '../src/file/doc-sync.js';

function contextWith(json: boolean): CommandContext {
  return {
    dryRun: false,
    verbose: false,
    quiet: false,
    json,
    color: 'never',
    debug: false,
  } as CommandContext;
}

/** A stale cache: exactly the state that used to leak the banner. */
const staleResult: SyncDocsResult = {
  added: [{ path: 'shortcuts/standard/new.md' }],
  updated: [{ path: 'guidelines/changed.md' }],
  removed: [],
  pruned: [],
  errors: [],
} as unknown as SyncDocsResult;

describe('printDocSyncStatus (tbd-q5c7)', () => {
  let logged: string[];
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logged = [];
    logSpy = vi.spyOn(console, 'log').mockImplementation((...parts: unknown[]) => {
      logged.push(parts.join(' '));
    });
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it('emits nothing to stdout under --json, even with a stale cache', () => {
    printDocSyncStatus(new OutputManager(contextWith(true)), staleResult);
    expect(logged).toEqual([]);
  });

  it('still prints the banner in text mode', () => {
    printDocSyncStatus(new OutputManager(contextWith(false)), staleResult);
    expect(logged.some((line) => line.includes('Docs:'))).toBe(true);
    expect(logged.some((line) => line.includes('new doc(s) available'))).toBe(true);
  });
});
