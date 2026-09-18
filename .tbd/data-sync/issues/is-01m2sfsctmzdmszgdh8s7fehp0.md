---
type: is
id: is-01m2sfsctmzdmszgdh8s7fehp0
title: "PR #309 D5: GitError detail should use stderr; drop trailing period"
kind: bug
status: closed
priority: 2
version: 3
spec_path: docs/project/specs/active/plan-2026-09-16-pr-review-lifecycle-and-agent-delegation.md
delegate: unknown@cursor
labels: []
dependencies: []
parent_id: is-01m2sfrx39adcthk03qmd41j53
hold: null
hold_until: null
created_at: 2026-09-18T05:28:20.564Z
updated_at: 2026-09-18T05:36:14.610Z
started_at: 2026-09-18T05:28:29.482Z
closed_at: 2026-09-18T05:36:14.610Z
close_reason: "Fixed in 0f26a4bc; dispositions posted on #309 review D"
resolution: null
duplicate_of: null
---
Low. packages/tbd/src/lib/policy-grants.ts:993-999.
error.message is Node's Command failed line; GitError.stderr has git's reason. Repair ends with period so describeSource doubles it.
Review: https://github.com/jlevy/tbd/pull/309#pullrequestreview-5244525171
Fix: first non-empty stderr line; drop trailing period; extend C1 test to match 'not a git repository'.
