---
type: is
id: is-01krvv50kfvh5r5251wdgh3r9x
title: "Phase 4: Wrap mutating commands and sync in the common lock"
kind: task
status: open
priority: 2
version: 2
spec_path: docs/project/specs/active/plan-2026-05-17-shared-common-dir-sync-worktree.md
labels: []
dependencies:
  - type: blocks
    target: is-01krvv50spdvc0pyczkr1rkrpd
parent_id: is-01krvv3hm7d5gnfzw50qzpzph7
created_at: 2026-05-17T20:48:26.222Z
updated_at: 2026-05-17T20:48:43.956Z
---
Wrap create, update, close, reopen, dependency, label, import, save, and issue sync mutation paths in the shared data-sync lock so sibling worktrees cannot interleave writes.
