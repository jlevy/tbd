---
type: is
id: is-01krvv4zm9rs1jgwhbg23chyk4
title: "Phase 1: Add Git common-dir path and layout helpers"
kind: task
status: closed
priority: 2
version: 4
spec_path: docs/project/specs/active/plan-2026-05-17-shared-common-dir-sync-worktree.md
labels: []
dependencies:
  - type: blocks
    target: is-01krvv4ztkfh4k1v4mt3phdjg1
  - type: blocks
    target: is-01krvv5070s9rtmyhnb9vw5cz5
parent_id: is-01krvv3hm7d5gnfzw50qzpzph7
created_at: 2026-05-17T20:48:25.224Z
updated_at: 2026-05-17T21:56:34.385Z
closed_at: 2026-05-17T21:56:34.384Z
close_reason: Implemented shared Git common-dir sync worktree and validated with typecheck, lint, unit tests, and tryscripts
---
Implement absolute git common-dir resolution, shared tbd dir/worktree/data/lock/layout path helpers, and layout.yml read/write schemas while preserving current .tbd/config.yml root lookup.
