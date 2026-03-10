---
type: is
id: is-01kf5zyg8n5esy0d6zpx9v5h57
title: Remove beads.yml creation from import
kind: task
status: closed
priority: 2
version: 6
labels:
  - phase-22
dependencies: []
parent_id: null
due_date: null
deferred_until: null
created_at: 2026-01-17T06:04:20.258Z
updated_at: 2026-03-09T16:12:30.174Z
closed_at: 2026-01-17T09:52:11.434Z
close_reason: "Verified: Phase 22 ID preservation implemented"
extensions:
  beads:
    imported_at: 2026-01-17T12:47:42.640Z
    original_id: tbd-1871
---
Since short IDs are now preserved in ids.yml, beads.yml is no longer needed. Remove: loadMapping(), saveMapping() functions and all beads.yml file operations. Keep extensions.beads.original_id for debugging.
