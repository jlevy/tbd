---
type: is
id: is-01m26a8v2vayd52pyvbdc8cjwj
title: Reconcile main design Git sync and worktree behavior
kind: bug
status: closed
priority: 1
version: 3
spec_path: docs/project/specs/active/plan-2026-09-06-bead-coordination-and-native-comments.md
delegate: codex@spud10.local
labels:
  - documentation
  - release-stability
dependencies: []
parent_id: is-01m262ajn3ttv71mxamxce3ykf
hold: null
hold_until: null
created_at: 2026-09-10T18:46:21.018Z
updated_at: 2026-09-10T20:20:02.641Z
started_at: 2026-09-10T18:46:36.664Z
closed_at: 2026-09-10T20:20:02.641Z
close_reason: Reconciled implementation and documentation, validated links and formatting, passed lint/build/publint/golden tests, and passed focused tests; the single full-suite load timeout passed in isolation.
resolution: null
duplicate_of: null
---
Correct the main design to match shipped explicit tracking-ref fetches, commit-before-fetch sync ordering, and automatic repair of missing/prunable shared worktrees.
