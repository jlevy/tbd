---
type: is
id: is-01kg3fn7xdx2m29fkpwywhzegv
title: "Doctor: Add multi-user/clone scenario detection"
kind: task
status: closed
priority: 1
version: 8
spec_path: docs/project/specs/active/plan-2026-01-28-sync-worktree-recovery-and-hardening.md
labels: []
dependencies: []
parent_id: is-01kg3fj7r0jqj8p1hg9wt9h4sz
created_at: 2026-01-28T23:40:14.125Z
updated_at: 2026-03-09T16:12:33.175Z
closed_at: 2026-01-29T00:08:00.412Z
close_reason: Added checkCloneScenarios() to doctor - detects beads migration issues, config with prefix but no issues, and active beads directory
---
Add checks to doctor.ts for User B clone scenarios: (1) .beads-disabled exists but tbd has no issues, (2) config has id_prefix but no issues, (3) .beads/ exists (migration available). Provide clear guidance for each case. Location: packages/tbd/src/cli/commands/doctor.ts
