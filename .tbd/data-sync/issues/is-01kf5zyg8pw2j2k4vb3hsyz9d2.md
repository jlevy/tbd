---
type: is
id: is-01kf5zyg8pw2j2k4vb3hsyz9d2
title: Remove -t shorthand for --type option
kind: task
status: closed
priority: 2
version: 6
labels: []
dependencies: []
parent_id: null
due_date: null
deferred_until: null
created_at: 2026-01-17T11:03:31.562Z
updated_at: 2026-03-09T16:12:30.659Z
closed_at: 2026-01-17T11:50:25.206Z
close_reason: Closed
extensions:
  beads:
    imported_at: 2026-01-17T12:47:43.027Z
    original_id: tbd-1923
---
Remove the -t one-letter option alias for --type in the create command. Keep only --type.

Files to update:
- packages/tbd-cli/src/cli/commands/create.ts (remove -t from option definition)
- Multiple documentation and test files with 80+ usages
