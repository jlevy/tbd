---
close_reason: "Verified: Phase 23 init behavior implemented"
closed_at: 2026-01-17T09:52:22.239Z
created_at: 2026-01-17T06:06:45.969Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-17T12:47:42.678Z
    original_id: tbd-1874.2
id: is-01kf5zyg8nesyetwc2n1v949x9
kind: task
labels: []
parent_id: null
priority: 2
status: closed
title: Add requireInit() to all commands
type: is
updated_at: 2026-03-09T16:12:30.274Z
version: 6
---
Add requireInit() call to ~18 command files: issue.ts, workflow.ts, label.ts, dep.ts, sync.ts, search.ts, maintenance.ts (info, stats, doctor, config), attic.ts. Skip init.ts and import.ts (special handling).
