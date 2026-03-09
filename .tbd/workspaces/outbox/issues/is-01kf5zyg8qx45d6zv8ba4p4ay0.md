---
close_reason: "Implemented CJS bootstrap with Node.js compile cache. Results: ~23-28% faster warm startup (148ms→114ms for --version, 163ms→117ms for --help). All 653 tests pass."
closed_at: 2026-01-17T12:41:42.271Z
created_at: 2026-01-17T12:36:40.173Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-17T12:47:43.133Z
    original_id: tbd-1937
id: is-01kf5zyg8qx45d6zv8ba4p4ay0
kind: task
labels: []
parent_id: null
priority: 2
status: closed
title: Enable Node.js compile cache for CLI startup performance
type: is
updated_at: 2026-03-09T02:47:22.094Z
version: 5
---
Add Node.js module compile cache (Node 22.8+) to improve CLI warm startup times. The compile cache stores pre-compiled bytecode on disk, making subsequent runs significantly faster. Implementation: create a CJS bootstrap that enables cache before loading ESM CLI.
