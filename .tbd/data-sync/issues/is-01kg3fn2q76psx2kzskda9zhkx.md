---
type: is
id: is-01kg3fn2q76psx2kzskda9zhkx
title: "Doctor: Add 'local has data but remote empty' detection"
kind: task
status: closed
priority: 1
version: 8
spec_path: docs/project/specs/active/plan-2026-01-28-sync-worktree-recovery-and-hardening.md
labels: []
dependencies: []
parent_id: is-01kg3fj7r0jqj8p1hg9wt9h4sz
created_at: 2026-01-28T23:40:08.807Z
updated_at: 2026-03-09T16:12:33.170Z
closed_at: 2026-01-29T00:06:25.174Z
close_reason: Added checkLocalVsRemoteData() to doctor - detects local issues that haven't been pushed to remote
---
Add check to doctor.ts for ai-trade-arena bug pattern: local worktree or wrong path has issues but remote tbd-sync has none. Count issues on remote using git show. Report error if mismatch found. Location: packages/tbd/src/cli/commands/doctor.ts
