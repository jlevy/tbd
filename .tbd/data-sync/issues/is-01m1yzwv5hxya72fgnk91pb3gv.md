---
type: is
id: is-01m1yzwv5hxya72fgnk91pb3gv
title: "Confirm the #265 mechanism on the reporter's mirror: the 13 pairs are linked open beads without a hold that tbd ready omits"
kind: task
status: open
priority: 1
version: 6
spec_path: docs/project/specs/active/plan-2026-09-07-stability-sprint-spec-lifecycle-and-tracker-convergence.md
labels:
  - phase-0
dependencies: []
parent_id: is-01m1yzwqtnk81a6yg790yn4a9x
created_at: 2026-09-07T22:30:21.103Z
updated_at: 2026-09-16T08:24:08.550Z
extensions:
  linear:
    id: daba69bb-ef76-4d03-b7d8-eb8e5e8317f6
    linked_at: 2026-09-16T08:24:08.550Z
---
Human step (private data), no new build needed. List the linked open beads without a hold that `tbd ready` omits and confirm they are exactly the 13 alternating pairs and sit in Linear's Todo column. After tbd-bdkj lands, `tbd --dry-run integration sync --explain` should show status flipping between backlog and todo on those pairs. Record the result on tbd-u9eg. If the pairs are something else, file a new bead with a reproduction; tbd-od0z stands on its own code evidence.

## Notes

Partial read-only audit 2026-09-15 UTC with PR #290 candidate e505682b before the final #288 merge: dry-run reported pushedCount=34, pulledCount=0, createdCount=94, conflictCount=0, failureCount=0, skippedPushCount=0. This does not identify the historical 13 pairs because the mirror currently has 128 unrelated proposed provider mutations, and this candidate has no --explain option. No real sync was run. Keep this bead open for a controlled reporter-mirror confirmation.
