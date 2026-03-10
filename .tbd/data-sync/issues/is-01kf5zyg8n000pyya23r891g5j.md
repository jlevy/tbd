---
type: is
id: is-01kf5zyg8n000pyya23r891g5j
title: "Add test helper: verify serialization format"
kind: task
status: closed
priority: 2
version: 6
labels: []
dependencies: []
parent_id: null
due_date: null
deferred_until: null
created_at: 2026-01-16T18:46:36.762Z
updated_at: 2026-03-09T16:12:30.088Z
closed_at: 2026-01-16T18:54:29.987Z
close_reason: "Added serialization helper: hasCorrectFrontmatterFormat"
extensions:
  beads:
    imported_at: 2026-01-17T12:47:42.416Z
    original_id: tbd-1839
---
Create helper that checks exact file format: no extra newlines, proper YAML structure, correct encoding. Used to catch bugs like tbd-1812.
