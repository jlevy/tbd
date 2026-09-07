---
type: is
id: is-01m1yzwv5hxya72fgnk91pb3gv
title: "Run integration sync --explain on the #265 mirror and record the named field on tbd-u9eg"
kind: task
status: open
priority: 1
version: 2
spec_path: docs/project/specs/active/plan-2026-09-07-stability-sprint-spec-lifecycle-and-tracker-convergence.md
labels:
  - phase-0
dependencies: []
parent_id: is-01m1yzwqtnk81a6yg790yn4a9x
created_at: 2026-09-07T22:30:21.103Z
updated_at: 2026-09-07T22:31:39.129Z
---
Human step; the data is private. Run tbd --dry-run integration sync --explain on the mirror from GH #265. Expected answer per the plan's root cause 4: field slot, on pairs whose Linear column is a refinement (In Review, Draft) or whose state type is ambiguous on the team; tbd integration setup prints ambiguous types (integration.ts:261-269). A --verbose --json dry run shows whether the same ids carry a slot patch in pushed on one run and appear in pulled on the next. Record the result on tbd-u9eg; if it is labels (tbd-vpje) or an unmapped assignee, the exclusion contract ends the loop; anything else is a new bead with a reproduction.
