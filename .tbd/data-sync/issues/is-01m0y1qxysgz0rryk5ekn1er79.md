---
type: is
id: is-01m0y1qxysgz0rryk5ekn1er79
title: Review rust-release-rules.md for accuracy, duplication, and brevity
kind: task
status: closed
priority: 1
version: 4
labels: []
dependencies:
  - type: blocks
    target: is-01m0y1rep9djp2ds5g7jyz71zj
parent_id: is-01m0y1gprchhzvxegj8atrwsj8
created_at: 2026-08-26T03:27:41.017Z
updated_at: 2026-08-26T03:53:34.972Z
closed_at: 2026-08-26T03:53:34.972Z
close_reason: Reviewed. No edits to this file; all 11 claims verified correct, including PyO3 0.29 abi3t / Python 3.15, PanicException deriving from BaseException, cdylib+rlib from one crate, and yanking semantics. Removed the duplicate sibling-trap explanation from release-engineering-rules instead.
resolution: null
duplicate_of: null
---
Review `packages/tbd/docs/guidelines/rust-release-rules.md` (181 lines, new).
Scope rules are in the parent epic—read it first (`tbd show tbd-81x8`).
The PyO3 section carries several precise version claims; treat them as the priority.

## Factual claims to verify

- **“In PyO3 0.29, `abi3t` covers free-threaded and GIL-enabled CPython from Python 3.15
  onward.”** Verify the PyO3 version, the feature name, and the Python floor against
  PyO3’s own documentation. If any part is wrong or unreleased, the sentence must go or
  be rewritten to what is true.
- That `abi3` does not serve free-threaded CPython, and that `abi3-pyXY` / `abi3t-pyXY`
  declare a minimum compatible API version rather than a single interpreter target.
- That `PanicException` derives from `BaseException` rather than `Exception`, so
  `except Exception` does not absorb it.
- That `panic = "abort"` disables PyO3’s panic-to-exception conversion.
- That an extension module deliberately does not link libpython, so `cargo test` needs
  the build without `extension-module`.
- That one crate can emit both `cdylib` and `rlib` by listing both crate types.
- Yanking semantics: prevents new resolution, does not remove downloaded source, does not
  break existing lockfiles.
- `cargo package --locked -p a -p b` verifies each against the just-packaged siblings.
- `cargo-semver-checks` is correctly named and characterized.
- The `[profile.release]` and `[profile.profiling]` blocks, including the claim that
  codegen matches `release` when inheriting it.

## Brevity and duplication

The unpublished-sibling trap is explained here and again in
`release-engineering-rules` §Rehearse the Release. One explanation, one reference.
