---
type: is
id: is-01kzst5bq03e812ynrgsbp8mjd
title: Keep live web reloads out of the writer-lock graph
kind: bug
status: closed
priority: 1
version: 3
spec_path: docs/project/specs/active/plan-2026-08-10-tbd-web-live-bead-view.md
labels:
  - web
  - concurrency
  - lock
dependencies: []
parent_id: is-01kzsrmw0y6dtbbg849384y6a4
created_at: 2026-08-12T01:42:32.927Z
updated_at: 2026-08-12T04:38:51.061Z
closed_at: 2026-08-12T04:38:51.060Z
close_reason: Implemented and verified against the normative concurrency contract; focused adversarial coverage and the full release matrix pass.
---
BoardState.reload currently uses loadDataContext, whose repair path may acquire and wait on the shared data-sync writer lock. Split repair-capable startup preparation from a strictly non-locking prepared-context loader used by live reloads. Validate the candidate from before its first context read, preserve stable-snapshot retry semantics, and prove shutdown cannot inherit a lock wait.
