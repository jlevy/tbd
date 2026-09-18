---
type: is
id: is-01m2rwhbj2yckqabjqqmve9r9v
title: "PR #309 A2: unmarked inline comments need a disposition path"
kind: bug
status: open
priority: 2
version: 1
spec_path: docs/project/specs/active/plan-2026-09-16-pr-review-lifecycle-and-agent-delegation.md
labels: []
dependencies: []
parent_id: is-01m2rw9zzs69gde6ayhc8z6pwt
created_at: 2026-09-17T23:51:54.178Z
updated_at: 2026-09-17T23:51:54.178Z
---
Severity: Medium. PR #309. Review: https://github.com/jlevy/tbd/pull/309#pullrequestreview-5242256965. Files: address-pr-review.md:37-61, :195-241; pr-review-workflows.md:251-264. Unmarked inline comments have no defined path to a disposition, and the sweep runs once before fix commits. Fix: Discovery Sweep treats problem-reporting inline comments as findings; re-sweep after CI; merge-gate verification.
