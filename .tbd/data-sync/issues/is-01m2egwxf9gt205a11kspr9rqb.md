---
type: is
id: is-01m2egwxf9gt205a11kspr9rqb
title: "Interim: --push dry run and confirmation say it overwrites Linear-side edits"
kind: task
status: open
priority: 2
version: 1
spec_path: docs/project/specs/active/plan-2026-09-07-stability-sprint-spec-lifecycle-and-tracker-convergence.md
labels:
  - phase-1
dependencies: []
parent_id: is-01m1yzwqtnk81a6yg790yn4a9x
created_at: 2026-09-13T23:16:05.736Z
updated_at: 2026-09-13T23:16:05.736Z
---
Interim until Phase 1B retires the mirror: `tbd integration sync --push` (planMirror/applyMirror) writes title, status, resolution, hold, and priority to every selected linked item with no base check (mirror.ts:262-296, :331-335), so it replaces Linear-side edits and counts unchanged items as updates. The dry run and the bulk confirmation should say so, for example: `would overwrite 136 linked items (Linear-side edits to title, status, and priority are replaced)`. Message change only; ships with 1c (tbd-020a).
