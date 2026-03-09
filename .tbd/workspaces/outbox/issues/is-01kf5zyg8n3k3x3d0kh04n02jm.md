---
close_reason: "Phase 22 complete: ID preservation implemented and tested. Code changes in ids.ts and import.ts; golden tests in cli-import.tryscript.md"
closed_at: 2026-01-17T09:52:16.830Z
created_at: 2026-01-17T06:04:02.426Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-17T12:47:42.619Z
    original_id: tbd-1868
id: is-01kf5zyg8n3k3x3d0kh04n02jm
kind: epic
labels: []
parent_id: null
priority: 1
status: closed
title: "Phase 22 Epic: Import ID Preservation"
type: is
updated_at: 2026-03-09T02:47:21.316Z
version: 5
---
Preserve original Beads short IDs during import instead of generating random new ones. This ensures tbd-100 becomes bd-100 (same short ID!) rather than bd-3ykw (random). See plan-2026-01-15-tbd-v1-implementation.md Phase 22.
