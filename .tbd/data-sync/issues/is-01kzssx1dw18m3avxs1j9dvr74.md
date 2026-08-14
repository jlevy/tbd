---
type: is
id: is-01kzssx1dw18m3avxs1j9dvr74
title: Specify and verify the tbd web concurrency contract
kind: task
status: closed
priority: 1
version: 4
spec_path: docs/project/specs/active/plan-2026-08-10-tbd-web-live-bead-view.md
labels:
  - web
  - concurrency
  - docs
dependencies: []
parent_id: is-01kzsrmw0y6dtbbg849384y6a4
created_at: 2026-08-12T01:38:00.251Z
updated_at: 2026-08-12T04:38:51.054Z
closed_at: 2026-08-12T04:38:51.054Z
close_reason: Implemented and verified against the normative concurrency contract; focused adversarial coverage and the full release matrix pass.
---
Add a concise, rigorous concurrency and snapshot-safety contract to the tbd design specification. Define ownership, serialization points, stable-snapshot publication, coalescing semantics, SSE attach/replay behavior, client monotonicity and cancellation, shutdown ordering, guarantee boundaries, and the adversarial tests required to prove the implementation conforms.

## Notes

Normative design will use an explicit writer epoch/seqlock proof, distinguish reconciliation hints from consistency fencing, state the linearization point, and document bounded shutdown rather than claiming an unbounded await.
