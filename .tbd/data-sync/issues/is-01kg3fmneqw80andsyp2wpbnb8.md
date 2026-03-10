---
type: is
id: is-01kg3fmneqw80andsyp2wpbnb8
title: "Doctor: Add remote branch health check"
kind: task
status: closed
priority: 1
version: 7
spec_path: docs/project/specs/active/plan-2026-01-28-sync-worktree-recovery-and-hardening.md
labels: []
dependencies: []
parent_id: is-01kg3fj7r0jqj8p1hg9wt9h4sz
created_at: 2026-01-28T23:39:55.222Z
updated_at: 2026-03-09T16:12:33.153Z
closed_at: 2026-01-29T00:05:09.111Z
close_reason: Added checkRemoteSyncBranch() to doctor - detects missing/diverged remote branch
---
Add checkRemoteBranch() to doctor.ts. Uses checkRemoteBranchHealth() to verify remote tbd-sync branch exists. Report warning if missing, warning if diverged. Location: packages/tbd/src/cli/commands/doctor.ts
