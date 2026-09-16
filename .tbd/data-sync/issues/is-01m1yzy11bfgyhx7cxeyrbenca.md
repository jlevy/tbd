---
type: is
id: is-01m1yzy11bfgyhx7cxeyrbenca
title: Repo identity in every --json payload
kind: task
status: open
priority: 3
version: 4
spec_path: docs/project/specs/active/plan-2026-09-07-stability-sprint-spec-lifecycle-and-tracker-convergence.md
labels:
  - phase-4
dependencies: []
parent_id: is-01m1yzwqtnk81a6yg790yn4a9x
created_at: 2026-09-07T22:30:59.882Z
updated_at: 2026-09-16T08:27:50.253Z
extensions:
  linear:
    id: 78ee2ed1-28af-4a31-9605-7fe2935af9fc
    linked_at: 2026-09-16T08:27:50.253Z
---
GH #204 follow-on. list --json rows carry id and internalId but nothing names the repository, so an agent cannot assert which database it read or wrote. Decide the shape (an envelope changes the pinned array shape of list --json; a per-row field is repetitive) and apply consistently. Deferred until tbd-pjan and the status/doctor identity land.
