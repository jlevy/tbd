---
type: is
id: is-01kf5zyg8p1f180dsqcnm8xvd4
title: Add golden tests for tbd uninstall command
kind: task
status: closed
priority: 2
version: 6
labels: []
dependencies: []
parent_id: null
due_date: null
deferred_until: null
created_at: 2026-01-17T09:18:00.368Z
updated_at: 2026-03-09T16:12:30.403Z
closed_at: 2026-01-17T09:39:40.767Z
close_reason: Created cli-uninstall.tryscript.md with 27 passing tests covering all uninstall scenarios
extensions:
  beads:
    imported_at: 2026-01-17T12:47:42.779Z
    original_id: tbd-1883
---
Create golden tests for tbd uninstall command.

**Test scenarios:**
1. tbd uninstall --confirm - Successfully removes .tbd/, tbd-sync branch, and worktree
2. tbd uninstall (no confirm) - Requires confirmation flag
3. tbd uninstall in uninitialized repo - Appropriate error message
4. Verify cleanup is complete: no .tbd/ directory, no tbd-sync branch, no orphan worktrees

Create cli-uninstall.tryscript.md following the golden testing guidelines.
