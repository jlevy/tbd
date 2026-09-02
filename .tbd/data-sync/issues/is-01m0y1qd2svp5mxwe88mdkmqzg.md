---
type: is
id: is-01m0y1qd2svp5mxwe88mdkmqzg
title: Review filesystem-rules.md for accuracy, duplication, and brevity
kind: task
status: closed
priority: 1
version: 4
labels: []
dependencies:
  - type: blocks
    target: is-01m0y1rep9djp2ds5g7jyz71zj
parent_id: is-01m0y1gprchhzvxegj8atrwsj8
created_at: 2026-08-26T03:27:23.737Z
updated_at: 2026-08-26T03:53:10.751Z
closed_at: 2026-08-26T03:53:10.750Z
close_reason: "Reviewed. 2 edits: the vague Windows atomic-rename claim now names the specific APIs; Rust symbols owned by rust-filesystem-rules cut. Write-contract table, temp-file permissions, and the ESLint config shape verified."
resolution: null
duplicate_of: null
---
Review `packages/tbd/docs/guidelines/filesystem-rules.md` (291 lines, new).
Scope rules are in the parent epic—read it first (`tbd show tbd-81x8`).

## Factual claims to verify

- **The five-contract write table.** Each row’s promise and primitive: replacement
  allowed, replacement forbidden, append, live stream, private staging.
  In particular: that append mode positions per write rather than per open, and that
  records may still interleave.
- That a check-then-rename is a race and an atomic no-replace commit is the correct
  primitive.
- That an atomic replace through a temp file starts with the temp file’s permissions,
  not the destination’s.
- The Windows claim: “several [renames] do not [replace atomically]”. Name which, or
  make the claim specific enough to act on.
- The six-step replacement sequence, especially that a rename does not imply durability
  and that the parent-directory sync is the separate step.
- **The ESLint example.** Confirm `@typescript-eslint/no-restricted-imports` accepts the
  `paths` / `importNames` shape shown, and that the rule name and config are correct for
  the version this repo pins.
- The Rust `WalkDir` example compiles and `filter_map(Result::ok)` behaves as described.

## Brevity and duplication

This is the neutral half of a split; `rust-filesystem-rules`, `typescript-rules`
§Atomic publication, and `python-modern-guidelines` are the language halves.
Duplication between them is the expected defect.
Check specifically: the atomic-publication rationale, the staging-file exclusion, and the
“list every import spelling” rule each appear in more than one of those four documents.
