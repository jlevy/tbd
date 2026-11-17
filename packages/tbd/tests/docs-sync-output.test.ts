/**
 * Regression for tbd-q5c7: `tbd sync --status --json` printed a human "Docs:" banner
 * on stdout ahead of the JSON document whenever the docs cache was stale, breaking
 * every consumer that pipes the command into a JSON parser.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  printDocSyncDryRun,
  printDocSyncResult,
  printDocSyncStatus,
} from '../src/cli/lib/docs-sync-output.js';
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
  configChanged: false,
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

describe('printDocSyncDryRun (tbd-y42m)', () => {
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

  it('reports pending writes as a dry run, never as a completed sync', () => {
    const pending = {
      ...staleResult,
      pruned: ['shortcuts/standard/gone.md'],
      configChanged: true,
    } as unknown as SyncDocsResult;
    printDocSyncDryRun(new OutputManager(contextWith(false)), pending);
    expect(logged).toEqual([
      '[DRY-RUN] Would sync docs: +1 ~1 doc(s); remove 1 stale config entry/entries; ' +
        'update docs_cache in .tbd/config.yml',
    ]);
  });

  it('emits one dry-run document with the counts under --json', () => {
    printDocSyncDryRun(new OutputManager(contextWith(true)), staleResult);
    expect(logged.map((line) => JSON.parse(line) as unknown)).toEqual([
      {
        dryRun: true,
        action: 'Would sync docs: +1 ~1 doc(s)',
        added: 1,
        updated: 1,
        removed: 0,
        pruned: 0,
        configChanged: false,
      },
    ]);
  });
});

describe('doc sync printers', () => {
  let logged: string[];
  let errors: string[];
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logged = [];
    errors = [];
    logSpy = vi.spyOn(console, 'log').mockImplementation((...parts: unknown[]) => {
      logged.push(parts.join(' '));
    });
    errorSpy = vi.spyOn(console, 'error').mockImplementation((...parts: unknown[]) => {
      errors.push(parts.join(' '));
    });
  });

  afterEach(() => {
    logSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('report the same doc counts in the dry run and the real sync', () => {
    const changed = {
      ...staleResult,
      removed: ['guidelines/old.md'],
    } as unknown as SyncDocsResult;
    printDocSyncDryRun(new OutputManager(contextWith(false)), changed);
    printDocSyncResult(new OutputManager(contextWith(false)), changed);
    expect(logged).toEqual([
      '[DRY-RUN] Would sync docs: +1 ~1 -1 doc(s)',
      '✓ Synced docs: +1 ~1 -1 doc(s)',
    ]);
  });

  // A doc path is a key in `.tbd/config.yml`, and the error can quote its source: a
  // dry run in an untrusted repository must not let either drive the terminal.
  const hostile = {
    ...staleResult,
    errors: [
      {
        path: 'guidelines/x\u001b[2J\u001b]0;PWNED\u0007\u202e.md',
        error: 'cannot read \u001b[31mrepo\u001b[0m\nsecond line\u009b',
      },
    ],
  } as unknown as SyncDocsResult;
  const controls = /[\p{Cc}\p{Cf}]/u;

  it.each([
    { name: 'dry run', print: printDocSyncDryRun },
    { name: 'real sync', print: printDocSyncResult },
  ])('the $name strips control and format characters from paths and errors', ({ print }) => {
    print(new OutputManager(contextWith(false)), hostile);
    print(new OutputManager(contextWith(true)), hostile);
    const warnings = errors.filter((line) => line.includes('Doc sync error'));
    expect(warnings).toHaveLength(2);
    const [text, json] = warnings as [string, string];
    expect(text).not.toMatch(controls);
    expect(text).toContain('guidelines/x[2J]0;PWNED.md: cannot read [31mrepo[0m second line');
    const warning = (JSON.parse(json) as { warning: string }).warning;
    expect(warning).not.toMatch(controls);
    expect(warning).toContain('guidelines/x[2J]0;PWNED.md');
  });
});
