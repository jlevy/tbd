---
type: is
id: is-01m2rwj64dk5q8gmcr92fq1r5a
title: "PR #309 B8: cap and sanitize unknown policy values in prime output"
kind: bug
status: closed
priority: 3
version: 2
spec_path: docs/project/specs/active/plan-2026-09-16-pr-review-lifecycle-and-agent-delegation.md
labels: []
dependencies: []
parent_id: is-01m2rw9zzs69gde6ayhc8z6pwt
created_at: 2026-09-17T23:52:21.389Z
updated_at: 2026-09-18T00:53:34.984Z
closed_at: 2026-09-18T00:53:34.984Z
close_reason: "Fixed on claude/pr-review-lifecycle-and-delegation in ab3261a2 (B1 CI identity 8aaf70a8, A8 Windows paths ff7a3b5a). CI run 35292159287 success at ff7a3b5a. Disposition replies not posted: addressing agent has no ManagePullRequest and gh comment returns 403."
resolution: null
duplicate_of: null
---
Severity: Low (suggestion). PR #309. Review: https://github.com/jlevy/tbd/pull/309#pullrequestreview-5242339173. Files: prime.ts:202-210; policy.ts:234-244. Unknown policy values are free text printed verbatim into the hook output. Fix: cap at about 60 characters and strip control characters.
