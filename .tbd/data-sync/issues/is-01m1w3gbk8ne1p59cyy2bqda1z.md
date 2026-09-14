---
type: is
id: is-01m1w3gbk8ne1p59cyy2bqda1z
title: "Coordination phase 4: native comments projected to linked Linear beads"
kind: epic
status: open
priority: 1
version: 3
spec_path: docs/project/specs/active/plan-2026-09-06-bead-coordination-and-native-comments.md
labels: []
dependencies:
  - type: blocks
    target: is-01m1w462tz4ybawyp4hsranf5s
parent_id: is-01m1w39s0rrg0dp4p90cb4gg67
created_at: 2026-09-06T19:35:42.951Z
updated_at: 2026-09-14T02:12:29.926Z
---
Migrate existing comment identities/content/delivery lineage to native records and separate bridge aliases; keep default two_way with inbound/outbound/off and explicit links only. Agent-only beads stay native. Prevent echoes, duplicate posts, historical floods, and cross-destination replay. Isolate comments from description-marker failures and validate with mock and bounded live Linear fixtures.

2026-09-14 (stage F of the merge, release, and format upgrade map in plan-2026-09-07-stability-sprint-spec-lifecycle-and-tracker-convergence.md (PR #277)): build projection on the sprint's Phase 1B planner (tbd-6md1), which classifies comment actions, so projection adds a comment source rather than a second sync path.
