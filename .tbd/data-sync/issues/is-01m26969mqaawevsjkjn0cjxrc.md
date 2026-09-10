---
type: is
id: is-01m26969mqaawevsjkjn0cjxrc
title: Correct in-progress query labels in agent instructions
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
created_at: 2026-09-10T18:27:29.046Z
updated_at: 2026-09-10T20:20:03.349Z
started_at: 2026-09-10T18:27:47.565Z
closed_at: 2026-09-10T20:20:03.349Z
close_reason: Reconciled implementation and documentation, validated links and formatting, passed lint/build/publint/golden tests, and passed focused tests; the single full-suite load timeout passed in isolation.
resolution: null
duplicate_of: null
---
The compact and full agent instruction surfaces call tbd list --status in_progress 'Your active work', but the command is unscoped and returns all in-progress beads. Change each surface to 'All in-progress work'.
