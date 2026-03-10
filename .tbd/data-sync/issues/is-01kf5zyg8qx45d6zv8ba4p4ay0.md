---
type: is
id: is-01kf5zyg8qx45d6zv8ba4p4ay0
title: Enable Node.js compile cache for CLI startup performance
kind: task
status: closed
priority: 2
version: 6
labels: []
dependencies: []
parent_id: null
due_date: null
deferred_until: null
created_at: 2026-01-17T12:36:40.173Z
updated_at: 2026-03-09T16:12:30.982Z
closed_at: 2026-01-17T12:41:42.271Z
close_reason: "Implemented CJS bootstrap with Node.js compile cache. Results: ~23-28% faster warm startup (148ms→114ms for --version, 163ms→117ms for --help). All 653 tests pass."
extensions:
  beads:
    imported_at: 2026-01-17T12:47:43.133Z
    original_id: tbd-1937
---
Add Node.js module compile cache (Node 22.8+) to improve CLI warm startup times. The compile cache stores pre-compiled bytecode on disk, making subsequent runs significantly faster. Implementation: create a CJS bootstrap that enables cache before loading ESM CLI.
