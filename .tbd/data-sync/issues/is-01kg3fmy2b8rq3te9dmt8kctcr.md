---
type: is
id: is-01kg3fmy2b8rq3te9dmt8kctcr
title: "Doctor: Add data location check (issues in wrong path)"
kind: task
status: closed
priority: 1
version: 10
spec_path: docs/project/specs/active/plan-2026-01-28-sync-worktree-recovery-and-hardening.md
labels: []
dependencies:
  - type: blocks
    target: is-01kg3fn2q76psx2kzskda9zhkx
  - type: blocks
    target: is-01kg3fn7xdx2m29fkpwywhzegv
parent_id: is-01kg3fj7r0jqj8p1hg9wt9h4sz
created_at: 2026-01-28T23:40:04.042Z
updated_at: 2026-03-09T16:12:33.164Z
closed_at: 2026-01-28T23:57:58.378Z
close_reason: Added checkDataLocation() to doctor.ts - detects issues in wrong .tbd/data-sync/ path
---
Add checkDataLocation() to doctor.ts. Detect issues in wrong .tbd/data-sync/ path on main branch (should be in worktree). Report error with count if found. This is Bug 5 detection. Location: packages/tbd/src/cli/commands/doctor.ts
