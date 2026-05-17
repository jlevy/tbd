---
type: is
id: is-01krvv50spdvc0pyczkr1rkrpd
title: "Phase 4: Update sync branch operations for the shared worktree"
kind: task
status: closed
priority: 2
version: 3
spec_path: docs/project/specs/active/plan-2026-05-17-shared-common-dir-sync-worktree.md
labels: []
dependencies:
  - type: blocks
    target: is-01krvv50zseq1m656d5kn3ashf
parent_id: is-01krvv3hm7d5gnfzw50qzpzph7
created_at: 2026-05-17T20:48:26.421Z
updated_at: 2026-05-17T21:56:36.121Z
closed_at: 2026-05-17T21:56:36.120Z
close_reason: Implemented shared Git common-dir sync worktree and validated with typecheck, lint, unit tests, and tryscripts
---
Update sync commit, fetch, merge, push, outbox import, consistency, and repair flows to operate against the shared attached worktree and common lock.
