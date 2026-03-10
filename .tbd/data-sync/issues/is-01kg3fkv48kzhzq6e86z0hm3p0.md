---
type: is
id: is-01kg3fkv48kzhzq6e86z0hm3p0
title: Enhance checkWorktreeHealth() to detect prunable state
kind: task
status: closed
priority: 1
version: 11
spec_path: docs/project/specs/active/plan-2026-01-28-sync-worktree-recovery-and-hardening.md
labels: []
dependencies:
  - type: blocks
    target: is-01kg3fm8whz13k1ty2st7461m0
  - type: blocks
    target: is-01kg3fmdq487gz2pqxm9vv0gp1
  - type: blocks
    target: is-01kg3fncaavct0k7x902gmk078
parent_id: is-01kg3fj7r0jqj8p1hg9wt9h4sz
created_at: 2026-01-28T23:39:28.264Z
updated_at: 2026-03-09T16:12:33.122Z
closed_at: 2026-01-29T00:02:51.009Z
close_reason: "Enhanced checkWorktreeHealth() to detect prunable state via git worktree list --porcelain. Added status field with values: valid, missing, prunable, corrupted."
---
Update checkWorktreeHealth() in git.ts to detect prunable worktree state via 'git worktree list --porcelain'. Return status: 'valid' | 'missing' | 'prunable' | 'corrupted'. Current implementation only checks exists/valid. Location: packages/tbd/src/file/git.ts:682-729
