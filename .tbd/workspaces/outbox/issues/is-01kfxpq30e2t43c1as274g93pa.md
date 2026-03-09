---
created_at: 2026-01-26T17:48:08.077Z
dependencies: []
id: is-01kfxpq30e2t43c1as274g93pa
kind: task
labels: []
parent_id: is-01kfxpq9c0j5wdsqy6vsqc3d1g
priority: 2
status: open
title: Audit and ensure consistent status icon usage across all CLI commands
type: is
updated_at: 2026-03-09T02:47:23.893Z
version: 6
---
Status icons (○ ◐ ● ✓) should be used consistently everywhere statuses are displayed.

**Context:**
- `getStatusIcon()` in status.ts provides standard icons
- `formatIssueLine()` in issue-format.ts uses them correctly
- But other commands may display statuses without icons

**Commands to audit:**
- `tbd stats` - shows status counts without icons (see tbd-vbet)
- `tbd stale` - check if using icons
- `tbd blocked` - check if using icons  
- `tbd ready` - check if using icons
- Any other command showing status values

**Goal:**
All status displays should use getStatusIcon() for visual consistency:
- ○ open
- ◐ in_progress
- ● blocked  
- ✓ closed

**Files to review:**
- packages/tbd/src/cli/commands/stats.ts
- packages/tbd/src/cli/commands/stale.ts
- packages/tbd/src/cli/commands/blocked.ts
- packages/tbd/src/cli/commands/ready.ts
- packages/tbd/src/lib/status.ts (source of truth)
