---
title: TypeScript CLI Tool Rules
description: Rules for building CLI tools with Commander.js, picocolors, and TypeScript
author: Joshua Levy (github.com/jlevy) with LLM assistance
---
# CLI Tool Development Rules

These rules apply to all CLI tools, command-line scripts, and terminal utilities.
Examples may be inspired by modern TypeScript repos, but guidance here is intentionally
generic and reusable across projects.

## Color and Output Formatting

- **ALWAYS use picocolors for terminal colors:** Import `picocolors` (aliased as `pc`)
  for all color and styling needs.
  NEVER use hardcoded ANSI escape codes like `\x1b[36m` or `\033[32m`.

  ```ts
  // GOOD: Use picocolors
  import pc from 'picocolors';
  console.log(pc.green('Success!'));
  console.log(pc.cyan('Info message'));

  // BAD: Hardcoded ANSI codes
  console.log('\x1b[32mSuccess!\x1b[0m');
  console.log('\x1b[36mInfo message\x1b[0m');
  ```

- **Use `pc.createColors()` for explicit color control:** When you need to honor a
  `--color` option or disable colors programmatically, use picocolors’ `createColors()`
  factory. This overrides picocolors’ automatic TTY detection and is the recommended
  approach per picocolors documentation.

  ```ts
  import pc from 'picocolors';

  // Create a color instance with explicit enable/disable control
  const colors = pc.createColors(shouldColorize(colorOption));

  // Now use it — colors are no-ops when disabled
  console.log(colors.green('Success'));
  console.log(colors.dim('Debug info'));
  ```

- **Use shared color utilities with semantic names:** Create a `createColors()` factory
  that returns semantic color functions.
  The `OutputManager` carries this and exposes it via `getColors()`.

  ```ts
  // cli/lib/output.ts - shared color factory
  import pc from 'picocolors';
  import type { ColorOption } from './context.js';
  import { shouldColorize } from './context.js';

  export function createColors(colorOption: ColorOption) {
    const enabled = shouldColorize(colorOption);
    const colors = pc.createColors(enabled);

    return {
      // Status colors
      success: colors.green,
      error: colors.red,
      warn: colors.yellow,
      info: colors.blue,
      // Text formatting
      bold: colors.bold,
      dim: colors.dim,
      italic: colors.italic,
      underline: colors.underline,
      // Semantic colors
      id: colors.cyan,
      label: colors.magenta,
      path: colors.blue,
    };
  }
  ```

- **Respect `NO_COLOR`, `FORCE_COLOR`, and `--color` option:** Support a
  `--color <when>` option with values `auto`, `always`, `never`, and define a clear
  precedence order:
  1. explicit `--color` flag, 2) `NO_COLOR`, 3) `FORCE_COLOR`, 4) TTY auto-detection.

  ```ts
  export function shouldColorize(colorOption: ColorOption): boolean {
    if (colorOption === 'always') return true;
    if (colorOption === 'never') return false;
    if (process.env.NO_COLOR) return false;
    if (process.env.FORCE_COLOR && process.env.FORCE_COLOR !== '0') return true;
    return process.stdout.isTTY === true;
  }
  ```

## Commander.js Patterns

- **Use Commander.js for all CLI tools:** Import from `commander` and follow established
  patterns for command registration and option handling.

- **Apply colored help globally, not per-command:** Use Commander v14+ `configureHelp()`
  with style functions, applied recursively to all commands at program initialization.

  ```ts
  // cli/lib/output.ts
  export function createColoredHelpConfig(colorOption: ColorOption = 'auto') {
    const colors = pc.createColors(shouldColorize(colorOption));
    return {
      helpWidth: getTerminalWidth(),
      styleTitle: (str: string) => colors.bold(colors.cyan(str)),
      styleCommandText: (str: string) => colors.green(str),
      styleOptionText: (str: string) => colors.yellow(str),
      showGlobalOptions: true,
    };
  }

  // cli/cli.ts - apply once at startup
  configureColoredHelp(program);
  // After all commands added:
  applyColoredHelpToAllCommands(program);
  ```

- **Define global options at the program level:** Common global options include
  `--dry-run`, `--verbose`, `--quiet`, `--json`, `--color`, and `--debug`. Only add
  `--non-interactive` and `--yes` if your CLI actually has interactive prompts or
  confirmations. Add domain-specific flags only when they apply.

  ```ts
  program
    .option('--dry-run', 'Show what would be done without making changes')
    .option('--verbose', 'Enable verbose output')
    .option('--quiet', 'Suppress non-essential output')
    .option('--json', 'Output as JSON')
    .option('--color <when>', 'Colorize output: auto, always, never', 'auto')
    .option('--debug', 'Enable debug diagnostics');
  ```

- **Validate enum-like options explicitly:** For options with fixed values, use
  Commander validation (`Option(...).choices(...)`) so invalid input fails fast.

  ```ts
  import { Option } from 'commander';

  program.addOption(
    new Option('--color <when>', 'Colorize output: auto, always, never')
      .choices(['auto', 'always', 'never'])
      .default('auto'),
  );
  ```

- **Access global options via `getCommandContext()`:** Extract a typed `CommandContext`
  from Commander’s `optsWithGlobals()`. Use this in the `BaseCommand` constructor (see
  below), not directly in action handlers.

  ```ts
  export function getCommandContext(command: Command): CommandContext {
    const opts = command.optsWithGlobals();
    return {
      dryRun: opts.dryRun ?? false,
      verbose: opts.verbose ?? false,
      quiet: opts.quiet ?? false,
      json: opts.json ?? false,
      color: (opts.color as ColorOption) ?? 'auto',
      debug: opts.debug ?? false,
    };
  }
  ```

- **Handle negated boolean flags (`--no-X`) correctly:** Commander.js sets
  `options.X = false`, NOT `options.noX = true`. This is a common gotcha that causes
  silent bugs where the flag has no effect.

  ```ts
  // WRONG: options.noBrowser is ALWAYS undefined — the flag silently does nothing!
  program.option('--no-browser', 'Disable browser auto-open');
  if (options.noBrowser) { /* Never executes! */ }

  // CORRECT: Check the positive property name
  program.option('--no-browser', 'Disable browser auto-open');
  if (options.browser === false) { /* This works */ }

  // Best practice: use !== false for clarity
  if (options.browser !== false) {
    await openBrowser(url);
  }
  ```

  When typing the options interface, use the *positive* property name:

  ```ts
  // WRONG:
  interface MyOptions {
    noBrowser?: boolean;  // Commander never sets this
  }

  // CORRECT:
  interface MyOptions {
    browser?: boolean;  // Commander: --no-browser sets this to false (default: true)
  }
  ```

## BaseCommand Pattern

All CLI command handlers extend a shared `BaseCommand` class that provides consistent
context, output, and error handling.

- **BaseCommand provides `CommandContext` + `OutputManager`:** Every command handler
  gets typed context and a shared output manager in its constructor.

  ```ts
  // cli/lib/base-command.ts
  export abstract class BaseCommand {
    protected ctx: CommandContext;
    protected output: OutputManager;

    constructor(command: Command) {
      this.ctx = getCommandContext(command);
      this.output = new OutputManager(this.ctx);
    }

    protected async execute<T>(action: () => Promise<T>, errorMessage: string): Promise<T> {
      try {
        return await action();
      } catch (error) {
        if (error instanceof CLIError) {
          this.output.error(error.message);
          throw error;
        }
        // Wrap with cause chain for debugging
        const wrapped = new CLIError(errorMessage);
        wrapped.cause = error instanceof Error ? error : undefined;
        throw wrapped;
      }
    }

    protected checkDryRun(message: string, details?: object): boolean {
      if (this.ctx.dryRun) {
        this.output.dryRun(message, details);
        return true;
      }
      return false;
    }

    abstract run(...args: unknown[]): Promise<void>;
  }
  ```

- **Action handlers instantiate a handler class:** Commands create a handler and
  delegate to its `run()` method.
  This separates command definition from implementation.

  ```ts
  export const myCommand = new Command('my-command')
    .description('Description here')
    .option('--some-flag', 'Flag description')
    .action(async (options, command) => {
      const handler = new MyHandler(command);
      await handler.run(options);
    });

  class MyHandler extends BaseCommand {
    async run(options: MyOptions): Promise<void> {
      if (this.checkDryRun('Would perform action')) return;
      // Implementation using this.output and this.ctx
    }
  }
  ```

## Output and Feedback

- **Use `OutputManager` for all output:** The `OutputManager` class handles format
  switching (text vs JSON), verbosity levels, and stream separation.

  ```ts
  // cli/lib/output.ts
  class OutputManager {
    // Structured data — stdout
    data<T>(data: T, textFormatter?: (data: T) => void): void;

    // Status messages — stdout (suppressed by --quiet, --json)
    success(message: string): void;   // ✓ Green
    notice(message: string): void;    // • Blue

    // Diagnostics — stderr
    info(message: string): void;      // Dim (--verbose or --debug only)
    warn(message: string): void;      // ⚠ Yellow (suppressed by --quiet)
    error(message: string): void;     // ✗ Red (always shown)
    command(cmd: string, args?: string[]): void; // > Dim (--verbose or --debug only)
    debug(message: string): void;     // [debug] Dim (--debug only)

    // Dry-run — stdout
    dryRun(message: string, details?: object): void;

    // Tabular/list output — stdout
    table(headers, rows): void;
    list(items: string[]): void;
    count(count: number, singular: string): void;

    // Progress indication — stderr (suppressed in JSON/quiet/non-TTY)
    spinner(message: string): Spinner;
  }
  ```

- **Use standard icons from the ICONS constant:** Use Unicode characters, not emojis,
  for status indicators.
  These render consistently across terminals.

  ```ts
  export const ICONS = {
    SUCCESS: '✓',      // U+2713
    ERROR: '✗',        // U+2717
    WARN: '⚠',         // U+26A0
    NOTICE: '•',       // U+2022
    OPEN: '○',         // U+25CB
    IN_PROGRESS: '◐',  // U+25D0
    BLOCKED: '●',      // U+25CF
    CLOSED: '✓',       // U+2713
  } as const;
  ```

- **Custom inline spinner (no external dependency):** The spinner uses Braille
  characters, writes to stderr, and is automatically suppressed in JSON/quiet/non-TTY
  modes.

  ```ts
  spinner(message: string): Spinner {
    if (this.ctx.json || this.ctx.quiet || !process.stderr.isTTY) {
      return noopSpinner;
    }
    const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    // ... interval-based animation on stderr
  }
  ```

- **Use `OperationLogger` to bridge CLI and core layers:** Core logic (domain/service
  layers) should not depend on CLI output code.
  Define a simple logger interface in the types layer and wire it in commands via
  `OutputManager.logger(spinner)`.

  ```ts
  // lib/types.ts — node-free
  export interface OperationLogger {
    progress: (message: string) => void;  // Drives the spinner
    info: (message: string) => void;      // --verbose detail
    warn: (message: string) => void;      // Non-fatal warnings
    debug: (message: string) => void;     // --debug only
  }

  // cli/lib/output.ts — wires to OutputManager + spinner
  logger(spinner: Spinner): OperationLogger { ... }
  ```

## Stdout/Stderr Separation

Strict separation of data and diagnostics enables pipeline composability.

- **Data to stdout:** `data()`, `success()`, `notice()`, `dryRun()`, `table()`,
  `list()`, `count()` — all go to `console.log` (stdout).

- **Diagnostics to stderr:** `info()`, `warn()`, `error()`, `command()`, `debug()`,
  `spinner` — all go to `console.error` (stderr) or `process.stderr.write`.

- **JSON mode wraps diagnostics:** `warn()` outputs `{"warning": "..."}` to stderr.
  `error()` outputs `{"error": "..."}` to stderr.
  `data()` outputs structured JSON to stdout.

- **Handle EPIPE for graceful pipe close:** Both stdout and stderr need EPIPE handlers
  so piping to `head` or quitting a pager works cleanly.

  ```ts
  // cli/bin.ts
  process.stdout.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EPIPE') process.exit(0);
    throw err;
  });
  process.stderr.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EPIPE') process.exit(0);
    throw err;
  });
  ```

- **Support pagination with `PAGER`:** For long output, pipe through `$PAGER` (or
  `less -R` for colored content) when stdout is a TTY. Fall through to `console.log()`
  otherwise.

## Dual Output Mode (Text + JSON)

- **Use `OutputManager.data()` for all structured output:** The `data()` method switches
  between JSON and text formatting based on the `--json` flag.

  ```ts
  this.output.data(issues, () => {
    // Text formatter — only called when NOT in JSON mode
    for (const issue of issues) {
      console.log(formatIssueLine(issue, colors));
    }
    this.output.count(issues.length, 'issue');
  });
  ```

- **Global `--json` flag:** Defined at the program level.
  When active, `data()` outputs `JSON.stringify(data, null, 2)` to stdout.
  All non-data output methods are suppressed or wrapped in JSON objects.

- **Pre-parse argv for early JSON detection:** For error output during Commander parsing
  (before options are processed), check `process.argv.includes('--json')` directly.

## Error Handling Architecture

- **Use structured error classes with exit codes:**

  ```ts
  class CLIError extends Error { exitCode = 1; }
  class ValidationError extends CLIError { exitCode = 2; }  // Usage/argument issues
  class NotFoundError extends CLIError { }                    // Entity not found
  class ExternalCommandError extends CLIError { }             // git/docker/etc failures
  ```

- **`BaseCommand.execute()` wraps errors with cause chains:** Preserves the original
  error for debugging while providing user-friendly messages.

- **Top-level try/catch in `runCli()`:** Catches `CLIError` subclasses (uses their
  `exitCode`) and unexpected errors (exit 1). Handle SIGINT separately (exit 130).

  ```ts
  export async function runCli(): Promise<void> {
    try {
      await program.parseAsync(process.argv);
    } catch (error) {
      if (error instanceof CLIError) {
        process.exit(error.exitCode);
      }
      outputError(error);
      process.exit(1);
    }
  }
  // Separate SIGINT handler
  process.on('SIGINT', () => process.exit(130));
  ```

## Entry Point Architecture

A three-tier entry point optimizes startup time and error handling:

1. **CJS bootstrap (`bin-bootstrap.cjs`):** Enables Node.js compile cache (`node:module`
   `enableCompileCache()`) BEFORE any ESM imports.
   This must be CJS because ESM static imports resolve before module code runs.

2. **ESM binary (`bin.ts`):** Registers EPIPE handlers on stdout/stderr, then calls
   `void runCli()`. Should be minimal.

3. **CLI setup (`cli.ts`):** Creates the Commander program, registers all commands,
   defines global options, and handles the top-level try/catch with `process.exit()`.

## Timing and Performance

- **Display timing for long operations:** For operations that take multiple seconds,
  display timing information.

  ```ts
  const start = Date.now();
  // ... operation ...
  const duration = ((Date.now() - start) / 1000).toFixed(1);
  console.log(colors.info(`Operation completed: ${duration}s`));
  ```

- **Use `performance.now()` for benchmarks:** For precise timing in test scripts and
  benchmarks, prefer `performance.now()` over `Date.now()`.

## Script Structure

- **Use TypeScript for CLI scripts:** Write scripts as `.ts` files with proper types.
  For executable TS scripts, use a shebang compatible with your runtime setup (for
  example `#!/usr/bin/env npx tsx`). For compiled `.mjs` entry points, use
  `#!/usr/bin/env node`.

  ```ts
  #!/usr/bin/env npx tsx

  /**
   * Script description here.
   */

  import { execSync } from 'node:child_process';

  async function main() {
    // Implementation
  }

  main().catch((err) => {
    console.error(`Script failed: ${err.message || err}`);
    process.exit(1);
  });
  ```

- **For CLI binaries, use `void runCli()`:** The CLI entry point calls `runCli()` as a
  void promise (error handling is inside `runCli()`). For standalone scripts, use the
  `main().catch()` pattern.

- **Handle errors gracefully:** Always catch errors at the top level and provide clear
  error messages before exiting.

- **Exit with proper codes:** Use `process.exit(0)` for success and `process.exit(1)`
  for failures. Use `process.exit(130)` for SIGINT. Use `process.exit(2)` for validation
  errors. This is important for CI/CD pipelines and shell scripts.

## File Naming

- **Use descriptive kebab-case names:** CLI script files should use kebab-case with
  clear purpose indicators.
  - Examples: `test-with-timings.ts`, `test-all-commands.ts`, `generate-config-data.ts`

- **Organize commands in a `commands/` directory:** Keep command implementations
  organized with one file per command or command group.
  Shared CLI utilities go in `lib/` (e.g., `base-command.ts`, `output.ts`, `context.ts`,
  `errors.ts`).

## Documentation

- **Document CLI scripts with file-level JSDoc comments:** Include a brief description
  of what the script does at the top of the file.
  Reference relevant design docs when available.

  ```ts
  /**
   * `<tool> sync` - synchronization commands.
   *
   * See: architecture/cli-sync.md
   */
  ```

- **Add help text to all commands and options:** Use `.description()` for commands and
  options to provide clear help text.

  ```ts
  .option('--mode <mode>', 'Mock mode: real or full_fixed')
  .option('--output-dir <path>', 'Output directory', './runs')
  ```

- **Use command groups for organized help output:** Use `program.commandsGroup()` to
  group commands under headings in the help text.

  ```ts
  program.commandsGroup('Core Commands:');
  program.addCommand(createCommand);
  program.addCommand(listCommand);
  ```

## Environment Variables

When supporting environment variables, especially those used by SDK libraries (like
`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, etc.), also support `.env` loading so CLIs work
seamlessly in local dev and in remote environments.

- **Use dotenv only when needed:** Add `dotenv` only if your CLI should load local env
  files automatically.

- **Load `.env.local` and `.env` automatically (recommended):** Support both
  `.env.local` and `.env` automatically, with `.env.local` taking precedence over
  `.env`.

- **Manual dotenv loading:** For runtimes that don’t already load env files, load
  environment files manually with explicit precedence:

  ```ts
  import dotenv from 'dotenv';
  import { existsSync } from 'node:fs';

  // Load .env.local first (higher priority), then .env (lower priority).
  // Note: dotenv does NOT override existing values by default, so load higher-priority
  // first.
  if (existsSync('.env.local')) {
    dotenv.config({ path: '.env.local' });
  }
  if (existsSync('.env')) {
    dotenv.config({ path: '.env' });
  }
  ```

- **Fail fast with clear errors:** If a required env var is missing, throw immediately
  with a message listing all accepted variable names.

- **Document required variables:** List required environment variables in the command’s
  help text or a README.

- **Never commit secrets:** Use `.env.local` for secrets (it’s typically gitignored).
  `.env` should only contain non-sensitive defaults.

- **Standard environment variables to respect:**

  - `NO_COLOR` — disable colors (standard)
  - `FORCE_COLOR` — force colors
  - `CI` — detect CI environment, force non-interactive
  - `DEBUG` — enable debug logging (or a namespaced equivalent like `<TOOL>_DEBUG`)
  - `PAGER` — custom pager command for long output

## Sub-Command Logging for Testability

When CLIs call external commands (git, npm, docker, etc.), add a debug flag to log those
operations. This enables “transparent box” golden testing that catches silent error
swallowing bugs.

### The Pattern

Use `OutputManager.command()` to log executed commands at `--verbose` / `--debug` level:

```ts
// In your command handler:
this.output.command('git', ['push', 'origin', syncBranch]);
const result = await git('push', 'origin', syncBranch);
```

For more comprehensive sub-command logging (e.g., for golden tests), add a
`SHOW_COMMANDS=1` env var or `--show-commands` flag:

```ts
interface SubCommandLog {
  command: string;
  args: string[];
  exitCode: number;
  stdout: string;
  stderr: string;
}

const subCommandLog: SubCommandLog[] = [];

async function runCommand(cmd: string, args: string[]): Promise<ExecResult> {
  const result = await exec(cmd, args);
  if (process.env.SHOW_COMMANDS === '1') {
    subCommandLog.push({
      command: cmd,
      args,
      exitCode: result.exitCode,
      stdout: result.stdout.trim(),
      stderr: result.stderr.trim(),
    });
  }
  return result;
}
```

### Why This Matters

**Silent Error Swallowing Detection**: Without sub-command logging, a golden test might
show “Already in sync” with exit code 0, which looks correct.
With logging, you’d see that `git push` returned exit code 1 with “HTTP 403” - revealing
the bug.

See your project’s golden/snapshot testing guide for full transparent-box patterns.

## Library/CLI Hybrid Packages

When building a package that functions as both a library and a CLI tool, isolate all
Node.js dependencies to runtime-specific modules.
This allows the core library to be used in non-Node environments (browsers, edge
runtimes, Cloudflare Workers, etc.).

**Key rules:**

- Core library entry point (`index.ts`) must have no `node:` imports

- All `node:` imports must be limited to Node-only modules (for example `cli/`,
  `adapters/node/`, or `platform/node/`)

- Configuration constants go in node-free files

- Build-time values use bundler `define` injection

- Add guard tests to prevent future regressions

- Use an `OperationLogger` interface in the types layer to bridge progress reporting
  from core logic to CLI output without introducing CLI dependencies

- Export separate package entry points: `"."` for the node-free library, `"./cli"` for
  CLI-specific code

## CLI Architecture Patterns

**Key patterns:**

- **Base Command Pattern** — All handlers extend `BaseCommand`, which provides
  `CommandContext`, `OutputManager`, `execute()` error wrapping, and `checkDryRun()`

- **Dual Output Mode** — `OutputManager.data(data, textFormatter)` switches between JSON
  and text formatting based on `--json` flag

- **Handler + Command Structure** — Command definition (`.option()`, `.action()`) is
  separate from handler class implementation.
  Action handlers do `new XxxHandler(command)` then `handler.run(options)`

- **Version Handling** — Prefer deterministic runtime version resolution: build-time
  injection first, then environment override for dev/test, then `package.json` fallback

- **Global Options** — Define `--dry-run`, `--verbose`, `--quiet`, `--json`, `--color`,
  and `--debug` at program level, plus tool-specific options as needed.
  Only add `--non-interactive` and `--yes` if the CLI has interactive prompts

- **Stdout/Stderr Separation** — Data to stdout, diagnostics to stderr for pipeline
  compatibility. See the Stdout/Stderr Separation section above for details

- **Terminal Width Management** — Cap help text and formatted output at a maximum width
  (e.g., 88 chars) for readability, using narrower if the terminal is smaller

## Best Practices

- **Don’t reinvent the wheel:** Use established patterns from your codebase and best
  practices from mature open source TypeScript CLIs.

- **Test with pipes:** Verify that scripts work correctly when output is piped (e.g.,
  `npm test | cat` should have no ANSI codes).

- **Make scripts composable:** Design scripts to work well in pipelines and automation.
  Consider how they’ll be used in CI/CD and shell scripts.
