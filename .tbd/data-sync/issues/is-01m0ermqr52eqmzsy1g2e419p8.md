---
type: is
id: is-01m0ermqr52eqmzsy1g2e419p8
title: Pin the f08 passthrough claim for the new bead fields
kind: task
status: open
priority: 2
version: 1
spec_path: docs/project/specs/active/plan-2026-08-18-tracker-state-model-and-linear-mapping.md
labels: []
dependencies: []
parent_id: is-01m0ermjzgy620e6gx9mtp7z9d
created_at: 2026-08-20T05:00:02.690Z
updated_at: 2026-08-20T05:00:02.690Z
---
Both specs claim an older tbd round-trips resolution/hold/delegate/started_at without stripping them, and the no-format-bump decision rests on it. f08-unknown-key-preservation.test.ts exists but does not cover these fields. Cheap test, load-bearing claim.
