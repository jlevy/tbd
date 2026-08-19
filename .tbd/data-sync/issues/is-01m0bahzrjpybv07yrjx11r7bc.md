---
type: is
id: is-01m0bahzrjpybv07yrjx11r7bc
title: "Phase 1: terminal resolution and name-based state resolution"
kind: task
status: open
priority: 2
version: 2
spec_path: docs/project/specs/active/plan-2026-08-18-tracker-state-model-and-linear-mapping.md
labels: []
dependencies:
  - type: blocks
    target: is-01m0baj02g8vwdd94fd2cgck33
parent_id: is-01m0bahns9883ea2cn8ajgnf99
created_at: 2026-08-18T20:56:09.234Z
updated_at: 2026-08-18T20:56:14.169Z
---
Add `resolution` and `duplicate_of`; `tbd close --as`; map all three terminal cases in both directions; send completedAt only for completed; replace stateIdsByType with the four-step name-first resolver plus `state_map`; prompt on ambiguity and refuse non-interactively; doctor reports the resolved state per status.

Useful alone and unblocks Phase 2. Checklist is in the spec; decompose into per-item beads when work starts.
