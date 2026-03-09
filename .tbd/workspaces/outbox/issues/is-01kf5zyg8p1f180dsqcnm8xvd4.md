---
close_reason: Created cli-uninstall.tryscript.md with 27 passing tests covering all uninstall scenarios
closed_at: 2026-01-17T09:39:40.767Z
created_at: 2026-01-17T09:18:00.368Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-17T12:47:42.779Z
    original_id: tbd-1883
id: is-01kf5zyg8p1f180dsqcnm8xvd4
kind: task
labels: []
parent_id: null
priority: 2
status: closed
title: Add golden tests for tbd uninstall command
type: is
updated_at: 2026-03-09T02:47:21.559Z
version: 5
---
Create golden tests for tbd uninstall command.

**Test scenarios:**
1. tbd uninstall --confirm - Successfully removes .tbd/, tbd-sync branch, and worktree
2. tbd uninstall (no confirm) - Requires confirmation flag
3. tbd uninstall in uninitialized repo - Appropriate error message
4. Verify cleanup is complete: no .tbd/ directory, no tbd-sync branch, no orphan worktrees

Create cli-uninstall.tryscript.md following the golden testing guidelines.
