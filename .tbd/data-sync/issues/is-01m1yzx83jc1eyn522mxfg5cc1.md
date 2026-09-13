---
type: is
id: is-01m1yzx83jc1eyn522mxfg5cc1
title: "Every slot round-trips: write slots through slotToLinear, compare in both vocabularies, never report an unresolved state push"
kind: bug
status: open
priority: 1
version: 6
spec_path: docs/project/specs/active/plan-2026-09-07-stability-sprint-spec-lifecycle-and-tracker-convergence.md
labels:
  - phase-1
dependencies:
  - type: blocks
    target: is-01m1yzx6mfhcc6px4p5xdnvxch
  - type: blocks
    target: is-01m2egwv3n7dkwa53568vrsgfc
  - type: blocks
    target: is-01m2egwz6r0qgbtvzh2nkevjdb
parent_id: is-01m1yzwqtnk81a6yg790yn4a9x
created_at: 2026-09-07T22:30:34.353Z
updated_at: 2026-09-13T23:18:37.675Z
---
GH #265 (the alternation) and the In Review drag. Plan 1a.

Confirmed from code: localViewOf computes backlog for an open, not-ready bead (sync-engine.ts:209-231; readyIssueIds excludes delegated, held, future-deferred, and open-blocker beads). The outbound path decomposes the slot back into bead fields (sync-engine.ts:781-785, decomposeSlot slots.ts:158-178), collapsing backlog and todo into open; statusToLinear maps open to unstarted (Todo); Todo reads back as todo (slotFromLinear). slotToLinear (mapping.ts:394) has no caller. Once the link record holds an exact slot the pair alternates pull/push forever while the column never moves. tie_break plays no part. In Review is pulled then pushed back as in_progress, which resolves to In Progress by name (mapping.ts:295-298): a one-time drag, not a loop. adapter.ts:1030-1032 sets stateId only if resolved, with no else, so an unresolvable state push counts as pushed.

Fix: CanonicalPatch carries the slot and the adapter writes it via slotToLinear (named state, else type default plus carrier label; backlog to Backlog, duplicate to the duplicate type). Before the matrix, project local through the team's write mapping and remote through the bead's decomposition; agreement in either projection means no write; the base records the agreed slot in the remote's terms. Unresolvable state is a skipped field with a reason (excluded under 1b). Correct state-model spec line 551 (at PR #283's head) which marks band-level refinement comparison done.

Tests, red first: open epic blocked by an open bead synced five times, runs 3-5 quiet; In Review stays over four runs; team with only Doing and In Review started states reports a skipped field; pure property test that slotFromLinear(write(slot)) returns the slot or a declared tolerated one for a default team and a team with no optional states (tests/slots.test.ts:105-118 passes the refinement back in, which production never does); Paused settles after one pull (guard).
