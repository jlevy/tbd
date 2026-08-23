---
title: Rust Project Setup
description: Rules for structuring, validating, and maintaining modern Rust packages and workspaces
author: Joshua Levy (github.com/jlevy) with LLM assistance
category: rust
---
# Rust Project Setup

Use this guideline when starting or modernizing a Rust package, application, or
workspace. It defines the project-level quality floor: Cargo metadata, package
boundaries, toolchains, linting, CI, documentation, and dependency policy.

**Related**:

- `rust-lint-format-rules` (the lint, format, and toolchain floor)
- `rust-rules` (language and API design)
- `rust-testing-rules` (test architecture and coverage)
- `release-engineering-rules`, `rust-release-rules` (artifacts and publishing)
- `code-review-rules`, `rust-code-review-rules` (review)
- `ci-and-gates-rules` (how the gate is wired and how you prove it is live)
- `supply-chain-hardening`, `commit-conventions` (dependency and commit policy)

## Choose the Smallest Package Shape That Fits

Start with one package unless the code has a concrete reason to be split.

- **Library only:** one `[lib]` target for a reusable API.
- **Binary only:** one `[[bin]]` target when no library surface is useful.
- **Library and binary:** keep domain behavior in the library and make the binary a thin
  process boundary.
- **Workspace:** use separate packages when they need different release lifecycles,
  dependency sets, platform constraints, or public APIs.

Do not create a workspace only to imitate a large project.
Every package boundary adds feature resolution, publishing, ownership, and CI
complexity.

```text
project/
├── Cargo.toml
├── Cargo.lock
├── rust-toolchain.toml
├── src/
│   ├── lib.rs
│   └── main.rs
├── tests/
├── docs/
└── .github/workflows/
```

## Declare the Package Contract

Every published package should declare its edition, MSRV, license, repository, readme,
and a concise description.
Use a valid SPDX expression for `license`.

```toml
[package]
name = "example"
version = "0.1.0"
edition = "2024"
rust-version = "1.85"
license = "MIT OR Apache-2.0"
description = "A concise description"
repository = "https://github.com/example/example"
readme = "README.md"
```

For a workspace, centralize shared metadata, dependencies, and lint policy:

```toml
[workspace]
members = ["crates/*"]
resolver = "3"

[workspace.package]
edition = "2024"
rust-version = "1.85"
license = "MIT OR Apache-2.0"

[workspace.lints.rust]
unsafe_code = "deny"
```

Virtual workspaces must declare the resolver because there is no root package edition
from which Cargo can infer it.

## Separate Optional Surfaces With Features

Use features to prevent consumers from paying for functionality they do not use.
CLI, network, database, and platform integration dependencies are common feature
boundaries.

```toml
[features]
default = ["cli"]
cli = ["dep:clap"]

[[bin]]
name = "example"
path = "src/main.rs"
required-features = ["cli"]
```

- Keep the core library buildable with `--no-default-features` when that is part of the
  package contract.
- Avoid feature combinations that change the meaning of the same public API.
- Test the feature sets users are expected to build; do not assume `--all-features`
  covers mutually exclusive configurations.
- Use target-specific dependencies for OS-specific integrations instead of compiling
  unused platform code everywhere.

## Pin the Development Toolchain Deliberately

`rust-lint-format-rules` carries the `rust-toolchain.toml` block and why the pin and the
MSRV are different things.
The project-shape decisions that belong here:

- Pin whenever contributors and CI must agree.
  A moving `stable` channel in a reproducibility-sensitive workflow means the rule set
  changes under you between runs that look identical.
- Set `rust-version` from what the package actually supports, not from what happens to
  compile today, and treat raising it as a compatibility decision released under the
  project’s own policy—consumers do not all treat an MSRV bump the same way.
- Review and update the pin deliberately, as a change with a diff to read.

## Let rustfmt Own Formatting

`cargo fmt --all` owns Rust layout; nobody hand-formats, and no manual layout rules are
mixed with rustfmt output.
Keep `rustfmt.toml` small: the edition must match the package, and every other setting
needs a stated readability or generated-code reason.

```toml
edition = "2024"
max_width = 100
```

Format TOML, Markdown, YAML, JSON, and scripts with their own formatters too;
`rust-lint-format-rules` covers the full set and the verify-mode commands.

## Lint and Format Policy

`rust-lint-format-rules` owns the lint and format floor: the `[lints]` block, the
`clippy.toml`, rustfmt settings, and measured adoption cost for the lints beyond the
floor. It is a single stated configuration rather than a choice of strategies.

Two project-shape points belong here rather than there:

- Declare lints once in `[workspace.lints]`, and make **every member opt in** with
  `[lints] workspace = true`. Workspace lints do not apply on their own, which is the
  most common way a Rust lint floor turns out to be silently absent.
- Never enable the entire Clippy `restriction` group.
  It contains mutually contradictory lints and is designed to be drawn from selectively.

## Make One Local Command Match CI

Contributors and CI run the same named entry point, and it is the handoff gate: if it
passes, CI should. Use a checked-in `justfile` by default because it keeps named tasks
local and reviewable; use a script or another task runner when bootstrap availability,
portability, or an established repository convention gives a concrete reason.

`rust-lint-format-rules` carries the baseline command list, ordered so it fails fastest.
Add to it the checks that define the actual project contract: MSRV compilation and
tests, no-default-feature and selected-feature builds, cross-platform tests, coverage or
semver checks, and tests for the release and maintenance scripts.

Keep auto-fix and verification separate—`ci-and-gates-rules` explains why a project with
only fix-mode commands cannot detect drift.
CI verifies; it never commits.

## Design CI as Independent Evidence

`ci-and-gates-rules` owns gate design in general: splitting jobs so failures answer
different questions, read-only default permissions with per-job grants, SHA-pinned
actions, verify-only commands, and the traps that keep a gate green while it checks
nothing.

Three Rust specifics on top of it:

- Use `--locked` on every Cargo command that consumes the committed lockfile, so a
  resolver change fails the job instead of silently altering what was tested.
- Give the MSRV its own job that compiles *and* tests.
  `cargo check` alone proves the code parses on the floor version and misses behavioral
  and test-only regressions.
- Give the feature combinations library consumers actually build their own job—
  `--no-default-features`, and each additive feature.
  Otherwise that path is compiled only by them.

For release-only permissions and publishing, see `release-engineering-rules` and
`rust-release-rules`.

## Apply Dependency and Supply-Chain Policy

Every dependency can execute code at build time through its own `build.rs`, proc macros,
native build tooling, or transitive dependencies.
Treat additions and upgrades as code changes.

- Apply the repository’s cool-off period before adopting a new release.
- Record a concrete reason for adding or upgrading a crate.
- Read new or changed `build.rs` scripts and proc-macro source.
- Review the exact source diff and release notes for an upgrade.
- Minimize enabled features and default features.
- Prefer registry sources; justify git dependencies and pin them to immutable commits.
- Use `cargo-deny` by default for advisory, license, source, and duplicate-version
  policy. Add OSV or another scanner when it covers ecosystems or evidence outside the
  Cargo graph.
- Use `cargo tree` to understand ownership of transitive dependencies.
- Use an unused-dependency tool as supporting evidence, then verify removals by build
  and test.

Commit `Cargo.lock` for applications, binaries, and workspaces that ship or deploy a
resolved tree. For a library-only repository, choose and document a lockfile policy;
remember that downstream users resolve their own graph even when the repository keeps a
lockfile for CI.

The authoritative cross-ecosystem policy is `tbd guidelines supply-chain-hardening` and
the repository’s own supply-chain policy document.

## Keep Development Automation Reviewable

A task runner is useful when it names stable operations such as `format`, `lint`,
`test`, `check`, and `precommit`. It should orchestrate checked-in commands, not hide
network installs or environment mutation.

- Put complex logic in typed or testable scripts rather than long YAML or shell blocks.
- Make scripts accept explicit inputs and return non-zero on partial failure.
- Test failure paths and machine-readable outputs.
- Do not overwrite user configuration as a side effect of ordinary validation.
- Keep editor tasks, agent hooks, and local bootstrap scripts subject to the same review
  and pinning policy as CI.

## Document the Supported Surface

Published projects normally need:

- `README.md` for purpose, installation, and a minimal example;
- license files that match the manifest expression;
- release notes or a changelog according to project policy;
- public API documentation and doctests;
- a security reporting path;
- supported-platform, feature, MSRV, and deprecation policies;
- extended docs only where the README would become difficult to navigate.

Build docs with warnings denied where practical:

```bash
RUSTDOCFLAGS="-D warnings" cargo doc --locked --workspace --no-deps
```

Pass the exact feature set used for the published documentation surface; use
`--all-features` only when that is a valid, supported combination.

## Keep Repository Configuration Minimal

Typical repository files include:

```text
Cargo.toml
Cargo.lock
rust-toolchain.toml
rustfmt.toml
README.md
LICENSE-MIT
LICENSE-APACHE
.gitattributes
.gitignore
```

- Ignore build output such as `/target`, not source or lock data needed for a clean
  checkout.
- Use `.gitattributes` to make text newline policy explicit across platforms.
- Do not add generated files unless consumers need them or regeneration is not
  sufficiently deterministic.
- Keep source checkouts used for comparison, vendoring, or fixtures governed by an
  explicit provenance and update policy.

<!-- This document follows common-doc-guidelines.md.
See github.com/jlevy/practical-prose and review guidelines before editing.
-->
