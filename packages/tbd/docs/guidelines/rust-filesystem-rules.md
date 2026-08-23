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

Rust string indices are byte offsets, so slicing a `&str` at an arbitrary byte position
panics when that position is not a character boundary; converting a path to `&str` also
rejects non-UTF-8 names.
Stay in `Path`/`OsStr` unless text semantics are part of the contract.

## Make Write Intent Explicit

`std::fs::write` and `std::fs::File::create` truncate an existing destination before
writing. That is wrong for replacement of authoritative state, but it can be correct for
scratch output or a newly created non-authoritative file.
Do not ban these standard-library methods globally: Clippy cannot infer the caller’s
write contract, and `disallowed-methods` has no intent scope.

Instead, route authoritative persistence through a module with named operations such as
`replace_atomic`, `replace_durable`, `create_new`, and `append_record`. If a legacy
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
| Replace | `NamedTempFile::new_in(dir)` → write → `persist` |
| Create exclusively | `OpenOptions::new().write(true).create_new(true)` |
| Append | `OpenOptions::new().append(true)` |
| Stream, scratch | `File::create` |

`create_new` is the atomic exclusive-create; `Path::exists()` followed by a create is
the race it exists to replace.
`append(true)` positions each write at the current end of the file, avoiding the race in
`seek`-to-end-then-write.
It does **not** guarantee that records from concurrent writers cannot interleave: a
write may accept only part of its buffer, and the amount accepted depends on the
operating system and filesystem
([`OpenOptions::append`](https://doc.rust-lang.org/std/fs/struct.OpenOptions.html#method.append)).
Assemble each record before writing; if record atomicity is required, serialize writers
or use a storage format and protocol that supplies it.

The same-filesystem replacement sequence, with the Rust specifics that matter:

```rust
use std::io::{BufWriter, IntoInnerError, Write};
use std::path::Path;
use tempfile::NamedTempFile;

fn stage_replacement(
    path: &Path,
    records: &[Record],
    durable: bool,
) -> anyhow::Result<NamedTempFile> {
    // In the destination directory, not the system temp dir: a temp file elsewhere is
    // probably on another filesystem, which turns the final persist into a
    // cross-device copy and loses atomicity.
    let directory = path.parent().unwrap_or_else(|| Path::new("."));
    let mut writer = BufWriter::new(NamedTempFile::new_in(directory)?);
    for record in records {
        writeln!(writer, "{record}")?;
    }
    // Recover the file *through* the writer, not around it. `into_inner` flushes and
    // surfaces the error; `BufWriter`'s Drop also flushes but discards the result, so a
    // full disk becomes a short file and a successful exit status.
    let staged = writer.into_inner().map_err(IntoInnerError::into_error)?;
    if durable {
        // Only when the operation promises crash durability. `filesystem-rules` keeps
        // these two promises apart; this is the line where they diverge.
        staged.as_file().sync_all()?;
    }
    Ok(staged)
}
```

Two Rust-specific traps in that sequence:

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

<!-- This document follows common-doc-guidelines.md.
See github.com/jlevy/practical-prose and review guidelines before editing.
-->
