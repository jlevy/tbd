---
type: is
id: is-01m2p2sn2bwn7fgsfaa3wfwcdz
title: Detect directed dependency cycles in doctor
kind: bug
status: in_progress
priority: 1
version: 2
delegate: codex@spud10
labels:
  - doctor
  - dependencies
dependencies: []
hold: null
hold_until: null
created_at: 2026-09-16T21:43:34.217Z
updated_at: 2026-09-16T21:43:54.793Z
started_at: 2026-09-16T21:43:54.790Z
---
tbd doctor does not report directed cycles in bead blocker dependencies. Reproduce with a multi-node cycle such as A depends on B, B depends on C, and C depends on A; tbd doctor currently exits without a cycle finding. Add general directed-cycle detection, preserve clean output for acyclic graphs, cover both cases with regression tests, and document the cause, reproduction, fix, and validation for users and maintainers.
