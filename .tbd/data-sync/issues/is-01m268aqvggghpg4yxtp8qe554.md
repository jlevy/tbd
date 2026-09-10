---
type: is
id: is-01m268aqvggghpg4yxtp8qe554
title: Enforce declared immutable issue fields during one-sided merges
kind: bug
status: open
priority: 1
version: 2
spec_path: docs/project/specs/active/plan-2026-09-06-bead-coordination-and-native-comments.md
labels: []
dependencies: []
parent_id: is-01m1w3g0smx3ezvwz4g8mkmjy9
created_at: 2026-09-10T18:12:26.092Z
updated_at: 2026-09-10T18:12:34.066Z
---
The main-design audit found that FIELD_STRATEGIES names type/id/created_at/created_by immutable, but mergeIssues' common one-side-changed fast path accepts a mutation before dispatching on the strategy. Decide the intended compatibility rule, enforce it before activation-sensitive work, and add focused merge tests.
