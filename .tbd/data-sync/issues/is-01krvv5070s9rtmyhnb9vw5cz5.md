---
type: is
id: is-01krvv5070s9rtmyhnb9vw5cz5
title: "Phase 3: Implement shared attached worktree init and health checks"
kind: task
status: closed
priority: 2
version: 4
spec_path: docs/project/specs/active/plan-2026-05-17-shared-common-dir-sync-worktree.md
labels: []
dependencies:
  - type: blocks
    target: is-01krvqqagj5ma44x1c8anjb2z5
  - type: blocks
    target: is-01krvv50d7ccfq8bzq418327fe
parent_id: is-01krvv3hm7d5gnfzw50qzpzph7
created_at: 2026-05-17T20:48:25.823Z
updated_at: 2026-05-17T21:56:35.232Z
closed_at: 2026-05-17T21:56:35.231Z
close_reason: Implemented shared Git common-dir sync worktree and validated with typecheck, lint, unit tests, and tryscripts
---
Move worktree init, health, repair, and consistency checks to the shared $GIT_COMMON_DIR/tbd/data-sync-worktree path. The steady-state worktree should be attached to tbd-sync, not detached.
