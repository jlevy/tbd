---
type: is
id: is-01krvv4ztkfh4k1v4mt3phdjg1
title: "Phase 1: Add long-running shared data-sync lock profile"
kind: task
status: closed
priority: 2
version: 4
spec_path: docs/project/specs/active/plan-2026-05-17-shared-common-dir-sync-worktree.md
labels: []
dependencies:
  - type: blocks
    target: is-01krvv5070s9rtmyhnb9vw5cz5
  - type: blocks
    target: is-01krvv50kfvh5r5251wdgh3r9x
parent_id: is-01krvv3hm7d5gnfzw50qzpzph7
created_at: 2026-05-17T20:48:25.426Z
updated_at: 2026-05-17T21:56:34.594Z
closed_at: 2026-05-17T21:56:34.593Z
close_reason: Implemented shared Git common-dir sync worktree and validated with typecheck, lint, unit tests, and tryscripts
---
Extend or wrap the mkdir-based lock helper for data-sync operations under $GIT_COMMON_DIR/tbd/locks/data-sync.lock. Account for sync operations that include network calls using longer stale windows or heartbeat metadata.
