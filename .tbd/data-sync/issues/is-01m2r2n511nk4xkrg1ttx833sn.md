---
type: is
id: is-01m2r2n511nk4xkrg1ttx833sn
title: "PR #306 A2: keep fixable and --fix guidance for orphans when a cycle is also present"
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
created_at: 2026-09-17T16:19:35.579Z
updated_at: 2026-09-17T20:53:14.162Z
started_at: 2026-09-17T16:19:44.563Z
closed_at: 2026-09-17T20:53:14.161Z
close_reason: "Fixed in ccc38de084f80c463acdbd43731a2a34fb2b3197: the combined cycle-plus-orphan result in dependencyFinding (doctor.ts) now sets fixable: true and appends 'Run: tbd doctor --fix to repair the orphaned reference(s).' to the cycle suggestion. Confirmed by the 'keeps orphan repair guidance when a cycle is also present' case in tests/issue-dependency-graph.test.ts."
resolution: null
duplicate_of: null
---
Severity Medium. PR #306, review https://github.com/jlevy/tbd/pull/306#pullrequestreview-5238509304. packages/tbd/src/cli/commands/doctor.ts:164-174. Combined cycle-plus-orphan error result omits fixable: true and the 'Run: tbd doctor --fix' guidance. Fix: fixable: orphans.length > 0 and keep the orphan suggestion alongside the cycle one; cover in unit test. Related: PR #307 implements orphan repair in the same method.
