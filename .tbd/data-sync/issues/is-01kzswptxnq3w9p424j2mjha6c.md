---
type: is
id: is-01kzswptxnq3w9p424j2mjha6c
title: Route every doctor --fix data-sync mutation through the shared writer fence
kind: bug
status: closed
priority: 1
version: 3
spec_path: docs/project/specs/active/plan-2026-08-10-tbd-web-live-bead-view.md
labels:
  - web
  - concurrency
dependencies: []
parent_id: is-01kzsrmw0y6dtbbg849384y6a4
created_at: 2026-08-12T02:27:02.708Z
updated_at: 2026-08-12T04:38:51.102Z
closed_at: 2026-08-12T04:38:51.102Z
close_reason: Implemented and verified against the normative concurrency contract; focused adversarial coverage and the full release matrix pass.
---
The concurrency-contract audit found several doctor --fix paths that mutate the shared data-sync worktree without withSharedDataSyncLock: mapping conflict repair, duplicate-map repair, missing-map recovery, orphan temp cleanup, an upgrade prepare path, and legacy data migration. Those paths can bypass both mutual exclusion and the persistent web snapshot epoch. Inventory every doctor mutation, place each complete multi-file critical section under the central wrapper without nesting locks, and add regressions proving the epoch brackets doctor repairs.
