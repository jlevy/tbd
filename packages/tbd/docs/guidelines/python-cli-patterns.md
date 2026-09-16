---
title: Python CLI Patterns
description: Modern Python CLI architecture, with a clear boundary between Python programs and Rust executables distributed through Python wheels
author: Joshua Levy (github.com/jlevy) with LLM assistance
category: python
---
# Python CLI Patterns

**Related**: `python-rules`, `python-modern-guidelines`, `error-handling-rules`, and
`rust-release-rules`.

## Distinguish a Python CLI From a Rust Binary Wheel

Use this guideline when Python implements the program: argument parsing, business logic,
imports, and runtime behavior all depend on a Python interpreter.

A wheel built by Maturin with `bindings = "bin"` can instead contain a standalone Rust
executable as its installed command.
That is a Rust CLI using PyPI and uv as a convenience distribution channel, not a Python
CLI. It needs no Python downloader, runtime wrapper, importable placeholder module, or
first-run network fetch.
Apply `rust-cli-rules` to its behavior and `rust-release-rules` to its wheel and uv
commands.

An importable PyO3 extension is a third case: it exposes a Python API and therefore has
Python ABI, interpreter, typing, and packaging commitments.
Give that product surface a separate crate, package, or lifecycle when its dependencies
and compatibility policy differ.
Do not publish an empty package to reserve a future name, and do not make a standalone
Rust CLI Python-dependent merely to preserve a possible future binding.

## Recommended Stack

- **uv** for package management, venvs, Python versions
- **Typer** or **argparse + rich_argparse** for CLI framework
- **Rich** for terminal output, tables, progress
- **Ruff** for linting and formatting
- **BasedPyright** for type checking
- **pytest** for testing

## Key Patterns

### Directory Structure

```text
src/myproject/
├── __init__.py             # Package entry, VERSION export
├── cli.py                  # Main entry point, app setup
├── commands/               # Command implementations
├── lib/                    # Shared utilities and base classes
│   ├── base_command.py     # Base class for handlers
│   ├── output_manager.py   # Unified output handling
│   └── formatters.py       # Domain-specific formatters
└── types/
    └── options.py          # TypedDict for command options
```

### Agent and CI Compatibility

Support automation with explicit flags:

- `--format text|json|jsonl`: Output format
- `--no-progress`: Disable spinners (critical for AI agents)
- `--non-interactive`: Disable prompts (only if the CLI has interactive prompts)
- `--yes` / `-y`: Assume yes to confirmations (only if the CLI has confirmations)

Respect environment variables:

- `CI`: Set by GitHub Actions, GitLab CI, etc.
- [`NO_COLOR`](https://no-color.org/): Disable colors

### Dual Output Mode (Text + JSON)

Use OutputManager for format switching:

- Data (results) -> stdout, always
- Success messages -> stdout, text mode only
- Errors/warnings -> stderr, always
- Spinners/progress -> stderr, TTY only

### Base Command Pattern

Centralize common functionality:

- Context extraction from Typer context
- Output management initialization
- Error handling with consistent formatting
- Dry-run checking

### Error Handling

Define custom exceptions with exit codes:

- `CLIError`: Base exception (exit code 1)
- `ValidationError`: Input validation failed (exit code 2)
- `UserCancelled`: User cancelled (exit code 0)

Exit codes: 0 success, 1 error, 2 validation, 130 interrupted (SIGINT)

See `error-handling-rules` for the principles behind exit codes and visible failures.

### Version Handling

Use `uv-dynamic-versioning` for git-based versions:

- Version derived from git tags
- No manual version bumping required
- Use `importlib.metadata.version()` for runtime lookup

## Best Practices

1. Disable spinners/progress in non-TTY contexts
2. Route output correctly: data to stdout, errors to stderr
3. Support `--dry-run` for safe testing of destructive commands
4. Separate handlers from command definitions for testability
5. Use TypedDict or dataclasses for type-safe options
6. Test with Typer’s CliRunner for isolated, fast tests

<!-- This document follows common-doc-guidelines.md.
See github.com/jlevy/practical-prose and review guidelines before editing.
-->
