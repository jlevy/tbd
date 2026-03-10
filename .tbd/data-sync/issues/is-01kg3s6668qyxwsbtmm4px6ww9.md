---
type: is
id: is-01kg3s6668qyxwsbtmm4px6ww9
title: "Bug: worktree commit operations should bypass parent repo git hooks"
kind: bug
status: closed
priority: 2
version: 8
labels: []
dependencies: []
created_at: 2026-01-29T02:26:46.599Z
updated_at: 2026-03-09T16:12:33.310Z
closed_at: 2026-01-29T02:33:46.284Z
close_reason: "Fixed: added --no-verify to all worktree git commit operations"
---
When migrateDataToWorktree commits files in the worktree, the commit can fail due to lefthook (or other git hooks) from the parent repo. Worktree commit operations in git.ts should use --no-verify to bypass hooks, since the worktree is an internal data store and shouldn't be subject to project-level hooks like linting.

Observed in ai-trade-arena recovery: migration commit failed with 'No config files with names [lefthook] have been found'.

Fix: Add --no-verify to git commit calls in migrateDataToWorktree() and other worktree operations.
