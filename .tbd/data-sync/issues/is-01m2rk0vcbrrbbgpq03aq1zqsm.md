---
type: is
id: is-01m2rk0vcbrrbbgpq03aq1zqsm
title: "PR #307 B4: untouched issue files never asserted unchanged"
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
created_at: 2026-09-17T21:05:36.138Z
updated_at: 2026-09-17T21:47:13.754Z
started_at: 2026-09-17T21:46:46.288Z
closed_at: 2026-09-17T21:47:13.751Z
close_reason: "fixed in 16df8995: the happy-path test snapshots every issue file before the repair and asserts the untouched files are byte-identical afterwards, and that the rewritten file differs only in the dropped edge, the version bump, and updated_at."
resolution: null
duplicate_of: null
---
Low. packages/tbd/tests/common-dir-layout-doctor.test.ts:103-172. 'Update only issue files that contained missing-target edges' is documented and untested. Review B: https://github.com/jlevy/tbd/pull/307#pullrequestreview-5241384146
