---
type: is
id: is-01m01w3jp8zjp74yw33z3tw15j
title: diff3-style conflict markers bypass MergeConflictError detection
kind: bug
status: open
priority: 3
version: 3
spec_path: docs/project/specs/active/plan-2026-08-28-sync-convergence-and-stability.md
labels: []
dependencies: []
created_at: 2026-08-15T04:50:27.144Z
updated_at: 2026-09-16T08:24:08.336Z
extensions:
  linear:
    id: 0510b229-d1d7-4010-b176-f780de68d11e
    linked_at: 2026-09-16T08:24:08.336Z
---
`hasMergeConflictMarkers` detects the standard `<<<<<<<` / `=======` / `>>>>>>>` markers, but diff3-style conflicts also emit a `|||||||` base section. A file conflicted in diff3 style raises a confusing raw YAML parse error instead of the clear `MergeConflictError` with its "run tbd doctor --fix" guidance.

Verified during the senior review of PR #232 to be **pre-existing on main**, not introduced by that PR, so it was deliberately left out of scope there.

Matters because `merge.conflictStyle = diff3` (and `zdiff3`) is a common git configuration, and users who set it get the worst error message in exactly the situation the good one was written for.
