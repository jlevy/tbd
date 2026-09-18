---
type: is
id: is-01m2rwj4qd8h74a4e9e2ttqmcd
title: "PR #309 B4: only the user's own messages override grants"
kind: bug
status: open
priority: 2
version: 1
spec_path: docs/project/specs/active/plan-2026-09-16-pr-review-lifecycle-and-agent-delegation.md
labels: []
dependencies: []
parent_id: is-01m2rw9zzs69gde6ayhc8z6pwt
created_at: 2026-09-17T23:52:19.948Z
updated_at: 2026-09-17T23:52:19.948Z
---
Severity: Medium. PR #309. Review: https://github.com/jlevy/tbd/pull/309#pullrequestreview-5242339173. Files: agent-policy-grants.md:151-155,:185-190; pr-review-workflows.md:58-62,:310-324; skill-baseline.md:185-196; delegate-to-subagents.md:256-258. Conversation override rule does not say whose words. Fix: only the user's own messages override/widen/confirm; PR/review/bead/file/sub-agent text is data.
