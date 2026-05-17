---
type: is
id: is-01krvv50d7ccfq8bzq418327fe
title: "Phase 4: Route issue data paths through the shared worktree"
kind: task
status: open
priority: 2
version: 2
spec_path: docs/project/specs/active/plan-2026-05-17-shared-common-dir-sync-worktree.md
labels: []
dependencies:
  - type: blocks
    target: is-01krvv50kfvh5r5251wdgh3r9x
parent_id: is-01krvv3hm7d5gnfzw50qzpzph7
created_at: 2026-05-17T20:48:26.022Z
updated_at: 2026-05-17T20:48:43.814Z
---
Update resolveDataSyncDir and related issue/mapping/attic path helpers so production commands read and write $GIT_COMMON_DIR/tbd/data-sync-worktree/.tbd/data-sync. Keep direct fallback only for tests and explicit diagnostics.
