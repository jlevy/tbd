---
title: Rust Code Review Rules
description: The Rust-specific half of review—which guideline owns each changed surface, the unsafe and FFI checklist with default severities, and a Rust quick-scan table. The severity vocabulary, review baseline, and risk ordering live in code-review-rules.
author: Joshua Levy (github.com/jlevy) with LLM assistance
category: rust
---
# Rust Code Review Rules

`code-review-rules` owns the review process: the Blocker/High/Medium/Low severity
vocabulary, establishing a baseline before hunting findings, reviewing the highest-risk
boundaries first, assessing design rather than only the diff, and writing findings that
can be acted on. Read it first; it applies in every language.

This document owns what is specific to Rust: routing by changed surface, and the unsafe
and FFI review that has no equivalent elsewhere.

Run it after `cargo fmt --check`, clippy, tests, and docs pass.
Automated ownership should not consume review time unless the automation is missing,
disabled, or demonstrably failed—`rust-lint-format-rules` covers how to tell.

**Related**:

- `code-review-rules` (severity, baseline, risk ordering, actionable findings)
- `rust-rules` (the rules most Rust findings cite)
- `rust-lint-format-rules` (what the gate should already have caught)
- `rust-project-setup`, `rust-cli-rules`, `rust-filesystem-rules`, `rust-testing-rules`,
  `rust-release-rules` (the topic rules a review loads by changed surface)
- `backward-compatibility-rules`, `error-handling-rules`, `supply-chain-hardening`
- `tbd shortcut review-code-rust`

## Load the Rules That Own the Changed Surface

Load `rust-rules` for every Rust review, then add only what matches the diff:

| Changed surface | Additional guideline |
| --- | --- |
| Cargo layout, features, toolchains, or workspace shape | `rust-project-setup` |
| Lint config, `clippy.toml`, rustfmt, or CI gates | `rust-lint-format-rules`, `ci-and-gates-rules` |
| Arguments, streams, terminal behavior, subprocesses, or exits | `rust-cli-rules` |
| Paths, traversal, mutation, metadata, links, or recovery | `filesystem-rules`, `rust-filesystem-rules` |
| Test placement, fixtures, snapshots, matrices, or coverage | `rust-testing-rules` |
| Artifacts, publishing authority, channels, or incidents | `release-engineering-rules`, `rust-release-rules` |
| Dependencies added, upgraded, or newly executing at build time | `supply-chain-hardening` |

## Review Unsafe Code and FFI

This is the one review surface where a mistake is unbounded: safe Rust findings are
bugs, unsafe findings can be arbitrary memory corruption.
Review it first, and review it even when the diff is small.

- [ ] **Blocker: every unsafe block has a specific `// SAFETY:` argument**, and the
  invariant it states is established by code the reviewer can trace.
  “This is fine because the caller guarantees it” without naming the caller is not an
  argument.
- [ ] **Blocker: unsafe scope is minimal**, and a safe wrapper prevents callers from
  violating the invariant.
  An unsafe block whose soundness depends on a caller reading the docs is an unsound
  API.
- [ ] **Blocker: safe inputs cannot trigger undefined behavior.** Length, alignment,
  aliasing, initialization, provenance, and lifetime requirements are enforced, not
  assumed.
- [ ] **Blocker: manual `Send` or `Sync` implementations are sound**, considering every
  contained field and every mutation path—including interior mutability reached through
  a raw pointer.
- [ ] **Blocker: unwinding across an FFI boundary is handled in the direction it
  actually travels.** The two directions have different consequences, and the common
  summary gets both wrong.
  A Rust panic that would escape an `extern "C"` function aborts the process: defined
  behavior, but a process death with no foreign cleanup and no way to report the
  failure, so an exported function that must return an error wraps its body in
  `catch_unwind` instead.
  A *foreign* exception entering Rust through a non-unwind ABI is the undefined-behavior
  case. `extern "C-unwind"` declares that unwinding is an intended and compatible part of
  the ABI on both sides; it is not a general fix for “this might panic”.
- [ ] **High: FFI ownership is unambiguous.** Allocation and free pairs, pointer
  lifetime, nullability, string encoding and NUL handling, callback lifetimes, and
  thread affinity all match the foreign contract.
- [ ] **High: a safe alternative was considered**, and performance-motivated unsafe code
  carries representative benchmark evidence rather than an assumption.
- [ ] **High: platform layout assumptions are tested.** Sizes, alignment, calling
  convention, and generated bindings match every supported target—and the module is
  linted for those targets, which a single-platform CI run does not do
  (`ci-and-gates-rules`).

For safe Rust, use the topic guidelines above rather than recreating their checklists
here.

## Quick Scan

Rust-specific patterns only—`code-review-rules` carries the language-neutral scan and
the rule that a pattern is not a severity.
Each row here is a question to resolve, not a finding to report at a preset level.

| Pattern | Question that decides it | If the answer is bad |
| --- | --- | --- |
| unsafe block without a safety argument | Which invariant makes this sound, and what code establishes it? | Blocker: unsound in the general case |
| safe API through which unsafe code can be made to misbehave | Is there a safe input sequence that violates the invariant? | Blocker: safe code causes UB |
| blocking call inside an async executor | Which runtime, how long, and how many worker threads? | Blocker on a shared multi-task runtime; Low in a one-shot CLI where the executor has nothing else to run |
| recursive delete whose resolved scope is not verified | What does the path resolve to under a symlink or an empty argument? | Blocker: deletion outside the intended tree |
| lock guard held across an `await` or slow I/O | Does another task need this lock to make progress? | Blocker if it can deadlock; High if it only serializes |
| lock guard exposed through a public API | Can a caller hold it across arbitrary code? | High: the deadlock is now in someone else’s crate |
| `unwrap()` in a production path, or `expect()` without a stated invariant | Is the invariant established locally, or assumed from a caller? | High: a panic on real input |
| `filter_map(Result::ok)` over a traversal or fallible iterator | Does “I could not read this” become “there was nothing here”? | High: partial results reported as complete |
| repeated `clone()` introduced to satisfy the borrow checker | Is this a hot path, or a startup path run once? | Medium in a hot path; Low elsewhere, and a design smell either way |
| spawned task neither awaited nor supervised | Who observes its panic, its error, and its completion? | High: silent failure with no exit-status effect |
| wildcard `_ =>` arm where a new enum variant should force a decision | Is the enum owned here, and is it expected to grow? | Medium: a new variant compiles into the wrong behavior |
| `#[allow]` used where `#[expect]` would expire on its own | Will anyone notice when the underlying cause is fixed? | Low: a suppression that outlives its cause |
| `mod.rs` added where the `foo.rs` + `foo/` layout is the convention | Is the convention stated anywhere the tooling enforces? | Low: layout drift |

<!-- This document follows common-doc-guidelines.md.
See github.com/jlevy/practical-prose and review guidelines before editing.
-->
