---
type: is
id: is-01m2rwj40xc95hp5gty9qk5431
title: "PR #309 B2: fetch default branch before policy show; print SHA and age"
kind: bug
status: closed
priority: 2
version: 2
spec_path: docs/project/specs/active/plan-2026-09-16-pr-review-lifecycle-and-agent-delegation.md
labels: []
dependencies: []
parent_id: is-01m2rw9zzs69gde6ayhc8z6pwt
created_at: 2026-09-17T23:52:19.229Z
updated_at: 2026-09-18T00:53:34.974Z
closed_at: 2026-09-18T00:53:34.974Z
close_reason: "Fixed on claude/pr-review-lifecycle-and-delegation in ab3261a2 (B1 CI identity 8aaf70a8, A8 Windows paths ff7a3b5a). CI run 35292159287 success at ff7a3b5a. Disposition replies not posted: addressing agent has no ManagePullRequest and gh comment returns 403."
resolution: null
duplicate_of: null
---
Severity: Medium. PR #309. Review: https://github.com/jlevy/tbd/pull/309#pullrequestreview-5242339173. Files: agent-policy-grants.md:156-163; review-and-merge-prs.md:77-93,:210-215,:247-251; delegate-to-subagents.md:65-72; policy.ts:169; prime.ts:248. Grants are as of last fetch; tbd sync fetches only the sync branch. Fix: fetch default branch before tbd policy show in workflows; print source SHA and age.
