---
close_reason: "Verified: Phase 23 init behavior implemented"
closed_at: 2026-01-17T09:52:22.239Z
created_at: 2026-01-17T06:06:51.984Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-17T12:47:42.685Z
    original_id: tbd-1874.3
id: is-01kf5zyg8nnt40d7rkzhf02tct
kind: task
labels: []
parent_id: null
priority: 2
status: closed
title: Implement auto-init in import --from-beads
type: is
updated_at: 2026-03-09T16:12:30.308Z
version: 6
---
In import.ts, when --from-beads is used and .tbd/config.yml doesn't exist, automatically run init logic before proceeding with import. Report: Initialized tbd and imported N issues from Beads
