---
type: is
id: is-01m2rwhe0wswngpyneqk7kb4w6
title: "PR #309 A9: tableRows switch needs exhaustive never default"
kind: bug
status: open
priority: 3
version: 1
spec_path: docs/project/specs/active/plan-2026-09-16-pr-review-lifecycle-and-agent-delegation.md
labels: []
dependencies: []
parent_id: is-01m2rw9zzs69gde6ayhc8z6pwt
created_at: 2026-09-17T23:51:56.700Z
updated_at: 2026-09-17T23:51:56.700Z
---
Severity: Low. PR #309. Review: https://github.com/jlevy/tbd/pull/309#pullrequestreview-5242256965. File: packages/tbd/scripts/readme-reference-tables.ts:241-250. tableRows switches on ReferenceKind without never default. Fix: default exhaustive throw.
