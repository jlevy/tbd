---
type: is
id: is-01m2rwj5dt86da4q2aeftzb871
title: "PR #309 B6: stack merge under per-request must name every layer"
kind: bug
status: closed
priority: 3
version: 2
spec_path: docs/project/specs/active/plan-2026-09-16-pr-review-lifecycle-and-agent-delegation.md
labels: []
dependencies: []
parent_id: is-01m2rw9zzs69gde6ayhc8z6pwt
created_at: 2026-09-17T23:52:20.666Z
updated_at: 2026-09-18T00:53:34.981Z
closed_at: 2026-09-18T00:53:34.981Z
close_reason: "Fixed on claude/pr-review-lifecycle-and-delegation in ab3261a2 (B1 CI identity 8aaf70a8, A8 Windows paths ff7a3b5a). CI run 35292159287 success at ff7a3b5a. Disposition replies not posted: addressing agent has no ManagePullRequest and gh comment returns 403."
resolution: null
duplicate_of: null
---
Severity: Low. PR #309. Review: https://github.com/jlevy/tbd/pull/309#pullrequestreview-5242339173. Files: review-and-merge-prs.md:247-251,:271-273; stacked-prs.md:165-174. gh stack merge includes unmerged layers below. Fix: one sentence in step 6: under per-request the request must name or the user confirm every layer.
