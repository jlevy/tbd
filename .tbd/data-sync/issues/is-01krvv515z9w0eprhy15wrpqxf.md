---
type: is
id: is-01krvv515z9w0eprhy15wrpqxf
title: "Phase 7: Add linked-worktree migration and versioning tests"
kind: task
status: closed
priority: 2
version: 3
spec_path: docs/project/specs/active/plan-2026-05-17-shared-common-dir-sync-worktree.md
labels: []
dependencies:
  - type: blocks
    target: is-01krvv51c86bs8q20g7gv89qsc
parent_id: is-01krvv3hm7d5gnfzw50qzpzph7
created_at: 2026-05-17T20:48:26.814Z
updated_at: 2026-05-17T21:56:36.536Z
closed_at: 2026-05-17T21:56:36.535Z
close_reason: Implemented shared Git common-dir sync worktree and validated with typecheck, lint, unit tests, and tryscripts
---
Add unit and golden tests for common-dir path resolution, shared attached worktree health, f03 to f04 migration, stale old-client branch ownership guard, legacy dirty/ahead migration, missing layout initialization, and linked-worktree create/sync workflows.
