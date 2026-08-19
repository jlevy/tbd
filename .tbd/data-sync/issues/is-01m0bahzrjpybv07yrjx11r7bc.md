---
type: is
id: is-01m0bahzrjpybv07yrjx11r7bc
title: "Phase 1: terminal resolution and name-based state resolution"
kind: task
status: closed
priority: 2
version: 10
spec_path: docs/project/specs/active/plan-2026-08-18-tracker-state-model-and-linear-mapping.md
delegate: claude-code@spud10
labels: []
dependencies:
  - type: blocks
    target: is-01m0baj02g8vwdd94fd2cgck33
  - type: blocks
    target: is-01m0c5rk9zcamj2r525dazj73w
parent_id: is-01m0bahns9883ea2cn8ajgnf99
created_at: 2026-08-18T20:56:09.234Z
updated_at: 2026-08-19T20:01:59.364Z
closed_at: 2026-08-19T20:01:59.363Z
close_reason: "State Phase 1 complete across aa49219e, 2c0e66f4, c799d9af: resolution + duplicate_of with write-boundary invariants, tbd close --as, reopen clears the axis, terminal mapping lossless both directions, completedAt only for resolution=completed, name-based state resolution with state_map, doctor state-resolution table offline. Residual: interactive prompt-on-ambiguity persisting into state_map (the resolver reports ambiguity but does not yet ask); f08 passthrough test for the new fields."
resolution: null
duplicate_of: null
extensions:
  linear:
    id: 0f3d0ff6-004a-411a-86bc-baf8eaf9b236
    linked_at: 2026-08-19T16:27:10.388Z
---
Add `resolution` and `duplicate_of` (scalar, not a dependency edge); `tbd close --as`; map all three terminal cases in both directions, creating the provider-side duplicate relation from the scalar; send completedAt only for completed; replace stateIdsByType with the four-step name-first resolver plus `state_map` keyed by slot; prompt on ambiguity and refuse non-interactively; doctor reports the resolved state per slot.

Useful alone and unblocks every later phase. Also carries the f08 passthrough test that decides the format-bump question for both specs. Checklist is in the spec; decompose into per-item beads when work starts.

## Notes

DONE (aa49219e, 2c0e66f4). resolution + duplicate_of schema with write-boundary invariants; tbd close --as with --duplicate-of; reopen clears the axis; terminal mapping lossless both directions; completedAt sent only for resolution=completed; state resolution by name (configured -> conventional -> sole -> ambiguous-and-reported), never by board position; state_map wired config->settings->adapter; registries updated.
LIVE VERIFIED against team OS: tbd-f8y4 landed as Linear OS-242 in Canceled/canceled with completedAt=null and canceledAt set. Under the old code that bead would have gone to Done with a completion stamp.
NOT DONE: doctor slot table (tbd doctor printing slot/name/id/bound-or-missing offline); f08 passthrough test for the new fields; interactive prompt-on-ambiguity persisting to state_map (resolver reports ambiguity, does not yet ask).
