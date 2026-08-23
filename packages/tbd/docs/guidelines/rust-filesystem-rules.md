---
title: Rust Filesystem Rules
description: The Rust-specific half of filesystem work—path and string types, the tempfile atomic-replacement sequence, traversal crate choice and error propagation, platform metadata, and making the atomic-write rule executable through clippy. The behavior contract itself lives in filesystem-rules.
author: Joshua Levy (github.com/jlevy) with LLM assistance
category: rust
---
# Rust Filesystem Rules

`filesystem-rules` owns the behavior: planning versus mutation, atomic visibility versus
crash durability, backup and collision policy, cross-device moves, deterministic
traversal, symlink and root boundaries, honest partial failure, and what the tests must
exercise. Read it first; it applies in every language.

This document owns what is specific to Rust: the types, the crates, and the enforcement.

**Related**:

- `filesystem-rules` (the behavior contract this implements)
- `rust-lint-format-rules` (the `clippy.toml` that enforces atomic writes)
- `rust-rules` (ownership, errors, and API design)
- `rust-testing-rules` (isolated roots for mutating fixtures)

## Use Filesystem-Native Types

- Accept `&Path` for borrowed paths and `PathBuf` for owned paths.
- Preserve `OsStr` and `OsString` when names do not need to be Unicode.
  Requiring UTF-8 paths for convenience makes the program fail on files it should
  handle.
- Use `join`, `strip_prefix`, `parent`, `file_name`, and `with_extension`. Do not parse
  path separators with string operations.
- Remember that `with_extension` replaces the *final* extension: it turns
  `archive.tar.gz` into `archive.tar.old`, not `archive.tar.gz.old`. Append through
  `OsString` when the whole name must be preserved.
- Define whether relative paths resolve against the process directory, a workspace root,
  or an explicit base.
  Do not leave it to whatever the caller happened to have.
- Canonicalize only when resolving links *and* requiring existence is the intended
  behavior. Canonicalization changes semantics and can itself expose paths outside a
  root.

```rust
use std::ffi::OsString;
use std::path::{Path, PathBuf};

fn append_suffix(path: &Path, suffix: &str) -> PathBuf {
    let mut value = OsString::from(path.as_os_str());
    value.push(suffix);
    PathBuf::from(value)
}
```

Rust string indices are byte offsets, so any path or filename manipulation done through
`&str` will panic on a multi-byte boundary.
Stay in `Path`/`OsStr` and the question does not arise.

## Make the Atomic-Write Rule Executable

`std::fs::write` and `std::fs::File::create` truncate the destination before writing.
Ban them in `clippy.toml` and direct callers to an atomic replacement:

```toml
[[disallowed-methods]]
path = "std::fs::write"
reason = "write via an atomic replace (tempfile::NamedTempFile::persist)"

[[disallowed-methods]]
path = "std::fs::File::create"
reason = "write via an atomic replace (tempfile::NamedTempFile::persist)"
```

`disallowed-methods` has no test-scoping option, so test code that writes fixture files
will trip it. Add a crate-level `#![allow(clippy::disallowed_methods)]` in test targets
rather than dropping the rule; see `rust-lint-format-rules` for the measured cost.

The same-filesystem replacement sequence, with the Rust specifics that matter:

```rust
use std::io::Write;
use std::path::Path;
use tempfile::NamedTempFile;

fn stage_replacement(path: &Path, content: &[u8]) -> anyhow::Result<NamedTempFile> {
    // In the destination directory, not the system temp dir: a temp file elsewhere is
    // probably on another filesystem, which turns the final persist into a
    // cross-device copy and loses atomicity.
    let directory = path.parent().unwrap_or_else(|| Path::new("."));
    let mut staged = NamedTempFile::new_in(directory)?;
    staged.write_all(content)?;
    staged.flush()?;      // flushes the BufWriter, not the file
    staged.as_file().sync_all()?;  // this is what makes it survive power loss
    Ok(staged)
}
```

Two Rust-specific traps in that sequence:

- **`flush()` is not `sync_all()`.** Flushing pushes buffered bytes into the kernel;
  only `sync_all` gets them onto the device.
  `filesystem-rules` explains why atomic visibility and crash durability are separate
  promises—this is where they diverge in code.
- **`NamedTempFile::persist` fails rather than clobbering on Windows**, whereas
  `persist_noclobber` and plain `rename` differ again.
  Read the exact method’s overwrite semantics; they are not uniform across platforms or
  across the crate’s API.

A temp file also starts with the temp file’s permissions, not the destination’s. Copy
the mode across explicitly when the operation promises to preserve it.

## Choose the Traversal Crate Deliberately

Use `ignore` when traversal should honor gitignore-style rules, and `walkdir` otherwise.
Write a custom recursive traversal only when neither can express a documented boundary
or performance requirement.

- Use `filter_entry` to prune excluded directories *before* descent.
  Filtering the output instead still walks the subtree.
- Set `follow_links` explicitly rather than inheriting the crate default.
- Sort results by a documented key whenever the order is observable.

**Never use `filter_map(Result::ok)` on a traversal.** It silently converts “I could not
read this directory” into “this directory has no entries”, and the caller reports
success over a partial result:

```rust
// Bad: a permission error silently shrinks the result set.
let files: Vec<_> = WalkDir::new(root)
    .into_iter()
    .filter_map(Result::ok)
    .filter(|entry| entry.file_type().is_file())
    .collect();

// Good: the error reaches the caller, and the order is defined.
fn regular_files(root: &Path) -> anyhow::Result<Vec<PathBuf>> {
    let mut files = Vec::new();
    for entry in WalkDir::new(root).follow_links(false) {
        let entry = entry?;
        if entry.file_type().is_file() {
            files.push(entry.into_path());
        }
    }
    files.sort();
    Ok(files)
}
```

If some errors genuinely are ignorable, match on `entry.io_error().map(|e| e.kind())`
and say which. A blanket `.ok()` is not that.

## Platform Metadata Is Behind a `cfg`

Permissions, ownership, and extended attributes reach Rust through platform extension
traits—`std::os::unix::fs::PermissionsExt`, `MetadataExt`, and their Windows
counterparts. Two consequences:

- Code using them is `cfg`-gated, so it is invisible to a single-platform clippy run and
  to a single-platform test job.
  `ci-and-gates-rules` covers the cross-target lint pass that catches this; the test
  matrix has to cover the behavior.
- `PermissionsExt::mode()` has no meaningful Windows equivalent.
  A “preserve permissions” contract means different things per platform and needs to say
  which.

Detect cross-device moves by error code (`ErrorKind::CrossesDevices`, or `EXDEV` through
`raw_os_error()`), never by comparing path prefixes.
Mount points do not appear in paths.

## Test in Isolated Roots

Give every mutating test its own `tempfile::TempDir`, build all fixture paths under that
root, and let the `TempDir`’s lifetime own cleanup—dropping it early deletes the tree
while the test is still using it, which presents as a confusing `NotFound`.

`rust-testing-rules` owns fixture construction; `filesystem-rules` owns the list of
behaviors the fixture must exercise, including the failure-injection cases that are the
only real proof of atomicity.

## Related Guidelines

- `filesystem-rules` for the language-neutral behavior contract
- `rust-rules` for ownership, errors, and API design
- `rust-lint-format-rules` for the `clippy.toml` that enforces atomic writes
- `rust-cli-rules` for destructive-command design
- `rust-testing-rules` for isolated roots and fixtures
- `tbd guidelines error-handling-rules general-testing-rules`

<!-- This document follows common-doc-guidelines.md.
See github.com/jlevy/practical-prose and review guidelines before editing.
-->
