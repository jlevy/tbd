---
type: is
id: is-01kg3fry69b2azss39rm5zw2bf
title: Add e2e tryscript test for sync worktree scenarios
kind: task
status: closed
priority: 2
version: 8
spec_path: docs/project/specs/active/plan-2026-01-28-sync-worktree-recovery-and-hardening.md
labels: []
dependencies: []
parent_id: is-01kg3fj7r0jqj8p1hg9wt9h4sz
created_at: 2026-01-28T23:42:15.240Z
updated_at: 2026-03-09T16:12:33.280Z
closed_at: 2026-01-29T01:25:26.266Z
close_reason: "Added e2e tryscript test cli-sync-worktree-scenarios.tryscript.md covering 17 test cases: fresh init (worktree created, issues in correct location), worktree deleted (sync --fix repairs), data in wrong location (doctor --fix migrates). Also fixed repairWorktree to prune for 'missing' status."
---
Implement the e2e tryscript test from spec Appendix (test-sync-worktree-scenarios.sh). Tests all 5 scenarios: fresh init, fresh clone, worktree deleted, never initialized, never pushed. Uses local bare repo for isolation.
