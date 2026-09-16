---
type: is
id: is-01m1yzx83jc1eyn522mxfg5cc1
title: "Every slot round-trips: write slots through slotToLinear, compare in both vocabularies, never report an unresolved state push"
kind: bug
status: in_progress
priority: 1
version: 13
spec_path: docs/project/specs/active/plan-2026-09-07-stability-sprint-spec-lifecycle-and-tracker-convergence.md
delegate: claude-code@spud10.local
labels:
  - phase-1
dependencies:
  - type: blocks
    target: is-01m1yzx6mfhcc6px4p5xdnvxch
  - type: blocks
    target: is-01m2egwv3n7dkwa53568vrsgfc
  - type: blocks
    target: is-01m2egwz6r0qgbtvzh2nkevjdb
  - type: blocks
    target: is-01m2eseh97vth3cpm35m074faf
parent_id: is-01m1yzwqtnk81a6yg790yn4a9x
hold: null
hold_until: null
created_at: 2026-09-07T22:30:34.353Z
updated_at: 2026-09-16T08:27:26.861Z
started_at: 2026-09-16T07:18:41.338Z
extensions:
  linear:
    id: 2f970134-325e-47da-8b11-920305d0fcaa
    linked_at: 2026-09-16T08:27:26.861Z
---
GH #265 (the alternation) and the In Review drag. Plan 1a.

Confirmed from code: localViewOf computes backlog for an open, not-ready bead (sync-engine.ts:209-231; readyIssueIds excludes delegated, held, future-deferred, and open-blocker beads). The outbound path decomposes the slot back into bead fields (sync-engine.ts:781-785, decomposeSlot slots.ts:158-178), collapsing backlog and todo into open; statusToLinear maps open to unstarted (Todo); Todo reads back as todo (slotFromLinear). slotToLinear (mapping.ts:394) has no caller. Once the link record holds an exact slot the pair alternates pull/push forever while the column never moves. tie_break plays no part. In Review is pulled then pushed back as in_progress, which resolves to In Progress by name (mapping.ts:295-298): a one-time drag, not a loop. adapter.ts:1030-1032 sets stateId only if resolved, with no else, so an unresolvable state push counts as pushed.

Fix: CanonicalPatch carries the slot and the adapter writes it via slotToLinear (named state, else type default plus carrier label; backlog to Backlog, duplicate to the duplicate type). Before the matrix, project local through the team's write mapping and remote through the bead's decomposition; agreement in either projection means no write; the base records the agreed slot in the remote's terms. Unresolvable state is a skipped field with a reason (excluded under 1b). Correct state-model spec line 551 (at PR #283's head) which marks band-level refinement comparison done.

Tests, red first: open epic blocked by an open bead synced five times, runs 3-5 quiet; In Review stays over four runs; team with only Doing and In Review started states reports a skipped field; pure property test that slotFromLinear(write(slot)) returns the slot or a declared tolerated one for a default team and a team with no optional states (tests/slots.test.ts:105-118 passes the refinement back in, which production never does); Paused settles after one pull (guard).

f08 compatibility review 2026-09-14 (see 'f08 Compatibility Contract for Sprint Fixes' in the stability sprint plan): DESIGN CHANGE. Keep base.slot in the local vocabulary and do the two-vocabulary comparison in memory only; 0.8.1 compares base.slot exactly (reconcile.ts:262-265, slots.ts:242), so a base stored in remote terms makes a 0.8.x teammate push every run. If a remote-form value must persist, add an optional field whose absence means derive (old clients drop undeclared fields: BridgeBaseSchema/LinkRecordSchema are not passthrough, and 0.7.0 already drops slot and refinement_*). Readiness differs across versions (main treats a future deferred_until as not ready, 0.8.1 does not) and 0.8.x --push writes Todo, so the Backlog write can ping-pong with 0.8.x clients: gated by tbd-s4kb (T3); if T3 cannot converge, Release 1 states a minimum version for every clone that runs integration sync, or the Backlog write is opt-in.

## Notes

2026-09-15 release-readiness review of main @ 1238038e: partial. #290 (044d0624, 0da306d5) writes the slot on update and create and suppresses no-op bead rewrites. Still open: comparing in both vocabularies, reporting a skipped field when the target state does not resolve, and the In Review drag (localViewOf passes no refinement; the only test stops at run 2).

Unresolvable Backlog keeps a half-hidden loop: on a team with no backlog-type state, or several with no state_map, adapter.ts ~:1045 has no else branch, ambiguity is reported only by `integration status` (integration.ts ~:262), the pull half is left out of the report (sync-engine.ts ~:1078), yet the base advances and the runner commits (integration-runner.ts ~:689-693). Syncs alternate between "nothing to do" plus a commit and "push 1". Code verified, sequence inferred.

Mixed-version and --push contention introduced by #290 are tracked on tbd-s4kb and tbd-evn3. Remains a Release 1 gate for Linear users.

2026-09-15, from the independent review of PR #293 (inferred by reading, not run): the reconciler likely moves an In Review or Draft item back out on the second full sync after it pulls that column. A pull sets `merged.slot` to the refinement (`reconcile.ts` ~:320-322), and the base is written from it (`sync-engine.ts` ~:1515). But `localViewOf` never passes a refinement, so the next run sees local `in_progress` (or `backlog`/`todo`) differing from base `in_review` (or `draft`) with the remote unchanged, and pushes the computed slot. The `refinement_state_id` replay needs `refinement_slot` to equal the pushed slot, so it does not apply. `integrations-sync-engine.test.ts` ~:938 runs only one sync after the move; a test that runs several syncs would confirm or clear this.
