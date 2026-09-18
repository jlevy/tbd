---
type: is
id: is-01m2rwj52p891kxg846ptwgvhx
title: "PR #309 B5: policy-block prose must say only the default-branch copy is in effect"
kind: bug
status: closed
priority: 2
version: 2
spec_path: docs/project/specs/active/plan-2026-09-16-pr-review-lifecycle-and-agent-delegation.md
labels: []
dependencies: []
parent_id: is-01m2rw9zzs69gde6ayhc8z6pwt
created_at: 2026-09-17T23:52:20.310Z
updated_at: 2026-09-18T00:53:34.980Z
closed_at: 2026-09-18T00:53:34.980Z
close_reason: "Fixed on claude/pr-review-lifecycle-and-delegation in ab3261a2 (B1 CI identity 8aaf70a8, A8 Windows paths ff7a3b5a). CI run 35292159287 success at ff7a3b5a. Disposition replies not posted: addressing agent has no ManagePullRequest and gh comment returns 403."
resolution: null
duplicate_of: null
---
Severity: Medium. PR #309. Review: https://github.com/jlevy/tbd/pull/309#pullrequestreview-5242339173. Files: policy-grants.ts:311-313 POLICY_BLOCK_PROSE; agent-policy-grants.md:216-218,:239-242; delegate-to-subagents.md:82-83. Fixed prose asserts consent in whatever copy an agent reads. Fix: add that only the default-branch copy is in effect; a branch/working-tree copy is a proposal.
