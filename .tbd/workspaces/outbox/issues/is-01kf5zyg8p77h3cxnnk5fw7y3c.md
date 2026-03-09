---
close_reason: Closed
closed_at: 2026-01-17T11:50:25.206Z
created_at: 2026-01-17T11:03:32.245Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-17T12:47:43.044Z
    original_id: tbd-1925
id: is-01kf5zyg8p77h3cxnnk5fw7y3c
kind: task
labels: []
parent_id: null
priority: 2
status: closed
title: Remove -d shorthand for --description option
type: is
updated_at: 2026-03-09T16:12:30.495Z
version: 6
---
Remove the -d one-letter option alias for --description in the create command. Keep only --description.

Files to update:
- packages/tbd-cli/src/cli/commands/create.ts (remove -d from option definition)
- Multiple documentation and test files with 15+ usages
