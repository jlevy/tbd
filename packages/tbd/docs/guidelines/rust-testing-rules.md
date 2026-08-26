---
title: Rust Testing Rules
description: Rules for effective unit, integration, property, snapshot, and cross-platform testing in Rust
author: Joshua Levy (github.com/jlevy) with LLM assistance
category: rust
---
# Rust Testing Rules

Use these rules for Rust tests in libraries, applications, services, and command-line
tools. They supplement the language-agnostic testing and TDD guidance with Rust-specific
test placement, feature, platform, fixture, and toolchain concerns.

**Related**:

- `general-testing-rules`, `general-tdd-guidelines`, `golden-testing-guidelines` (the
  language-neutral testing rules this supplements)
- `rust-rules` (language and API design)
- `rust-project-setup` (feature and workspace shape the matrix reflects)
- `rust-cli-rules` (the executable contract these tests exercise)
- `filesystem-rules`, `rust-filesystem-rules` (the filesystem cases to cover)
- `ci-and-gates-rules` (running the suite in a hostile environment; timeouts)
- `error-handling-rules` (failure paths and exit codes)

## Choose the Smallest Test Boundary That Proves Behavior

- Put focused unit tests beside private implementation in `#[cfg(test)] mod tests`.
- Put public API and executable-flow tests under a package’s `tests/` directory.
- Use doctests for public examples that should compile and run.
- Use an end-to-end test only when the process boundary, environment, terminal, network,
  or filesystem behavior is part of the contract.

In a workspace, integration tests belong inside the member package they test.
A workspace-root `tests/` directory is not automatically a test target.

## Assert Public Outcomes and Each Externally Distinct Failure

`general-testing-rules` owns the “cover externally distinct failures, not every fallible
call” rule and the public-outcome focus.
Rust specifics:

- Twenty `?` operators that all surface the same error, at the same exit status, with
  the same cleanup, are one behavior and want one test.
  Two that differ in what the caller must do next are two, however similar the code
  looks.
- Check structured error variants (`enum` arms callers match on) and user-visible
  context fields callers display.
- Use `panic!` or `assert!` with a useful impossible-branch message rather than an
  unconditional `assert!(false)`.

## Embed Fixed Fixtures and Read Path-Semantics Fixtures at Runtime

`general-testing-rules` owns fixture provenance—one authoritative copy, stated
regeneration, reviewable diffs, and no machine-specific content.
Rust adds one choice:

- Use `include_str!` or `include_bytes!` when the fixture is fixed at compile time.
  The bytes become part of the binary, so the test cannot drift from them at runtime; a
  missing file is caught at compile time.
- Read at runtime when the test exercises path handling, permissions, or mutable state—
  embedding would bypass the very code under test.

```rust
const INPUT: &str = include_str!("fixtures/input.txt");
const EXPECTED: &str = include_str!("fixtures/expected.txt");

#[test]
fn renders_the_document() {
    assert_eq!(render(INPUT), EXPECTED);
}
```

## Use Goldens for Stable Structured Output and CLI Sessions

`golden-testing-guidelines` owns the representation rules—naming, normalization, review,
sizing, layered assertions, and CI acceptance policy.

Use `insta` by default for Rust snapshots because it keeps reviewed snapshot files and
update diffs in the test workflow.
Use another representation only when the project documents a format, interoperability,
or dependency-policy constraint that `insta` cannot satisfy.

## Use Property Tests for Invariants

Property tests are appropriate when a broad input space can be described through
invariants—round trips, idempotency, ordering, boundary-safe string processing,
state-machine rules, or no-panic over arbitrary valid input.

Use `proptest` by default; it provides integrated shrinking, value trees, and composable
strategies. Use `quickcheck` when the project already depends on it and migration is not
justified.

## Test Filesystem Behavior in Isolated Roots

`rust-filesystem-rules` owns the `tempfile::TempDir` isolation pattern and the
collision, symlink, metadata, commit-point, durability, and recovery cases that the test
suite must cover. Inject filesystem behavior through a narrow adapter when a
deterministic failure cannot be produced portably.

## Test CLI Contracts Through the Built Binary

Use an integration-test harness to run the actual packaged or Cargo-built executable.
Pass arguments as a vector, construct the environment explicitly, capture stdout and
stderr separately, and assert the exit status before interpreting output.

`rust-cli-rules` owns the command, stream, terminal, configuration, interruption, and
destructive-operation behaviors the harness must exercise.

## Control Scheduling and Exercise Cancellation, Backpressure, and Shutdown

- Await every spawned task or supervise its failure.
- Test cancellation at meaningful await points.
- Verify bounded queues apply backpressure.
- Exercise shutdown with queued and in-flight work.
- Use deterministic coordination primitives rather than timing assumptions.
- Run concurrency-specific tools, such as a model checker, when lock-free or unsafe
  synchronization warrants them.

A passing happy-path async test does not establish cancellation safety.

## Test Every Supported Feature, Toolchain, and Platform Dimension

The test matrix should reflect supported configurations:

- default features;
- no default features when supported;
- all compatible features;
- important individual or mutually exclusive feature sets;
- the declared MSRV;
- the pinned normal toolchain;
- each supported operating system and architecture behavior that differs materially.

Do not multiply a matrix without a question for each dimension.
Compile-only checks can cover configurations whose runtime behavior is identical;
platform adapters need real tests on the platform.

## Use Coverage to Find Untested Contracts, Not as the Goal

`general-testing-rules` owns the principle: coverage is a discovery tool, not the
definition of coverage.

Use `cargo-llvm-cov` by default to identify unexecuted lines, regions, and branches.
Use another coverage tool only when the compiler, target, or reporting environment
cannot support it, and keep the replacement command reproducible.

## Keep Ignored Tests Actionable

`general-testing-rules` owns the rule: every ignored or retried test carries a tracking
issue or bead, an owner, a reason, and an unblock condition, and a flake is a
correctness defect until evidence says otherwise.

Two Rust specifics:

- Put the reason and tracker in the attribute, not a comment above it.
  `cargo test` prints the string
  back—`test tests::merge ... ignored, flaky under CI: tbd-1234`—so the justification
  appears in every run instead of only in the source.
- `cargo test` reports `N filtered out`, which is how a selection that matched nothing
  becomes visible. A renamed module or a stale filter otherwise prints
  `0 passed; 0 failed` and exits zero, which is the empty-selection failure
  `general-testing-rules` warns about.

<!-- This document follows common-doc-guidelines.md.
See github.com/jlevy/practical-prose and review guidelines before editing.
-->
