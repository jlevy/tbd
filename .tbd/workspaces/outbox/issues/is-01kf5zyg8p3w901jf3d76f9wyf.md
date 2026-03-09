---
close_reason: Closed
closed_at: 2026-01-17T11:50:25.206Z
created_at: 2026-01-17T11:03:31.899Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-17T12:47:43.035Z
    original_id: tbd-1924
id: is-01kf5zyg8p3w901jf3d76f9wyf
kind: task
labels: []
parent_id: null
priority: 2
status: closed
title: Remove -p shorthand for --priority option
type: is
updated_at: 2026-03-09T16:12:30.444Z
version: 6
---
Remove the -p one-letter option alias for --priority in the create command. Keep only --priority.

Files to update:
- packages/tbd-cli/src/cli/commands/create.ts (remove -p from option definition)
- Multiple documentation and test files with 30+ usages
