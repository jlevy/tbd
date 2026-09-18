---
type: is
id: is-01m2rwhb6yve9nmrczfmpjaa6v
title: "PR #309 A1: parsePolicyBlock matches marker lines not marker text"
kind: bug
status: open
priority: 2
version: 1
spec_path: docs/project/specs/active/plan-2026-09-16-pr-review-lifecycle-and-agent-delegation.md
labels: []
dependencies: []
parent_id: is-01m2rw9zzs69gde6ayhc8z6pwt
created_at: 2026-09-17T23:51:53.822Z
updated_at: 2026-09-17T23:51:53.822Z
---
Severity: Medium. PR #309. Review: https://github.com/jlevy/tbd/pull/309#pullrequestreview-5242256965. Files: packages/tbd/src/lib/policy-grants.ts:410-428, :588-589. parsePolicyBlock scans whole AGENTS.md for marker text so a prose mention of the marker is counted as a block. Fix: line-anchored marker matching after toLf.
