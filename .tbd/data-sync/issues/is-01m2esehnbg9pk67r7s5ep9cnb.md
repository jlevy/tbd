---
type: is
id: is-01m2esehnbg9pk67r7s5ep9cnb
title: tbd status suggests nonexistent 'tbd setup beads --disable'
kind: bug
status: open
priority: 2
version: 3
spec_path: docs/project/specs/active/plan-2026-09-07-stability-sprint-spec-lifecycle-and-tracker-convergence.md
labels:
  - phase-5
dependencies: []
parent_id: is-01m1yzwqtnk81a6yg790yn4a9x
created_at: 2026-09-14T01:45:32.074Z
updated_at: 2026-09-16T08:28:30.414Z
extensions:
  linear:
    id: 62ba1e21-385b-4d7a-8725-0ac4df812ef4
    linked_at: 2026-09-16T08:28:30.414Z
---
cli/lib/sections.ts:240 prints `Run tbd setup beads --disable for migration options`; no such command exists. PR #283 corrected the same instruction in prime but not here. Point it at the real migration path (tbd setup --from-beads) and pin the output in the orientation golden.
