---
type: is
id: is-01kf7mmbmgck29wdg2ftdrsw9p
title: Migrate commands to formatPriority/formatStatus
kind: task
status: closed
priority: 2
version: 13
labels: []
dependencies:
  - type: blocks
    target: is-01kf7mmy2wq0qgmaxj55vtsvsc
created_at: 2026-01-18T04:08:23.951Z
updated_at: 2026-03-09T16:12:31.591Z
closed_at: 2026-01-18T05:24:19.816Z
close_reason: Migrated list.ts, show.ts, ready.ts to use formatPriority(), getPriorityColor(), and shared getStatusColor(). Removed duplicated private methods.
---
Update all commands to use new utilities:
- Update all commands to use formatPriority() for display
- Update all commands to use formatStatus() for display
- Remove duplicated getStatusColor() from list.ts and show.ts

Reference: plan spec section 3.1 (Reusable Components)
