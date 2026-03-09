---
close_reason: "Verified: Phase 22 ID preservation implemented"
closed_at: 2026-01-17T09:52:11.434Z
created_at: 2026-01-17T06:04:20.258Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-17T12:47:42.640Z
    original_id: tbd-1871
id: is-01kf5zyg8n5esy0d6zpx9v5h57
kind: task
labels:
  - phase-22
parent_id: null
priority: 2
status: closed
title: Remove beads.yml creation from import
type: is
updated_at: 2026-03-09T02:47:21.347Z
version: 5
---
Since short IDs are now preserved in ids.yml, beads.yml is no longer needed. Remove: loadMapping(), saveMapping() functions and all beads.yml file operations. Keep extensions.beads.original_id for debugging.
