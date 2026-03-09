---
close_reason: "Golden tests added to cli-import.tryscript.md: verifies test-001 becomes bd-001, show command uses preserved ID, ids.yml contains preserved short IDs"
closed_at: 2026-01-17T09:52:11.434Z
created_at: 2026-01-17T06:04:25.718Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-17T12:47:42.649Z
    original_id: tbd-1872
id: is-01kf5zyg8n4t0ttqh976t114mm
kind: task
labels:
  - phase-22
parent_id: null
priority: 2
status: closed
title: Update tests for new ID preservation behavior
type: is
updated_at: 2026-03-09T16:12:30.157Z
version: 6
---
Update tryscript and unit tests to expect preserved IDs. After import of tbd-100, display should be bd-100 not bd-xxxx. Also update idMapping tests for 1+ char short IDs.
