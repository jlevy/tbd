---
type: is
id: is-01m2r2n81yv3cy465ft8vm9d4k
title: "PR #306 A5: reject cycle-closing edges at write time in tbd dep add"
kind: feature
status: open
priority: 3
version: 4
delegate: claude-code@spud10
labels: []
dependencies: []
parent_id: is-01m2r2mnzqczgyy01sknncwtbq
hold: null
hold_until: null
created_at: 2026-09-17T16:19:38.683Z
updated_at: 2026-09-17T21:06:12.648Z
started_at: 2026-09-17T16:19:46.420Z
---
Suggestion, severity Low. PR #306, review https://github.com/jlevy/tbd/pull/306#pullrequestreview-5238509304. tbd dep add still writes edges that close a directed depends-on cycle. Precedent: checkParentAssignment in packages/tbd/src/cli/commands/update.ts refuses parent cycles at write time. Reuse findDependencyCycles (packages/tbd/src/lib/issue-dependency-graph.ts, added by PR #306) after the validate-all-then-apply step in packages/tbd/src/cli/commands/dep.ts to reject an edge that would close a cycle. Waits on PR #306 merging to main (the graph module it reuses lands there).
