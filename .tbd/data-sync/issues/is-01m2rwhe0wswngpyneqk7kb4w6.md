---
type: is
id: is-01m2rwhe0wswngpyneqk7kb4w6
title: "PR #309 A9: tableRows switch needs exhaustive never default"
kind: bug
status: closed
priority: 3
version: 2
spec_path: docs/project/specs/active/plan-2026-09-16-pr-review-lifecycle-and-agent-delegation.md
labels: []
dependencies: []
parent_id: is-01m2rw9zzs69gde6ayhc8z6pwt
created_at: 2026-09-17T23:51:56.700Z
updated_at: 2026-09-18T00:53:34.967Z
closed_at: 2026-09-18T00:53:34.967Z
close_reason: "Fixed on claude/pr-review-lifecycle-and-delegation in ab3261a2 (B1 CI identity 8aaf70a8, A8 Windows paths ff7a3b5a). CI run 35292159287 success at ff7a3b5a. Disposition replies not posted: addressing agent has no ManagePullRequest and gh comment returns 403."
resolution: null
duplicate_of: null
---
Severity: Low. PR #309. Review: https://github.com/jlevy/tbd/pull/309#pullrequestreview-5242256965. File: packages/tbd/scripts/readme-reference-tables.ts:241-250. tableRows switches on ReferenceKind without never default. Fix: default exhaustive throw.
