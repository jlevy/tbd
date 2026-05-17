---
type: is
id: is-01krvtc0z4g8x93dmgrynqx3bd
title: "Phase 2: Add f04 format and shared layout metadata guards"
kind: task
status: open
priority: 2
version: 4
spec_path: docs/project/specs/active/plan-2026-05-17-shared-common-dir-sync-worktree.md
labels: []
dependencies:
  - type: blocks
    target: is-01krvv500rt3q8dqd7mbqb5w3s
  - type: blocks
    target: is-01krvqqagj5ma44x1c8anjb2z5
parent_id: is-01krvv3hm7d5gnfzw50qzpzph7
created_at: 2026-05-17T20:34:47.395Z
updated_at: 2026-05-17T20:48:43.069Z
---
Add f04 to tbd-format.ts, add sync.storage: git-common-dir-v1, add $GIT_COMMON_DIR/tbd/layout.yml using the same tbd_format IDs, and make mismatched/future metadata fail closed.
