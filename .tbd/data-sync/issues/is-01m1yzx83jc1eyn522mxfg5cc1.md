---
type: is
id: is-01m1yzx83jc1eyn522mxfg5cc1
title: "Slot alternation: same-band refinement agreement; unresolvable state push is a skipped push, never a silent success"
kind: bug
status: open
priority: 1
version: 2
spec_path: docs/project/specs/active/plan-2026-09-07-stability-sprint-spec-lifecycle-and-tracker-convergence.md
labels:
  - phase-1
dependencies: []
parent_id: is-01m1yzwqtnk81a6yg790yn4a9x
created_at: 2026-09-07T22:30:34.353Z
updated_at: 2026-09-07T22:31:40.852Z
---
GH #265 remainder (tbd-u9eg). Confirmed from code: computeSlot has one caller (localViewOf, sync-engine.ts:209-231) and never receives a refinement; the pull path discards the decomposed refinement (:745-751 applies status/hold/resolution only). For a pair whose Linear column is In Review (slotFromLinear, mapping.ts:365-367), once the link record carries an exact slot: run n pulls in_review (bead written, base := in_review), run n+1 recomputes in_progress and pushes it back. The refinement replay (:795-801) fires only when the recorded refinement slot equals the outbound slot, which can only ever be in_progress. tie_break newest then alternates the winner every run. The loop is permanent when the state push is a silent no-op: adapter.ts:1030-1032 sets input.stateId only if (stateId), no else, and stateIdsByType[type] is unset for an ambiguous type (adapter.ts:796-803). Fix: (1) in the matrix, same-band slots agree when the local side cannot express the remote refinement; the bead is written only when the band changes; the refinement is still recorded for replay. (2) an unresolvable state is a skipped field push with a reason, classified excluded. Tests: extend tests/integrations-sync-engine.test.ts:938-964 to a third run after the record carries an exact slot; a slots round-trip test without passing refinement back in (tests/slots.test.ts:105-118 passes it, which production never does). Needs the mock stateId fix from the stability branch.
