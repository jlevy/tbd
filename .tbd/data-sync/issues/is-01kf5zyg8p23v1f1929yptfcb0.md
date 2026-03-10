---
type: is
id: is-01kf5zyg8p23v1f1929yptfcb0
title: Remove -l shorthand for --label option
kind: task
status: closed
priority: 2
version: 6
labels: []
dependencies: []
parent_id: null
due_date: null
deferred_until: null
created_at: 2026-01-17T11:03:32.931Z
updated_at: 2026-03-09T16:12:30.413Z
closed_at: 2026-01-17T11:50:25.206Z
close_reason: Closed
extensions:
  beads:
    imported_at: 2026-01-17T12:47:43.061Z
    original_id: tbd-1927
---
Remove the -l one-letter option alias for --label in the create command. Keep only --label.

Files to update:
- packages/tbd-cli/src/cli/commands/create.ts (remove -l from option definition)
- Multiple documentation and test files with 10+ usages
