---
type: is
id: is-01m0y1qek35qx7xs3d0r3bwf2x
title: Review rust-rules.md for accuracy, duplication, and brevity
kind: task
status: closed
priority: 1
version: 4
labels: []
dependencies:
  - type: blocks
    target: is-01m0y1rep9djp2ds5g7jyz71zj
parent_id: is-01m0y1gprchhzvxegj8atrwsj8
created_at: 2026-08-26T03:27:25.283Z
updated_at: 2026-08-26T03:53:12.188Z
closed_at: 2026-08-26T03:53:12.188Z
close_reason: Reviewed. No edits needed. All 5 Edition 2024 items, LazyLock stability, deny-vs-forbid (E0453 reproduced), and all 5 code examples verified by compiling on rustc 1.94.1. All 14 Related entries resolve.
resolution: null
duplicate_of: null
---
Review `packages/tbd/docs/guidelines/rust-rules.md` (281 lines, new).
Scope rules are in the parent epic—read it first (`tbd show tbd-81x8`).

## Factual claims to verify

- **The Edition 2024 change list**: reserved `gen` keyword, explicit unsafe operations
  inside `unsafe fn`, return-position `impl Trait` lifetime capture, shorter
  tail-expression temporary lifetimes, resolver version 3. Verify each against the
  edition guide; a wrong entry here is quoted straight into review findings.
- That `std::sync::LazyLock` is stable and sufficient for a static regex.
- The `deny` versus `forbid` explanation for `unsafe_code`—that `forbid` cannot be
  overridden by a scoped attribute at all.
- That `cargo fix --edition` is the edition migration tool.
- The `Cow`, split-borrow, and `thiserror`/`anyhow` examples compile and say what the
  prose claims.
- That Rust string indices are byte offsets and slicing off a character boundary panics.

## Brevity and duplication

- The unsafe section overlaps `rust-lint-format-rules` (the same `deny` versus `forbid`
  argument) and `rust-code-review-rules` (the safety-argument rule).
  One of these should own it.
- Check the **Related** block: 8 entries plus a 4-item “language-neutral rules this
  assumes” line. Confirm every name is a real bundled guideline.
- Look for restatement of `general-coding-rules` and `error-handling-rules` content.
