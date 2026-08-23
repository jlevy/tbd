---
title: General Testing Rules
description: Rules for writing minimal, effective tests with maximum coverage, plus what makes a suite trustworthy rather than merely green—assertions that survive refactoring, determinism, fixtures that do not encode the machine that recorded them, timeouts that record a measurement, and never letting an empty or skipped selection look like a pass.
author: Joshua Levy (github.com/jlevy) with LLM assistance
category: general
---
# General Testing Rules

**Related**:

- `general-tdd-guidelines` (the red-green workflow)
- `golden-testing-guidelines` (snapshot and golden testing)
- `error-handling-rules` (verifying failure paths and exit codes)
- `ci-and-gates-rules` (running the suite in a hostile environment; timeouts; gates that
  pass while checking nothing)

## Write Few Tests, and Make Each One Earn Its Place

- Write the minimal set of tests with the maximal coverage.
  Write as few tests as possible that *also* cover the desired functionality.
  If you see many similar tests, review to see if any can be removed or rewritten to be
  shorter without reducing test coverage.

- Do NOT write unit tests that are obviously going to pass (like creating objects and
  validating they are set on an object).
  These needlessly clutter the codebase.
  For example:
  - Do not write a test that simply instantiates a class and the object’s fields are
    set.

- Do NOT write a test that is trivial enough it is obviously tested as part of another
  test in the same codebase.

- Don’t test implementation details: Focus on behavior and outcomes, not internal
  mechanics, so tests remain valid when you refactor.

- Test edge cases and boundaries: Include tests for empty inputs, nulls, maximums,
  minimums, and error conditions—not just happy paths.

- Do not duplicate the same assertion at every layer.
  Each broader test should prove an interaction the narrower one cannot.

## Assert the Outcome, Not the Interaction

A test that asserts a mock was called proves the code under test called a mock.
That is usually the least interesting thing that happened.

- **Assert the contract that crossed the boundary, not that a call occurred.**
  `expect(store.save).toHaveBeenCalled()` passes when the wrong object is saved.
  Assert the shape and the values that the receiving component depends on.
- **Never assert that a mock has the methods you gave it.** A test that checks
  `typeof mock.process === 'function'` tests the test.
- **Test the data flow between components**, not each call in isolation.
  The defects worth catching live in what one component hands the next.
- **Prefer a real collaborator to a mock** wherever it is fast and deterministic.
  A mock encodes your belief about the dependency; a real one encodes the dependency.

## Keep Tests Deterministic

The tests that cost the most are the ones that fail sometimes.

- **Sort before asserting order** for filesystem listings, maps, sets, and concurrent
  results—unless order itself is the behavior under test.
  “Whatever order the platform returned” is reproducible on one machine and nowhere
  else.
- **Inject clocks, random number generators, ID generators, environment access, and
  network clients** at boundaries.
- **Use fixed seeds for randomized tests, and print the seed on failure.** A property
  test that fails once and cannot be replayed has told you nothing you can act on.
- **Never sleep to wait for something.** Advance a controllable clock, or synchronize on
  observable state. A sleep is either too short (flaky) or too long (slow), and it is
  usually both on different machines.
- **Give concurrent tests bounded timeouts** so a deadlock fails with context rather
  than hanging the suite.
- **Isolate environment variables and the working directory**, and restore them even
  when the test fails.
- **Do not depend on test execution order** or on another test’s side effects.

## Tests Run in an Environment Nobody Chose

A test that spawns subprocesses inherits ambient state from whatever invoked it—a shell,
a git hook, a CI runner.
That state can redirect the subprocess at something real.

The canonical case: git exports `GIT_DIR` into hook environments, so a suite run from a
pre-push hook can have its fixtures rewrite the actual repository.
Scrub the inherited environment in the test setup *and* in the hook wrapper; neither
layer alone is sufficient, because tests also run outside hooks.
`ci-and-gates-rules` covers the general rule and the wiring.

Any ambient variable that redirects a tool’s target—`GIT_DIR`, `HOME`, registry and
cache overrides—is an input the suite must control rather than inherit.

## Fixtures Are Inputs With Provenance

- Keep one authoritative copy of a fixture, near the tests that own it.
  Copying the same bytes into unit and integration directories guarantees they diverge.
- Say how a generated fixture is regenerated, and from which source or schema.
- Keep fixture diffs reviewable.
  One enormous input hides the behavior that changed.
- **Committed test data must not name the machine that recorded it.** An update flag
  writes what it saw, so it happily expands a portable pattern into a local literal—an
  absolute path, a username, a platform-specific byte count.
  That passes forever on the recording machine and nowhere else.
  Check committed fixtures for machine-specific content explicitly; `ci-and-gates-rules`
  covers the stronger version of this, where the authority for a recording is CI rather
  than a developer’s laptop.

## Timeouts Record a Measurement

Raise a timeout only where it is genuinely tight, scope the raise to where it applies,
and record the measurement that forced it:

```typescript
// `bridge-merge` failed CI at 5472ms against the 5s default: several tests drive a
// dozen real git subprocesses, which fits comfortably on Linux and macOS and lands
// right at the edge on the Windows runner's slower process spawn.
testTimeout: isWindows ? 20000 : 5000,
```

A global raise masks hangs everywhere else, which is the failure mode timeouts exist to
catch. Without the comment, a bare large number is indistinguishable from surrender, and
the next person to meet a slow test raises it again.

## Never Let an Absent Test Look Like a Passing One

This is the failure that hides every other failure.

- **Report how many tests ran.** An empty selection—a bad filter, a renamed directory, a
  glob that stopped matching—exits zero and prints green.
  If the count can be asserted, assert it.
- **A missing external dependency must fail setup loudly or be its own selectable test
  tier.** It must never silently skip a test the suite is believed to run.
- **Never let a test ignore a fallible setup step.** A fixture that failed to build
  produces a test that asserts nothing about the thing it names.
- **Every ignored, quarantined, or retried test needs a tracking issue or bead, an
  owner, a reason, and an unblock condition.** Without those it is permanent, and nobody
  will ever be reminded it exists.
- **Treat a flake as a correctness defect until evidence says otherwise.** Do not weaken
  an assertion, lengthen a sleep, or add a retry without naming the race or the
  nondeterministic dependency it works around.
  Each of those converts a real signal into silence.

<!-- This document follows common-doc-guidelines.md.
See github.com/jlevy/practical-prose and review guidelines before editing.
-->
