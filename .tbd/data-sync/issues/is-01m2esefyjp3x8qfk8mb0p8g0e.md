---
type: is
id: is-01m2esefyjp3x8qfk8mb0p8g0e
title: "PR #279 test gaps: sync and merge-refs paths with differing link lineage, conflict destination, third-party namespace"
kind: task
status: open
priority: 2
version: 3
spec_path: docs/project/specs/active/plan-2026-09-06-bead-coordination-and-native-comments.md
labels: []
dependencies:
  - type: blocks
    target: is-01m2erphvafq7s0t4fa4q7enpa
  - type: blocks
    target: is-01m2eseh97vth3cpm35m074faf
parent_id: is-01m1w3d1e63qg5e2wpz31qkmvn
created_at: 2026-09-14T01:45:30.321Z
updated_at: 2026-09-14T02:42:44.735Z
---
Test gaps in PR #279 (tbd-8rnq), found in the release-compatibility review: the four mergeIssues unit tests (tests/integrations-comments.test.ts:190-291) and the workspace/outbox tests cover the postcondition directly, but nothing exercises it through the paths users run:
- mergeBeadAcrossRefs / `tbd sync` with provider comments and differing link lineage (tests/merge-refs.test.ts and rescue-*.test.ts have no comment cases);
- where a sync conflict's losing namespace ends up (depends on tbd sync attic decision);
- a third-party namespace with a comments array (see the scoping bug).
Add a two-clone e2e: clone A relinks X to Y, clone B adds a pending comment on X, both sync; assert the comment is not delivered to Y and the loser is recoverable where the docs say.
