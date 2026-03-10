---
type: is
id: is-01kg3frbqa3wwzr0sbqpps1hxz
title: "Add CI check: worktree health after operations"
kind: task
status: closed
priority: 2
version: 8
spec_path: docs/project/specs/active/plan-2026-01-28-sync-worktree-recovery-and-hardening.md
labels: []
dependencies: []
parent_id: is-01kg3fj7r0jqj8p1hg9wt9h4sz
created_at: 2026-01-28T23:41:56.329Z
updated_at: 2026-03-09T16:12:33.259Z
closed_at: 2026-01-29T01:30:46.957Z
close_reason: "Added CI health check as integration test in worktree-health.test.ts (2 new tests): verifies checkWorktreeHealth returns valid after initWorktree, and worktree remains healthy after creating issues. Per user feedback, moved from GitHub Action to regular test suite."
---
Add CI step that runs 'tbd doctor' after test operations and fails if unhealthy. Ensures worktree integrity is maintained in CI pipeline.
