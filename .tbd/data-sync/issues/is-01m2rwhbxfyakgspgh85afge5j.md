---
type: is
id: is-01m2rwhbxfyakgspgh85afge5j
title: "PR #309 A3: missing gh stack must mean not tracked locally"
kind: bug
status: open
priority: 2
version: 1
spec_path: docs/project/specs/active/plan-2026-09-16-pr-review-lifecycle-and-agent-delegation.md
labels: []
dependencies: []
parent_id: is-01m2rw9zzs69gde6ayhc8z6pwt
created_at: 2026-09-17T23:51:54.542Z
updated_at: 2026-09-17T23:51:54.542Z
---
Severity: Medium. PR #309. Review: https://github.com/jlevy/tbd/pull/309#pullrequestreview-5242256965. Files: address-pr-review.md:110-115; review-and-merge-prs.md:112-114; merge-upstream.md:28-32. Missing gh stack currently stops the addressing agent. Fix: apply create-or-update-pr-simple wording: missing gh stack means not tracked locally; continue to the remote check.
