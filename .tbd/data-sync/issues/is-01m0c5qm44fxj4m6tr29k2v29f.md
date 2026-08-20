---
type: is
id: is-01m0c5qm44fxj4m6tr29k2v29f
title: "Phase 3: slots in the reconcile engine"
kind: task
status: closed
priority: 3
version: 5
spec_path: docs/project/specs/active/plan-2026-08-18-tracker-state-model-and-linear-mapping.md
labels: []
dependencies:
  - type: blocks
    target: is-01m0c5qw38xxxfgr8grwwnyz7x
parent_id: is-01m0bahns9883ea2cn8ajgnf99
created_at: 2026-08-19T04:51:05.475Z
updated_at: 2026-08-20T00:54:57.739Z
closed_at: 2026-08-20T00:54:57.737Z
close_reason: |-
  State Phase 3 landed in c17077be, 52e5aa4e, 45f41d04: slot vocabulary with precedence-tested computation and decomposition; slotFromLinear/slotToLinear; matrix widened to compare slots with band-level tolerance while a migrated base is coarse (the zero-writes upgrade property, proven by removing the tolerance and watching exactly those tests fail); local slots from readiness, remote slots from the adapter; pull decomposition in the engine where the invariants live; no-fight property pinned before the widening.
  NOT DONE: the refinement record's durable home (extensions vs link record) — a team's own column currently reads as its band slot for the matrix but its exact state id is not yet preserved outbound, so a sync can drag an issue out of a custom column. That is the remaining open decision.
resolution: null
duplicate_of: null
extensions:
  linear:
    id: d005ac9a-ad75-4650-8b5b-24e64457e609
    linked_at: 2026-08-19T16:27:16.091Z
---
Widen the reconcile canonical status field from the five-value enum to the slot vocabulary (backlog|draft|todo|in_progress|paused|blocked|in_review|done|canceled|duplicate). Legacy path with no state_map keeps statusToLinear/statusFromLinear byte-for-byte.

Local slot computation by the fixed precedence ladder; pull decomposition back onto bead fields; remote slot resolution by name, with unmapped names becoming owned refinements (band slot for the matrix, exact state id preserved outbound). Settle the refinement record's home (extensions.<provider> vs the pair's link record) by testing two clones against one team. Base migration on first slot run: zero writes on an unchanged repository, pinned by test. Outbound ladder: mapped state, else carrier label plus band default, else band default.

Depends on Phase 1's resolver and Phase 2's hold fields.
