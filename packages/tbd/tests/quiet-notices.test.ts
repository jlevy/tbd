/**
 * The low-level data layer emits two incidental stderr notices — worktree
 * auto-heal and config-format migration. Under `--quiet` they must be silent so
 * agents no longer need `2>&1 | tail -1`. Both honor the process-wide quiet flag
 * recorded by getCommandContext(); these tests exercise the exported worktree
 * notice (the migration notice is private but uses the identical gate). See
 * tbd-29k3 / plan-2026-06-13-agent-cli-ergonomics.md.
 */
import { afterEach, describe, it, expect, vi } from 'vitest';

import { notifyWorktreeRepaired } from '../src/cli/lib/data-context.js';
import { quietNoticesActive, setQuietNotices } from '../src/cli/lib/context.js';

describe('incidental data-layer notices honor --quiet', () => {
  afterEach(() => {
    setQuietNotices(false);
    vi.restoreAllMocks();
  });

  it('setQuietNotices toggles the process-wide flag', () => {
    setQuietNotices(true);
    expect(quietNoticesActive()).toBe(true);
    setQuietNotices(false);
    expect(quietNoticesActive()).toBe(false);
  });

  it('prints the worktree-heal notice at the default level', () => {
    setQuietNotices(false);
    const write = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
    notifyWorktreeRepaired('missing');
    expect(write).toHaveBeenCalledTimes(1);
    expect(String(write.mock.calls[0]![0])).toContain('tbd-sync worktree was missing');
  });

  it('is silent under --quiet', () => {
    setQuietNotices(true);
    const write = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
    notifyWorktreeRepaired('missing');
    expect(write).not.toHaveBeenCalled();
  });

  it('stays silent for a no-op (undefined) status regardless of quiet', () => {
    setQuietNotices(false);
    const write = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
    notifyWorktreeRepaired(undefined);
    expect(write).not.toHaveBeenCalled();
  });
});
