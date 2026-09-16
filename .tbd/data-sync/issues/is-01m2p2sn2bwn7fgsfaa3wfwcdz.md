---
type: is
id: is-01m2p2sn2bwn7fgsfaa3wfwcdz
title: Detect directed dependency cycles in doctor
kind: bug
status: closed
priority: 1
version: 3
delegate: codex@spud10
labels:
  - doctor
  - dependencies
dependencies: []
hold: null
hold_until: null
created_at: 2026-09-16T21:43:34.217Z
updated_at: 2026-09-16T22:22:18.270Z
started_at: 2026-09-16T21:43:54.790Z
closed_at: 2026-09-16T22:22:18.269Z
close_reason: "Implemented in PR #306 (codex/doctor-dependency-cycle at 076e1adec996725a52eddc5d020af40c2bbe14d5): doctor now detects directed depends-on cycles with deterministic public-ID diagnostics; multi-node cycle and acyclic regression tests, documentation, manual reproduction, and all GitHub CI checks pass."
resolution: null
duplicate_of: null
---
tbd doctor does not report directed cycles in bead blocker dependencies. Reproduce with a multi-node cycle such as A depends on B, B depends on C, and C depends on A; tbd doctor currently exits without a cycle finding. Add general directed-cycle detection, preserve clean output for acyclic graphs, cover both cases with regression tests, and document the cause, reproduction, fix, and validation for users and maintainers.
