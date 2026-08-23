---
title: Rust Rules
description: General Rust coding rules for modern libraries, applications, services, and command-line tools
author: Joshua Levy (github.com/jlevy) with LLM assistance
globs: "*.rs"
alwaysApply: true
category: rust
---
# Rust Rules

Use these rules for any modern Rust codebase, whether it was written in Rust from the
start or ported from another language.
They cover language and API design.
Project tooling, CLI behavior, testing, releases, and review each have focused
guidelines.

**Related**:

- `rust-lint-format-rules` (the lint, format, and toolchain floor; always loaded with
  this document)
- `rust-project-setup` (Cargo layout, features, workspace shape)
- `rust-cli-rules` (command-line applications)
- `rust-testing-rules` (test placement, features, platforms)
- `filesystem-rules`, `rust-filesystem-rules` (filesystem mutation)
- `release-engineering-rules`, `rust-release-rules` (packaging and publishing)
- `code-review-rules`, `rust-code-review-rules` (review)
- `general-coding-rules`, `general-comment-rules`, `error-handling-rules`,
  `general-testing-rules` (the language-neutral rules this assumes)

## Toolchain, Edition, and MSRV

- **Use the newest Rust edition supported by the declared minimum supported Rust version
  (MSRV).** New projects should normally use Edition 2024.
- **Declare the MSRV.** Set `rust-version` in `Cargo.toml` and test that toolchain in
  CI. A `rust-toolchain.toml` may pin the normal development toolchain separately.
- **Treat MSRV changes as an explicit compatibility decision.** Document the project’s
  policy and release the change according to that policy; do not assume every consumer
  treats an MSRV bump the same way.
- **Use the edition migration tools.** Run `cargo fix --edition` and the full validation
  suite before changing an existing package’s edition.

Edition 2024 changes worth checking during review include the reserved `gen` keyword,
explicit unsafe operations inside `unsafe fn`, return-position `impl Trait` lifetime
capture, shorter tail-expression temporary lifetimes, and resolver version 3.

## Ownership and Borrowing

- **Let the signature state the ownership contract.** `&str` and `&Path` say the callee
  does not take ownership; `String` and `PathBuf` transfer ownership and let the callee
  retain or transform an owned value.
  Choosing by convenience—an owned parameter because one caller happened to have one—
  makes the contract unreadable and can force callers that only have a borrowed value to
  allocate.
- **Make every clone explainable.** A clone used only to silence a borrow-checker error
  is a design signal. Shorten borrow scopes, split state, or change ownership before
  copying a large value.
- **Use `Cow` only for a real borrow-or-own result.** It is useful when the common path
  returns the input unchanged and an uncommon path allocates.
- **Keep shared ownership narrow.** `Rc`, `Arc`, `Mutex`, and `RwLock` should reflect a
  concrete ownership or concurrency requirement, not uncertainty about lifetimes.
- **Do not expose lock guards through public APIs.** Complete the protected operation
  inside the abstraction and return plain data or a result.

A clone that exists only to satisfy aliasing is a cue to split the field borrows.

**Bad:**

```rust
let config = state.config.clone();
render(&config, &mut state.output)?;
```

**Good:**

```rust
let State { config, output } = state;
render(config, output)?;
```

```rust
use std::borrow::Cow;

fn normalize(input: &str) -> Cow<'_, str> {
    if input.contains("\r\n") {
        Cow::Owned(input.replace("\r\n", "\n"))
    } else {
        Cow::Borrowed(input)
    }
}
```

## Types and API Design

- **Replace related booleans and sentinels with one enum.** Several flags such as
  `is_pending`, `is_running`, and `is_complete` permit contradictory states that one
  enum makes unrepresentable.
- **Return a named struct when tuple fields have meaning.** A return type such as
  `(bool, usize, String)` hides which value is a status, count, or message and becomes
  fragile when fields change.
- **Do not derive `Default` when construction requires a decision.** Configuration and
  context types should require security, storage, network, or destructive-operation
  choices rather than silently selecting them.
- **Make matches exhaustive.** Avoid wildcard arms when adding a new enum variant should
  force callers to make a decision.
- **Avoid allocation-forcing APIs.** Accept borrowed inputs where practical and return
  iterators or slices when callers do not need a newly allocated collection.
- **Use `#[must_use]` when ignoring a result is likely to be a bug.** Apply it to
  important values, builders, guards, and operation results.
- **Introduce traits for actual polymorphism.** A trait with one implementation and no
  generic caller, public extension point, or test seam is usually unnecessary.

```rust
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
struct RetryCount(u8);

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
enum OutputMode {
    Text,
    Json,
}
```

## Error Handling

- **Use `thiserror` for typed library errors by default.** A small error enum lets
  callers match recoverable cases without parsing messages.
  Implement the traits manually only when avoiding the proc macro has a measured or
  policy-driven benefit.
- **Use `anyhow` for contextual reports at binary boundaries by default.** Application
  errors are normally displayed rather than matched.
  Use a different report type only when the project documents another error-stack or
  diagnostic contract.
- **Do not discard fallible results.** A `let _ = operation()` requires an explicit
  reason that failure is safe to ignore.
- **Avoid `unwrap()` in production paths.** Use `expect()` only for a proven invariant
  and state that invariant in the message.
- **Do not panic across a library’s normal input surface.** Panics are for violated
  programmer contracts or states that are genuinely unreachable.

Discarding a result hides whether required cleanup or persistence happened.

**Bad:**

```rust
let _ = std::fs::remove_file(path);
```

**Good:**

```rust
std::fs::remove_file(path)?;
```

```rust
#[derive(Debug, thiserror::Error)]
pub enum ConfigError {
    #[error("failed to read configuration at {path}")]
    Read {
        path: std::path::PathBuf,
        #[source]
        source: std::io::Error,
    },
    #[error("invalid configuration: {0}")]
    Parse(String),
}
```

For user-visible failures, exit codes, and success verification, also apply
`tbd guidelines error-handling-rules`.

## Strings, Text, and Regular Expressions

- **Remember that Rust string indices are byte offsets.** Use `chars`, `char_indices`,
  or `unicode-segmentation` when the requirement is based on Unicode scalar values or
  grapheme clusters.
- **Use `Path` and `OsStr` for filesystem values.** Do not require paths to be valid
  UTF-8 merely for convenience.
- **Make normalization a declared behavior.** Preserve bytes, whitespace, newlines, and
  normalization forms unless the API promises to transform them.
- **Compile repeated regular expressions once.** `std::sync::LazyLock` is sufficient for
  static regex values.
- **State matching boundaries explicitly.** Readers should not have to infer whether a
  regex is intended to match a substring, a line, or the entire input.
- **Use a more capable regex engine only when the required syntax needs it.** Extra
  engines increase dependency and performance costs.

```rust
use regex::Regex;
use std::sync::LazyLock;

static IDENTIFIER: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"^[A-Za-z_][A-Za-z0-9_]*$").expect("valid regex"));
```

## Modules and Documentation

- **Prefer `foo.rs` with `foo/` submodules over `foo/mod.rs`.** The Edition 2018+ layout
  keeps editor tabs and search results descriptive.
  Use `mod.rs` only when a project-wide convention or generated layout provides a
  concrete benefit.
- **Reserve re-exports for a deliberate public API.** Put explicit `pub use` items at a
  crate’s supported public boundary.
  Avoid glob re-exports, internal convenience re-exports, and application `prelude`
  modules that obscure ownership.
- **Update internal callers after moving an item.** Do not leave a compatibility
  re-export at the old path.
  A published library may retain an explicitly deprecated re-export only when its
  compatibility policy requires a migration window and names a removal release.
- **Keep binaries thin.** Put reusable domain behavior in library modules and keep
  process setup at the executable boundary.
- **Document what the signature cannot say.** `missing_docs = "deny"`
  (`rust-lint-format-rules`) puts a `///` on every public item, which reliably produces
  a wall of restatement unless each one carries the invariant, the panic condition, or
  the ordering guarantee.
  `general-comment-rules` owns comments generally; `rust-testing-rules` owns doctests.

## Unsafe Code and FFI

- **Deny unsafe code at the workspace root.** Enable it only in the smallest module or
  package with a reviewed requirement.
  `rust-lint-format-rules` explains why the level is `deny` rather than `forbid`:
  `forbid` cannot be overridden at all, so the first justified platform-specific block
  forces the workspace setting down instead of taking a scoped exception.
- **The unsafe block’s soundness must be a property of the module, not of its callers.**
  A `// SAFETY:` comment naming an invariant that a caller is trusted to uphold
  describes an unsound API; the safe wrapper has to make violating it impossible.
  This is the one rule that decides whether the rest is review or archaeology.
- **Benchmark before using unsafe for speed.** The safe implementation is the baseline,
  and “obviously faster” is not a measurement.

`rust-code-review-rules` carries the full unsafe and FFI checklist—`Send`/`Sync`
soundness, the unwinding matrix in each direction, ownership and nullability across the
boundary, and target-specific layout.
Read it when writing the code, not only when reviewing it.

## Concurrency and Async

- **Do not block an async executor.** Use async I/O or a bounded blocking pool for
  filesystem, CPU-heavy, and synchronous foreign calls.
- **Await or supervise spawned tasks.** Detached tasks need an explicit lifecycle,
  failure-reporting path, and shutdown policy.
- **Design for cancellation.** Code used in `select!`, timeouts, or aborted tasks must
  leave state consistent when a future is dropped at any await point.
- **Use bounded queues unless unbounded growth is proven safe.** Define backpressure
  behavior rather than allowing load to become memory usage.
- **Never hold a lock across slow I/O or an unrelated await.** Copy or move the needed
  state out of the critical section first.
- **Acquire multiple locks in one documented order.** Prefer a design with fewer locks
  when possible.
- **Support graceful shutdown.** Stop accepting work, signal workers, drain or cancel
  in-flight operations according to policy, and report incomplete work.

Move plain data out of a critical section before awaiting unrelated work.

**Bad:**

```rust
let state = shared.lock().await;
send(&state.payload).await?;
```

**Good:**

```rust
let payload = { shared.lock().await.payload.clone() };
send(&payload).await?;
```

## Performance

- **Require representative benchmark evidence for a retained optimization.** Record
  inputs, toolchain, target, and relevant environment so the claim can be reproduced.
- **Inspect allocations in hot paths.** Reuse buffers and avoid repeated `to_string`,
  `format!`, `collect`, and clone operations inside tight loops.
- **Keep correctness tests separate from benchmarks.** A benchmark should not be the
  only evidence that an optimization preserves behavior.
- **Record the tradeoff.** Non-obvious optimizations need a comment or benchmark link
  explaining the constraint they satisfy.

<!-- This document follows common-doc-guidelines.md.
See github.com/jlevy/practical-prose and review guidelines before editing.
-->
