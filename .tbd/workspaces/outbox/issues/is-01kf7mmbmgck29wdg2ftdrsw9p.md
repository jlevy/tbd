---
close_reason: Migrated list.ts, show.ts, ready.ts to use formatPriority(), getPriorityColor(), and shared getStatusColor(). Removed duplicated private methods.
closed_at: 2026-01-18T05:24:19.816Z
created_at: 2026-01-18T04:08:23.951Z
dependencies:
  - target: is-01kf7mmy2wq0qgmaxj55vtsvsc
    type: blocks
id: is-01kf7mmbmgck29wdg2ftdrsw9p
kind: task
labels: []
priority: 2
status: closed
title: Migrate commands to formatPriority/formatStatus
type: is
updated_at: 2026-03-09T02:47:22.616Z
version: 12
---
Update all commands to use new utilities:
- Update all commands to use formatPriority() for display
- Update all commands to use formatStatus() for display
- Remove duplicated getStatusColor() from list.ts and show.ts

Reference: plan spec section 3.1 (Reusable Components)
