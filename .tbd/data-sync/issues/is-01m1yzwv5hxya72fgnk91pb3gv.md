---
type: is
id: is-01m1yzwv5hxya72fgnk91pb3gv
title: "Confirm the #265 mechanism on the reporter's mirror: the 13 pairs are linked open beads without a hold that tbd ready omits"
kind: task
status: open
priority: 1
version: 3
spec_path: docs/project/specs/active/plan-2026-09-07-stability-sprint-spec-lifecycle-and-tracker-convergence.md
labels:
  - phase-0
dependencies: []
parent_id: is-01m1yzwqtnk81a6yg790yn4a9x
created_at: 2026-09-07T22:30:21.103Z
updated_at: 2026-09-13T23:17:24.796Z
---
Human step (private data), no new build needed. List the linked open beads without a hold that `tbd ready` omits and confirm they are exactly the 13 alternating pairs and sit in Linear's Todo column. After tbd-bdkj lands, `tbd --dry-run integration sync --explain` should show status flipping between backlog and todo on those pairs. Record the result on tbd-u9eg. If the pairs are something else, file a new bead with a reproduction; tbd-od0z stands on its own code evidence.
