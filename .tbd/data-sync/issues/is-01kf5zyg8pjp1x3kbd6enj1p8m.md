---
type: is
id: is-01kf5zyg8pjp1x3kbd6enj1p8m
title: Remove -f shorthand for --file option
kind: task
status: closed
priority: 2
version: 6
labels: []
dependencies: []
parent_id: null
due_date: null
deferred_until: null
created_at: 2026-01-17T11:03:32.586Z
updated_at: 2026-03-09T16:12:30.574Z
closed_at: 2026-01-17T11:50:25.206Z
close_reason: Closed
extensions:
  beads:
    imported_at: 2026-01-17T12:47:43.052Z
    original_id: tbd-1926
---
Remove the -f one-letter option alias for --file in the create command. Keep only --file.

Files to update:
- packages/tbd-cli/src/cli/commands/create.ts (remove -f from option definition)
- docs/project/architecture/current/tbd-design-v3.md
- docs/project/architecture/archive/tbd-design-v2-phase1.md
- And other documentation files
