---
type: is
id: is-01kf5zyg8mnr4aeczqwxpwbt2r
title: "Test: Add golden test verifying short public IDs in list output"
kind: task
status: closed
priority: 1
version: 6
labels: []
dependencies: []
parent_id: null
due_date: null
deferred_until: null
created_at: 2026-01-16T07:08:58.777Z
updated_at: 2026-03-09T16:12:29.983Z
closed_at: 2026-01-17T01:08:12.669Z
close_reason: Completed as part of short ID system implementation - tests exist in cli-id-format.tryscript.md and cli-filesystem.tryscript.md
extensions:
  beads:
    imported_at: 2026-01-17T12:47:42.243Z
    original_id: tbd-1816
---
Add tryscript golden test that verifies list output shows short public IDs like 'bd-a7k2' not internal ULIDs, and preserves original beads IDs for imports.
