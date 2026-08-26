---
type: is
id: is-01m0y1qbjnca629bjpgs9q4thn
title: Review rust-cli-rules.md for accuracy, duplication, and brevity
kind: task
status: closed
priority: 2
version: 4
labels: []
dependencies:
  - type: blocks
    target: is-01m0y1rep9djp2ds5g7jyz71zj
parent_id: is-01m0y1gprchhzvxegj8atrwsj8
created_at: 2026-08-26T03:27:22.197Z
updated_at: 2026-08-26T03:53:09.239Z
closed_at: 2026-08-26T03:53:09.239Z
close_reason: Reviewed. 1 edit (test advice restated from error-handling-rules). SIGPIPE, ExitCode destructors, BufWriter flush-before-drop, and IsTerminal (1.70) verified empirically on rustc 1.94.1.
resolution: null
duplicate_of: null
---
Review `packages/tbd/docs/guidelines/rust-cli-rules.md` (323 lines, new).
Scope rules are in the parent epic—read it first (`tbd show tbd-81x8`).

## Factual claims to verify

- **SIGPIPE.** That Rust’s runtime sets SIGPIPE to ignored at startup, unlike a C
  program, so the write returns `ErrorKind::BrokenPipe` rather than killing the process.
- That returning `ExitCode` from `main` runs destructors while `process::exit` skips
  them.
- That a `write!` to a `BufWriter` or locked stdout can succeed with bytes still
  buffered, so the flush is part of the checked operation and an unflushed broken pipe
  surfaces during drop.
- The broken-pipe example compiles as written, and its `Report`/`Outcome`/`collect`/
  `write_report` placeholders are coherent enough to be read as a pattern rather than as
  something that would not build.
- `std::io::IsTerminal` is the current stable API for the TTY check.
- The `clap` and `clap_complete` claims.

## Brevity and duplication

The broken-pipe section is long and its neutral contract now lives in
`error-handling-rules`; verify this document keeps only the Rust-specific part and does
not restate the neutral rule.
Check overlap with `rust-rules` (error handling), `filesystem-rules` and
`rust-filesystem-rules` (destructive commands), `error-handling-rules` (exit status), and
`typescript-cli-tool-rules` / `python-cli-patterns` (the same contract stated for other
languages—confirm the three do not contradict each other).
