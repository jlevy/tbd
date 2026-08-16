---
type: is
id: is-01kzt26j5jfvsg9fs2t5j64gae
title: Make shared lock stale recovery safe across suspension and ABA
kind: bug
status: closed
priority: 0
version: 3
spec_path: docs/project/specs/active/plan-2026-08-10-tbd-web-live-bead-view.md
labels: []
dependencies: []
parent_id: is-01kzsrmw0y6dtbbg849384y6a4
created_at: 2026-08-12T04:03:00.913Z
updated_at: 2026-08-12T04:38:51.149Z
closed_at: 2026-08-12T04:38:51.149Z
close_reason: Implemented and verified against the normative concurrency contract; focused adversarial coverage and the full release matrix pass.
---
A heartbeat-only stale policy could displace a live writer after machine sleep, and a delayed stale observer could rename a successor through canonical-path ABA. The design requires token/host/pid ownership immediately after atomic mkdir, fail-closed ownerless or ambiguous identity, same-host PID liveness before dead-owner recovery, release-by-rename before cleanup, and retained token-derived stale quarantine. Implement these invariants and force suspension plus delayed-recovery interleavings in tests.
