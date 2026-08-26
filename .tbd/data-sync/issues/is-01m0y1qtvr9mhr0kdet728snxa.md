---
type: is
id: is-01m0y1qtvr9mhr0kdet728snxa
title: Review rust-testing-rules.md for accuracy, duplication, and brevity
kind: task
status: closed
priority: 2
version: 4
labels: []
dependencies:
  - type: blocks
    target: is-01m0y1rep9djp2ds5g7jyz71zj
parent_id: is-01m0y1gprchhzvxegj8atrwsj8
created_at: 2026-08-26T03:27:37.848Z
updated_at: 2026-08-26T03:53:32.178Z
closed_at: 2026-08-26T03:53:32.177Z
close_reason: Reviewed. 192 to 165 lines. Cut neutral bullets owned by general-testing-rules and golden-testing-guidelines, plus TempDir advice rust-filesystem-rules states more completely. Property-test section named no Rust crate; it names proptest and quickcheck now. include_str! missing-file wording corrected to compile time.
resolution: null
duplicate_of: null
---
Review `packages/tbd/docs/guidelines/rust-testing-rules.md` (192 lines, new).
Scope rules are in the parent epic—read it first (`tbd show tbd-81x8`).

## Factual claims to verify

- That `cargo test` prints an `#[ignore = "..."]` reason string in its output, in the
  form shown (`test tests::merge ... ignored, flaky under CI: tbd-1234`).
- That `cargo test` reports `N filtered out`, and that a selection matching nothing
  otherwise prints `0 passed; 0 failed` and exits zero.
- That a workspace-root `tests/` directory is not automatically a test target and
  integration tests belong inside the member package.
- `include_str!` / `include_bytes!` behavior as described.
- `insta` and `cargo-llvm-cov` are current and correctly characterized.

## Brevity and duplication

`general-testing-rules` was substantially expanded in this same PR and now covers
determinism, fixture provenance, ignored-test tracking, and coverage-as-discovery.
This document restates several of those. Confirm each section here adds a Rust specific
and cut the parts that only re-say the neutral rule.
The §Keep Ignored Tests Actionable section already models the right shape—two Rust
specifics after a one-line handoff. Apply that shape to §Use Goldens, §Use Property
Tests, and §Use Coverage, which read as neutral advice with a Rust tool name attached.
