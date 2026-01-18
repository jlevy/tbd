---
created_at: 2026-01-18T00:02:07.965Z
dependencies: []
id: is-01kf76hdz4wgn6teghzv2dj2h1
kind: bug
labels: []
priority: 1
status: open
title: "Bug: Sync doesn't update worktree after pull, may lose remote changes"
type: is
updated_at: 2026-01-18T00:02:07.965Z
version: 1
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
