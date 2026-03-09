---
close_reason: Removed fallback, require Git 2.42+
closed_at: 2026-01-16T22:09:27.174Z
created_at: 2026-01-16T22:03:29.771Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-17T12:47:42.530Z
    original_id: tbd-1855
id: is-01kf5zyg8n0br93wcxgqeyj21f
kind: task
labels: []
parent_id: null
priority: 2
status: closed
title: Remove Git < 2.42 fallback, require Git 2.42+
type: is
updated_at: 2026-03-09T16:12:30.094Z
version: 6
---
Remove createOrphanWorktreeFallback() and simplify to just require Git 2.42+. Error with clear upgrade instructions if version is too old.
