---
type: is
id: is-01m2rwj4c1khbd2z0p7dvsaq3c
title: "PR #309 B3: merging a policy-block change needs named user confirmation"
kind: bug
status: closed
priority: 2
version: 2
spec_path: docs/project/specs/active/plan-2026-09-16-pr-review-lifecycle-and-agent-delegation.md
labels: []
dependencies: []
parent_id: is-01m2rw9zzs69gde6ayhc8z6pwt
created_at: 2026-09-17T23:52:19.584Z
updated_at: 2026-09-18T00:53:34.976Z
closed_at: 2026-09-18T00:53:34.976Z
close_reason: "Fixed on claude/pr-review-lifecycle-and-delegation in ab3261a2 (B1 CI identity 8aaf70a8, A8 Windows paths ff7a3b5a). CI run 35292159287 success at ff7a3b5a. Disposition replies not posted: addressing agent has no ManagePullRequest and gh comment returns 403."
resolution: null
duplicate_of: null
---
Severity: Medium. PR #309. Review: https://github.com/jlevy/tbd/pull/309#pullrequestreview-5242339173. Files: review-and-merge-prs.md:210-252,:77-93; review-github-pr.md:124-140; setup-tbd.md:160-164; agent-policy-grants.md:185-190. A PR that changes the policy block becomes a standing grant on merge. Fix: gate condition requiring user confirmation of each changed policy by name; reviewers report policy-block changes as findings.
