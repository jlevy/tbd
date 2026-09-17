---
type: is
id: is-01m2r2n75qzn2jtt2vjg6c4z66
title: "PR #306 A4: document the cycle check in the design table and trim manual history prose"
kind: bug
status: closed
priority: 3
version: 3
delegate: claude-code@spud10
labels: []
dependencies: []
parent_id: is-01m2r2mnzqczgyy01sknncwtbq
hold: null
hold_until: null
created_at: 2026-09-17T16:19:37.779Z
updated_at: 2026-09-17T20:53:15.377Z
started_at: 2026-09-17T16:19:45.802Z
closed_at: 2026-09-17T20:53:15.375Z
close_reason: "Fixed in 88a4ddce5df96a612693e208d5bd3b03968b3a85: tbd-design.md gains a 'Dependency cycle | error | no' row in the schema and reference checks table; tbd-docs.md drops the 'earlier versions' history paragraph, keeps the arrow-semantics sentence, and states that a cycle is an error-level finding that exits nonzero. flowmark --check passes on both files."
resolution: null
duplicate_of: null
---
Severity Low. PR #306, review https://github.com/jlevy/tbd/pull/306#pullrequestreview-5238509304. packages/tbd/docs/tbd-design.md:4076-4084, packages/tbd/docs/tbd-docs.md:1015-1019. Add 'Dependency cycle | error | no' row; drop 'earlier versions' history from the manual and state that a cycle exits nonzero.
