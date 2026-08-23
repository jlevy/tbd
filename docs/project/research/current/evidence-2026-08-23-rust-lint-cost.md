---
title: 'Evidence: Clippy Lint Adoption Cost Measured Against fdu'
description: 'Measured adoption cost for six candidate Clippy lints, classified by compile unit rather than by textual #[cfg(test)] position, with the reproducer and the full diagnostic mapping'
author: Joshua Levy (github.com/jlevy) with LLM assistance
---
# Evidence: Clippy Lint Adoption Cost Measured Against fdu

This is the evidence behind the adoption-cost table in `rust-lint-format-rules`. It
exists because the first version of that table was produced by a method that does not
work, and a table of measurements nobody can re-run is an opinion with numbers on it.

**Subject:** [fdu](https://github.com/jlevy/fdu) at `d42d970` — 35,081 lines of Rust
across three crates (a library, a CLI, and a PyO3 extension module), already at the
floor in `rust-lint-format-rules`: `clippy::pedantic` denied, `unwrap_used` denied,
`missing_docs` denied, `warnings` denied.

**Reproducer:** `scripts/measure-rust-lint-cost.mjs`. Configuration:
`scripts/fixtures/rust-lint-cost/clippy.toml`. Raw mapping:
`evidence-2026-08-23-rust-lint-cost.tsv` (415 rows: lint, scope, package, target kind,
target name, file, line, column).

```bash
node scripts/measure-rust-lint-cost.mjs \
  --repo <path-to-fdu> --out docs/project/research/current/evidence-2026-08-23-rust-lint-cost \
  --clippy-conf scripts/fixtures/rust-lint-cost/clippy.toml \
  --lint clippy::let_underscore_future --lint clippy::panic \
  --lint clippy::wildcard_enum_match_arm --lint clippy::disallowed_methods \
  --lint clippy::expect_used --lint clippy::indexing_slicing
```

## Why the First Method Was Wrong

The original measurement split each file’s diagnostics at its first `#[cfg(test)]`
attribute and called everything below it test code.
A `#[cfg(test)]` attribute applies to the *next item*. It is not a divider.
`crates/fdu-core/src/lib.rs` puts `#[cfg(test)] mod test_support;` at line 64 and
`pub mod report_format;` at line 71; every production item below line 64 was counted as
test code.

Reconstructing that method over the raw diagnostics and comparing it against the
compile-unit classification below: **145 of 415 diagnostics — 34% — were placed in the
wrong bucket, in both directions.** Thirty-five `expect_used` hits in inline test
modules were counted as production, and twenty-seven `indexing_slicing` hits in
production code were counted as tests.
The errors do not cancel; they are large relative to the counts the verdicts rested on.

## The Method

Ask the compiler which compile units contain the code, rather than reading the source
positionally. Two passes over the same workspace:

| Pass | Command | Contains |
| --- | --- | --- |
| production | `cargo clippy --workspace --lib --bins` | library and binary code compiled without `cfg(test)`, plus build scripts |
| all | `cargo clippy --workspace --all-targets` | the above plus inline `#[cfg(test)]` modules, integration tests, examples, and benches |

A diagnostic present in both passes is in code that compiles without `cfg(test)`. A
diagnostic present only in the second is test-only.
Cargo reports the target that produced each diagnostic, which separates build scripts,
integration tests, examples, and benches from the library and binaries.
Diagnostics are keyed by lint plus primary-span file, line, and column, and deduplicated
— `--all-targets` compiles the library twice, so raw counts otherwise roughly double.

Three buckets, because “production” alone hides which cost a release actually carries:

- **Ships** — shipped crate types (`lib`, `bin`, `cdylib`, …) compiled without
  `cfg(test)`. This is the number that decides whether a lint is adoptable.
- **Build scripts** — `custom-build` targets.
  They run at build time, panic legitimately, and are usually exempted separately.
- **Tests and examples** — inline `#[cfg(test)]` code plus `test`, `example`, and
  `bench` targets.

**The measurement caps lints at `warn`** (`RUSTFLAGS=--cap-lints warn`). This is not
cosmetic.
The first corrected run did not cap them, fdu denies warnings, and the run died
in the first crate’s build script: it reported 9 diagnostics for the whole workspace
instead of 415, with zeroes for three of the six candidate lints.
A measurement run that stops at the first failure measures whichever crate compiled
first. That is the same failure mode `ci-and-gates-rules` describes for gates, arriving
through the back door.

## Results

| Candidate lint | Ships | Build scripts | Tests/examples | Previously published (prod/test) |
| --- | ---: | ---: | ---: | --- |
| `clippy::let_underscore_future` | 0 | 0 | 0 | 0 / 0 |
| `clippy::panic` | 2 | 2 | 35 | 2 / 4 |
| `clippy::wildcard_enum_match_arm` | 12 | 0 | 9 | 7 / 11 |
| `clippy::disallowed_methods` (fs writes) | 0 | 1 | 82 | 1 / 82 |
| `clippy::expect_used` | 32 | 7 | 35 | 25 / 45 |
| `clippy::indexing_slicing` | 79 | 0 | 119 | 62 / 136 |

Every nonzero figure moved.
No verdict in `rust-lint-format-rules` reverses, and two are now better supported than
they were:

- **`panic`** — the old table’s justification (“build scripts panic legitimately and
  need their own allow”) was asserted.
  It is now visible: half the non-test cost is in `build.rs`.
- **`disallowed_methods` for filesystem writes** — the shipping cost is not “nil”, it is
  **zero**. The single non-test hit is in a build script.
  The entire remaining cost is 82 test fixtures, which one crate-level allow covers.
- **`expect_used`** (32 shipping) and **`indexing_slicing`** (79 shipping) are both more
  expensive than reported, which strengthens “defer or ratchet” and “do not deny
  outright”.

## Scope of This Evidence

One codebase, one shape: a filesystem CLI with a library and an extension module.
It establishes what these lints cost *there*, which is enough to reject a universal
floor rule and not enough to establish one.
`rust-lint-format-rules` states the admission criteria a rule has to meet before it is
called universal, and this measurement satisfies only the incidence criterion.

<!-- This document follows common-doc-guidelines.md.
See github.com/jlevy/practical-prose and review guidelines before editing.
-->
