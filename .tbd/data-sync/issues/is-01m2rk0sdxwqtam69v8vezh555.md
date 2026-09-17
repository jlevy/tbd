---
type: is
id: is-01m2rk0sdxwqtam69v8vezh555
title: "PR #307 A4: no failure-path test for a mid-loop write failure"
kind: bug
status: closed
priority: 2
version: 3
spec_path: docs/project/specs/active/plan-2026-09-16-pr-review-lifecycle-and-agent-delegation.md
delegate: claude-code@spud10.local
labels: []
dependencies: []
parent_id: is-01m2rk07a26hew8fzbz8njv6r4
hold: null
hold_until: null
created_at: 2026-09-17T21:05:34.140Z
updated_at: 2026-09-17T21:47:10.602Z
started_at: 2026-09-17T21:46:46.256Z
closed_at: 2026-09-17T21:47:10.600Z
close_reason: "fixed in 16df8995: 'reports every write failure and leaves the store repairable' makes the write fail (read-only issues directory), asserts the error finding, the non-zero exit, the unchanged store, and the successful rerun; the partial-failure contract is documented next to the loop."
resolution: null
duplicate_of: null
---
Low suggestion. doctor.ts:1018-1031. error-handling-rules asks for one test that makes the operation fail and checks the user-visible result and exit code. Review A: https://github.com/jlevy/tbd/pull/307#pullrequestreview-5238514945
