---
type: is
id: is-01m2r2n6bbdqvn9gk82wncwy09
title: "PR #306 A3: close test coverage gaps for dependency cycle diagnostics"
kind: bug
status: closed
priority: 2
version: 3
delegate: claude-code@spud10
labels: []
dependencies: []
parent_id: is-01m2r2mnzqczgyy01sknncwtbq
hold: null
hold_until: null
created_at: 2026-09-17T16:19:36.937Z
updated_at: 2026-09-17T20:53:14.665Z
started_at: 2026-09-17T16:19:45.267Z
closed_at: 2026-09-17T20:53:14.663Z
close_reason: "Fixed in ccc38de084f80c463acdbd43731a2a34fb2b3197 and 8608253dac812a675756068a7e55dec8096806cd: table-driven dependencyFinding cases for self-loop, two sorted components, orphan-only and cycle-plus-orphan; doctor-sync.test.ts now asserts dependencyFinding instead of an inline copy of its loop; a new common-dir-layout-doctor.test.ts e2e case asserts the Dependencies entry in doctor --json is status error with exit 1. 37 tests pass across the three files."
resolution: null
duplicate_of: null
---
Severity Medium. PR #306, review https://github.com/jlevy/tbd/pull/306#pullrequestreview-5238509304. packages/tbd/tests/issue-dependency-graph.test.ts:1-73, packages/tbd/tests/doctor-sync.test.ts:58-91. Untested: combined cycle-plus-orphan, self-loop, two components ordering, orphan-only through dependencyFinding, CLI contract (error status, exit 1). doctor-sync orphan test re-implements the loop inline. Fix: table-driven cases, call dependencyFinding in doctor-sync, one e2e doctor --json case.
