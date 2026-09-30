---
title: Review Code (Correctness)
description: Dedicated correctness review pass (kind=correctness) for intricate logic where a subtle error is costly and hard to detect, such as concurrency and locking, data integrity and persisted formats, migrations, sync and merge algorithms, and numerical calculations; runs on top of review-code
category: review
author: Joshua Levy (github.com/jlevy) with LLM assistance
---
This shortcut performs a **dedicated correctness review**: a separate pass over a change
whose logic is intricate enough that a subtle error would be costly and hard to detect,
by a reviewer who states the invariants first and then tries to break them.
It is one of the dedicated reviews in Review Coverage and Rounds in
`tbd shortcut pr-review-workflows`: its own published review, with its own letter and
`kind=correctness`, addressed like any other review.

It runs on top of `tbd shortcut review-code`, the review engine.
The engine’s rules apply unchanged and are not restated here: the scope options, the
pinned head checked out in the working tree for PR scope, running the tests, keeping
scratch files out of the repository, and reporting every finding with its severity.
The senior engineering review owns design, style, and ordinary correctness; this pass
goes deeper on the areas below and does not repeat that work.

## When It Applies

Run this review when `tbd shortcut review-github-pr` or the coordinator decides the PR
is sensitive in correctness, or when the user asks for a correctness pass.
A change is sensitive in correctness when it touches intricate logic where a subtle
error is costly and hard to detect, such as:

- **Concurrency and locking:** processes, replicas, or async tasks touching shared state
- **Data integrity and persisted formats:** what is written to disk or sent over the
  wire, and how it is read back
- **Migrations:** any transformation of data written by a released version
- **Sync and merge algorithms:** reconciling state from more than one source
- **Numerical calculations:** ranges, rounding, units, time, and money

Judge by the cost of being wrong and how late the error would surface: an error in the
sync tie-breaker silently discards a user’s edit on some other machine weeks later; an
error in a help string is caught by the first reader.
When it is unclear whether the area applies, ask the user.

## Instructions

Create a to-do list with the following items then perform all of them:

1. **Establish the scope and diff** as `tbd shortcut review-code` does (determine scope,
   get the diff, identify files and languages).

2. **Load the guidelines:**

   - Run `tbd guidelines code-review-rules` (severity, risk ordering, reproducing a
     defect before reporting it)
   - Run `tbd guidelines error-handling-rules` (success proven not assumed, explicit
     state, partial failure)
   - Run `tbd guidelines general-testing-rules` (deterministic tests, an absent test
     never looks like a pass) and `general-tdd-guidelines` (each reproduction is a red
     test first)
   - Add the topic guidelines the change touches:
     - Persisted data or file mutation: `filesystem-rules` (atomic publication,
       visibility versus durability, failure injection at the commit point) and
       `backward-compatibility-rules` (the compatibility boundary for data written by
       released versions)
     - Serialization or a persisted format: `golden-testing-guidelines`, and
       `typescript-yaml-handling-rules` for YAML
     - Ordering or sorting: `typescript-sorting-patterns`
     - The project’s own contracts for the subsystem; for tbd’s storage and sync,
       `tbd design` and `tbd guidelines tbd-sync-troubleshooting`
   - Add the language rules: `rust-code-review-rules` and `rust-rules` for Rust,
     `typescript-rules` for TypeScript, `python-rules` for Python.
     The senior review owns the lint and format floors.

   The topic guidelines own the rules for each surface; the checklist below is the
   correctness substance of this pass.

3. **State the invariants before reading line by line.** Write down what the change must
   preserve: what must hold for persisted data after any sequence of operations,
   including a crash partway through; which operations must be idempotent or
   commutative; the states and transitions of any state machine; the units, ranges, and
   precision of any numeric value.
   Then list every place two actors (processes, replicas, async tasks, clones of the
   repository) can touch the same state.
   Each invariant is checked against the diff in step 4, and the review reports whether
   it holds.

4. **Work through the checklist** for each area the change touches.
   Each question names the failure it catches; severity follows from the cost of the
   wrong result, as `code-review-rules` defines, not from the match.

   **Concurrency and locking**
   - Which invariant spans two operations that can interleave (a read-modify-write of a
     file, check-then-act on a lock file, two processes syncing)?
     Where is the lock, what does it protect, does every writer take it, and what
     happens to a lock left by a crashed process?
   - In async code every `await` is an interleaving point: is state read before an await
     still valid after it?
     Can two calls of the same async function overlap and share module-level state?
     Is every promise awaited or deliberately detached, and where does its error go?
   - What happens on `SIGINT` or an exception in the middle of a multi-step mutation: is
     the state consistent, and are child processes and temporary files cleaned up?
   - Versioned or replicated state: can a stale update overwrite a newer one (last write
     wins with no version check)?
     Can events arrive out of order or be replayed after a ref rewind?

   **Data integrity and persisted formats**
   - Round trip: does every value survive write, read, write unchanged?
     Check unknown fields from a newer version (preserved or dropped), empty string
     versus null versus absent, key order, timestamps and time zones, unicode
     normalization, line endings, and trailing newlines.
   - Is serialization deterministic (sorted keys, stable ordering), so identical state
     produces identical bytes?
     Nondeterministic output in git-tracked data creates spurious diffs and merge
     conflicts.
   - Is the format versioned, and does the reader reject an unknown version with an
     actionable error instead of misreading it?
     Does the reader refuse malformed data, or substitute defaults that turn corruption
     into data loss on the next write?
   - Is each write atomic, and is durability needed beyond visibility?
   - Are IDs unique across machines and concurrent writers, with collisions detected
     rather than assumed away?
     Case-insensitive filesystems (macOS, Windows) collide names that differ only in
     case.

   **Migrations**
   - Idempotent and resumable: safe to run twice, and to rerun after a crash halfway?
     Does it detect migrated state by an explicit version rather than by inferring from
     the data?
   - Is the version stamp updated in the same atomic step as the data?
     A crash between the two leaves state that claims a version it is not.
   - Does it handle data written by every released version, and data on other clones or
     branches that will arrive by sync after the migration ran here?
   - Is it tested with fixtures captured from released versions, not fixtures generated
     by the current code?

   **Sync and merge algorithms**
   - Convergence: do two replicas applying the same operations in different orders reach
     the same state, and does applying an operation twice leave it unchanged?
     What breaks ties between concurrent edits, is it deterministic on every machine (a
     wall clock alone is not, given skew), and does it discard data silently?
   - Delete versus update: can a deleted item come back from a replica that had not seen
     the delete, and can an update be lost to a concurrent delete?
   - Three-way merge: is the base the real merge base?
     Are renames and moves handled?
     Can conflict markers land in persisted data?
   - Partial failure: if a push or fetch fails after some of the work, is local state
     consistent and does the retry re-apply correctly?
     What if the remote moved between fetch and push?

   **Numerical and boundary logic**
   - Inclusive versus exclusive bounds, `<` versus `<=`, and off-by-one at the ends of
     ranges and pages.
   - Integer division and rounding direction, float equality, accumulated error in sums,
     integers past 2^53 in JavaScript, division by zero, `NaN` (which compares false to
     everything and sorts unpredictably), percentages of a zero total.
   - Numbers compared or sorted as strings (`'10' < '9'`; a default `sort()` is
     lexicographic), string `length` versus code points, locale in case-insensitive
     comparison.
   - Time: seconds versus milliseconds since the epoch, time zones and DST, month
     lengths, ISO strings of differing precision compared as strings.

   **Intricate logic in general**
   - State machines: is every transition from every state defined, and what happens on
     an event in an unexpected state (error, ignore, or corrupt)?
   - Boundary inputs: empty, one element, the maximum, duplicates, very long, unicode,
     paths with spaces.
   - Which of the tricky cases above has a test, and does that test still assert what
     its name claims? For an algorithm, is there an exhaustive small-case or property
     test with a fixed seed?

5. **Reproduce before reporting.** Run the test suite as `review-code` does.
   For each suspected defect, write a failing test or scratch script in the session
   scratch directory: a two-process interleaving, a crash between two writes, a round
   trip of a fixture from a released version, an out-of-order sync.
   A finding you could not reproduce says so and names the check that would settle it.

6. **Compile the review** in the artifact format `review-code` specifies, with
   `kind=correctness` in the header and marker.
   Add an **Invariants checked** section: each invariant from step 3, whether it holds,
   and the reproduction or test that shows it, so the addressing agent can confirm a fix
   against the same case.
   Keep correctness findings first; a finding outside this area is still reported,
   marked as outside the correctness scope, and a finding already open on the PR is
   referenced by its ID rather than duplicated.
   Then determine the next action as `review-code` does: `review-github-pr` publishes
   the review, and `address-pr-review` addresses it.

<!-- This document follows common-doc-guidelines.md.
See github.com/jlevy/practical-prose and review guidelines before editing.
-->
