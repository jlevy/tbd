---
type: is
id: is-01kf5zyg8n7t1scj8fr5y15jm3
title: Add tryscript tests for init errors
kind: task
status: closed
priority: 2
version: 6
labels: []
dependencies: []
parent_id: null
due_date: null
deferred_until: null
created_at: 2026-01-17T06:06:57.945Z
updated_at: 2026-03-09T16:12:30.180Z
closed_at: 2026-01-17T09:52:22.239Z
close_reason: "Verified: Phase 23 init behavior implemented"
extensions:
  beads:
    imported_at: 2026-01-17T12:47:42.698Z
    original_id: tbd-1874.4
---
Add tests in cli-*.tryscript.md to verify each command fails with exit code 1 and correct error message when run in uninitialized repo.
