---
type: is
id: is-01m2rwhb6yve9nmrczfmpjaa6v
title: "PR #309 A1: parsePolicyBlock matches marker lines not marker text"
kind: bug
status: closed
priority: 2
version: 2
spec_path: docs/project/specs/active/plan-2026-09-16-pr-review-lifecycle-and-agent-delegation.md
labels: []
dependencies: []
parent_id: is-01m2rw9zzs69gde6ayhc8z6pwt
created_at: 2026-09-17T23:51:53.822Z
updated_at: 2026-09-18T00:53:34.948Z
closed_at: 2026-09-18T00:53:34.948Z
close_reason: "Fixed on claude/pr-review-lifecycle-and-delegation in ab3261a2 (B1 CI identity 8aaf70a8, A8 Windows paths ff7a3b5a). CI run 35292159287 success at ff7a3b5a. Disposition replies not posted: addressing agent has no ManagePullRequest and gh comment returns 403."
resolution: null
duplicate_of: null
---
Severity: Medium. PR #309. Review: https://github.com/jlevy/tbd/pull/309#pullrequestreview-5242256965. Files: packages/tbd/src/lib/policy-grants.ts:410-428, :588-589. parsePolicyBlock scans whole AGENTS.md for marker text so a prose mention of the marker is counted as a block. Fix: line-anchored marker matching after toLf.
