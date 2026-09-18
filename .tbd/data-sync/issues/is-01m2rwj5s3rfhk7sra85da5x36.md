---
type: is
id: is-01m2rwj5s3rfhk7sra85da5x36
title: "PR #309 B7: treat plausible grant-line variants as malformed not ignored"
kind: bug
status: closed
priority: 3
version: 2
spec_path: docs/project/specs/active/plan-2026-09-16-pr-review-lifecycle-and-agent-delegation.md
labels: []
dependencies: []
parent_id: is-01m2rw9zzs69gde6ayhc8z6pwt
created_at: 2026-09-17T23:52:21.027Z
updated_at: 2026-09-18T00:53:34.983Z
closed_at: 2026-09-18T00:53:34.983Z
close_reason: "Fixed on claude/pr-review-lifecycle-and-delegation in ab3261a2 (B1 CI identity 8aaf70a8, A8 Windows paths ff7a3b5a). CI run 35292159287 success at ff7a3b5a. Disposition replies not posted: addressing agent has no ManagePullRequest and gh comment returns 403."
resolution: null
duplicate_of: null
---
Severity: Low. PR #309. Review: https://github.com/jlevy/tbd/pull/309#pullrequestreview-5242339173. Files: policy-grants.ts:384-385 GRANT_LINE_CANDIDATE; agent-policy-grants.md:243-246,:256-260. Lines like '* `github-merge`: not-granted' or bold names are silently ignored. Fix: widen candidate to any list-marker line whose text begins with a backtick or contains a backticked known policy name followed by a colon.
