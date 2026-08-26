---
type: is
id: is-01m0y1qzeqh2n447qkqrb8r4ea
title: Review rust-code-review-rules.md for accuracy, duplication, and brevity
kind: task
status: closed
priority: 1
version: 4
labels: []
dependencies:
  - type: blocks
    target: is-01m0y1rep9djp2ds5g7jyz71zj
parent_id: is-01m0y1gprchhzvxegj8atrwsj8
created_at: 2026-08-26T03:27:42.551Z
updated_at: 2026-08-26T03:53:36.351Z
closed_at: 2026-08-26T03:53:36.351Z
close_reason: Reviewed. 4 edits. FFI unwind matrix verified correct in both directions against RFC 2945; added the Rust 1.81 boundary for the defined-abort behavior. Cut 3 quick-scan rows repeating the neutral table in Rust spelling.
resolution: null
duplicate_of: null
---
Review `packages/tbd/docs/guidelines/rust-code-review-rules.md` (114 lines, new).
Scope rules are in the parent epic—read it first (`tbd show tbd-81x8`).

## Factual claims to verify

- **The FFI unwinding matrix**, which a prior review round reported as backwards. Verify
  the current text in both directions: that a Rust panic escaping an `extern "C"`
  function aborts the process (defined behavior since the abort was specified), and that
  a foreign exception entering Rust through a non-unwind ABI is the undefined-behavior
  case.
- That `extern "C-unwind"` declares unwinding as part of the ABI on both sides and is not
  a general fix for a function that might panic.
- That `catch_unwind` is the correct containment for an exported function that must
  return an error, including its `UnwindSafe` constraints if that matters to the advice.
- The `Send`/`Sync` soundness row, including interior mutability reached through a raw
  pointer.

## Brevity and duplication

- The 12-row Rust quick-scan table against the 17-row neutral table in
  `code-review-rules`: rows that are the same finding in Rust spelling should be dropped
  here, since the neutral document is loaded alongside.
- The unsafe checklist against `rust-rules` §Unsafe Code and FFI, which states the
  soundness-is-a-module-property rule and then points here.
  Confirm the split is clean and neither side summarizes the other.
- The changed-surface routing table against `code-review-rules` and
  `review-code-rust.md`.
