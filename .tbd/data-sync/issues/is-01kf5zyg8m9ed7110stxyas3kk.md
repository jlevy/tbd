---
type: is
id: is-01kf5zyg8m9ed7110stxyas3kk
title: Fix golden test cross-platform temp path normalization
kind: bug
status: closed
priority: 0
version: 6
labels:
  - cross-platform
  - phase-17
  - testing
dependencies: []
parent_id: null
due_date: null
deferred_until: null
created_at: 2026-01-15T22:45:00.000Z
updated_at: 2026-03-09T16:12:29.855Z
closed_at: 2026-01-16T21:55:33.913Z
close_reason: null
extensions:
  beads:
    imported_at: 2026-01-17T12:47:42.176Z
    original_id: tbd-1806
---
Update normalizeOutput in golden test runner to handle macOS and Windows temp directory paths.
