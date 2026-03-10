---
type: is
id: is-01kf5zyg8p2xjtsjxpzvrz5e15
title: Update build to copy README to package
kind: task
status: closed
priority: 2
version: 6
labels: []
dependencies: []
parent_id: null
due_date: null
deferred_until: null
created_at: 2026-01-17T10:35:42.784Z
updated_at: 2026-03-09T16:12:30.424Z
closed_at: 2026-01-17T10:56:04.137Z
close_reason: Implemented documentation improvements
extensions:
  beads:
    imported_at: 2026-01-17T12:47:42.935Z
    original_id: tbd-1909
---
Extend packages/tbd-cli/scripts/copy-docs.mjs to copy README.md from repo root to package dist/docs/. The readme command will read from this location.
