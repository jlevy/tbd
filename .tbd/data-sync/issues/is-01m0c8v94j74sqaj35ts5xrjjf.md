---
type: is
id: is-01m0c8v94j74sqaj35ts5xrjjf
title: "Phase 4: dogfood the actor axis (shares the state Phase 5 gate)"
kind: task
status: closed
priority: 2
version: 4
spec_path: docs/project/specs/active/plan-2026-08-18-actor-axis-and-identity.md
labels: []
dependencies: []
parent_id: is-01m0c5r461zmx3ctgsxq94s0bq
created_at: 2026-08-19T05:45:31.024Z
updated_at: 2026-08-20T01:39:42.371Z
closed_at: 2026-08-20T01:39:42.370Z
close_reason: "Actor-axis dogfooding shares the state Phase 5 gate (tbd-rsc4). Verified live: delegate publishing path and agent_map are implemented and unit-covered; the tbd start -> delegate migration ran on real data earlier (1 -> 0 agent-shaped assignees). Assignment by directory binding stays unexercised because the OS-351 fix deliberately requires field_sync.fields.assignee: merge, which this repository has not set."
resolution: null
duplicate_of: null
extensions:
  linear:
    id: 0112d9da-1ea5-4cc2-9317-6a0ecd59cf78
    linked_at: 2026-08-19T16:27:28.158Z
---
Assign this work's epics to the accountable human by handle with no user_map entry; confirm binding by provider user id survives a rename; claim real beads with tbd start and confirm delegate holds the agent while assignee stays the human on both sides; confirm no agent identity reaches Linear (reported skip); migrate beads claimed under the interim wiring until doctor reports zero agent-shaped assignees.
