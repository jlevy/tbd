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

## Test Outcomes and Failure Paths

- Assert public results, state transitions, emitted events, files, streams, and errors;
  avoid private counters or call order unless those are the interface.
- For every fallible operation, test at least one representative failure and verify the
  complete outcome.
- Check structured error variants where callers depend on them and user-visible context
  where users depend on it.
- Test partial success, retries, interruption, cancellation, and cleanup for operations
  that can stop mid-flight.
- Never let a test ignore a fallible setup or assertion step.
- Use `panic!` or `assert!` with a useful impossible-branch message rather than an
  unconditional `assert!(false)`.

## Embed or Read Fixtures Deliberately

`general-testing-rules` owns fixture provenance—one authoritative copy, stated
regeneration, reviewable diffs, and no machine-specific content.
Rust adds one choice:

- Use `include_str!` or `include_bytes!` when the fixture is fixed at compile time.
  The bytes become part of the binary, so the test cannot drift from them and cannot
  fail on a missing file.
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

## Use Golden and Snapshot Tests Deliberately

Golden or snapshot tests are useful for structured output, diagnostics, CLI sessions,
serialized data, and large render trees.

- Name the behavior each snapshot represents.
- Normalize only fields outside the contract.
- Review the rendered diff before accepting an update.
- Keep snapshots small enough to diagnose.
- Pair a broad snapshot with focused assertions for critical invariants that a reviewer
  might miss in a large diff.
- Never auto-accept snapshots in CI.

Use `insta` by default for Rust snapshots because it keeps reviewed snapshot files and
update diffs in the test workflow.
Use another representation only when the project documents a format, interoperability,
or dependency-policy constraint that `insta` cannot satisfy.
Apply `tbd guidelines golden-testing-guidelines` before choosing the representation.

## Use Property Tests for Invariants

Property tests are appropriate when a broad input space can be described through
invariants, such as:

- parse/serialize round trips;
- output idempotency;
- ordering and deduplication;
- boundary-safe string processing;
- state-machine transition rules;
- no panic for arbitrary valid input.

Use constrained generators that produce meaningful cases.
Retain minimal failing cases as ordinary regression tests when they reveal a defect.
Property tests complement, rather than replace, examples with exact expected output.

## Test Filesystem Behavior in Isolated Roots

Give every mutating test its own `tempfile::TempDir` by default, build all fixture paths
under that root, and let its exact lifetime own cleanup.
Inject filesystem behavior through a narrow adapter when a deterministic failure cannot
be produced portably.

`rust-filesystem-rules` owns the collision, symlink, metadata, commit-point, durability,
and recovery cases that the test suite must cover.

## Test CLI Contracts Through the Built Binary

Use an integration-test harness to run the actual packaged or Cargo-built executable.
Pass arguments as a vector, construct the environment explicitly, capture stdout and
stderr separately, and assert the exit status before interpreting output.

`rust-cli-rules` owns the command, stream, terminal, configuration, interruption, and
destructive-operation behaviors the harness must exercise.

## Test Async and Concurrent Code as a State Machine

- Await every spawned task or supervise its failure.
- Test cancellation at meaningful await points.
- Verify bounded queues apply backpressure.
- Exercise shutdown with queued and in-flight work.
- Use deterministic coordination primitives rather than timing assumptions.
- Run concurrency-specific tools, such as a model checker, when lock-free or unsafe
  synchronization warrants them.

A passing happy-path async test does not establish cancellation safety.

## Cover Features, Toolchains, and Platforms by Policy

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

## Use Coverage to Find Missing Questions

Use `cargo-llvm-cov` by default to identify unexecuted lines, regions, and branches.
Use another coverage tool only when the compiler, target, or reporting environment
cannot support it, and keep the replacement command reproducible.
Use the report to ask which behavior lacks evidence.

- Do not optimize for a universal percentage.
- Require stronger evidence for parsers, state machines, security boundaries, and error
  handling than for trivial glue.
- Track coverage trends when a sudden drop indicates a missing test path.
- Exclude generated or unreachable code only with a documented reason.
- Keep the coverage command reproducible and subject to dependency pinning policy.

Coverage is a discovery tool.
It does not prove assertion quality or input-space completeness.

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
