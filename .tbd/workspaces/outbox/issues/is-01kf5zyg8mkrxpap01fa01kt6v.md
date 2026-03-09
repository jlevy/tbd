---
close_reason: Fixed by commit 9a36a5c - commands now use resolveDataSyncDir() which auto-detects worktree path
closed_at: 2026-01-16T21:48:43.382Z
created_at: 2026-01-16T07:07:21.670Z
deferred_until: null
dependencies: []
due_date: null
extensions:
  beads:
    imported_at: 2026-01-17T12:47:42.199Z
    original_id: tbd-1810
id: is-01kf5zyg8mkrxpap01fa01kt6v
kind: bug
labels: []
parent_id: null
priority: 1
status: closed
title: "Bug: import writes files to main branch instead of tbd-sync worktree"
type: is
updated_at: 2026-03-09T02:47:21.103Z
version: 5
---
The import command (and all storage operations) write directly to '.tbd-sync/' in the current working directory instead of using the git worktree at '.tbd/sync-worktree/.tbd-sync/'. According to the design, issues should be stored on the tbd-sync branch accessed via a hidden worktree, not directly on main. This causes the .tbd-sync directory to appear as untracked on main.

## Notes

Root cause: ALL commands use wrong base path (.tbd-sync instead of .tbd/sync-worktree/.tbd-sync). 20 files affected. See comprehensive analysis in retro-2026-01-16-worktree-architecture-not-implemented.md
