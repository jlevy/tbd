---
type: is
id: is-01m2rwj4c1khbd2z0p7dvsaq3c
title: "PR #309 B3: merging a policy-block change needs named user confirmation"
kind: bug
status: open
priority: 2
version: 1
spec_path: docs/project/specs/active/plan-2026-09-16-pr-review-lifecycle-and-agent-delegation.md
labels: []
dependencies: []
parent_id: is-01m2rw9zzs69gde6ayhc8z6pwt
created_at: 2026-09-17T23:52:19.584Z
updated_at: 2026-09-17T23:52:19.584Z
---
Severity: Medium. PR #309. Review: https://github.com/jlevy/tbd/pull/309#pullrequestreview-5242339173. Files: review-and-merge-prs.md:210-252,:77-93; review-github-pr.md:124-140; setup-tbd.md:160-164; agent-policy-grants.md:185-190. A PR that changes the policy block becomes a standing grant on merge. Fix: gate condition requiring user confirmation of each changed policy by name; reviewers report policy-block changes as findings.
