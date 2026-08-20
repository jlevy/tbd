---
type: is
id: is-01m0ermjzgy620e6gx9mtp7z9d
title: Close out the state/actor axis loose ends
kind: task
status: closed
priority: 1
version: 16
spec_path: docs/project/specs/active/plan-2026-08-18-tracker-state-model-and-linear-mapping.md
delegate: null
labels: []
dependencies: []
child_order_hints:
  - is-01m0ermn5x3fntq0ntt3x19pp6
  - is-01m0ermpnsr0p90kjea0vg969a
  - is-01m0ermqr52eqmzsy1g2e419p8
  - is-01m0ermrx52bke3qyg04re1kbc
  - is-01m0ermt6cwxt06ffq30336ymh
  - is-01m0ermv7j0a2dyngp1zfzjwg9
  - is-01m0ermwbyq5ym8c542nxv2xh4
  - is-01m0esx9nxga3wmmfcq0j5kj1p
hold: null
hold_until: null
created_at: 2026-08-20T04:59:57.787Z
updated_at: 2026-08-20T05:53:40.785Z
started_at: 2026-08-20T05:21:32.736Z
closed_at: 2026-08-20T05:53:40.783Z
close_reason: All eight children closed. Two were real defects (dead exhaustiveness guards since f08, which also exposed docs/refs never reaching tbd changes; and a skip-only sync reporting 'nothing to do'). Three were claimed properties with no test or verification behind them (f08 passthrough, directory-bound assignment live, Draft/Blocked columns live). Three were unbuilt features now built (prompt on ambiguous state resolution, board-order repair, formatted invariant errors). Nothing deferred.
resolution: null
duplicate_of: null
extensions:
  linear:
    id: 7347e45a-b0d0-45ca-b0ac-9d0f0cad4075
    linked_at: 2026-08-20T05:21:08.499Z
---
Umbrella for the residuals recorded in PR #245 section 6. Each child is either a real defect or a claimed property with no test behind it.
