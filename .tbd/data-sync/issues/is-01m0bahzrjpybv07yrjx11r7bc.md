---
type: is
id: is-01m0bahzrjpybv07yrjx11r7bc
title: "Phase 1: terminal resolution and name-based state resolution"
kind: task
status: in_progress
priority: 2
version: 6
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
updated_at: 2026-08-19T05:57:20.704Z
---
Add `resolution` and `duplicate_of` (scalar, not a dependency edge); `tbd close --as`; map all three terminal cases in both directions, creating the provider-side duplicate relation from the scalar; send completedAt only for completed; replace stateIdsByType with the four-step name-first resolver plus `state_map` keyed by slot; prompt on ambiguity and refuse non-interactively; doctor reports the resolved state per slot.

Useful alone and unblocks every later phase. Also carries the f08 passthrough test that decides the format-bump question for both specs. Checklist is in the spec; decompose into per-item beads when work starts.

## Notes

PARTIAL (aa49219e). DONE: resolution + duplicate_of schema with write-boundary invariants; tbd close --as completed|canceled|duplicate with --duplicate-of; reopen clears the axis; ISSUE_FIELD_ORDER, FIELD_STRATEGIES, ISSUE_CHANGE_FIELD_ORDER registered; schema + storage tests.
NOT DONE: Linear terminal mapping outbound/inbound (statusToLinear/statusFromLinear still collapse all three terminal types to closed); completedAt gated on resolution==completed (adapter.ts:134, mirror.ts:258); stateIdsByType -> name-based resolver; state_map config; doctor slot table; f08 passthrough test.
Note: mapping.ts change will break integrations-core.test.ts:104-110 and :123-125, and the resolver will break linear-adapter.test.ts:108 and :115 — those tests encode the old contract deliberately.
