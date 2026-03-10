---
type: is
id: is-01kf5zyg8mz9fxnv74rgax7hha
title: "Test: Add golden test verifying files written to tbd-sync worktree not main"
kind: task
status: closed
priority: 1
version: 6
labels: []
dependencies: []
parent_id: null
due_date: null
deferred_until: null
created_at: 2026-01-16T07:08:58.400Z
updated_at: 2026-03-09T16:12:30.077Z
closed_at: 2026-01-17T01:08:12.669Z
close_reason: Completed as part of short ID system implementation - tests exist in cli-id-format.tryscript.md and cli-filesystem.tryscript.md
extensions:
  beads:
    imported_at: 2026-01-17T12:47:42.236Z
    original_id: tbd-1815
---
Add tryscript golden test that verifies issue files are written to .tbd/sync-worktree/.tbd-sync/ (tbd-sync branch worktree) not directly to .tbd-sync/ on main.
