---
type: is
id: is-01m0y1qg5eqmg8kmn4xpjsw0q9
title: Review rust-project-setup.md for accuracy, duplication, and brevity
kind: task
status: closed
priority: 2
version: 4
labels: []
dependencies:
  - type: blocks
    target: is-01m0y1rep9djp2ds5g7jyz71zj
parent_id: is-01m0y1gprchhzvxegj8atrwsj8
created_at: 2026-08-26T03:27:26.894Z
updated_at: 2026-08-26T03:53:13.754Z
closed_at: 2026-08-26T03:53:13.754Z
close_reason: "Reviewed. No findings. All 6 claims verified by execution on cargo 1.94.1: resolver/edition/MSRV pairing, required-features, restriction-group rejection, --locked. The 3 restated points are project-shape instructions, kept."
resolution: null
duplicate_of: null
---
Review `packages/tbd/docs/guidelines/rust-project-setup.md` (280 lines, new).
Scope rules are in the parent epic—read it first (`tbd show tbd-81x8`).

## Factual claims to verify

- That a virtual workspace must declare `resolver` because there is no root package
  edition to infer it from, and that `resolver = "3"` is correct for Edition 2024.
- That `edition = "2024"` requires `rust-version = "1.85"` or newer—the example pairs
  them, so the pairing must be right.
- `required-features` on a `[[bin]]` target behaves as shown.
- That the Clippy `restriction` group contains mutually contradictory lints and is meant
  to be drawn from selectively.
- The `--locked` claim: that it fails the job on a resolver change rather than silently
  altering what was tested.
- The lockfile policy advice for library-only repositories.

## Brevity and duplication

This document repeatedly delegates to `rust-lint-format-rules` and `ci-and-gates-rules`
and then restates part of what it delegated—member `[lints]` opt-in, the MSRV
compile-and-test job, and fix-versus-verify separation each appear in two documents.
Where the restatement adds a project-shape point, keep it; where it is a summary, cut it
to the reference.
Also check §Document the Supported Surface and §Keep Repository Configuration Minimal
for generic list padding that states the obvious.
