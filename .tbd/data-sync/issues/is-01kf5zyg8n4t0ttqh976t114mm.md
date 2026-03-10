---
type: is
id: is-01kf5zyg8n4t0ttqh976t114mm
title: Update tests for new ID preservation behavior
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
created_at: 2026-01-17T06:04:25.718Z
updated_at: 2026-03-09T16:12:30.157Z
closed_at: 2026-01-17T09:52:11.434Z
close_reason: "Golden tests added to cli-import.tryscript.md: verifies test-001 becomes bd-001, show command uses preserved ID, ids.yml contains preserved short IDs"
extensions:
  beads:
    imported_at: 2026-01-17T12:47:42.649Z
    original_id: tbd-1872
---
Update tryscript and unit tests to expect preserved IDs. After import of tbd-100, display should be bd-100 not bd-xxxx. Also update idMapping tests for 1+ char short IDs.
