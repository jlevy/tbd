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

## Choose the Smallest Test Boundary That Proves Behavior

- Put focused unit tests beside private implementation in `#[cfg(test)] mod tests`.
- Put public API and executable-flow tests under a package’s `tests/` directory.
- Use doctests for public examples that should compile and run.
- Use an end-to-end test only when the process boundary, environment, terminal, network,
  or filesystem behavior is part of the contract.
- Do not duplicate the same assertion at every layer.
  Each broader test should prove an interaction the narrower test cannot.

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

## Keep Tests Deterministic

- Sort filesystem, map, set, and concurrent results before asserting order unless order
  itself is the behavior.
- Inject clocks, random-number generators, IDs, environment access, and network clients
  at boundaries.
- Use fixed seeds for randomized regression tests and print the seed on failure.
- Avoid real sleeps. Advance a controllable clock or synchronize on observable state.
- Give concurrent tests bounded timeouts so deadlocks fail with context.
- Isolate environment-variable and current-directory changes; restore state even when
  the test fails.
- Do not rely on test execution order or one test’s side effects.

## Treat Fixtures as Inputs With Provenance

- Keep small text fixtures in source control near the tests that own them.
- Use `include_str!` or `include_bytes!` when compile-time embedding is appropriate.
- Use runtime reads when the test exercises path handling or mutable state.
- Keep one authoritative fixture instead of copying the same bytes across unit and
  integration directories.
- Explain how generated fixtures are regenerated and which source or schema they came
  from.
- Make fixture diffs reviewable; avoid one giant input that hides the failing behavior.

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

## Keep Ignored and Flaky Tests Actionable

- Every ignored, quarantined, or retried test needs a tracking issue or bead, owner,
  reason, and unblock condition.
- A missing external dependency should fail setup clearly or be a separately selected
  test tier; it should not silently skip a required test.
- Investigate flakes as correctness defects until evidence shows otherwise.
- Do not weaken assertions, increase sleeps, or add retries without identifying the race
  or nondeterministic dependency.
- Report how many tests ran so an empty selection cannot appear green.

## Related Guidelines

- `general-testing-rules`, `general-tdd-guidelines`, `golden-testing-guidelines` for the
  language-neutral testing rules this supplements
- `rust-rules` for language and API design
- `rust-project-setup` for feature and workspace shape
- `rust-cli-rules` for the executable contract these tests exercise
- `filesystem-rules` and `rust-filesystem-rules` for the filesystem cases to cover
- `ci-and-gates-rules` for running the suite in a hostile environment and for timeouts
- `tbd guidelines error-handling-rules`

<!-- This document follows common-doc-guidelines.md.
See github.com/jlevy/practical-prose and review guidelines before editing.
-->
