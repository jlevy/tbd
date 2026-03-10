---
type: is
id: is-01kg3fqs9tj6bc9dkx4dej91xk
title: "Tests: Phase 3 auto-repair"
kind: task
status: closed
priority: 2
version: 11
spec_path: docs/project/specs/active/plan-2026-01-28-sync-worktree-recovery-and-hardening.md
labels: []
dependencies:
  - type: blocks
    target: is-01kg3fr7j3cthb58xj9ecp9r40
  - type: blocks
    target: is-01kg3frg6cwrjtf5j6gesfs9q2
  - type: blocks
    target: is-01kg3fry69b2azss39rm5zw2bf
parent_id: is-01kg3fj7r0jqj8p1hg9wt9h4sz
created_at: 2026-01-28T23:41:37.465Z
updated_at: 2026-03-09T16:12:33.248Z
closed_at: 2026-01-29T01:15:23.566Z
close_reason: "Added 16 tests for Phase 3 auto-repair: repairWorktree (missing, prunable, corrupted) and migrateDataToWorktree (migration, backup, source preservation, data integrity)"
---
Add integration tests: sync --fix recreates worktree, doctor --fix migrates data, repairWorktree() handles all failure modes (prunable, missing local, missing remote, orphan). Test migration preserves all issue data. Test backup to Attic works.
