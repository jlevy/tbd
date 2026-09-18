---
type: is
id: is-01m2sfscg99r0hp2srawb34hnw
title: "PR #309 D4: policy show unresolved footer must not treat remote name as a branch"
kind: bug
status: in_progress
priority: 2
version: 2
spec_path: docs/project/specs/active/plan-2026-09-16-pr-review-lifecycle-and-agent-delegation.md
delegate: unknown@cursor
labels: []
dependencies: []
parent_id: is-01m2sfrx39adcthk03qmd41j53
hold: null
hold_until: null
created_at: 2026-09-18T05:28:20.233Z
updated_at: 2026-09-18T05:28:29.480Z
started_at: 2026-09-18T05:28:29.480Z
---
Low. packages/tbd/src/cli/commands/policy.ts:214-224.
Prints 'Working tree AGENTS.md differs from origin' and wrong take-effect advice.
Review: https://github.com/jlevy/tbd/pull/309#pullrequestreview-5244525171
Fix: mirror doctor.ts effectiveOnce; assert in cli-policy unresolved test.
