---
title: Filesystem Rules
description: Language-neutral rules for code that reads directory trees or mutates files—atomic publication of completed output files, atomic visibility versus crash durability, explicit metadata and collision policy, cross-device moves, deterministic traversal, symlink and root boundaries, honest partial failure, and failure injection at commit boundaries. Load whenever a change touches file mutation, traversal, or path handling, alongside the language-specific filesystem document if one exists.
author: Joshua Levy (github.com/jlevy) with LLM assistance
category: general
---
# Filesystem Rules

Filesystem code crosses process, platform, and failure boundaries, and its API has to
state more than the happy-path bytes.
These rules are language-neutral.
The language-specific companion (`rust-filesystem-rules`, and the file-operations
section of `typescript-rules`) owns path types and platform metadata; this document owns
the behavior.

The recurring defect is not a missing `try`. It is an operation whose contract was never
decided—whether it is atomic, what it preserves, what it does on collision, what it
reports when half of it worked—so every caller assumes a different one.

**Related**:

- `rust-filesystem-rules` (path and string types, platform metadata)
- `python-modern-guidelines` (Strif atomic-output helpers)
- `typescript-rules` (the `atomically` publication helper)
- `error-handling-rules` (partial failure and error context)
- `general-testing-rules` (fixture isolation for the tests below)
- `ci-and-gates-rules` (making the atomic-write rule enforceable rather than advisory)

## Always Atomically Publish Files Completed in One Operation

Every language has a one-line “write this file” call that truncates the destination and
then writes. If the process dies between those steps—or two writers interleave—the file
is left empty or half-written, and the failure surfaces later as corrupt state rather
than as a write error.

Whenever one operation creates and completes an output file, write to a private
temporary file in the destination directory and atomically publish it at the final path.
This rule applies whether the destination is new or replaced, and whether the output is
durable state, a report, an export, a cache entry, or a temporary artifact.
Readers should see no file, the previous file, or the complete new file—never a file
still being written.

“Created and completed in the same code block” describes this publication contract, not
a requirement to hold the contents in memory.
A producer may stream gigabytes into the private temporary file, as long as it closes
successfully before publication.

A write has one of these contracts, and the code should say which:

| Contract | What it promises | Primitive |
| --- | --- | --- |
| **Publish, replacement allowed** | A reader sees no file, the old contents, or the complete new contents | temp file in the destination directory, then atomic replacing rename |
| **Publish, replacement forbidden** | Preserves an existing destination; otherwise makes the complete new file visible in one step | temp file in the destination directory, then an atomic no-replace commit—*not* “check then rename”, which is a race |
| **Append** | Adds to the end without truncating; concurrent writers do not race on a shared file position, but records may still interleave | open in append mode, which positions per write rather than per open; serialize writers when record atomicity is required |
| **Live stream** | Makes output available incrementally to a consumer that reads while the producer is still writing | ordinary buffered write to the sink |
| **Private staging or work file** | Has no published destination and cannot be observed as a completed output | ordinary write in a private temp location |

Atomic publication is for the first two rows.
Business importance is irrelevant: a generated report and a cache file need the same
publication pattern as configuration if one operation completes them before a reader
should see them. Routing append and live streams through replacement *weakens* them—an
append forced through replace-the-whole-file has to read and rewrite the file, which
loses the concurrency property that made append correct, and turns an O(1) write into an
O(size) one. For create-only output, atomicity and collision policy are independent:
stage the complete file, then use a commit primitive that atomically refuses an existing
target.

Enforce the rule in code that publishes files.
Restrict raw truncating calls there and provide named alternatives for each contract, so
choosing something other than atomic publication is a visible decision with a name on it
rather than a lint suppression.
Exclude the implementation of the atomic helper and code that creates private fixtures
or staging files; those writes are not publication:

```javascript
// eslint.config.js — apply this rule to modules that publish output files.
'@typescript-eslint/no-restricted-imports': ['error', {
  paths: [
    { name: 'node:fs', importNames: ['writeFile', 'writeFileSync'],
      message: 'Use publishFileAtomic, createFileAtomic, appendToFile, or openOutputStream.' },
    { name: 'node:fs/promises', importNames: ['writeFile'],
      message: 'Use publishFileAtomic, createFileAtomic, appendToFile, or openOutputStream.' },
    // ...and the un-prefixed 'fs' and 'fs/promises' spellings.
  ],
}],
```

Rust’s `clippy.toml` method restrictions are global and cannot tell a final output path
from a private staging path, so do not ban `std::fs::write` or `std::fs::File::create`
globally merely to enforce this boundary.
Prefer an output module with named operations; disallow a project-specific helper only
when its contract is unambiguously unsafe.
Python can use a scoped lint rule or wrapper module.
The mechanism differs, but the rule must remain executable at the boundary where it
applies.

List every spelling of the import.
A restriction on `node:fs` that omits plain `fs` enforces nothing.

The restriction message should name the alternatives—`publishFileAtomic`,
`createFileAtomic`, `appendToFile`, `openOutputStream`—rather than only one atomic
helper. A ban with a single suggested replacement teaches contributors that the
suppression comment is the way to append to a log, and after that the boundary stops
meaning anything. Scope the restriction to modules that publish output, with narrow
exclusions for helper internals, test fixtures, and private staging files.

## Separate Planning From Mutation

For multi-target or destructive operations, compute the whole plan first: resolved
sources, destinations, collisions, exclusions, and the action for each target.

- Validate the entire plan before writing anything where the contract promises
  all-or-nothing behavior.
- Make dry-run render the *same* plan the executor consumes—not a second implementation
  that describes what the executor is believed to do.
  A dry run that diverges is worse than none, because it is trusted.
- Do not rediscover paths during execution unless reacting to concurrent change is part
  of the design.
- Revalidate security-sensitive assumptions immediately before mutating, not only at
  plan time.
- Return structured per-target outcomes for partial-success operations.

This split is what makes confirmation prompts, deterministic output, and failure
injection possible at all.

## Distinguish Atomic Visibility From Crash Durability

These are two different promises and code routinely claims one while implementing the
other:

- **Atomic visibility**: no observer ever sees a partially written destination.
  An atomic rename gives you this.
- **Crash durability**: the bytes and the directory entry survive power loss.
  Only an explicit sync gives you this, and a rename does not imply it.

State which one the operation promises.
The full same-filesystem replacement sequence:

1. create a private temp file *in the destination directory* (a temp file elsewhere may
   be on another filesystem, which makes step 5 a cross-device move);
2. write all bytes and flush the writer;
3. copy required permissions to the temp file;
4. sync the temp file when crash durability is required;
5. atomically replace the destination;
6. sync the parent directory where supported and required.

Overwrite semantics of the final replacement differ by platform and by API. Read the
exact call rather than assuming every rename replaces atomically—on Windows, several do
not.

## Make Metadata Policy Explicit

Preserving content and preserving a file are different contracts.
Decide, per operation, whether replacement preserves permissions and executable bits,
ownership, timestamps, extended attributes and ACLs, hard-link relationships, and sparse
or platform-specific attributes.

Copy only the metadata the feature promises, and test it on the platforms that support
it. An atomic replace through a temp file starts with the temp file’s permissions, not
the destination’s, so “preserve the mode” is a step you add, never a default you
inherit.

## Choose Backup and Collision Policy Before Writing

- Define whether an existing backup is replaced, versioned, reused, or an error.
- Never derive backup names through lossy path conversion.
- Make restore behavior explicit when both backup and destination exist.
- For collisions, choose fail, deterministic suffix, or explicit overwrite—and say
  which.
- Bound suffix searches or make them cancellable; an unbounded search hidden inside a
  critical operation is a hang.
- Create destination parents only when the command contract says it may.
- Record enough information to undo a batch when undo is a supported feature.

Never make overwrite the fallback for an unhandled collision.
Silent data loss is the one failure users cannot recover from or diagnose.

## Treat Cross-Device Moves as Copy Operations

An ordinary rename fails when source and destination are on different filesystems—a
container mount, a `/tmp` on tmpfs, a network volume.
A copy-then-delete fallback is not atomic and introduces failure states the rename path
does not have.

If cross-device moves are supported:

1. copy to a temp file in the destination directory;
2. validate bytes and required metadata;
3. commit the destination atomically;
4. remove the source only once the destination is durable enough for the contract;
5. report and preserve recoverable state if source removal fails.

If they are not supported, fail clearly rather than partially copying.
Detect this case by error code, not by comparing path prefixes.

## Traverse Deterministically and Propagate Errors

- Prune excluded subtrees *before* descending into them, not by filtering results
  afterward. On a large tree the difference is visible; on a tree containing a mount you
  lack permission to read, it is the difference between working and not.
- Sort by a documented key whenever output or mutation order is observable.
  “Whatever order the filesystem returned” is reproducible on one machine and nowhere
  else.
- Decide explicitly whether symlinks are followed.
  Do not inherit a library default.
- Detect link cycles when following directory symlinks.
- Keep traversal and mutation separate when deleting or renaming could change what
  remains to be visited.

**Never discard traversal errors when unreadable paths matter.** The idiom that drops
the error—`filter_map(Result::ok)` in Rust, a bare `catch { }` around a directory read
in TypeScript or Python—turns “I could not read half this tree” into “this tree has
fewer files than you think”, and the caller reports success:

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

If some errors genuinely are ignorable, match on the specific kind and say so.
A blanket drop is not that.

## Define Symlink and Root Boundaries

Before operating recursively, decide whether each operation acts on a link, on its
target, or on neither.

- Do not follow links outside an authorized root unless that is explicitly allowed.
- Check the resolved target after link resolution, not only the lexical input path.
  A prefix check on the pre-resolution path is not a containment check.
- Expect time-of-check/time-of-use races wherever untrusted users can mutate the tree,
  and use directory-relative or capability-oriented APIs when the boundary must actually
  hold against them.
- Canonicalize only when resolving links *and* requiring existence is the intended
  behavior; canonicalization changes semantics and can itself expose paths outside a
  root.
- Never recursively delete a path whose exact resolved scope has not been verified.

## Report Partial Failure Honestly

- Do not print success because at least one target changed.
- Preserve the first error and relevant later errors without losing context.
- State whether execution stops at the first failure or continues collecting failures.
- Make retry behavior explicit, and idempotent where possible.
- Leave temporary and backup files either cleaned up deterministically or in a
  documented recoverable state.

An exit code of zero after a batch in which three of ten targets failed is a bug in the
same class as data loss: the caller’s automation proceeds on a false premise.

## Inject Failures Before and After the Filesystem Commit Point

Build every mutating fixture in an isolated root (`general-testing-rules` owns fixture
construction and cleanup).
Exercise:

- empty, nested, Unicode, and platform-specific paths;
- destination and backup collisions;
- permissions and every other promised metadata property;
- files, directories, symlinks, and broken links;
- failure injected *before* commit, *during* commit, and *after* destination commit;
- cross-device behavior where supported;
- deterministic traversal and result ordering;
- dry-run equivalence with the executed plan;
- retry, undo, cleanup, and partial-batch outcomes.

A test asserting `old == content || new == content` does not prove atomicity—it passes
against a non-atomic implementation whenever the race does not happen to occur.
Inject a failure before the commit point and assert two things: observers still see the
original destination, and no success was reported.

<!-- This document follows common-doc-guidelines.md.
See github.com/jlevy/practical-prose and review guidelines before editing.
-->
