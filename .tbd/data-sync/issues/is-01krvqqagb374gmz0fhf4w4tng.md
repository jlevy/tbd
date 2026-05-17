---
type: is
id: is-01krvqqagb374gmz0fhf4w4tng
title: "Phase 1: Spike shared Git common-dir attached sync worktree"
kind: task
status: in_progress
priority: 2
version: 5
spec_path: docs/project/specs/active/plan-2026-05-17-shared-common-dir-sync-worktree.md
labels: []
dependencies:
  - type: blocks
    target: is-01krvv4zm9rs1jgwhbg23chyk4
  - type: blocks
    target: is-01krvtc0z4g8x93dmgrynqx3bd
parent_id: is-01krvv3hm7d5gnfzw50qzpzph7
created_at: 2026-05-17T19:48:31.882Z
updated_at: 2026-05-17T20:55:09.837Z
---
Spike the shared attached worktree design under $GIT_COMMON_DIR/tbd/data-sync-worktree from a primary checkout and a linked worktree. Validate branch ownership, git worktree list behavior, and whether migration needs a temporary detached scratch path.
