---
close_reason: "Verified: Phase 23 init behavior implemented (1874.5 still open for tests)"
closed_at: 2026-01-17T09:52:28.633Z
created_at: 2026-01-17T06:06:32.262Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-17T12:47:42.662Z
    original_id: tbd-1874
id: is-01kf5zyg8n8ent5tsjrythem97
kind: epic
labels: []
parent_id: null
priority: 1
status: closed
title: "Phase 23: Initialization Behavior"
type: is
updated_at: 2026-03-09T16:12:30.191Z
version: 6
---
Enforce consistent initialization requirements: all commands except init and import --from-beads must fail with clear error if tbd is not initialized. See tbd-design-v3.md §4.1.1.
