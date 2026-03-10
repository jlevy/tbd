---
type: is
id: is-01kf5zyg8n0br93wcxgqeyj21f
title: Remove Git < 2.42 fallback, require Git 2.42+
kind: task
status: closed
priority: 2
version: 6
labels: []
dependencies: []
parent_id: null
due_date: null
deferred_until: null
created_at: 2026-01-16T22:03:29.771Z
updated_at: 2026-03-09T16:12:30.094Z
closed_at: 2026-01-16T22:09:27.174Z
close_reason: Removed fallback, require Git 2.42+
extensions:
  beads:
    imported_at: 2026-01-17T12:47:42.530Z
    original_id: tbd-1855
---
Remove createOrphanWorktreeFallback() and simplify to just require Git 2.42+. Error with clear upgrade instructions if version is too old.
