---
type: is
id: is-01m267hmfd9b427fys9mj7s9vc
title: Correct hidden-worktree init and push lifecycle in main design
kind: bug
status: closed
priority: 2
version: 3
spec_path: docs/project/specs/active/plan-2026-09-06-bead-coordination-and-native-comments.md
delegate: codex@spud10.local
labels: []
dependencies: []
parent_id: is-01m262ajn3ttv71mxamxce3ykf
hold: null
hold_until: null
created_at: 2026-09-10T17:58:43.437Z
updated_at: 2026-09-10T20:20:03.270Z
started_at: 2026-09-10T18:27:47.503Z
closed_at: 2026-09-10T20:20:03.270Z
close_reason: Reconciled implementation and documentation, validated links and formatting, passed lint/build/publint/golden tests, and passed focused tests; the single full-suite load timeout passed in isolation.
resolution: null
duplicate_of: null
---
DOC-AUDIT-09: The main design incorrectly says init creates the hidden worktree only when tbd-sync exists and that push updates it afterward. Reconcile with fresh orphan creation/push and in-place sync execution.
