---
type: is
id: is-01kg3fmsr4tvm52tb3xc3kyf1a
title: "Doctor: Add sync consistency check"
kind: task
status: closed
priority: 1
version: 8
spec_path: docs/project/specs/active/plan-2026-01-28-sync-worktree-recovery-and-hardening.md
labels: []
dependencies: []
parent_id: is-01kg3fj7r0jqj8p1hg9wt9h4sz
created_at: 2026-01-28T23:39:59.620Z
updated_at: 2026-03-09T16:12:33.159Z
closed_at: 2026-01-29T00:48:35.208Z
close_reason: Added checkSyncConsistency method to doctor.ts
---
Add checkSyncConsistency() to doctor.ts. Only runs if worktree is healthy. Checks: worktree HEAD matches local branch, local ahead/behind counts. Reports errors/info as appropriate. Location: packages/tbd/src/cli/commands/doctor.ts
