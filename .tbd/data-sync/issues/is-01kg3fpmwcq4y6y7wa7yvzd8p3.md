---
type: is
id: is-01kg3fpmwcq4y6y7wa7yvzd8p3
title: "Tests: Phase 2 path consistency"
kind: task
status: closed
priority: 2
version: 10
spec_path: docs/project/specs/active/plan-2026-01-28-sync-worktree-recovery-and-hardening.md
labels: []
dependencies:
  - type: blocks
    target: is-01kg3fq2j85c2rq9a0hzmqwax9
  - type: blocks
    target: is-01kg3frmht6x09yzt08ddm20ys
parent_id: is-01kg3fj7r0jqj8p1hg9wt9h4sz
created_at: 2026-01-28T23:41:00.171Z
updated_at: 2026-03-09T16:12:33.213Z
closed_at: 2026-01-29T01:02:01.804Z
close_reason: "Tests already exist in worktree-health.test.ts: resolveDataSyncDir returns worktree path when exists, returns direct path with allowFallback, throws WorktreeMissingError when fallback not allowed."
---
Add tests: resolveDataSyncDir() returns worktree path in production, throws WorktreeMissingError when missing, allows fallback with { allowFallback: true }. Test getSyncStatus() checks correct path. Test commitWorktreeChanges() uses consistent paths.
