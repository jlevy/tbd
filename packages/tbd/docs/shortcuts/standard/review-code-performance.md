---
title: Review Code (Performance)
description: Dedicated performance review pass (kind=performance) for a change on a hot path, over large data volumes, on a latency-sensitive path, or in memory and resource use; measures rather than estimates, and runs on top of review-code
category: review
author: Joshua Levy (github.com/jlevy) with LLM assistance
---
This shortcut performs a **dedicated performance review**: a separate pass over a change
that is sensitive in performance, by a reviewer who measures the changed paths at
realistic scale instead of estimating them.
It is one of the dedicated reviews in Review Coverage and Rounds in
`tbd shortcut pr-review-workflows`: its own published review, with its own letter and
`kind=performance`, addressed like any other review.

It runs on top of `tbd shortcut review-code`, the review engine.
The engine’s rules apply unchanged and are not restated here: the scope options, the
pinned head checked out in the working tree for PR scope, running the tests, keeping
scratch files out of the repository, and reporting every finding with its severity.
The senior engineering review owns design, style, and general correctness; this pass
does not repeat that work.

## When It Applies

Run this review when `tbd shortcut review-github-pr` or the coordinator decides the PR
is sensitive in performance, or when the user asks for a performance review.
A change is sensitive in performance when it touches any of:

- **Hot paths:** code that runs on every invocation, request, event, or item
- **Large data volumes:** collections, files, or histories whose size grows with the
  project or its users
- **Latency-sensitive paths:** startup, first output, interactive or request handling,
  watch-driven updates
- **Memory and resource use:** buffers, caches, queues, handles, subprocesses, timers,
  watchers, and their lifetimes

Judge by what the change does at scale, not by which files it edits: a new
`Array.prototype.find` inside an existing loop over all beads is a hot-path change; a
renamed variable in a benchmark is not.
When it is unclear whether the area applies, ask the user.

## Instructions

Create a to-do list with the following items then perform all of them:

1. **Establish the scope and diff** as `tbd shortcut review-code` does (determine scope,
   get the diff, identify files and languages).

2. **Load the guidelines:**

   - Run `tbd guidelines code-review-rules` (severity, risk ordering, and the rule that
     performance-sensitive paths come after correctness boundaries)
   - Run `tbd guidelines general-testing-rules` (a timeout raised only with a recorded
     measurement, costly evidence in explicit outer loops, deterministic tests)
   - Add the topic guidelines the change touches:
     - File traversal, large files, copies, or appends: `filesystem-rules`
       (deterministic traversal, cross-device moves as copies, append versus rewrite)
     - Retries, timeouts, or network calls: `error-handling-rules` (transient versus
       permanent errors decide what is worth retrying)
     - Convex functions or queries: `convex-limits-best-practices`
   - Add the language rules: `typescript-cli-tool-rules` (timing and startup) and
     `typescript-rules` for TypeScript, `rust-rules` and `rust-cli-rules` for Rust,
     `python-rules` for Python.
     The senior review owns the lint and format floors.

   The topic guidelines own the rules for each surface; the checklist below is the
   performance substance of this pass.

3. **Identify the hot paths and the scale before reading line by line.** For each
   changed function, note whether it runs once per invocation, once per item, or once
   per event, and what N is for every collection it touches: files in the repository,
   beads, commits, bytes in the largest file, requests per second.
   Use real numbers: this repository’s own size and the largest project the tool is
   expected to serve. Then measure the baseline: time the changed path on a
   representative input at the base and at the head, at the largest realistic N.

4. **Work through the checklist** for each area the change touches.
   Each question names the failure it catches; severity follows from the impact at
   realistic N, as `code-review-rules` defines, not from the match.

   **Algorithmic cost**
   - For each loop over a collection whose size grows with the project, what runs inside
     it? A `find`, `includes`, `indexOf`, `filter`, or `sort` inside a loop over the same
     data is quadratic; `Array.shift()` in a loop and `[...acc, item]` in a `reduce` are
     the same trap. Build a `Map` or `Set` once, or sort once.
   - Is work repeated that could be done once: the same file parsed per item, config
     re-read, a directory re-walked per query, a regex compiled per call, a git
     subprocess run per item where one batch command (`git ls-files`,
     `git cat-file --batch`, `git log` with a path list) would do?
   - Did a lookup change from constant to linear time, for example from a keyed `Map` to
     a filter over a list, because the shape of a result changed?

   **I/O and subprocesses**
   - A sequential `await` in a loop of independent I/O serializes it; an unbounded
     `Promise.all` over N items opens N file handles, subprocesses, or network requests
     at once (`EMFILE`, rate limits).
     Use bounded concurrency and say what the bound is.
   - Each subprocess spawn costs milliseconds and a fork; per-item spawns over thousands
     of items cost minutes.
     Batch the command or keep one long-lived process.
   - Is there synchronous I/O (`readFileSync`, `execSync`) on a path that serves
     requests or events? It blocks the event loop for every other client.
   - Does a read load a whole file or dataset to answer a question about part of it?
     Stream, index, or read only the head.
   - Do network calls have timeouts, retries with backoff and jitter rather than a tight
     loop, and pagination that stops once it has what it needs?

   **Memory and resource lifetimes**
   - Is the full dataset held in memory when a stream would do, and is buffered
     subprocess output bounded?
   - Do caches, queues, event buffers, and log arrays have a bound or an eviction rule?
     A per-request entry in a module-level `Map` with no eviction is a leak with a slow
     fuse.
   - Are listeners, timers, watchers, file handles, and child processes released on
     every path, including error and cancellation?
     A listener added per request and never removed is the usual `EventEmitter` leak.

   **Latency-sensitive paths**
   - Does the change add a top-level import of a heavy module to a command that does not
     use it? Every command then pays for it at startup; import lazily inside the command.
   - Does a command that used to be offline now make a network call, or block on one
     before producing output?
     Does a long operation report progress or timing?
   - Does an event- or watch-driven path recompute everything per event?
     Coalesce or debounce, and cache with an explicit invalidation rule.

   **Optimizations in the diff**
   - A new cache, memoization, parallelism, or precomputation is a correctness surface:
     what invalidates the cache, what is the memo key, which state do the parallel tasks
     share? An unmeasured optimization that adds this complexity is itself a finding.
   - Does the PR’s own benchmark measure the right thing: a representative N, cold and
     warm cache, the path users hit?
   - Was a test timeout raised without a recorded measurement?

5. **Measure rather than estimate.** Run the test suite as `review-code` does.
   Time each suspected path at the base and at the head on a representative input, at
   the largest realistic N, with `performance.now()` in a scratch script or `time` and
   `hyperfine` for whole commands, and record the numbers in the header’s `Tests run`
   line. A finding without a measurement states N and the complexity argument instead.
   A micro-optimization on a cold path is Low and is marked as a preference.

6. **Compile the review** in the artifact format `review-code` specifies, with
   `kind=performance` in the header and marker.
   Add a **Measurements** section: what was timed, on what input and N, at the base and
   the head, so the addressing agent can confirm a fix against the same numbers.
   Keep performance findings first; a finding outside this area is still reported,
   marked as outside the performance scope, and a finding already open on the PR is
   referenced by its ID rather than duplicated.
   Then determine the next action as `review-code` does: `review-github-pr` publishes
   the review, and `address-pr-review` addresses it.

<!-- This document follows common-doc-guidelines.md.
See github.com/jlevy/practical-prose and review guidelines before editing.
-->
