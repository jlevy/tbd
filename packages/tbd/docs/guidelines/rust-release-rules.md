---
title: Rust Release Rules
description: The Rust-specific half of releasing—crates.io publishing and workspace ordering, trusted publishing, cargo package and the unpublished-sibling trap, semver checks, and shipping a Rust binary as a Python wheel through maturin. The release contract itself lives in release-engineering-rules.
author: Joshua Levy (github.com/jlevy) with LLM assistance
category: rust
---
# Rust Release Rules

`release-engineering-rules` owns the release contract: one release identity, the
pre-release gate, least-privilege publishing authority, build-once-and-promote,
packaging and checksums, smoke-testing the packaged artifact, multi-channel
coordination, testable release logic, and incident preparation.
Read it first; it applies in every language.

This document owns the Cargo and crates.io specifics, and the maturin path for shipping
a Rust binary to Python users.

**Related**:

- `release-engineering-rules` (the release contract this implements)
- `release-notes-guidelines` (what goes in the notes)
- `rust-project-setup` (the package contract being published)
- `rust-testing-rules` (the tests the pre-release gate runs)
- `ci-and-gates-rules` (gate wiring and workflow authority)
- `supply-chain-hardening` (cool-off and pinning for release tooling)

## Publish Crates Safely

- Inspect `cargo package --list` and the packaged `.crate` before publishing.
  The packaged file set comes from `include`/`exclude` and `.gitignore` interactions,
  and it is routinely not what the author expected.
- Use `cargo publish --dry-run` as evidence, not as the release test.
  It does not prove the published crate builds for a consumer resolving its own
  dependency graph.
- Publish workspace crates in dependency order, and make reruns idempotent: a rerun that
  finds its own successful upload should succeed, and one that finds different bytes
  under the same version must fail.
- Mark internal workspace packages `publish = false`. This is the mechanism that keeps a
  test-support or xtask crate from reaching the registry.
- Use crates.io trusted publishing (OIDC) rather than a stored `CARGO_REGISTRY_TOKEN`
  where available.
- Run semver checks (`cargo-semver-checks`) for any library that promises API
  compatibility. Rust’s type system does not make a breaking change visible at the call
  site of a `cargo update`.
- Remember that yanking prevents new resolution but does not remove downloaded source,
  and does not break existing lockfiles.
  It is not a recall.

### The Unpublished-Sibling Trap

A workspace crate that depends on a sibling not yet on crates.io cannot be packaged
alone: cargo verifies the package by building it, and the sibling does not resolve.
Packaging the sibling first in a separate invocation does not help either—that produces
a `.crate` in `target/package`, not an entry in the index.

Name every interdependent crate in a **single** invocation, which makes cargo verify
each against the just-packaged siblings:

```bash
cargo package --locked -p mytool-core -p mytool
```

The same applies to `cargo publish` for a first release of a multi-crate workspace.
This is worth rehearsing before the release, per `release-engineering-rules`—it is a
failure that appears only on a first publish, which is exactly when nobody has
practiced.

## Build Artifacts With the Committed Resolution

- Use `--locked` for every release build so a resolver change fails the job rather than
  silently altering what ships.
- Build from the tagged commit, and record compiler version, target triple, and enabled
  features alongside each artifact.
- Use native runners where cross-compilation would prevent the packaged artifact from
  being smoke-tested. Cross-compilation adds a compiler, linker, sysroot, and
  native-library trust boundary; use it when necessary, not to shrink the matrix.
- Keep the release profile’s settings deliberate, and comment any that are load-bearing
  for reasons outside the profile:

```toml
[profile.release]
opt-level = 3
lto = true
codegen-units = 1
strip = true
# Deliberately no `panic = "abort"`: the same profile builds the Python extension
# module, and aborting there would take the host interpreter down with it. PyO3 needs
# unwinding so it can translate a Rust panic into a Python exception.
```

A separate symbol-bearing profile is worth keeping for performance work, because a
sampling profiler reading a stripped binary reports addresses rather than functions:

```toml
[profile.profiling]
inherits = "release"
debug = 2
strip = false
```

Codegen matches `release`, so the profile describes the shipped code and only the symbol
table differs. Timing decisions still come from `release` builds.

## Publish Binary Wheels Deliberately

Maturin with `bindings = "bin"` packages a Rust executable as a Python wheel.
Use it when the audience already installs tools through Python packaging—it is the
natural path for a Rust replacement of an existing Python CLI.

- Keep Cargo as the single version source, or validate exact version synchronization in
  the pre-release gate.
- Build the documented wheel-tag matrix, including the minimum supported libc (manylinux
  tag) and macOS deployment target.
  These decide which users can install at all.
- Use `abi3` where the extension API allows it, so one wheel serves many Python
  versions. Note that `abi3-pyXY` sets a *minimum* interpreter version and the build
  fails against an older one.
- Include an sdist only when source builds are supported and tested.
  An sdist that cannot build is worse than no sdist: pip will try it as a fallback.
- Smoke-test every native wheel’s installed console command, from an isolated
  environment, not from the source tree—`release-engineering-rules` explains why the
  distinction matters.
- Publish through PyPI trusted publishing.
- Make repeated workflow runs detect an already-published immutable version without
  treating a conflicting artifact as success.

## Release Checklist Additions

`release-engineering-rules` carries the general checklist.
Rust adds:

- [ ] `cargo package --list` reviewed for the actual file set.
- [ ] Interdependent crates packaged and published in one invocation, in dependency
  order.
- [ ] Internal crates marked `publish = false`.
- [ ] Semver checks run for libraries promising compatibility.
- [ ] `--locked` on every release build.
- [ ] Wheel tag matrix covers the documented libc and macOS floors.
- [ ] Trusted publishing used for every registry that supports it.

<!-- This document follows common-doc-guidelines.md.
See github.com/jlevy/practical-prose and review guidelines before editing.
-->
