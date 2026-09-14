---
type: is
id: is-01ktycs6m682c7bc9ha6cpwc22
title: "Review/F2+F4: abort-recipe docs — committed forks reopen the gate; concurrent writers undo abort"
kind: bug
status: closed
priority: 2
version: 4
spec_path: docs/project/specs/done/plan-2026-06-11-forkable-docs.md
labels: []
dependencies: []
parent_id: is-01ktxg3eqj62dhphs6dnbb30jf
created_at: 2026-06-12T17:06:26.053Z
updated_at: 2026-09-14T04:20:36.670Z
closed_at: 2026-06-12T17:45:37.156Z
close_reason: "Fixed in 6b4d266 (tbd-docs.md abort recipe): added the 'quiesce other tbd processes' note (a concurrent write re-stamps layout and can undo an abort; revert config before deleting the stamp), and clarified reverting config alone drops the format gate even with committed forks (F2)."
---
