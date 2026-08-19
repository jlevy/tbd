---
type: is
id: is-01kzsttq5t2vh36gbp2c123eb6
title: Bound SSE replay while guaranteeing delivery of current state
kind: bug
status: closed
priority: 1
version: 3
spec_path: docs/project/specs/active/plan-2026-08-10-tbd-web-live-bead-view.md
labels:
  - web
  - concurrency
  - sse
dependencies: []
parent_id: is-01kzsrmw0y6dtbbg849384y6a4
created_at: 2026-08-12T01:54:12.792Z
updated_at: 2026-08-12T04:38:51.087Z
closed_at: 2026-08-12T04:38:51.087Z
close_reason: Implemented and verified against the normative concurrency contract; focused adversarial coverage and the full release matrix pass.
---
Replay history may be 4 MiB while a client queue is capped at 1 MiB. SseHub.attach currently writes the whole replay before current state, so a slow reconnect can be dropped before convergence and repeat indefinitely. Select a chronological replay suffix that reserves capacity for the current state, retain current-state-first correctness at the bound, and cover synchronous header close/error ordering.
