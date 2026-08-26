---
type: is
id: is-01m0y1qa21zgnag8mjd8sqnnpz
title: Review rust-lint-format-rules.md for accuracy, duplication, and brevity
kind: task
status: closed
priority: 1
version: 4
labels: []
dependencies:
  - type: blocks
    target: is-01m0y1rep9djp2ds5g7jyz71zj
parent_id: is-01m0y1gprchhzvxegj8atrwsj8
created_at: 2026-08-26T03:27:20.641Z
updated_at: 2026-08-26T03:53:06.255Z
closed_at: 2026-08-26T03:53:06.255Z
close_reason: Reviewed. All 6 rows of the measured lint table recount exactly from the 415-row TSV. 34% corrected to 35%. Lint precedence, --all-targets, --cap-lints and priority=-1 verified by running clippy against a probe crate; 1.97.1 confirmed a real release.
resolution: null
duplicate_of: null
---
Review `packages/tbd/docs/guidelines/rust-lint-format-rules.md` (399 lines, new).
Scope rules are in the parent epic—read it first (`tbd show tbd-81x8`).

## Factual claims to verify

- **The measured lint table.** Every figure must match
  `docs/project/research/current/evidence-2026-08-23-rust-lint-cost.tsv`. Recount from
  the TSV; do not trust the prose. Coordinate with the evidence-doc bead.
- `#[expect]` requires Rust 1.81 (stated as the departure condition). Confirm the
  stabilization version.
- The `rust-toolchain.toml` example pins `channel = "1.97.1"`. Confirm that is a real
  released Rust version; a pin to a version that does not exist is a copy-paste trap.
- **Lint precedence.** The claim that Cargo emits `[lints]` as rustc flags before
  arguments after `--`, so `-- -W clippy::pedantic` demotes a manifest `deny` to `warn`.
  This is the load-bearing justification for the violation-probe rule; verify it.
- That cargo builds registry dependencies with `--cap-lints allow`, so a `[lints]` table
  cannot break a downstream build.
- `allow-unwrap-in-tests` / `allow-expect-in-tests` cover inline `#[cfg(test)]` items but
  not `tests/`, examples, or build scripts.
- That `--all-targets` is required for tests, examples, and benches to be linted.
- `RUSTFLAGS="--cap-lints warn"` behavior in the measurement recipe, and that a
  warnings-denying workspace otherwise stops at its first failing target.
- The claimed contrast with `noUncheckedIndexedAccess` (changes an inferred type, usually
  satisfied by an existing bounds check).

## Brevity and duplication

Overlap with `rust-project-setup`: toolchain pinning versus MSRV, per-member `[lints]`
opt-in, and the MSRV compile-and-test job are each stated in both.
Decide which document owns each and reduce the other to a reference.
Also check the six admission criteria against `ci-and-gates-rules`.
