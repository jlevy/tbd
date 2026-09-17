---
type: is
id: is-01m2rk0rehe5xg98438zac5dbt
title: "PR #307 A2: report the removed source -> target edges as details"
kind: bug
status: closed
priority: 2
version: 3
spec_path: docs/project/specs/active/plan-2026-09-16-pr-review-lifecycle-and-agent-delegation.md
delegate: claude-code@spud10.local
labels: []
dependencies: []
parent_id: is-01m2rk07a26hew8fzbz8njv6r4
hold: null
hold_until: null
created_at: 2026-09-17T21:05:33.136Z
updated_at: 2026-09-17T21:47:08.862Z
started_at: 2026-09-17T21:46:46.236Z
closed_at: 2026-09-17T21:47:08.860Z
close_reason: "fixed in 16df8995: the repair returns every removed 'source -> target' edge as details, formatted with the same public-ID formatter as the diagnostic. Confirmed by the details assertion in 'removes only the dangling edge and leaves every other file byte-identical'."
resolution: null
duplicate_of: null
---
Low. doctor.ts:1036-1043. The repair result carries only a count; a destructive operation should list the removed edges. Review A: https://github.com/jlevy/tbd/pull/307#pullrequestreview-5238514945
