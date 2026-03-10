---
type: is
id: is-01kf5zyg8p77h3cxnnk5fw7y3c
title: Remove -d shorthand for --description option
kind: task
status: closed
priority: 2
version: 6
labels: []
dependencies: []
parent_id: null
due_date: null
deferred_until: null
created_at: 2026-01-17T11:03:32.245Z
updated_at: 2026-03-09T16:12:30.495Z
closed_at: 2026-01-17T11:50:25.206Z
close_reason: Closed
extensions:
  beads:
    imported_at: 2026-01-17T12:47:43.044Z
    original_id: tbd-1925
---
Remove the -d one-letter option alias for --description in the create command. Keep only --description.

Files to update:
- packages/tbd-cli/src/cli/commands/create.ts (remove -d from option definition)
- Multiple documentation and test files with 15+ usages
