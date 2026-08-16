---
type: is
id: is-01kzss88nnpk8q95qeyphfhk0k
title: Add an adversarial end-to-end ordering matrix for tbd web
kind: task
status: closed
priority: 1
version: 3
spec_path: docs/project/specs/active/plan-2026-08-10-tbd-web-live-bead-view.md
labels:
  - web
  - concurrency
  - testing
dependencies: []
parent_id: is-01kzsrmw0y6dtbbg849384y6a4
created_at: 2026-08-12T01:26:39.540Z
updated_at: 2026-08-12T04:38:51.047Z
closed_at: 2026-08-12T04:38:51.047Z
close_reason: Implemented and verified against the normative concurrency contract; focused adversarial coverage and the full release matrix pass.
---
Exercise native/reconcile overlap, writer-lock deferral, reload failure and recovery, stop during active work, SSE attach/publish/close ordering, replay duplicates and ref rewinds, stale board/body responses, observer restart, and burst coalescing. Assert monotonic state/data versions, bounded queues, canonical final board state, no duplicate movement publication, and clean teardown.
