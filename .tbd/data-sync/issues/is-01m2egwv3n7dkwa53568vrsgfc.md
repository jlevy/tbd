---
type: is
id: is-01m2egwv3n7dkwa53568vrsgfc
title: Engine create path drops resolution and hold and skips the assignee merge gate
kind: bug
status: open
priority: 1
version: 4
spec_path: docs/project/specs/active/plan-2026-09-07-stability-sprint-spec-lifecycle-and-tracker-convergence.md
labels:
  - phase-1
dependencies: []
parent_id: is-01m1yzwqtnk81a6yg790yn4a9x
created_at: 2026-09-13T23:16:03.314Z
updated_at: 2026-09-16T08:28:01.462Z
extensions:
  linear:
    id: 11b14cdc-5e88-4dc2-a658-0280673e8eb1
    linked_at: 2026-09-16T08:28:01.462Z
---
Engine create path (sync-engine.ts:1527-1551) sends status without resolution or hold, so a canceled bead is created in Linear as Done and a held open bead lands in Todo; the next runs then pull or push to repair it. It also gates assignee on adapter.canPushAssignee only, without the field_sync.fields.assignee === 'merge' check the pair path applies (sync-engine.ts:730-738), which reopens the OS-351 leak for newly created items.

Fix with plan 1a: the create call writes the slot through slotToLinear (resolution and hold ride along) and applies the merge gate. Red first: create a closed/canceled bead and a held bead outbound; assert Canceled and Backlog on create and a quiet second run; with assignee: local, assert no assignee is sent on create.

f08 compatibility review 2026-09-14 (see 'f08 Compatibility Contract for Sprint Fixes' in the stability sprint plan): journaled create_issue patches must always carry status, resolution, and hold alongside slot, never slot alone; 0.8.1 replay ignores slot (intents.ts:30-40 keeps unknown patch keys) and 0.7.0 replay drops resolution and hold.
