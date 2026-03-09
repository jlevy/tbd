---
close_reason: Closed
closed_at: 2026-01-17T11:50:25.206Z
created_at: 2026-01-17T11:03:31.562Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-17T12:47:43.027Z
    original_id: tbd-1923
id: is-01kf5zyg8pw2j2k4vb3hsyz9d2
kind: task
labels: []
parent_id: null
priority: 2
status: closed
title: Remove -t shorthand for --type option
type: is
updated_at: 2026-03-09T16:12:30.659Z
version: 6
---
Remove the -t one-letter option alias for --type in the create command. Keep only --type.

Files to update:
- packages/tbd-cli/src/cli/commands/create.ts (remove -t from option definition)
- Multiple documentation and test files with 80+ usages
