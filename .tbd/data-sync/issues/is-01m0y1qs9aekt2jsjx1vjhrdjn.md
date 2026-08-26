---
type: is
id: is-01m0y1qs9aekt2jsjx1vjhrdjn
title: Review rust-filesystem-rules.md for accuracy, duplication, and brevity
kind: task
status: closed
priority: 1
version: 4
labels: []
dependencies:
  - type: blocks
    target: is-01m0y1rep9djp2ds5g7jyz71zj
parent_id: is-01m0y1gprchhzvxegj8atrwsj8
created_at: 2026-08-26T03:27:36.233Z
updated_at: 2026-08-26T03:53:30.729Z
closed_at: 2026-08-26T03:53:30.728Z
close_reason: "Reviewed. 1 edit (canonicalize rationale duplicated from filesystem-rules). Everything else verified by compiling on rustc 1.94.1 and reading tempfile 3.27.0 and std source: CrossesDevices stable since 1.85.0 (the corpus MSRV), persist replaces on both platforms, persist_noclobber hard-link fallback real, append interleaving wording matches std verbatim, both examples build."
resolution: null
duplicate_of: null
---
Review `packages/tbd/docs/guidelines/rust-filesystem-rules.md` (222 lines, new).
Scope rules are in the parent epic—read it first (`tbd show tbd-81x8`).
This document carries the highest density of checkable API claims in the PR.

## Factual claims to verify

- `Path::with_extension` replaces the final extension: `archive.tar.gz` becomes
  `archive.tar.old`.
- **`ErrorKind::CrossesDevices` stability.** It spent a long time behind
  `io_error_more`. Confirm it is stable in the MSRV this corpus assumes; if not, the
  `raw_os_error()`/`EXDEV` path is the only portable advice and the text must say so.
- **`NamedTempFile::persist`**: that it atomically replaces an existing destination on
  every platform, and that `persist_noclobber` refuses one.
- The `persist_noclobber` non-atomicity caveat: that tempfile’s fallback may create the
  final hard link and leave the staging link behind on cleanup failure.
- The Windows claim that `persist` can fail with a permission error when the destination
  is open.
- **`BufWriter`**: that `Drop` flushes and discards the error, that `into_inner` both
  drains and reports, and that `sync_all` is a further step.
- `OpenOptions::append` partial-write semantics, and that the linked std doc supports the
  interleaving claim as stated.
- Both code examples compile (`write_atomic`, and the `WalkDir` match arm using
  `error.io_error().map(io::Error::kind)`).

## Brevity and duplication

Check against `filesystem-rules` for restated behavior contract, and against
`rust-lint-format-rules` for the repeated “do not globally ban `std::fs::write`”
argument, which currently appears in three documents.
