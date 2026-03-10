---
type: is
id: is-01kg3fp1y0e265fsk8whx2zgv4
title: Update getSyncStatus() to check worktree, not main branch
kind: task
status: closed
priority: 1
version: 9
spec_path: docs/project/specs/active/plan-2026-01-28-sync-worktree-recovery-and-hardening.md
labels: []
dependencies:
  - type: blocks
    target: is-01kg3fp6pz0jzfff1bvdfbw0fs
parent_id: is-01kg3fj7r0jqj8p1hg9wt9h4sz
created_at: 2026-01-28T23:40:40.768Z
updated_at: 2026-03-09T16:12:33.191Z
closed_at: 2026-01-29T00:59:19.312Z
close_reason: Fixed getSyncStatus() to check worktree status instead of main branch. Changed git status to run with -C worktreePath to check uncommitted changes in the correct location.
---
Fix Bug 2: getSyncStatus() at sync.ts:140 runs 'git status --porcelain DATA_SYNC_DIR' on main branch where data-sync is gitignored. Change to check files in worktree path via resolveDataSyncDir(). Location: packages/tbd/src/cli/commands/sync.ts:128-218
