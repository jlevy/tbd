---
type: is
id: is-01m2egx69q1wdj3p0tccxdkgg7
title: "tbd integration sync --take local|remote: run-scoped overwrite with per-field report"
kind: feature
status: open
priority: 2
version: 4
spec_path: docs/project/specs/active/plan-2026-09-07-stability-sprint-spec-lifecycle-and-tracker-convergence.md
labels:
  - phase-1
dependencies:
  - type: blocks
    target: is-01m2egx888wh2r62pt8ce4d3wz
parent_id: is-01m1yzwqtnk81a6yg790yn4a9x
created_at: 2026-09-13T23:16:14.769Z
updated_at: 2026-09-16T08:28:21.473Z
extensions:
  linear:
    id: 8a341f32-d29f-4ff2-9c02-28574b146181
    linked_at: 2026-09-16T08:28:21.473Z
---
The one use case that needs an overwrite rather than a direction filter: restoring Linear after a bad bulk edit made in Linear (three-way would pull the damage in), and the inverse. Add `tbd integration sync --take local|remote`, matching the existing `tbd integration link --take` vocabulary (integration.ts:911). Run-scoped over the selected pairs; forces the owner rule through the existing local/remote branch (reconcile.ts:413-427), which already reports overwrites; discarded values go to the attic as conflicts do. Refuse under `tbd sync` (explicit command only). Replaces the overwrite that `--push` performs implicitly today.
