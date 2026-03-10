---
type: is
id: is-01kf5zyg8mr8ezcgvdswyv71t6
title: "Test: Add golden test for beads import status mapping (done -> closed)"
kind: task
status: closed
priority: 1
version: 6
labels: []
dependencies: []
parent_id: null
due_date: null
deferred_until: null
created_at: 2026-01-16T07:08:59.498Z
updated_at: 2026-03-09T16:12:30.042Z
closed_at: 2026-01-17T01:08:30.136Z
close_reason: Test already exists in cli-import-status.tryscript.md - 'Done status mapped to closed (tbd-1813 fix)'
extensions:
  beads:
    imported_at: 2026-01-17T12:47:42.257Z
    original_id: tbd-1818
---
Add tryscript golden test that imports beads issues with status 'done' and verifies they are imported as 'closed' status in tbd.
