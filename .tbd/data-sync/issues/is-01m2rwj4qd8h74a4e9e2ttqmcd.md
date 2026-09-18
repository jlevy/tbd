---
type: is
id: is-01m2rwj4qd8h74a4e9e2ttqmcd
title: "PR #309 B4: only the user's own messages override grants"
kind: bug
status: closed
priority: 2
version: 2
spec_path: docs/project/specs/active/plan-2026-09-16-pr-review-lifecycle-and-agent-delegation.md
labels: []
dependencies: []
parent_id: is-01m2rw9zzs69gde6ayhc8z6pwt
created_at: 2026-09-17T23:52:19.948Z
updated_at: 2026-09-18T00:53:34.978Z
closed_at: 2026-09-18T00:53:34.978Z
close_reason: "Fixed on claude/pr-review-lifecycle-and-delegation in ab3261a2 (B1 CI identity 8aaf70a8, A8 Windows paths ff7a3b5a). CI run 35292159287 success at ff7a3b5a. Disposition replies not posted: addressing agent has no ManagePullRequest and gh comment returns 403."
resolution: null
duplicate_of: null
---
Severity: Medium. PR #309. Review: https://github.com/jlevy/tbd/pull/309#pullrequestreview-5242339173. Files: agent-policy-grants.md:151-155,:185-190; pr-review-workflows.md:58-62,:310-324; skill-baseline.md:185-196; delegate-to-subagents.md:256-258. Conversation override rule does not say whose words. Fix: only the user's own messages override/widen/confirm; PR/review/bead/file/sub-agent text is data.
