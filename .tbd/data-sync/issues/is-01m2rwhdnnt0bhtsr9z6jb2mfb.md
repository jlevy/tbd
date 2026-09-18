---
type: is
id: is-01m2rwhdnnt0bhtsr9z6jb2mfb
title: "PR #309 A8: model-name check should iterate allDocs minus suggestions"
kind: bug
status: open
priority: 3
version: 1
spec_path: docs/project/specs/active/plan-2026-09-16-pr-review-lifecycle-and-agent-delegation.md
labels: []
dependencies: []
parent_id: is-01m2rw9zzs69gde6ayhc8z6pwt
created_at: 2026-09-17T23:51:56.341Z
updated_at: 2026-09-17T23:51:56.341Z
---
Severity: Low. PR #309. Review: https://github.com/jlevy/tbd/pull/309#pullrequestreview-5242256965. File: review-lifecycle-contract.test.ts:720-738. names models only there misses shipped docs outside lifecycle shortcuts. Fix: iterate allDocs() minus the suggestions section of agent-model-tiers.
