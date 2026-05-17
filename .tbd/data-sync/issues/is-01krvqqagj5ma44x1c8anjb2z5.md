---
type: is
id: is-01krvqqagj5ma44x1c8anjb2z5
title: "Phase 5: Migrate legacy per-checkout sync worktrees"
kind: task
status: open
priority: 2
version: 3
spec_path: docs/project/specs/active/plan-2026-05-17-shared-common-dir-sync-worktree.md
labels: []
dependencies:
  - type: blocks
    target: is-01krvv50spdvc0pyczkr1rkrpd
parent_id: is-01krvv3hm7d5gnfzw50qzpzph7
created_at: 2026-05-17T19:48:31.889Z
updated_at: 2026-05-17T20:48:44.101Z
---
Migrate existing .tbd/data-sync-worktree locations into the shared common-dir worktree without losing dirty files or commits ahead of tbd-sync. Resolve legacy branch ownership before creating the final shared attached worktree.
