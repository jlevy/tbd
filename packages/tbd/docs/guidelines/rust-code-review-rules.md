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
- [ ] **Blocker: unwinding across an FFI boundary is prevented or explicitly
  supported.** A Rust panic crossing into C is undefined behavior; catch it at the
  boundary or declare the function `extern "C-unwind"` and mean it.
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

Rust-specific patterns and the severity each usually warrants.
This says where to investigate; it does not replace reading the changed control flow.
`code-review-rules` carries the language-neutral scan.

| Pattern | Default severity |
| --- | --- |
| unsafe block without a safety argument | Blocker |
| safe API through which unsafe code can be made to misbehave | Blocker |
| `let _ = fallible()` discarding a required result | Blocker |
| blocking call inside an async executor | Blocker |
| recursive delete whose resolved scope is not verified | Blocker |
| lock guard held across an `await` or slow I/O | High |
| lock guard exposed through a public API | High |
| `unwrap()` in a production path, or `expect()` without a stated invariant | High |
| `filter_map(Result::ok)` over a traversal or fallible iterator | High |
| success reported before every required operation is verified | High |
| repeated `clone()` introduced to satisfy the borrow checker | High |
| spawned task neither awaited nor supervised | High |
| `pub` item with no use outside its own crate | High |
| new always-on dependency in a crate that had a deliberate minimal graph | High |
| wildcard `_ =>` arm where a new enum variant should force a decision | Medium |
| `#[allow]` used where `#[expect]` would expire on its own | Medium |
| `#[allow]` without a non-obvious reason or tracker ID | Medium |
| `#[ignore]`d test without a tracking issue or bead | Medium |
| trait with one implementation and no generic caller or test seam | Medium |
| `mod.rs` added where the `foo.rs` + `foo/` layout is the convention | Low |

Two questions no grep will answer, worth asking explicitly on any diff that touches the
build: *did this change make a check unable to fail?* and *does this test still assert
what its name claims?* A weakened gate and an adjusted test both look like small green
diffs.

## Related Guidelines

- `code-review-rules` for severity, baseline, risk ordering, and findings
- `rust-rules` for language and API design
- `rust-lint-format-rules` for what the gate should have caught first
- `rust-project-setup`, `rust-cli-rules`, `rust-filesystem-rules`, `rust-testing-rules`,
  `rust-release-rules` for the topic rules
- `tbd shortcut review-code-rust`
- `tbd guidelines backward-compatibility-rules error-handling-rules supply-chain-hardening`

<!-- This document follows common-doc-guidelines.md.
See github.com/jlevy/practical-prose and review guidelines before editing.
-->
