---
type: is
id: is-01m1yzy11bfgyhx7cxeyrbenca
title: Repo identity in every --json payload
kind: task
status: open
priority: 3
version: 2
spec_path: docs/project/specs/active/plan-2026-09-07-stability-sprint-spec-lifecycle-and-tracker-convergence.md
labels:
  - phase-4
dependencies: []
parent_id: is-01m1yzwqtnk81a6yg790yn4a9x
created_at: 2026-09-07T22:30:59.882Z
updated_at: 2026-09-07T22:31:45.686Z
---
GH #204 follow-on. list --json rows carry id and internalId but nothing names the repository, so an agent cannot assert which database it read or wrote. Decide the shape (an envelope changes the pinned array shape of list --json; a per-row field is repetitive) and apply consistently. Deferred until tbd-pjan and the status/doctor identity land.
