---
type: is
id: is-01m2rwj5s3rfhk7sra85da5x36
title: "PR #309 B7: treat plausible grant-line variants as malformed not ignored"
kind: bug
status: open
priority: 3
version: 1
spec_path: docs/project/specs/active/plan-2026-09-16-pr-review-lifecycle-and-agent-delegation.md
labels: []
dependencies: []
parent_id: is-01m2rw9zzs69gde6ayhc8z6pwt
created_at: 2026-09-17T23:52:21.027Z
updated_at: 2026-09-17T23:52:21.027Z
---
Severity: Low. PR #309. Review: https://github.com/jlevy/tbd/pull/309#pullrequestreview-5242339173. Files: policy-grants.ts:384-385 GRANT_LINE_CANDIDATE; agent-policy-grants.md:243-246,:256-260. Lines like '* `github-merge`: not-granted' or bold names are silently ignored. Fix: widen candidate to any list-marker line whose text begins with a backtick or contains a backticked known policy name followed by a colon.
