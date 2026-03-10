---
type: is
id: is-01kg3fmhfsnrs2mpsqx7gb4c3y
title: "Doctor: Add local branch health check"
kind: task
status: closed
priority: 1
version: 7
spec_path: docs/project/specs/active/plan-2026-01-28-sync-worktree-recovery-and-hardening.md
labels: []
dependencies: []
parent_id: is-01kg3fj7r0jqj8p1hg9wt9h4sz
created_at: 2026-01-28T23:39:51.161Z
updated_at: 2026-03-09T16:12:33.148Z
closed_at: 2026-01-29T00:05:08.852Z
close_reason: Added checkLocalSyncBranch() to doctor - detects missing/orphaned local tbd-sync branch
---
Add checkLocalBranch() to doctor.ts. Uses checkLocalBranchHealth() to verify local tbd-sync branch exists. Report error if missing, warning if orphaned. Location: packages/tbd/src/cli/commands/doctor.ts
