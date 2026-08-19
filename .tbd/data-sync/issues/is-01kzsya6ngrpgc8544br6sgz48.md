---
type: is
id: is-01kzsya6ngrpgc8544br6sgz48
title: Keep worktree initialization and data migration in one writer epoch
kind: bug
status: closed
priority: 1
version: 2
spec_path: docs/project/specs/active/plan-2026-08-10-tbd-web-live-bead-view.md
labels:
  - web
  - concurrency
  - doctor
dependencies: []
parent_id: is-01kzsrmw0y6dtbbg849384y6a4
created_at: 2026-08-12T02:55:05.902Z
updated_at: 2026-08-12T04:38:51.135Z
closed_at: 2026-08-12T04:38:51.135Z
close_reason: Implemented and verified against the normative concurrency contract; focused adversarial coverage and the full release matrix pass.
---
checkDataLocation currently releases the shared writer lock after initializing a missing hidden worktree, performs an unlocked health check, then reacquires the lock for migration. The web observer can accept the valid-but-empty intermediate worktree and publish a transient mass deletion during one doctor --fix operation. Recheck health, initialize if needed, and migrate under one withSharedDataSyncLock epoch; add a regression that the writer epoch changes only once and no quiescent intermediate state is exposed.
