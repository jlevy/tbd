---
type: is
id: is-01m0y1rg8766rxxjy2tkfth6v1
title: Verify the Rust lint-cost evidence and every table that cites it
kind: task
status: closed
priority: 1
version: 4
labels: []
dependencies:
  - type: blocks
    target: is-01m0y1qa21zgnag8mjd8sqnnpz
parent_id: is-01m0y1gprchhzvxegj8atrwsj8
created_at: 2026-08-26T03:27:59.750Z
updated_at: 2026-08-26T03:53:07.730Z
closed_at: 2026-08-26T03:53:07.730Z
close_reason: "Verified. TSV is 415 rows, all fields populated; recount reproduces both tables with zero discrepancy; dedup and two-pass method match measure-rust-lint-cost.mjs. Only defect: 145/415 rounds to 35%, not 34%."
resolution: null
duplicate_of: null
---
Verify the measured Rust lint-cost evidence and everything that cites it:
`docs/project/research/current/evidence-2026-08-23-rust-lint-cost.md` and `.tsv`,
`scripts/measure-rust-lint-cost.mjs`, and the tables in `rust-lint-format-rules.md` and
the PR description.
Scope rules are in the parent epic—read it first (`tbd show tbd-81x8`).

This is the factual backbone of the lint floor’s central argument, so it gets an
arithmetic check rather than a reading.

## What to verify

- **Recount every cell** of the six-row table in `rust-lint-format-rules` directly from
  the 415-row TSV, grouped by lint and by target class (ships / build scripts /
  tests and examples). Report any disagreement as a Blocker.
- The TSV has the row count the prose claims, and its `lint`/`target`/`file`/`line`
  columns are populated for every row.
- The deduplication rule the prose states (by lint plus primary-span file, line, and
  column, because `--all-targets` compiles the library twice) matches what
  `scripts/measure-rust-lint-cost.mjs` actually does.
- The classification method described in the evidence doc matches the script: two clippy
  passes, `--lib --bins` versus `--all-targets`, classified by cargo’s per-diagnostic
  target.
- The claim that the superseded split-at-`#[cfg(test)]` method misfiled 145 of 415
  diagnostics (34%) is reproducible from the checked-in data, or is stated as a
  historical measurement that cannot be re-derived.
- The stated provenance—fdu at `d42d970`, 35,081 lines, a library plus a CLI plus a PyO3
  extension module, already at the floor with `allow-*-in-tests` enabled—is consistent
  everywhere it is repeated.
- `scripts/measure-rust-lint-cost.mjs` rejects a partial or failed Cargo run and uses
  `--locked`, as the PR description claims.

## Brevity

The evidence document is a research artifact, not a loaded guideline, so brevity matters
less here. Check instead that `rust-lint-format-rules` quotes only what its argument
needs and defers the rest.
