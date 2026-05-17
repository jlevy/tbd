---
type: is
id: is-01krvv500rt3q8dqd7mbqb5w3s
title: "Phase 2: Add guarded command entry before data path resolution"
kind: task
status: closed
priority: 2
version: 3
spec_path: docs/project/specs/active/plan-2026-05-17-shared-common-dir-sync-worktree.md
labels: []
dependencies:
  - type: blocks
    target: is-01krvv50d7ccfq8bzq418327fe
parent_id: is-01krvv3hm7d5gnfzw50qzpzph7
created_at: 2026-05-17T20:48:25.623Z
updated_at: 2026-05-17T21:56:35.020Z
closed_at: 2026-05-17T21:56:35.019Z
close_reason: Implemented shared Git common-dir sync worktree and validated with typecheck, lint, unit tests, and tryscripts
---
Add a shared command entry helper that reads config and checks format compatibility before resolving data paths or initializing worktrees. Audit commands that can mutate legacy .tbd/data-sync-worktree paths.
