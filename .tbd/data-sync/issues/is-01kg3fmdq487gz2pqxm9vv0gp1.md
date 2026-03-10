---
type: is
id: is-01kg3fmdq487gz2pqxm9vv0gp1
title: "Doctor: Enhanced worktree health check with prunable detection"
kind: task
status: closed
priority: 1
version: 8
spec_path: docs/project/specs/active/plan-2026-01-28-sync-worktree-recovery-and-hardening.md
labels: []
dependencies: []
parent_id: is-01kg3fj7r0jqj8p1hg9wt9h4sz
created_at: 2026-01-28T23:39:47.299Z
updated_at: 2026-03-09T16:12:33.143Z
closed_at: 2026-01-29T00:05:08.594Z
close_reason: Updated doctor's checkWorktree() to use new status field (valid/missing/prunable/corrupted) with appropriate error messages
---
Update doctor.ts checkWorktree() to use enhanced checkWorktreeHealth() that detects prunable state. Report error for missing/prunable/corrupted worktree instead of returning 'not created yet' as OK. Location: packages/tbd/src/cli/commands/doctor.ts:494-512
