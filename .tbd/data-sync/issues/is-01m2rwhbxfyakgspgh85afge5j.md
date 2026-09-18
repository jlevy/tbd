---
type: is
id: is-01m2rwhbxfyakgspgh85afge5j
title: "PR #309 A3: missing gh stack must mean not tracked locally"
kind: bug
status: closed
priority: 2
version: 2
spec_path: docs/project/specs/active/plan-2026-09-16-pr-review-lifecycle-and-agent-delegation.md
labels: []
dependencies: []
parent_id: is-01m2rw9zzs69gde6ayhc8z6pwt
created_at: 2026-09-17T23:51:54.542Z
updated_at: 2026-09-18T00:53:34.957Z
closed_at: 2026-09-18T00:53:34.957Z
close_reason: "Fixed on claude/pr-review-lifecycle-and-delegation in ab3261a2 (B1 CI identity 8aaf70a8, A8 Windows paths ff7a3b5a). CI run 35292159287 success at ff7a3b5a. Disposition replies not posted: addressing agent has no ManagePullRequest and gh comment returns 403."
resolution: null
duplicate_of: null
---
Severity: Medium. PR #309. Review: https://github.com/jlevy/tbd/pull/309#pullrequestreview-5242256965. Files: address-pr-review.md:110-115; review-and-merge-prs.md:112-114; merge-upstream.md:28-32. Missing gh stack currently stops the addressing agent. Fix: apply create-or-update-pr-simple wording: missing gh stack means not tracked locally; continue to the remote check.
