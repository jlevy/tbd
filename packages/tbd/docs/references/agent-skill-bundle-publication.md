---
title: Agent Skill Bundle Publication
description: Safe publication, materialization, upgrade, ownership, and failure-testing rules for multi-file skill directories
author: Joshua Levy (github.com/jlevy) with LLM assistance
category: general
---
# Agent Skill Bundle Publication

Load this reference when a skill contains files beyond `SKILL.md`, a CLI installs or
updates a skill, a discovery directory is generated, or printed skill text contains
relative links.

## The Unit of Publication

The [Agent Skills specification](https://agentskills.io/specification) defines a skill
as a directory. Treat these files as one logical version:

```text
my-skill/
├── SKILL.md
├── references/
├── scripts/
└── assets/
```

Validate the complete intended tree before making any new version visible.
Validation should cover:

- required `SKILL.md` frontmatter
- every relative link from `SKILL.md`
- every referenced script or asset
- expected file modes and symlink policy
- generated pins and format stamps
- the full owned-file manifest, including stale-resource cleanup

## Distinguish Delivery Routes

| Route | What the agent receives | Relative links are usable when |
| --- | --- | --- |
| Authored directory | Files in a checked-in skill folder | The whole directory is present |
| Discovery directory | A committed `skills/<name>/` source | Every linked file is committed |
| Skill installer | A copied or symlinked skill directory | Installation completes the whole bundle |
| Temporary use | A tool materializes a bundle for one invocation | The temporary directory includes all resources |
| Printed `SKILL.md` | Text on stdout | Content is self-contained or gives a materialization route |

Printing the entry file does not create its relative filesystem context.
A CLI that prints link-bearing content must do one of three things:

1. Materialize the complete bundle and print its path.
2. Inline the required content so the output is self-contained.
3. Tell the agent exactly how to install or temporarily materialize the bundle before
   following the links.

Test the printed and installed routes separately.

## Preferred Publication: Atomic Directory Replacement

When the publisher owns the entire target directory and the target and staging path are
on the same filesystem:

1. Read and validate every existing managed artifact before changing anything.
2. Build the complete new directory in a sibling temporary path.
3. Validate the staged tree and its relative links.
4. Set final modes and metadata in staging.
5. Rename the existing owned directory to a rollback path.
6. Rename the staged directory into place.
7. Remove the rollback path only after the new tree is verified.
8. On failure, restore the prior directory and remove all temporary paths.

Do not call a sequence of per-file atomic writes an atomic bundle publication.
Each file may be crash-safe while the visible directory still moves through mixed
versions.

Platform rename semantics, antivirus/file-lock behavior, and cross-device moves differ.
Test the supported platforms rather than assuming POSIX directory replacement behavior.

## Fallback Publication: Dependencies First, Entry File Last

When the publisher cannot replace the whole directory because it shares user-owned
content or platform behavior forbids it:

1. Perform a bundle-wide forward-compatibility and ownership preflight.
2. Stage and validate all new files.
3. Publish references, scripts, and assets.
4. Publish the link-bearing `SKILL.md` last.
5. Remove stale owned resources according to a deterministic manifest.
6. Clean temporary files on every exit path.

This order prevents a newly visible `SKILL.md` from pointing to a resource that was
never created. It is not a transaction.
During an upgrade, the old entry file can see new resource content before the new entry
file is published.

Use this fallback only when resources are backward-compatible across the supported
upgrade window, or use versioned resource paths such as `references/v2/project.md`. If
mixed versions can change meaning or cause unsafe execution, require a stronger
transaction or move the managed bundle into an exclusively owned directory.

## Ownership and Forward Compatibility

Choose one policy per target:

- **Owned directory**: replace the directory and deterministically remove stale files
- **Owned manifest**: manage only listed paths and preserve all other content
- **Per-artifact ownership**: guard each file and never infer ownership from location

Before any write, inspect all existing managed artifacts.
If one carries a newer format than the publisher understands, stop before publishing any
part of the bundle. Name the exact artifact and its detected/supported formats in the
error.

Do not report `SKILL.md` when a reference, script, or managed project block is the
actual blocker. Errors are part of the ownership contract.

If a format does not need a marker, do not add one.
When a marker is necessary, include only compatibility data that cannot be inferred from
the artifact location.

## Failure Tests

At minimum, cover:

- the target `references/` path cannot be created
- a staged relative link is missing
- a managed resource has a newer format
- the entry file has a newer format
- an upgrade fails after one resource publish in fallback mode
- stale owned resources are removed while user-owned files remain
- temporary and rollback paths are cleaned after failure
- repeated installation is byte-identical
- the discovery directory and installed bundle have the same logical contents

For the uncreatable-reference case, assert that a new link-bearing `SKILL.md` never
becomes visible. For upgrades, also assert the documented mixed-version behavior: either
the old bundle remains intact, or the compatibility/versioning rule makes the
intermediate state safe.

## Flowmark Reference Implementations

Flowmark exposed the general failure modes behind these rules:

- [Flowmark PR #64](https://github.com/jlevy/flowmark/pull/64) corrected
  artifact-specific forward-guard errors and made printed skill text route to complete
  materialization
- [flowmark-rs PR #78](https://github.com/jlevy/flowmark-rs/pull/78) added staged,
  failure-safe multi-file publication and parity tests

Flowmark is an L2b example, not a requirement to reproduce its exact implementation.
Choose the simplest publication strategy that proves the bundle invariant for the target
platforms and ownership model.

<!-- This document follows common-doc-guidelines.md.
See github.com/jlevy/practical-prose and review guidelines before editing.
-->
