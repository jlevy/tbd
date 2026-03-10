---
type: is
id: is-01kg3fq2j85c2rq9a0hzmqwax9
title: Add --fix flag to tbd sync
kind: task
status: closed
priority: 1
version: 9
spec_path: docs/project/specs/active/plan-2026-01-28-sync-worktree-recovery-and-hardening.md
labels: []
dependencies:
  - type: blocks
    target: is-01kg3fq74xtepfgcjyfh6kx67z
parent_id: is-01kg3fj7r0jqj8p1hg9wt9h4sz
created_at: 2026-01-28T23:41:14.183Z
updated_at: 2026-03-09T16:12:33.219Z
closed_at: 2026-01-29T01:04:54.030Z
close_reason: Added --fix flag to tbd sync command. When worktree is unhealthy and --fix is provided, attempts repair by pruning stale entries and reinitializing worktree.
---
Add --fix option to sync command. When worktree is unhealthy and --fix is provided, attempt repair before syncing. Call repairWorktree() which prunes stale entries and recreates worktree. Location: packages/tbd/src/cli/commands/sync.ts:597-606
