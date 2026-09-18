---
type: is
id: is-01m2sfsbhd7r3dsqd65xcsw1d2
title: "PR #309 D1: prime prints no grants section when default branch is unresolved"
kind: bug
status: in_progress
priority: 1
version: 2
spec_path: docs/project/specs/active/plan-2026-09-16-pr-review-lifecycle-and-agent-delegation.md
delegate: unknown@cursor
labels: []
dependencies: []
parent_id: is-01m2sfrx39adcthk03qmd41j53
hold: null
hold_until: null
created_at: 2026-09-18T05:28:19.244Z
updated_at: 2026-09-18T05:28:29.473Z
started_at: 2026-09-18T05:28:29.473Z
---
Medium. packages/tbd/src/cli/commands/prime.ts:228-238, :406-416.
formatPolicyGrantsLines returns null when parse is missing && !hasTbdBlock before the unresolved branch. SessionStart hook never sees the B1 repair line.
Review: https://github.com/jlevy/tbd/pull/309#pullrequestreview-5244525171
Fix: test source?.kind === 'unresolved' first; change unit test fixture to parse missing; add subprocess test on a single-branch clone.
