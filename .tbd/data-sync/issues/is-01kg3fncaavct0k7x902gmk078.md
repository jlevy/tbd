---
type: is
id: is-01kg3fncaavct0k7x902gmk078
title: "Sync: Check worktree health before operations"
kind: task
status: closed
priority: 1
version: 8
spec_path: docs/project/specs/active/plan-2026-01-28-sync-worktree-recovery-and-hardening.md
labels: []
dependencies:
  - type: blocks
    target: is-01kg3fngz2acc5gx2tatk24k1d
parent_id: is-01kg3fj7r0jqj8p1hg9wt9h4sz
created_at: 2026-01-28T23:40:18.634Z
updated_at: 2026-03-09T16:12:33.180Z
closed_at: 2026-01-29T00:48:35.332Z
close_reason: Added worktree health check before sync operations
---
Update sync.ts run() to check worktree health at start. If unhealthy, throw clear error suggesting 'tbd doctor --fix'. Later phase will add --fix flag to sync. Must use enhanced checkWorktreeHealth() with prunable detection. Location: packages/tbd/src/cli/commands/sync.ts:54-87
