---
title: General Testing Rules
description: Rules for keeping test volume low while preserving broad evidence—rejecting vacuous tests, choosing portable black-box tests when they preserve coverage, keeping the inner loop fast, controlling nondeterminism, and never letting an empty or skipped selection look like a pass.
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

## Keep Test Suites Concise, Clear, High-Coverage, Fast, and Portable

Test volume and evidence are separate variables.
Minimize total maintenance and runtime cost while preserving the strongest practical
evidence. Optimize these properties simultaneously:

1. **Concision:** Keep total test code, fixture data, setup, and expected output as
   small as possible without losing independent evidence.
2. **Clarity:** Make the asserted contract and the reason for each expected value
   obvious enough that a reviewer can detect a wrong test and a maintainer can update it
   safely.
3. **Coverage:** Exercise as many distinct public contracts, boundaries, failure modes,
   and state transitions as reasonably possible.
   Line coverage is a discovery tool, not the definition of coverage.
4. **Efficiency:** Keep the edit, commit, and ordinary CI loop as fast as possible;
   isolate evidence that cannot fit its measured budget in an explicit slower tier.
5. **Portability:** Prefer fixtures, commands, inputs, and expected outputs that can
   test another implementation language without being rewritten, when they preserve the
   same coverage and useful failure location.

Reducing test volume is required maintenance.
Merge or delete a test when another test already proves the same contract with equal
clarity and diagnosis.
Preserve tests that exercise different contracts through the same code.

## Don’t Just Test the Test

A test is vacuous when it verifies only facts established by its own setup rather than
behavior supplied by the program:

- constructing `User(name="Ada")` and asserting `user.name == "Ada"` when construction
  only assigns the argument;
- running the fixture initializer and asserting its `initialized` flag is true;
- adding `process` to a mock and asserting that the mock has a `process` method;
- creating a fixture with three records and asserting that the untouched fixture still
  has three records.

Delete these tests. Keep a construction test only when construction performs a real
contract such as validation, normalization, defaulting, copying, or invariant
enforcement, and assert that behavior.
Test setup code directly only when the setup mechanism is itself production behavior;
otherwise a broken setup should cause the behavioral assertion to fail.

## Keep a Test Only When It Adds Independent Evidence

For every test, state the contract, boundary, failure mode, or useful failure location
it establishes that the rest of the suite does not.
If that statement cannot be written, merge or remove the test.

- Keep overlapping execution when tests protect different public interfaces or narrow a
  failure to different layers.
- Collapse repeated examples into a parameterized case or a compact golden when the
  combined failure still identifies the broken behavior.
- Prefer a stronger oracle to more examples: a fixed-seed property test for an
  invariant, a differential test for compatibility with another implementation, or
  injected failure at a commit boundary.
- Cover externally distinct failures, not every internal fallible call that produces the
  same public error and recovery behavior.

## Assert Transferred Data, Not Merely That a Mock Was Called

`expect(store.save).toHaveBeenCalled()` passes when the wrong object is saved.
Assert the exact fields and values the receiver depends on, plus the observable result
of the operation. A call-count assertion earns its place only when the count is itself a
public contract, such as exactly-once billing, bounded retries, or no external call
after local validation fails.

Never assert that a mock has the methods or values the test assigned to it.
Prefer a real or in-memory collaborator when it is deterministic and cheaper than
maintaining a mock model; otherwise keep the mock at one boundary and verify the
complete data crossing that boundary.

## Keep the Inner Loop Fast and Put Costly Evidence in Explicit Outer Loops

Measure the suite used during editing, on commit, and in ordinary CI, then set a budget
that preserves frequent use.
Before moving a test out of that loop, reduce redundant setup, share immutable fixtures,
replace sleeps with synchronization, batch process startup, and use a cheaper oracle
with the same coverage.

If the evidence still cannot fit the budget, put it in a named outer tier such as a
platform matrix, scheduled system test, hardware test, live-service test, or documented
manual check. State when that tier runs and which contract it covers.
An outer tier is a placement for inherently costly evidence, not a place to hide an
unnecessarily slow test.

## Prefer Language-Neutral Tests When They Preserve the Same Coverage

For a CLI, prefer golden fixtures that invoke the built executable and record arguments,
stdout, stderr, exit status, and relevant files over language-coupled unit or
integration tests when both approaches cover the same contracts.
A Python implementation can then be ported to Rust while the commands and expected
outputs remain unchanged; the unchanged tests also serve as differential evidence during
the port.

Keep language-specific tests when they cover an invariant that the public interface
cannot expose economically, run materially faster, or give necessary failure
localization. Portability is one optimization property; preserve stronger evidence when
the two conflict.

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

## Keep One Portable Source for Every Test Fixture

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

## Raise a Timeout Only With a Recorded Measurement

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
