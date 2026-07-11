/**
 * Command context and global options management.
 *
 * See: research-modern-typescript-cli-patterns.md#9-global-options
 */

import type { Command } from 'commander';

/**
 * Output format options.
 */
export type OutputFormat = 'text' | 'json';

/**
 * Color output options.
 */
export type ColorOption = 'auto' | 'always' | 'never';

/**
 * Global command context extracted from Commander options.
 */
export interface CommandContext {
  dryRun: boolean;
  verbose: boolean;
  quiet: boolean;
  json: boolean;
  color: ColorOption;
  /** Debug mode: shows internal IDs alongside public IDs */
  debug: boolean;
}

/**
 * Process-wide mirror of the active command's `--quiet`.
 *
 * The low-level data layer (worktree auto-heal and config-migration stderr
 * notices in data-context.ts) has no access to the per-command CommandContext,
 * and threading a flag through `withDataSyncContext` and its ~18 call sites would
 * be far noisier than the fix deserves. `--quiet` is a process-global concern set
 * once per invocation, so getCommandContext records it here for those emitters to
 * honor. See tbd-29k3 / plan-2026-06-13-agent-cli-ergonomics.md.
 */
let quietNotices = false;

/** True when the active command was invoked with `--quiet`. */
export function quietNoticesActive(): boolean {
  return quietNotices;
}

/** Record the active command's `--quiet` for the low-level data layer. */
export function setQuietNotices(quiet: boolean): void {
  quietNotices = quiet;
}

/**
 * Extract command context from a Commander command.
 * Handles inheritance of global options through the command hierarchy.
 */
export function getCommandContext(command: Command): CommandContext {
  const opts = command.optsWithGlobals();

  const context: CommandContext = {
    dryRun: opts.dryRun ?? false,
    verbose: opts.verbose ?? false,
    quiet: opts.quiet ?? false,
    json: opts.json ?? false,
    color: (opts.color as ColorOption) ?? 'auto',
    debug: opts.debug ?? false,
  };
  setQuietNotices(context.quiet);
  return context;
}

/**
 * Determine if output should be colorized based on options and environment.
 */
export function shouldColorize(colorOption: ColorOption): boolean {
  // NO_COLOR takes precedence (unless --color=always explicitly set)
  if (process.env.NO_COLOR && colorOption !== 'always') {
    return false;
  }
  if (colorOption === 'always') {
    return true;
  }
  if (colorOption === 'never') {
    return false;
  }
  return process.stdout.isTTY ?? false;
}

/**
 * Check if we should use interactive output features (colors, pagination).
 * Returns true when: TTY output, not JSON mode, not quiet mode.
 *
 * This is specifically for human-readable output formatting. Agents typically
 * capture output via pipes (isTTY=false) or use --json mode, so they get
 * clean plain text without ANSI codes or pagination.
 */
export function shouldUseInteractiveOutput(ctx: CommandContext): boolean {
  return !ctx.json && !ctx.quiet && shouldColorize(ctx.color) && process.stdout.isTTY === true;
}
