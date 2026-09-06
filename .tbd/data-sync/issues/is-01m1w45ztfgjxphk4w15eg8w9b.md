---
type: is
id: is-01m1w45ztfgjxphk4w15eg8w9b
title: Add an atomic conditional eligible-work claim for automation
kind: task
status: open
priority: 1
version: 2
spec_path: docs/project/specs/active/plan-2026-09-06-bead-coordination-and-native-comments.md
labels: []
dependencies:
  - type: blocks
    target: is-01m1vtazvgbmwf5q9fz9ayrjh0
parent_id: is-01m1w3d1e63qg5e2wpz31qkmvn
created_at: 2026-09-06T19:47:31.790Z
updated_at: 2026-09-06T19:53:17.419Z
---
Phase 1 stabilization: add an opt-in claim contract that checks current status, blockers, hold, deferred_until, and eligible delegation under the same shared data lock as mutation. Preserve ordinary human-directed start behavior and return an explicit claimed/skipped reason with a tested JSON/exit contract. Distinguish worker identity and intended predelegation from the unassigned ready queue. Real simultaneous-process and intervening-state-change tests must prove only an eligible cooperative same-store worker proceeds; this provides no independent-clone exclusivity. Update worker recipe with tbd-zxg6 and installed claim instructions with tbd-c4zl.
