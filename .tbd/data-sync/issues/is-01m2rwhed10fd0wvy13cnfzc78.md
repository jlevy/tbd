---
type: is
id: is-01m2rwhed10fd0wvy13cnfzc78
title: "PR #309 A10: changelog must say 0.9.0 rewrites config.yml before stopping"
kind: bug
status: closed
priority: 3
version: 2
spec_path: docs/project/specs/active/plan-2026-09-16-pr-review-lifecycle-and-agent-delegation.md
labels: []
dependencies: []
parent_id: is-01m2rw9zzs69gde6ayhc8z6pwt
created_at: 2026-09-17T23:51:57.088Z
updated_at: 2026-09-18T00:53:34.969Z
closed_at: 2026-09-18T00:53:34.969Z
close_reason: "Fixed on claude/pr-review-lifecycle-and-delegation in ab3261a2 (B1 CI identity 8aaf70a8, A8 Windows paths ff7a3b5a). CI run 35292159287 success at ff7a3b5a. Disposition replies not posted: addressing agent has no ManagePullRequest and gh comment returns 403."
resolution: null
duplicate_of: null
---
Severity: Low. PR #309. Review: https://github.com/jlevy/tbd/pull/309#pullrequestreview-5242256965. File: packages/tbd/CHANGELOG.md:16-26. Upgrade note omits that 0.9.0 updates .tbd/config.yml before it stops. Fix: add discard-and-re-run sentence.
