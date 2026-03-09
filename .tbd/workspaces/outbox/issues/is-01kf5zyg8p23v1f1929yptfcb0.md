---
close_reason: Closed
closed_at: 2026-01-17T11:50:25.206Z
created_at: 2026-01-17T11:03:32.931Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-17T12:47:43.061Z
    original_id: tbd-1927
id: is-01kf5zyg8p23v1f1929yptfcb0
kind: task
labels: []
parent_id: null
priority: 2
status: closed
title: Remove -l shorthand for --label option
type: is
updated_at: 2026-03-09T16:12:30.413Z
version: 6
---
Remove the -l one-letter option alias for --label in the create command. Keep only --label.

Files to update:
- packages/tbd-cli/src/cli/commands/create.ts (remove -l from option definition)
- Multiple documentation and test files with 10+ usages
