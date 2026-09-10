---
type: is
id: is-01m2696a1m7k0xhhd16agx1vrg
title: List complete lifecycle values in agent quick references
kind: bug
status: closed
priority: 2
version: 3
spec_path: docs/project/specs/active/plan-2026-09-06-bead-coordination-and-native-comments.md
delegate: codex@spud10.local
labels: []
dependencies: []
parent_id: is-01m262ajn3ttv71mxamxce3ykf
hold: null
hold_until: null
created_at: 2026-09-10T18:27:29.459Z
updated_at: 2026-09-10T20:20:03.359Z
started_at: 2026-09-10T18:27:47.571Z
closed_at: 2026-09-10T20:20:03.359Z
close_reason: Reconciled implementation and documentation, validated links and formatting, passed lint/build/publint/golden tests, and passed focused tests; the single full-suite load timeout passed in isolation.
resolution: null
duplicate_of: null
---
Agent quick references omit blocked and deferred status values, and tbd-prime omits chore from valid kinds. Align every current source and generated surface with IssueStatus and IssueKind.
