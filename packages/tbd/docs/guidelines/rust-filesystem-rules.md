---
title: Rust Filesystem Rules
description: The Rust-specific half of filesystem work—path and string types, intent-specific write boundaries, the tempfile atomic-replacement sequence, traversal crate choice and error propagation, and platform metadata. The behavior contract itself lives in filesystem-rules.
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
- `rust-lint-format-rules` (lint policy and the limits of method bans)
- `rust-rules` (ownership, errors, and API design)
- `rust-cli-rules` (destructive-command design)
- `rust-testing-rules` (isolated roots for mutating fixtures)
- `error-handling-rules`, `general-testing-rules` (partial failure; fixture isolation)

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
  behavior (`filesystem-rules` states the full rationale).

```rust
use std::ffi::OsString;
use std::path::{Path, PathBuf};

fn append_suffix(path: &Path, suffix: &str) -> PathBuf {
    let mut value = OsString::from(path.as_os_str());
    value.push(suffix);
    PathBuf::from(value)
}
```

Rust string indices are byte offsets, so slicing a `&str` at an arbitrary byte position
panics when that position is not a character boundary; converting a path to `&str` also
rejects non-UTF-8 names.
Stay in `Path`/`OsStr` unless text semantics are part of the contract.

## Use Intent-Specific APIs and Atomically Publish Completed Output Files

`std::fs::write` and `std::fs::File::create` truncate an existing destination before
writing. That is wrong whenever one operation creates and completes an output file,
including a new destination.
A reader can observe the path after creation but before the write finishes.
Do not ban these standard-library methods globally: Clippy cannot infer whether the
caller’s path is a published output, a private staging file, or a test fixture, and
`disallowed-methods` has no intent scope.

Instead, route output publication through a module with named operations such as
`write_atomic`, `write_durable`, `create_atomic`, and `append_record`. If a legacy
project helper is unambiguously unsafe, disallow that helper after migrating callers;
preserve the general primitives for contexts where their semantics are the declared
contract.

The named boundary makes `filesystem-rules`’ write contract reviewable and gives a
project a specific helper to prohibit during migration.
That matters because the failure is silent: a truncated file looks like corrupt data
later, not like a write error now.

`filesystem-rules` owns *which* contract applies; Rust’s standard library expresses each
of them through `OpenOptions`, so the alternatives the restriction points at are real
and cheap:

| Contract | Rust |
| --- | --- |
| Publish, replacement allowed | `NamedTempFile::new_in(dir)` → write → `persist` |
| Publish, replacement forbidden | `NamedTempFile::new_in(dir)` → write → `persist_noclobber` |
| Append | `OpenOptions::new().append(true)` |
| Live stream, private staging, test fixture | `File::create` |

`create_new` is useful for a lock, sentinel, or private work file that may become
visible before later writes finish.
It is not atomic publication of a completed output: use `persist_noclobber` when a
completed file must appear only if the destination is absent.
In either case, `Path::exists()` followed by create or rename is a race.
`append(true)` positions each write at the current end of the file, avoiding the race in
`seek`-to-end-then-write.
It does **not** guarantee that records from concurrent writers cannot interleave: a
write may accept only part of its buffer, and the amount accepted depends on the
operating system and filesystem
([`OpenOptions::append`](https://doc.rust-lang.org/std/fs/struct.OpenOptions.html#method.append)).
Assemble each record before writing; if record atomicity is required, serialize writers
or use a storage format and protocol that supplies it.

For any output file completed by one operation, the smallest correct Rust implementation
writes before `persist` and stages beside the destination:

```rust
use std::io::Write;
use std::path::Path;
use tempfile::NamedTempFile;

fn write_atomic(path: &Path, contents: &[u8]) -> anyhow::Result<()> {
    // In the destination directory, not the system temp dir: a temp file elsewhere is
    // on another filesystem and makes `persist` fail rather than replace atomically.
    let directory = path
        .parent()
        .filter(|parent| !parent.as_os_str().is_empty())
        .unwrap_or_else(|| Path::new("."));
    let mut staged = NamedTempFile::new_in(directory)?;
    staged.write_all(contents)?;
    staged.flush()?;
    staged.persist(path).map_err(|error| error.error)?;
    Ok(())
}
```

This example promises atomic visibility, not crash durability or metadata preservation.
If the operation promises those properties, sync the staged file before `persist`, sync
the parent directory afterward where supported, and copy each promised metadata field
before the replacement as specified in `filesystem-rules`.

Rust-specific traps in this sequence:

- **The buffer holds the bytes, not the file.** `flush()` on the underlying file does
  nothing for data still sitting in a `BufWriter`, and `BufWriter`’s own `Drop` flushes
  and then throws the error away.
  `into_inner` is the call that both drains the buffer and reports failure.
  Then `sync_all` is a further step again: flushing hands bytes to the kernel, and only
  a sync gets them onto the device.
- **`persist` replaces; `persist_noclobber` refuses.** `NamedTempFile::persist`
  atomically replaces an existing destination on every platform—that is what makes it
  the atomic-replace primitive—while `persist_noclobber` is the variant that fails when
  the destination exists.
  Pick by the collision policy the operation promises, per `filesystem-rules`; do not
  assume either one from the other’s name.
  `tempfile` does not guarantee that the entire `persist_noclobber` operation is atomic
  on every platform: its fallback may create the final hard link atomically and then
  leave the staging link behind if cleanup fails.
  The destination is never overwritten, but a contract that also forbids residual
  staging links needs a platform-specific commit or explicit recovery.
  On Windows, `persist` can still fail with a permission error when the destination is
  open, because there is no POSIX-style replace-while-open.
  Treat that as a real failure path in a program that replaces files other processes may
  hold.

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

**Never use `filter_map(Result::ok)` on a traversal.** `filesystem-rules` carries the
worked example and the reasoning: it converts “I could not read this directory” into
“this directory has no entries”, and the caller reports success over a partial result.

Rust adds one refinement.
When some traversal errors genuinely are ignorable, match on the specific kind rather
than dropping all of them:

```rust
for entry in WalkDir::new(root).follow_links(false) {
    match entry {
        Ok(entry) => files.push(entry.into_path()),
        // A directory that vanished mid-walk is expected here; anything else is not.
        Err(error) if error.io_error().map(io::Error::kind) == Some(ErrorKind::NotFound) => {}
        Err(error) => return Err(error.into()),
    }
}
```

A blanket `.ok()` is not that, and neither is a `_ => continue` arm.

## Lint and Test Platform-Specific Metadata Code on Each Supported OS

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

<!-- This document follows common-doc-guidelines.md.
See github.com/jlevy/practical-prose and review guidelines before editing.
-->
