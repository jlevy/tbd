---
type: is
id: is-01kf76hdz4wgn6teghzv2dj2h1
title: "Bug: Sync doesn't update worktree after pull, may lose remote changes"
kind: bug
status: closed
priority: 0
version: 9
labels: []
dependencies: []
created_at: 2026-01-18T00:02:07.965Z
updated_at: 2026-03-09T16:12:31.340Z
closed_at: 2026-01-18T00:53:53.453Z
close_reason: "Fixed by reordering sync operations: now commits local changes FIRST, then fetches/merges remote changes. This ensures both local and remote work are preserved. The git merge handles combining the changes properly."
---
In fullSync(), after pulling remote changes (update-ref to remote commit), the worktree's working directory is NOT updated. This means:

1. Remote's NEW files are not in the worktree
2. When we commit worktree changes, remote's new files are lost

Example scenario:
- Agent A creates issue-A, pushes
- Agent B creates issue-B locally
- Agent B syncs: pull updates branch ref to remote, but worktree still has old state
- Agent B's commit has parent=remote but tree=local files only
- Issue-A is LOST

Fix: Call updateWorktree() after pulling to sync worktree with new branch state, then apply local changes.
