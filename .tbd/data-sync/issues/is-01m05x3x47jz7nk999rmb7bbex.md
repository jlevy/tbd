---
type: is
id: is-01m05x3x47jz7nk999rmb7bbex
title: Verify orphaned pairs cost zero requests per sync
kind: task
status: open
priority: 3
version: 2
spec_path: docs/project/specs/active/plan-2026-08-14-external-sync-and-traceability.md
labels:
  - phase-3
dependencies: []
parent_id: is-01m00h43nvt17wxyhxqm88wh3c
created_at: 2026-08-16T18:25:04.134Z
updated_at: 2026-08-16T19:40:33.416Z
extensions:
  linear:
    id: b7156dc3-9e35-4ac8-b657-0891b031d57f
    linked_at: 2026-08-16T19:40:33.416Z
---
Orphaned pairs (archived/trashed/deleted remotes) skip reconciliation, but confirm they are also excluded from the per-sync fetch and comment-listing sets. If a pair quiesces logically but still costs a targeted fetch or a listComments per sync, archival never actually shrinks the quiet-sync cost — and shrinking steady-state cost is half the point of the lifecycle. Measure with the mock's request log: N linked + M orphaned pairs should cost the same as N linked.
